# Loops Alignment — 2026-06-26

Top goal: Scale IIS to $1M ARR by 2027-06 via gov + biz IT contracts and ARIA/Growth Library digital products.

Sub-goal tokens checked: `paying client`/contract (#1), `Anthropic Partner` (#2), `outbound replies`/leads (#3), `KB bits` / `aria_brain_pack/bits/` (#4), `Capability Statement` (#5), plus top-line product tokens (`gov`/`biz IT contracts`, `ARIA`, `Growth Library`), or `serves_top_goal: true`.

## Aligned (34/34)

### Core loops (7) — YAML goal fields present
- **lead-radar**: "pull CanadaBuys / MERX / Ontario Tenders… HOT-flag score ≥ 60 → digest email" — gov IT lead generation; `serves_top_goal: true`
- **aria-self-learn**: "generate 1-3 candidate bits in aria_brain_pack/bits/" — directly references sub-goal #4 (KB bits)
- **hard-rule-gatekeeper**: "fetch aperture-learning.html + /aria — if either fails, auto-rollback" — enforces locked hard rule protecting ARIA; `serves_top_goal: true`
- **spend-gatekeeper**: "audit every loop's run cost… Pause any loop whose cumulative day spend > budget" — enforces $0 spend constraint; `serves_top_goal: true`
- **goal-alignment**: "verify serves: field points to top-goal AND goal: paragraph mentions at least one sub-goal token" — meta-alignment loop; `serves_top_goal: true`
- **codex-observer**: "run observe-codex.mjs… compare today's playbook to yesterday's" — infra/process hygiene; `serves_top_goal: true`
- **tender-enrich**: "fetches full solicitation page, extracts evaluation criteria… Scores IIS-fit (0-100) based on capability match" — enriches gov bid leads; `serves_top_goal: true`

### Agent loops (27) — serves_top_goal: true (YAML goal fields absent — see Action below)
ae-agent, ap-ar-clerk, bid-mgr, brand-mgr, cco-agent, ceo-agent, cfo-agent, cmo-agent, content-strat, coo-agent, cos-agent, cto-agent, demand-gen, devops-eng, ea-agent, kb-engineer, legal-counsel, platform-eng, pm-agent, pr-agent, privacy-officer, procurement-mgr, qa-auditor, sdr-agent, sre-agent, tax-agent, treasurer

## Drifting (0) — flag to Ahmad
None.

## Persistent Coverage Gaps (carried forward — no loop owns these)
- **Sub-goal #5** — Capability Statement PDF + Cover-Letter template: deadline was **2026-06-20** (+6 days overdue). No registered loop owns delivery.
- **Sub-goal #2** — Anthropic Partner Network acceptance: no owner loop registered.
- **Sub-goal #3** — 50+ outbound qualified replies/month: `sdr-agent` is the intended owner but remains `status: planned`. No active loop drives outbound cadence.

## Action
1. **Agent YAML gaps**: 27 agent loops have `serves_top_goal: true` in registry but **no `goal:` field in their YAML files**. Recommend: Codex adds a one-line `goal:` to each agent YAML so future alignment checks can verify goal text, not just the registry flag.
2. **Sub-goal #5** (Capability Statement): +6d overdue. Ship asset now; register an owner loop or assign to `bid-mgr` / `cos-agent`.
3. **Sub-goal #2** (Anthropic Partner): Register owner loop or assign to `cmo-agent` / `coo-agent`.
4. **Sub-goal #3** (outbound replies): Flip `sdr-agent` from `planned` → `active`.
5. No git ops performed this run — file-only writes; $0.
