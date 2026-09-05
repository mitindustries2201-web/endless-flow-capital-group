# FlowCore Diagnostic Report Specification (Phase 6)

## Scope
Defines deterministic client-side report behavior for completed FlowScale diagnostics in the static HTML/CSS/JS implementation.

## Report Entry
- Dedicated page: `flowcore-report.html`
- Source data key: `ef_flowcore_result_v1`
- Unfinished audit key remains separate: `ef_flowcore_diagnostic_v1`

If no completed result is found:
- Show: `No completed FlowCore diagnostic was found on this device.`
- CTA: `Take the AI Business Audit`
- Never render fake/sample user results.

## Stored Completed Result Envelope
The completed result payload includes:
- scoring version
- completion timestamp
- raw core responses
- scored core responses
- supplemental values
- engine scores
- overall FlowScale score
- maturity stage
- strongest/weakest engine
- primary/secondary constraints
- ranked constraints
- diagnostic confidence and coverage
- data quality flags
- scaling decision + decision confidence status
- derived metrics
- expansion-ready status/guardrails

## Report Architecture
1. Executive Snapshot
2. Seven Engine Scorecard
3. Revenue Leakage Map
4. Constraint Analysis
5. Constraint Chain
6. Current vs Recommended Systems Architecture
7. AI & Automation Opportunity Map
8. 30/60/90-Day FlowPlan
9. Recommended Next Step
10. Diagnostic Confidence
11. Data Quality Flags
12. Expansion Ready Guardrails

## Deterministic Interpretation Rules
- All displayed statements derive from scored outputs, flags, and rule-based templates.
- No freeform/fabricated AI narrative generation.
- No package-routing recommendations.
- Optional CTA remains separated from diagnosis.

### Executive Snapshot
Displays:
- FlowScale score
- Stage
- Scaling decision
- Decision status
- Primary/secondary constraints
- Strongest engine
- Diagnostic confidence

Includes deterministic interpretation:
- HOLD: `Repair the current constraint before materially increasing volume.`
- SCALE: `Your current operating foundation appears capable of supporting additional volume, subject to the quality of the information provided.`

Includes public disclaimer:
- `Based on the information provided. This diagnostic has not been independently verified.`

### Seven Engine Scorecard
Per-engine display:
- engine name
- score /100
- weight
- maturity visual
- descriptive status bands:
  - 0–29 Critical Foundation
  - 30–44 Foundational
  - 45–59 Developing
  - 60–74 Managed
  - 75–87 Strong
  - 88–100 Advanced

These are descriptive report labels and do not replace official overall FlowScale stage bands.

### Revenue Leakage Rules
Only deterministic and data-backed values are shown.
- Uses available supplemental counts and derived metrics.
- Missing denominator or missing stage data -> `Insufficient data to calculate this stage reliably.`
- Clarification flags render warning text:
  - `Requires clarification before this metric should be used for decision-making.`
- No invented traffic/contact/leakage-dollar figures.

### Constraint Analysis Rules
For primary and secondary constraints show:
- label
- engine
- maturity score
- priority score
- severity
- revenue impact
- dependency
- urgency
- reason code
- deterministic explanation template

`Likely Next Constraint` appears only when ranked evidence is sufficient by deterministic threshold.

### Constraint Chain
Visual chain uses available deterministic constraints only:
- Primary
- Secondary
- Next likely (if sufficient)

No fabricated downstream entries.

### Systems Architecture Rules
Report shows process-gap architecture, not guessed vendor stack.
- `Current Diagnostic State`
- `Priority Future State`

Nodes and transitions are selected from deterministic weak-area patterns.
No unsupported claims of CRM/tool/platform usage.

### AI & Automation Opportunity Map
Conservative rule-based categories only:
- KEEP HUMAN
- AUTOMATE
- AI ASSIST
- AI EXECUTE + HUMAN OVERSIGHT (reserved, optional future use)
- ELIMINATE / REDESIGN (reserved, optional future use)

Includes principle:
- `Automation should remove friction, not judgment.`

### 30/60/90 FlowPlan Rules
- Days 1–30: REPAIR (primary constraint focus)
- Days 31–60: SYSTEMIZE (secondary/support focus)
- Days 61–90:
  - SCALE -> ACCELERATE
  - HOLD -> VALIDATE & PREPARE

Actions are drawn from centralized question-level action library.

### Rule-Based Action Library
- Centralized in `flowcore-report.js` (`ACTION_LIBRARY`).
- Contains deterministic practical actions for all 28 core question IDs (M1–E4).
- Non-vendor-specific and process-focused.

### Recommended Next Step Rules
Deterministic categories such as:
- REPAIR FIRST
- VALIDATE DATA
- SYSTEMIZE
- PREPARE TO SCALE
- EXPANSION PLANNING

No direct package sales recommendation.

### Confidence Presentation
Displays:
- Diagnostic confidence
- Evidence coverage
- Evidence type summary counts
- Decision confidence status

Explains maturity vs confidence separation.

### Expansion Ready Presentation
If overall maturity is high but guardrails fail, report clearly indicates:
- Expansion Ready Candidate
- Not Yet eligible
- failed guardrails

### Report Versioning
Displays scoring methodology version directly from scoring output:
- `FlowScale Methodology Version: <FLOWSCALE_SCORING_VERSION>`

No conflicting hard-coded alternative version.

## Print / Save Experience
- Button: `Print / Save Report`
- Action: `window.print()`
- Print stylesheet behavior:
  - hide nav and irrelevant controls
  - retain executive scores, constraints, FlowPlan, methodology version, date, disclaimer
  - reduce page-break issues with cards/sections

## Privacy / Local Data Behavior
- `Start New Audit` does not auto-delete completed report data.
- `Clear Diagnostic Data` requires deliberate double confirmation.
- Clear action removes both local unfinished and completed diagnostic keys from current device browser storage.
- No unnecessary identity credentials or sensitive financial credentials stored.

## Limitations (Current Phase)
- Browser scoring/reporting is reference/development implementation.
- No authoritative server-side scoring yet.
- No backend persistence, tamper resistance, or verified external evidence ingestion yet.
- No automatic package recommendation logic.

## Future Authoritative Path (Platform Agnostic)
Authoritative production implementation should move scoring/report generation into controlled server-side execution for integrity, version control, persistence, and verified evidence workflows.
