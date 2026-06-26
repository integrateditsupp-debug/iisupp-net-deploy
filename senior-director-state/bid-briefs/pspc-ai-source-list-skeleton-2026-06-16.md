# PSPC AI Source List — Bid Response Skeleton

**Bid:** Artificial Intelligence Source List — Public Services and Procurement Canada
**Solicitation:** WS4286933967
**Deadline:** 2026-09-30, 14:00 EDT
**Buyer:** PSPC
**Submission portal:** SAP Business Network / Ariba Discovery
**Prepared:** 2026-06-16 by Cowork
**Status:** No-send draft. Pricing + reference contacts + Ariba portal access gated to Ahmad.
**Parent docs:** `iis-public-safe-capability-statement-2026-06-06.md` · `iis-federal-bid-supplement-2026-06-16.md` · `past-performance-FILLED-2026-06-16.md` · `ahmad-wasee-cv-1page-federal-2026-06-16.md` · `capture/2026-06-04-first-three/01-pspc-ai-source-list-submission-preview.md` (original capture)

> **Update vs 2026-06-04 capture:** insurance/clearance items dropped (none in force). Past performance + CV now filled from real resume. Anthropic Partner status verification-flagged (do not lean on until confirmed). Bid scope tightened to fit IIS's no-insurance posture: methodology, advisory, knowledge-management, remote AI implementation — not on-site / embedded / classified work.

---

## Band targeting decision

**Recommended target: Band 1 (engagements ≤ CAD $1M).**

Rationale:
- Past-performance evidence supports IIS/ARIA + RBC + Ontario Health credibly at Band 1 scale.
- No insurance + no security clearance in force → larger bands draw scrutiny IIS can't currently pass.
- Band 1 lands IIS on the pre-qualified list — future Bands accessible later via supplemental qualification when insurance + clearance land.

**Not bidding Band 2/3** this submission cycle. Position to upgrade post-Band-1 acceptance + insurance procurement.

---

## Section 1 — Cover Letter (shell)

Same skeleton as OSFI cover letter (`osfi-cover-letter-shell-2026-06-16.md`) — replace OSFI references with PSPC + adjust paragraph 2 to emphasize **Band 1 qualifying scope**, AI implementation experience, responsible-AI methodology.

Key adjustments vs OSFI cover:
- Lead with ARIA platform as direct AI implementation evidence (PSPC is an AI-specific source list).
- Mention NAICS / GSIN already registered.
- Reference responsible-AI alignment (AIA, human oversight, monitoring, accessibility).
- Anti-claim language remains: no autonomous-AI, no certification-not-held, no insurance-not-in-force.

## Section 2 — Executive Summary

> Integrated IT Support Inc. submits this response to qualify for the Government of Canada's Artificial Intelligence Source List as a practical, responsible AI implementation partner focused on AI-enabled support automation, multi-agent workflow orchestration, knowledge management, and remote managed AI operations.
>
> IIS operates the ARIA platform — a production multi-agent system on Anthropic Claude and the Model Context Protocol, with nine or more scheduled autonomous agents and a twelve-server tool-orchestration layer in active use. This is not a research demo. It is a daily-operating production system that demonstrates IIS's capability to design, build, govern, and operate applied-AI systems with documented decisions, human oversight, and clear escalation paths.
>
> For Government of Canada departments, IIS proposes AI readiness assessment, responsible-AI implementation planning, multi-agent / copilot configuration, knowledge-base architecture, Algorithmic Impact Assessment (AIA) input support, monitoring and governance design, and remote managed AI operations. We align delivery with the Government of Canada Directive on Automated Decision-Making and the Algorithmic Impact Assessment process where automated decisions are in scope.
>
> Our delivery model is deliberately remote-first and methodology-led. We are requesting qualification for **Band 1** — supportable with current project evidence, resource capacity, and operating posture. We are prepared to subcontract or partner for larger multi-disciplinary AI programs that exceed Band 1 scope.

## Section 3 — Mandatory Criteria Response

Skeleton — populate exact wording after SAP Ariba mandatory checklist is pulled.

For each mandatory PSPC criterion, IIS will respond in this format:

```
Criterion [n]: [exact text from SAP Ariba mandatory list]
IIS response: [point-by-point statement of how IIS meets the criterion]
Evidence reference: [section number in this response OR attachment name]
```

Common federal AI mandatories that IIS clears today:

- **Canadian corporate identity:** Confirmed (Integrated IT Support Inc., Whitby, ON).
- **PBN / NAICS / GSIN registration:** All ACTIVE.
- **Documented AI delivery experience:** ARIA platform = direct evidence (see Section 5 + ARIA brief attachment).
- **Responsible-AI policy / governance:** IIS has documented AI governance posture (see Section 4.2).
- **Bilingual delivery capacity:** [CONFIRM with Ahmad — French delivery capacity may be limited; PSPC accepts English-primary suppliers but offers documentation pairing scenarios.]
- **Project values documented:** Past-performance attachment with values declared.
- **Reference availability:** Past-performance attachment with reference-contact permissions (confirmed per engagement).

Mandatories IIS does NOT clear today (must verify SOW doesn't make them mandatory):
- Specific certifications IIS does not hold (e.g., ISO 27001, SOC 2 — IIS positions on documented operating discipline + small-firm controls).
- Active insurance certificates (per Federal Bid Supplement §3).
- Personnel security clearance (Reliability, Secret).

## Section 4 — Rated Criteria

### 4.1 AI Delivery Approach & Methodology

IIS methodology has four phases for any AI-implementation engagement with a Government of Canada client:

1. **Outcome definition + risk triage.** Define the business outcome before model selection. Apply Algorithmic Impact Assessment screening. Decide what category of automated decision-making is in scope. If any high-risk decision is in scope, IIS recommends additional governance review before continuing.
2. **Narrow pilot.** Pilot one workflow, one user group, measurable outcome, documented controls. Avoid production rollouts without pilot evidence.
3. **Governance documentation.** Human oversight, escalation, data minimization, audit trail, output quality check, AIA-aligned documentation, accessibility.
4. **Operate + measure + tune.** Monthly review of outputs, drift, user feedback, incident logs. Quarterly governance review with the client sponsor.

### 4.2 Responsible AI Posture

IIS publicly commits to the following operating posture in every Government of Canada AI engagement:

- **Human oversight required at every action-taking step.** AI agents propose; humans decide.
- **No use of client data for model training** unless contractually authorized in writing.
- **Decision-capture as a default.** Every automated suggestion logged with rationale.
- **Accessibility per Government of Canada Web Standards** in all delivered interfaces.
- **AIA support as standard offering**, not upsell.
- **Vendor-model risk transparency.** IIS discloses the LLM family used per engagement; recommends evaluation criteria; supports vendor change-control.

### 4.3 Team Experience

Engagement Lead: Ahmad Wasee (CV at `ahmad-wasee-cv-1page-federal-2026-06-16.md`). 13+ years enterprise IT engineering, founder of IIS / ARIA, regulated-services background.

For engagements exceeding solo-lead capacity within Band 1, IIS subcontracts with vetted Canadian specialists under written subcontract terms approved by Ahmad. No undisclosed offshoring of in-scope AI delivery work.

### 4.4 Demonstrated AI Delivery — ARIA Platform

ARIA is IIS's flagship AI-implementation evidence. Highlights:

- **9+ production scheduled autonomous agents** (cron-driven).
- **12-server MCP orchestration layer** integrating Apollo CRM, HubSpot, Stripe, Netlify, Gmail, Chrome MCP, computer-use, scheduled-tasks, Slack, Atlassian, Notion.
- **Two-tier file-based RAG** (MEMORY.md index + topic-segmented markdown KB).
- **5-stage filter chain** built after a real production bug (upstream MCP cache served stale data) — wasted draft cycles dropped from ~60% to under 5%.
- **Identity-routed prompt design** — agents auto-select personal vs corporate identity per context (eliminates cross-context identity leakage).
- **CRA tax/expense automation** — daily sync into IIS 2026 tax workbook + month-end reconciliation (eliminates manual bookkeeping touchpoints).

Public IIS framing of ARIA is intentionally conservative — IIS does NOT claim ARIA outperforms named vendor products, does NOT claim specific accuracy metrics, does NOT position ARIA as autonomous AI.

## Section 5 — Past Performance

See `past-performance-FILLED-2026-06-16.md` for federal-format engagements:
- IIS / ARIA (2023–Present) — direct AI implementation.
- RBC Capital Markets (2013–2017) — VB.NET diagnostic tool (AI-precursor pattern), 800+ analyst hours/year recovered through VBA automation.
- Ontario Health (2019) — PHIPA-compliant healthcare IT.

Cavalluzzo LLP (Nov 2018 – Jul 2019) optional 4th engagement: automation scripts in legal-sector environment — early pattern of automation-first thinking that scales into AI workflow orchestration.

## Section 6 — Methodology (detailed)

Mirrors OSFI Section 6.1–6.3 — adapted to AI implementation engagements rather than tabletops. Cowork pre-builds full text per specific PSPC engagement post-band-acceptance.

## Section 7 — Resources

Primary: Ahmad Wasee, Engagement Lead. 1-page CV at `ahmad-wasee-cv-1page-federal-2026-06-16.md`.

Subcontract bench: IIS maintains relationships with Canadian specialists for: senior prompt engineering, AI governance review, technical writing, accessibility audit, applied-data science. Names disclosed under NDA at evaluator request.

## Section 8 — Pricing Posture

PSPC AI Source List is pre-qualification, not a priced engagement. IIS provides indicative rate ranges in the SAP Ariba submission per the prescribed band-1 fields:

| Capability | Indicative day-rate range (CAD, ex-tax) |
|---|---|
| Engagement Lead / Senior AI Engineer | $1,200 – $1,800 per day |
| AI implementation specialist (subcontract) | $900 – $1,400 per day |
| Technical writer / governance documentation | $600 – $900 per day |
| Accessibility audit / WCAG specialist | $700 – $1,000 per day |

These ranges are internal targets. Ahmad approves per follow-on solicitation.

## Section 9 — Annexes

- Past-performance attachment (see Section 5 reference).
- 1-page Engagement Lead CV.
- ARIA platform one-pager (Cowork can extract from `project_aria` memory + recent repo state).
- Integrity Regime declaration (sign at submission).
- Conflict-of-Interest declaration (sign at submission).
- Accessibility statement (per `feedback_visual_stability` and Government of Canada Web Standards).

## What still needs Ahmad action

1. **SAP Ariba portal access** — IIS must have a registered Ariba supplier account; Cowork cannot register on Ahmad's behalf (account-creation hard stop).
2. **CRA + ON tax compliance letters** (also OSFI dependency).
3. **BN / GST/HST numbers** (also OSFI dependency).
4. **Reference-contact permissions** (carried from past-performance).
5. **French-language delivery position** — confirm whether IIS supports bilingual delivery or English-primary with documentation pairing.
6. **Anthropic Partner status** — if confirmed accepted, fold into Section 4.4 as "credentialed partnership." If unconfirmed, leave out entirely. Per `verification-findings-2026-06-16.md`.
7. **Pricing rate-range approval** for Section 8 day rates.
8. **Subcontract bench confirmation** — Ahmad confirms which named specialists IIS can list under NDA at evaluator request.

## Stop rules

- No submission to SAP Ariba without Ahmad signing.
- No Band 2/3 claim — Band 1 only this cycle.
- No claim of ISO/SOC certification not held.
- No insurance claim — IIS only bids on PSPC follow-on solicitations that don't require insurance-mandatory criteria.
- No Anthropic Partner claim until status confirmed.

## One-line summary

> PSPC AI Source List response aligned to new federal skeleton. Band 1 target, IIS/ARIA + RBC + Ontario Health past performance, 1-page CV ready. Deadline 2026-09-30 leaves 3.5 months — plenty of runway to confirm Ahmad gates and submit cleanly.
