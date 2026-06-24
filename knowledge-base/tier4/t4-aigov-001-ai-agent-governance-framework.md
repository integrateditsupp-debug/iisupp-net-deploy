---
id: t4-aigov-001
title: "AI Agent Governance Framework for the Enterprise"
category: ai-governance
support_level: L3
tech_generation: tier-4
tier4_pack: ai-governance
severity: high
estimated_time_minutes: 90
audience: it-technician
os_scope: ["Windows 11","macOS","cross-platform"]
prerequisites: []
keywords: ["ai agent governance","autonomous agent policy","ai risk tiering","human in the loop","nist ai rmf","iso 42001","agent inventory","agent ownership","ai guardrails","approval workflow","agentic ai controls","ai governance framework"]
related_articles: ["t4-aigov-002","t4-aigov-003","t4-aigov-005","t4-aigov-006"]
escalation_trigger: "An autonomous agent is operating in production with write/financial/customer-facing scope and no documented owner, risk tier, or approval gate."
last_updated: 2026-06-24
version: 1.0
---

## 1. Symptoms
- Autonomous or semi-autonomous AI agents are running in the business with no central record of what they do or who owns them.
- Teams cannot answer "which agents can take actions on their own, and what is the worst thing they could do?"
- Agents have broad permissions (email send, file write, code deploy, payments) with no approval gate or human review.
- Leadership asks for an "AI risk posture" and IT has no inventory, no risk tiers, and no policy to point to.
- Auditors, insurers, or customers request evidence of AI oversight and none exists.

## 2. Likely Causes
- Rapid bottom-up adoption: individual teams stood up agents (scripts, copilots, RPA-plus-LLM bots) faster than governance could form.
- No defined ownership model — agents inherit a developer's personal credentials instead of a managed service identity.
- Absence of a risk-tiering scheme, so a low-risk summarizer and a high-risk payment agent are treated identically.
- No mapping to a recognized framework (e.g., NIST AI Risk Management Framework, ISO/IEC 42001) to anchor controls.
- Guardrails (scope limits, human-in-the-loop, spend caps) were never required as a condition of going live.

## 3. Questions To Ask User
- How many AI agents do you know about, and is there a written list? Who maintains it?
- For each agent: what can it *do* on its own (read-only vs. write vs. financial vs. customer-facing)?
- Whose identity/credentials does each agent use — a managed service account or a person's login?
- Are there any approval steps or human review before an agent's action takes effect?
- Has anything gone wrong (wrong email sent, wrong record updated, runaway cost)?
- Do you have any compliance, insurance, or contractual obligation that references AI oversight?

## 4. Troubleshooting Steps
1. **Build an inventory.** Enumerate every agent: name, purpose, trigger, tools/APIs it can call, data it touches, identity it uses, and current owner. Treat anything calling an LLM with action capability as in-scope.
2. **Assign ownership.** Every agent must have a named business owner and a named technical owner. No owner = candidate for shutdown.
3. **Risk-tier each agent.** A simple 3-tier model: Tier 1 (read-only / advisory, low blast radius), Tier 2 (writes to internal systems, reversible), Tier 3 (financial, customer-facing, irreversible, or safety-relevant). Tier drives required controls.
4. **Map controls to a framework.** Use NIST AI RMF functions (Govern, Map, Measure, Manage) and ISO/IEC 42001 concepts as *references* to structure controls — do not claim certification or compliance.
5. **Check guardrails per tier.** Confirm scope limits, least privilege, human-in-the-loop where required, logging, and spend caps exist for each agent at its tier.

## 5. Resolution Steps
1. Publish an **AI Agent Register** (the inventory) as the single source of truth; require new agents to be registered before production use.
2. Adopt a **tiered control matrix**:
   - Tier 1: registration, basic logging, owner named.
   - Tier 2: above + scoped service identity, audit trail (see t4-aigov-003), rollback plan.
   - Tier 3: above + mandatory human-in-the-loop approval, spend guardrails (see t4-aigov-004), incident runbook (see t4-aigov-002), and sign-off by the business owner before launch.
3. Implement an **approval gate**: a lightweight intake/review where a new or changed Tier 2/3 agent is assessed against the matrix before it can act.
4. Require **human-in-the-loop** for irreversible or high-impact actions — the agent proposes, a human confirms.
5. Document the **policy** (1–3 pages): scope, definitions, tiers, required controls per tier, owner responsibilities, and the review cadence (e.g., quarterly).
6. Schedule a **recurring review** of the register and tiers; retire or re-scope agents that no longer have a clear owner or purpose.

## 6. Verification Steps
- Every known agent appears in the register with owner, purpose, tier, and identity.
- Each Tier 3 agent has a documented human-in-the-loop gate that you can demonstrate.
- A spot check of one agent confirms its real permissions match its registered scope (no over-provisioning).
- The policy document exists, is approved, and names a review cadence.
- A new test agent cannot reach production without passing the approval gate.

## 7. Escalation Trigger
Escalate to L3 / security leadership if an autonomous agent is operating in production with write, financial, or customer-facing scope and has no documented owner, no risk tier, or no approval gate — or if an ungoverned agent already took an action with real business or customer impact.

## 8. Prevention Tips
- Make registration mandatory: "no register entry, no production."
- Default new agents to the lowest privilege and lowest tier; require justification to raise scope.
- Bake guardrails into templates so new agents inherit logging, scope limits, and spend caps by default.
- Review the register on a fixed cadence and after any incident.
- Keep the framework mapping (NIST AI RMF / ISO 42001) as living references, revisited as those documents evolve.

## 9. User-Friendly Explanation
Think of AI agents like new employees who can act on the company's behalf. You would not let a new hire send payments or email customers on day one without knowing who they are, what they are allowed to do, and who supervises them. AI agent governance is simply giving every agent a job description, a manager, a permission level, and — for the risky ones — a "check with a human first" rule. It is not about slowing things down; it is about knowing what your agents can do before something goes wrong.

## 10. Internal Technician Notes
- Anchor everything to the register; it is the artifact auditors and insurers will ask for.
- NIST AI RMF and ISO/IEC 42001 are **references** for structuring controls. Never state or imply the client is "certified" or "compliant" — these articles are advisory/readiness only.
- The Aperture dashboard concept (see t4-aigov-003) is a natural home for the live agent inventory and per-agent action logs.
- Tier 3 = irreversible/financial/customer-facing/safety. When in doubt, tier up.
- This article pairs with the IR runbook (t4-aigov-002), audit trail (t4-aigov-003), spend guardrails (t4-aigov-004), and agent identity lifecycle (t4-aigov-005).

## 11. Related KB Articles
- t4-aigov-002 — AI Agent Incident Response Runbook
- t4-aigov-003 — AI Agent Audit Trail & Observability
- t4-aigov-004 — AI / Agent Spend Guardrails
- t4-aigov-005 — Agent Identity Onboarding & Offboarding
- t4-aigov-006 — Shadow-AI Discovery

## 12. Keywords / Search Tags
ai agent governance, autonomous agent policy, ai risk tiering, human in the loop, NIST AI RMF, ISO/IEC 42001, agent inventory, agent register, ai guardrails, approval gate, agentic ai controls, least privilege agents
