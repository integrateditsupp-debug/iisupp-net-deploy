# Approval Batch A — Cowork Audit Addendum (2026-06-16)

**Companion to:** `2026-06-16-batch-A.md` (the main decision page).
**Purpose:** narrow the risk profile on Lane 3 + Lane 4 rows after Cowork verification work this afternoon.
**Owner:** Claude Cowork.
**Status:** advisory only — the main batch file is still the decision capture.

---

## Why this exists

The main batch file marked several Lane 3 / Lane 4 rows "preview before publish" because they touch existing visible pages. That visual-risk flag still stands. But I separately audited the claim surface of those rows for federal-evaluator credibility. Those results sharpen the deferral decision: some "preview before publish" rows are CLAIM-safe, others are CLAIM-risk.

Two different categories of risk, often conflated:

- **Visual risk** — does it break the IIS look? Eyeball-the-preview question.
- **Claim risk** — does it introduce statements that conflict with federal-safe positioning? Federal-credibility question.

A row can be visual-risk but claim-safe (publish after eyeball, no extra concern). A row can be claim-risk regardless of visual change (must rewrite, not just preview).

---

## Lane 3 row-by-row recheck

| # | Slice | Visual risk | Claim risk | Cowork-revised guidance |
|---|---|---|---|---|
| C1 | ARIA deployment-paths panel | LOW (additive) | NONE | Publish (no change from main batch) |
| C2 | Start Here conversion | LOW | NONE | Publish |
| C3 | Services fit deliverable | LOW | NONE | Publish |
| C4 | Product route-back | LOW | NONE | Publish |
| C5 | Overflow conversion (growth-library + shop) | LOW | NONE | Publish |
| C6 | Operations conversion | LOW | NONE | Publish |
| C7 | (deferred — Growth Library re-read) | n/a | unknown | Hold until re-read |
| C8 | Marketplace bridge | MED (visual sweep needed) | **NONE — VERIFIED CLEAN** | Publish after visual preview only. Marketplace.html explicitly carries "transparent bridge model" + "no fake partnership claims" + "20% admin fee disclosed" — federally credible language already. |

**Marketplace verification source:** grep of `marketplace.html` returned zero matches on `24/7`, `autonomous`, `replaces`, `deflects`. Returned positive matches on `avoid fake partnership claims` (line 366) and `clearly disclosed 20% admin/curation fee` (line 283). The page actively models the anti-overclaim posture.

---

## Lane 4 row-by-row recheck

| # | Slice | Visual risk | Claim risk | Cowork-revised guidance |
|---|---|---|---|---|
| 25 | Homepage proof shelf | **HIGH** (index.html hero region) | **HIGH** — but separately surfaced by `public-claim-conflicts-cross-page-extension-2026-06-16.md` Findings 7–11 on lines that overlap with the proof-shelf area | Decoupled recommendation: bundle this slice with the Track A 16-finding copy-only PR rather than approving it standalone. Same `index.html` file touched in both. |
| 26 | Contact route reassurance | LOW-MED | NONE | Publish after eyeball |
| 27 | AI Edge preview path | HIGH (touches index hero + 4 other pages) | **NONE — VERIFIED CLEAN** | Publish after visual preview only. ai-edge.html itself is claim-safe; the only concern is the visual integration with existing hero copy on index/services/growth-library/shop/start-here. |

**AI Edge verification source:** grep of `ai-edge.html` returned zero matches on autonomy patterns. The page is `Free → Practical → Premium` honest framing.

---

## Net effect on Ahmad's decision math

The main batch file's one-line recommend said: "publish Lane 1 today, publish all 15 Lane 2 in one Netlify deploy, send Lanes 3 + 4 to preview, glance, then decide."

After this addendum:

- **Lane 3 collapses to 7 publishable rows** (C1–C6 + C8) after a single visual preview pass — none have claim risk.
- **Lane 4 splits:** row 26 (contact reassurance) is a fast publish. Row 25 (homepage proof shelf) is best **bundled with the Track A 16-finding copy-only PR**, not approved standalone — they touch the same `index.html` region. Row 27 (AI Edge) is visual-eyeball only.
- **Track A 16-finding copy-only PR is now the single highest-leverage merge of the week** — it lands the federal-credibility delta on `aria.html`, `index.html`, `m.html`, `commercial-real-estate.html`, `index-cmdline-preview.html` in one commit, and can absorb the homepage proof-shelf slice in the same PR.

**Updated one-line:**

> **Lane 1 publish today.** **Lane 2 bundle Netlify deploy.** **Lane 3 preview pass: publish C1–C6 + C8 same window.** **Track A 16-finding copy-only PR absorbs row 25 (homepage proof shelf) — single biggest federal-credibility merge available.** **Row 27 (AI Edge) visual-eyeball before approve.** **C7 + row 28 + row 29 stay deferred.**

Backlog after this batch: 29 → ~3 rows (the three deferred items) + the Track A PR landing as a separate merge.

---

## Stop rules

- This addendum does not replace the main batch — it sharpens it.
- No publish action triggered by this file.
- Visual preview still required on every Lane 3 + Lane 4 row before publish, even when claim risk = NONE.
- Track A 16-finding PR still requires Ahmad to pick the 16 alts before Codex applies them.
