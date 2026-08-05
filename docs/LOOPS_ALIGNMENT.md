# Loops Alignment — 2026-08-04

Top goal: Scale IIS to $1M ARR by 2027-06 via gov + biz IT contracts and ARIA/Growth Library digital products.

Registry: 35 loops (8 core + 27 agent). Every loop declares `serves: top-goal`, so all 35
pass the literal spec test (§8g step 3c). Report below splits them by evidence strength.

## Aligned — sub-goal token present in loop text (17/35)

Strong: mandate/goal prose names a sub-goal, not just the `serves:` field.

- tender-enrich — full solicitation fetch + IIS-fit scoring (SG1 client, SG3 tenders, SG4 bits, SG5 cap-stmt)
- lead-radar — CanadaBuys/MERX/Ontario daily pull, HOT >= 60 (SG3, SG4)
- aria-self-learn — candidate bits into `aria_brain_pack/bits/`, max 50/day (SG4, revenue tie)
- ae-agent — close motion + partner/cap-statement references (SG2, SG3, SG5)
- content-strat — revenue-linked content + KB output (SG1, SG4)
- bid-mgr — bid assembly from tender records (SG3, SG4)
- procurement-mgr — supplier/tender hunting (SG3, SG4)
- kb-engineer — KB bit production (SG4)
- sdr-agent — cold outbound pipeline, cadence 5+5 (SG3)
- demand-gen — inbound/outbound demand (SG3)
- coo-agent — ops over lead/bid flow (SG3)
- legal-counsel — contract/tender review (SG3)
- director-idle-improvement — dispatches idle reports onto revenue duties (SG3)

## Aligned by `serves:` only — no sub-goal token in text (18/35)

These are infra, gatekeeper, or executive loops. Not drift, but the prose does not
name what they protect. Listed so the weakness is visible rather than hidden.

Infra / gatekeeper (correctly constraint-derived, low concern):
hard-rule-gatekeeper, spend-gatekeeper, goal-alignment, codex-observer,
sre-agent, devops-eng, qa-auditor, platform-eng, privacy-officer, cco-agent

Executive / finance (higher concern — should name a sub-goal):
ceo-agent, coo-agent-peers (cfo-agent, cmo-agent, cto-agent, cos-agent),
ea-agent, pm-agent, pr-agent, brand-mgr, ap-ar-clerk, tax-agent, treasurer

## Drifting (0)

No loop declares a mission outside CURRENT_GOAL.md.

## Schema defects found this scan (blocking-quality, not alignment)

1. **P1 — `kpis:` / `tools_allowed:` contents swapped in all 27 `loops/agents/*.yaml`.**
   Example `sdr-agent.yaml`: `kpis:` holds the tool allowlist (apollo, gmail, filesystem.*)
   and `tools_allowed:` holds the KPI sentence. Any permission gate reading
   `tools_allowed:` will read prose and either fail-open or fail-closed. Mechanical fix.
2. **P2 — key mismatch.** `loops/goal-alignment.yaml` specifies reading `goal:`; all 27
   agent loops use `mandate:`. This auditor accepts both; LOOPS_SPEC should too.
3. **P3 — the `serves:` test cannot fail.** 35/35 every run since inception. The strict
   prose test should become primary in the next LOOPS_SPEC revision.

## Action

- Drifting loops: none — no goal rewrites needed.
- Fix (1) before any agent loop moves from `planned` to `active`; a swapped allowlist on a
  Closer or Drafter class loop is a real spend/permission risk.
- Tighten mandate wording on the 10 executive/finance loops so each names the sub-goal it
  serves (e.g. cfo-agent -> SG1 first paying client; pr-agent -> SG2 Anthropic Partner).
- Do not update CURRENT_GOAL.md — no loop is redefining the mission.
