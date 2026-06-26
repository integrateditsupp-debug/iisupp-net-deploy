# ARIA Platform — One-Pager (Federal-Safe Framing)

**For:** PSPC AI Source List Section 9 annex · OSFI / DND / future federal bid attachments · sales meetings with regulated-industry buyers.
**Owner:** Integrated IT Support Inc. · iisupp.net · Whitby, ON
**Prepared:** 2026-06-16. Conservative claim language. No metrics that aren't internally measured.

---

## What ARIA Is

ARIA is Integrated IT Support's production multi-agent platform built on Anthropic Claude and the Model Context Protocol. ARIA is operated daily by IIS as its own work-management substrate — procurement intelligence, contract hunting, prospect enrichment, knowledge retrieval, operational briefings, and tax/expense automation all run through ARIA agents.

ARIA is not a research demonstration. It is a daily-operating production system that exists because IIS uses it to run IIS.

## What ARIA Is Not

ARIA does not make autonomous decisions. Every action-taking step requires human oversight. ARIA does not replace expertise — it organizes information, drafts decisions for human approval, and captures the audit trail of every action.

ARIA is not a regulated product. ARIA is not certified to any specific standard. ARIA is not benchmarked against named vendor products in this document.

## Production Footprint (internally measured)

| Dimension | Value |
|---|---|
| Production scheduled autonomous agents | 9+ |
| Cron schedules in operation | Daily 3 PM, pre-dawn 06:09 AM, 07:17 AM, Sunday digests, monthly tax sync, end-of-month reconciliation |
| MCP servers orchestrated | 12 |
| Knowledge architecture | Two-tier file-based RAG (MEMORY.md index + topic-segmented markdown KB) |
| Filter chain depth | 5 stages |
| Wasted draft cycles (post-filter-chain deploy) | Reduced from approximately 60% to under 5% (internal measurement, single-customer baseline = IIS itself) |
| Identity-routing capability | Personal vs corporate identity auto-selection per opportunity context |
| Tax/expense automation | Daily sync + end-of-month reconciliation into IIS 2026 tax workbook |

## Tools Orchestrated

Apollo (CRM enrichment + people search) · HubSpot (CRM sync) · Stripe · Netlify (deploy) · Gmail (draft generation) · Chrome MCP (DOM + browser automation) · computer-use (desktop control) · scheduled-tasks (cron) · Slack · Atlassian · Notion · file-system tools

## How ARIA Could Serve a Government of Canada Department

Within IIS engagement scopes, ARIA can be configured (always at client option, never as a hidden default) for:

- **Decision-capture transparency layer:** every participant decision in a workshop / tabletop / IR drill logged with timestamp, decider, options, rationale. Air-gapped capture available; cloud capture only with explicit client authorization.
- **Knowledge-base retrieval co-pilot:** bit-native markdown KB with deterministic retrieval, no opaque vector-store recall. Every retrieval is explainable.
- **Workflow draft generation:** ARIA drafts proposals, summaries, RCAs, runbooks for human approval. Never publishes, sends, or executes without sign-off.
- **Audit-friendly multi-agent coordination:** cross-agent state in plain markdown files reviewable by any auditor without specialized tooling.

## Architectural Differentiators

1. **File-based RAG.** Knowledge lives in human-readable markdown, not opaque vector stores. Auditable, exportable, version-controllable, no vendor lock-in.
2. **Identity routing.** Eliminates cross-context identity leakage that breaks trust in B2B / B2G workflows.
3. **Stop-rule discipline.** Every agent enforces hard stops around send, submit, publish, payment, account creation, deletion — no autonomous external commitment.
4. **Approval gates as a feature, not friction.** Every action that touches the outside world surfaces to the human for explicit consent.
5. **Decision-capture by default.** What was decided, by whom, when, why — recorded as a side-effect of running ARIA.

## Government of Canada Responsible-AI Alignment

IIS commits in every engagement to:

- **Human oversight required at every action-taking step.**
- **No use of client data for model training** unless contractually authorized in writing.
- **Algorithmic Impact Assessment input support** as standard, not upsell.
- **Accessibility per Government of Canada Web Standards** in all delivered interfaces.
- **Vendor-model risk transparency** — LLM family disclosed per engagement; vendor change-control documented.
- **No autonomous external commitment** — sends, submits, publishes, payments, account creation, deletions always gated to a named human.

## Who Operates ARIA

ARIA was designed, built, and is operated by Ahmad Wasee, Founder & Senior AI Engineer of Integrated IT Support Inc. 13+ years enterprise IT engineering background across regulated financial services (capital markets, banking) and public-sector healthcare. Anthropic Academy graduate (Claude 101, Claude Code 101, Claude Cowork, Claude Code in Action, AI Fluency).

## Engagement Boundaries

IIS / ARIA is currently scoped for:

- **Remote-only delivery.** No on-site work.
- **Advisory + methodology + documentation outputs.** Implementation in client systems is done by client teams with IIS guidance.
- **Band 1 PSPC scope** (engagements ≤ CAD $1M). Larger engagements considered via subcontract / partnership.
- **English-primary delivery** with documentation pairing supported in French where required.

## Federal Procurement Identifiers

- **NAICS:** 541510 – 541519 (REGISTERED)
- **GSIN:** D302A – D399A (REGISTERED)
- **PBN:** ACTIVE
- **Federal + provincial procurement profile:** REGISTERED

## Contact

**Ahmad Wasee** · Founder & Senior AI Engineer
Integrated IT Support Inc. · Whitby, ON, Canada
ahmad.wasee@iisupp.net · +1 (647) 581-3182 · https://iisupp.net

---

**Closing note for the federal evaluator:** ARIA is what proves IIS can deliver responsible applied AI to Government of Canada departments — not because it impresses, but because IIS uses it to run IIS. The platform's existence is the evidence; the operating discipline behind it is the methodology IIS brings to client engagements.
