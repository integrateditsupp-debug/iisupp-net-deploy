# Loops Alignment — 2026-07-29

Top goal: Scale IIS to $1M ARR by 2027-06 via gov + biz IT contracts and ARIA/Growth Library digital products.

Registry entries audited: 35 (8 top-level loops + 27 org-chart agents)
Git state: `.git/index.lock` present (stale — see memory `project_git_index_lock_blocker_2026_07_29`). No git ops attempted; docs written directly.

## Aligned (35/35) — registry test

Every registered loop declares `serves: top-goal` in its YAML. Per LOOPS_SPEC §8g rule 3c this passes.

## Drifting (0) — registry test

None.

---

## Strict test (goal/mandate text must name a sub-goal token)

The `serves:` field is a self-declared flag and passes trivially for all 35. Running the harder test — does the loop's own goal/mandate prose reference a sub-goal — gives a truer picture.

### Top-level loops (8)

| Loop | Strict | Evidence |
|---|---|---|
| aria-self-learn | PASS | "generate 1-3 candidate bits in aria_brain_pack/bits/" → sub-goal 4 |
| lead-radar | PASS | CanadaBuys/MERX tender digest → sub-goal 1 pipeline |
| tender-enrich | PASS | solicitation enrichment + IIS-fit score → sub-goal 1 |
| spend-gatekeeper | PASS (constraint) | enforces locked $0-spend constraint |
| hard-rule-gatekeeper | PASS (constraint) | enforces locked aperture/ARIA HARD RULE |
| goal-alignment | PASS (meta) | this loop; audits the goal itself |
| codex-observer | **WEAK** | pure process observation; no revenue/KB/outbound token |
| director-idle-improvement | **WEAK** | dispatch mechanics only; no sub-goal token |

### Org-chart agents (27)

Strict-pass on mandate text: 8/27 — ae-agent, bid-mgr, coo-agent, content-strat, cto-agent, kb-engineer, legal-counsel, procurement-mgr, sdr-agent.

No sub-goal token in mandate: 19/27 — ap-ar-clerk, brand-mgr, cco-agent, ceo-agent, cfo-agent, cmo-agent, cos-agent, demand-gen, devops-eng, ea-agent, pm-agent, platform-eng, pr-agent, privacy-officer, qa-auditor, sre-agent, tax-agent, treasurer.

This is expected for support/governance roles (finance, compliance, reliability) — they serve the goal indirectly. It is **not** expected for `demand-gen` (Hunter class, reports to CMO): a demand-generation agent whose mandate never names leads, replies, or pipeline is a genuine drift signal.

---

## Structural findings (new this run)

**F1 — schema drift: agents use `mandate:`, loops use `goal:`.**
All 27 files under `loops/agents/` carry `mandate:` where `loops/*.yaml` carry `goal:`. LOOPS_SPEC §8g describes only `goal:`. The auditor must special-case agents. Recommend: update LOOPS_SPEC to declare `mandate:` the agent-tier synonym of `goal:`, or rename the field. Doc-only change, zero runtime risk.

**F2 — field-content swap in all 27 agent YAMLs (P2).**
In every agent file the `kpis:` block contains the tools list and `tools_allowed:` contains the KPI sentence. Example, `loops/agents/sdr-agent.yaml`:

```
kpis: |
    - apollo
  - gmail (draft + schedule send only)
  ...
tools_allowed:
  Outbound sent/day · reply rate · meeting booked rate · sequence drop rate
```

Systemic — a template generation bug, not 27 independent typos. Any executor that reads `tools_allowed` to gate tool access will read prose and either grant nothing or fail open. All 27 agents are `status: planned`, so nothing is executing on this yet — fix before any agent flips to `idle`/`active`.

READ-ONLY constraint honoured: no loop YAML was edited this run.

## Action

1. **codex-observer / director-idle-improvement (WEAK)** — recommend (a): add one clause to each goal naming what they protect. codex-observer already has an open blocker (`observe-codex.mjs` missing, memory 2026-07-15); fold the goal edit into that repair.
2. **demand-gen (drift)** — recommend (a): rewrite mandate to name sub-goal 3 ("50+ outbound qualified replies/month").
3. **F2 (P2 blocker)** — recommend a single scripted pass over `loops/agents/*.yaml` swapping the two block bodies back. Needs Codex + Ahmad approval since it edits loop YAMLs (out of this loop's write scope).
4. **F1** — update `docs/LOOPS_SPEC.md` §8g to name `mandate:` as the agent-tier goal field.
5. **Auditor hardening** — the `serves:` check alone yields 35/35 forever. Recommend promoting the strict prose test to primary in the next spec revision so this loop can actually fail.
