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

  function nextLikelyConstraint(candidates) {
    var list = Array.isArray(candidates) ? candidates : [];
    var third = list[2];
    if (!third) return null;
    return third.priority_score >= 180 ? third : null;
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

  function buildRecommendedNextStep(result) {
    var decision = result.scaling_decision || {};
    var primary = result.primary_constraint;
    var flags = result.data_quality_flags || [];
    var hasInvalid = flags.some(function (f) { return String(f.severity).toUpperCase() === 'INVALID'; });
    var hasClarification = flags.some(function (f) { return String(f.severity).toUpperCase() === 'REQUIRES_CLARIFICATION'; });

    if (hasInvalid) return { category: 'VALIDATE DATA', detail: 'Resolve invalid diagnostic inputs before relying on scaling conclusions.' };
    if (decision.decision === 'HOLD' && primary) return { category: 'REPAIR FIRST', detail: 'Repair ' + primary.label + ' before materially increasing volume.' };
    if (decision.decision === 'SCALE' && result.expansion_ready && result.expansion_ready.expansion_ready_eligible) return { category: 'EXPANSION PLANNING', detail: 'Prepare controlled expansion sequencing with KPI and capacity guardrails.' };
    if (decision.decision === 'SCALE') return { category: 'PREPARE TO SCALE', detail: 'Systemize remaining weak areas before larger volume increases.' };
    if (hasClarification) return { category: 'VALIDATE DATA', detail: 'Clarify funnel definitions before finalizing acceleration decisions.' };
    return { category: 'SYSTEMIZE', detail: 'Systemize core workflows and verify stability before scale changes.' };
  }

  function buildArchitecture(result) {
    var top = (result.constraint_candidates || []).slice(0, 3);
    var weakQ = top.map(function (c) { return c.question_id; });

    var current = [];
    var future = [];

    function addPair(currentText, futureText) {
      if (current.indexOf(currentText) === -1) current.push(currentText);
      if (future.indexOf(futureText) === -1) future.push(futureText);
    }

    if (weakQ.indexOf('C1') >= 0 || weakQ.indexOf('C2') >= 0 || weakQ.indexOf('C4') >= 0) {
      addPair('Lead captured -> inconsistent response -> manual follow-up', 'Lead captured -> reliable rapid response -> structured follow-up -> qualification -> booking -> reminders');
    }
    if (weakQ.indexOf('D2') >= 0 || weakQ.indexOf('D1') >= 0) {
      addPair('Sale closed -> inconsistent onboarding/fulfillment', 'Sale closed -> standardized onboarding -> documented fulfillment checkpoints -> quality control');
    }
    if (weakQ.indexOf('I4') >= 0 || weakQ.indexOf('I2') >= 0 || weakQ.indexOf('I1') >= 0) {
      addPair('Owner-driven operations with fragmented process memory', 'Centralized data -> documented processes -> delegated ownership -> escalation rules');
    }
    if (weakQ.indexOf('E2') >= 0 || weakQ.indexOf('E3') >= 0) {
      addPair('Growth decisions with incomplete financial/KPI visibility', 'Capacity and growth decisions guided by recurring financial/KPI reporting');
    }

    if (!current.length) {
      addPair('Core operating workflow present with isolated weak links', 'Strengthen weak links with repeatable standards before adding volume');
    }

    return {
      current_state: current,
      future_state: future
    };
  }

  function buildAiOpportunityMap(result) {
    var qScores = result.question_scores || [];
    var flags = result.data_quality_flags || [];
    function q(id) {
      return qScores.find(function (item) { return item.question_id === id; }) || null;
    }

    var items = [];
    var c1 = q('C1');
    if (c1 && c1.normalized_score < 75) {
      items.push({ process: 'Lead response acknowledgment', category: c1.normalized_score <= 25 ? 'AUTOMATE' : 'AI ASSIST', note: 'Improve first-response consistency while preserving escalation paths.' });
    }

    var c4 = q('C4');
    if (c4 && c4.normalized_score < 88) {
      items.push({ process: 'Appointment reminders', category: 'AUTOMATE', note: 'Use deterministic reminders to reduce no-shows.' });
    }

    var d4 = q('D4');
    if (d4 && d4.normalized_score < 88) {
      items.push({ process: 'Review/renewal requests', category: 'AUTOMATE', note: 'Automate consistent post-delivery prompts.' });
    }

    var i1 = q('I1');
    var e3 = q('E3');
    if ((i1 && i1.normalized_score < 75) || (e3 && e3.normalized_score < 75)) {
      items.push({ process: 'Pipeline summaries', category: 'AI ASSIST', note: 'Summarize KPI/pipeline state for faster operator review.' });
    }
    if ((i1 && i1.normalized_score <= 50) || (e3 && e3.normalized_score <= 50)) {
      items.push({ process: 'KPI data normalization', category: 'AI EXECUTE + HUMAN OVERSIGHT', note: 'Automate repetitive metric rollups with human review gates.' });
    }
    if (flags.some(function (f) { return String(f.severity).toUpperCase() === 'REQUIRES_CLARIFICATION'; })) {
      items.push({ process: 'Conflicting funnel definitions', category: 'ELIMINATE / REDESIGN', note: 'Redesign stage definitions before automating downstream decision logic.' });
    }

    items.push({ process: 'Complex sales negotiation', category: 'KEEP HUMAN', note: 'Retain human judgment for nuanced commercial decisions.' });
    items.push({ process: 'Complaint escalation', category: 'KEEP HUMAN', note: 'Keep escalation and recovery decisions under human ownership.' });

    if (items.length > 6) items = items.slice(0, 6);

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
    var flags = (result.data_quality_flags || []).map(function (f) {
      return {
        code: f.code,
        severity: normalizeSeverity(f.severity),
        message: FLAG_COPY[f.code] || f.message || 'This metric requires review before decision-making reliance.'
      };
    });
    return flags;
  }

  function buildExecutive(result) {
    var primary = result.primary_constraint;
    var secondary = result.secondary_constraint;
    var strongest = result.strongest_engine ? result.strongest_engine.name : (result.strongest_engines && result.strongest_engines[0] ? result.strongest_engines[0].name : 'Unknown');

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

    return {
      ok: true,
      metadata: {
        scoring_version: result.scoring_version || resultEnvelope.scoring_version || (FlowcoreScoring && FlowcoreScoring.FLOWSCALE_SCORING_VERSION) || 'unknown',
        completion_timestamp: resultEnvelope.completion_timestamp || null
      },
      executive: buildExecutive(result),
      scorecard: scorecardRows(result),
      leakage: buildLeakage(resultEnvelope),
      constraints: {
        primary: result.primary_constraint,
        secondary: result.secondary_constraint,
        likely_next: nextLikelyConstraint(constraints),
        primary_explanation: constraintExplanation(result.primary_constraint),
        secondary_explanation: constraintExplanation(result.secondary_constraint)
      },
      chain: [result.primary_constraint, result.secondary_constraint, nextLikelyConstraint(constraints)].filter(Boolean),
      architecture: buildArchitecture(result),
      ai_opportunities: buildAiOpportunityMap(result),
      flowplan: buildFlowPlan(result),
      next_step: buildRecommendedNextStep(result),
      confidence: buildConfidenceSection(result),
      data_quality: buildFlagSection(result),
      expansion: buildExpansionSummary(result)
    };
  }

  return {
    RESULT_STORAGE_KEY: RESULT_STORAGE_KEY,
    DIAGNOSTIC_STORAGE_KEY: DIAGNOSTIC_STORAGE_KEY,
    ACTION_LIBRARY: ACTION_LIBRARY,
    ENGINE_STATUS_BANDS: ENGINE_STATUS_BANDS,
    buildReportModel: buildReportModel
  };
});
