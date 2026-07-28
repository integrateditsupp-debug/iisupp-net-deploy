# Loops Alignment — 2026-07-28

Top goal: Scale IIS to $1M ARR by 2027-06 via gov + biz IT contracts and ARIA/Growth Library digital products.

Run: goal-alignment loop (scheduled). READ-ONLY on loop YAMLs.

Note: `.git/index.lock` PRESENT (0-byte, 2026-07-28T02:55 local, ~12h stale). No git operations performed this run — report + ledger written to working tree only.

## Aligned (35/35)

- **lead-radar** — [tender, lead] Each day pull the CanadaBuys "new tender notice" CSV + MERX search results + Ontario Tenders RSS. Filter by 40+ IT-keyword list. S
- **aria-self-learn** — [serves: top-goal] Every 6 hours, scan ARIA chat audit log for queries that returned a generic fallback or low-confidence answer. For each, generate 
- **hard-rule-gatekeeper** — [serves: top-goal] After every Netlify deploy (and every 30 min as a safety net) fetch: https://iisupp.net/aperture-learning.html (200 + login form p
- **spend-gatekeeper** — [serves: top-goal] Continuously audit every loop's run cost. Sum across all loops per day. Pause any loop whose cumulative day spend > its budget OR 
- **goal-alignment** — [serves: top-goal] Once a day at 06:00 ET, read CURRENT_GOAL.md. For each loop in registry.json, verify its serves: field points to top-goal AND its 
- **codex-observer** — [serves: top-goal] Every working-day at 09:00 and 17:00, run observe-codex.mjs (--since=2d). Compare today's playbook to yesterday's. Flag any new pa
- **tender-enrich** — [tender, lead] When lead-radar emits a match with score >= 60, this loop fetches the full solicitation page, extracts evaluation criteria, estima
- **ae-agent** — [contract] Convert qualified opportunities to signed contracts. Proposals + negotiation prep.
- **ap-ar-clerk** — [serves: top-goal] Invoice generation + payment tracking + vendor payment scheduling.
- **bid-mgr** — [tender] Enrich HOT tenders. Pull eval criteria, value, required certs. Draft fit analysis.
- **brand-mgr** — [serves: top-goal] Visual stability + copy consistency + voice audit + brand guideline enforcement.
- **cco-agent** — [serves: top-goal] Ethical design enforcement + human-review gate + legal review + privacy. Watches Legal, Privacy Officer, QA Auditor.
- **ceo-agent** — [serves: top-goal] Set top-level goal. Allocate capital + agent priority. Approve high-risk actions. Read daily digests + LOOPS_LEDGER.md. Write CEO 
- **cfo-agent** — [serves: top-goal] Spend governance + cash management + tax + financial forecast. Watches Treasurer, AP/AR, Tax Agent.
- **cmo-agent** — [serves: top-goal] Brand voice + content production + demand gen + public visibility. Watches Content Strategist, Brand Mgr, Demand Gen, PR.
- **content-strat** — [serves: top-goal] Growth Library product authoring + KB article production.
- **coo-agent** — [bid] Daily ops + sales pipeline + delivery. Watches Procurement Mgr, Bid Mgr, SDR, AE. Forecasts pipeline.
- **cos-agent** — [serves: top-goal] CEO leverage. Goal alignment across all agents. Status reporting. Email triage. Strategic projects.
- **cto-agent** — [serves: top-goal] Product reliability + KB quality + security posture + dev velocity. Watches SRE, Platform Eng, KB Eng, DevOps Eng.
- **demand-gen** — [serves: top-goal] Trend Radar continuous scanning. Feed Marketing pipeline. Campaign planning.
- **devops-eng** — [serves: top-goal] Post-deploy verification. Smoke tests. Performance monitoring. CI/CD pipeline health.
- **ea-agent** — [serves: top-goal] Email triage + calendar orchestration + reminder/follow-up tracking.
- **kb-engineer** — [kb bit] Generate KB bits autonomously. Validate schema. Curate KB library quality.
- **legal-counsel** — [contract] Contract review + terms of service + IP + procurement clause analysis.
- **platform-eng** — [serves: top-goal] Watch Codex + Cowork commit patterns. Surface working-style deltas. Architectural drift detection.
- **pm-agent** — [serves: top-goal] Task tracking across all loops + status digest + blocker flags.
- **pr-agent** — [serves: top-goal] LinkedIn page + press releases + public-facing copy.
- **privacy-officer** — [serves: top-goal] PIPEDA + PHIPA + GDPR posture. Data retention. Privacy impact assessments.
- **procurement-mgr** — [contract, tender] Find new gov tenders + biz contracts daily. Score IIS-fit. Flag HOT matches.
- **qa-auditor** — [serves: top-goal] Fact-check claims + source verification + fake-data guard + benchmark verification.
- **sdr-agent** — [prospect] Cold outreach pipeline. Build prospect lists. Personalize emails. Enroll in sequences.
- **sre-agent** — [serves: top-goal] Uptime + HARD RULE verification + auto-rollback on regression.
- **tax-agent** — [serves: top-goal] CRA tax workbook sync. Monthly reconciliation. Annual return prep.
- **treasurer** — [serves: top-goal] Enforce $0 spend lockdown. Pause any loop that breaches budget. Track approved exceptions.
- **director-idle-improvement** — [arr] When any direct report is idle AND the queue is empty AND the CEO is not blocked/waiting, the Director Agent delegates the idle re

## Drifting (0) — flag to Ahmad

- none

## Structural defect (carried, still unfixed — 3rd consecutive run)

All 27 agent YAMLs under `loops/agents/` have their `kpis:` and `tools_allowed:` block bodies **swapped**. `kpis:` holds the tool allow-list; `tools_allowed:` holds the KPI sentence. Example — `loops/agents/sdr-agent.yaml`:

```
kpis: |
    - apollo
  - gmail (draft + schedule send only)
tools_allowed:
  Outbound sent/day · reply rate · meeting booked rate
```

Impact: any executor that reads `tools_allowed` to gate capability gets a prose string, not a list — so the allow-list is effectively unenforced across the whole 27-agent org chart. This is a **spend + safety gate failure mode**, not cosmetic. All 27 are `status: planned`, so nothing is executing on it yet — but this must be fixed before any agent loop is promoted to `idle`/`running`.

Secondary: agent YAMLs use `mandate:` where core loops use `goal:`. Alignment currently passes on the `serves: top-goal` field alone. Recommend LOOPS_SPEC.md §8g name one canonical key.

## Action

1. **Zero drifting loops** — no goal-text realignment needed this cycle.
2. **Fix the kpis/tools_allowed swap** in all 27 `loops/agents/*.yaml` before promoting any agent loop out of `planned`. Mechanical swap; safe to script.
3. **Unify the goal key** — either add `goal:` to agent YAMLs or have LOOPS_SPEC §8g accept `mandate:` as equivalent.
4. **Clear `.git/index.lock`** (Ahmad, local) — same stale-lock signature that froze the repo 2026-07-17 and produced the 07-21 discharge burst. Sandbox cannot unlink it.
