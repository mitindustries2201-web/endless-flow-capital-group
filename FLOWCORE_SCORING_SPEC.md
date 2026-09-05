# FlowCore / FlowScale Deterministic Scoring Specification

## Scope
This specification defines the deterministic reference scoring model for the 28-question FlowScale diagnostic used in `audit.html`.

## Methodology Version
- `FLOWSCALE_SCORING_VERSION = "1.0.0-dev"`
- Local scoring output includes this version so historical diagnostics can be tied to the exact ruleset that produced them.

## Core Structure
- 7 engines, 4 questions each (28 total)
- Maturity responses use a 0–4 scale
- Normalized question score: `(scored_response / 4) * 100`
- Engine score: average normalized score for the engine’s 4 questions
- Overall score: weighted average of engine scores

## Engine Weights
- Market: 10%
- Value: 15%
- Acquisition: 15%
- Conversion: 20%
- Delivery: 15%
- Independence: 15%
- Expansion: 10%

## Reverse Scoring
- `I4` (Owner Dependency) is reverse-scored.
- Raw response is preserved.
- Scored response: `4 - raw_response`.

## Constraint Metadata Baseline (Revenue Impact / Dependency / Urgency)
### Market
- M1: `4 / 4 / 3`
- M2: `4 / 4 / 3`
- M3: `4 / 3 / 3`
- M4: `5 / 5 / 5`

### Value
- V1: `5 / 5 / 4`
- V2: `4 / 4 / 4`
- V3: `5 / 5 / 5`
- V4: `3 / 3 / 2`

### Acquisition
- A1: `3 / 3 / 2`
- A2: `5 / 5 / 4`
- A3: `4 / 4 / 4`
- A4: `3 / 3 / 2`

### Conversion
- C1: `5 / 5 / 5`
- C2: `5 / 5 / 5`
- C3: `5 / 4 / 4`
- C4: `4 / 4 / 4`

### Delivery
- D1: `4 / 4 / 3`
- D2: `5 / 5 / 5`
- D3: `4 / 4 / 4`
- D4: `4 / 3 / 3`

### Independence
- I1: `4 / 4 / 3`
- I2: `4 / 4 / 3`
- I3: `3 / 3 / 2`
- I4: `4 / 5 / 4`

### Expansion
- E1: `5 / 5 / 5`
- E2: `5 / 5 / 5`
- E3: `4 / 4 / 3`
- E4: `5 / 5 / 5`

## Maturity Stage Bands
- 0–29: Unstructured
- 30–44: Foundation
- 45–59: Repeatable
- 60–74: Managed Growth
- 75–87: Scalable
- 88–100: Expansion Ready Candidate

## Expansion Ready (Strict)
Expansion Ready Eligible requires all:
1. Overall `>= 88`
2. No engine `< 70`
3. Delivery `>= 75`
4. Independence `>= 75`

If overall is `>= 88` but any guardrail fails:
- Stage resolves to `Scalable`
- `expansion_ready_candidate = true`
- `expansion_ready_eligible = false`

## Constraint Priority Model
Candidate threshold:
- Question normalized score `< 75`

Gap severity:
- `0 -> 5`
- `<=25 -> 4`
- `<=50 -> 3`
- `<75 -> 2`

Priority score:
- `priority_score = gap_severity * revenue_impact * dependency * urgency`

Critical priority threshold:
- `critical_priority_threshold = 400`
- Any candidate with `priority_score >= 400` is classified as `CRITICAL_REPAIR_PRIORITY`.

## Data Quality Severity Rules
Explicit severities:
- `INFO`
- `WARNING`
- `REQUIRES_CLARIFICATION`
- `INVALID`

Current deterministic rules include:
- Negative numeric conversion values: `INVALID`
- Gross margin `<0` or `>100`: `INVALID`
- Appointments > Leads: `REQUIRES_CLARIFICATION`
- Sales > Qualified opportunities: `REQUIRES_CLARIFICATION`
- Customers/Sales > Leads: `REQUIRES_CLARIFICATION`
- Missing/zero denominators for derived rates: `INFO`

Clarification flags do not automatically force HOLD by themselves. Critical unresolved issues (for example `INVALID` data quality or critical constraints) can block SCALE.

## SCALE / HOLD Rules
SCALE baseline requires:
- Overall `>= 75`
- Conversion `>= 60`
- Delivery `>= 70`
- Independence `>= 65`
- Expansion `>= 70`
- No invalid data-quality blockers
- No critical repair-first constraint

Threshold behavior note:
- Engine outputs move in discrete increments from 4 maturity questions.
- Threshold checks use actual deterministic engine outputs (no hidden score reshaping).

## Decision Confidence Status
Scaling Decision stays binary:
- `SCALE` or `HOLD`

Additional confidence status:
- `PROVISIONAL`
- `SUPPORTED`
- `HIGH_CONFIDENCE`

For public self-reported diagnostics, outputs will normally be `PROVISIONAL` unless higher-quality evidence (system-derived/verified) materially increases confidence.

## Maturity vs Evidence Confidence (Separate Concepts)
Maturity scoring and diagnostic confidence are independent outputs.

Evidence levels (preserved):
- Estimated: 25
- Self-reported: 50
- System-derived: 80
- Verified: 100

Unknown handling:
- Explicit unknown/don’t know/not sure responses map to `estimated` evidence (25 confidence)
- Public default remains `self_reported` (50 confidence)

Unknown responses can produce:
- low maturity (operational weakness), and
- low confidence (insufficient certainty)

without treating unknown as verified absence.

## Local Diagnostic Behavior
- Browser recovery key: `ef_flowcore_diagnostic_v1`
- `Clear Saved Diagnostic` removes `ef_flowcore_diagnostic_v1`
- Unfinished diagnostic disclosure is shown to users in `audit.html`
- The workflow avoids storing identity credentials, payment credentials, passwords, SSNs, or similar sensitive secrets.

## Public Results Language
Use deterministic preview terminology:
- FlowCore Diagnostic Preview
- FlowScale Score
- Preliminary Constraint
- Scaling Decision
- Diagnostic Confidence
- “Based on the information provided.”

Avoid certification language (for example: certified, guaranteed, official score) unless future evidence supports it.

## Production Authority Statement
Current browser scoring is a reference/development implementation.

Authoritative production FlowCore scoring should execute in a controlled server-side environment to support:
- tamper resistance
- methodology integrity
- centralized version control
- secure persistence
- reliable audit records
- future system-derived evidence
- future CRM/business data integration

This phase does not choose or implement a backend platform.

## Non-goals
- No package recommendation routing (`recommended_solution = null`)
- No middleware/framework additions
- No CRM integration in this phase
