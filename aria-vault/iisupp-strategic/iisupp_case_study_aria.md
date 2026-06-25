# Case Study: How We Built Our Own AI Operations Team

**The Integrated IT Support proof point — we eat our own dog food.**

---

## The situation

In late 2024, Ahmad Wasee was working as Senior Technical Analyst at Raymond James Toronto (still is, full-time) while moonlighting to build Integrated IT Support Inc. — a managed services firm operating out of Whitby, Ontario.

The problem he immediately ran into: **one person, 24 hours in a day, can't run a service business.** Lead generation, prospect research, proposal drafting, financial reconciliation, document handling, CRM updates — every operational hour spent on admin is an hour not spent shipping client work.

The conventional answer is: hire people. The IIS answer became: **build an AI workforce.**

---

## What we built: ARIA

**ARIA** is Integrated IT Support's internal AI operations platform. It runs on Anthropic Claude (Sonnet, Opus, Haiku) orchestrated through the Model Context Protocol (MCP) — a 12-server architecture coordinating CRM enrichment, web automation, scheduled task execution, financial reconciliation, and operational reporting.

As of 2026, ARIA runs **9+ scheduled autonomous agents in production every day**, including:

- **Daily 3 PM Contract Hunter** — sources fresh government and commercial IT contracts, scores fit, drafts capability inquiries
- **6:09 AM Operations Agent** — pulls overnight ticket activity, generates morning ops briefing
- **7:17 AM Bay Monitor / CEO Brief** — financial dashboard, pipeline summary, action items
- **Sunday Morning + Evening Digests** — weekly performance roundup, anomaly detection
- **Monthly Tax / Expense Sync** — automated reconciliation into the 2026 IIS Inc tax workbook
- **End-of-Month Reconciliation Sweep** — full bookkeeping touchpoint elimination
- **KB Expansion Sessions** — autonomous knowledge base growth from operational events
- **Targeted Prospect Launchers** — one-time campaigns triggered by external events
- **Senior Director Aggregation Agent** — cross-agent coordination, executive punch-list

---

## The numbers

| Metric | Before ARIA | After ARIA |
|---|---|---|
| **Admin hours per week (founder)** | 28 hrs | 4 hrs |
| **Daily ticket triage time** | 2-3 hrs | 15 min |
| **Monthly bookkeeping touch** | 12 hrs | 0 hrs (fully automated) |
| **Prospect research per cold outreach email** | 20 min | 90 seconds |
| **Time from RFP discovery to capability inquiry draft** | 4-8 hrs | 25 min |
| **Wasted draft cycles (stale data)** | ~60% | <5% |

The 24-hour-a-day shortage stopped being the bottleneck. The bottleneck moved to where it should be: how many client engagements we can ship at high quality.

---

## How we did it (the architectural decisions that mattered)

**1. We chose Anthropic Claude + MCP early.** While most consultancies were still demoing GPT chatbots, we bet on multi-agent + tool-use architecture. The result: a 12-server MCP orchestration layer that lets agents call CRM, deploy infrastructure, send email, manage scheduled tasks, and read financial systems — all as one coordinated workforce, not isolated chatbots.

**2. Two-tier file-based RAG.** Instead of investing in a vector database, we built a structured markdown + YAML knowledge base (MEMORY.md as index, topic-segmented files for context). Agents auto-load relevant context in under 30 seconds per session. Faster than vector retrieval, more debuggable, more auditable — and zero infrastructure spend.

**3. Production discipline applied to AI.** Twenty years in regulated financial services (Raymond James, RBC Capital Markets, Scotia Bank, IBM) taught us that any system that handles real money or real client data needs change management, observability, evidence-of-control, and rollback procedures. We brought that discipline to AI engineering. Our agents are versioned, monitored, and have documented stop conditions. They are not weekend prototypes.

**4. Identity-routed prompt design.** Each agent auto-selects between personal voice (Ahmad as founder) vs company voice (IIS Inc) per context. Eliminates the cross-context identity leakage that breaks recruiter and procurement-officer trust in templated outreach.

---

## What this means for our clients

When IIS Inc engages with a firm to build their AI workflow, **we are not pitching theory.** We are showing you what's running in our own ops every morning while you sleep. We are deploying the same architecture (Anthropic Claude + MCP) that we trust with our own bookkeeping, our own client pipeline, and our own financial reporting.

Most firms hire AI consultancies built by people who have built AI tutorials. We are operators first. We built ARIA before we tried to sell ARIA-class systems to anyone else, because we wanted to make sure the system actually worked under load — under real money, real deadlines, real audit pressure.

If you'd like to see ARIA's operational logs, output samples, or a live agent run — book a Tier 1 Diagnostic. You'll walk out of the 60-minute review knowing exactly what's possible in your firm with the same architecture.

---

## Closing quote (Ahmad)

> "In 2009 I was the analyst on shift at 3 AM watching a trader-floor outage. In 2020 I was the L3 incident commander on the same kind of P1 at Raymond James. In 2026 I have nine AI agents that handle the work that used to take me my entire morning. The technology is real. The discipline to deploy it without breaking your operations — that's the harder skill. That's what we sell."

> — Ahmad Wasee, Founder, Integrated IT Support Inc.

---

## How to use this case study

**On iisupp.net:** Place as primary "Proof" section between hero and pricing tiers. Title: "We Eat Our Own Dog Food — Meet ARIA"

**In email outreach:** Pull the 6-row metrics table as inline social proof. "Here's what AI did for our own ops in 12 months — happy to show you what it could do for yours" → link to full case study.

**In sales calls:** Open with the ARIA story. It's the single most effective trust-establisher because it answers the "are you actually doing this or just selling it" question before the prospect asks.

**On LinkedIn:** Snippet posts from this — each architectural decision (#1-4) is its own 200-word post. 4 posts queued = 1 month of founder content.

**On a printed one-pager:** Compress to 1 page for in-person meetings and procurement officers who still print things.

## Related

<!-- LINK-WEB:auto -->
- [[campaign-plan]]
- [[campaign-status]]
- [[day-2-batch-plan]]
- [[email-templates]]
- [[iisupp_14day_followup_sequence]]
- [[iisupp_20_accounts_full_list]]
- [[iisupp_5_seed_emails]]
- [[iisupp_offer_tiers]]
- [[iisupp_usa_exposure_playbook]]
- [[INDEX]]
- [[linkedin-connection-requests-today]]
- [[linkedin-outreach-playbook]]
- [[proposal-one-pager]]
- [[prospects-dfw-batch-2026-05-13]]
- [[prospects-dfw-day2-batch]]
- [[prospects-dfw-day4-batch]]
- [[prospects-dfw-today-batch]]
- [[prospects-dfw-today-batch-v2]]
- [[READ_ME_FIRST]]
- [[reply-playbook]]
- [[SEND-PACING-SCHEDULE]]
- [[SESSION_SUMMARY_2026-06-23]]
- [[USA600-status-2026-05-21]]
- [[workspace-setup-guide]]
- [[_Amygdala]]
- [[_ARIA]]
- [[_Brainstem]]
- [[_Campaigns]]
- [[_capture]]
- [[_CorpusCallosum]]
- [[_Decisions]]
- [[_Glia]]
- [[_HOME]]
- [[_IIS]]
- [[_Inbox]]
- [[_Sentinel]]
- [[Ahmad]]
- [[AXIS]]
- [[Backup-agent]]
- [[Brain-Map]]
- [[Claude-Code]]
- [[Cleaning-agent]]
- [[Codex]]
- [[Cowork]]
- [[DIRECTOR_AUTONOMY]]
- [[KB-agent]]
- [[Leads]]
- [[Leads-agent]]
- [[OPS-agent]]
- [[RULES]]
- [[STACK]]
- [[VOICE]]
<!-- /LINK-WEB:auto -->
