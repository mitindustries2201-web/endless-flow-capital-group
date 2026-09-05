(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./flowcore-scoring.js'));
  } else {
    root.FlowcoreReport = factory(root.FlowcoreScoring);
  }
})(typeof self !== 'undefined' ? self : this, function (FlowcoreScoring) {
  'use strict';

  var RESULT_STORAGE_KEY = 'ef_flowcore_result_v1';
  var DIAGNOSTIC_STORAGE_KEY = 'ef_flowcore_diagnostic_v1';
  var NEXT_PRIORITY_CONSTRAINT_MIN_SCORE = 180;

  var ENGINE_STATUS_BANDS = [
    { min: 0, max: 29, label: 'Critical Foundation' },
    { min: 30, max: 44, label: 'Foundational' },
    { min: 45, max: 59, label: 'Developing' },
    { min: 60, max: 74, label: 'Managed' },
    { min: 75, max: 87, label: 'Strong' },
    { min: 88, max: 100, label: 'Advanced' }
  ];

  var ACTION_LIBRARY = {
    M1: { actions: ['Define the highest-fit customer profile criteria.', 'List disqualifiers for low-fit leads.', 'Review customer-fit criteria weekly.'] },
    M2: { actions: ['Document the primary customer pain/outcome statement.', 'Align messaging to the top problem-to-solution path.', 'Validate problem language in live sales conversations.'] },
    M3: { actions: ['Clarify the core differentiation claim.', 'Standardize positioning language across channels.', 'Test clarity with simple offer explanation checks.'] },
    M4: { actions: ['Capture demand evidence by source and outcome.', 'Track inquiry-to-sale patterns for target segments.', 'Prioritize channels showing repeat purchase intent.'] },
    V1: { actions: ['Define offer scope, outcome, and boundaries.', 'Standardize offer packaging and delivery expectations.', 'Remove ambiguous offer variants.'] },
    V2: { actions: ['Document pricing logic tied to value and costs.', 'Set pricing floor/ceiling guardrails.', 'Review discount and exception rules monthly.'] },
    V3: { actions: ['Implement baseline gross-margin visibility.', 'Track cost inputs per sale consistently.', 'Review gross profit with management cadence.'] },
    V4: { actions: ['Track conversion and retention by offer.', 'Compare offer performance against margins.', 'Retire low-performing low-margin offers.'] },
    A1: { actions: ['Tag lead sources consistently.', 'Reconcile source data weekly.', 'Focus on channels with reliable lead quality.'] },
    A2: { actions: ['Set qualified-opportunity volume targets.', 'Measure lead consistency weekly.', 'Define contingency actions for lead shortfalls.'] },
    A3: { actions: ['Audit all capture points for friction.', 'Standardize lead-capture forms and fields.', 'Add capture QA checks on high-traffic pages.'] },
    A4: { actions: ['Define source-attribution rules.', 'Ensure sales records include source lineage.', 'Review attribution accuracy monthly.'] },
    C1: { actions: ['Set and enforce response-time standards.', 'Implement immediate lead acknowledgment.', 'Assign lead ownership and backup coverage.', 'Review response-time compliance weekly.'] },
    C2: { actions: ['Define follow-up sequence stages.', 'Set clear stop/continue follow-up rules.', 'Track follow-up completion rates.', 'Measure conversion by follow-up stage.'] },
    C3: { actions: ['Document qualification criteria.', 'Use consistent sales-stage definitions.', 'Track stage movement and conversion losses.'] },
    C4: { actions: ['Standardize booking workflow and confirmations.', 'Introduce reminder sequence to reduce no-shows.', 'Track booking-to-attendance reliability.'] },
    D1: { actions: ['Create a consistent onboarding checklist.', 'Define first-30-day customer milestones.', 'Audit onboarding completion rates.'] },
    D2: { actions: ['Document fulfillment workflow.', 'Define quality checkpoints per delivery stage.', 'Identify capacity bottlenecks and failure points.', 'Review quality-control outcomes weekly.'] },
    D3: { actions: ['Establish service-quality monitoring routine.', 'Define complaint/escalation pathways.', 'Track recurring service failure patterns.'] },
    D4: { actions: ['Create retention and repeat-purchase cadence.', 'Automate review/referral prompts where appropriate.', 'Track churn/reactivation outcomes monthly.'] },
    I1: { actions: ['Consolidate critical customer data in one system.', 'Define required fields and ownership.', 'Run weekly data-completeness checks.'] },
    I2: { actions: ['Document recurring processes step-by-step.', 'Assign process owners and backups.', 'Audit process adherence monthly.'] },
    I3: { actions: ['Identify repetitive manual tasks.', 'Automate low-judgment repetitive steps.', 'Measure cycle-time reduction after automation.'] },
    I4: { actions: ['Identify owner-only processes.', 'Document recurring decisions and escalation paths.', 'Delegate repeatable operational responsibilities.', 'Set owner-absence continuity checks.'] },
    E1: { actions: ['Run capacity stress test scenarios.', 'Set volume limits per delivery unit.', 'Prepare surge-handling playbook.'] },
    E2: { actions: ['Establish recurring revenue/cost reporting.', 'Define gross-margin visibility cadence.', 'Review cash requirements before scaling decisions.', 'Implement management reporting routine.'] },
    E3: { actions: ['Define KPI baseline dashboard fields.', 'Set KPI review cadence with owners.', 'Use KPI variance triggers for intervention.'] },
    E4: { actions: ['Map growth dependencies by engine.', 'Sequence expansion actions against constraints.', 'Gate volume increases behind stability checkpoints.'] }
  };

  var SYSTEM_ARCHITECTURE_MAPPINGS = [
    {
      id: 'response-followup-chain',
      trigger_process: 'Lead Response + Follow-Up + Booking',
      trigger_question_ids: ['C1', 'C2', 'C4'],
      trigger_maturity_threshold_lt: 75,
      current_state_label: 'Lead captured -> inconsistent response -> manual follow-up',
      recommended_state_label: 'Lead captured -> reliable rapid response -> structured follow-up -> qualification -> booking -> reminders',
      reason: 'Conversion flow requires consistent response, follow-up, and booking discipline before adding volume.'
    },
    {
      id: 'delivery-standardization',
      trigger_process: 'Onboarding + Fulfillment',
      trigger_question_ids: ['D1', 'D2'],
      trigger_maturity_threshold_lt: 75,
      current_state_label: 'Sale closed -> inconsistent onboarding/fulfillment',
      recommended_state_label: 'Sale closed -> standardized onboarding -> documented fulfillment checkpoints -> quality control',
      reason: 'Delivery reliability should be systemized before growth pressure increases service load.'
    },
    {
      id: 'operating-independence',
      trigger_process: 'Centralized Data + Process Documentation + Owner Dependency',
      trigger_question_ids: ['I1', 'I2', 'I4'],
      trigger_maturity_threshold_lt: 75,
      current_state_label: 'Owner-driven operations with fragmented process memory',
      recommended_state_label: 'Centralized data -> documented processes -> delegated ownership -> escalation rules',
      reason: 'Independence constraints create fragility and should be reduced before scale acceleration.'
    },
    {
      id: 'visibility-governance',
      trigger_process: 'Financial + KPI Visibility',
      trigger_question_ids: ['E2', 'E3'],
      trigger_maturity_threshold_lt: 75,
      current_state_label: 'Growth decisions with incomplete financial/KPI visibility',
      recommended_state_label: 'Capacity and growth decisions guided by recurring financial/KPI reporting',
      reason: 'Expansion decisions require recurring visibility into economics and performance metrics.'
    }
  ];

  var AI_OPPORTUNITY_MAPPINGS = [
    {
      id: 'appointment-reminders',
      process: 'Appointment reminders',
      trigger: 'C4 maturity < 88',
      classification: 'AUTOMATE',
      rationale: 'Reminder workflows are repetitive and low-judgment, making deterministic automation appropriate.',
      safeguards: 'Escalate unresolved schedule conflicts to a human owner.',
      evaluate: function (ctx) { return ctx.q('C4') && ctx.q('C4').normalized_score < 88; }
    },
    {
      id: 'review-requests',
      process: 'Review requests',
      trigger: 'D4 maturity < 88',
      classification: 'AUTOMATE',
      rationale: 'Post-delivery review prompts are recurring and can be automated with clear rules.',
      safeguards: 'Exclude unresolved complaint cases from automated review requests.',
      evaluate: function (ctx) { return ctx.q('D4') && ctx.q('D4').normalized_score < 88; }
    },
    {
      id: 'lead-response-assist',
      process: 'Missed lead response triage',
      trigger: 'C1 maturity < 75 AND C2 maturity >= 25',
      classification: 'AI ASSIST',
      rationale: 'Assisted draft responses can reduce first-touch delays while preserving human control over final outreach.',
      safeguards: 'Human approval required before outbound messages for sensitive or high-value leads.',
      evaluate: function (ctx) {
        var c1 = ctx.q('C1');
        var c2 = ctx.q('C2');
        return c1 && c2 && c1.normalized_score < 75 && c2.normalized_score >= 25;
      }
    },
    {
      id: 'pipeline-summaries',
      process: 'Pipeline summaries',
      trigger: '(I1 maturity < 75 OR E3 maturity < 75) AND evidence coverage >= 70%',
      classification: 'AI ASSIST',
      rationale: 'Summarization assists operator review without delegating operational judgment.',
      safeguards: 'Use summaries for review support only; final decisions remain with humans.',
      evaluate: function (ctx) {
        var i1 = ctx.q('I1');
        var e3 = ctx.q('E3');
        return (i1 && i1.normalized_score < 75 || e3 && e3.normalized_score < 75) && ctx.evidenceCoveragePct >= 70;
      }
    },
    {
      id: 'faq-assist',
      process: 'FAQ handling',
      trigger: 'M2 maturity < 60 AND V1 maturity >= 45',
      classification: 'AI ASSIST',
      rationale: 'FAQ assistance can reduce repetitive support load when offer framing is at least partially defined.',
      safeguards: 'Escalate pricing exceptions, complaints, and contract interpretation to humans.',
      evaluate: function (ctx) {
        var m2 = ctx.q('M2');
        var v1 = ctx.q('V1');
        return m2 && v1 && m2.normalized_score < 60 && v1.normalized_score >= 45;
      }
    },
    {
      id: 'kpi-rollup',
      process: 'KPI data normalization',
      trigger: 'I1 maturity <= 50 AND E3 maturity <= 50 AND no INVALID data flags',
      classification: 'AI EXECUTE + HUMAN OVERSIGHT',
      rationale: 'Structured metric rollups can be executed automatically when strict human review gates are enforced.',
      safeguards: 'Human approval required before metric publication or strategy changes.',
      evaluate: function (ctx) {
        var i1 = ctx.q('I1');
        var e3 = ctx.q('E3');
        return i1 && e3 && i1.normalized_score <= 50 && e3.normalized_score <= 50 && !ctx.hasInvalid;
      }
    },
    {
      id: 'funnel-definition-redesign',
      process: 'Conflicting funnel definitions',
      trigger: 'Any REQUIRES_CLARIFICATION funnel flag',
      classification: 'ELIMINATE / REDESIGN',
      rationale: 'Inconsistent stage definitions should be redesigned before downstream automation is expanded.',
      safeguards: 'Do not automate decision-critical funnel logic until definitions are normalized.',
      evaluate: function (ctx) { return ctx.hasClarification; }
    },
    {
      id: 'complex-sales-judgment',
      process: 'Complex sales negotiation',
      trigger: 'Always',
      classification: 'KEEP HUMAN',
      rationale: 'Complex negotiations require contextual judgment and risk balancing.',
      safeguards: 'AI may provide decision support only, not autonomous commitment authority.',
      evaluate: function () { return true; }
    },
    {
      id: 'complaint-escalation-judgment',
      process: 'Complaint escalation',
      trigger: 'Always',
      classification: 'KEEP HUMAN',
      rationale: 'Complaint resolution often involves sensitive context and customer-trust recovery decisions.',
      safeguards: 'Do not use autonomous AI for sensitive complaint resolution.',
      evaluate: function () { return true; }
    },
    {
      id: 'strategic-decision-support',
      process: 'Strategic decisions',
      trigger: 'Always',
      classification: 'KEEP HUMAN',
      rationale: 'Strategic decisions and high-impact irreversible decisions require executive accountability.',
      safeguards: 'Use AI for decision support summaries only; no autonomous execution on pricing, legal, hiring/firing, or financial commitments.',
      evaluate: function () { return true; }
    }
  ];

  var NEXT_STEP_PRECEDENCE = [
    {
      code: 'A',
      category: 'VALIDATE DATA',
      detail: function () { return 'Resolve INVALID decision-critical diagnostic inputs before relying on SCALE/HOLD conclusions.'; },
      predicate: function (ctx) { return ctx.hasDecisionCriticalInvalid; }
    },
    {
      code: 'B',
      category: 'REPAIR FIRST',
      detail: function (ctx) {
        if (ctx.primaryConstraint) return 'Repair ' + ctx.primaryConstraint.label + ' before materially increasing volume.';
        return 'Repair the current critical operating blocker before materially increasing volume.';
      },
      predicate: function (ctx) { return ctx.hasCriticalOperatingBlocker; }
    },
    {
      code: 'C',
      category: 'VALIDATE DATA',
      detail: function () { return 'Clarify decision-critical data definitions and strengthen evidence confidence before acceleration decisions.'; },
      predicate: function (ctx) { return !ctx.hasCriticalOperatingBlocker && (ctx.hasClarification || ctx.hasInsufficientConfidence); }
    },
    {
      code: 'D',
      category: 'SYSTEMIZE',
      detail: function () { return 'Systemize core workflows and verify stability before changing growth volume.'; },
      predicate: function (ctx) { return ctx.decision !== 'SCALE'; }
    },
    {
      code: 'E',
      category: 'PREPARE TO SCALE',
      detail: function () { return 'Scale decision is positive, but Expansion Ready guardrails are not yet met; systemize remaining constraints first.'; },
      predicate: function (ctx) { return ctx.decision === 'SCALE' && !ctx.expansionEligible; }
    },
    {
      code: 'F',
      category: 'EXPANSION PLANNING',
      detail: function () { return 'Expansion Ready guardrails are met. Plan controlled expansion with KPI and capacity guardrails.'; },
      predicate: function (ctx) { return ctx.expansionEligible; }
    }
  ];

  var MAJOR_OPERATING_HOLD_REASONS = {
    DELIVERY_BELOW_50: true,
    INDEPENDENCE_BELOW_50: true,
    CONVERSION_BELOW_50: true,
    EXPANSION_BELOW_50: true,
    MAJOR_UNKNOWN_FINANCIAL_VISIBILITY: true,
    INSUFFICIENT_CAPACITY_FOR_NEAR_TERM_SCALE: true,
    CRITICAL_CONSTRAINT_REQUIRES_REPAIR_FIRST: true
  };

  var FLAG_COPY = {
    APPOINTMENTS_EXCEED_LEADS: 'Appointments exceed reported leads. This can occur when funnel stages are defined differently; clarify before relying on booking rate.',
    SALES_EXCEED_QUALIFIED: 'Sales exceed qualified opportunities. Clarify qualification criteria before using close-rate conclusions.',
    SALES_EXCEED_LEADS: 'Customers exceed reported leads. Confirm stage definitions before using lead-to-customer conclusions.',
    BOOKING_RATE_UNAVAILABLE: 'Booking rate is unavailable because required denominator data was missing or zero.',
    CLOSE_RATE_UNAVAILABLE: 'Close rate is unavailable because required denominator data was missing or zero.',
    LEAD_TO_CUSTOMER_RATE_UNAVAILABLE: 'Lead-to-customer rate is unavailable because required denominator data was missing or zero.'
  };

  function safeNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    var n = Number(String(value).replace(/[$,%\s,]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function titleCase(text) {
    return String(text || '')
      .toLowerCase()
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map(function (part) { return part.charAt(0).toUpperCase() + part.slice(1); })
      .join(' ');
  }

  function engineStatus(score) {
    var n = Number(score);
    if (!Number.isFinite(n)) return 'Insufficient Data';
    for (var i = 0; i < ENGINE_STATUS_BANDS.length; i++) {
      var band = ENGINE_STATUS_BANDS[i];
      if (n >= band.min && n <= band.max) return band.label;
    }
    return 'Insufficient Data';
  }

  function normalizeSeverity(value) {
    var v = String(value || '').toUpperCase().replace(/\s+/g, '_');
    if (v === 'REQUIRES_CLARIFICATION') return 'REQUIRES CLARIFICATION';
    return v;
  }

  function constraintLabel(candidate) {
    if (!candidate) return 'None flagged';
    return candidate.question_id + ' — ' + candidate.label;
  }

  function constraintExplanation(candidate) {
    if (!candidate) return 'No deterministic constraint candidate met threshold conditions.';
    var sev = candidate.gap_severity >= 4 ? 'very low' : (candidate.gap_severity >= 3 ? 'low' : 'below-target');
    return candidate.label + ' is currently a high-priority constraint because maturity is ' + sev + ' while revenue impact, dependency, and urgency are strategically important.';
  }

  function nextPriorityConstraint(candidates) {
    var list = Array.isArray(candidates) ? candidates : [];
    var third = list[2];
    if (!third) return null;
    return third.priority_score >= NEXT_PRIORITY_CONSTRAINT_MIN_SCORE ? third : null;
  }

  function scorecardRows(result) {
    return FlowcoreScoring.ENGINE_CONFIG.map(function (engine) {
      var score = result.engine_scores ? result.engine_scores[engine.id] : null;
      return {
        id: engine.id,
        name: engine.name,
        weight: engine.weight,
        score: score,
        status: engineStatus(score),
        maturity_visual_pct: Number.isFinite(Number(score)) ? Math.max(0, Math.min(100, Number(score))) : 0
      };
    });
  }

  function buildLeakage(resultEnvelope) {
    var supplemental = (resultEnvelope && resultEnvelope.supplemental_values) || {};
    var conv = supplemental.conversion || {};
    var metrics = (resultEnvelope && resultEnvelope.derived_metrics) || {};
    var flags = (resultEnvelope && resultEnvelope.data_quality_flags) || [];

    var counts = {
      leads: safeNumber(conv.leads_count),
      appointments: safeNumber(conv.appointments_count),
      qualified: safeNumber(conv.qualified_opportunities_count),
      sales: safeNumber(conv.sales_customers_count)
    };

    function metricCard(name, value, clarificationCodes) {
      var clarification = flags.some(function (f) {
        return clarificationCodes.indexOf(f.code) >= 0 || (f.code || '').indexOf(name.toUpperCase().replace(/[^A-Z]/g, '_')) >= 0;
      });
      return {
        name: name,
        value: value,
        value_display: value === null || value === undefined ? 'Insufficient data to calculate this stage reliably.' : value + '%',
        requires_clarification: clarification,
        clarification_text: clarification ? 'Requires clarification before this metric should be used for decision-making.' : null
      };
    }

    return {
      counts: counts,
      metrics: [
        metricCard('Booking Rate', metrics.booking_rate, ['APPOINTMENTS_EXCEED_LEADS', 'BOOKING_RATE_REQUIRES_CLARIFICATION']),
        metricCard('Close Rate', metrics.close_rate, ['SALES_EXCEED_QUALIFIED', 'CLOSE_RATE_REQUIRES_CLARIFICATION']),
        metricCard('Lead-to-Customer Rate', metrics.lead_to_customer_rate, ['SALES_EXCEED_LEADS', 'LEAD_TO_CUSTOMER_REQUIRES_CLARIFICATION'])
      ],
      has_enough_for_funnel: counts.leads !== null || counts.appointments !== null || counts.qualified !== null || counts.sales !== null
    };
  }

  function pickActions(questionId) {
    var entry = ACTION_LIBRARY[questionId];
    return entry ? entry.actions.slice(0, 4) : ['Document current process baseline.', 'Define a minimum repeatable standard.', 'Review performance weekly.'];
  }

  function buildFlowPlan(result) {
    var primary = result.primary_constraint;
    var secondary = result.secondary_constraint;
    var decision = result.scaling_decision || {};

    var phase3Title = decision.decision === 'SCALE' ? 'ACCELERATE' : 'VALIDATE & PREPARE';
    var phase3Actions = decision.decision === 'SCALE'
      ? ['Increase volume incrementally behind KPI guardrails.', 'Monitor conversion and delivery stability weekly.', 'Expand only where capacity and economics remain healthy.']
      : ['Measure repaired workflow performance.', 'Verify conversion and delivery stability.', 'Establish KPI baseline and reassess expansion readiness.'];

    return [
      {
        window: 'Days 1–30',
        mode: 'REPAIR',
        focus: primary ? primary.label : 'Primary operating constraint',
        actions: pickActions(primary && primary.question_id)
      },
      {
        window: 'Days 31–60',
        mode: 'SYSTEMIZE',
        focus: secondary ? secondary.label : 'Secondary infrastructure improvements',
        actions: pickActions(secondary && secondary.question_id)
      },
      {
        window: 'Days 61–90',
        mode: phase3Title,
        focus: decision.decision === 'SCALE' ? 'Controlled volume expansion' : 'Operational validation before scale',
        actions: phase3Actions
      }
    ];
  }

  function buildNextStepContext(result) {
    var decision = (result.scaling_decision && result.scaling_decision.decision) || 'HOLD';
    var reasons = (result.scaling_decision && result.scaling_decision.reasons) || [];
    var flags = result.data_quality_flags || [];
    var confidence = result.diagnostic_confidence || {};
    var primaryConstraint = result.primary_constraint || null;
    var expansionEligible = !!(result.expansion_ready && result.expansion_ready.expansion_ready_eligible);

    var hasInvalid = flags.some(function (f) { return String(f.severity).toUpperCase() === 'INVALID'; });
    var hasClarification = flags.some(function (f) { return String(f.severity).toUpperCase() === 'REQUIRES_CLARIFICATION'; });
    var hasCriticalConstraint = (result.constraint_candidates || []).some(function (c) { return !!c.critical_priority; }) || !!(primaryConstraint && primaryConstraint.critical_priority);
    var hasMajorOperatingGuardrailReason = reasons.some(function (r) { return !!MAJOR_OPERATING_HOLD_REASONS[r]; });
    var hasCriticalOperatingBlocker = decision === 'HOLD' && (hasCriticalConstraint || hasMajorOperatingGuardrailReason);

    var confidenceScore = Number(confidence.confidence_score || 0);
    var evidenceCoveragePct = Number(confidence.evidence_coverage_pct || 0);
    var hasInsufficientConfidence = confidenceScore < 60 || evidenceCoveragePct < 70;

    return {
      decision: decision,
      reasons: reasons,
      flags: flags,
      hasInvalid: hasInvalid,
      hasClarification: hasClarification,
      hasCriticalConstraint: hasCriticalConstraint,
      hasMajorOperatingGuardrailReason: hasMajorOperatingGuardrailReason,
      hasCriticalOperatingBlocker: hasCriticalOperatingBlocker,
      hasInsufficientConfidence: hasInsufficientConfidence,
      hasDecisionCriticalInvalid: hasInvalid && (reasons.indexOf('INVALID_DATA_QUALITY_FLAG') >= 0 || true),
      primaryConstraint: primaryConstraint,
      expansionEligible: expansionEligible
    };
  }

  function buildRecommendedNextStep(result) {
    var ctx = buildNextStepContext(result);
    for (var i = 0; i < NEXT_STEP_PRECEDENCE.length; i++) {
      var rule = NEXT_STEP_PRECEDENCE[i];
      if (rule.predicate(ctx)) {
        return {
          category: rule.category,
          detail: rule.detail(ctx),
          precedence_code: rule.code
        };
      }
    }
    return {
      category: 'SYSTEMIZE',
      detail: 'Systemize core workflows and verify stability before scale changes.',
      precedence_code: 'D'
    };
  }

  function questionScoreIndex(result) {
    var index = {};
    (result.question_scores || []).forEach(function (q) {
      index[q.question_id] = q;
    });
    return index;
  }

  function buildArchitecture(result) {
    var idx = questionScoreIndex(result);
    var rows = [];

    SYSTEM_ARCHITECTURE_MAPPINGS.forEach(function (mapping) {
      var triggeredBy = mapping.trigger_question_ids.filter(function (qid) {
        var q = idx[qid];
        return q && Number(q.normalized_score) < mapping.trigger_maturity_threshold_lt;
      });

      if (!triggeredBy.length) return;

      rows.push({
        mapping_id: mapping.id,
        trigger_process: mapping.trigger_process,
        trigger_question_ids: mapping.trigger_question_ids,
        triggering_maturity_threshold_lt: mapping.trigger_maturity_threshold_lt,
        triggered_by_questions: triggeredBy,
        current_state_label: mapping.current_state_label,
        recommended_state_label: mapping.recommended_state_label,
        reason: mapping.reason
      });
    });

    if (!rows.length) {
      rows.push({
        mapping_id: 'fallback-weak-link',
        trigger_process: 'General operating consistency',
        trigger_question_ids: [],
        triggering_maturity_threshold_lt: null,
        triggered_by_questions: [],
        current_state_label: 'Core operating workflow present with isolated weak links',
        recommended_state_label: 'Strengthen weak links with repeatable standards before adding volume',
        reason: 'No single deterministic mapping dominated, so general systemization guidance applies.'
      });
    }

    return {
      rows: rows,
      current_state: rows.map(function (r) { return r.current_state_label; }),
      future_state: rows.map(function (r) { return r.recommended_state_label; })
    };
  }

  function buildAiOpportunityMap(result) {
    var idx = questionScoreIndex(result);
    var flags = result.data_quality_flags || [];
    var conf = result.diagnostic_confidence || {};

    var hasInvalid = flags.some(function (f) { return String(f.severity).toUpperCase() === 'INVALID'; });
    var hasClarification = flags.some(function (f) { return String(f.severity).toUpperCase() === 'REQUIRES_CLARIFICATION'; });
    var evidenceCoveragePct = Number(conf.evidence_coverage_pct || 0);

    var ctx = {
      q: function (id) { return idx[id] || null; },
      hasInvalid: hasInvalid,
      hasClarification: hasClarification,
      evidenceCoveragePct: evidenceCoveragePct
    };

    var items = AI_OPPORTUNITY_MAPPINGS
      .filter(function (mapping) { return mapping.evaluate(ctx); })
      .map(function (mapping) {
        return {
          process: mapping.process,
          trigger: mapping.trigger,
          category: mapping.classification,
          rationale: mapping.rationale,
          safeguards: mapping.safeguards
        };
      });

    if (items.length > 8) items = items.slice(0, 8);

    return {
      principle: 'Automation should remove friction, not judgment.',
      items: items
    };
  }

  function buildConfidenceSection(result) {
    var conf = result.diagnostic_confidence || {};
    var counts = conf.evidence_counts || {};
    var summary = Object.keys(counts)
      .filter(function (k) { return counts[k] > 0; })
      .map(function (k) { return titleCase(k) + ': ' + counts[k]; });

    return {
      diagnostic_confidence_pct: Math.round(Number(conf.confidence_score || 0)),
      evidence_coverage_pct: Number(conf.evidence_coverage_pct || 0),
      evidence_summary: summary.length ? summary : ['No evidence counts available'],
      decision_confidence: titleCase((result.scaling_decision && result.scaling_decision.decision_confidence_status) || 'PROVISIONAL'),
      explanation: 'FlowScale measures operational maturity. Diagnostic Confidence measures how strong the evidence is. They are intentionally separate.'
    };
  }

  function buildFlagSection(result) {
    return (result.data_quality_flags || []).map(function (f) {
      return {
        code: f.code,
        severity: normalizeSeverity(f.severity),
        message: FLAG_COPY[f.code] || f.message || 'This metric requires review before decision-making reliance.'
      };
    });
  }

  function buildExecutive(result) {
    var primary = result.primary_constraint;
    var secondary = result.secondary_constraint;
    var strongest = result.strongest_engine
      ? result.strongest_engine.name
      : (result.strongest_engines && result.strongest_engines[0] ? result.strongest_engines[0].name : 'Unknown');

    return {
      title: 'FLOWCORE BUSINESS DIAGNOSTIC',
      score: result.overall_score,
      stage: result.maturity_stage,
      scaling_decision: result.scaling_decision.decision,
      decision_status: titleCase(result.scaling_decision.decision_confidence_status),
      primary_constraint: constraintLabel(primary),
      secondary_constraint: constraintLabel(secondary),
      strongest_engine: strongest,
      diagnostic_confidence_pct: Math.round(Number(result.diagnostic_confidence.confidence_score || 0)),
      interpretation: result.scaling_decision.note,
      disclaimer: 'Based on the information provided. This diagnostic has not been independently verified.'
    };
  }

  function buildExpansionSummary(result) {
    var exp = result.expansion_ready || {};
    var candidate = !!exp.expansion_ready_candidate;
    var eligible = !!exp.expansion_ready_eligible;
    return {
      is_candidate: candidate,
      eligible: eligible,
      headline: candidate ? 'Expansion Ready Candidate' : 'Not Expansion Ready Candidate',
      status: eligible ? 'Expansion Ready' : 'Not Yet',
      failed_guardrails: exp.failed_guardrails || []
    };
  }

  function buildReportModel(resultEnvelope) {
    if (!resultEnvelope || typeof resultEnvelope !== 'object') {
      return { ok: false, reason: 'missing_result' };
    }

    var result = resultEnvelope.scoring_output || resultEnvelope;
    if (!result || !result.engine_scores || result.overall_score === undefined || !result.scaling_decision) {
      return { ok: false, reason: 'invalid_result' };
    }

    var constraints = result.constraint_candidates || [];
    var nextPriority = nextPriorityConstraint(constraints);
    var architecture = buildArchitecture(result);
    var nextStep = buildRecommendedNextStep(result);

    return {
      ok: true,
      metadata: {
        scoring_version: result.scoring_version || resultEnvelope.scoring_version || (FlowcoreScoring && FlowcoreScoring.FLOWSCALE_SCORING_VERSION) || 'unknown',
        completion_timestamp: resultEnvelope.completion_timestamp || null,
        next_priority_constraint_min_score: NEXT_PRIORITY_CONSTRAINT_MIN_SCORE
      },
      executive: buildExecutive(result),
      scorecard: scorecardRows(result),
      leakage: buildLeakage(resultEnvelope),
      constraints: {
        primary: result.primary_constraint,
        secondary: result.secondary_constraint,
        next_priority_constraint: nextPriority,
        primary_explanation: constraintExplanation(result.primary_constraint),
        secondary_explanation: constraintExplanation(result.secondary_constraint),
        ranking_limitation_note: 'Deterministic ranking indicates priority, not proven causal downstream dependency.'
      },
      chain: [result.primary_constraint, result.secondary_constraint, nextPriority].filter(Boolean),
      architecture: architecture,
      ai_opportunities: buildAiOpportunityMap(result),
      flowplan: buildFlowPlan(result),
      next_step: nextStep,
      confidence: buildConfidenceSection(result),
      data_quality: buildFlagSection(result),
      expansion: buildExpansionSummary(result)
    };
  }

  return {
    RESULT_STORAGE_KEY: RESULT_STORAGE_KEY,
    DIAGNOSTIC_STORAGE_KEY: DIAGNOSTIC_STORAGE_KEY,
    NEXT_PRIORITY_CONSTRAINT_MIN_SCORE: NEXT_PRIORITY_CONSTRAINT_MIN_SCORE,
    ACTION_LIBRARY: ACTION_LIBRARY,
    ENGINE_STATUS_BANDS: ENGINE_STATUS_BANDS,
    SYSTEM_ARCHITECTURE_MAPPINGS: SYSTEM_ARCHITECTURE_MAPPINGS,
    AI_OPPORTUNITY_MAPPINGS: AI_OPPORTUNITY_MAPPINGS,
    NEXT_STEP_PRECEDENCE: NEXT_STEP_PRECEDENCE,
    buildReportModel: buildReportModel
  };
});
