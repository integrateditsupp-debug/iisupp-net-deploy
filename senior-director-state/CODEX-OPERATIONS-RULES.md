# Codex Operations Rules & Migrated Knowledge

**Purpose:** Permanent home for standing rules, quirks, and results that previously lived ONLY inside the rolling chat logs (`AGENT_EXECUTION_NOTES.md`, `codex-claude-queue.md`). Those logs were archived 2026-06-14 (see `senior-director-state/archives/`). Anything below must survive log clears. Internal-only (covered by the `/senior-director-state/*` redirect).

---

## 1 · Codex per-turn operating loop (adopt verbatim)
1. **Read state first** — queue, memory, command files, latest cowork packet. Treat `continue`/`proceed`/`do it` as "resume the standing mission," never re-ask for the vision.
2. **Claim before touching** — append a `### <timestamp> - Codex - active` block to the notes file listing scope + exact target files. Never duplicate another agent's active scope.
3. **Execute the safest next slice** to the CEO final-action point. Split work into owned lanes for speed.
4. **Log after** — append a `completed` block with changed files, what/why, company value, verification, handoff risks.
5. **Write a handoff packet** for the next turn (round_id, owner, objective, what changed, evidence, next best task, files to touch, approval gates, risks, recommended next prompt).
6. **Commit in coherent groups** as Ahmad; verify live URLs post-deploy ("Verified LIVE (10/10)" pattern).

## 2 · The Stop Rule (hard stop → escalate to Ahmad)
Send / submit / apply / sign / certify · external outreach · bid or supplier registration · account creation · payment / subscription / paid API / ads · production publish affecting pricing/checkout/legal/reputation · deletion or git-history rewrite · legal/financial/medical/privacy/donation claims · any fake-proof risk.

## 3 · Standing product / communication rules (migrated)
- **AI demand profit-engine rule (2026-06-13):** Build from what the market is already trying to learn, buy, or deploy in AI. Every AI opportunity should ladder: **entry product → implementation service → recurring support.** This overrides generic AI ideation.
- **Communication discipline:** short-answers-first; need-to-know-only by default; demand-led growth over generic ideation.
- **Product-preview lane template (repeatable monetization pattern):** convert a catalog-only product into a real local-only sample-preview lane — add a `View sample section` band + `Stage audit/security review first` CTA + route-back bands on the product page — and file a staged CEO review packet. Keep local/unpublished until Ahmad approves.

## 4 · Known system quirks
- **Autonomy-rebuild omission:** the autonomy script sometimes omits new slices from the markdown handoff surfaces; manual patching of the handoff file is occasionally needed after a rebuild.
- **Netlify cron registration:** only `export const config = { schedule }` (or `{ path }`) registers a v2 function route/timer here; legacy `schedule()` does NOT. (Learned 2026-06-01.)
- **Loops runtime is NOT live:** `docs/LOOPS_SPEC.md` + 8 bootstrap YAMLs + `loops/registry.json` exist, but `cli/loops.mjs` and the privileged gatekeepers (`spend-gatekeeper`, `hard-rule-gatekeeper`) were never wired as live scheduled functions. **Until that bridge exists, each agent session must behave as the next loop turn.** Only `goal-alignment` (1 run) and `codex-observer` have actually fired; the rest are `idle`.

## 5 · Trend Radar MVP — top seed trends (2026-06-13)
Scored via the §4 COLLAB_BRIEF formula (full data in `senior-director-state/trend-radar/trend-radar.json`):
- Microsoft 365 automation — **76**
- AI agents for SMB — **75**
- AI tutor for kids — **72**
- AI productivity for adults — **70**

## 6 · Tender / employment decision log (running state)
- **Samsung ProCare** — no-bid by default unless a real no-cost OEM/partner path emerges.
- **TBIPS PM Level 3** — direct no-bid unless Ahmad holds a TBIPS vehicle.
- **LinkedIn Easy Apply (2026-06-10):** 3 ready-to-submit (Portless AI Engineer, Jobgether AI/ML, Crossing Hurdles AI Training Engineer); 6+ paused pending Ahmad answering legal/work-authorization/sponsorship questions. (Employment, not company-critical.)

---
_Migrated 2026-06-14 by Claude Cowork during chat-history cleanup. Source logs archived, not deleted._
