(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FlowcoreScoring = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FLOWSCALE_SCORING_VERSION = '1.0.0-dev';

  var ENGINE_CONFIG = [
    {
      id: 'market',
      name: 'Market',
      weight: 10,
      questions: [
        { id: 'M1', text: 'How clearly can you define the customer most likely to purchase from you?', revenue_impact: 4, dependency: 4, urgency: 3 },
        { id: 'M2', text: 'How well do you understand the primary problem or desired outcome that causes customers to buy?', revenue_impact: 4, dependency: 4, urgency: 3 },
        { id: 'M3', text: 'Can customers quickly understand why they should choose you instead of an alternative?', revenue_impact: 4, dependency: 3, urgency: 3 },
        { id: 'M4', text: 'Do you have evidence that your target market consistently wants and purchases what you sell?', revenue_impact: 5, dependency: 5, urgency: 5 }
      ],
      supplemental: []
    },
    {
      id: 'value',
      name: 'Value',
      weight: 15,
      questions: [
        { id: 'V1', text: 'Is there a clearly defined offer with a specific outcome, scope and price?', revenue_impact: 5, dependency: 5, urgency: 4 },
        { id: 'V2', text: 'Is your pricing based on economics and value rather than guessing or competitor copying?', revenue_impact: 4, dependency: 4, urgency: 4 },
        { id: 'V3', text: 'Do you know approximately how much gross profit is produced when you make a sale?', revenue_impact: 5, dependency: 5, urgency: 5 },
        { id: 'V4', text: 'Do you track which products/services/offers convert and retain customers best?', revenue_impact: 3, dependency: 3, urgency: 2 }
      ],
      supplemental: [
        { id: 'avg_sale', label: 'Average sale', type: 'text', allowDontKnow: true },
        { id: 'avg_gross_margin_pct', label: 'Average gross margin %', type: 'number', allowDontKnow: true },
        { id: 'avg_customer_value', label: 'Average customer value', type: 'text', allowDontKnow: true }
      ]
    },
    {
      id: 'acquisition',
      name: 'Acquisition',
      weight: 15,
      questions: [
        { id: 'A1', text: 'Can you identify exactly where new leads/customers are coming from?', revenue_impact: 3, dependency: 3, urgency: 2 },
        { id: 'A2', text: 'Does the business generate qualified opportunities consistently?', revenue_impact: 5, dependency: 5, urgency: 4 },
        { id: 'A3', text: 'Can prospects easily submit their information from your website, landing pages, ads and other channels?', revenue_impact: 4, dependency: 4, urgency: 4 },
        { id: 'A4', text: 'Can you connect a customer or sale back to the marketing source that created it?', revenue_impact: 3, dependency: 3, urgency: 2 }
      ],
      supplemental: [
        { id: 'leads_30_days', label: 'Leads last 30 days', type: 'number' },
        { id: 'primary_source', label: 'Primary source', type: 'select', options: ['Google', 'Meta', 'Referral', 'Organic', 'Outbound', 'Walk-in', 'Marketplace', 'Other'] }
      ]
    },
    {
      id: 'conversion',
      name: 'Conversion',
      weight: 20,
      questions: [
        {
          id: 'C1',
          text: 'How quickly does someone respond when a new prospect contacts the business?',
          revenue_impact: 5,
          dependency: 5,
          urgency: 5,
          scale_labels: [
            'Usually more than 24 hours, inconsistent, or we do not know.',
            'Usually between 4 and 24 hours.',
            'Usually between 1 and 4 hours.',
            'Usually within approximately 5–60 minutes.',
            'Usually within 5 minutes or immediately through an appropriate response system.'
          ]
        },
        { id: 'C2', text: 'Does every unconverted lead automatically receive structured follow-up?', revenue_impact: 5, dependency: 5, urgency: 5 },
        { id: 'C3', text: 'Does the business have a repeatable process for qualifying and converting opportunities?', revenue_impact: 5, dependency: 4, urgency: 4 },
        { id: 'C4', text: 'Can qualified prospects conveniently book the appropriate next step, and does the business actively reduce no-shows?', revenue_impact: 4, dependency: 4, urgency: 4 }
      ],
      supplemental: [
        { id: 'leads_count', label: 'Leads', type: 'number' },
        { id: 'appointments_count', label: 'Appointments', type: 'number' },
        { id: 'qualified_opportunities_count', label: 'Qualified opportunities', type: 'number' },
        { id: 'sales_customers_count', label: 'Sales / customers', type: 'number' }
      ]
    },
    {
      id: 'delivery',
      name: 'Delivery',
      weight: 15,
      questions: [
        { id: 'D1', text: 'Does every new customer receive a consistent onboarding experience?', revenue_impact: 4, dependency: 4, urgency: 3 },
        { id: 'D2', text: 'Is there a documented and repeatable process for delivering what was sold?', revenue_impact: 5, dependency: 5, urgency: 5 },
        { id: 'D3', text: 'Does the business proactively monitor customer satisfaction, problems and service quality?', revenue_impact: 4, dependency: 4, urgency: 4 },
        { id: 'D4', text: 'Is there a structured process for repeat purchases, renewals, reviews, referrals or reactivation?', revenue_impact: 4, dependency: 3, urgency: 3 }
      ],
      supplemental: [
        { id: 'refund_rate', label: 'Refund rate', type: 'text' },
        { id: 'cancellation_rate', label: 'Cancellation rate', type: 'text' },
        { id: 'repeat_purchase_rate', label: 'Repeat purchase rate', type: 'text' },
        { id: 'avg_fulfillment_time', label: 'Average fulfillment time', type: 'text' }
      ]
    },
    {
      id: 'independence',
      name: 'Independence',
      weight: 15,
      questions: [
        { id: 'I1', text: 'Does one reliable system contain customer information, communications, pipeline status and important activity?', revenue_impact: 4, dependency: 4, urgency: 3 },
        { id: 'I2', text: 'Are recurring business processes documented well enough that another competent person could perform them?', revenue_impact: 4, dependency: 4, urgency: 3 },
        { id: 'I3', text: 'Are repetitive administrative activities automated where appropriate?', revenue_impact: 3, dependency: 3, urgency: 2 },
        {
          id: 'I4',
          text: 'If the owner stopped working for seven days, how much of the company would stop functioning?',
          reverse_scored: true,
          revenue_impact: 4,
          dependency: 5,
          urgency: 4,
          scale_labels: [
            'Almost nothing would stop; the team/systems could operate effectively.',
            'A few noncritical activities would slow down.',
            'Several important activities would be affected.',
            'Most major activities would slow or stop.',
            'Almost everything depends directly on the owner.'
          ]
        }
      ],
      supplemental: []
    },
    {
      id: 'expansion',
      name: 'Expansion',
      weight: 10,
      questions: [
        {
          id: 'E1',
          text: 'Could the business handle 50% more customers next month without serious service deterioration?',
          revenue_impact: 5,
          dependency: 5,
          urgency: 5,
          scale_labels: [
            'Definitely not / operations would likely break.',
            'Probably not without major disruption.',
            'Possibly, but service quality or workload would be strained.',
            'Yes, with manageable adjustments.',
            'Yes, existing capacity and systems provide meaningful headroom.'
          ]
        },
        {
          id: 'E2',
          text: 'Does management understand revenue, margins, cash requirements and major operating costs?',
          revenue_impact: 5,
          dependency: 5,
          urgency: 5,
          scale_labels: [
            'We do not reliably know revenue, margins, cash requirements, or major costs.',
            'We know some numbers informally but do not review them consistently.',
            'Basic financial information exists but is incomplete or delayed.',
            'Leadership reviews reliable financial information regularly.',
            'Financial performance is current, measured, forecasted, and actively used in decisions.'
          ]
        },
        { id: 'E3', text: 'Can leadership see the important KPIs necessary to make growth decisions?', revenue_impact: 4, dependency: 4, urgency: 3 },
        { id: 'E4', text: 'Can the business increase marketing, staff, customers or locations without creating an operational bottleneck elsewhere?', revenue_impact: 5, dependency: 5, urgency: 5 }
      ],
      supplemental: []
    }
  ];

  var DEFAULT_SCALE_LABELS = [
    "Doesn't exist / don't know",
    'Exists informally; mostly reactive or manual',
    'Partially implemented; inconsistent',
    'Repeatable, documented or measured',
    'Predictable, measured, optimized and scalable'
  ];

  var EVIDENCE_SCORES = {
    estimated: 25,
    self_reported: 50,
    system_derived: 80,
    verified: 100
  };

  var DATA_QUALITY_SEVERITY = {
    INFO: 'INFO',
    WARNING: 'WARNING',
    REQUIRES_CLARIFICATION: 'REQUIRES_CLARIFICATION',
    INVALID: 'INVALID'
  };

  var STAGE_BANDS = [
    { min: 0, max: 29, name: 'Unstructured' },
    { min: 30, max: 44, name: 'Foundation' },
    { min: 45, max: 59, name: 'Repeatable' },
    { min: 60, max: 74, name: 'Managed Growth' },
    { min: 75, max: 87, name: 'Scalable' },
    { min: 88, max: 100, name: 'Expansion Ready Candidate' }
  ];

  var CONSTRAINT_CONFIG = {
    candidate_threshold_score: 75,
    critical_priority_threshold: 400
  };

  var SCALE_HOLD_CONFIG = {
    scale_min_overall: 75,
    scale_min_conversion: 60,
    scale_min_delivery: 70,
    scale_min_independence: 65,
    scale_min_expansion: 70
  };

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function questionList() {
    return ENGINE_CONFIG.reduce(function (acc, engine) {
      engine.questions.forEach(function (q) {
        acc.push({
          engine: engine.id,
          engine_name: engine.name,
          engine_weight: engine.weight,
          question_id: q.id,
          question_text: q.text,
          reverse_scored: !!q.reverse_scored,
          revenue_impact: q.revenue_impact,
          dependency: q.dependency,
          urgency: q.urgency,
          scale_labels: q.scale_labels || DEFAULT_SCALE_LABELS
        });
      });
      return acc;
    }, []);
  }

  var QUESTION_LIST = questionList();
  var QUESTION_INDEX = QUESTION_LIST.reduce(function (acc, q) {
    acc[q.question_id] = q;
    return acc;
  }, {});

  function normalizeQuestionScore(scoredResponse) {
    var v = clamp(Number(scoredResponse), 0, 4);
    return round2((v / 4) * 100);
  }

  function applyQuestionScoring(questionId, rawResponse) {
    var q = QUESTION_INDEX[questionId];
    if (!q) throw new Error('Unknown question id: ' + questionId);
    var raw = clamp(Number(rawResponse), 0, 4);
    var scored = q.reverse_scored ? 4 - raw : raw;
    return {
      raw_response: raw,
      scored_response: scored,
      normalized_score: normalizeQuestionScore(scored),
      reverse_scored: !!q.reverse_scored
    };
  }

  function parseNumeric(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    var cleaned = String(value).replace(/[$,%\s,]/g, '');
    if (!cleaned) return null;
    var n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  function safeRate(numerator, denominator) {
    if (numerator === null || denominator === null) return null;
    if (denominator <= 0) return null;
    return round2((numerator / denominator) * 100);
  }

  function validateSupplementalInputs(supplemental) {
    var flags = [];
    var conv = (supplemental && supplemental.conversion) || {};
    var val = (supplemental && supplemental.value) || {};

    function pushFlag(code, severity, engine, field, message) {
      flags.push({ code: code, severity: severity, engine: engine, field: field, message: message });
    }

    var avgSale = parseNumeric(val.avg_sale);
    var margin = parseNumeric(val.avg_gross_margin_pct);
    var avgCustomerValue = parseNumeric(val.avg_customer_value);

    if (avgSale !== null && avgSale < 0) pushFlag('NEGATIVE_AVERAGE_SALE', DATA_QUALITY_SEVERITY.INVALID, 'value', 'avg_sale', 'Average sale cannot be negative.');
    if (margin !== null && (margin < 0 || margin > 100)) pushFlag('GROSS_MARGIN_OUT_OF_RANGE', DATA_QUALITY_SEVERITY.INVALID, 'value', 'avg_gross_margin_pct', 'Gross margin should be between 0 and 100 unless a future special-use case is confirmed.');
    if (avgCustomerValue !== null && avgCustomerValue < 0) pushFlag('NEGATIVE_AVERAGE_CUSTOMER_VALUE', DATA_QUALITY_SEVERITY.INVALID, 'value', 'avg_customer_value', 'Average customer value cannot be negative.');

    var leads = parseNumeric(conv.leads_count);
    var appointments = parseNumeric(conv.appointments_count);
    var qualified = parseNumeric(conv.qualified_opportunities_count);
    var sales = parseNumeric(conv.sales_customers_count);

    [['leads_count', leads], ['appointments_count', appointments], ['qualified_opportunities_count', qualified], ['sales_customers_count', sales]].forEach(function (pair) {
      if (pair[1] !== null && pair[1] < 0) {
        pushFlag('NEGATIVE_VALUE', DATA_QUALITY_SEVERITY.INVALID, 'conversion', pair[0], pair[0] + ' cannot be negative.');
      }
    });

    if (leads !== null && appointments !== null && appointments > leads) {
      pushFlag('APPOINTMENTS_EXCEED_LEADS', DATA_QUALITY_SEVERITY.REQUIRES_CLARIFICATION, 'conversion', 'appointments_count', 'Appointments exceed leads in the current definition and require clarification.');
    }
    if (qualified !== null && sales !== null && sales > qualified) {
      pushFlag('SALES_EXCEED_QUALIFIED', DATA_QUALITY_SEVERITY.REQUIRES_CLARIFICATION, 'conversion', 'sales_customers_count', 'Sales exceed qualified opportunities in the current definition and require clarification.');
    }
    if (leads !== null && sales !== null && sales > leads) {
      pushFlag('SALES_EXCEED_LEADS', DATA_QUALITY_SEVERITY.REQUIRES_CLARIFICATION, 'conversion', 'sales_customers_count', 'Customers exceed leads in the current definition and require clarification.');
    }

    var derived = {
      booking_rate: safeRate(appointments, leads),
      close_rate: safeRate(sales, qualified),
      lead_to_customer_rate: safeRate(sales, leads)
    };

    if (leads === null || leads <= 0) {
      pushFlag('BOOKING_RATE_UNAVAILABLE', DATA_QUALITY_SEVERITY.INFO, 'conversion', 'leads_count', 'Booking rate unavailable because Leads is missing or zero.');
      pushFlag('LEAD_TO_CUSTOMER_RATE_UNAVAILABLE', DATA_QUALITY_SEVERITY.INFO, 'conversion', 'leads_count', 'Lead-to-customer rate unavailable because Leads is missing or zero.');
    }
    if (qualified === null || qualified <= 0) {
      pushFlag('CLOSE_RATE_UNAVAILABLE', DATA_QUALITY_SEVERITY.INFO, 'conversion', 'qualified_opportunities_count', 'Close rate unavailable because Qualified Opportunities is missing or zero.');
    }

    if (flags.some(function (f) { return f.code === 'APPOINTMENTS_EXCEED_LEADS'; })) {
      derived.booking_rate = null;
      pushFlag('BOOKING_RATE_REQUIRES_CLARIFICATION', DATA_QUALITY_SEVERITY.REQUIRES_CLARIFICATION, 'conversion', 'appointments_count', 'Booking rate withheld until lead/appointment definition is clarified.');
    }
    if (flags.some(function (f) { return f.code === 'SALES_EXCEED_QUALIFIED'; })) {
      derived.close_rate = null;
      pushFlag('CLOSE_RATE_REQUIRES_CLARIFICATION', DATA_QUALITY_SEVERITY.REQUIRES_CLARIFICATION, 'conversion', 'sales_customers_count', 'Close rate withheld until qualified/sales definition is clarified.');
    }
    if (flags.some(function (f) { return f.code === 'SALES_EXCEED_LEADS'; })) {
      derived.lead_to_customer_rate = null;
      pushFlag('LEAD_TO_CUSTOMER_REQUIRES_CLARIFICATION', DATA_QUALITY_SEVERITY.REQUIRES_CLARIFICATION, 'conversion', 'sales_customers_count', 'Lead-to-customer rate withheld until lead/sales definition is clarified.');
    }

    return { data_quality_flags: flags, derived_conversion_metrics: derived };
  }

  function calculateEngineScore(questionScores, engineId) {
    var scored = questionScores.filter(function (r) { return r.engine === engineId && r.normalized_score !== null; });
    if (!scored.length) return null;
    var total = scored.reduce(function (sum, r) { return sum + r.normalized_score; }, 0);
    return round2(total / scored.length);
  }

  function calculateEngineScores(questionScores) {
    var scores = {};
    ENGINE_CONFIG.forEach(function (e) {
      scores[e.id] = calculateEngineScore(questionScores, e.id);
    });
    return scores;
  }

  function calculateOverallScore(engineScores) {
    var totalWeight = ENGINE_CONFIG.reduce(function (sum, e) { return sum + e.weight; }, 0);
    if (totalWeight !== 100) throw new Error('Engine weights must total 100. Current total: ' + totalWeight);

    for (var i = 0; i < ENGINE_CONFIG.length; i++) {
      var eid = ENGINE_CONFIG[i].id;
      if (engineScores[eid] === null || engineScores[eid] === undefined) return null;
    }

    var overall = 0;
    ENGINE_CONFIG.forEach(function (e) {
      overall += (engineScores[e.id] * e.weight) / 100;
    });
    return round2(overall);
  }

  function determineMaturityStage(overallScore) {
    if (overallScore === null || overallScore === undefined) return { stage: 'Insufficient Data', band: null };
    var rounded = Math.round(overallScore);
    for (var i = 0; i < STAGE_BANDS.length; i++) {
      var b = STAGE_BANDS[i];
      if (rounded >= b.min && rounded <= b.max) return { stage: b.name, band: b };
    }
    return { stage: 'Insufficient Data', band: null };
  }

  function determineExpansionReadiness(overallScore, engineScores) {
    var guardrails = [];
    var isCandidate = overallScore !== null && overallScore >= 88;
    if (!isCandidate) {
      return {
        expansion_ready_candidate: false,
        expansion_ready_eligible: false,
        failed_guardrails: ['OVERALL_BELOW_88']
      };
    }

    var below70 = Object.keys(engineScores).filter(function (k) {
      return engineScores[k] !== null && engineScores[k] < 70;
    });

    if (below70.length) guardrails.push('ENGINE_BELOW_70:' + below70.join(','));
    if (engineScores.delivery < 75) guardrails.push('DELIVERY_BELOW_75');
    if (engineScores.independence < 75) guardrails.push('INDEPENDENCE_BELOW_75');

    return {
      expansion_ready_candidate: true,
      expansion_ready_eligible: guardrails.length === 0,
      failed_guardrails: guardrails
    };
  }

  function deriveGapSeverity(normalizedScore) {
    if (normalizedScore <= 0) return 5;
    if (normalizedScore <= 25) return 4;
    if (normalizedScore <= 50) return 3;
    if (normalizedScore < 75) return 2;
    return 1;
  }

  function reasonCode(candidate) {
    if (candidate.priority_score >= CONSTRAINT_CONFIG.critical_priority_threshold) return 'CRITICAL_REPAIR_PRIORITY';
    if (candidate.normalized_score <= 25 && candidate.revenue_impact >= 4) return 'LOW_MATURITY_HIGH_REVENUE_IMPACT';
    if (candidate.dependency >= 4 && candidate.urgency >= 4) return 'HIGH_DEPENDENCY_HIGH_URGENCY_GAP';
    if (candidate.gap_severity >= 4) return 'SEVERE_MATURITY_GAP';
    return 'MATURITY_GAP_PRIORITY';
  }

  function rankConstraintCandidates(questionScores) {
    var candidates = questionScores
      .filter(function (q) { return q.normalized_score < CONSTRAINT_CONFIG.candidate_threshold_score; })
      .map(function (q) {
        var severity = deriveGapSeverity(q.normalized_score);
        var priority = severity * q.revenue_impact * q.dependency * q.urgency;
        var candidate = {
          engine: q.engine,
          question_id: q.question_id,
          label: q.question_text,
          normalized_score: q.normalized_score,
          gap_severity: severity,
          revenue_impact: q.revenue_impact,
          dependency: q.dependency,
          urgency: q.urgency,
          priority_score: priority,
          critical_priority: priority >= CONSTRAINT_CONFIG.critical_priority_threshold,
          reason_code: ''
        };
        candidate.reason_code = reasonCode(candidate);
        return candidate;
      })
      .sort(function (a, b) {
        if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
        if (a.normalized_score !== b.normalized_score) return a.normalized_score - b.normalized_score;
        return a.question_id.localeCompare(b.question_id);
      });

    return {
      candidates: candidates,
      primary_constraint: candidates[0] || null,
      secondary_constraint: candidates[1] || null
    };
  }

  function strongestAndWeakestEngines(engineScores) {
    var list = ENGINE_CONFIG.map(function (e) {
      return { id: e.id, name: e.name, score: engineScores[e.id] };
    }).filter(function (e) { return e.score !== null && e.score !== undefined; });

    if (!list.length) return { strongest_engine: null, weakest_engine: null, strongest_engines: [], weakest_engines: [] };

    var max = Math.max.apply(null, list.map(function (e) { return e.score; }));
    var min = Math.min.apply(null, list.map(function (e) { return e.score; }));

    var strongest = list.filter(function (e) { return e.score === max; });
    var weakest = list.filter(function (e) { return e.score === min; });

    return {
      strongest_engine: strongest.length === 1 ? strongest[0] : null,
      weakest_engine: weakest.length === 1 ? weakest[0] : null,
      strongest_engines: strongest,
      weakest_engines: weakest
    };
  }

  function normalizeEvidenceType(response) {
    var raw = response && response.evidence_type ? String(response.evidence_type).toLowerCase() : 'self_reported';
    raw = raw.replace(/\s+/g, '_').replace(/-/g, '_');

    if (response && response.unknown === true) return 'estimated';
    if (raw === "don't_know" || raw === 'dont_know' || raw === 'unknown' || raw === 'not_sure' || raw === 'estimated_or_unknown') {
      return 'estimated';
    }
    if (!EVIDENCE_SCORES.hasOwnProperty(raw)) return 'self_reported';
    return raw;
  }

  function evidenceScoreForResponse(response) {
    return EVIDENCE_SCORES[normalizeEvidenceType(response)];
  }

  function calculateDiagnosticConfidence(questionScores, expectedCoreCount) {
    var usable = questionScores.filter(function (q) { return q.normalized_score !== null; });
    var usableCount = usable.length;

    var evidence_counts = { estimated: 0, self_reported: 0, system_derived: 0, verified: 0 };
    usable.forEach(function (q) {
      evidence_counts[normalizeEvidenceType(q)] += 1;
    });

    var qualityAvg = usableCount
      ? round2(usable.reduce(function (sum, q) { return sum + evidenceScoreForResponse(q); }, 0) / usableCount)
      : 0;

    var coverage = expectedCoreCount > 0 ? round2(usableCount / expectedCoreCount) : 0;

    return {
      evidence_quality_score: qualityAvg,
      evidence_coverage: coverage,
      evidence_coverage_pct: Math.round(coverage * 100),
      confidence_score: round2(qualityAvg * coverage),
      evidence_levels: EVIDENCE_SCORES,
      evidence_counts: evidence_counts,
      default_public_evidence_type: 'self_reported'
    };
  }

  function determineDecisionConfidenceStatus(confidence, dataQualityFlags) {
    var counts = confidence.evidence_counts || { estimated: 0, self_reported: 0, system_derived: 0, verified: 0 };
    var usable = counts.estimated + counts.self_reported + counts.system_derived + counts.verified;
    var highEvidence = usable ? (counts.system_derived + counts.verified) / usable : 0;
    var hasInvalid = (dataQualityFlags || []).some(function (f) { return f.severity === DATA_QUALITY_SEVERITY.INVALID; });

    if (hasInvalid || confidence.confidence_score < 60 || highEvidence < 0.4) return 'PROVISIONAL';
    if (confidence.confidence_score >= 90 && highEvidence >= 0.8) return 'HIGH_CONFIDENCE';
    return 'SUPPORTED';
  }

  function determineScalingDecision(input) {
    var engineScores = input.engine_scores;
    var overall = input.overall_score;
    var flags = input.data_quality_flags || [];
    var constraints = input.constraints || { candidates: [] };
    var questionScores = input.question_scores || [];
    var confidence = input.diagnostic_confidence;
    var expansionReady = input.expansion_ready || { expansion_ready_candidate: false, expansion_ready_eligible: false };

    var reasons = [];
    var invalidFlags = flags.filter(function (f) { return f.severity === DATA_QUALITY_SEVERITY.INVALID; });
    var clarifications = flags.filter(function (f) { return f.severity === DATA_QUALITY_SEVERITY.REQUIRES_CLARIFICATION; });
    var e2 = questionScores.find(function (q) { return q.question_id === 'E2'; });
    var e1 = questionScores.find(function (q) { return q.question_id === 'E1'; });
    var highestConstraint = constraints.candidates[0] || null;

    if (engineScores.delivery < 50) reasons.push('DELIVERY_BELOW_50');
    if (engineScores.independence < 50) reasons.push('INDEPENDENCE_BELOW_50');
    if (engineScores.conversion < 50) reasons.push('CONVERSION_BELOW_50');
    if (engineScores.expansion < 50) reasons.push('EXPANSION_BELOW_50');
    if (invalidFlags.length) reasons.push('INVALID_DATA_QUALITY_FLAG');
    if (e2 && e2.normalized_score <= 25) reasons.push('MAJOR_UNKNOWN_FINANCIAL_VISIBILITY');
    if (e1 && e1.normalized_score < 50) reasons.push('INSUFFICIENT_CAPACITY_FOR_NEAR_TERM_SCALE');
    if (highestConstraint && highestConstraint.priority_score >= CONSTRAINT_CONFIG.critical_priority_threshold) reasons.push('CRITICAL_CONSTRAINT_REQUIRES_REPAIR_FIRST');

    if (clarifications.length) reasons.push('DATA_DEFINITIONS_REQUIRE_CLARIFICATION');

    var blockingReasons = reasons.filter(function (r) {
      return r !== 'DATA_DEFINITIONS_REQUIRE_CLARIFICATION';
    });

    var canScale = (
      overall !== null &&
      overall >= SCALE_HOLD_CONFIG.scale_min_overall &&
      engineScores.conversion >= SCALE_HOLD_CONFIG.scale_min_conversion &&
      engineScores.delivery >= SCALE_HOLD_CONFIG.scale_min_delivery &&
      engineScores.independence >= SCALE_HOLD_CONFIG.scale_min_independence &&
      engineScores.expansion >= SCALE_HOLD_CONFIG.scale_min_expansion &&
      invalidFlags.length === 0 &&
      !(highestConstraint && highestConstraint.priority_score >= CONSTRAINT_CONFIG.critical_priority_threshold)
    );

    var decision = (canScale && blockingReasons.length === 0) ? 'SCALE' : 'HOLD';
    var note = decision === 'SCALE'
      ? 'Your current operating foundation appears capable of supporting additional volume, subject to the quality of the information provided.'
      : 'Repair the current constraint before materially increasing volume.';
    if (decision === 'HOLD' && expansionReady.expansion_ready_candidate && !expansionReady.expansion_ready_eligible) {
      note = 'Your overall maturity is high, but one or more critical operating engines do not yet meet Expansion Ready requirements.';
    }

    return {
      decision: decision,
      reasons: reasons.length ? reasons : ['FOUNDATION_MEETS_SCALE_THRESHOLDS'],
      note: note,
      decision_confidence_status: determineDecisionConfidenceStatus(confidence, flags)
    };
  }

  function normalizeResponses(inputResponses) {
    var responses = Array.isArray(inputResponses)
      ? inputResponses
      : Object.keys(inputResponses || {}).map(function (k) { return inputResponses[k]; });

    return responses
      .filter(function (r) { return r && r.question_id && QUESTION_INDEX[r.question_id]; })
      .map(function (r) {
        var q = QUESTION_INDEX[r.question_id];
        var applied;

        if (r.scored_response !== undefined && r.scored_response !== null && Number.isFinite(Number(r.scored_response))) {
          var explicitScored = clamp(Number(r.scored_response), 0, 4);
          var inferredRaw = r.raw_response != null
            ? clamp(Number(r.raw_response), 0, 4)
            : (q.reverse_scored ? 4 - explicitScored : explicitScored);
          applied = {
            raw_response: inferredRaw,
            scored_response: explicitScored,
            normalized_score: normalizeQuestionScore(explicitScored),
            reverse_scored: !!q.reverse_scored
          };
        } else {
          applied = applyQuestionScoring(r.question_id, r.raw_response != null ? r.raw_response : r.response_value);
        }

        return {
          engine: q.engine,
          question_id: r.question_id,
          question_text: q.question_text,
          raw_response: applied.raw_response,
          scored_response: applied.scored_response,
          normalized_score: applied.normalized_score,
          evidence_type: normalizeEvidenceType(r),
          confidence: r.confidence || null,
          timestamp: r.timestamp || null,
          source: r.source || null,
          unknown: !!r.unknown,
          revenue_impact: q.revenue_impact,
          dependency: q.dependency,
          urgency: q.urgency,
          reverse_scored: q.reverse_scored
        };
      });
  }

  function scoreDiagnostic(input) {
    var normalizedResponses = normalizeResponses((input && input.responses) || []);
    var supplemental = (input && input.supplemental) || {};

    var supplementalResult = validateSupplementalInputs(supplemental);
    var engineScores = calculateEngineScores(normalizedResponses);
    var overallScore = calculateOverallScore(engineScores);

    var stageResult = determineMaturityStage(overallScore);
    var readiness = determineExpansionReadiness(overallScore, engineScores);
    var extremes = strongestAndWeakestEngines(engineScores);
    var constraints = rankConstraintCandidates(normalizedResponses);
    var confidence = calculateDiagnosticConfidence(normalizedResponses, QUESTION_LIST.length);
    var scaling = determineScalingDecision({
      engine_scores: engineScores,
      overall_score: overallScore,
      data_quality_flags: supplementalResult.data_quality_flags,
      constraints: constraints,
      question_scores: normalizedResponses,
      diagnostic_confidence: confidence,
      expansion_ready: readiness
    });

    var stage = stageResult.stage;
    var stage_note = null;
    if (stage === 'Expansion Ready Candidate' && !readiness.expansion_ready_eligible) {
      stage = 'Scalable';
      stage_note = 'Your overall maturity is high, but one or more critical operating engines do not yet meet Expansion Ready requirements.';
    }

    return {
      scoring_version: FLOWSCALE_SCORING_VERSION,
      engine_scores: engineScores,
      overall_score_precise: overallScore,
      overall_score: overallScore === null ? null : Math.round(overallScore),
      maturity_stage: stage,
      stage_candidate: stageResult.stage,
      stage_note: stage_note,
      expansion_ready: readiness,
      strongest_engine: extremes.strongest_engine,
      weakest_engine: extremes.weakest_engine,
      strongest_engines: extremes.strongest_engines,
      weakest_engines: extremes.weakest_engines,
      constraint_candidates: constraints.candidates,
      primary_constraint: constraints.primary_constraint,
      secondary_constraint: constraints.secondary_constraint,
      scaling_decision: scaling,
      diagnostic_confidence: confidence,
      data_quality_flags: supplementalResult.data_quality_flags,
      derived_conversion_metrics: supplementalResult.derived_conversion_metrics,
      recommended_solution: null,
      question_scores: normalizedResponses,
      notes: {
        scale_threshold_discrete_note: 'Engine scores move in discrete 25-point increments from four maturity questions; threshold checks use direct score comparisons without changing scoring math.'
      }
    };
  }

  return {
    FLOWSCALE_SCORING_VERSION: FLOWSCALE_SCORING_VERSION,
    ENGINE_CONFIG: ENGINE_CONFIG,
    QUESTION_LIST: QUESTION_LIST,
    DEFAULT_SCALE_LABELS: DEFAULT_SCALE_LABELS,
    EVIDENCE_SCORES: EVIDENCE_SCORES,
    DATA_QUALITY_SEVERITY: DATA_QUALITY_SEVERITY,
    normalizeQuestionScore: normalizeQuestionScore,
    applyQuestionScoring: applyQuestionScoring,
    calculateEngineScore: calculateEngineScore,
    calculateEngineScores: calculateEngineScores,
    calculateOverallScore: calculateOverallScore,
    determineMaturityStage: determineMaturityStage,
    determineExpansionReadiness: determineExpansionReadiness,
    rankConstraintCandidates: rankConstraintCandidates,
    determineScalingDecision: determineScalingDecision,
    calculateDiagnosticConfidence: calculateDiagnosticConfidence,
    validateSupplementalInputs: validateSupplementalInputs,
    scoreDiagnostic: scoreDiagnostic,
    CONFIG: {
      stage_bands: STAGE_BANDS,
      constraint: CONSTRAINT_CONFIG,
      scale_hold: SCALE_HOLD_CONFIG
    }
  };
});
