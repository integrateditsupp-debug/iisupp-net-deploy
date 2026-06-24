---
id: t4-aigov-004
title: "AI / Agent Spend Guardrails"
category: ai-governance
support_level: L2
tech_generation: tier-4
tier4_pack: ai-governance
severity: medium
estimated_time_minutes: 60
audience: it-technician
os_scope: ["Windows 11","macOS","cross-platform"]
prerequisites: []
keywords: ["ai spend guardrails","token cost runaway","api budget caps","per agent quota","rate limiting","finops for ai","llm cost control","spend alerting","runaway agent cost","ai budget","cost anomaly","model cost governance"]
related_articles: ["t4-aigov-001","t4-aigov-002","t4-aigov-003","t4-aigov-005"]
escalation_trigger: "Agent/API spend is climbing with no cap or kill switch, or a single agent has already exceeded its budget by a large multiple."
last_updated: 2026-06-24
version: 1.0
---

## 1. Symptoms
- AI/API bills are rising unpredictably and no one can attribute cost to specific agents.
- A single agent looped or retried and ran up a large, unexpected charge.
- There are no per-agent budgets, rate caps, or quotas — every agent can spend without limit.
- No alert fires until the invoice arrives.
- Finance asks "what is driving AI cost?" and IT cannot break it down.

## 2. Likely Causes
- No budget/quota model: agents call paid APIs with shared keys and no ceiling.
- Loop/retry bugs or chatty prompts multiply token usage.
- No rate limiting, so an agent can fire calls as fast as the API allows.
- Cost is not tagged per agent, so attribution and accountability are impossible.
- No alerting on spend velocity — only on the final total.

## 3. Questions To Ask User
- Which agents call paid AI/APIs, and do they share keys or use per-agent keys?
- Is there any per-agent budget, rate cap, or daily/monthly quota today?
- How is cost attributed back to individual agents or teams?
- What alerting exists, and at what thresholds?
- Has any agent ever caused a cost spike? What stopped it?

## 4. Troubleshooting Steps
1. **Attribute current spend.** Map each paid call path to a specific agent/key. If keys are shared, that is the first gap to close.
2. **Find the cost drivers.** Identify the top agents by spend and check for loops, retries, oversized context, or unnecessarily large models.
3. **Check for any existing cap.** Determine whether any ceiling or rate limit exists at all (often none).
4. **Check alerting.** Confirm whether anything notifies before the bill, and at what threshold.

## 5. Resolution Steps
1. **Give each agent its own key/identity** so cost is attributable (ties to t4-aigov-005).
2. **Set per-agent budgets and quotas:** a daily and monthly cap per agent, sized to its job. Tier 3 agents get tighter scrutiny.
3. **Enforce rate caps:** maximum calls per minute/hour to blunt runaway loops.
4. **Add hard kill behavior:** when an agent hits its budget cap, it pauses/disables rather than continuing — a spend kill switch (coordinate with t4-aigov-002).
5. **Instrument cost in the audit trail:** record tokens/cost per action (t4-aigov-003) so spend is queryable per agent.
6. **Alert on velocity, not just totals:** notify when spend rate or call rate is anomalous, well before the budget is exhausted.
7. **Apply FinOps practice for AI:** regular cost reviews, right-size models (smaller/cheaper where adequate), cache where safe, and trim oversized context to cut tokens.

## 6. Verification Steps
- Each agent's spend is attributable to its own key/identity.
- Per-agent daily and monthly caps and rate caps are configured and tested (a test agent hitting its cap pauses).
- Spend/token cost appears per action in the audit trail.
- A velocity alert fires in a test before the budget is exhausted.
- A cost report can break spend down by agent/team.

## 7. Escalation Trigger
Escalate to L3 / finance owner if agent or API spend is climbing with no cap or kill switch in place, or if a single agent has already exceeded its budget by a large multiple (possible loop or abuse — also check t4-aigov-002).

## 8. Prevention Tips
- Default every new agent to a conservative budget and rate cap; require justification to raise it.
- Never share API keys across agents — attribution depends on per-agent identity.
- Make "cap + kill switch + alert" a launch requirement for any paid-API agent.
- Right-size models and context; the cheapest controllable cost is the call you do not make.
- Review AI spend on the same cadence as governance reviews (t4-aigov-001).

## 9. User-Friendly Explanation
AI agents cost money every time they "think" or call a paid service. Without limits, a small bug can make an agent spend in a loop and run up a surprising bill. Spend guardrails are like giving each agent a prepaid card with a daily and monthly limit, a speed limit on how fast it can spend, and a text alert if it starts spending too quickly — plus an automatic stop when it hits its cap. You get the benefits of agents without bill shock.

## 10. Internal Technician Notes
- Per-agent keys are the linchpin: without them, neither budgets nor attribution work cleanly.
- The spend kill switch should integrate with the IR kill switch (t4-aigov-002) so "stop spending" and "stop acting" are coherent.
- Token/cost capture lives in the audit trail (t4-aigov-003) — build once, use for both observability and FinOps.
- "FinOps for AI" = the same cost-visibility/right-sizing discipline applied to model and API usage.
- Velocity alerting catches runaway loops far earlier than total-based alerts.

## 11. Related KB Articles
- t4-aigov-001 — AI Agent Governance Framework
- t4-aigov-002 — AI Agent Incident Response Runbook
- t4-aigov-003 — AI Agent Audit Trail & Observability
- t4-aigov-005 — Agent Identity Onboarding & Offboarding

## 12. Keywords / Search Tags
ai spend guardrails, token cost runaway, api budget caps, per-agent quota, rate limiting, finops for ai, llm cost control, spend alerting, runaway agent cost, ai budget, cost anomaly, model cost governance
