# Loops Alignment — 2026-08-05

Top goal: Scale IIS to $1M ARR by 2027-06 via gov + biz IT contracts and ARIA/Growth Library digital products.

Registry: 35 loops. All YAML files present (0 missing). Every loop carries `serves: top-goal`.

## Aligned (35/35)
- lead-radar: pulls CanadaBuys/MERX/Ontario tenders, HOT-flag >=60 — sub-goal 1 (first paying client)
- aria-self-learn: generates bits into `aria_brain_pack/bits/` — sub-goal 4 (100+ KB bits/mo)
- hard-rule-gatekeeper: aperture + /aria uptime verification — locked constraint (HARD RULE)
- spend-gatekeeper: per-loop cost audit vs $0 cap — locked constraint (spend)
- goal-alignment: this auditor — meta-loop guarding all sub-goals
- codex-observer: Codex working-style delta detection — locked constraint (delivery quality)
- tender-enrich: eval criteria + IIS-fit scoring on HOT tenders — sub-goal 1
- ae-agent: converts qualified opportunities to signed contracts — sub-goal 1
- ap-ar-clerk: AR aging + invoicing via Stripe — revenue capture path to $1M ARR
- bid-mgr: enriches HOT tenders, flags iis_fit >= 80 to AE — sub-goal 1
- brand-mgr: visual/copy drift guard — locked constraint (visual stability)
- cco-agent: blocks fake-data / unsupported-claim shipments — locked constraint (ethical design)
- ceo-agent: sets CURRENT_GOAL.md, approves spend — owns all sub-goals
- cfo-agent: spend governance + forecast — locked constraint (spend)
- cmo-agent: brand voice + demand gen + Growth Library roadmap — top-line (digital products)
- content-strat: Growth Library authoring + KB articles — sub-goal 4
- coo-agent: pipeline + outbound batch approval + proposals — sub-goals 1, 3
- cos-agent: goal alignment across agents + idle-improvement delegation — meta
- cto-agent: KB ingestion review + approves aria/aperture deploys — sub-goal 4 + HARD RULE
- demand-gen: trend scan feeding marketing pipeline — sub-goal 3
- devops-eng: post-deploy smoke tests on /aria + /aperture-learning — HARD RULE
- ea-agent: email triage + follow-up tracking — sub-goal 3 (reply throughput)
- kb-engineer: 1-3 bit drafts per fallback query, max 50/day — sub-goal 4
- legal-counsel: contract + tender T&C review — sub-goal 1
- platform-eng: commit-pattern + architectural drift detection — delivery quality
- pm-agent: task/blocker tracking across loops — meta
- pr-agent: LinkedIn + press drafts — sub-goal 3 (inbound demand)
- privacy-officer: PIPEDA/PHIPA/GDPR posture — gov procurement prerequisite (sub-goal 1)
- procurement-mgr: daily MERX/CanadaBuys/BC Bid/Biddingo hunt — sub-goal 1
- qa-auditor: flags fabricated testimonials/partnerships — locked constraint (ethical design)
- sdr-agent: cold outreach, cadence 5+5 / 2h gap — sub-goal 3 (50+ qualified replies/mo)
- sre-agent: 30-min curl of aperture + /aria, auto-rollback — HARD RULE
- tax-agent: CRA workbook sync — financial hygiene under $1M ARR track
- treasurer: pauses loops breaching $0 cap — locked constraint (spend)
- director-idle-improvement: delegates idle agents to $0 improvements — meta

## Drifting (0) — flag to Ahmad
None. No loop lacks a `serves: top-goal` field, and no loop's goal/mandate text is free of sub-goal or locked-constraint vocabulary.

## Advisory — indirect alignment (17)
These loops align via **locked constraints** (HARD RULE, spend, visual stability, ethical design) rather than a revenue sub-goal token. That is legitimate under LOOPS_SPEC §7, but they will never move the $1M ARR needle directly:

hard-rule-gatekeeper, spend-gatekeeper, goal-alignment, codex-observer, brand-mgr, cmo-agent, cos-agent, demand-gen, devops-eng, ea-agent, platform-eng, pm-agent, pr-agent, privacy-officer, sre-agent, tax-agent, treasurer

No action required. Recorded so the split between revenue loops (18) and guardrail/meta loops (17) is visible.

## Structural finding — carried from 2026-08-04
Alignment is 35/35 but **execution is 0/35 on the revenue side**: every `status: planned` agent loop (27 of them) has `last_run: null` and `success_count: 0`. Only `goal-alignment` and `codex-observer` have ever run. Sub-goal 5 (Capability Statement, due 2026-06-20) is 46 days past due. Sub-goals 1, 2, and 4 are due 2026-09-30 — 56 days out — with no loop having produced a single run toward them.

Perfect alignment on loops that never fire is a vanity metric. The gap is activation, not alignment.

## Action
1. No goal text changes needed — do not edit any loop YAML.
2. **Activation is the bottleneck.** Recommend Ahmad pick 3 loops to move `planned` → `idle` (runnable) this week. Highest leverage against the 2026-09-30 deadlines: `procurement-mgr` (sub-goal 1), `sdr-agent` (sub-goal 3), `kb-engineer` (sub-goal 4).
3. Sub-goal 5 is 46 days overdue and has no owning loop. Either assign it to `content-strat` or strike it from CURRENT_GOAL.md via `/goal`.
4. Sub-goal 2 (Anthropic Partner Network) has no owning loop at all. Currently unowned work.
