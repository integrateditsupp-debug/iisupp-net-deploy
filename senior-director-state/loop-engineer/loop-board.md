# Loop Engineer Board

Updated: 2026-06-16 (Cowork critique tick)

## Active Goal

**IIS / ARIA market-ahead operating engine**

Keep IIS / ARIA several steps ahead by converting long-life demand into review-gated products, ARIA improvements, Growth Library assets, website conversion paths, and CEO final-action packets.

## Active Loops

### trend-radar-loop
- Owner: Codex
- Priority: 95
- Objective: Keep a long-life demand map current and turn trends into review-gated product, content, demo, and ARIA KB candidates.
- Next safe action: Build local Trend Radar admin dashboard from generated JSON and review queue.
- Prompts other loops: product-pack-loop, qa-safety-loop
- Main prompt: Codex: build a local dashboard page for Trend Radar outputs with filters, scores, risk flags, review status, and export links. Do not publish.
- Approval gates: No external send/submit/publish/payment/account/legal commitment without Ahmad. | Keep outputs local, draft, or review-gated unless explicitly approved.

### product-pack-loop
- Owner: Codex
- Priority: 92
- Objective: Turn high-fit trends into Growth Library products, previews, demos, and pricing drafts.
- Next safe action: Create local draft product records and preview copy from the first 9 product plans.
- Prompts other loops: website-conversion-loop, qa-safety-loop
- Main prompt: Codex: convert the first 9 review-gated product plans into draft Growth Library product records and preview-page copy. Do not create Stripe links or publish.
- Approval gates: No external send/submit/publish/payment/account/legal commitment without Ahmad. | Keep outputs local, draft, or review-gated unless explicitly approved.

### aria-behavior-loop
- Owner: Codex
- Priority: 90
- Objective: Make ARIA behave like a professional support agent: phased, realistic, short, question-first, and non-overwhelming.
- Next safe action: Create an ARIA response-behavior QA checklist and patch plan tied to current UI/runtime files.
- Prompts other loops: qa-safety-loop
- Main prompt: Codex: inspect ARIA response generation and UI rendering paths, then patch phased response behavior and duplicate-message prevention. Keep answers short and ask the next relevant question before dumping solutions.
- Approval gates: No external send/submit/publish/payment/account/legal commitment without Ahmad. | Keep outputs local, draft, or review-gated unless explicitly approved.
- Risks: Do not hard-code individual fixes; encode reasoning flow and response policy.

### website-conversion-loop
- Owner: Codex
- Priority: 86
- Objective: Move website, AI Edge, Growth Library, and product pages toward clean paid conversion without visual regressions.
- Next safe action: Draft local preview copy and route map before touching production-facing product pages.
- Prompts other loops: qa-safety-loop
- Main prompt: Codex: prepare local preview copy/routes for the first product plans. Do not publish or add checkout until Ahmad verifies Stripe and approves public page changes.
- Approval gates: No external send/submit/publish/payment/account/legal commitment without Ahmad. | Keep outputs local, draft, or review-gated unless explicitly approved.
- Risks: Header/nav visual regression | dead payment links | unapproved paid claims

### revenue-opportunity-loop
- Owner: Codex
- Priority: 84
- Objective: Keep bids, suppliers, leads, and CEO final-action packets moving without risky external action.
- Next safe action: Continue grounding supplier/lead lanes to submit/send/hold checklists only.
- Prompts other loops: qa-safety-loop
- Main prompt: Codex: pick the highest-value existing revenue lane, verify live facts, prefill/stage safe fields if available, and stop at Ahmad final action.
- Approval gates: No external send/submit/publish/payment/account/legal commitment without Ahmad. | Keep outputs local, draft, or review-gated unless explicitly approved.
- Risks: No form submission, no outreach send, no account creation.

### claude-strategy-loop
- Owner: Claude Cowork
- Priority: 82
- Objective: Critique strategy, positioning, product quality, pricing, and next prompts so Codex builds the right slice fast.
- Next safe action: Ask Claude to review Loop Engineer board and return compact task packets.
- Prompts other loops: codex-build-loop, product-pack-loop, aria-behavior-loop
- Main prompt: Claude Cowork: read docs/COLLAB_BRIEF.md, docs/LOOP-ENGINEER.md, senior-director-state/loop-engineer/loop-board.md, and critique the active loops. Return the best next three Codex packets with risks and approval gates.
- Approval gates: No external send/submit/publish/payment/account/legal commitment without Ahmad. | Keep outputs local, draft, or review-gated unless explicitly approved.

### idle-improvement-loop
- Owner: Director (delegates to all agents)
- Priority: 70 (low — only fires when higher loops are at rest)
- Objective: No agent stays idle. When queue empty + Ahmad not blocked, every idle agent ships a $0 improvement in its own lane (KB additions, drafts, calibration, dashboards, content polish, KPI watchers, agent-care, learning notes).
- Trigger: any agent idle ≥15min AND no queued tasks AND Ahmad not waiting on us.
- PRE-APPROVED by Ahmad 2026-06-16 — execute without asking. See [[feedback-idle-brainstorm-loop]].
- Constraints (ALL must hold): $0 cost · no damage to vision/path/tools/features/functions/apps · no penalty/legal/compliance risk · respects every HARD RULE · no public publish without separate approval · no sends/submits/account-creation/deletions.
- Reporting: each action logs to `docs/LOOPS_LEDGER.md`. CEO brief surfaces top wins; not approval asks.
- Prompts other loops: codex-build-loop, kb-quality-loop (when present), trend-radar-loop calibration tasks.
- Approval gates: standing pre-approval from Ahmad. Hard stops still apply (cost, send, publish, delete, account, legal claim).

### qa-safety-loop
- Owner: Codex
- Priority: 80
- Objective: Protect IIS / ARIA from fake claims, platform abuse, legal exposure, payment risk, privacy issues, and visual regressions.
- Next safe action: Run before any public page, checkout, external send, or ARIA authoritative response update.
- Prompts other loops: none
- Main prompt: Codex: review the active loop output for claims, payment, privacy, legal, security, platform, and publish risks. Create a concise approval checklist.
- Approval gates: No external send/submit/publish/payment/account/legal commitment without Ahmad. | Keep outputs local, draft, or review-gated unless explicitly approved.

### codex-build-loop
- Owner: Codex
- Priority: 78
- Objective: Turn safe loop packets into files, scripts, tests, dashboards, and handoff notes.
- Next safe action: Build Trend Radar dashboard or local loop supervisor bridge plan next.
- Prompts other loops: claude-strategy-loop
- Main prompt: Codex: implement the next highest-priority safe local artifact from the loop board, verify it, update memory, and stop at any approval gate.
- Approval gates: No external send/submit/publish/payment/account/legal commitment without Ahmad. | Keep outputs local, draft, or review-gated unless explicitly approved.

## Next Recommended Order

(Latest critique: `senior-director-state/loop-engineer/claude-critique-2026-06-16.md` — supersedes 2026-05-14.)

1. **Trend Radar triage dashboard** (top-20 view, risk quarantine tab, decision logging)
2. **ARIA phased response patch** (33-day overdue; PACKET B in claude-code-next-prompt.md)
3. **Approval batch instrument** (clears the 26+ staged-slice backlog blocking website-conversion-loop)
4. Symbolic dictionary wiring (former PACKET A — deferred this tick, low risk next)
5. Safe local loop supervisor bridge

## Stop Rule

Stop at send, submit, publish, pay, create account, sign, certify, delete, high-risk claim, or external commitment.

## Director Standing Duty (locked 2026-06-16, PRE-APPROVED)

Whenever the loop board shows no active work for an agent AND Ahmad is not waiting on us, the Director MUST route that agent into `idle-improvement-loop`. No idle time. Full rule + constraints in [[feedback_idle_brainstorm_loop]] (memory) and `senior-director-state/director-operating-board.md`.


## STANDING RULES (read first, 2026-06-17)
Every loop owner must read [/senior-director-state/STANDING-RULES-FOR-ALL-AGENTS.md](../STANDING-RULES-FOR-ALL-AGENTS.md) before starting work. Key: spend cap, smart-qualifier (workaround compliance gaps), ship-now no-tomorrow.

## Next Recommended Order — 2026-06-24 REFRESH (Cowork; SUPERSEDES the 2026-06-16 list above)
The 2026-06-16 order (trend-radar dashboard / ARIA phased response / approval batch) is STALE — superseded by RUN 33–35 + the 2026-06-23/24 session. Current live queue:
1. **CC NEXT RUN → `senior-director-state/sentinel-aria-parity-packet.md`** (READY): fix RELEASE_NOTES_0.1.15 + resilient runner (1a/1b) · unify web↔local one-brain · enable "Resolve it for me" (Sentinel gated Confirmed-default; web 2-option download/walkthrough modal) · Sentinel chat = web parity. Two review branches, no deploy.
2. **ARIA cloud 400** — BLOCKED on Ahmad: get the Netlify aria-chat function-log error line (key/org likely lacks Claude 4.x access) → fix model/key. Offline local-KB unaffected.
3. **Outbound** (active-agent-handoff) — Hines/CIBC Square LinkedIn connection-requests awaiting acceptance → gated on Ahmad.
4. **Deferred (own packets later)**: SOC2 named-gap closure · doc-drift reconcile (COLLAB_BRIEF $0 vs vault $20–70/mo) · populate/consolidate feedback stubs.
