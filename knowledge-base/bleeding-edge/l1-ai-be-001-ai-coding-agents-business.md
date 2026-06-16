---
id: l1-ai-be-001
title: "AI coding agents at work — Claude Code, GitHub Copilot agents, Cursor, ChatGPT business use"
category: ai-tooling
support_level: L1
severity: low
estimated_time_minutes: 25
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
tech_generation: bleeding-edge
year_range: "2024-2026"
eol_status: "Current. Field moving fast — review article quarterly."
prerequisites: ["Modern OS, Node.js or npm installed, GitHub or Anthropic / OpenAI account, license entitlement from employer or paid plan"]
keywords:
  - claude code
  - github copilot
  - copilot workspace
  - copilot agents
  - cursor
  - chatgpt business
  - chatgpt enterprise
  - anthropic console
  - terminal coding
  - agentic
  - ai pair programming
  - data residency
  - dlp
  - data loss prevention
related_articles:
  - l1-windows-be-001-windows-11-25h1-copilot-plus
  - l1-mac-be-001-macos-16-apple-intelligence
  - l3-security-001
escalation_trigger: "Employee handling regulated data (HIPAA, PCI, GDPR, trade secrets) needs to use AI coding tools → DLP review + appropriate plan tier required before approval."
last_updated: 2026-05-11
version: 1.0
---

# AI coding agents at work — Claude Code, GitHub Copilot agents, Cursor, ChatGPT business use

## 1. Symptoms
Employee wants to use Claude Code, Cursor, GitHub Copilot's agentic mode, or ChatGPT inside their workflow. Customer asks "is it safe?", "should we pay for it?", "what stops the AI from reading my code?", or "how do I set it up?". Sometimes the question is "we found someone using free ChatGPT with company source code — is that bad?".

## 2. Likely Causes / Context
1. **Productivity demand** — AI coding agents demonstrably 2-4x throughput on repetitive code work. Refusing them puts the business behind.
2. **Wrong plan tier** — free / personal tiers train on user data by default; business tiers do not.
3. **No DLP policy** — staff use whatever they want, code with secrets / customer data goes to public chat windows.
4. **MDM not enforcing extension lists** — staff install Cursor / unofficial Copilot variants without IT approval.

## 3. Questions To Ask User
1. What tool do you want to use, or is being used right now? (Claude Code, ChatGPT, Copilot, Cursor, Windsurf, Replit, Aider, others.)
2. What data will the tool see? (Source code only? Customer data? Financial records? Patient records?)
3. Personal account, employer account, or both?
4. Are you a developer, an analyst, or a general business user?
5. Does the business have a written AI use policy?

## 4. Triage Steps
1. Identify data sensitivity tier:
   - Tier A: public / open-source code, marketing copy → any AI tool fine.
   - Tier B: proprietary code, internal docs, customer PII at low volume → paid business-tier tool with no-training clause required.
   - Tier C: regulated data (PHI, PCI, classified, legal privilege) → no AI tool without DLP gate + approved plan + audit log.
2. Check current employer plan: ask user to share account dashboard URL or screenshot of plan name.
3. Recommend tool + plan combo.

## 5. Resolution — by tool

**Claude Code (Anthropic):**
- Plans:
  - **Pro / Max:** personal use, $20-200/mo, training off by default since 2025.
  - **Team:** $30/seat/mo, admin console, billing, no training, audit logs.
  - **Enterprise:** custom pricing, SSO, advanced DLP, custom retention, BAA available for HIPAA.
- Install: `npm install -g @anthropic-ai/claude-code` then `claude` in terminal.
- Best for: deep multi-file code work, agentic refactors, infra scripts.
- Data: code in working directory sent to Anthropic API per request; no training when using API key auth; conversation history retained 30 days for abuse review, then deleted.

**GitHub Copilot (Microsoft):**
- Plans:
  - **Individual:** $10/mo, code completion + chat, training opt-out in settings.
  - **Business:** $19/seat/mo, no training ever, content exclusions per repo, audit log via GitHub.
  - **Enterprise:** $39/seat/mo, GitHub.com + GitHub Enterprise integration, fine-grained policy, indexed org context.
- Install: VS Code / JetBrains / Visual Studio extension, sign in with GitHub.
- Best for: inline code completion, PR review, repo-aware chat. **Copilot Workspace** (preview) → agentic mode for full task execution.

**Cursor:**
- Plans: Free, Pro $20/mo, Business $40/seat/mo. Business adds privacy mode + admin dashboard + zero retention.
- Install: download from cursor.com — it's a fork of VS Code.
- Best for: heavy IDE users who want Copilot+ChatGPT in one product. Excellent for refactor across many files.

**ChatGPT Business / Enterprise (OpenAI):**
- Plans:
  - **Free / Plus / Pro:** consumer plans — training on by default; toggle off in settings. **Not appropriate for company code.**
  - **Team:** $25/seat/mo annual, no training, shared workspace.
  - **Enterprise:** custom pricing, SSO, SCIM, audit log, DLP, BAA for HIPAA.
- Best for: writing, analysis, code as a side use. Not as deep as Claude Code or Copilot for code work specifically.

**Recommended default stack for a small business (10-50 staff):**
1. **Code-heavy roles (engineers, analysts):** Claude Code Team + GitHub Copilot Business. ~$50/seat/mo combined.
2. **General staff (sales, marketing, ops):** ChatGPT Team OR Microsoft 365 Copilot. ~$25-30/seat/mo.
3. **DLP + policy:** written AI use policy, MDM-enforced extension allowlist, quarterly audit.

## 6. Verification Steps
- User on a paid business plan, not free / personal.
- "Do not train on my data" toggle confirmed in account settings.
- For dev tools: `.cursorignore` / `.copilotignore` / `.claude-ignore` (or workspace .gitignore) excludes secrets, env files, customer data dumps.
- Repo-level secret scanning enabled (GitHub Advanced Security or equivalent).

## 7. Escalation Trigger
- User wants to send PHI / PCI / trade secret data to AI → STOP, escalate to L2/L3 + management. Tier C data needs written approval + DLP gate.
- Free-tier ChatGPT usage with company code in history → escalate to L2 for incident response (assume code is exposed for training; assess what was sent + decide on rotation of secrets).
- Customer wants to self-host an LLM for true air-gap → L3 architecture (Llama 3, Mistral on local hardware or Azure / AWS private endpoint).

## 8. Prevention Tips
- **Written AI use policy** before tools roll out. Cover: which tools are approved, what data tier is allowed in each, no consumer-tier with company data, mandatory training-off settings.
- **MDM allowlist** for browser extensions and IDE extensions tied to AI tools.
- **Quarterly DLP review** of AI tool usage — most providers offer admin audit logs.
- **Secrets manager** (1Password, Doppler, AWS Secrets Manager) — never paste API keys / database URLs into AI chats.
- **Train staff** on prompt hygiene: how to anonymize / redact before sending.

## 9. User-Friendly Explanation
AI coding tools like Claude Code, GitHub Copilot, and ChatGPT make a lot of work faster — but only if you use the business version, not the free one. The free versions train their AI on what you type, which is bad if you're typing company code or customer info. The business versions cost a bit more per person per month but promise no training and give the company a control panel. We'll pick the right combination for what you actually do, set up the privacy switches, and write down which tools are okay for which kinds of data.

## 10. Internal Technician Notes
- Anthropic data handling: API requests retained 30 days for abuse / safety review by default, configurable down to 0 days on Enterprise. Console: console.anthropic.com → Settings → Data retention.
- GitHub Copilot Business: code suggestions filter against public-code matches enabled by default; can be disabled per org. Logs retained per GitHub audit log retention policy.
- Cursor privacy mode: requests routed through Cursor's own infra but Cursor states "we don't store or train on your code" in Business tier. Independent audit (SOC 2 Type II) completed 2024.
- ChatGPT Enterprise: SAML SSO, SCIM provisioning, audit log API, customizable retention, BAA available, DPF (Data Privacy Framework) certified.
- DLP gate options: NetSkope, Microsoft Purview, Zscaler — all detect prompt injection of sensitive data patterns to ChatGPT / Claude / Copilot.
- Common leakage failures: pasting `.env` files, dumping customer support tickets verbatim, sharing screenshots with PII, asking the AI to "summarize this customer database."

## 11. Related KB Articles
- `l1-windows-be-001` — Windows 11 Copilot+ PC features
- `l1-mac-be-001` — macOS 16 Apple Intelligence
- `l3-security-001` — Security incident response

## 12. Keywords / Search Tags
claude code, github copilot, copilot workspace, copilot agents, cursor, chatgpt business, chatgpt enterprise, anthropic, openai, ai pair programming, dlp, data loss prevention, ai use policy, mdm allowlist, scim, sso, bAA, hipaa
