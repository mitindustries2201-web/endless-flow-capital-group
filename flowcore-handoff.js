(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FlowcoreHandoff = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'ef_flowcore_contact_handoff_v1';
  var SCHEMA_VERSION = '1.0.0';
  var REPORT_VERSION = 'flowcore-report-v1';
  var SOURCE = 'self-reported-client-diagnostic';
  var HANDOFF_TTL_MS = 24 * 60 * 60 * 1000;

  var MAX_SHORT = 40;
  var MAX_MEDIUM = 80;
  var MAX_LONG = 140;

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function hasUnsafeContent(value) {
    var text = String(value || '').toLowerCase();
    return text.indexOf('<') >= 0 || text.indexOf('>') >= 0 || text.indexOf('javascript:') >= 0 || text.indexOf('onerror=') >= 0 || text.indexOf('onload=') >= 0;
  }

  function sanitizeString(value, maxLen) {
    if (typeof value !== 'string') return null;
    var text = value.trim();
    if (!text || text.length > maxLen) return null;
    if (hasUnsafeContent(text)) return null;
    return text;
  }

  function sanitizeCode(value) {
    var text = sanitizeString(value, MAX_SHORT);
    if (!text) return null;
    return /^[A-Z0-9_-]+$/i.test(text) ? text : null;
  }

  function sanitizeConstraint(candidate) {
    if (!isPlainObject(candidate)) return null;
    var code = sanitizeCode(candidate.question_id || candidate.code);
    var label = sanitizeString(candidate.label, MAX_LONG);
    if (!code || !label) return null;
    return { code: code, label: label };
  }

  function sanitizeNextStep(nextStep) {
    if (!isPlainObject(nextStep)) return null;
    var code = sanitizeCode(nextStep.precedence_code || nextStep.code);
    var label = sanitizeString(nextStep.category || nextStep.label, MAX_MEDIUM);
    if (!code || !label) return null;
    return { code: code, label: label };
  }

  function sanitizeScore(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (n < 0 || n > 100) return null;
    return Math.round(n);
  }

  function toIso(ms) {
    return new Date(ms).toISOString();
  }

  function toMs(iso) {
    if (typeof iso !== 'string') return null;
    var ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : null;
  }

  function nowMs() {
    return Date.now();
  }

  function hasForbiddenData(data) {
    var serialized = JSON.stringify(data || {}).toLowerCase();
    var forbidden = [
      'raw_core_responses',
      'scored_core_responses',
      'supplemental_values',
      'derived_metrics',
      'revenue',
      'margin',
      'cost',
      'leads_count',
      'appointments_count',
      'qualified_opportunities_count',
      'sales_customers_count',
      'firstName',
      'lastName',
      'email',
      'phone',
      'business_name',
      'website',
      'evidence_summary',
      'evidence_counts'
    ];
    for (var i = 0; i < forbidden.length; i++) {
      if (serialized.indexOf(String(forbidden[i]).toLowerCase()) >= 0) return true;
    }
    return false;
  }

  function validateHandoffShape(data, atMs) {
    if (!isPlainObject(data)) return { ok: false, reason: 'invalid_type' };
    if (hasForbiddenData(data)) return { ok: false, reason: 'forbidden_content' };

    var schemaVersion = sanitizeString(data.schema_version, MAX_SHORT);
    var scoringVersion = sanitizeString(data.scoring_version, MAX_MEDIUM);
    var reportVersion = sanitizeString(data.report_version, MAX_MEDIUM);
    var source = sanitizeString(data.source, MAX_MEDIUM);
    var stage = sanitizeString(data.maturity_stage, MAX_MEDIUM);
    var decisionStatus = sanitizeString(data.decision_status, MAX_MEDIUM);

    if (!schemaVersion || schemaVersion !== SCHEMA_VERSION) return { ok: false, reason: 'invalid_schema_version' };
    if (!scoringVersion) return { ok: false, reason: 'invalid_scoring_version' };
    if (!reportVersion || reportVersion !== REPORT_VERSION) return { ok: false, reason: 'invalid_report_version' };
    if (!source || source !== SOURCE) return { ok: false, reason: 'invalid_source' };
    if (!stage) return { ok: false, reason: 'invalid_stage' };
    if (!decisionStatus) return { ok: false, reason: 'invalid_decision_status' };

    var score = sanitizeScore(data.flowscale_score);
    if (score === null) return { ok: false, reason: 'invalid_score' };

    var created = toMs(data.createdAt);
    var expires = toMs(data.expiresAt);
    if (!Number.isFinite(created) || !Number.isFinite(expires)) return { ok: false, reason: 'invalid_timestamps' };
    if (expires <= created) return { ok: false, reason: 'invalid_expiry_order' };
    if (expires - created > HANDOFF_TTL_MS) return { ok: false, reason: 'invalid_ttl' };

    var now = Number.isFinite(atMs) ? atMs : nowMs();
    if (now > expires) return { ok: false, reason: 'expired' };

    var primary = sanitizeConstraint(data.primary_constraint);
    var secondary = sanitizeConstraint(data.secondary_constraint);
    if (!primary || !secondary) return { ok: false, reason: 'invalid_constraints' };

    var next = null;
    if (data.next_priority_constraint !== null && data.next_priority_constraint !== undefined) {
      next = sanitizeConstraint(data.next_priority_constraint);
      if (!next) return { ok: false, reason: 'invalid_next_priority_constraint' };
    }

    var nextStep = sanitizeNextStep(data.recommended_next_step);
    if (!nextStep) return { ok: false, reason: 'invalid_next_step' };

    return {
      ok: true,
      value: {
        schema_version: schemaVersion,
        scoring_version: scoringVersion,
        report_version: reportVersion,
        createdAt: toIso(created),
        expiresAt: toIso(expires),
        source: source,
        flowscale_score: score,
        maturity_stage: stage,
        decision_status: decisionStatus,
        primary_constraint: primary,
        secondary_constraint: secondary,
        next_priority_constraint: next,
        recommended_next_step: nextStep
      }
    };
  }

  function createHandoffFromReportModel(reportModel, atMs) {
    if (!isPlainObject(reportModel) || reportModel.ok !== true) return null;

    var created = Number.isFinite(atMs) ? atMs : nowMs();
    var expires = created + HANDOFF_TTL_MS;

    var executive = reportModel.executive || {};
    var constraints = reportModel.constraints || {};
    var metadata = reportModel.metadata || {};

    var handoff = {
      schema_version: SCHEMA_VERSION,
      scoring_version: String(metadata.scoring_version || '').trim() || 'unknown',
      report_version: REPORT_VERSION,
      createdAt: toIso(created),
      expiresAt: toIso(expires),
      source: SOURCE,
      flowscale_score: executive.score,
      maturity_stage: executive.stage,
      decision_status: executive.decision_status,
      primary_constraint: constraints.primary ? { code: constraints.primary.question_id, label: constraints.primary.label } : null,
      secondary_constraint: constraints.secondary ? { code: constraints.secondary.question_id, label: constraints.secondary.label } : null,
      next_priority_constraint: constraints.next_priority_constraint ? { code: constraints.next_priority_constraint.question_id, label: constraints.next_priority_constraint.label } : null,
      recommended_next_step: reportModel.next_step ? { code: reportModel.next_step.precedence_code, label: reportModel.next_step.category } : null
    };

    var validated = validateHandoffShape(handoff, created);
    return validated.ok ? validated.value : null;
  }

  function getStorage(storageOverride) {
    if (storageOverride) return storageOverride;
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
    return null;
  }

  function storageAvailable(storageOverride) {
    var storage = getStorage(storageOverride);
    if (!storage) return false;
    try {
      var probe = '__ef_flowcore_handoff_probe__';
      storage.setItem(probe, '1');
      storage.removeItem(probe);
      return true;
    } catch (err) {
      return false;
    }
  }

  function saveHandoff(handoff, storageOverride) {
    var storage = getStorage(storageOverride);
    if (!storageAvailable(storage)) return false;
    var validated = validateHandoffShape(handoff);
    if (!validated.ok) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(validated.value));
    return true;
  }

  function createAndStoreFromReportModel(reportModel, storageOverride, atMs) {
    var handoff = createHandoffFromReportModel(reportModel, atMs);
    if (!handoff) return { ok: false, reason: 'invalid_model' };
    var saved = saveHandoff(handoff, storageOverride);
    if (!saved) return { ok: false, reason: 'storage_unavailable_or_invalid' };
    return { ok: true, handoff: handoff };
  }

  function readValidHandoff(storageOverride, atMs) {
    var storage = getStorage(storageOverride);
    if (!storageAvailable(storage)) return { ok: false, reason: 'storage_unavailable' };

    var raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ok: false, reason: 'missing' };

    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return { ok: false, reason: 'invalid_json' };
    }

    var validated = validateHandoffShape(parsed, atMs);
    if (!validated.ok) {
      if (validated.reason === 'expired') storage.removeItem(STORAGE_KEY);
      return validated;
    }

    return { ok: true, value: validated.value };
  }

  function clearHandoff(storageOverride) {
    var storage = getStorage(storageOverride);
    if (!storage) return false;
    try {
      storage.removeItem(STORAGE_KEY);
      return true;
    } catch (err) {
      return false;
    }
  }

  function toContactFieldMap(handoff) {
    var validated = validateHandoffShape(handoff);
    if (!validated.ok) return null;
    var v = validated.value;
    return {
      diagnostic_summary_included: 'true',
      diagnostic_schema_version: v.schema_version,
      diagnostic_scoring_version: v.scoring_version,
      diagnostic_report_version: v.report_version,
      diagnostic_created_at: v.createdAt,
      diagnostic_expires_at: v.expiresAt,
      diagnostic_source: v.source,
      diagnostic_flowscale_score: String(v.flowscale_score),
      diagnostic_maturity_stage: v.maturity_stage,
      diagnostic_decision_status: v.decision_status,
      diagnostic_primary_constraint_code: v.primary_constraint.code,
      diagnostic_primary_constraint_label: v.primary_constraint.label,
      diagnostic_secondary_constraint_code: v.secondary_constraint.code,
      diagnostic_secondary_constraint_label: v.secondary_constraint.label,
      diagnostic_next_priority_constraint_code: v.next_priority_constraint ? v.next_priority_constraint.code : '',
      diagnostic_next_priority_constraint_label: v.next_priority_constraint ? v.next_priority_constraint.label : '',
      diagnostic_recommended_next_step_code: v.recommended_next_step.code,
      diagnostic_recommended_next_step_label: v.recommended_next_step.label
    };
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    SCHEMA_VERSION: SCHEMA_VERSION,
    REPORT_VERSION: REPORT_VERSION,
    SOURCE: SOURCE,
    HANDOFF_TTL_MS: HANDOFF_TTL_MS,
    storageAvailable: storageAvailable,
    createHandoffFromReportModel: createHandoffFromReportModel,
    validateHandoffShape: validateHandoffShape,
    saveHandoff: saveHandoff,
    createAndStoreFromReportModel: createAndStoreFromReportModel,
    readValidHandoff: readValidHandoff,
    clearHandoff: clearHandoff,
    toContactFieldMap: toContactFieldMap
  };
});
