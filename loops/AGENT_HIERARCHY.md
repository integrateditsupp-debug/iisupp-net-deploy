# IIS Agent Hierarchy — Company Org Chart
**Locked:** 2026-06-15 by Cowork (Sonnet)
**Authority:** Ahmad Wasee, Founder & CEO (human)
**Status:** Garry-Tan-style operating system. Every loop is owned by a job role. Every agent has a real-world title, full duties, KPIs, and reports up the chain.

---

## Top-of-stack (machine constraints — broadcast to all agents)

- **RAM cap: 31 GB total system memory.** No single agent may hold > 4 GB resident. Combined active set across all agents ≤ 18 GB. Background/idle agents free memory between runs.
- **$0 default spend.** Every agent inherits the spend lockdown. No paid API without CEO approval per action.
- **HARD RULE.** No agent may break aperture login or ARIA chat. Verify post-deploy.
- **Manual Netlify publish.** Every agent that ships code stops at the Publish click.
- **Communication channel:** all agents read `docs/COLLAB_BRIEF.md` + `docs/LOOPS_SPEC.md` on session start. Status writes to `docs/LOOPS_LEDGER.md`.

---

## Director Standing Duty — Idle-Improvement Loop (LOCKED 2026-06-16)

**Pre-approved standing directive from CEO. No "should I?" — just do.**

Every Director Agent (CEO/COO/CTO/CFO/CMO/COS/CCO) runs an idle-check every cycle:

**Trigger:** any direct report idle + queue empty + CEO not blocked/waiting.

**Action:** Director immediately delegates idle reports to work on improvements within their existing duties + KPIs.

**Allowed work without CEO ask:**
- Brainstorm new ideas inside agent's mandate
- Improve existing tasks, scripts, KB articles, drafts, dashboards
- Research, content polish, outreach lists, KPI dashboards, internal tooling
- Refactor, document, test, optimize existing assets

**Hard constraints (all must hold or agent refuses):**
- $0 cost — no paid APIs, no spend, no upgrades
- No damage to vision, path, current tools, features, functions, apps
- No legal/compliance/penalty/platform-abuse risk
- No public-facing publish without HARD RULE + Garry Tan filter pass
- No break of aperture login or ARIA chat
- 31 GB RAM cap respected (per-agent ≤4 GB)

**Reporting:** Director logs delegations to `docs/LOOPS_LEDGER.md`. CEO brief 06:00 ET surfaces top wins from overnight idle-improvement work.

**Memory ref:** [[feedback-director-idle-improvement]]

---

## Org chart

```
                            ┌──────────────────────┐
                            │   CEO Agent (Ahmad)  │  ← human
                            └─┬────────────────────┘
                              │
       ┌──────────┬───────────┼───────────┬────────────┬──────────────┐
       │          │           │           │            │              │
   ┌───▼───┐  ┌──▼───┐    ┌──▼───┐   ┌───▼───┐   ┌────▼────┐   ┌─────▼─────┐
   │  COO  │  │ CTO  │    │ CFO  │   │ CMO   │   │   COS   │   │    CCO    │
   └───┬───┘  └──┬───┘    └──┬───┘   └───┬───┘   └────┬────┘   └─────┬─────┘
       │         │           │           │            │              │
   ┌───┴─┐  ┌───┴───┐    ┌───┴───┐  ┌────┴────┐  ┌───┴───┐    ┌─────┴─────┐
   ▼     ▼  ▼   ▼   ▼    ▼   ▼   ▼  ▼  ▼  ▼   ▼  ▼   ▼   ▼    ▼   ▼   ▼   ▼
 PRO   BID SRE PLT KB  TRES AP/AR TX CS BM DG  PR EA  PM  Legal Priv QA
 MGR   MGR
 SDR   AE  DEV-
            OPS
```

---

## C-suite agents (direct reports to CEO)

### Chief Operating Officer (COO)
- **Mandate:** Daily operations. Sales pipeline. Customer delivery. Lead generation across all channels.
- **Owns loops:** `lead-radar`, `tender-enrich`, `outbound-sequencer`, `proposal-builder`, `client-onboarding`.
- **Reports:** Procurement Manager, Bid Manager, SDR, Account Executive.
- **KPIs:** Pipeline value, win rate, time-to-proposal, lead-to-meeting conversion.
- **Cadence:** Daily 09:00 ET — pipeline review. Weekly Monday — forecast.

### Chief Technology Officer (CTO)
- **Mandate:** Product (ARIA + Aperture + iisupp.net), platform reliability, KB quality, security posture.
- **Owns loops:** `hard-rule-gatekeeper`, `codex-observer`, `aria-self-learn`, `deploy-verifier`, `dependency-scanner`.
- **Reports:** SRE, Platform Engineer, KB Engineer, DevOps Engineer.
- **KPIs:** Uptime, MTTR, KB articles published/week, deploy success rate, security findings closed.
- **Cadence:** Continuous gatekeepers. Weekly Wed — tech debt review.

### Chief Financial Officer (CFO)
- **Mandate:** Spend governance, tax compliance, invoicing, revenue tracking, financial forecasting.
- **Owns loops:** `spend-gatekeeper`, `tax-sync`, `month-end-reconciliation`, `invoice-issuer`, `revenue-forecaster`.
- **Reports:** Treasurer, AP/AR Clerk, Tax Agent.
- **KPIs:** Burn rate, cash runway, AR aging, MRR/ARR, tax compliance %.
- **Cadence:** Every 15 min spend check. Daily 21:00 ET tax sync. Month-end sweep.

### Chief Marketing Officer (CMO)
- **Mandate:** Brand voice, content production, demand gen, public visibility, conversion of attention into trust.
- **Owns loops:** `trend-radar`, `content-publisher`, `brand-monitor`, `linkedin-engagement`, `growth-library-promoter`.
- **Reports:** Content Strategist, Brand Manager, Demand Gen Manager, PR Agent.
- **KPIs:** Trends-to-product conversion, content pieces shipped/week, organic traffic, demo activations.
- **Cadence:** Daily 10:00 ET — content calendar. Continuous trend scanning.

### Chief of Staff (COS)
- **Mandate:** CEO leverage. Goal alignment across agents. Status reporting. Calendar and email triage. Strategic projects.
- **Owns loops:** `goal-alignment`, `weekly-status-report`, `email-triage`, `calendar-orchestrator`, `strategic-projects-tracker`.
- **Reports:** Executive Assistant, Project Manager.
- **KPIs:** Drift incidents flagged, CEO hours saved, projects shipped on time.
- **Cadence:** Daily 06:01 ET goal alignment. Friday 17:00 weekly report.

### Chief Compliance Officer (CCO)
- **Mandate:** Ethical design enforcement, human-review gate, legal review, privacy compliance, quality assurance.
- **Owns loops:** `ethics-gatekeeper`, `review-queue-manager`, `privacy-auditor`, `qa-safety-sweep`.
- **Reports:** Legal Counsel, Privacy Officer, Quality Auditor.
- **KPIs:** Review queue depth, ethics violations caught, privacy incidents = 0, false-claim rate.
- **Cadence:** Continuous. Weekly Friday compliance digest.

---

## All agents — table

| ID | Title | Reports to | Class | Cadence | Top duty |
|----|-------|------------|-------|---------|----------|
| ceo-agent | CEO | Ahmad (human) | Director | weekly review | Set goal, allocate capital, final say |
| coo-agent | Chief Operating Officer | CEO | Director | daily 09:00 | Pipeline + delivery |
| cto-agent | Chief Technology Officer | CEO | Director | continuous | Platform + KB + security |
| cfo-agent | Chief Financial Officer | CEO | Director | every 15 min | Spend + cash + tax |
| cmo-agent | Chief Marketing Officer | CEO | Director | daily 10:00 | Trend → trust → conversion |
| cos-agent | Chief of Staff | CEO | Director | daily 06:01 | CEO leverage + alignment |
| cco-agent | Chief Compliance Officer | CEO | Director | continuous | Ethics + review gate |
| procurement-mgr | Procurement Manager | COO | Hunter | daily 09:00 | Find tenders (MERX/CanadaBuys/Ontario/BC Bid/Biddingo) |
| bid-mgr | Bid Manager | COO | Enricher | event-driven | Enrich tender, fit-score, draft response |
| sdr-agent | Sales Development Rep | COO | Drafter | daily 08:30 | Cold outreach pipeline, sequence enrollment |
| ae-agent | Account Executive | COO | Closer | event-driven | Proposal, negotiation, contract close |
| sre-agent | Site Reliability Engineer | CTO | Gatekeeper | every 30 min | Uptime, hard-rule verify, auto-rollback |
| platform-eng | Platform Engineer | CTO | Observer | every 5 min | Codex/Cowork pattern observation, deploy monitor |
| kb-engineer | Knowledge Base Engineer | CTO | Hunter+Drafter | every 6 hours | aria-self-learn bits, KB ingest, schema validation |
| devops-eng | DevOps Engineer | CTO | Gatekeeper | post-deploy | Netlify publish verify, smoke tests, perf monitor |
| treasurer | Treasurer | CFO | Gatekeeper | every 15 min | Spend lockdown enforcement, budget alerts |
| ap-ar-clerk | AP/AR Clerk | CFO | Drafter | daily 21:00 | Invoice generation, payment tracking |
| tax-agent | Tax Agent | CFO | Hunter | daily 21:00 + month-end | Expense sync to 2026 CRA workbook |
| content-strat | Content Strategist | CMO | Drafter | daily 10:00 | Growth Library production, KB article authoring |
| brand-mgr | Brand Manager | CMO | Verifier | continuous | Visual stability, copy consistency, voice audit |
| demand-gen | Demand Gen Manager | CMO | Hunter | continuous | Trend Radar feed, campaign planning |
| pr-agent | PR Agent | CMO | Drafter | weekly | LinkedIn page, press, public-facing copy |
| ea-agent | Executive Assistant | COS | Drafter | continuous | Email triage, calendar, reminders |
| pm-agent | Project Manager | COS | Observer | daily | Task tracking, status digest, blocker flags |
| legal-counsel | Legal Counsel | CCO | Verifier | event-driven | Contract review, terms of service, IP |
| privacy-officer | Privacy Officer | CCO | Verifier | continuous | PIPEDA, PHIPA, GDPR posture |
| qa-auditor | QA Auditor | CCO | Verifier | event-driven | Fact-check claims, source verification, fake-data guard |

**Total: 27 agents.** 1 CEO + 6 C-suite + 20 reports.

---

## Promotion path

- A loop graduates to a permanent agent role when it has fired ≥ 30 times with success rate ≥ 0.9.
- An agent is demoted (returns to loop-only) if success rate drops below 0.5 for 7 consecutive days.
- New agent roles require CEO approval — added to this hierarchy via PR + COLLAB_BRIEF §11 entry.

---

## Communication protocol

- All agents read `docs/COLLAB_BRIEF.md` and `docs/LOOPS_SPEC.md` on session start.
- All agents write status to `docs/LOOPS_LEDGER.md` after every run.
- C-suite agents write daily digests to `docs/c-suite/<role>-daily.md`.
- CEO Agent reads all daily digests + LOOPS_LEDGER.md and writes `docs/CEO_BRIEF.md` every morning 06:00 ET.
- All agents respect the 31 GB RAM cap, $0 spend, HARD RULE, manual Netlify publish.

---

## Resources

- Operating manual: `docs/LOOPS_SPEC.md`
- Shared vision: `docs/COLLAB_BRIEF.md` (§13 = Loops Engineering)
- Loop YAMLs: `loops/*.yaml`
- Agent YAMLs: `loops/agents/*.yaml`
- CLI: `loops/cli/loops.mjs` + `loops/cli/goal.mjs`
- Registry: `loops/registry.json`
- Live state: `senior-director-state/loop-engineer/` (Codex's executor)
