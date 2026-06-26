# Claude Strategy-Loop Critique — 2026-06-16

**Loop:** `claude-strategy-loop` (priority 82). Owner: Claude Cowork.
**Triggered by:** `senior-director-state/loop-engineer/claude-next-prompt.md` (continue).
**Consumers:** Codex (returns 2026-06-17) and Claude Code (active now, per `feedback_codex_offline_route_claude_code.md`).
**Inputs read:** `loop-board.md`, `claude-next-prompt.md`, `claude-code-next-prompt.md`, `codex-claude-queue.md` (head), `active-agent-handoff.md` (head), `senior-director-state/trend-radar/{trend-radar,review-queue}.json` + summary, last critique 2026-05-14, project + feedback memories.

---

## Ground truth this tick

- Trend Radar already emits **100 scored trend records** and **400 review-queue items** (product / content / demo / aria_kb_pending_bit × 100). All status = `Needs review` or `pending`. **80 risk-flagged** (68 security-accuracy, 4 child-safety, 4 finance-claim, 4 health-claim). Top scores cluster at 76/100 (M365 automation, workflow automation, customer-support automation, Power Automate).
- `active-agent-handoff.md` lists **26+ staged previews waiting on Ahmad** for approve/hold. Generation is outpacing review by ~10×. This is the real bottleneck, not packet supply.
- `claude-code-next-prompt.md` PACKET A (symbolic-dict wiring) + PACKET B (phased response) are **still pending** from the 05-14 critique. ARIA UX quality is therefore unchanged in 33 days.
- Codex returns tomorrow 2026-06-17. Today is Claude Code's last solo day.

## Active-loop critique (one line each)

1. **trend-radar-loop (95)** — Generation works, review can't keep up. Dashboard must be a **top-20 triage view ranked by `total × (1 − risk_score/10)`**, not a flat 400-row table. Risk-flagged categories (child / health / finance) need a separate quarantine tab — never mixed in.
2. **product-pack-loop (92)** — "First 9 product plans" is correct, **but exclude any trend with `risk_flags.length > 0`** from this loop entirely. They go through a separate compliance lane or get killed.
3. **aria-behavior-loop (90)** — Highest user-felt impact and still unshipped 33 days later. **Phased response (PACKET B) overtakes everything this tick.** This is the loop that loses Ahmad customers in demos.
4. **website-conversion-loop (86)** — Producing slices faster than Ahmad can decide. Stop generating new slices until the **26+ existing ones are batch-decided.** Build the decision instrument, not more inventory.
5. **revenue-opportunity-loop (84)** — Healthy. WD Numeric / Tangs / Global Health still waiting on Ahmad send action. No change.
6. **claude-strategy-loop (82)** — This file is the output. Per-tick critique cadence: ship a fresh critique any time `claude-next-prompt.md` is touched or `loop-board.md` drifts >7 days.
7. **qa-safety-loop (80)** — Should be a pre-commit gate, not a parallel loop. Wire it into `codex-build-loop` output review.
8. **codex-build-loop (78)** — Will resume tomorrow. Today, Claude Code is the implementer. Same packet discipline applies.

## What we are NOT doing this tick (and why)

- **Not** wiring symbolic dictionary (former PACKET A). Regex false-match risk is real (the "out → ooo" history). Phased response delivers more user value with less risk. Push dict-wiring to next tick.
- **Not** publishing any of the 26 staged slices unilaterally. Approval gate is real.
- **Not** generating new trend records. We have 100 unreviewed already.

---

## Best next 3 packets

### PACKET 1 — Trend Radar triage dashboard (top-priority loop, ships clean)

**Why now:** Highest-priority active loop. 400 items already exist; without a dashboard they rot. This unblocks product-pack-loop's "first 9" selection by making top-scored / low-risk trends visible to Ahmad in one screen.

**Behavior:**
- Default view = **top 20** by `score.total × (1 − score.risk_score / 10)`, where `risk_flags.length === 0`.
- Tabs: `Top 20` · `All (filterable)` · `Risk Quarantine` (anything with `risk_flags`).
- Hide `aria_kb_pending_bit` type by default — those are ARIA-internal, not product candidates.
- One-click per row: `Approve product slice` · `Defer` · `Kill`. Mutates `senior-director-state/trend-radar/review-queue.json` in place. No external call.
- Export CSV (filtered view only).

**Files to touch:**
- New: `trend-radar-admin.html` — utilitarian admin chrome; **do not import aria-core.css or any iisupp.net theme** (per `feedback_visual_stability.md`).
- New: `assets/trend-radar-admin.js` — table renderer, sort, filter, decision capture.
- New: `netlify/functions/trend-radar-decision.mjs` — POST `{id, decision, ts, who}` → appends to `senior-director-state/trend-radar/decision-log.jsonl` and updates the matching item's `review_status` in `review-queue.json`. Uses repo write via existing PAT path documented in `skill_autonomous_push.md` (no new secret needed).
- `netlify.toml` — Basic Auth on `/trend-radar-admin*` via Edge Function reading `TREND_ADMIN_USER` / `TREND_ADMIN_PASS` env vars (Ahmad sets in Netlify UI — **no hardcoding**).
- `robots.txt` (or a meta) — `noindex` for `/trend-radar-admin.html`.

**Risks:**
- Auth bypass: if env vars missing, deny by default (HTTP 503, not open access).
- Decision-log race: append-only JSONL avoids merge conflicts; update review-queue.json under a per-process lock or just rewrite the matching item.
- Visual regression on iisupp.net: page must be totally outside the premium aesthetic. Confirm `aria-core.*` is NOT imported.

**Approval gates:**
- Netlify preview deploy first.
- Ahmad sets `TREND_ADMIN_USER` / `TREND_ADMIN_PASS` BEFORE production publish.
- Aperture login + ARIA functions verified unchanged after deploy (`feedback_aperture_aria_never_break.md`).

**Recommended next prompt (Codex or Claude Code):**
> Build `trend-radar-admin.html` + `assets/trend-radar-admin.js` + `netlify/functions/trend-radar-decision.mjs`. Read `senior-director-state/trend-radar/trend-radar.json` and `review-queue.json`. Default tab = Top 20 ranked by `score.total × (1 − score.risk_score/10)`, `risk_flags.length===0`. Hide `aria_kb_pending_bit` rows from default. Risk Quarantine tab shows only `risk_flags.length>0`. Per-row buttons: Approve / Defer / Kill → POST to the decision function, which appends `decision-log.jsonl` and patches the queue item's `review_status`. CSV export of current filter. Basic-Auth Edge Function on `/trend-radar-admin*` reading env vars `TREND_ADMIN_USER` / `TREND_ADMIN_PASS`. `noindex`, NOT linked from main nav. **Do not import `aria-core.css` or any iisupp.net theme stylesheet.** Branch `kb-agent/F-trend-radar-dashboard`. PR with `[ccode] PACKET 1: trend-radar dashboard`. Preview deploy only; do not publish without Ahmad.

---

### PACKET 2 — Phased Response patch (aria-behavior-loop, 33-day overdue)

**Why now:** Pending since 2026-05-14. ARIA still dumps walls of text on ambiguous queries. This is the single biggest UX defect a paying buyer would feel in a demo. Symbolic dictionary is already in repo (`aria-architecture/symbolic-state-dictionary-v1.json`) — Phased Response can read `clarify_q` from it without first wiring the full dict into research (decouple from former PACKET A).

**Workflow:**
1. `operationalStateOf(text)` → state + confidence.
2. `confidence ≥ 0.85` → current behavior (recipe directly).
3. `0.60 ≤ confidence < 0.85` → ask ONE `clarify_q` from the dictionary entry; capture next user message; serve matching sub-chunk only.
4. `confidence < 0.60` → existing first-principles reasoner path (`project_aria_first_principles_reasoner.md`); no regression.
5. Any new user message cancels a pending phased prompt (`maybeInjectThinkAloud` must not stack).

**Files to touch:**
- `aria-architecture/symbolic-state-dictionary-v1.json` — schema v1.1: add optional `clarify_q` per state (no breaking change; entries without it skip phased step).
- New: `assets/aria-phased-response.js` — exports `phasedRespond(state, userText, history) → { kind: 'question' | 'steps', text }`.
- `assets/aria-v04-ext.js` — extend `handleUserMessage` to call the module per workflow above.
- `aria.html` — confirm cancel-on-new-message wiring; no visual change.

**Test matrix (must pass before publish):**
| Input | Expected | Why |
|---|---|---|
| "outlook stuck" | phased: asks attachment Q | mid-confidence M365.OUTLOOK.OUTBOX |
| "my pc is out of space" | unphased recipe | high-confidence DISK.FULL |
| "set ooo" | unphased recipe | high-confidence M365.OUTLOOK.OOO |
| "camera in use by another app" | phased | mid-confidence CAM.LOCKED.BY.APP |
| random gibberish | first-principles path | confidence < 0.60 |
| **regression**: any prior happy-path scenario from `project_aria_test_results_2026_05_15.md` | identical output | no behavior change above 0.85 |

**Risks:**
- Regression on confident states (existing happy-path users get unwanted questions). Mitigation: phased gate is `confidence < 0.85` only. Add automated regression assertions for the 6 known-passing scenarios.
- TTS double-fire in voice mode. Mitigation: cancel any pending utterance on new message (`feedback_aria_never_regress.md`).

**Approval gates:**
- Netlify preview deploy first.
- Ahmad UX review on 3 phased queries before production publish.
- Aperture + ARIA unchanged post-deploy (`feedback_aperture_aria_never_break.md`).

**Recommended next prompt:**
> Implement phased response. Extend `aria-architecture/symbolic-state-dictionary-v1.json` schema to v1.1 with optional `clarify_q` field per state — backfill clarify questions for the 8 mid-confidence states (M365.OUTLOOK.OUTBOX, CAM.LOCKED.BY.APP, AUT.SSO.LOOP, VPN.SLOW, CLOCK.DRIFT, PRINT.QUEUE.STUCK, NET.DNS.RESOLVE, AUD.NO.OUTPUT). Build `assets/aria-phased-response.js` exporting `phasedRespond(state, userText, history)`. Wire into `assets/aria-v04-ext.js` `handleUserMessage` with the four-branch confidence ladder (≥0.85 direct, 0.60–0.85 phased, <0.60 first-principles). Confirm `aria.html` cancel-on-new-message. Add tests for the 5-row table above plus the 6 regression scenarios from `project_aria_test_results_2026_05_15.md`. Branch `kb-agent/B-phased-response`. PR with `[ccode] PACKET 2: phased response`. Preview deploy. Do not publish without Ahmad UX review.

---

### PACKET 3 — Staged-slice approval batch instrument (clears the 26+ backlog)

**Why now:** Generation has outrun review. 26+ `senior-director-state/staged-*.md` files sit in `active-agent-handoff.md` waiting on Ahmad. Building more slices is wasted motion until these are decided. The fix isn't a dashboard — it's a **one-screen batch decision page** with diffs and a single capture file.

**Behavior:**
- `senior-director-state/approval-batches/2026-06-16-batch-A.md` (new) — table: slice name · file path · target route · "what publishes" (1 sentence) · current production state · risks · Ahmad decision column (initially blank).
- Pair file: `senior-director-state/approval-batches/decision-template.md` — Ahmad copies and writes Y/N/Defer per row, dates it, commits. Codex/Claude Code then processes published rows in order.
- Generator script: `scripts/build-approval-batch.mjs` — scans `active-agent-handoff.md` "Immediate Ahmad Actions Still Open" + grep for `staged-*-review-*.md`, emits the batch markdown.

**Files to touch:**
- New: `scripts/build-approval-batch.mjs`.
- New: `senior-director-state/approval-batches/2026-06-16-batch-A.md` (generator output).
- New: `senior-director-state/approval-batches/decision-template.md`.
- `senior-director-state/active-agent-handoff.md` — add pointer to current batch file at top of "Immediate Ahmad Actions Still Open."

**Risks:**
- Stale references: generator must skip slices whose target files are missing or whose route already published. Verify `git log` shows no deploy of that route since the slice file mtime.
- Visual regression in any approved slice: each row must include a "respects feedback_visual_stability.md? Y/N" column; if N, the row defaults to Defer.

**Approval gates:**
- This packet's output IS the approval instrument — it doesn't publish anything. Safe to land on `main` after PR review.
- No actual slice gets published from this packet. That happens in a follow-up tick after Ahmad fills the decisions file.

**Recommended next prompt:**
> Write `scripts/build-approval-batch.mjs`. Scan `senior-director-state/active-agent-handoff.md` "Immediate Ahmad Actions Still Open" section and `senior-director-state/` for `staged-*-review-*.md`. For each: extract slice name, target route, 1-sentence "what publishes", current prod state (best-effort grep of route in `index.html` / route files), risk flags (regex on slice file for "money", "claim", "stripe", "publish", "send"), and the `feedback_visual_stability.md` compatibility flag (Y if file has "no visual change" or "preview only"; N otherwise). Emit `senior-director-state/approval-batches/2026-06-16-batch-A.md` with one row per slice and a blank Ahmad-decision column. Also emit `senior-director-state/approval-batches/decision-template.md` (instructions for Ahmad). Update `active-agent-handoff.md` to point to the new batch file. Branch `claude/G-approval-batch`. PR with `[ccode] PACKET 3: approval batch instrument`. Lands on main after review — no public publish involved.

---

## Carry-forward state

- **Next tick:** when these 3 are merged, re-critique with fresh evidence. Likely next packets: (a) symbolic-dict wiring (former PACKET A, now lower urgency), (b) processing Ahmad-decided rows from the approval batch, (c) Trend Radar score-formula calibration pass once Ahmad has approved/killed ~40 items.
- **Stop rule confirmed:** no sends, no production publish without Ahmad, no external account creation, no payments.
- **Memory updates needed:** none this tick — the loop is operating on existing memory.

## Single-line summary for Ahmad

> Three packets queued — Trend Radar triage dashboard (top-20 triage, decision-logging), Phased Response patch (kills wall-of-text in ARIA, 33-day overdue), Approval Batch instrument (turns 26 pending slices into one 10-minute decision page). All local/preview-only, no Ahmad gate until UX review or batch decision.
