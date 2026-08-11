# Loops Alignment — 2026-08-11

Top goal: Scale IIS to $1M ARR by 2027-06 via gov + biz IT contracts and ARIA/Growth Library digital products.

Method: match loop `goal:`/`mandate:`/`duties:` text against CURRENT_GOAL.md sub-goal tokens; `serves: top-goal` + constraint-guard language counts as aligned for Gatekeeper/Verifier/Director classes.

## Aligned (30/35)
- **lead-radar** — matched: paying client, outbound replies  
  _Each day pull the CanadaBuys "new tender notice" CSV + MERX search results + Ontario Tenders RSS. Filter by 40…_
- **aria-self-learn** — matched: KB bits  
  _Every 6 hours, scan ARIA chat audit log for queries that returned a generic fallback or low-confidence answer.…_
- **hard-rule-gatekeeper** — matched: KB bits  
  _After every Netlify deploy (and every 30 min as a safety net) fetch: https://iisupp.net/aperture-learning.html…_
- **spend-gatekeeper** — matched: serves:top-goal + constraint-guard (spend, audit)  
  _Continuously audit every loop's run cost. Sum across all loops per day. Pause any loop whose cumulative day sp…_
- **goal-alignment** — matched: serves:top-goal + constraint-guard (goal)  
  _Once a day at 06:00 ET, read CURRENT_GOAL.md. For each loop in registry.json, verify its serves: field points …_
- **codex-observer** — matched: outbound replies  
  _Every working-day at 09:00 and 17:00, run observe-codex.mjs (--since=2d). Compare today's playbook to yesterda…_
- **tender-enrich** — matched: paying client, KB bits  
  _When lead-radar emits a match with score >= 60, this loop fetches the full solicitation page, extracts evaluat…_
- **ae-agent** — matched: paying client, Anthropic Partner, outbound replies, Capability Statement  
  _Convert qualified opportunities to signed contracts. Proposals + negotiation prep. Receive HOT tender briefs f…_
- **ap-ar-clerk** — matched: paying client  
  _Invoice generation + payment tracking + vendor payment scheduling. Daily 21:00 ET pull AR aging from Stripe · …_
- **bid-mgr** — matched: paying client, KB bits  
  _Enrich HOT tenders. Pull eval criteria, value, required certs. Draft fit analysis. Fetch full solicitation pag…_
- **brand-mgr** — matched: serves:top-goal + constraint-guard (audit)  
  _Visual stability + copy consistency + voice audit + brand guideline enforcement. Hourly scan of git diff for s…_
- **cco-agent** — matched: paying client  
  _Ethical design enforcement + human-review gate + legal review + privacy. Watches Legal, Privacy Officer, QA Au…_
- **ceo-agent** — matched: paying client  
  _Set top-level goal. Allocate capital + agent priority. Approve high-risk actions. Read daily digests + LOOPS_L…_
- **cfo-agent** — matched: paying client  
  _Spend governance + cash management + tax + financial forecast. Watches Treasurer, AP/AR, Tax Agent. Continuous…_
- **cmo-agent** — matched: serves:top-goal + constraint-guard (audit)  
  _Brand voice + content production + demand gen + public visibility. Watches Content Strategist, Brand Mgr, Dema…_
- **content-strat** — matched: KB bits  
  _Growth Library product authoring + KB article production. Daily 10:00 content calendar review · Trend Radar in…_
- **coo-agent** — matched: paying client, outbound replies, Capability Statement  
  _Daily ops + sales pipeline + delivery. Watches Procurement Mgr, Bid Mgr, SDR, AE. Forecasts pipeline. Read pip…_
- **cos-agent** — matched: outbound replies  
  _CEO leverage. Goal alignment across all agents. Status reporting. Email triage. Strategic projects. Daily goal…_
- **cto-agent** — matched: KB bits  
  _Product reliability + KB quality + security posture + dev velocity. Watches SRE, Platform Eng, KB Eng, DevOps …_
- **demand-gen** — matched: paying client  
  _Trend Radar continuous scanning. Feed Marketing pipeline. Campaign planning. Every 15 min trend scan (Google T…_
- **devops-eng** — matched: paying client, KB bits  
  _Post-deploy verification. Smoke tests. Performance monitoring. CI/CD pipeline health. On Netlify deploy webhoo…_
- **ea-agent** — matched: outbound replies  
  _Email triage + calendar orchestration + reminder/follow-up tracking. Every 30 min email triage (urgent/can-wai…_
- **kb-engineer** — matched: KB bits  
  _Generate KB bits autonomously. Validate schema. Curate KB library quality. Every 6h scan ARIA audit log for fa…_
- **legal-counsel** — matched: paying client  
  _Contract review + terms of service + IP + procurement clause analysis. On contract input: review for liability…_
- **privacy-officer** — matched: serves:top-goal + constraint-guard (privacy, audit)  
  _PIPEDA + PHIPA + GDPR posture. Data retention. Privacy impact assessments. Daily noon scan of data flows · PII…_
- **procurement-mgr** — matched: paying client, outbound replies, KB bits  
  _Find new gov tenders + biz contracts daily. Score IIS-fit. Flag HOT matches. Pull MERX + CanadaBuys + Ontario …_
- **qa-auditor** — matched: Anthropic Partner  
  _Fact-check claims + source verification + fake-data guard + benchmark verification. On public-facing artifact:…_
- **sdr-agent** — matched: paying client, outbound replies, KB bits  
  _Cold outreach pipeline. Build prospect lists. Personalize emails. Enroll in sequences. Daily 08:30 ET prospect…_
- **sre-agent** — matched: KB bits  
  _Uptime + HARD RULE verification + auto-rollback on regression. Curl aperture-learning.html (200 + login form) …_
- **treasurer** — matched: serves:top-goal + constraint-guard (spend, audit)  
  _Enforce $0 spend lockdown. Pause any loop that breaches budget. Track approved exceptions. Every 15 min audit …_

## Drifting (5) — flag to Ahmad
- **platform-eng** — no sub-goal token in goal text
- **pm-agent** — no sub-goal token in goal text
- **pr-agent** — no sub-goal token in goal text
- **tax-agent** — no sub-goal token in goal text
- **director-idle-improvement** — no sub-goal token in goal text

## Action
- `platform-eng`: (a) add a sub-goal token to its goal/mandate text, or (b) update CURRENT_GOAL.md if this loop should redefine the mission.
- `pm-agent`: (a) add a sub-goal token to its goal/mandate text, or (b) update CURRENT_GOAL.md if this loop should redefine the mission.
- `pr-agent`: (a) add a sub-goal token to its goal/mandate text, or (b) update CURRENT_GOAL.md if this loop should redefine the mission.
- `tax-agent`: (a) add a sub-goal token to its goal/mandate text, or (b) update CURRENT_GOAL.md if this loop should redefine the mission.
- `director-idle-improvement`: (a) add a sub-goal token to its goal/mandate text, or (b) update CURRENT_GOAL.md if this loop should redefine the mission.

## Structural notes (read-only observation, not drift)
- 27 agent YAMLs under `loops/agents/` use `mandate:`/`duties:` instead of `goal:` — the auditor now falls back to those keys. Consider standardizing on `goal:` in LOOPS_SPEC.
- `loops/agents/sdr-agent.yaml`: `kpis:` and `tools_allowed:` block bodies appear swapped (kpis holds a tool list; tools_allowed holds KPI prose). Flagged for Ahmad/Codex — NOT edited (loop YAMLs are read-only for this loop).
- `.git/index.lock` still present (stale since 2026-07-29) — no commits made; docs written to working tree only.
