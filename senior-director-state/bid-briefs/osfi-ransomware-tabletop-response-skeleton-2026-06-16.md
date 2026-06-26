# OSFI Ransomware Tabletop — Bid Response Skeleton (v0)

**Bid:** Ransomware Tabletop Exercise — OSFI (CanadaBuys cb-553-91017696)
**Prepared:** 2026-06-16 by Cowork
**Status:** No-send draft. Local-only. Pricing + past performance gated to Ahmad. Submission gated to live SOW pull + clearance check.
**Parent docs:** `iis-public-safe-capability-statement-2026-06-06.md` · `iis-federal-bid-supplement-2026-06-16.md` · `osfi-ransomware-tabletop-2026-06-16.md` (bid brief).

> Pre-fills sections 2, 4, 6, 8 of the standard federal response order. Sections 1 (cover letter), 5 (past performance), 7 (CV) require Ahmad input. Section 9 (annexes) is sign-at-bid-time. Section 10 (references) needs the 3 past-performance contacts.

---

## Section 2 — Executive Summary

> Integrated IT Support Inc. (IIS) provides senior-led, AI-augmented cybersecurity readiness engagements with documented decision-capture, human oversight gates, and reusable methodology assets. For OSFI's Ransomware Tabletop Exercise, IIS proposes a single-engagement scope: a facilitated half-day or full-day scenario walk-through with the OSFI incident-response team, an after-action report identifying gaps and prioritized remediation, and an optional methodology asset that OSFI can re-run independently. IIS brings practical IT delivery experience, an internally-operated AI incident-capture system (ARIA) that produces immutable decision logs as a transparency artifact, and a partnership pipeline with Anthropic for responsible-AI implementation services where AI augments — but never replaces — human judgement. IIS is Canadian-incorporated, Toronto-based, and prepared to meet OSFI's accountability, privacy, and approval-gate expectations.

(1 paragraph, ~140 words — fits typical 1–2 page executive summary slot.)

---

## Section 4 — Rated Criteria (template responses)

Common rated-criteria categories in federal cyber/IT services bids — pre-stocked with IIS proof language. Replace [INSERT] with bid-specific text once the live SOW is pulled.

### 4.1 Project Approach & Methodology (typical weight: 25–30%)

**IIS approach to a ransomware tabletop exercise:**

1. **Pre-engagement discovery (1–2 days, no on-site).** Review existing OSFI IR plan, incident-classification taxonomy, escalation contacts, and any prior tabletop after-action reports. Confirm exercise objectives, in-scope systems, and participant roster.
2. **Scenario design (1 day).** Build a scenario reflecting current ransomware tradecraft (initial-access vectors, lateral movement, exfiltration timeline, ransom communication, recovery decision points). Use one of three pre-built scenario chassis (financial-regulator data extortion, supply-chain compromise, insider-assisted detonation) — adapted to OSFI's environment.
3. **Facilitated exercise (half-day or full-day).** Live-narrated injects, structured decision moments, role-by-role participation, mid-exercise pulse checks, and a debrief.
4. **Decision capture.** Every decision point logged with timestamp, decider, options considered, and rationale — usable for compliance evidence and post-incident review. ARIA optionally provides a real-time decision-log transparency layer.
5. **After-action report (5–10 business days).** Findings ranked Critical / High / Medium / Low with remediation owner suggestions, control-uplift backlog, and a re-test recommendation window.
6. **Reusable methodology hand-off.** A redacted run-book template OSFI can use to facilitate the next tabletop internally — IIS does not lock-in.

### 4.2 Team Experience & Qualifications (UPDATED with resume)

**Engagement Lead: Ahmad Wasee, Founder & Senior AI Engineer, Integrated IT Support Inc.**

13+ years enterprise IT engineering across regulated financial services and public-sector healthcare. Direct experience that lands this tabletop credibly:

- **RBC Capital Markets (2013–2017):** Service-desk leadership in 24×7 OSFI/IIROC-governed trader-floor environment. Acting Service Desk Manager. Authored VB.NET rule-based diagnostic tool (functional precursor to LLM-backed AI support copilots), VBA automation pipeline recovering 800+ analyst hours/year. CMDB lifecycle aligned to CSDM. Major-incident command rotation.
- **Ontario Health (2019):** PHIPA-compliant healthcare IT — EMRs, clinical info systems, patient portals. Access controls, data privacy safeguards, UAT/QA, KB authoring.
- **Integrated IT Support Inc. / ARIA (2023–Present):** Founder. Architected and operates ARIA — a production multi-agent LLM platform on Anthropic Claude + Model Context Protocol, 9+ scheduled autonomous agents, 12-server MCP orchestration. Decision-capture and structured-output prompting at the heart of the system.

**Credentials:**
- Anthropic Academy: Claude 101, Claude Code 101, Claude Cowork, Claude Code in Action, AI Fluency (all completed 2026). Building with the Claude API (in progress).
- ITIL Foundations (RBC, 2017). Six Sigma Yellow Belt (RBC, 2017). Project Management + Agile Project Management (both 2023).
- Seneca College — Advanced Diploma, Computer Networking & Technical Support (2009-2011).

IIS positioning:
- Senior-led delivery, no handoff layers.
- 13+ years operating in regulated environments (OSFI, IIROC, PHIPA, SOX).
- Decision-capture via ARIA — internally validated; no claims of autonomous operation.
- Anthropic Partner pipeline (status pending — see verification findings).

### 4.3 Understanding of OSFI's Environment

[INSERT post live SOW pull. Generic federal-regulator framing:]

OSFI sits in a layered Canadian financial-regulatory ecosystem (Bank Act, ICA, PRPPA, federal pension oversight). A ransomware event at OSFI carries reputational, regulatory, and downstream-bank confidence consequences that exceed dollar loss. The tabletop should therefore weight communication protocols (CSE/CSIS notifications, market-stability messaging, regulated-entity reassurance) at least as heavily as technical recovery.

### 4.4 Methodology Innovation

**ARIA-backed decision capture as differentiator.** During the exercise, ARIA can be configured (optional, OSFI's call) to mirror every participant decision into an append-only log with: timestamp, decider role, options on the table, option chosen, rationale stated. The log becomes an evidence artifact for OSFI's later compliance review without requiring a human note-taker to keep up with live conversation. ARIA never makes decisions, never recommends — it captures. Per IIS's standing operating law, AI augments human judgement and never replaces it.

### 4.5 Risk Management

| Risk | Likelihood | Mitigation |
|---|---|---|
| Participant scheduling conflicts | Medium | Two-window scheduling option; pre-engagement participant confirmation 10 days out |
| Scenario realism vs comfort | Medium | Pre-engagement scenario sign-off with OSFI sponsor before facilitation day |
| Sensitive material handling | Low (IIS uses no-cloud capture by default) | Decision log can be air-gapped or operated under OSFI's own retention policy |
| Vendor scope creep | Low (fixed-scope engagement) | Written change-order protocol; out-of-scope items deferred to follow-up engagement |

### 4.6 Schedule

| Phase | Duration | Owner |
|---|---|---|
| Pre-engagement discovery | 1–2 business days | IIS + OSFI sponsor |
| Scenario design | 1 business day | IIS |
| Scenario sign-off | OSFI review window (2–5 business days) | OSFI |
| Facilitated exercise | Half- or full-day on agreed date | IIS facilitator + OSFI team |
| After-action report | 5–10 business days post-exercise | IIS |
| Methodology hand-off | Concurrent with after-action report | IIS |

Total elapsed: ~3–4 weeks from contract signature to final deliverable.

---

## Section 6 — Methodology / Approach (extended)

(Use Section 4.1 expanded.)

### 6.1 Why a single-engagement tabletop is the right shape for OSFI's first IIS engagement

A tabletop is bounded, low-risk-to-buyer, evidence-producing, and reusable. OSFI gets a defensible artifact (the after-action report) and a reusable asset (the methodology hand-off) without committing to a multi-year managed-services relationship. IIS gets a federal-regulator engagement on the record. Both sides have an off-ramp.

### 6.2 Optional follow-on (post-engagement, not part of this bid)

If OSFI finds the engagement valuable, IIS can offer follow-on services through a separate procurement vehicle: incident-response runbook authoring, drill cycles, AI-assisted continuous-monitoring methodology, or service-desk readiness review. None of these are bundled into the tabletop bid — keeps the current bid clean.

### 6.3 Non-claims

To stay within federal claim-accuracy expectations, IIS does NOT claim in this response:

- Any specific reduction in incident response time.
- Any specific accuracy metric for ARIA.
- Any pre-existing OSFI relationship, contract, or endorsement.
- Any certification IIS has not earned (SOC 2, ISO 27001, etc.).
- Any reduction in OSFI's regulatory or legal exposure.

---

## Section 8 — Pricing Schedule (placeholder, Ahmad-gated)

Fill the official OSFI pricing form per RFP instructions. The numbers below are IIS internal targets, pulled from the Federal Bid Supplement §7. **Do not enter into the OSFI form without Ahmad's pricing confirmation.**

| Line item | Indicative range (CAD, ex-tax) | Notes |
|---|---|---|
| Pre-engagement discovery | $1,500 – $3,000 | 1–2 days facilitator time |
| Scenario design | $1,200 – $2,500 | 1 day senior facilitator |
| Facilitated exercise (half-day) | $3,500 – $6,000 | 4-hour live facilitation + on-site coordination |
| Facilitated exercise (full-day) | $6,000 – $10,000 | 8-hour live facilitation |
| After-action report | $1,800 – $3,500 | 5–10 business days writing |
| Methodology hand-off package | $500 – $1,500 | Templates + run-book |
| **Total (half-day exercise)** | **CAD $8,500 – $16,500** | per Federal Bid Supplement §7 |
| **Total (full-day exercise)** | **CAD $11,000 – $20,500** | per Federal Bid Supplement §7 |

Optional add-on (separately quoted): ARIA decision-capture deployment for the exercise day. Adds CAD $1,200 – $2,500 depending on OSFI's data-handling preference (air-gapped vs IIS-hosted).

---

## What's still missing before submission (REVISED 2026-06-16)

1. **Live SOW pull** — confirm closing date, mandatories, page limits, attachment list. Blocked on Nimble auth OR Chrome MCP session with Ahmad.
2. **Mandatories filter:** if SOW requires insurance certificates OR security clearance, IIS SKIPS this bid (per Federal Bid Supplement §3, no insurance in force, no clearance held). If SOW is advisory/methodology with no mandatory insurance → BID.
3. **Past performance (Section 5)** — **FILLED 2026-06-16** in `past-performance-FILLED-2026-06-16.md`. Citing IIS/ARIA, RBC Capital Markets (regulated env, automation outcomes), Ontario Health (PHIPA compliance). Ahmad confirms reference-contact posture + value ranges.
4. **Cover letter (Section 1)** — Cowork drafts once Ahmad confirms mandatories are passable.
5. **Ahmad's CV (Section 7)** — resume in hand (`Ahmad Wasee_AI Engineer Resume.docx`). Cowork can condense to 1-page federal-evaluator format if needed.
6. **Tax compliance letters (Section 9 annexes)** — CRA + ON Ministry of Finance. Free certificates, 1-2 days lead time.

INSURANCE ITEMS DROPPED — IIS does not currently carry CGL/E&O/Cyber. Bid only proceeds if SOW does NOT mandate insurance certs.

## Stop rules

- No submission until all 6 gaps are closed.
- Pricing numbers above are internal targets only — final pricing requires Ahmad's per-bid confirmation.
- No security-clearance claim until Ahmad confirms current level.
- No client name appears in this draft until Ahmad authorizes.

## One-line summary

> Sections 2, 4, 6, 8 of the OSFI response pre-built from existing IIS materials. Once Ahmad confirms past-performance + pricing + Capability Statement gaps (single approval pass), Cowork drafts cover letter and final-form response in one session.
