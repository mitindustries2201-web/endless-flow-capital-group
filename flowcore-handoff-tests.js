const fs = require('fs');
const path = require('path');
const scoring = require('./flowcore-scoring.js');
const report = require('./flowcore-report.js');
const handoff = require('./flowcore-handoff.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runCase(name, fn) {
  try {
    fn();
    console.log('PASS', name);
  } catch (err) {
    console.error('FAIL', name, '-', err.message);
    process.exitCode = 1;
  }
}

function memorySessionStorage() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); }
  };
}

function scoredResponses(scoredValue, evidenceType = 'self_reported') {
  return scoring.QUESTION_LIST.map((q) => ({
    question_id: q.question_id,
    scored_response: scoredValue,
    evidence_type: evidenceType
  }));
}

function buildResultEnvelope() {
  const responses = scoredResponses(4, 'self_reported').map((r) => {
    if (r.question_id === 'C1' || r.question_id === 'C2' || r.question_id === 'D2') return { ...r, scored_response: 0 };
    return r;
  });
  const result = scoring.scoreDiagnostic({ responses, supplemental: {} });
  return {
    scoring_version: result.scoring_version,
    completion_timestamp: new Date('2026-09-07T00:00:00.000Z').toISOString(),
    scoring_output: result
  };
}

function validModel() {
  return report.buildReportModel(buildResultEnvelope());
}

runCase('A: valid derived report produces versioned summary', () => {
  const model = validModel();
  const createdAt = Date.parse('2026-09-07T10:00:00.000Z');
  const summary = handoff.createHandoffFromReportModel(model, createdAt);
  assert(summary, 'summary should be created');
  assert(summary.schema_version === handoff.SCHEMA_VERSION, 'schema version mismatch');
  assert(summary.report_version === handoff.REPORT_VERSION, 'report version mismatch');
  assert(summary.source === handoff.SOURCE, 'source mismatch');
  assert(Date.parse(summary.expiresAt) - Date.parse(summary.createdAt) === handoff.HANDOFF_TTL_MS, 'handoff ttl mismatch');
});

runCase('B: raw answers and supplemental metrics are excluded', () => {
  const summary = handoff.createHandoffFromReportModel(validModel());
  const serialized = JSON.stringify(summary);
  ['raw_core_responses', 'supplemental_values', 'derived_metrics', 'revenue', 'margin', 'cost'].forEach((token) => {
    assert(!serialized.toLowerCase().includes(token), 'summary must exclude token: ' + token);
  });
});

runCase('C: identity information is excluded', () => {
  const summary = handoff.createHandoffFromReportModel(validModel());
  const serialized = JSON.stringify(summary).toLowerCase();
  ['firstname', 'lastname', 'email', 'phone', 'businessname', 'website'].forEach((token) => {
    assert(!serialized.includes(token), 'identity token should not exist: ' + token);
  });
});

runCase('D: expired handoffs are rejected', () => {
  const summary = handoff.createHandoffFromReportModel(validModel(), Date.parse('2026-09-07T10:00:00.000Z'));
  const storage = memorySessionStorage();
  assert(handoff.saveHandoff(summary, storage), 'save should succeed');
  const read = handoff.readValidHandoff(storage, Date.parse('2026-09-08T10:00:00.001Z'));
  assert(!read.ok && read.reason === 'expired', 'expired handoff must be rejected');
  assert(storage.getItem(handoff.STORAGE_KEY) === null, 'expired handoff must be removed from storage');
});

runCase('E: malformed and oversized values are rejected', () => {
  const summary = handoff.createHandoffFromReportModel(validModel());
  summary.primary_constraint.code = 'bad code with spaces';
  assert(!handoff.validateHandoffShape(summary).ok, 'invalid code should fail validation');

  const summary2 = handoff.createHandoffFromReportModel(validModel());
  summary2.maturity_stage = 'x'.repeat(1000);
  assert(!handoff.validateHandoffShape(summary2).ok, 'oversized stage should fail validation');
});

runCase('F: script/HTML-like values cannot render unsafely', () => {
  const summary = handoff.createHandoffFromReportModel(validModel());
  summary.primary_constraint.label = '<img src=x onerror=alert(1)>';
  const result = handoff.validateHandoffShape(summary);
  assert(!result.ok, 'html/script-like summary values must be rejected');
});

runCase('G: no scoring or report methodology is recalculated', () => {
  const model = validModel();
  const before = JSON.stringify(model);
  const summary = handoff.createHandoffFromReportModel(model);
  const after = JSON.stringify(model);
  assert(summary.flowscale_score === model.executive.score, 'summary must use existing derived report score');
  assert(before === after, 'report model should not be mutated or recalculated');
});

runCase('H: contact form works without a handoff', () => {
  const contact = fs.readFileSync(path.join(__dirname, 'contact.html'), 'utf8');
  assert(contact.includes('var body = new URLSearchParams(new FormData(cform)).toString();'), 'contact form submission flow missing');
  assert(contact.includes('if (!window.FlowcoreHandoff) return;'), 'handoff initialization should be optional');
});

runCase('I: diagnostic fields are omitted unless inclusion is selected', () => {
  const summary = handoff.createHandoffFromReportModel(validModel());
  const fields = handoff.toContactFieldMap(summary);
  assert(fields.diagnostic_summary_included === 'true', 'included marker missing');
  const contact = fs.readFileSync(path.join(__dirname, 'contact.html'), 'utf8');
  assert(contact.includes('if (!includeSummary || !includeSummary.checked || !handoffValue || !window.FlowcoreHandoff) return;'), 'contact must gate diagnostic fields behind opt-in checkbox');
});

runCase('J: handoff remains after failed submission', () => {
  const contact = fs.readFileSync(path.join(__dirname, 'contact.html'), 'utf8');
  assert(!contact.includes('FlowcoreHandoff.clearHandoff();\n        cBtn.disabled = false'), 'handoff must not clear in failure path');
  assert(contact.includes('.catch(function(){'), 'failure handler missing');
});

runCase('K: handoff clears after success or explicit removal', () => {
  const storage = memorySessionStorage();
  const summary = handoff.createHandoffFromReportModel(validModel());
  assert(handoff.saveHandoff(summary, storage), 'save should succeed');
  assert(handoff.clearHandoff(storage), 'explicit clear should succeed');
  assert(storage.getItem(handoff.STORAGE_KEY) === null, 'handoff should clear on explicit removal');

  const contact = fs.readFileSync(path.join(__dirname, 'contact.html'), 'utf8');
  assert(contact.includes('FlowcoreHandoff.clearHandoff();'), 'success path should clear handoff when included');
});

if (process.exitCode) process.exit(process.exitCode);
console.log('All flowcore handoff tests passed (A-K).');
