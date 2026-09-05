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

function withOverrides(baseValue, overrides, evidenceType = 'self_reported') {
  const map = Object.fromEntries(allResponses(baseValue, evidenceType).map((r) => [r.question_id, r]));
  Object.keys(overrides).forEach((qid) => {
    const v = overrides[qid];
    if (typeof v === 'object' && v !== null) map[qid] = { ...map[qid], ...v };
    else map[qid] = { ...map[qid], raw_response: v };
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

runCase('A: no completed result exists => safe empty state model', () => {
  const m = report.buildReportModel(null);
  assert(m.ok === false, 'model should fail when payload missing');
});

runCase('B: Foundation/HOLD profile => repair-oriented report', () => {
  const responses = withOverrides(2, {
    M1: 2, M2: 2, M3: 2, M4: 2,
    V1: 2, V2: 2, V3: 2, V4: 2,
    A1: 1, A2: 1, A3: 1, A4: 1,
    C1: 1, C2: 1, C3: 1, C4: 1,
    D1: 1, D2: 2, D3: 2, D4: 1,
    I1: 1, I2: 1, I3: 1, I4: 3,
    E1: 0, E2: 1, E3: 2, E4: 0
  });
  const supplemental = {};
  const result = scoring.scoreDiagnostic({ responses, supplemental });
  const m = report.buildReportModel(envelopeFromResult(result, responses, supplemental));
  assert(m.ok, 'model should build');
  assert(m.executive.scaling_decision === 'HOLD', 'should be HOLD');
  assert(m.flowplan[2].mode === 'VALIDATE & PREPARE', 'day 61-90 should validate for HOLD');
});

runCase('C: High-performing SCALE profile => accelerate phase', () => {
  const responses = scoring.QUESTION_LIST.map((q) => ({
    question_id: q.question_id,
    scored_response: 4,
    evidence_type: 'self_reported'
  }));
  const result = scoring.scoreDiagnostic({ responses, supplemental: {} });
  const m = report.buildReportModel(envelopeFromResult(result, responses, {}));
  assert(m.executive.scaling_decision === 'SCALE', 'should be SCALE');
  assert(m.flowplan[2].mode === 'ACCELERATE', 'should accelerate in days 61-90');
});

runCase('D: 88+ candidate failing guardrail => candidate not yet', () => {
  const responses = withOverrides(4, { M1: 2, M2: 2, M3: 2, M4: 2 });
  const result = scoring.scoreDiagnostic({ responses, supplemental: {} });
  const m = report.buildReportModel(envelopeFromResult(result, responses, {}));
  assert(m.expansion.is_candidate === true, 'should be candidate');
  assert(m.expansion.eligible === false, 'should not be eligible');
});

runCase('E: Missing funnel metrics => no fake leakage values', () => {
  const responses = allResponses(3);
  const supplemental = { conversion: { leads_count: '', appointments_count: '', qualified_opportunities_count: '', sales_customers_count: '' } };
  const result = scoring.scoreDiagnostic({ responses, supplemental });
  const m = report.buildReportModel(envelopeFromResult(result, responses, supplemental));
  assert(m.leakage.metrics.every((x) => x.value === null), 'all derived metrics should be null');
});

runCase('F: Clarification funnel metrics => clarification visible', () => {
  const responses = allResponses(3);
  const supplemental = { conversion: { leads_count: 50, appointments_count: 55, qualified_opportunities_count: 40, sales_customers_count: 20 } };
  const result = scoring.scoreDiagnostic({ responses, supplemental });
  const m = report.buildReportModel(envelopeFromResult(result, responses, supplemental));
  const booking = m.leakage.metrics.find((x) => x.name === 'Booking Rate');
  assert(booking.requires_clarification === true, 'booking should require clarification');
});

runCase('G: Owner dependency constraint => owner actions included', () => {
  const responses = withOverrides(4, { I1: 2, I2: 2, I3: 2, I4: 4 });
  const result = scoring.scoreDiagnostic({ responses, supplemental: {} });
  const m = report.buildReportModel(envelopeFromResult(result, responses, {}));
  const allPlanText = m.flowplan.map((p) => p.actions.join(' ')).join(' ');
  assert(/owner-only|owner/i.test(allPlanText), 'flowplan should include owner-dependency actions');
});

if (process.exitCode) process.exit(process.exitCode);
console.log('All deterministic report tests passed (A-G model validations).');
