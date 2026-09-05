const scoring = require('./flowcore-scoring.js');
const report = require('./flowcore-report.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runCase(name, fn) {
  try {
    fn();
    console.log('PASS', name);
  } catch (e) {
    console.error('FAIL', name, '-', e.message);
    process.exitCode = 1;
  }
}

function allResponses(rawValue, evidenceType = 'self_reported') {
  return scoring.QUESTION_LIST.map((q) => ({
    question_id: q.question_id,
    raw_response: rawValue,
    evidence_type: evidenceType
  }));
}

function allScoredResponses(scoredValue, evidenceType = 'self_reported') {
  return scoring.QUESTION_LIST.map((q) => ({
    question_id: q.question_id,
    scored_response: scoredValue,
    evidence_type: evidenceType
  }));
}

function withOverrides(baseValue, overrides, evidenceType = 'self_reported') {
  const map = Object.fromEntries(allResponses(baseValue, evidenceType).map((r) => [r.question_id, r]));
  Object.keys(overrides).forEach((qid) => {
    const v = overrides[qid];
    if (typeof v === 'object' && v !== null) map[qid] = { ...map[qid], ...v };
    else map[qid] = { ...map[qid], raw_response: v };
  });
  return Object.values(map);
}

function withScoredOverrides(baseValue, overrides, evidenceType = 'self_reported') {
  const map = Object.fromEntries(allScoredResponses(baseValue, evidenceType).map((r) => [r.question_id, r]));
  Object.keys(overrides).forEach((qid) => {
    const v = overrides[qid];
    if (typeof v === 'object' && v !== null) map[qid] = { ...map[qid], ...v };
    else map[qid] = { ...map[qid], scored_response: v };
  });
  return Object.values(map);
}

function envelopeFromResult(result, responses, supplemental) {
  return {
    scoring_version: result.scoring_version,
    completion_timestamp: new Date().toISOString(),
    raw_core_responses: responses,
    scored_core_responses: result.question_scores,
    supplemental_values: supplemental || {},
    engine_scores: result.engine_scores,
    overall_flowscale_score: result.overall_score,
    maturity_stage: result.maturity_stage,
    primary_constraint: result.primary_constraint,
    secondary_constraint: result.secondary_constraint,
    ranked_constraint_candidates: result.constraint_candidates,
    diagnostic_confidence: result.diagnostic_confidence,
    data_quality_flags: result.data_quality_flags,
    scaling_decision: result.scaling_decision.decision,
    decision_confidence_status: result.scaling_decision.decision_confidence_status,
    derived_metrics: result.derived_conversion_metrics,
    expansion_ready: result.expansion_ready,
    scoring_output: result
  };
}

function buildModel(responses, supplemental) {
  const result = scoring.scoreDiagnostic({ responses, supplemental: supplemental || {} });
  return report.buildReportModel(envelopeFromResult(result, responses, supplemental || {}));
}

runCase('A: third-ranked below 180 does not display', () => {
  const responses = withScoredOverrides(4, {
    C1: 0,
    C2: 0
  });
  const m = buildModel(responses, { conversion: { leads_count: 500, appointments_count: 120, qualified_opportunities_count: 80, sales_customers_count: 30 } });
  const candidateCount = m.chain.length;
  assert(candidateCount <= 2, 'scenario should not expose a third qualifying chain candidate');
  assert(m.constraints.next_priority_constraint === null, 'next priority should be null');
});

runCase('B: third-ranked >=180 displays as next priority constraint', () => {
  const responses = withScoredOverrides(4, {
    C1: 0,
    C2: 0,
    D2: 0,
    I4: 0
  });
  const m = buildModel(responses, {});
  assert(m.constraints.next_priority_constraint, 'next priority constraint should display');
  assert(m.constraints.next_priority_constraint.priority_score >= 180, 'next priority threshold should be respected');
});

runCase('C: no downstream/future bottleneck terminology in report model text', () => {
  const responses = withOverrides(4, { C1: 0, C2: 0, D2: 0, I4: 4 });
  const m = buildModel(responses, {});
  const serialized = JSON.stringify(m).toLowerCase();
  assert(!serialized.includes('likely next constraint'), 'legacy likely-next term must not remain');
  assert(!serialized.includes('future bottleneck'), 'future bottleneck term must not appear');
});

runCase('D: INVALID decision-critical data => VALIDATE DATA', () => {
  const responses = withOverrides(3, {});
  const supplemental = { value: { avg_gross_margin_pct: 150 } };
  const m = buildModel(responses, supplemental);
  assert(m.next_step.category === 'VALIDATE DATA', 'invalid data should force validate data');
  assert(m.next_step.precedence_code === 'A', 'should follow precedence rule A');
});

runCase('E: critical operating constraint + clarification-only data => REPAIR FIRST', () => {
  const responses = withOverrides(4, {
    C1: 0,
    C2: 0,
    D2: 0,
    I4: 4
  });
  const supplemental = { conversion: { leads_count: 50, appointments_count: 55, qualified_opportunities_count: 40, sales_customers_count: 20 } };
  const m = buildModel(responses, supplemental);
  assert(m.next_step.category === 'REPAIR FIRST', 'critical operating blocker should dominate clarification flags');
  assert(m.next_step.precedence_code === 'B', 'should follow precedence rule B');
});

runCase('F: SCALE but not Expansion Ready => PREPARE TO SCALE', () => {
  const responses = withScoredOverrides(4, { M1: 2, M2: 2, M3: 2, M4: 2 }, 'verified');
  const m = buildModel(responses, {});
  assert(m.executive.scaling_decision === 'SCALE', 'scenario should be SCALE');
  assert(m.expansion.eligible === false, 'scenario should fail expansion-ready eligibility');
  assert(m.next_step.category === 'PREPARE TO SCALE', 'should prepare to scale');
  assert(m.next_step.precedence_code === 'E', 'should follow precedence rule E');
});

runCase('G: Expansion Ready eligible => EXPANSION PLANNING', () => {
  const responses = allScoredResponses(4, 'verified');
  const m = buildModel(responses, {});
  assert(m.expansion.eligible === true, 'should be expansion ready');
  assert(m.next_step.category === 'EXPANSION PLANNING', 'should use expansion planning');
  assert(m.next_step.precedence_code === 'F', 'should follow precedence rule F');
});

runCase('H: weak FAQ process may generate AI ASSIST', () => {
  const responses = withOverrides(3, {
    M2: 1,
    V1: 2
  });
  const m = buildModel(responses, {});
  const faq = m.ai_opportunities.items.find((i) => i.process === 'FAQ handling');
  assert(faq, 'FAQ mapping should appear');
  assert(faq.category === 'AI ASSIST', 'FAQ should map to AI ASSIST');
});

runCase('I: weak complex-sales process does NOT generate AI EXECUTE', () => {
  const responses = withOverrides(3, {
    C3: 0,
    I1: 3,
    E3: 3
  });
  const m = buildModel(responses, {});
  const executeItems = m.ai_opportunities.items.filter((i) => i.category === 'AI EXECUTE + HUMAN OVERSIGHT');
  const complex = m.ai_opportunities.items.find((i) => i.process === 'Complex sales negotiation');
  assert(complex && complex.category === 'KEEP HUMAN', 'complex sales should remain KEEP HUMAN');
  assert(executeItems.every((x) => x.process !== 'Complex sales negotiation'), 'complex sales must not be AI EXECUTE');
});

runCase('J: weak complaint handling does NOT generate autonomous AI execution', () => {
  const responses = withOverrides(3, {
    D3: 0,
    I1: 3,
    E3: 3
  });
  const m = buildModel(responses, {});
  const complaint = m.ai_opportunities.items.find((i) => i.process === 'Complaint escalation');
  assert(complaint && complaint.category === 'KEEP HUMAN', 'complaint escalation should remain KEEP HUMAN');
  const autonomousComplaint = m.ai_opportunities.items.find((i) => i.process === 'Complaint escalation' && i.category !== 'KEEP HUMAN');
  assert(!autonomousComplaint, 'complaint escalation must not use autonomous AI execution categories');
});

if (process.exitCode) process.exit(process.exitCode);
console.log('All deterministic report hardening tests passed (A-J).');
