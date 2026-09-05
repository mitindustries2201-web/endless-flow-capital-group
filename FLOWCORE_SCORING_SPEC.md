# FlowCore / FlowScale Deterministic Scoring Specification

## Scope
This specification defines deterministic scoring for the 28-question FlowScale diagnostic in a static HTML/CSS/JS architecture.

## Core Structure
- 7 engines, 4 core questions each (28 total)
- Core maturity responses are 0–4
- Normalized question score: `response / 4 * 100`

### Engine Weights
- Market: 10%
- Value: 15%
- Acquisition: 15%
- Conversion: 20%
- Delivery: 15%
- Independence: 15%
- Expansion: 10%

## Question Scoring Direction
Default direction:
- 0 => 0
- 1 => 25
- 2 => 50
- 3 => 75
- 4 => 100

### Reverse Scoring
- `I4` (Owner Dependency) is reverse-scored.
- Raw response is preserved.
- Scored maturity response is `4 - raw_response`.

## Engine Scores
Engine score = average normalized score across scored core questions in that engine.
Supplemental inputs do not replace core maturity responses.

## Overall FlowScale Score
`overall = Market*.10 + Value*.15 + Acquisition*.15 + Conversion*.20 + Delivery*.15 + Independence*.15 + Expansion*.10`

- Internal precision kept to 2 decimals.
- Displayed score rounded to nearest whole number.

## Maturity Stages
- 0–29: Unstructured
- 30–44: Foundation
- 45–59: Repeatable
- 60–74: Managed Growth
- 75–87: Scalable
- 88–100: Expansion Ready Candidate

## Expansion Ready Guardrail
Expansion Ready eligible only if:
1. Overall >= 88
2. No engine < 70
3. Delivery >= 75
4. Independence >= 75

If overall >= 88 but any guardrail fails:
- `expansion_ready_candidate: true`
- `expansion_ready_eligible: false`
- stage presented as `Scalable`
- failed guardrails listed.

## Supplemental Validation and Derived Metrics
Validation flags are emitted (not silently discarded).

Examples:
- average sale >= 0
- gross margin in [0,100]
- leads/appointments/qualified/sales >= 0
- contradiction flags if appointments > leads, sales > qualified, or sales > leads

Derived metrics (if valid denominators):
- Booking Rate = appointments / leads * 100
- Close Rate = sales / qualified opportunities * 100
- Lead-to-Customer Rate = sales / leads * 100

If denominator missing/zero (or contradictory): metric = `null`.

## Diagnostic Confidence (Separate from FlowScale)
Evidence levels:
- Estimated: 25
- Self-reported: 50
- System-derived: 80
- Verified: 100

Public audit default evidence type: `self_reported` unless explicitly provided otherwise.

Calculated outputs:
- evidence_quality_score = average evidence score of usable responses
- evidence_coverage = usable responses / 28
- confidence_score = evidence_quality_score * evidence_coverage

## Constraint Candidate Model
Candidates considered when normalized score < 75.

Gap severity mapping:
- 0 -> 5
- 25 -> 4
- 50 -> 3
- <75 -> 2

Question-level metadata is explicit in config:
- revenue_impact (1-5)
- dependency (1-5)
- urgency (1-5)

Constraint priority:
`priority_score = gap_severity * revenue_impact * dependency * urgency`

Candidate output fields:
- engine
- question_id
- label
- normalized_score
- gap_severity
- revenue_impact
- dependency
- urgency
- priority_score
- reason_code

Sorted deterministically by:
1. priority_score (desc)
2. normalized_score (asc)
3. question_id (asc)

Primary and secondary constraints are top two ranked candidates.

## Strongest / Weakest Engine
- If a single max/min exists: return `strongest_engine` / `weakest_engine`.
- Ties are preserved in `strongest_engines` and `weakest_engines` arrays.

## Scale / Hold Deterministic Rule
### HOLD triggers include
- Delivery < 50
- Independence < 50
- Conversion < 50
- Expansion < 50
- critical data quality contradiction
- very low E2 financial visibility
- capacity weakness (E1)
- very high-priority constraint requiring repair first

### SCALE requires
- overall >= 75
- conversion >= 60
- delivery >= 70
- independence >= 65
- expansion >= 70
- no critical data-quality flag
- no critical repair-first constraint

If SCALE requirements are not met, decision is HOLD.

## No Package Routing in Scoring Layer
No score-to-package mapping is implemented.
`recommended_solution` remains `null` in this phase.

## Question IDs
- Market: M1–M4
- Value: V1–V4
- Acquisition: A1–A4
- Conversion: C1–C4
- Delivery: D1–D4
- Independence: I1–I4
- Expansion: E1–E4

## Future Integration Points
- Move `flowcore-scoring.js` pure functions to API/server.
- Replace local-only preview with server-validated results.
- Add evidence source enrichment and stronger confidence model.
- Add deterministic + analyst-assisted constraint interpretation.

## Known Limitations (Phase 4)
- Deterministic rules only; no narrative AI diagnosis.
- Supplemental inputs are validated and interpreted but not full leakage model yet.
- Confidence defaults to self-reported unless explicit evidence metadata is provided.
