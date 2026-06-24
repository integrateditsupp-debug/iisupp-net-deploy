---
id: t4-aigov-006
title: "Shadow-AI Discovery"
category: ai-governance
support_level: L2
tech_generation: tier-4
tier4_pack: ai-governance
severity: high
estimated_time_minutes: 75
audience: it-technician
os_scope: ["Windows 11","macOS","cross-platform"]
prerequisites: []
keywords: ["shadow ai","unsanctioned ai tools","browser extension risk","ai data leakage","ai discovery","saas ai sprawl","sanctioning workflow","unapproved ai","data loss prevention","ai usage visibility","rogue ai apps","employee ai tools"]
related_articles: ["t4-aigov-001","t4-aigov-005","t4-aithreat-001","t4-aithreat-002"]
escalation_trigger: "An unsanctioned AI tool is found to have received sensitive, regulated, or customer data."
last_updated: 2026-06-24
version: 1.0
---

## 1. Symptoms
- Employees are using AI chatbots, copilots, agents, or browser extensions that IT never approved or knows about.
- Sensitive data (customer records, code, contracts, PII) may be getting pasted into external AI tools.
- New AI browser extensions appear on managed devices.
- Unexpected AI-related SaaS charges or signups show up.
- Leadership cannot answer "what AI tools are our people actually using?"

## 2. Likely Causes
- Easy, free, self-serve AI tools let anyone adopt them without IT.
- No approved-AI list, so employees do not know what is sanctioned.
- Browser extension stores make adding AI helpers a one-click action.
- Remote/BYOD blurs the boundary of what IT can see.
- A genuine productivity need that sanctioned tools have not yet met.

## 3. Questions To Ask User
- Do you have an approved-AI list, and do employees know it exists?
- What visibility do you have into web traffic, browser extensions, and SaaS signups?
- Are people handling sensitive/regulated data that must not leave the org?
- Have any AI-related charges or signups appeared that IT did not authorize?
- Is there a process to request and approve a new AI tool today?

## 4. Troubleshooting Steps
1. **Discover via multiple methods (triangulate):**
   - Network/web egress: identify traffic to known AI service domains.
   - Endpoint/browser: enumerate installed browser extensions and desktop AI apps on managed devices.
   - SaaS/identity: review SSO/OAuth grants and expense/billing for AI signups.
   - Survey: ask teams what they use (people often disclose when not punished).
2. **Catalog findings:** tool, who uses it, for what, and what data flows to it.
3. **Assess data-leak risk:** flag any tool that may have received sensitive/regulated/customer data as high priority.
4. **Check for agent-like tools** that take actions (not just chat) — these also need identity governance (t4-aigov-005).

## 5. Resolution Steps
1. **Triage each discovered tool:** sanction, restrict, or block, based on risk and data handling.
2. **Run the sanctioning workflow** for tools worth keeping:
   - Assess vendor data handling/retention and where data goes.
   - Define allowed use and what data may/may not be entered.
   - Bring it under governance: owner, register entry (t4-aigov-001), and identity/permissions if it acts (t4-aigov-005).
   - Approve and add to the published approved-AI list.
3. **Block or restrict** high-risk or non-compliant tools (extension allow/deny lists, egress controls, DLP rules on sensitive data).
4. **Provide a sanctioned alternative** so the underlying need is met — shadow AI thrives where official tools are missing.
5. **Publish the approved-AI list and a simple request path** so future adoption flows through IT instead of around it.
6. **For confirmed data exposure,** treat it as a data incident (notify, assess scope; coordinate with t4-aithreat-001 if injection/exfil is involved).

## 6. Verification Steps
- A consolidated inventory of discovered AI tools exists with users, purpose, and data flows.
- Each tool has a disposition: sanctioned / restricted / blocked.
- Sanctioned tools appear on a published approved-AI list and in the governance register.
- High-risk tools are demonstrably blocked or restricted (test the control).
- A working request-and-approve path for new AI tools is documented and communicated.

## 7. Escalation Trigger
Escalate to L3 / security and data-privacy leadership if an unsanctioned AI tool is found to have received sensitive, regulated, or customer data — treat as a potential data-exposure incident.

## 8. Prevention Tips
- Publish a clear approved-AI list and an easy request path; make the sanctioned route the path of least resistance.
- Use DLP and egress visibility to catch sensitive data heading to AI services.
- Manage browser extensions with allow/deny lists on managed devices.
- Rediscover on a cadence — shadow AI regrows; treat discovery as recurring, not one-time.
- Educate staff on *why* limits exist (data leakage) rather than only saying "no."

## 9. User-Friendly Explanation
"Shadow AI" is any AI tool your team uses that IT did not approve — a chatbot, a writing helper, a browser add-on. The danger is that company or customer information can quietly end up on an outside service. Discovery is simply finding out what is actually in use, deciding which tools are safe to keep, blocking the risky ones, and giving people an approved option so they do not feel they have to go around IT. The goal is enabling AI safely, not banning it.

## 10. Internal Technician Notes
- Triangulate across network, endpoint, and identity/SaaS signals — no single method finds everything.
- The most valuable output is the approved-AI list plus an easy request path; without an alternative, blocking just pushes shadow AI further underground.
- Agentic shadow tools (those that take actions) must be funneled into identity lifecycle (t4-aigov-005) and the register (t4-aigov-001).
- Confirmed sensitive-data exposure = data incident; loop in privacy stakeholders. Browser AI extensions are also a prompt-injection/exfil surface (t4-aithreat-001).
- Respect privacy when surveying staff; a non-punitive ask yields far better disclosure.

## 11. Related KB Articles
- t4-aigov-001 — AI Agent Governance Framework
- t4-aigov-005 — Agent Identity Onboarding & Offboarding
- t4-aithreat-001 — Prompt Injection & RAG/Data Leakage
- t4-aithreat-002 — AI Voice Phishing (Vishing) & Deepfake Audio

## 12. Keywords / Search Tags
shadow ai, unsanctioned ai tools, browser extension risk, ai data leakage, ai discovery, saas ai sprawl, sanctioning workflow, unapproved ai, data loss prevention, ai usage visibility, rogue ai apps, employee ai tools
