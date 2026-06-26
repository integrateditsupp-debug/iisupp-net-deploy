# IIS Federal Bid Supplement — 2026-06-16

**Companion to:** `senior-director-state/iis-public-safe-capability-statement-2026-06-06.md` (public-safe baseline).
**Purpose:** Federal-procurement-ready positioning for OSFI, PSPC, DND, and Sourcewell submissions. Adds the sections federal RFPs ask for that the public-safe statement does not need.
**Status:** No-send draft. All sections marked **[CONFIRM]** require Ahmad input before any submission.
**Owner:** Cowork (revenue-first ordering, Tier 3/4).

## 2026-06-16 update — INSURANCE LANE KILLED + RESUME LOCKS

Per Ahmad 2026-06-16: **IIS has no insurance policies in force yet.** This rules out any bid scope requiring on-site work, implementation work that triggers liability, or CGL/E&O carriage as a mandatory criterion. Bid posture shifts to **advisory + methodology + remote-only delivery** until insurance is in place.

Resume (`Ahmad Wasee_AI Engineer Resume.docx`) **locks** the following Section 1 fields that were [CONFIRM] before:
- **NAICS codes:** 541510–541519 (REGISTERED)
- **GSIN codes:** D302A–D399A (REGISTERED)
- **PBN:** ACTIVE
- **Federal + provincial procurement profile:** REGISTERED
- **Headquarters:** Whitby, ON, Canada
- **Contact:** Ahmad Wasee · +1 (647) 581-3182 · ahmadwasi456@gmail.com (personal) / ahmad.wasee@iisupp.net (IIS identity)

Section 1 [CONFIRM] items remaining: Business Number, GST/HST number, security clearance level (resume implies none currently).

---

## Section 1 — Vendor Identity Block

Standard top-of-response identifier block. Reused across federal bids.

| Field | Value |
|---|---|
| Legal name | Integrated IT Support Inc. |
| Operating name | IIS / Integrated IT Support |
| Jurisdiction | Ontario, Canada **[CONFIRM corporate seat]** |
| Business Number (BN) | **[CONFIRM with Ahmad — needed for every federal bid]** |
| GST/HST number | **[CONFIRM]** |
| Procurement Business Number (PBN) | **[CONFIRM — register at SRI if missing]** |
| Supplier Registration (SRI) | **[CONFIRM enrolled — required for CanadaBuys/Ariba]** |
| Headquartered | Toronto / GTA, ON **[CONFIRM exact municipal address]** |
| Primary contact | Ahmad Wasee, Founder |
| Contact email | ahmad.wasee@iisupp.net |
| Website | https://iisupp.net |
| Security clearance level held | **[CONFIRM — none / Reliability / Secret. Many federal bids require Reliability minimum.]** |
| CCC clearance | **[CONFIRM — Controlled Goods Program: not applicable unless dual-use]** |
| OCIO Supply Arrangement | **[CONFIRM membership status — PSPC's SA-PSC, TBIPS, etc.]** |

> **Action for Ahmad:** confirm these 8 [CONFIRM] items. Without them, federal bids cannot be submitted. Cowork can register SRI / PBN on Ahmad's behalf only if explicitly authorized; security clearance must be sponsored.

---

## Section 2 — Federal-Procurement Service Lanes (extends Core Services)

The public-safe v06-06 capability statement covers M365 + AI Readiness, AI Service Desk Starter, Fractional IT Direction, Website Rescue, Workflow Automation. Federal bids ask for these additional explicit lanes:

### 2.1 Cybersecurity Readiness & Incident Response Tabletops

**Direct fit for:** OSFI Ransomware Tabletop Exercise (cb-553-91017696).

- Ransomware-readiness tabletop facilitation (4–8 hour scenario walk-throughs).
- Incident response runbook authoring + dry-run.
- Post-exercise after-action report with remediation backlog.
- Coordination with client cyber insurance / legal / privacy officer.
- Optional: ARIA-backed decision logs and escalation-path documentation (differentiator).

**Cited capabilities (memory-derived, internally validated):**
- AROC operational-state coverage of 71 IT incident classes (`project_symbolic_state_dictionary_v1`).
- Bit-native KB with documented escalation triggers per state (`feedback_kb_bit_native_style`).
- Audit-agent gating model for ARIA Phase A package (`project_aria_phase_a_package`) — same pattern documents human-in-the-loop control for incident-response decision capture.

### 2.2 Responsible-AI Implementation Support

**Direct fit for:** PSPC AI Source List (WS4286933967, deadline 2026-09-30).

- Algorithmic Impact Assessment (AIA) input preparation.
- Human-oversight design + decision-point documentation.
- Data-exposure controls + retention policy.
- Output monitoring + drift detection planning.
- User training + AI-assisted-but-human-accountable workflows.
- Coordination with Anthropic Claude Services Partner channel (per `project_anthropic_partner_pivot` — bundled passthrough margin model).

### 2.3 Managed Remote L1–L3 IT Support (offshore-capable)

**Direct fit for:** general SSC / OCIO support arrangements and any L1–L3 staff-augmentation tender.

- Tier 1 ticket intake + first-line resolution (target: 60% first-touch close).
- Tier 2 escalations: M365, identity, endpoint, network basics.
- Tier 3 architecture: AAD/Entra, GPO, hybrid identity, M365 governance.
- Offshore delivery model planning (`project_iis_standing_mission_lead_hunting` — offshore L1-L3 strategy).
- ARIA augmentation for triage + KB retrieval (positions IIS as AI-native operator, not legacy MSP).

---

## Section 3 — Federal-Eligibility Posture (REVISED 2026-06-16 — no insurance, remote-only)

**Key constraint:** IIS has no insurance policies in force as of 2026-06-16. This eliminates any bid lane that hard-requires CGL/E&O/Cyber liability or WSIB clearance. IIS bids only on opportunities that:
- Are deliverable fully remotely (no on-site = no WSIB trigger).
- Are advisory / methodology / documentation (not implementation that triggers liability claims).
- Treat insurance as optional or post-award-only.
- Have a project value low enough that insurance isn't a mandatory prequalifier (federal often waives below ~CAD $25K; many under-band engagements skip).

| Requirement | IIS position 2026-06-16 |
|---|---|
| Corporate insurance (CGL ≥ $5M) | **Not in force.** Bids requiring this = SKIP. |
| Errors & Omissions (≥ $2M) | **Not in force.** Bids requiring this = SKIP. |
| Cyber liability insurance | **Not in force.** Bids requiring this = SKIP. |
| Workers' Compensation (WSIB Ontario) | Not required for fully-remote services. Confirm bid is remote-only. |
| Tax compliance (federal + provincial) | **[CONFIRM current status with Ahmad's accountant]** — free certificates, achievable in 1-2 days. |
| Integrity Regime declaration | Sign at bid time. No cost. |
| Conflict-of-interest declaration | Sign at bid time. No cost. |
| Past-performance evidence (≥ 3 engagements in 5 years) | **FILLED 2026-06-16** — see `past-performance-FILLED-2026-06-16.md` (IIS/ARIA, RBC Capital Markets, Ontario Health). |
| Bonded / surety capacity | N/A for services. |
| Accessibility statement (per ATIPP / Web Standards) | iisupp.net visual-stability rule aligned. OK. |
| NAICS / GSIN / PBN | **CONFIRMED ACTIVE per resume.** NAICS 541510-541519. GSIN D302A-D399A. |
| Security clearance | **None held.** Bids requiring Reliability / Secret = SKIP for now. |

### Bid filter (apply before any new bid is taken seriously)

For every CanadaBuys / MERX / Ontario Tenders opportunity:

1. **Does it require insurance certificates at submission?** If yes → SKIP until IIS has insurance.
2. **Does it require security clearance (Reliability / Secret)?** If yes → SKIP until cleared (sponsor required).
3. **Is it remote-deliverable?** If no → SKIP.
4. **Is it advisory / methodology / documentation in scope?** If yes → BID.
5. **Is project value low enough that insurance is waived?** Some federal under-band engagements skip insurance — confirm per SOW.

OSFI Ransomware Tabletop, PSPC AI Source List = both filter through cleanly as remote advisory work. Continue both lanes.

---

## Section 4 — Past Performance Statement **[CONFIRM, Ahmad-only]**

Federal bids require at least three documented past engagements. Cowork has no source-of-truth list for IIS's actual client history. Ahmad must populate:

```
Engagement 1: [Client] | [Period] | [Scope: M365 / AI / Support / Website] | [Value range] | [Reference contact OK? Y/N]
Engagement 2: ...
Engagement 3: ...
```

> **Without this, OSFI Ransomware Tabletop bid is methodology-only — viable but weaker.** PSPC AI Source List has banded thresholds (Band 1 ≤ CAD 1M, Band 2 ≤ CAD 4M, Band 3 ≤ CAD 37.5M) — IIS targets honestly-supportable Band 1 entry, upgrade later.

---

## Section 5 — Anthropic Claude Services Partner Differentiator

**For PSPC AI Source List + any AI-implementation bid.**

- IIS is positioned as Anthropic Claude Services Partner (per `project_anthropic_partner_pivot`).
- Bundled passthrough + service-fee model = 90–96% margin retained on AI delivery work.
- Federal departments can buy AI implementation services through IIS without procuring Anthropic directly.
- Reduces buyer-side procurement friction (single-vendor billing, single-vendor accountability).
- Application + SOW + sales materials staged at `outputs/anthropic-partner/`. **[CONFIRM submission status — memory says "submits Monday" 2026-05-26-ish, verify with Ahmad whether Anthropic has confirmed acceptance.]**

---

## Section 6 — ARIA as a Differentiator (Federal-Safe Framing)

Federal procurement is wary of unsupported AI claims. Public-safe ARIA language:

> "IIS operates ARIA, an internal AI-assisted support engine that retrieves bit-native knowledge with human-in-the-loop verification, documents every decision step in an audit log, and gates every action behind operator approval. ARIA is used to improve IIS's own delivery quality and is available to federal clients as a transparency / decision-capture tool inside scoped engagements, never as an autonomous decision-maker."

**Avoid in federal bids until Ahmad approves evidence:**
- Specific accuracy metrics (e.g., "99.5% accuracy" — not measured).
- Comparison to vendor products by name (e.g., "outperforms ServiceNow").
- "Autonomous AI" or "agentic" language without the human-oversight caveat.
- Any claim implying ARIA is a regulated/certified product.

---

## Section 7 — Pricing Posture for Federal Bids

Default: do not publish rate cards in capability documents. Provide pricing only inside the official bid pricing schedule per RFP instructions.

Approved ranges (memory: ARIA monetization packages + Growth Library product engine):

- Cybersecurity tabletop (1-day facilitation + report): CAD $8,000–$15,000 per engagement **[CONFIRM]**
- AI implementation discovery + roadmap: CAD $12,000–$30,000 **[CONFIRM]**
- Managed Remote L1–L3 (per-seat / month): CAD $35–$95 per seat **[CONFIRM]**
- ARIA-augmented service desk (monthly retainer): CAD $1,500–$5,000 / month **[CONFIRM]**
- Fractional IT Director (monthly): CAD $3,500–$8,500 / month **[CONFIRM]**

> All ranges subject to Ahmad's final pricing decision per bid. Cowork does not commit pricing externally.

---

## Section 8 — Bid-Response Skeleton (reusable across federal opps)

Standard section order federal RFPs expect (use as IIS template):

1. Cover letter (1 page, signed)
2. Executive summary (1–2 pages)
3. Mandatory criteria response (point-by-point)
4. Rated criteria response (point-by-point with evidence)
5. Past performance (3 engagements minimum, evaluator-friendly format)
6. Methodology / approach (3–6 pages)
7. Resource plan + key personnel CVs (Ahmad's CV minimum)
8. Pricing schedule (per RFP form)
9. Mandatory annexes (security, integrity, COI, accessibility, etc.)
10. References (typically 3, prior-client contacts)

> Cowork will pre-template sections 2, 4, 6, 8 on per-bid basis from this supplement. Sections 5, 7 (past performance, Ahmad CV) require Ahmad to populate the first time, then reuse.

---

## Approval checklist for Ahmad (REVISED 2026-06-16)

1. Confirm remaining Section 1 vendor IDs: Business Number, GST/HST.
2. Confirm tax compliance certificates current (CRA + ON Ministry of Finance — free, 1-2 days).
3. **REVIEW + APPROVE pre-filled past-performance** in `past-performance-FILLED-2026-06-16.md` (RBC, Ontario Health, IIS/ARIA already drafted from resume — biggest unblock is done; Ahmad confirms reference-contact posture).
4. Confirm Anthropic Partner submission status (unresolved per `verification-findings-2026-06-16.md`).
5. Confirm pricing ranges in Section 7.
6. Approve ARIA framing in Section 6.

Insurance/WSIB items REMOVED — IIS confirms no policies in force. Bids filtered to remote-only advisory/methodology lanes that don't trigger insurance prerequisites.

Once these six are confirmed, IIS has a reusable federal-bid response asset and OSFI / PSPC bids ship.

## Stop rules

- No submission of this document anywhere.
- No registration of SRI / PBN / Reliability clearance without Ahmad approval.
- No claim of past performance not confirmed by Ahmad.
- No price quoted externally without Ahmad approval.
- This file lives local-only in `senior-director-state/` — not published to iisupp.net.

## One-line summary

> Federal bids need 8 vendor IDs, 9 insurance/tax confirmations, 3 past engagements, pricing approval, and an ARIA framing OK. Cowork has staged everything else. Ahmad fills the [CONFIRM] gaps once → OSFI + PSPC + future federal bids all reuse this asset.
