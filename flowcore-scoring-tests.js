const scoring = require('./flowcore-scoring.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function allResponses(rawValue) {
  return scoring.QUESTION_LIST.map((q) => ({
    question_id: q.question_id,
    raw_response: rawValue,
    evidence_type: 'self_reported'
  }));
}

function withOverrides(baseValue, overrides) {
  const map = Object.fromEntries(allResponses(baseValue).map((r) => [r.question_id, r]));
  Object.keys(overrides).forEach((qid) => {
    map[qid] = { ...map[qid], raw_response: overrides[qid] };
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

runCase('CASE B: all 4 => 100, Expansion Ready, SCALE', () => {
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

runCase('CASE D: weak acquisition strong ops => acquisition major constraint candidate', () => {
  const responses = withOverrides(4, {
    A1: 1, A2: 1, A3: 1, A4: 1
  });
  const r = scoring.scoreDiagnostic({ responses, supplemental: {} });
  const hasAcq = r.constraint_candidates.slice(0, 5).some((c) => c.engine === 'acquisition');
  assert(hasAcq, 'acquisition should appear as major candidate');
  assert(r.engine_scores.delivery >= 75, 'delivery should not be marked broken');
});

runCase('CASE E: many leads, weak C1/C2 => conversion outranks mediocre issue', () => {
  const responses = withOverrides(3, {
    C1: 0,
    C2: 0,
    M3: 2
  });
  const r = scoring.scoreDiagnostic({
    responses,
    supplemental: {
      conversion: { leads_count: 500, appointments_count: 120, qualified_opportunities_count: 80, sales_customers_count: 30 }
    }
  });
  assert(r.primary_constraint && r.primary_constraint.engine === 'conversion', 'conversion should outrank mediocre marketing issue');
});

runCase('CASE F: high average but one engine < 70 => not expansion ready', () => {
  const responses = withOverrides(4, {
    M1: 2, M2: 2, M3: 2, M4: 2
  });
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

runCase('CASE H: missing denominators => derived metrics null', () => {
  const r = scoring.scoreDiagnostic({
    responses: allResponses(3),
    supplemental: { conversion: { leads_count: 0, appointments_count: 10, qualified_opportunities_count: '', sales_customers_count: 4 } }
  });
  assert(r.derived_conversion_metrics.booking_rate === null, 'booking rate should be null');
  assert(r.derived_conversion_metrics.close_rate === null, 'close rate should be null');
  assert(r.derived_conversion_metrics.lead_to_customer_rate === null, 'lead-to-customer should be null');
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log('All deterministic scoring tests passed.');
