# FlowCore Diagnostic Report Specification (Phase 6 Hardening)

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

## Next Priority Constraint Terminology
Use:
- `NEXT PRIORITY CONSTRAINT`

Do not use:
- downstream constraint
- future bottleneck
- likely next bottleneck

Display rule:
- only the third-ranked deterministic candidate
- only when `priority_score >= 180`

Current limitation note:
- ranking indicates deterministic priority order only, not proven causal dependency.

## True Downstream Constraints (Future Work)
A future FlowCore version may add an explicit process-dependency graph to distinguish:
- current constraint
- causal downstream constraint
- future capacity bottleneck

The current deterministic ranking model does **not** make causal dependency claims.

## Executive Snapshot
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

## Seven Engine Scorecard
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

## Revenue Leakage Rules
Only deterministic and data-backed values are shown.
- Uses available supplemental counts and derived metrics.
- Missing denominator or missing stage data -> `Insufficient data to calculate this stage reliably.`
- Clarification flags render warning text:
  - `Requires clarification before this metric should be used for decision-making.`
- No invented traffic/contact/leakage-dollar figures.

## Constraint Analysis Rules
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

`NEXT PRIORITY CONSTRAINT` appears only when threshold rule is met.

## Constraint Chain
Visual chain uses available deterministic constraints only:
- Primary
- Secondary
- Next Priority (if threshold met)

No fabricated causal/downstream claims.

## Systems Architecture Mapping Table
Mappings are centralized in `flowcore-report.js` (`SYSTEM_ARCHITECTURE_MAPPINGS`).

| Mapping ID | Triggering Question/Process | Trigger Threshold | Current Diagnostic State | Priority Future State | Reason |
|---|---|---:|---|---|---|
| response-followup-chain | C1, C2, C4 (Lead Response + Follow-Up + Booking) | any `< 75` | Lead captured -> inconsistent response -> manual follow-up | Lead captured -> reliable rapid response -> structured follow-up -> qualification -> booking -> reminders | Conversion flow requires response/follow-up/booking consistency before volume expansion. |
| delivery-standardization | D1, D2 (Onboarding + Fulfillment) | any `< 75` | Sale closed -> inconsistent onboarding/fulfillment | Sale closed -> standardized onboarding -> documented fulfillment checkpoints -> quality control | Delivery reliability should be systemized before growth pressure increases service load. |
| operating-independence | I1, I2, I4 (Data + Process + Owner Dependency) | any `< 75` | Owner-driven operations with fragmented process memory | Centralized data -> documented processes -> delegated ownership -> escalation rules | Independence fragility should be reduced before acceleration. |
| visibility-governance | E2, E3 (Financial + KPI Visibility) | any `< 75` | Growth decisions with incomplete financial/KPI visibility | Capacity and growth decisions guided by recurring financial/KPI reporting | Expansion decisions require recurring economic/performance visibility. |

Fallback mapping applies only when none of the above are triggered.

## AI Opportunity Mapping Table
Mappings are centralized in `flowcore-report.js` (`AI_OPPORTUNITY_MAPPINGS`).

| Mapping ID | Process | Trigger | Classification | Rationale | Safeguards |
|---|---|---|---|---|---|
| appointment-reminders | Appointment reminders | C4 maturity `< 88` | AUTOMATE | Repetitive low-judgment reminders suit deterministic automation. | Escalate unresolved schedule conflicts to humans. |
| review-requests | Review requests | D4 maturity `< 88` | AUTOMATE | Post-delivery prompts are recurring and rule-driven. | Exclude unresolved complaint cases from automation. |
| lead-response-assist | Missed lead response triage | C1 `< 75` and C2 `>= 25` | AI ASSIST | Assisted responses can reduce first-touch delays without removing human control. | Human approval for sensitive/high-value outbound cases. |
| pipeline-summaries | Pipeline summaries | (I1 `< 75` or E3 `< 75`) and evidence coverage `>= 70%` | AI ASSIST | Summaries support operator review, not autonomous decisions. | Human decision authority retained. |
| faq-assist | FAQ handling | M2 `< 60` and V1 `>= 45` | AI ASSIST | FAQ assistance reduces repetitive support load where offer framing is minimally stable. | Escalate pricing exceptions, complaints, and contract interpretation. |
| kpi-rollup | KPI data normalization | I1 `<= 50` and E3 `<= 50` and no INVALID flags | AI EXECUTE + HUMAN OVERSIGHT | Structured metric rollups can be executed under strict review gates. | Human approval before metric publication/strategy changes. |
| funnel-definition-redesign | Conflicting funnel definitions | Any REQUIRES_CLARIFICATION funnel flag | ELIMINATE / REDESIGN | Inconsistent stage definitions should be redesigned before downstream automation. | No decision-critical automation until definitions are normalized. |
| complex-sales-judgment | Complex sales negotiation | Always | KEEP HUMAN | Negotiation requires contextual and risk-sensitive judgment. | AI decision support only; no autonomous commitments. |
| complaint-escalation-judgment | Complaint escalation | Always | KEEP HUMAN | Escalation often includes sensitive trust and remediation decisions. | No autonomous complaint-resolution authority. |
| strategic-decision-support | Strategic decisions | Always | KEEP HUMAN | Strategic/high-impact decisions require executive accountability. | No autonomous execution for pricing, legal, hiring/firing, or financial commitments. |

## AI EXECUTE + HUMAN OVERSIGHT Policy
Use sparingly and only for structured reversible workflows.

Do not recommend autonomous AI execution for:
- strategic business decisions
- sensitive complaint resolution
- major pricing decisions
- financial commitments
- legal/compliance decisions
- firing/hiring decisions
- other high-impact judgment calls

## Recommended Next Step Precedence (Centralized)
Implemented in `flowcore-report.js` (`NEXT_STEP_PRECEDENCE`) using the exact order:

A. `VALIDATE DATA`
- when INVALID data prevents reliable scoring or materially affects SCALE/HOLD.

B. `REPAIR FIRST`
- when a critical repair-priority constraint or major operating guardrail causes HOLD.

C. `VALIDATE DATA`
- when no critical operating blocker exists but clarification or insufficient confidence affects decision reliability.

D. `SYSTEMIZE`
- when not yet scale-ready but no critical repair/data blocker dominates.

E. `PREPARE TO SCALE`
- when decision is SCALE but Expansion Ready eligibility is false.

F. `EXPANSION PLANNING`
- only when Expansion Ready eligibility is true.

Clarification-level issues are displayed separately and do not override REPAIR FIRST when a critical operating blocker exists, unless rule A applies.

## 30/60/90 FlowPlan Rules
- Days 1–30: REPAIR (primary constraint focus)
- Days 31–60: SYSTEMIZE (secondary/support focus)
- Days 61–90:
  - SCALE -> ACCELERATE
  - HOLD -> VALIDATE & PREPARE

Actions are drawn from centralized question-level action library.

## Rule-Based Action Library
- Centralized in `flowcore-report.js` (`ACTION_LIBRARY`).
- Contains deterministic practical actions for all 28 core question IDs (M1–E4).
- Non-vendor-specific and process-focused.

## Confidence Presentation
Displays:
- Diagnostic confidence
- Evidence coverage
- Evidence type summary counts
- Decision confidence status

Explains maturity vs confidence separation.

## Expansion Ready Presentation
If overall maturity is high but guardrails fail, report clearly indicates:
- Expansion Ready Candidate
- Not Yet eligible
- failed guardrails

## Report Versioning
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
- Constraint ranking does not yet prove causal downstream dependency.

## Future Authoritative Path (Platform Agnostic)
Authoritative production implementation should move scoring/report generation into controlled server-side execution for integrity, version control, persistence, and verified evidence workflows.
