---
id: t4-aigov-002
title: "AI Agent Incident Response Runbook"
category: ai-governance
support_level: L3
tech_generation: tier-4
tier4_pack: ai-governance
severity: critical
estimated_time_minutes: 60
audience: it-technician
os_scope: ["Windows 11","macOS","cross-platform"]
prerequisites: []
keywords: ["ai agent incident response","agent misbehavior","revoke agent credentials","disable agent","blast radius","rollback agent actions","ai root cause analysis","containment runbook","rogue agent","agentic incident","kill switch","ai ir runbook"]
related_articles: ["t4-aigov-001","t4-aigov-003","t4-aigov-005","t4-aithreat-001"]
escalation_trigger: "An agent has taken or is taking irreversible, financial, or customer-impacting actions, or its containment is uncertain."
last_updated: 2026-06-24
version: 1.0
---

## 1. Symptoms
- An AI agent took a wrong or unexpected action (sent the wrong email, modified/deleted records, made a purchase, deployed code, escalated privileges).
- An agent is looping, spamming actions, or burning API/cost at an abnormal rate.
- An agent's outputs suddenly changed character (off-policy, manipulated, leaking data) — possible prompt injection (see t4-aithreat-001).
- Users or customers report receiving something the business did not intend to send.
- Monitoring/alerts fired on anomalous agent behavior or spend.

## 2. Likely Causes
- A flawed instruction, tool, or change pushed the agent off its intended path.
- Prompt injection or poisoned/untrusted content steered the agent (see t4-aithreat-001).
- Over-broad permissions let a small error become a large impact (no least privilege).
- Missing human-in-the-loop on an irreversible action.
- An upstream dependency (model, API, data source) changed behavior.
- A loop/retry bug caused runaway actions or cost.

## 3. Questions To Ask User
- What did the agent do, and when did it start? Is it still running right now?
- Which systems, records, customers, or funds were touched?
- Whose credentials/identity does the agent use, and can we disable them immediately?
- Are the actions reversible, and is there a backup or audit log?
- Did any external/untrusted content reach the agent (email, web page, document, ticket)?
- Who is the named owner of this agent (per the register, t4-aigov-001)?

## 4. Troubleshooting Steps
1. **Confirm scope of activity.** Pull the agent's recent action/tool-call log (see t4-aigov-003) to see exactly what it did and is doing.
2. **Identify the identity.** Determine the service identity/token the agent uses so you can cut it off precisely.
3. **Determine reversibility.** Classify each action as reversible (record edit with history) or irreversible (payment, external send, deletion).
4. **Look for a cause vector.** Check whether untrusted input, a recent change, or a dependency shift triggered the behavior.

## 5. Resolution Steps
Follow the IR phases in order. Speed of containment beats perfect diagnosis.
1. **Contain (immediately):**
   - Disable the agent (stop the process / flip its kill switch / disable the schedule).
   - **Revoke its credentials and tokens** so it cannot act even if it restarts.
   - Cut tool/API access (disable the service account, rotate the key).
2. **Assess blast radius:**
   - Enumerate every action taken in the incident window using the audit trail.
   - List affected systems, records, customers, and any money moved.
   - Flag irreversible actions for manual remediation/notification.
3. **Roll back / remediate:**
   - Restore changed/deleted data from history or backup.
   - Recall or correct erroneous communications where possible; notify affected parties for what cannot be recalled.
   - Reverse or dispute financial actions through the appropriate channel.
4. **Root cause:**
   - Determine *why* the agent acted wrongly (instruction flaw, injection, permission gap, missing human gate, dependency change).
   - Capture a timeline and the triggering input.
5. **Recover safely:**
   - Fix the root cause, tighten permissions, add/restore guardrails, and add a human-in-the-loop gate if the action was irreversible.
   - Re-enable the agent only after the owner signs off.
6. **Document & learn:**
   - Write the incident up; feed lessons back into the governance framework (t4-aigov-001) and update the runbook.

## 6. Verification Steps
- The agent is provably stopped and its credentials/tokens are revoked (test that it cannot act).
- The full list of actions in the incident window is reconstructed and accounted for.
- Reversible actions are rolled back; irreversible ones have owners and remediation/notification plans.
- A documented root cause exists with a corrective action.
- The agent only resumes after fix + owner sign-off; new guardrails are confirmed active.

## 7. Escalation Trigger
Escalate to L3 / security leadership and the agent's business owner immediately if the agent took or is taking irreversible, financial, or customer-impacting actions, if containment is uncertain, or if prompt injection / external compromise is suspected (then also engage the security IR process).

## 8. Prevention Tips
- Pre-build a **kill switch** and credential-revocation path for every Tier 2/3 agent — do not improvise during an incident.
- Enforce least privilege so a single error has a small blast radius.
- Require human-in-the-loop on irreversible actions (see t4-aigov-001).
- Keep tamper-evident action logs so blast-radius assessment is fast (see t4-aigov-003).
- Run a tabletop exercise: practice containing a misbehaving agent before it happens.
- Alert on anomalous action rate and spend (see t4-aigov-004).

## 9. User-Friendly Explanation
If an AI agent starts doing the wrong thing, treat it like a tool that has gone haywire: first pull the plug, then take away its keys so it cannot restart and do more. After it is safely stopped, you figure out everything it touched, undo what you can, warn anyone affected by what you can't undo, and find out *why* it went wrong so it does not happen again. The order matters — stop first, investigate second.

## 10. Internal Technician Notes
- "Revoke creds/tokens" is the non-negotiable second step after disable; a stopped agent that can re-auth is not contained.
- Blast-radius assessment depends entirely on having an audit trail (t4-aigov-003). If logging is weak, that is a finding to fix post-incident.
- If injection is the cause, this becomes a security incident — pivot to t4-aithreat-001 mitigations and the org's security IR process.
- Aperture-style dashboards can surface the per-agent action timeline used for blast radius.
- Always re-enable behind an owner sign-off; never silently restart a contained agent.

## 11. Related KB Articles
- t4-aigov-001 — AI Agent Governance Framework
- t4-aigov-003 — AI Agent Audit Trail & Observability
- t4-aigov-005 — Agent Identity Onboarding & Offboarding
- t4-aithreat-001 — Prompt Injection & RAG/Data Leakage

## 12. Keywords / Search Tags
ai agent incident response, agent misbehavior, revoke agent credentials, disable agent, kill switch, blast radius, rollback agent actions, ai root cause, containment runbook, rogue agent, agentic incident, ai ir runbook
