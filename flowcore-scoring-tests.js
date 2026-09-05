const scoring = require('./flowcore-scoring.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertBetween(value, min, max, label) {
  assert(value >= min && value <= max, `${label} expected ${min}-${max}, got ${value}`);
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
    if (typeof v === 'object' && v !== null) {
      map[qid] = { ...map[qid], ...v };
    } else {
      map[qid] = { ...map[qid], raw_response: v };
    }
  });
  return Object.values(map);
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

runCase('CASE A: all 0 => very low, Unstructured, HOLD', () => {
  const r = scoring.scoreDiagnostic({ responses: allResponses(0), supplemental: {} });
  assert(r.overall_score <= 10, 'overall score should be very low');
  assert(r.maturity_stage === 'Unstructured', 'stage should be Unstructured');
  assert(r.scaling_decision.decision === 'HOLD', 'decision should be HOLD');
});

runCase('CASE B: all scored 4 => 100, Expansion Ready, SCALE', () => {
  const responses = scoring.QUESTION_LIST.map((q) => ({
    question_id: q.question_id,
    scored_response: 4,
    evidence_type: 'self_reported'
  }));
  const r = scoring.scoreDiagnostic({ responses, supplemental: {} });
  assert(r.overall_score === 100, 'overall should be 100');
  assert(r.expansion_ready.expansion_ready_eligible === true, 'should be expansion-ready eligible');
  assert(r.scaling_decision.decision === 'SCALE', 'decision should be SCALE');
});

runCase('CASE C: strong marketing broken delivery => HOLD + delivery constraint', () => {
  const responses = withOverrides(4, {
    D1: 0, D2: 1, D3: 0, D4: 1,
    I1: 2, I2: 2, I3: 2, I4: 2,
    E1: 2, E2: 2, E3: 2, E4: 2
  });
  const r = scoring.scoreDiagnostic({ responses, supplemental: {} });
  assert(r.expansion_ready.expansion_ready_eligible === false, 'should not be expansion ready');
  assert(r.scaling_decision.decision === 'HOLD', 'should be HOLD');
  assert(r.primary_constraint && r.primary_constraint.engine === 'delivery', 'delivery should rank highly');
});

runCase('CASE D: weak acquisition strong ops => acquisition major candidate', () => {
  const responses = withOverrides(4, {
    A1: 1, A2: 1, A3: 1, A4: 1
  });
  const r = scoring.scoreDiagnostic({ responses, supplemental: {} });
  const hasAcq = r.constraint_candidates.slice(0, 5).some((c) => c.engine === 'acquisition');
  assert(hasAcq, 'acquisition should appear as major candidate');
});

runCase('CASE E: many leads, weak C1/C2 => conversion outranks mediocre issue', () => {
  const responses = withOverrides(3, { C1: 0, C2: 0, M3: 2 });
  const r = scoring.scoreDiagnostic({
    responses,
    supplemental: {
      conversion: { leads_count: 500, appointments_count: 120, qualified_opportunities_count: 80, sales_customers_count: 30 }
    }
  });
  assert(r.primary_constraint && r.primary_constraint.engine === 'conversion', 'conversion should outrank mediocre market issue');
});

runCase('CASE F: high average but one engine < 70 => not expansion ready', () => {
  const responses = withOverrides(4, { M1: 2, M2: 2, M3: 2, M4: 2 });
  const r = scoring.scoreDiagnostic({ responses, supplemental: {} });
  assert(r.overall_score >= 88, 'overall should still be high');
  assert(r.expansion_ready.expansion_ready_candidate === true, 'should be candidate');
  assert(r.expansion_ready.expansion_ready_eligible === false, 'should fail eligibility guardrail');
});

runCase('CASE G: I4 raw=4 => scored maturity 0', () => {
  const responses = withOverrides(4, { I4: 4 });
  const r = scoring.scoreDiagnostic({ responses, supplemental: {} });
  const i4 = r.question_scores.find((q) => q.question_id === 'I4');
  assert(i4.raw_response === 4, 'I4 raw should be 4');
  assert(i4.scored_response === 0, 'I4 scored should be 0');
  assert(i4.normalized_score === 0, 'I4 normalized should be 0');
});

runCase('CASE H: missing denominators => derived metrics null + info flags', () => {
  const r = scoring.scoreDiagnostic({
    responses: allResponses(3),
    supplemental: { conversion: { leads_count: 0, appointments_count: 10, qualified_opportunities_count: '', sales_customers_count: 4 } }
  });
  assert(r.derived_conversion_metrics.booking_rate === null, 'booking rate should be null');
  assert(r.derived_conversion_metrics.close_rate === null, 'close rate should be null');
  assert(r.derived_conversion_metrics.lead_to_customer_rate === null, 'lead-to-customer should be null');
  assert(r.data_quality_flags.some((f) => f.severity === 'INFO'), 'info flags should be present');
});

runCase('CASE I: Endless Flow early foundation profile', () => {
  const responses = withOverrides(2, {
    M1: 2, M2: 2, M3: 2, M4: 2,
    V1: 2, V2: 2, V3: 2, V4: 2,
    A1: 1, A2: 1, A3: 1, A4: 1,
    C1: 1, C2: 1, C3: 1, C4: 1,
    D1: 1, D2: 2, D3: 2, D4: 1,
    I1: 1, I2: 1, I3: 1, I4: 3,
    E1: 0, E2: 1, E3: 2, E4: 0
  });
  const r = scoring.scoreDiagnostic({ responses, supplemental: {} });
  assertBetween(r.engine_scores.market, 50, 56, 'market');
  assertBetween(r.engine_scores.value, 50, 56, 'value');
  assertBetween(r.engine_scores.acquisition, 25, 35, 'acquisition');
  assertBetween(r.engine_scores.conversion, 25, 35, 'conversion');
  assertBetween(r.engine_scores.delivery, 35, 45, 'delivery');
  assertBetween(r.engine_scores.independence, 20, 30, 'independence');
  assertBetween(r.engine_scores.expansion, 15, 25, 'expansion');
  assert(r.maturity_stage === 'Foundation', 'should be Foundation stage');
  assert(r.scaling_decision.decision === 'HOLD', 'should be HOLD');
  assert(r.expansion_ready.expansion_ready_eligible === false, 'should not be expansion ready');
  assert(r.constraint_candidates.some((c) => c.engine === 'acquisition' || c.question_id === 'I4'), 'acquisition or owner-dependency should rank');
});

runCase('CASE J: great marketing / bad fulfillment => HOLD + delivery critical', () => {
  const responses = withOverrides(4, {
    D1: 0, D2: 0, D3: 0, D4: 0
  });
  const r = scoring.scoreDiagnostic({ responses, supplemental: {} });
  assert(r.scaling_decision.decision === 'HOLD', 'must be HOLD');
  assert(r.primary_constraint && r.primary_constraint.engine === 'delivery', 'delivery should be top constraint');
  assert(r.primary_constraint.priority_score >= scoring.CONFIG.constraint.critical_priority_threshold, 'delivery constraint should be critical');
});

runCase('CASE K: owner-dependent successful business', () => {
  const responses = withOverrides(4, {
    I1: 2, I2: 2, I3: 2, I4: 4
  });
  const r = scoring.scoreDiagnostic({ responses, supplemental: {} });
  assert(r.engine_scores.independence < 75, 'independence should be weak');
  assert(r.expansion_ready.expansion_ready_eligible === false, 'not expansion-ready');
  assert(r.constraint_candidates.some((c) => c.question_id === 'I4'), 'owner dependency should rank');
});

runCase('CASE L: good maturity / poor data confidence => provisional', () => {
  const responses = withOverrides(3, {
    C1: { raw_response: 3, evidence_type: 'unknown' },
    C2: { raw_response: 3, evidence_type: 'not sure' },
    E2: { raw_response: 3, evidence_type: 'dont_know' },
    I1: { raw_response: 3, evidence_type: 'estimated_or_unknown' }
  }, 'self_reported');

  const r = scoring.scoreDiagnostic({
    responses,
    supplemental: { conversion: { leads_count: '', appointments_count: '', qualified_opportunities_count: '', sales_customers_count: '' } }
  });

  assert(r.overall_score >= 70, 'maturity can still be positive');
  assert(r.diagnostic_confidence.confidence_score < 50, 'confidence should be limited');
  assert(r.scaling_decision.decision_confidence_status === 'PROVISIONAL', 'decision should be provisional');
});

runCase('CASE M: contradictory funnel definitions => clarification, not invalid', () => {
  const r = scoring.scoreDiagnostic({
    responses: allResponses(3),
    supplemental: { conversion: { leads_count: 50, appointments_count: 55, qualified_opportunities_count: 40, sales_customers_count: 20 } }
  });
  const hasClarification = r.data_quality_flags.some((f) => f.code === 'APPOINTMENTS_EXCEED_LEADS' && f.severity === 'REQUIRES_CLARIFICATION');
  const hasInvalid = r.data_quality_flags.some((f) => f.severity === 'INVALID');
  assert(hasClarification, 'should require clarification');
  assert(!hasInvalid, 'should not auto-mark invalid');
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log('All deterministic scoring tests passed (A-M).');
