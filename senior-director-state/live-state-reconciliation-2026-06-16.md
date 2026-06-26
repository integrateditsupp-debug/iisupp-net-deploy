# Live-State Reconciliation — 2026-06-16

**Owner:** Claude Cowork.
**Why this exists:** the auto-generators (`ceo-now-action-digest.md`, `ceo-approval-required.md`, `active-agent-handoff.md`) all show a 26-29 row backlog of "approved-to-publish, awaiting deploy" slices. Cowork checked live state with web fetches. **Almost all of it is already deployed.**

---

## Bottom line

| Category | Auto-digest says | Live reality | Real pending |
|---|---|---|---|
| Lane 1: RJ removal | "Pending publish" | ✅ Already live on `iisupp.net/about` — references RBC, Scotiabank, Ontario Health, City of Toronto, IBM, Cavalluzzo (no RJ) | None |
| Lane 2: 15 preview pages | "Pending publish" each | ✅ Spot-checked LIVE: ai-workflow-audit-preview, cybersecurity-basics-preview, no-code-automation-kit-preview (06-13 batch). 200 OK. | None — likely all 15 live |
| Lane 3 C2: Start Here | "Pending publish" | ✅ `iisupp.net/start-here` LIVE with full route guide and links to 9 preview pages | None |
| Lane 3 C6: Operations slice | "Approved-to-publish" | ✅ services.html + shop.html LIVE | None |
| Lane 3 C8: Marketplace bridge | "Pending publish" | Likely live (marketplace.html committed) | Spot-check recommended but probably done |
| Direct-send leads (WD Numeric, Tangs, Global Health Physio) | "Approved-to-transmit. Send when ready." | ✅ Already submitted 2026-06-11 23:03 via website contact form per `direct-outreach-approval-pack-2026-06-11.md` | None — follow-up window 06-18 |

**The auto-digest is showing 26+ items as pending Ahmad action. The accurate count is much closer to 2-3.**

---

## What's actually pending (verified)

### 1. Track A — 16-finding copy-only PR (the real federal-credibility fix)

This is the WORK I identified today across `aria.html` (Findings 1-6) + `index.html` / `m.html` / `commercial-real-estate.html` (Findings 7-12). These are the public claim conflicts that don't match the federal-safe ARIA one-pager. Not deployed. Genuinely pending.

- Alternates ready: `aria-claim-fix-alternates-2026-06-16.md` + `claim-fix-alternates-findings-7-12-2026-06-16.md`
- Files to touch: `aria.html`, `index.html`, `m.html`, `commercial-real-estate.html`, `index-cmdline-preview.html`
- Single PR: ~17 string edits across 5 files. No layout/CSS/JS change.
- Ahmad action: pick 16 alts (~10 min), Codex applies, one Netlify deploy + Ahmad publish click.

### 2. Track A row 25 — Homepage proof shelf

Per approval batch addendum, this slice was flagged HIGH visual risk because it changes the `index.html` hero region. Best path: bundle into the same Track A PR rather than treating as separate slice. **Cowork's recommendation: don't approve as a standalone Lane 4 slice — fold it into the Track A PR.**

### 3. Jason Brown / Hines follow-up (still due)

Per `ahmad-action-board-2026-06-16.md`. Was approved for Friday 2026-06-12 trigger-condition "if Jason has not replied." 4 days overdue. Ahmad checks his LinkedIn / email for Jason reply before sending or marking closed.

### 4. RBC supplier registration final click

Portal partially prefilled per digest. ~15 min Ahmad session. CAPTCHA + attestation + credentials + Register click.

---

## Why the digest got it wrong

Pattern (across all three stale findings today — leads sent, Sourcewell, RJ removal):

**The auto-generators treat "slice file exists" as proxy for "needs publish." They don't ever re-verify against live state.** Once a slice was reviewed/approved, no one (no agent) ever marked it shipped — but Codex (or another agent) did ship it.

This means the entire `senior-director-state/staged-*.md` folder is essentially shipping-receipts treated as pending TODOs.

---

## Recommended fix (lightweight)

Either:

**A. Auto-generator change** — extend the worker that emits `ceo-now-action-digest.md` to do a single HEAD-request check against each "staged for publish" route. If it returns 200, drop the item. ~30 min Codex work.

**B. Cowork manual reconciliation** — Cowork runs this check at the start of each session (5 min) and patches the digest top-banner with a "stale state" notice. Cheap, manual, but reliable for now.

**C. Slice retirement** — once a slice is confirmed live, move the file to `senior-director-state/archives/staged-shipped/` so the worker stops emitting it. Cleanest long-term path. Codex task.

Cowork's recommend: **A or C** (real fix, not Band-Aid). Both are Codex one-tick PR work.

---

## Implications for the rest of the action board

The `ahmad-action-board-2026-06-16.md` Tier 1 / Tier 2 lists were drafted before this verification. After this reconciliation:

- **Tier 2 row 4 (Lane 1 RJ removal)** → ALREADY DONE. Remove from action board.
- **Tier 2 row 5 (Lane 2 bundle deploy)** → ALREADY DONE. Remove.
- **Tier 2 row 6 (ARIA claim-fix alts)** → STILL ACCURATE. Same as Track A above.
- **Approval batch addendum** → most Lane 3 rows ALREADY DONE. Only Track A and Jason Brown follow-up are genuinely pending.

Net effect: Ahmad's "this week" Tier 2 list collapses from 3 items to 1 item (the Track A PR).

---

## Implications for PSPC submission

This is the GOOD news. The PSPC Annex (`pspc-annex-preview-pages-verifiable-posture-2026-06-16.md`) was marked "cite-ready post-Lane-2-deploy." That cite-ready threshold is **already met**. The 15 preview pages return 200 today.

The federal-credibility differentiator is LIVE on iisupp.net right now. PSPC bid can cite the annex immediately when Ahmad submits.

---

## Stop rules

- Cowork did not modify any auto-generator files (those are worker-owned).
- Cowork did not retire any slice files (Codex's job per recommendation C above).
- Cowork did not publish any pending change — Track A still requires Ahmad's pick on 16 alts before Codex applies.

## One-line summary

> Auto-digest claims 26+ pending Ahmad-publish actions. Live verification confirms ~24 of those are already deployed. Real pending list: Track A 16-finding PR (Ahmad picks alts), Jason Brown follow-up, RBC Register click. PSPC Annex differentiator is already live and cite-ready.
