# Claude Strategy-Loop Critique — 2026-05-14

**Loop:** `claude-strategy-loop` (priority 82). Owner: Claude Cowork.
**Triggered by:** `claude-next-prompt.md`.
**Inputs read:** `docs/COLLAB_BRIEF.md`, `docs/LOOP-ENGINEER.md`, `loop-board.md`, `codex-claude-queue.md`, AROC law, Research-Agent law, bit-native KB style memory.

---

## Active-loop critique (one line each)

1. **trend-radar-loop (95)** — Dashboard build is correct next slice. Risk: dashboard ships but trend scoring formula isn't tightened first. Recommendation: dashboard reads scored JSON; do NOT publish or auto-promote trends to product-pack-loop without a manual review row.
2. **product-pack-loop (92)** — Draft product records are the right move. Risk: "first 9 product plans" must be reviewed by Ahmad before any pricing copy is rendered, or Stripe routes wired. Stay strictly local files.
3. **aria-behavior-loop (90)** — Highest user-facing leverage right now. Phased response (question-first, short answers) is THE quality blocker users feel. This should overtake trend-radar in priority for the next 48h.
4. **website-conversion-loop (86)** — Preview copy + route map is safe. Risk: any production-facing change to `aria.html` / `index.html` must pass qa-safety-loop AND respect `feedback_visual_stability.md` (no theme/color/layout changes without Ahmad).
5. **revenue-opportunity-loop (84)** — Carry-forward checklist work only. Approved-to-transmit leads (WD Numeric, Tangs Accounting, Global Health Physio) need Ahmad's manual send, no automation.
6. **claude-strategy-loop (82)** — This file IS the output. Per-tick critique format below.
7. **qa-safety-loop (80)** — Should be a precondition gate on every other loop's "next safe action," not a parallel loop. Recommend wiring it as a pre-commit hook on codex-build-loop output.
8. **codex-build-loop (78)** — Implementer loop; healthy. Should consume packets from claude-strategy-loop output (this file) without waiting for Ahmad.

---

## Best next 3 Codex packets

### PACKET 1 — Wire Symbolic State Dictionary into aria-research.mjs

**Why now:** I (kb-agent) just shipped `aria-architecture/symbolic-state-dictionary-v1.json` (51 net-new AROC codes). It's a JSON file, dead weight until Codex imports it. Wiring it doubles the research agent's pattern coverage (20 → 71 states) with zero new code logic — only an import + merge.

**Files to touch:**
- `netlify/functions/aria-research.mjs` — add `import dictV1 from '../../aria-architecture/symbolic-state-dictionary-v1.json' assert { type: 'json' };` then merge into STATE_PATTERNS and LIBRARY maps.
- `assets/aria-v04-ext.js` — mirror the same merge in the frontend STATE_PATTERNS so both layers agree (per `project_aria_research_agent_shipped.md`).

**Recipe steps source:** Each new state's `kb_ids` array points to bit-native KB chunks in `assets/aria-kb-local-bundle-v3.json`. At query time, pull the matching chunk's text and serve as the recipe. No invented recipes.

**Risks:**
- Frontend + backend regex mismatch → false-match like "out → ooo" issue from 2026-05-14. Use the same word-boundary discipline as the existing 20 states.
- AROC §6 compliance: every entry has `confidence` ≤ 0.89; surface caveat below 0.7.

**Approval gates:**
- Verify on staging first (a Netlify preview deploy) before production publish.
- Run the existing test matrix from `project_aria_research_agent_shipped.md` (out-of-space, computer-slow, set-OOO) — all must still pass.

**Recommended next prompt for Codex:**
> "Import `aria-architecture/symbolic-state-dictionary-v1.json` into `netlify/functions/aria-research.mjs`. Merge non-conflicting entries into STATE_PATTERNS and build LIBRARY recipes by pulling chunk text from `assets/aria-kb-local-bundle-v3.json` matched on each entry's kb_ids. Mirror the merge in `assets/aria-v04-ext.js` STATE_PATTERNS. Add tests for at least 5 new state codes (M365.OUTLOOK.OUTBOX, AUT.SSO.LOOP, CAM.LOCKED.BY.APP, VPN.SLOW, CLOCK.DRIFT). Verify the existing 20 states still match. Deploy as a Netlify preview, not production. Report state-coverage delta and any false-match risks."

---

### PACKET 2 — ARIA phased response patch (aria-behavior-loop deliverable)

**Why now:** This is the #1 user-experience complaint in ARIA testing logs. Users get walls of text before ARIA has asked the right diagnostic question. Bit-native KB + symbolic dictionary mean ARIA NOW has the granularity to ask one question at a time and pull a single bit instead of a full article.

**Files to touch:**
- `assets/aria-v04-ext.js` — extend `handleUserMessage` to: (1) classify symbolic state, (2) if confidence ≥ 0.8, ask the FIRST clarifying question from that state's chunk before serving steps, (3) if user replies with diagnostic detail, serve the matching sub-chunk only.
- `aria.html` — minor: ensure `maybeInjectThinkAloud` doesn't stack with phased prompts (cancel-on-new-message logic).
- New: `assets/aria-phased-response.js` — small module exposing `phasedRespond(state, userText)` that returns either a question or a step bundle.

**Recipe (bit-native answer style):**
```
ARIA: "Sounds like Outlook is stuck in your Outbox. Quick question: is the attachment over 25 MB?"
User: "I don't think so — it's a one-page Word doc."
ARIA: [serves the Outbox → Work Offline toggle bit from l1-outlook-004 — ONE chunk, ~280 chars]
```

vs current behavior:
```
ARIA: [dumps full article — 4,600 chars, 7 numbered steps, user reads nothing]
```

**Risks:**
- Behavioral regression: existing happy-path users who type "computer slow" expect a recipe, not a question. Solution: gate phased response to states where `confidence < 0.85` only.
- Topic-switch regression: phased state must clear on any new query (already wired per shipped code).

**Approval gates:**
- Preview deploy first.
- Test matrix: "outlook stuck" → asks attachment Q; "my pc is out of space" → recipe directly (high-confidence DISK.FULL stays unphased); "set ooo" → recipe directly.
- Ahmad reviews UX before production publish.

**Recommended next prompt for Codex:**
> "Implement phased response in `assets/aria-v04-ext.js`. Workflow: (1) detect symbolic state via existing operationalStateOf(text); (2) if no state OR confidence ≥ 0.85, current behavior unchanged; (3) if confidence 0.6-0.85, ask ONE clarifying question (defined per-state in `aria-architecture/symbolic-state-dictionary-v1.json` as a new optional field `clarify_q`); (4) on user reply, serve the matching sub-chunk from the v3 bundle. Build a small `aria-phased-response.js` module. Test cases: outlook stuck (phased), pc out of space (unphased), set OOO (unphased), camera in use (phased). Deploy preview. Do not publish without Ahmad UX review."

---

### PACKET 3 — Trend Radar local dashboard (top-priority trend-radar-loop)

**Why now:** Loop board lists this as priority 95, the highest. Dashboard is read-only (reads existing JSON) so risk is bounded — no external sends, no automation, no Stripe wiring. Codex can ship in a single session.

**Files to touch:**
- New: `trend-radar-admin.html` — local-only admin page (not linked in nav, robots-noindex). Reads `senior-director-state/trend-radar/*.json` (Codex's existing radar output).
- New: `assets/trend-radar-admin.js` — table renderer with filters (score range, risk flag, review status, vertical), sort, search, CSV export.
- `_redirects` or `netlify.toml` — basic auth gate on `/trend-radar-admin.html` (Ahmad's email + password).

**Risks:**
- Visual regression: keep this page totally outside iisupp.net's premium aesthetic — pure utilitarian admin. Don't import aria-core.css.
- Sensitive data exposure: must require auth even though no nav link.

**Approval gates:**
- Auth gate verified working before public route added.
- No auto-promotion of trends to product-pack-loop without "Reviewed" button click.

**Recommended next prompt for Codex:**
> "Build `trend-radar-admin.html` + `assets/trend-radar-admin.js`. Read JSON from `senior-director-state/trend-radar/*.json`. Columns: score, vertical, term, demand signal, risk flag, review status, source URL, first seen. Filters: score range, risk flag bool, review status enum, vertical text-search. CSV export. Basic-auth gate via Netlify Edge Function with Ahmad-set env vars (TREND_ADMIN_USER / TREND_ADMIN_PASS — never hardcoded). Robots: noindex. NOT linked from main nav. NO auto-promotion: 'Mark reviewed' button is the only state mutation. Deploy preview; Ahmad publishes when ready."

---

## Carry-forward state

**KB Agent loop intersection:** the bit-native KB pipeline is the substrate. Symbolic dictionary v2 (Packet 1 above) is the next leverage. v3 chunked bundle is the retrieval format that makes phased response (Packet 2) feasible.

**Memory updates needed:** Note in `feedback_never_idle.md` that the daily loop check includes reading `senior-director-state/loop-engineer/loop-board.md` and `claude-next-prompt.md` first on session open.

**Next loop tick:** After Codex acts on these 3 packets, re-critique with fresh evidence and produce the next 3. Ahmad does not need to be prompted between ticks.

---

## Single-line summary for Ahmad

> "Three Codex packets queued — (1) wire my 51-state dictionary into research agent (doubles pattern coverage), (2) phased response patch (kills the wall-of-text UX problem), (3) Trend Radar dashboard (top-priority loop, clean ship). All local-only or preview-deploy, no Ahmad gate until UX review."
