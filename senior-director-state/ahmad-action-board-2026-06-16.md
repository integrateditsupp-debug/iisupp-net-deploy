# Ahmad Action Board — 2026-06-16

**Built by:** Claude Cowork. Revenue-first ordering per `feedback_revenue_first_ordering.md`.
**Why this exists:** the auto-generators (`ceo-now-action-digest.md`, `ceo-approval-required.md`, `active-agent-handoff.md`) are repeating stale items. This file is the corrected, ranked source of truth for today.
**Refresh cadence:** rebuild any time a top-3 item changes state.

---

## 🟢 TIER 1 — Direct revenue, Ahmad-clicks-only (do today / this week)

### 1. Three lead follow-ups — window opens 2026-06-18 (2 days)

**STALE-STATE CORRECTION:** Auto-digest still lists WD Numeric, Tangs, Global Health Physio as "approved-to-transmit. Next live action is to send." Per `direct-outreach-approval-pack-2026-06-11.md` lines 13-16, **all three were transmitted via public website contact forms on 2026-06-11 23:03** and hit thank-you pages. They are SENT, not pending send. The auto-digest is wrong.

**Real next action:** 7-day follow-up window opens **2026-06-18**. Cowork has pre-drafted follow-ups below — Ahmad picks send / hold / tighten.

### 2. Jason Brown / Hines follow-up — PAST DUE

Approved for 2026-06-12 (Friday). Today is 06-16 — **4 days overdue.** Per checklist `hines-jason-brown-friday-send-checklist-2026-06-11.md`, the trigger condition was "if Jason has not replied first." If still unreplied, send today rather than waiting another cycle. If Jason replied, mark closed.

### 3. RBC supplier registration — Ahmad clicks Register

Per `ceo-now-action-digest.md`: portal partially prefilled with verified company/contact fields. Remaining steps = CAPTCHA + attestation choices + account credentials + final Register click. Single-session task, ~15 minutes. Opens enterprise supplier door — high optionality value.

---

## 🟡 TIER 2 — Conversion / compliance (this week)

### 4. Approval batch — publish Lane 1 (Raymond James removal) immediately

HARD RULE violation currently live on public site (`about.html`, `m.html`). Same-day publish, no Netlify preview needed. Slice file: `staged-enterprise-reference-compliance-review-2026-06-12.md`. Decision page: `senior-director-state/approval-batches/2026-06-16-batch-A.md`.

### 5. Approval batch — bundle 15 Lane 2 preview pages into one Netlify deploy

Pure additive proof-layer (downloads/library/*-preview.html). Zero visual risk to existing pages. 15 slices clear in one deploy + one verify. Drops backlog from 29 → ~13.

### 6. Pick ARIA public-claim alternates (5 findings × 3 alts)

File: `aria-claim-fix-alternates-2026-06-16.md`. Ahmad picks one per finding (~5 minutes). Codex applies as one copy-only commit. Federal procurement evaluators check vendor websites for claim parity with bid responses — this closes that gap before PSPC submission.

---

## 🟠 TIER 3 — Bid pipeline (this month)

### 7. Sourcewell — confirm DRAFT not submitted → no-bid → archive

Ahmad logged into portal now. Per `sourcewell-rfp061726-no-bid-recommendation-2026-06-16.md`: structural responsiveness gate fails (no 12-month-active regulated external engagement after RJ removal). Verify, close, archive.

### 8. PSPC AI Source List — 8 gates (no urgency, 09-30 deadline)

Cowork-side ~80% done. Ahmad gates: Anthropic Partner confirm · bilingual position · CRA + ON tax compliance letters · BN/GST-HST numbers · reference-contact permissions · pricing rate-range approval · subcontract bench names · SAP Ariba account access. None block other lanes; pace as needed.

### 9. OSFI Ransomware Tabletop — live SOW pull blocked

Per `verification-findings-2026-06-16.md` Finding 2: Nimble auth dead, Chrome MCP needs Ahmad at keyboard. 15-minute session to pull SOW unblocks the bid.

### 10. DND CFSMI — no-bid (locked out, deadline 06-23)

Confirmed no direct path. No action needed beyond noting decision in `bid-no-bid-june-12-canadabuys-tender-fit-reset.md` follow-up.

---

## 🔵 TIER 4 — Infrastructure (background)

### 11. DigitalOcean payment retry — scheduled June 30 3 PM ET

Auto-fires if app is open. Pre-approve Chrome MCP on the scheduled task by clicking "Run now" once before then = no permission-prompt interruption when it actually runs.

### 12. Netlify billing — same card 2661 issue

If card 2661 stays failing, Netlify suspends ~July 2. Either fix funding by then, swap to PayPal, or accept site-down risk.

### 13. OpenClaw OAuth — expired

Ahmad or signed-in desktop session refreshes auth. Low priority — deterministic fallback is active.

---

## 🟣 TIER 5 — Auto-improvement candidates (Cowork can do without Ahmad gate)

| # | Lane | Improvement | Cost | Risk | Status |
|---|---|---|---|---|---|
| AI-1 | Bids | OSFI cover letter pre-fill from generic SOW assumptions (replace post-pull) | $0 | None — replace before submit | not started |
| AI-2 | Content | Pre-draft 3 lead follow-ups (06-18 window) | $0 | None — Ahmad picks before send | **shipped below** |
| AI-3 | Strategy | "Stale-state audit" pattern — flag auto-digest drift in future ticks | $0 | None | partly done in this file |
| AI-4 | ARIA | Cross-page conflict scan beyond aria.html (services.html, growth-library.html, start-here.html) | $0 | None | per `aria-public-vs-federal-claim-conflicts-2026-06-16.md` follow-up |
| AI-5 | Risk | Audit the Federal Bid Supplement for any RJ refs that slipped through | $0 | None | not started |

---

## ✉️ Pre-drafted: 3 lead follow-ups (window: 2026-06-18 onward)

**Style:** Per `feedback_email_draft_style.md` — observe → imply → preview. No how, no price. Per `feedback_outbound_send_cadence.md` — group of 3 (under the 5-cap), 3-min intra-gap fine. All three can go through the same contact-form path used on 06-11, OR Ahmad sends from `ahmad.wasee@iisupp.net` if direct emails are available.

---

### Follow-up 1 — WD Numeric Corporate Services

**Subject:** Following up — short M365 admin review

**Body:**

Hi WD Numeric team,

Following up on the note I sent through your contact form last week about practical overlap on M365 admin and document-flow friction in finance operations work.

I imagine the next few weeks are heavy on month-end and year-end cycle work for a lot of your clients, and a quick admin review is the kind of thing that's hard to schedule mid-cycle but pays back fast if done before the next push.

Happy to send a one-page outline of what we'd look at first — no commitment, just so you can see whether the fit makes sense.

Regards,
Ahmad Wasee
Integrated IT Support Inc.
https://iisupp.net
(647) 581-3182

---

### Follow-up 2 — Tangs Accounting Services

**Subject:** Following up — one workflow improvement for payroll/intake

**Body:**

Hi Tangs team,

Following up on the note I sent through your contact form last week about practical overlap on bookkeeping and payroll workflow.

The reason I think this is worth a short conversation: small accounting firms tend to feel the same handful of repetitive tasks every cycle (client document chase, intake questions, payroll follow-up). Most of them can be tightened in a single focused sprint without touching the rest of how the firm operates.

Happy to send a one-page outline of the kind of workflow we'd scope first — no commitment, just so you can decide whether it lines up.

Regards,
Ahmad Wasee
Integrated IT Support Inc.
https://iisupp.net
(647) 581-3182

---

### Follow-up 3 — Global Health Physiotherapy Clinic

**Subject:** Following up — short patient-inquiry workflow note

**Body:**

Hi Global Health team,

Following up on the note I sent through your contact form last week about practical overlap on patient-inquiry and follow-up flow.

In clinics with active phone, text, and booking traffic, the same operational pattern usually shows up: a handful of repeated inquiry types that staff handle inconsistently. That's the spot where a focused workflow sprint tends to give back the most clinical hours per week.

Happy to send a one-page outline of what we'd look at first — no commitment, just so you can judge whether it's a fit.

Regards,
Ahmad Wasee
Integrated IT Support Inc.
https://iisupp.net
(647) 581-3182

---

## Action capture (for Ahmad to mark up inline)

| # | Item | Decision (Y / N / Defer) | Notes |
|---|---|---|---|
| 1a | Send WD Numeric follow-up 2026-06-18 | ___ | |
| 1b | Send Tangs follow-up 2026-06-18 | ___ | |
| 1c | Send Global Health follow-up 2026-06-18 | ___ | |
| 2 | Send Jason Brown / Hines follow-up today | ___ | |
| 3 | Click RBC Register | ___ | |
| 4 | Publish RJ removal slice | ___ | |
| 5 | Bundle-deploy 15 Lane 2 previews | ___ | |
| 6 | Pick ARIA claim alternates | ___ | |
| 7 | Sourcewell verify → no-bid → archive | ___ | |
| 8 | PSPC: confirm Anthropic Partner status | ___ | |
| 9 | OSFI live SOW pull session | ___ | |
| 11 | Pre-approve Chrome MCP on DO scheduled task | ___ | |

---

## Stop rules respected

- No sends triggered by this file. Drafts only.
- No publishes. All decisions Ahmad-gated.
- No memory writes that overstate state.
- This file does not replace the auto-generators — it corrects them. The worker will keep regenerating the digest from its own data; Cowork keeps re-flagging stale items each tick until the underlying data source is fixed.
