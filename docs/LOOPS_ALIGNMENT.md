# Loops Alignment — 2026-07-21

Top goal: Scale IIS to $1M ARR by 2027-06 via gov + biz IT contracts and ARIA/Growth Library digital products.

## Aligned (35/35)

- lead-radar: [goal] Each day pull the CanadaBuys "new tender notice" CSV + MERX search results + Ontario Tenders RSS. Filter by 40 — tokens: outbound replies
- aria-self-learn: [goal] Every 6 hours, scan ARIA chat audit log for queries that returned a generic fallback or low-confidence answer. — tokens: KB bits
- hard-rule-gatekeeper: [goal] After every Netlify deploy (and every 30 min as a safety net) fetch: https://iisupp.net/aperture-learning.html — serves: top-goal (no sub-goal token)
- spend-gatekeeper: [goal] Continuously audit every loop's run cost. Sum across all loops per day. Pause any loop whose cumulative day sp — serves: top-goal (no sub-goal token)
- goal-alignment: [goal] Once a day at 06:00 ET, read CURRENT_GOAL.md. For each loop in registry.json, verify its serves: field points  — serves: top-goal (no sub-goal token)
- codex-observer: [goal] Every working-day at 09:00 and 17:00, run observe-codex.mjs (--since=2d). Compare today's playbook to yesterda — serves: top-goal (no sub-goal token)
- tender-enrich: [goal] When lead-radar emits a match with score >= 60, this loop fetches the full solicitation page, extracts evaluat — tokens: outbound replies
- ae-agent: [mandate] Convert qualified opportunities to signed contracts. Proposals + negotiation prep. Receive HOT tender briefs f — tokens: paying client, outbound replies, Capability Statement
- ap-ar-clerk: [mandate] Invoice generation + payment tracking + vendor payment scheduling. Daily 21:00 ET pull AR aging from Stripe ·  — tokens: paying client
- bid-mgr: [mandate] Enrich HOT tenders. Pull eval criteria, value, required certs. Draft fit analysis. Fetch full solicitation pag — tokens: outbound replies, KB bits
- brand-mgr: [mandate] Visual stability + copy consistency + voice audit + brand guideline enforcement. Hourly scan of git diff for s — serves: top-goal (no sub-goal token)
- cco-agent: [mandate] Ethical design enforcement + human-review gate + legal review + privacy. Watches Legal, Privacy Officer, QA Au — tokens: paying client
- ceo-agent: [mandate] Set top-level goal. Allocate capital + agent priority. Approve high-risk actions. Read daily digests + LOOPS_L — tokens: paying client
- cfo-agent: [mandate] Spend governance + cash management + tax + financial forecast. Watches Treasurer, AP/AR, Tax Agent. Continuous — serves: top-goal (no sub-goal token)
- cmo-agent: [mandate] Brand voice + content production + demand gen + public visibility. Watches Content Strategist, Brand Mgr, Dema — serves: top-goal (no sub-goal token)
- content-strat: [mandate] Growth Library product authoring + KB article production. Daily 10:00 content calendar review · Trend Radar in — serves: top-goal (no sub-goal token)
- coo-agent: [mandate] Daily ops + sales pipeline + delivery. Watches Procurement Mgr, Bid Mgr, SDR, AE. Forecasts pipeline. Read pip — tokens: paying client, outbound replies
- cos-agent: [mandate] CEO leverage. Goal alignment across all agents. Status reporting. Email triage. Strategic projects. Daily goal — serves: top-goal (no sub-goal token)
- cto-agent: [mandate] Product reliability + KB quality + security posture + dev velocity. Watches SRE, Platform Eng, KB Eng, DevOps  — serves: top-goal (no sub-goal token)
- demand-gen: [mandate] Trend Radar continuous scanning. Feed Marketing pipeline. Campaign planning. Every 15 min trend scan (Google T — tokens: outbound replies
- devops-eng: [mandate] Post-deploy verification. Smoke tests. Performance monitoring. CI/CD pipeline health. On Netlify deploy webhoo — serves: top-goal (no sub-goal token)
- ea-agent: [mandate] Email triage + calendar orchestration + reminder/follow-up tracking. Every 30 min email triage (urgent/can-wai — serves: top-goal (no sub-goal token)
- kb-engineer: [mandate] Generate KB bits autonomously. Validate schema. Curate KB library quality. Every 6h scan ARIA audit log for fa — tokens: KB bits
- legal-counsel: [mandate] Contract review + terms of service + IP + procurement clause analysis. On contract input: review for liability — tokens: paying client, outbound replies
- platform-eng: [mandate] Watch Codex + Cowork commit patterns. Surface working-style deltas. Architectural drift detection. Twice-daily — serves: top-goal (no sub-goal token)
- pm-agent: [mandate] Task tracking across all loops + status digest + blocker flags. Daily 08:00 ET Mon-Fri scan of TaskList + LOOP — serves: top-goal (no sub-goal token)
- pr-agent: [mandate] LinkedIn page + press releases + public-facing copy. MWF 11:00 ET LinkedIn post draft (founder voice, no AI to — serves: top-goal (no sub-goal token)
- privacy-officer: [mandate] PIPEDA + PHIPA + GDPR posture. Data retention. Privacy impact assessments. Daily noon scan of data flows · PII — serves: top-goal (no sub-goal token)
- procurement-mgr: [mandate] Find new gov tenders + biz contracts daily. Score IIS-fit. Flag HOT matches. Pull MERX + CanadaBuys + Ontario  — tokens: paying client, outbound replies
- qa-auditor: [mandate] Fact-check claims + source verification + fake-data guard + benchmark verification. On public-facing artifact: — serves: top-goal (no sub-goal token)
- sdr-agent: [mandate] Cold outreach pipeline. Build prospect lists. Personalize emails. Enroll in sequences. Daily 08:30 ET prospect — tokens: outbound replies
- sre-agent: [mandate] Uptime + HARD RULE verification + auto-rollback on regression. Curl aperture-learning.html (200 + login form)  — serves: top-goal (no sub-goal token)
- tax-agent: [mandate] CRA tax workbook sync. Monthly reconciliation. Annual return prep. Daily 21:00 ET pull new expenses from recei — serves: top-goal (no sub-goal token)
- treasurer: [mandate] Enforce $0 spend lockdown. Pause any loop that breaches budget. Track approved exceptions. Every 15 min audit  — serves: top-goal (no sub-goal token)
- director-idle-improvement: [goal] When any direct report is idle AND the queue is empty AND the CEO is not blocked/waiting, the Director Agent d — serves: top-goal (no sub-goal token)

## Drifting (0) — flag to Ahmad

- none

## Advisory — weak alignment (21)

Passes only on `serves: top-goal`; goal/mandate text contains zero sub-goal tokens. Not a drift flag under LOOPS_SPEC §8g, but these will silently pass every future audit:

- hard-rule-gatekeeper (goal)
- spend-gatekeeper (goal)
- goal-alignment (goal)
- codex-observer (goal)
- brand-mgr (mandate)
- cfo-agent (mandate)
- cmo-agent (mandate)
- content-strat (mandate)
- cos-agent (mandate)
- cto-agent (mandate)
- devops-eng (mandate)
- ea-agent (mandate)
- platform-eng (mandate)
- pm-agent (mandate)
- pr-agent (mandate)
- privacy-officer (mandate)
- qa-auditor (mandate)
- sre-agent (mandate)
- tax-agent (mandate)
- treasurer (mandate)
- director-idle-improvement (goal)

## Schema finding

- 27/35 registered loops are agent YAMLs under `loops/agents/` and use `mandate:` + `duties:` instead of `goal:`. The literal step-3b check (`extract the goal: field`) returns nothing for all of them. This audit fell back to `mandate:`+`duties:`; without that fallback the audit would report 27 false drifters.
- Several agent YAMLs have transposed keys: the `kpis:` block holds the tools list and `tools_allowed:` holds the KPI sentence (confirmed in ceo-agent.yaml, sdr-agent.yaml). READ-ONLY here — not edited. Recommend Codex fix in one pass.

## Action

- 0 drifting loops → no goal rewrites required this cycle.
- Recommend (a) Codex adds a one-line `goal:` field to the 27 agent YAMLs mirroring `mandate:`, so the audit stops depending on a fallback; or (b) LOOPS_SPEC §8g is amended to accept `mandate:` as the goal field for class-agent loops.
- Recommend the 21 weak-alignment loops each name the sub-goal they serve (e.g. `serves: top-goal#3`) so `serves:` stops being a blanket pass.
- Recommend Codex repair the transposed `kpis:`/`tools_allowed:` keys across loops/agents/*.yaml.
