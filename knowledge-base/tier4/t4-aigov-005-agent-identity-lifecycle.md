---
id: t4-aigov-005
title: "Agent Identity Onboarding & Offboarding"
category: ai-governance
support_level: L3
tech_generation: tier-4
tier4_pack: ai-governance
severity: high
estimated_time_minutes: 75
audience: it-technician
os_scope: ["Windows 11","macOS","cross-platform"]
prerequisites: []
keywords: ["agent identity lifecycle","non-human identity","service account agent","least privilege","secret rotation","deprovisioning agent","machine identity","credential management","agent offboarding","scoped tokens","identity governance","orphaned credentials"]
related_articles: ["t4-aigov-001","t4-aigov-002","t4-aigov-003","t4-aigov-004","t4-aigov-006"]
escalation_trigger: "A retired agent's credentials are still active, or an agent is running on a human's personal login or an over-privileged shared account."
last_updated: 2026-06-24
version: 1.0
---

## 1. Symptoms
- Agents authenticate using a developer's personal credentials or a broad shared account.
- Retired/decommissioned agents still have live keys, tokens, or accounts that nobody disabled.
- No one can list which non-human (agent/service) identities exist or what they can access.
- Secrets are hard-coded, never rotated, and stored in plaintext or source.
- An agent's permissions far exceed what its job requires (no least privilege).

## 2. Likely Causes
- Agents were stood up quickly using whatever credentials were handy.
- No onboarding process that issues a dedicated, scoped identity per agent.
- No offboarding process, so credentials outlive the agent (orphaned identities).
- Secrets management was never formalized — keys in config files, repos, or chat.
- Permissions were granted broadly "to make it work," never tightened.

## 3. Questions To Ask User
- Does each agent have its own dedicated service/non-human identity, or does it borrow a person's or shared login?
- Where are agent secrets stored, and how often are they rotated?
- When an agent is retired, what process disables its identity and revokes its keys?
- Can you produce a list of all agent identities and their permissions?
- Are any agents running with admin/broad rights they do not need?

## 4. Troubleshooting Steps
1. **Enumerate non-human identities** tied to agents: accounts, service principals, API keys, tokens.
2. **Map each to an agent and owner** (cross-reference the register, t4-aigov-001). Flag any identity with no live agent — likely orphaned.
3. **Review permissions** for each: compare granted scope to the agent's actual job. Flag over-privilege.
4. **Review secret handling:** where stored, how rotated, who can read them.

## 5. Resolution Steps
1. **Onboarding (issue):** Every agent gets a dedicated, named non-human/service identity — never a person's login, never a broad shared account.
2. **Least privilege:** Grant only the specific scopes/tools the agent needs for its job; deny by default and add narrowly.
3. **Secrets management:** Store credentials in a secrets store (not in code/config/chat). Use short-lived, scoped tokens where possible.
4. **Rotation:** Define and automate a rotation schedule for keys/secrets; rotate immediately on suspected compromise or after an incident (t4-aigov-002).
5. **Lifecycle binding:** Tie the identity's existence to the agent's lifecycle in the register — created when the agent is approved, reviewed periodically.
6. **Offboarding (deprovision):** When an agent is retired or re-scoped, disable its identity, revoke and delete its keys/tokens, and remove its access. Confirm no orphaned credentials remain.
7. **Attribution:** Per-agent identities also enable cost attribution (t4-aigov-004) and clean audit trails (t4-aigov-003).

## 6. Verification Steps
- Every agent uses a dedicated non-human identity, not a personal or broad shared account.
- Each identity's permissions match its job (spot-check confirms no excess scope).
- Secrets live in a secrets store and have a rotation schedule that has actually run.
- A test offboarding leaves no live keys/tokens for the retired agent (re-auth fails).
- No orphaned agent identities remain in the directory/key inventory.

## 7. Escalation Trigger
Escalate to L3 / security if a retired agent's credentials are still active, if an agent is running on a human's personal login, or if an agent holds over-privileged or admin rights it does not need — each is a standing breach risk.

## 8. Prevention Tips
- "One agent, one scoped identity" — enforce at onboarding.
- Bind identity creation and destruction to the agent register so offboarding is never skipped.
- Prefer short-lived, scoped tokens over long-lived static keys.
- Rotate secrets on a schedule and after any incident.
- Run periodic access reviews to catch privilege creep and orphaned identities (overlaps with shadow-AI discovery, t4-aigov-006).

## 9. User-Friendly Explanation
Treat each AI agent like a staff member with their own badge. Give it its own login (not a person's), only the access it actually needs, and keys that get changed regularly and kept in a safe place. When the agent is no longer used, deactivate its badge and take back its keys — the same way you would offboard an employee who leaves. The biggest risk is a "ghost" agent whose login still works long after the agent is gone.

## 10. Internal Technician Notes
- Orphaned credentials are a top finding in AI environments — they are quiet until abused. Tie identity lifecycle to the register so retirement forces deprovisioning.
- Per-agent identity is the foundation that makes audit trails (t4-aigov-003) and spend attribution (t4-aigov-004) work; sell these together.
- Least privilege directly limits IR blast radius (t4-aigov-002).
- "Non-human identity" / "machine identity" is the industry term — use it when scoping with clients.
- Shadow-AI discovery (t4-aigov-006) often surfaces unmanaged identities to bring into this lifecycle.

## 11. Related KB Articles
- t4-aigov-001 — AI Agent Governance Framework
- t4-aigov-002 — AI Agent Incident Response Runbook
- t4-aigov-003 — AI Agent Audit Trail & Observability
- t4-aigov-004 — AI / Agent Spend Guardrails
- t4-aigov-006 — Shadow-AI Discovery

## 12. Keywords / Search Tags
agent identity lifecycle, non-human identity, service account agent, least privilege, secret rotation, deprovisioning agent, machine identity, credential management, agent offboarding, scoped tokens, identity governance, orphaned credentials
