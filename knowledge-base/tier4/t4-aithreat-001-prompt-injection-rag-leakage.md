---
id: t4-aithreat-001
title: "Prompt Injection & RAG/Data Leakage"
category: ai-security
support_level: L3
tech_generation: tier-4
tier4_pack: ai-threat
severity: critical
estimated_time_minutes: 90
audience: it-technician
os_scope: ["Windows 11","macOS","cross-platform"]
prerequisites: []
keywords: ["prompt injection","indirect prompt injection","rag data leakage","owasp llm top 10","mitre atlas","data exfiltration","untrusted content","tool abuse","llm jailbreak","output handling","least privilege llm","ai data exfil"]
related_articles: ["t4-aigov-002","t4-aigov-006","t4-aithreat-002","t4-aithreat-003"]
escalation_trigger: "An LLM-connected agent with tool or data access shows signs of following injected instructions or exfiltrating data."
last_updated: 2026-06-24
version: 1.0
---

## 1. Symptoms
- An AI assistant/agent ignores its instructions or behaves off-policy after processing a document, email, web page, or ticket.
- Sensitive data appears in an agent's output, in an external request, or somewhere it should not go.
- An agent performs an unexpected tool/API action it was never asked to do (send, fetch, delete, transfer).
- Retrieved content (from a knowledge base / RAG source) seems to "command" the model.
- Outputs contain hidden instructions, odd links, or attempts to disclose system prompts/secrets.

## 2. Likely Causes
- **Direct prompt injection:** a user crafts input that overrides the system instructions ("ignore previous instructions...").
- **Indirect prompt injection:** untrusted content the model *retrieves or reads* (web page, email, PDF, RAG document) contains hidden instructions the model then follows. (Mapped in OWASP LLM Top 10 and MITRE ATLAS as references.)
- **Excessive agency / tool over-permission:** the agent can call powerful tools, so an injected instruction becomes a real action (data exfil, sending, deleting).
- **Insecure output handling:** model output is trusted and rendered/executed downstream (e.g., into a browser, shell, or SQL) enabling injection-to-action.
- **RAG/data leakage:** the model surfaces content the requesting user should not see, or sensitive context is embedded in prompts and leaks.

## 3. Questions To Ask User
- Does the affected agent read untrusted/external content (web, email, uploaded files, tickets)?
- What tools/APIs can it call, and how broad are those permissions?
- Is its output rendered or executed by another system without validation?
- What data sources feed its RAG/knowledge retrieval, and who is allowed to see that data?
- When did the odd behavior start, and what input preceded it?

## 4. Troubleshooting Steps
1. **Capture the triggering input** from the audit trail (t4-aigov-003): the exact content the model processed before misbehaving.
2. **Classify the vector:** direct (user prompt) vs. indirect (retrieved/embedded content).
3. **Map the agency:** list the tools the agent can call and whether the suspect action was within its granted scope.
4. **Trace the data path:** identify what data could have been exfiltrated and through which tool/output channel.
5. **Check output handling:** see whether model output flows unchecked into a downstream system.

## 5. Resolution Steps
Mitigations are defense-in-depth; no single control is sufficient.
1. **Contain first** if active: treat as an incident — disable the agent and revoke tokens (t4-aigov-002).
2. **Input handling:** separate and clearly delimit untrusted content from instructions; do not let retrieved/external text be treated as commands. Sanitize/strip active content where feasible.
3. **Least privilege & least agency:** give the agent only the tools and data scopes it truly needs (t4-aigov-005). Remove powerful tools from agents that read untrusted content.
4. **Human-in-the-loop** for high-impact tool actions (send, transfer, delete, deploy) so an injected instruction cannot act unattended.
5. **Output handling:** validate, encode, and constrain model output before any downstream use; never execute or render it raw.
6. **Isolation/sandboxing:** run tool execution in constrained environments with egress controls so exfiltration paths are limited.
7. **RAG hygiene:** enforce per-user authorization on retrieval (the model must not surface data the user cannot access); keep secrets out of prompts/context; vet ingested documents.
8. **Monitoring:** alert on anomalous tool calls, unexpected outbound data, and signs of instruction-override in inputs.
9. **Test continuously:** red-team with injection payloads (reference OWASP LLM Top 10 and MITRE ATLAS techniques) before and after deploy.

## 6. Verification Steps
- Injected instructions in retrieved/external content no longer change the agent's behavior in a test.
- The agent's tool/data scope is minimized; high-impact actions require human confirmation.
- Model output passing to a downstream system is validated/encoded (a test injection does not execute).
- RAG retrieval respects per-user permissions (a user cannot retrieve data they are not entitled to).
- Monitoring fires on a simulated exfil/injection attempt.

## 7. Escalation Trigger
Escalate to L3 / security IR immediately if an LLM-connected agent with tool or data access shows signs of following injected instructions or exfiltrating data — handle as an active security incident, not a tuning issue.

## 8. Prevention Tips
- Assume any content the model reads can carry hidden instructions; never grant a content-reading agent powerful unattended tools.
- Default to least privilege and least agency; add scope only with justification.
- Keep secrets and sensitive context out of prompts; enforce authorization at the retrieval layer.
- Validate all model output before downstream use.
- Reference OWASP LLM Top 10 and MITRE ATLAS as living threat checklists; red-team regularly.

## 9. User-Friendly Explanation
Prompt injection is when text that an AI reads — a web page, an email, a document — secretly tells it to do something it should not, like leaking data or taking an unwanted action. Because the AI can be tricked by what it reads, the fixes are: do not give a reading AI dangerous powers, keep a human in the loop for risky actions, check anything the AI outputs before using it, and make sure it can only see data the person asking is allowed to see. It is the AI equivalent of "do not blindly follow instructions a stranger slipped into your inbox."

## 10. Internal Technician Notes
- OWASP LLM Top 10 and MITRE ATLAS are **references** for naming techniques and structuring tests — cite them, do not claim compliance/certification.
- The highest-leverage control is reducing *agency*: a content-reading agent with no powerful tools cannot be weaponized into action.
- Indirect injection via RAG/retrieved docs is the under-appreciated vector; vet ingested content and isolate retrieval.
- This frequently becomes an IR event — hand off to t4-aigov-002 for containment, and use the audit trail (t4-aigov-003) to find the triggering input and exfil path.
- Browser-extension/shadow-AI tools (t4-aigov-006) are common injection surfaces.

## 11. Related KB Articles
- t4-aigov-002 — AI Agent Incident Response Runbook
- t4-aigov-006 — Shadow-AI Discovery
- t4-aithreat-002 — AI Voice Phishing (Vishing) & Deepfake Audio
- t4-aithreat-003 — Deepfake Video / Executive Impersonation

## 12. Keywords / Search Tags
prompt injection, indirect prompt injection, rag data leakage, OWASP LLM Top 10, MITRE ATLAS, data exfiltration, untrusted content, tool abuse, llm jailbreak, insecure output handling, least privilege llm, excessive agency
