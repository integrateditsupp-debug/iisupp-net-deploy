# Industry Test Matrix — AI IT Support, RMM/PSA, Enterprise ITSM

**Compiled:** 2026-06-23
**Owner:** Cowork (Claude) for Integrated IT Support Inc. (ARIA Sentinel)
**Purpose:** Map every test/cert/benchmark enterprise buyers expect at $156K–$625K/yr so ARIA Sentinel can match or leapfrog. Sources cited inline. Honest gap callouts where vendors don't publish.

---

## Section 1 — Executive Summary

- **Compliance ceiling = ServiceNow.** Only vendor across all 22 researched that holds FedRAMP **High** + IRAP PROTECTED + C5 + HITRUST + TISAX simultaneously. ARIA Sentinel's realistic 12-month target is SOC 2 Type II + ISO 27001 + HIPAA + StateRAMP — matches the second tier (Atlassian/BMC/Zendesk).
- **AI eval transparency = market-wide gap.** Zero of the 22 vendors publish a quantitative hallucination rate against a public benchmark (TruthfulQA, HaluEval, etc.). Best public AI eval frameworks are Aisera CLASSic, Intercom Fin's 7-phase pipeline, ServiceNow's 9-metric Now Assist Data Kit — all narrative, no numbers. **ARIA's 98.64% on 332K corpus is already more concrete than anything competitors publish.**
- **Testing cadence opacity is universal.** No vendor publishes pen-test frequency as a number ("quarterly external pen test"), bug bounty payouts, SAST/DAST tool stack, or chaos engineering runbook outside of Atlassian (Bugcrowd, red team, quarterly WCAG). 17 of 22 publish nothing measurable. Publishing real cadence is a low-cost, high-trust leapfrog move.

---

## Section 2 — Per-Company Snapshot Table

Legend: ✓ = publicly confirmed · ✗ = no public disclosure · ◐ = partial / self-attested / inherited

### AI Help Desk Tier

| Company | Certs | Public SLA | Tests Run (public) | Cadence | Notable Claim |
|---|---|---|---|---|---|
| Moveworks | SOC2 II, ISO 27001, CSA STAR L2 | ✗ | Hallucination/prompt-injection guards (narrative) | SOC2 annual | 50%+ Tier-1 reduction |
| Aisera | SOC2 II, ISO 27001, GDPR, CSA STAR L1 | ✗ | CLASSic framework (Cost/Latency/Accuracy/Stability/Security) | SOC2 annual; CLASSic ongoing | 84% auto-resolution, 1.3s latency |
| Forethought | SOC2 II, HIPAA, GDPR, CCPA | ✗ | Pen test artifacts + real-time monitoring in trust portal | Annual SOC2/HIPAA | 65–87% deflection, 4.0 CSAT |
| Intercom Fin | SOC2 II, ISO 27001/27018/27701, **ISO 42001**, HIPAA | **99.97%** | 7-phase pipeline; pen test summary + CSA assessment downloadable | Annual ISO/SOC2 | **67% avg resolution, $1M perf guarantee** |
| Zendesk AI | SOC2 II, ISO 27001/27018/27701, **ISO 42001**, **FedRAMP**, GDPR, HIPAA-eligible, PCI | 99.9% (MSA) | Pen test summaries, SIG, CAIQ on trust center | Annual + FedRAMP continuous monitoring | Conservative: 6–12% Answer Bot resolution |
| Tidio Lyro | SOC2 II, GDPR, CCPA, EU-US DPF, EU AI Pact | ◐ ("SLA-backed", terms private) | Annual pen test letter via portal | Annual SOC2 | 64% avg, 90% peak, **50% guarantee** |
| Crisp | ◐ Self-attests SOC2 (no audit) | ✗ (99.9945% in 2019 historical) | ✗ | ✗ | None |
| Espressive (Resolve) | SOC2 II, ISO 27001 | ✗ | ✗ | Annual | 55–67% deflection, 85% Barista auto-resolve |
| Capacity | ✗ | ✗ | ✗ | ✗ | **Thinnest public posture in cohort** |
| IrisAgent | ✗ | 99.9% (marketing only) | ✗ | ✗ | 50% auto-resolve at 95% accuracy, 0.8s |
| Rezolve.ai | ◐ Self-claims SOC2, ISO27001, HIPAA (no trust portal) | ✗ | ✗ | ✗ | None public |

### RMM/PSA Tier

| Company | Certs | Public SLA | Tests Run | Cadence | Notable Claim |
|---|---|---|---|---|---|
| NinjaOne | SOC2 II + SOC3 II, ISO 27001:2022 | ✗ (third-party measured 98.61%) | TLS 1.3, AES-256 (encryption only) | SOC2 annual | $78K–$130K savings/5-tech desk |
| Atera | SOC2 II, ISO 27001/27017/27018/27032 | **99.9%** | Zero-trust declared | ✗ specifics | Azure-inherited infra compliance |
| ConnectWise | SOC2, ISO 27001, SIG, CAIQ | "15-min SOC SLA" (MDR only) | VDP (proved out Feb 2024 ScreenConnect) | Annual SOC2 (Aprio) | Asio unified data layer, 250+ reports |
| Kaseya | SOC2 II (exception-free), ISO 27001 (datacenters) | ✗ | Owns Vonahi vPenTest; NIST 800-61 incident model | SOC2 multi-annual | Cooper Copilot at no cost |
| Datto | SOC2 II, ISO 27001, **BSIMM-evaluated (unique)** | **99.99%** RMM + PSA | Routine 3rd-party pen testing | ✗ cadence | Only RMM publicly BSIMM |
| N-able | SOC2 II, ISO 27001, HIPAA Type 1 | ✗ (status page only) | "Rigorous internal/external" (narrative) | ✗ | N-zo "up to 80% efficiency" |
| ManageEngine | SOC2+HIPAA Type 2 (5 products), ISO 27001/27701/27018 | ✗ | ✗ | ✗ | Trifecta: ISO 27001 + 27701 + 27018 cloud privacy |

### Enterprise ITSM Tier

| Company | Certs | Public SLA | Tests Run | Cadence | Notable Claim |
|---|---|---|---|---|---|
| ServiceNow | SOC1/2 II, ISO 27001/27017/27018/27701, HIPAA, PCI, **FedRAMP High**, StateRAMP, **IRAP PROTECTED**, **C5**, HITRUST, TISAX, CSA STAR | 99.8% contractual (99.95% negotiable) | SAST, DAST, SCA, internal ethical hackers, 3rd-party pen tests (continuous, no number) | Continuous (no specifics) | FedRAMP High P-ATO since 2019 |
| Freshservice | SOC1/2 II, SOC3, ISO 27001/27701, PCI, HIPAA, TX-RAMP, CSA STAR | 99.8% | Independent VAPT; **WCAG 2.2 A+AA continuous CI automation** | Annual ISO/SOC2 | Weakest regulated-sector certs of the 4 |
| Jira SM (Atlassian) | SOC2 II, SOC3, ISO 27001:2022/27017/27018, PCI, HIPAA, GDPR/CCPA, CSA STAR L2, **FedRAMP Moderate**, StateRAMP, IRAP | **99.95%** Enterprise | **Internal red team + internal pen test + external pen test + always-on Bugcrowd bounty + quarterly WCAG 2.2 AA audits + VPATs** | Quarterly WCAG; bounty continuous | Most mature publicly-described security program |
| BMC Helix | SOC2 II, ISO 27001:2022, HIPAA, **FedRAMP Moderate** | 99.9% (actual ~99.98%) | SAST, DAST, SCA, container scan, 3rd-party pen test, pre-release pen test per product | "Continuous" (no number) | HelixGPT has explicit "assessment layer" architecture |

---

## Section 3 — Master Test Matrix

Every test type enterprise buyers ask about, what competitors actually run, frequency benchmark, source. Frequencies marked **"market-wide gap"** = no vendor in our research publishes this measurably.

### 3.1 Application Security

| Test Type | Standard Frequency | Threshold/Best-in-Class | Source |
|---|---|---|---|
| SAST (static code analysis) | Continuous in CI | ServiceNow, BMC Helix declare; no tooling published | [ServiceNow AVR](https://www.servicenow.com/content/dam/servicenow-assets/public/en-us/doc-type/resource-center/data-sheet/ds-application-vulnerability-response.pdf) |
| DAST (dynamic) | Continuous + pre-release | ServiceNow, BMC Helix declare | Same |
| SCA (software composition) | Continuous + every dep change | ServiceNow, BMC Helix declare | Same |
| Container security scanning | Pre-release per build | BMC Helix declares | [BMC Trust Center](https://www.bmc.com/corporate/trust-center/compliance.html) |
| Third-party pen test | Annual minimum, "continuous" claimed | All enterprise vendors; cadence number = market-wide gap | [Atlassian Security Testing](https://www.atlassian.com/trust/security/security-testing) |
| Internal red team | Continuous | **Only Atlassian publicly describes** | [Atlassian Vuln Mgmt](https://www.atlassian.com/trust/security/vulnerability-management) |
| Bug bounty | Always-on | **Only Atlassian (Bugcrowd) in this list** | [Atlassian Bugcrowd](https://bugcrowd.com/engagements/atlassian) |
| Pre-release pen test per product | Per release | BMC Helix only | [BMC Trust Center](https://www.bmc.com/corporate/trust-center/compliance.html) |
| Vulnerability Disclosure Program (VDP) | Always-on | ConnectWise (proved Feb 2024 ScreenConnect) | [CW ScreenConnect bulletin](https://www.connectwise.com/company/trust/security-bulletins/connectwise-screenconnect-23.9.8) |
| Threat modeling | Pre-design per feature | BMC Helix declares | [BMC Helix Compliance](https://docs.bmc.com/xwiki/bin/view/Helix-Common-Services/Other/BMC-Helix-Subscriber-Information/helixsubscriber/Security/Compliance/) |
| Architecture review | Pre-build | BMC Helix declares | Same |

### 3.2 Infrastructure & Reliability

| Test Type | Standard Frequency | Threshold | Source |
|---|---|---|---|
| Uptime SLA (contractual) | N/A | **99.95% (Atlassian Enterprise) = highest published**; 99.99% (Datto RMM+PSA = highest in RMM) | [Atlassian SLA](https://support.atlassian.com/subscriptions-and-billing/docs/service-level-agreement-for-atlassian-cloud-products/) · [Datto RMM](https://rmm.datto.com/help/en/Content/1INTRODUCTION/Infrastructure/INFRASTRUCTUREANDSECURITY.htm) |
| Public status page | Real-time | NinjaOne, N-able, Forethought, all enterprise tier | [status.ninjaone.com](https://status.ninjaone.com/uptime) |
| Multi-region failover | Continuous | Datto (4 AWS regions: eu-west-1, us-west-2, us-east-1, ap-southeast-2) | [Datto RMM Infra](https://rmm.datto.com/help/en/Content/1INTRODUCTION/Infrastructure/INFRASTRUCTUREANDSECURITY.htm) |
| Backup cadence | Daily/weekly/monthly | BMC Helix 14/14/90 day retention | [BMC SaaS Policy](https://www.bmc.com/content/dam/bmc/support/helix-saas-support-policy.pdf) |
| DR drill | Quarterly typical (not published) | **Market-wide gap** | — |
| Chaos engineering (Netflix-style) | Continuous | **Market-wide gap — zero vendors publish** | — |
| Load/performance test | Pre-release + scheduled | **Market-wide gap** | — |
| Real-User Monitoring (RUM) | Continuous | Forethought lists in trust report | [Forethought Trust](https://trust.forethought.ai) |

### 3.3 Compliance & Audit

| Cert | Holders (researched) | Cadence | Notes |
|---|---|---|---|
| SOC 2 Type II | 21 of 22 (Capacity, IrisAgent only no public) | Annual | Floor cert; required for any enterprise sale |
| SOC 1 Type II | ServiceNow, Freshservice | Annual | Required when system touches financial reporting |
| SOC 3 | Freshservice, NinjaOne, Atlassian | Annual | Public summary of SOC 2 |
| ISO 27001 (latest 2022) | 17 of 22; ServiceNow + Atlassian on 27001:2022 | Surveillance annual, full audit triennial | Floor international cert |
| ISO 27017 (cloud security) | ServiceNow, Atera, ManageEngine, Atlassian | With ISO 27001 audit | Cloud-specific |
| ISO 27018 (cloud PII) | ServiceNow, Intercom, Atera, ManageEngine, Atlassian, Zendesk | With ISO 27001 | Cloud PII processor |
| ISO 27701 (PIMS) | ServiceNow, Intercom, ManageEngine, Freshservice, Zendesk | With ISO 27001 | Privacy management |
| **ISO 42001 (AI mgmt)** | **Intercom, Zendesk only** | New (2023 std); annual | **AI-specific governance — leapfrog target** |
| HIPAA | Forethought, Intercom (Premium), Rezolve, Espressive (?), ServiceNow, Jira SM, BMC, Freshservice, N-able (Cove Type 1), ManageEngine | BAA per customer | Healthcare gate |
| PCI DSS | ServiceNow, Zendesk Payments, Freshservice, Jira SM | Annual | Card data |
| FedRAMP Moderate | Jira SM, BMC Helix | Continuous monitoring | US fed gate |
| **FedRAMP High** | **ServiceNow + Zendesk only** | Continuous monitoring | Highest US fed tier |
| StateRAMP | ServiceNow, Atlassian, Freshservice (TX-RAMP) | Continuous | US state gov |
| IRAP (AU) | ServiceNow (OFFICIAL+PROTECTED), Atlassian | Annual | Australian gov |
| C5 (DE BSI) | ServiceNow | Annual | German cloud |
| HITRUST | ServiceNow | Biannual | Healthcare extended |
| TISAX | ServiceNow | Annual | Automotive |
| CSA STAR | ServiceNow, Atlassian L2, Aisera L1, Intercom, Freshservice, Moveworks L2 | Annual | Cloud security assessment |
| BSIMM | **Datto only** | Annual | Software security maturity — rare leapfrog |
| GDPR/CCPA | All 22 | Continuous | Table stakes |
| EU-US DPF | Tidio Lyro | Annual recert | Newer EU data transfer |
| Cyber Essentials (UK) | None disclosed | Annual | UK gov supplier gate |

### 3.4 AI-Specific Evaluation

| Test | Best Public Example | What's Measured | Source |
|---|---|---|---|
| AI eval framework (named) | **Aisera CLASSic** (Cost/Latency/Accuracy/Stability/Security) | 5 dimensions, ongoing | [Aisera CLASSic](https://aisera.com/blog/enterprise-ai-benchmark/) |
| Multi-phase pipeline | **Intercom Fin 7-phase** (refinement/retrieval/reranking/generation/validation/optimization/security) | Per-query validation | [Fin AI Engine](https://www.intercom.com/help/en/articles/9929230-the-fin-ai-engine) |
| Multi-metric grading | **ServiceNow Now Assist 9-metric** including Truthfulness | Triggers human review if hallucination >20%/hr | [ServiceNow Now Assist Eval](https://www.servicenow.com/community/ceg-ai-coe-articles/a-field-guide-to-evaluating-analyzing-and-debugging-ai-agents-on/ta-p/3545229) |
| LLM-as-Judge filter | **Atlassian Rovo** (gpt-4o-mini judges code review outputs) | Filters factually wrong before delivery | [Atlassian AI Trust](https://www.atlassian.com/platform/ai-trust) |
| Customer-built ground truth | **ServiceNow Now Assist Data Kit** | Per-tenant eval set | Same as above |
| Per-tenant agent eval tool | **Freshservice Freddy AI Agent Evaluator** | Customer-side scoring | [Freddy Evaluator](https://crmsupport.freshworks.com/support/solutions/articles/50000010448-evaluate-freddy-ai-agent) |
| Confidence threshold fallback | Crisp MagicReply, Tidio Lyro | Below-threshold → human | Multiple |
| Published hallucination rate (%) | **None — universal market gap** | — | — |
| Published accuracy on public benchmark | **None — universal market gap** (TruthfulQA, HaluEval, MMLU) | — | — |
| Published jailbreak/prompt-injection rate | **None — universal market gap** | — | — |
| Published bias eval | **None — universal market gap** | — | — |
| Headline deflection/resolution claim | Intercom 67% avg / 99.9% accuracy / $1M guarantee; Espressive 85%; Tidio 64% + 50% contractual; IrisAgent 95% on 50% resolved | Marketing-grade numbers | Per-vendor cited |

### 3.5 Accessibility (WCAG)

| Cadence | Best Public | Standard |
|---|---|---|
| **Quarterly 3rd-party WCAG 2.2 AA audits + VPATs** | **Atlassian** | WCAG 2.2 AA — most aggressive | [Atlassian WCAG](https://www.atlassian.com/trust/compliance/resources/wcag) |
| Continuous CI accessibility automation | Freshworks | WCAG 2.2 A+AA | [Freshworks Accessibility](https://www.freshworks.com/accessibility/) |
| VPAT per product version | BMC Helix Remedyforce | WCAG 2.1 AA | [BMC VPAT](https://docs.bmc.com/docs/BMCHelixRemedyforce/202202/en/vpat-and-wcag-accessibility-for-self-service-3-0-1104104258.html) |
| Annual audit | ServiceNow | WCAG 2.1 AA | [ServiceNow Trust](https://www.servicenow.com/company/trust/compliance.html) |
| Not disclosed | All 11 AI help desk + all 7 RMM/PSA | — | — |

### 3.6 Performance & UX Metrics

| Metric | Best Public | Source |
|---|---|---|
| p50/p95/p99 latency published | **None publish percentiles** (avg only) | — |
| Avg response time | IrisAgent 0.8s · Aisera 1.3s · Tidio Lyro <6s | Per-vendor |
| CSAT tracked publicly | Forethought 4.0 | [Forethought blog](https://forethought.ai/blog/deflection-metrics-hide-the-real-cost-of-basic-ai-and-prove-the-value-of-smart-ai) |
| NPS published | **None** | — |
| MTTR published | **None** | — |
| A/B test framework | **None publicly described** | — |
| Conversation count basis for benchmark | Intercom 40M+ across 7,000+ customers | [callsphere.ai](https://callsphere.ai/blog/vw1b-intercom-fin-ai-67-percent-resolution) |

---

## Section 4 — "10-Year Leapfrog" Recommendations for ARIA Sentinel

These are tests/disclosures no competitor publishes. Each is cheap to run with our existing stack and produces buyer-defensible proof.

### LEAP-1 — Publish a real hallucination rate against a public benchmark
- **Gap exploited:** Zero of 22 vendors publish a quantitative hallucination rate.
- **What to do:** Run aria-kb-query nightly against TruthfulQA + HaluEval-QA + a custom IT-support eval set; publish the rolling 30-day rate at iisupp.net/trust/ai-evals as a JSON endpoint + dashboard.
- **Cost:** $0 (use existing 332K corpus + Gemini free tier).
- **Cadence:** Continuous; weekly publication.
- **Buyer message:** "ARIA hallucinates at X% on a public benchmark. Every other vendor refuses to give you a number."

### LEAP-2 — Real-time AI self-evals on every customer query
- **Gap exploited:** ServiceNow Now Assist triggers human review only when hallucination >20%/hr. No vendor evaluates 100% of queries in real time and publishes it.
- **What to do:** Wire LLM-as-Judge (Gemini Flash) on every ARIA answer in production. Score truthfulness, citation-grounded, intent-match. Push to /aperture/ai-evals.
- **Cost:** $0 within Gemini free tier; $5–15/mo at scale.
- **Cadence:** Per-query, continuous.
- **Buyer message:** "100% of ARIA answers graded; sample any one of them."

### LEAP-3 — Continuous routing accuracy benchmarks (already have it — publicize)
- **Already done:** 98.64% on 332K-query stress test.
- **Gap exploited:** No competitor publishes corpus-stress-test scores.
- **What to do:** Add /trust/routing-accuracy page showing live score, corpus size, query types, last 12 months trend.
- **Cost:** $0.
- **Cadence:** Re-run weekly.

### LEAP-4 — Autonomous regression test generation from production errors
- **Gap exploited:** Atlassian has Rovo-judged code review; no vendor describes auto-generating regression tests from incident telemetry.
- **What to do:** When ARIA gets `no_match` or low-confidence, auto-generate a vitest case from the actual query + expected route. Add to nightly suite.
- **Cost:** $0 (already have aria-research-agent harness per project_aria_research_agent_law).
- **Cadence:** Continuous; suite re-runs nightly.
- **Buyer message:** "Every production miss becomes a permanent test. Our suite gets stronger every day."

### LEAP-5 — Opt-in chaos engineering on customer environments
- **Gap exploited:** Zero of 22 vendors offer this. Netflix's Chaos Monkey concept never landed in MSP/ITSM.
- **What to do:** Sentinel Tier-3 customers opt in to weekly "chaos drills" — simulated outages of cloud disk, RAM pressure, fake CVE injection. ARIA must detect + report within SLA. Results graded + delivered to customer monthly.
- **Cost:** $0 (extends 21 Windows error detectors).
- **Cadence:** Weekly drills, monthly report.
- **Buyer message:** "We test your environment harder than you do."

### LEAP-6 — Supervised dry-run mode tests (already have 3-mode safety — publicize)
- **Already done:** 3-mode safety (Observe/Suggest/Act) per memory.
- **Gap exploited:** No vendor publishes dry-run pass rate.
- **What to do:** Publish % of Tier-2/3 actions ARIA correctly pre-flighted in dry-run mode before any production execution.
- **Cost:** $0.
- **Cadence:** Weekly.

### LEAP-7 — Agent-coordination eval (27-agent consensus)
- **Gap exploited:** Unique to our hierarchy per project_agent_hierarchy. No competitor has measurable multi-agent agreement scoring.
- **What to do:** When ≥2 ARIA agents touch a decision, log whether they agreed; if disagreed, why. Publish rolling consensus rate.
- **Cost:** $0.
- **Cadence:** Per-decision, continuous.
- **Buyer message:** "Our 27 agents agree 99.X% of the time. Show me another vendor that measures this."

### LEAP-8 — ISO 42001 (AI Management System) as 2027 target
- **Gap exploited:** Only Intercom + Zendesk hold it. Zero RMM/PSA holders.
- **What to do:** Begin gap assessment Q3 2026; target audit Q2 2027. Free pre-cert: align to ISO 42001 controls now (model card, eval framework, incident response for AI).
- **Cost:** Audit ~$15–40K; gap analysis free.
- **Buyer message:** "First MSP/RMM to hold ISO 42001."

### LEAP-9 — BSIMM-style software security maturity disclosure
- **Gap exploited:** Only Datto publicly cites BSIMM. Zero AI vendors.
- **What to do:** Self-score against BSIMM 13 framework; publish the score and roadmap. Free; no audit required.
- **Cost:** $0.

### LEAP-10 — Publish pen-test cadence as a number
- **Gap exploited:** Universal — every vendor says "continuous" or "regular," none gives a frequency.
- **What to do:** Commit publicly to "quarterly external pen test + always-on responsible disclosure." Publish redacted summary timestamps.
- **Cost:** ~$8–15K/yr for boutique pen tester (within $20–70/mo cap? — escalate; alternative: HackerOne VDP at $0).
- **Cadence:** Quarterly.

### LEAP-11 — Bug bounty even at small scale
- **Gap exploited:** Only Atlassian in our list. No AI help desk vendor runs one.
- **What to do:** Launch a HackerOne VDP (free) or Bugcrowd minimal bounty pool. Even $500/critical signals seriousness.
- **Cost:** $0 (VDP) or $500–2K initial bounty pool.

### LEAP-12 — p50/p95/p99 latency, not just average
- **Gap exploited:** All vendors publish "average response time"; none publish percentiles.
- **What to do:** Publish ARIA route latency at p50/p95/p99 on /trust/perf, refreshed hourly.
- **Cost:** $0.

### LEAP-13 — WCAG 2.2 AA + quarterly external audit
- **Gap exploited:** Only Atlassian + Freshworks publicly commit to 2.2 AA. Zero AI help desk vendors disclose any WCAG cadence.
- **What to do:** Self-audit with axe-core in CI continuously; commission one external WCAG 2.2 AA audit per year + publish VPAT.
- **Cost:** ~$3–6K external audit/yr.

### LEAP-14 — Published jailbreak / prompt-injection resistance score
- **Gap exploited:** Universal — zero vendors publish.
- **What to do:** Run weekly red-team prompt suite (Garak, AdvBench, JailbreakBench); publish pass rate.
- **Cost:** $0.

### LEAP-15 — Conversation-volume basis for every benchmark claim
- **Gap exploited:** Most vendors quote percentages without basis. Intercom is rare (40M conversations across 7K customers).
- **What to do:** Every benchmark on iisupp.net cites: n=, time window, query types, customer count. Auditable.
- **Cost:** $0.

---

## Appendix A — Source Index by Vendor

**AI Help Desk:**
- Moveworks: [Help Security](https://help.moveworks.com/docs/security) · [ISO 27001 blog](https://www.moveworks.com/us/en/resources/blog/moveworks-iso-27001-certification) · [SOC 2](https://www.moveworks.com/insights/moveworks-soc-2-type-2-compliance) · [Platform Security](https://www.moveworks.com/us/en/platform/security)
- Aisera: [Security & Compliance](https://aisera.com/platform/security-and-compliance/) · [CLASSic Framework](https://aisera.com/blog/enterprise-ai-benchmark/) · [Auto Anywhere webinar](https://www.automationanywhere.com/resources/webinars/automation-anywhere-aisera-ai-agents)
- Forethought: [Platform Security](https://forethought.ai/platform/security) · [Trust Portal](https://trust.forethought.ai) · [Deflection Metrics blog](https://forethought.ai/blog/deflection-metrics-hide-the-real-cost-of-basic-ai-and-prove-the-value-of-smart-ai)
- Intercom: [Trust](https://trust.intercom.com/) · [ISO 42001 blog](https://www.intercom.com/blog/intercom-achieves-iso-42001-certification/) · [Fin AI](https://fin.ai/) · [Fin AI Engine](https://www.intercom.com/help/en/articles/9929230-the-fin-ai-engine)
- Zendesk: [Trust Center](https://www.zendesk.com/trust-center/) · [ISO Commitments](https://support.zendesk.com/hc/en-us/articles/4408828745626) · [Automated Resolutions](https://support.zendesk.com/hc/en-us/articles/5352026794010)
- Tidio Lyro: [Trust Portal](https://trust.tidio.com/) · [Security](https://www.tidio.com/security/) · [Resolution rates blog](https://www.tidio.com/blog/lyro-achieves-best-resolution-rates-in-industry/)
- Crisp: [SOC2 self-attest](https://help.crisp.chat/en/article/what-is-crisps-compliance-with-soc2-1xet2vz/) · [GDPR](https://help.crisp.chat/en/article/whats-crisp-eu-gdpr-compliance-status-nhv54c/)
- Espressive: [SOC 2 PR](https://www.espressive.com/press/espressive-completes-soc-2-examination-demonstrating-high-standards-for-security-availability-processing-integrity-confidentiality-and-privacy) · [ISO 27001 PR](https://www.espressive.com/press/espressive-successfully-achieves-iso-iec-27001-certification)
- IrisAgent: [Home](https://irisagent.com/) · [Deflection blog](https://irisagent.com/blog/ai-deflection-rate/)
- Rezolve: [HIPAA](https://www.rezolve.ai/legal/hipaa) · [FAQs](https://www.rezolve.ai/rezolve-faqs)

**RMM/PSA:**
- NinjaOne: [Trust Page](https://trustpage.ninjaone.com/) · [ISO Compliance blog](https://www.ninjaone.com/blog/ninjaone-is-iso27001-compliant/) · [Uptime](https://status.ninjaone.com/uptime) · [NIS2](https://www.ninjaone.com/resource/achieving-nis2-compliance-with-ninjaone/)
- Atera: [Trust](https://trust.atera.com/) · [Security article](https://support.atera.com/hc/en-us/articles/15190658626972-Security-at-Atera) · [SOC 2 blog](https://www.atera.com/blog/atera-secures-soc-2-certification/) · [AI Copilot](https://www.atera.com/ai/copilot/)
- ConnectWise: [Trust](https://www.connectwise.com/company/trust) · [Compliance](https://www.connectwise.com/company/trust/compliance) · [ScreenConnect bulletin 23.9.8](https://www.connectwise.com/company/trust/security-bulletins/connectwise-screenconnect-23.9.8) · [AI Platform](https://www.connectwise.com/platform/ai)
- Kaseya: [Trust Center](https://www.kaseya.com/trust-center/) · [InfoSec](https://www.kaseya.com/trust-center/information-security/) · [Cooper help](https://help.one.kaseya.com/help/Content/2_Features/Cooper.htm) · [CISA REvil](https://www.cisa.gov/news-events/news/kaseya-ransomware-attack-guidance-affected-msps-and-their-customers)
- Datto: [Trust Center](https://www.datto.com/trust-center/) · [RMM Infra](https://rmm.datto.com/help/en/Content/1INTRODUCTION/Infrastructure/INFRASTRUCTUREANDSECURITY.htm) · [Autotask PSA](https://www.datto.com/products/autotask-psa/)
- N-able: [Trust Center](https://www.n-able.com/trust-center) · [Security Statement](https://www.n-able.com/security-and-privacy/security-statement) · [Uptime](https://uptime.n-able.com/)
- ManageEngine: [Compliance](https://www.manageengine.com/compliance.html) · [Desktop Central ISO](https://www.manageengine.com/products/desktop-central/iso-27001-compliance.html) · [Zia AI](https://www.manageengine.com/it-operations-management/zia-ai.html)

**Enterprise ITSM:**
- ServiceNow: [Trust Compliance](https://www.servicenow.com/company/trust/compliance.html) · [TrustShare](https://trust.servicenow.com/certifications) · [SSG SLA](https://www.servicenow.com/content/dam/servicenow-assets/public/en-us/doc-type/legal/subscription-service-guide-upgrade.pdf) · [Now Assist Field Guide](https://www.servicenow.com/community/ceg-ai-coe-articles/a-field-guide-to-evaluating-analyzing-and-debugging-ai-agents-on/ta-p/3545229) · [AVR data sheet](https://www.servicenow.com/content/dam/servicenow-assets/public/en-us/doc-type/resource-center/data-sheet/ds-application-vulnerability-response.pdf) · [IRAP PR](https://www.servicenow.com/company/media/press-room/servicenow-gains-irap-certification-for-australian-government-organisations.html)
- Freshservice: [Trust](https://trust.freshworks.com/) · [Security](https://www.freshworks.com/security/trust/) · [SLA](https://www.freshworks.com/sla/) · [Freddy Trust](https://support.freshservice.com/support/solutions/articles/50000011337-freddy-ai-insights-freddy-ai-trust-frequently-asked-questions-faqs-) · [Freddy Evaluator](https://crmsupport.freshworks.com/support/solutions/articles/50000010448-evaluate-freddy-ai-agent) · [Accessibility](https://www.freshworks.com/accessibility/)
- Atlassian: [Customer Trust](https://customertrust.atlassian.com/) · [ISO 27001](https://www.atlassian.com/trust/compliance/resources/iso27001) · [FedRAMP](https://www.atlassian.com/trust/compliance/resources/fedramp) · [Cloud SLA](https://support.atlassian.com/subscriptions-and-billing/docs/service-level-agreement-for-atlassian-cloud-products/) · [Vuln Mgmt](https://www.atlassian.com/trust/security/vulnerability-management) · [Security Testing](https://www.atlassian.com/trust/security/security-testing) · [Bugcrowd](https://bugcrowd.com/engagements/atlassian) · [AI Trust](https://www.atlassian.com/trust/ai) · [Platform AI Trust](https://www.atlassian.com/platform/ai-trust) · [WCAG](https://www.atlassian.com/trust/compliance/resources/wcag) · [JSM VPAT](https://www.atlassian.com/dam/jcr:56600b46-5a7c-4272-baea-e554368bd9f1/Atlassian%20Jira%20Service%20Management%20VPAT.pdf)
- BMC Helix: [Trust Center](https://www.bmc.com/corporate/trust-center/compliance.html) · [Helix Compliance docs](https://docs.bmc.com/xwiki/bin/view/Helix-Common-Services/Other/BMC-Helix-Subscriber-Information/helixsubscriber/Security/Compliance/) · [FedRAMP PR](https://www.bmc.com/newsroom/releases/bmc-delivers-modern-service-and-operations-management-with-bmc-helix-fedramp-certification.html) · [Availability](https://www.bmc.com/corporate/trust-center/availability.html) · [HelixGPT](https://www.bmc.com/it-solutions/helixgpt.html) · [HelixGPT architecture](https://blogs.helixops.ai/architectural-approach-for-building-generative-ai-applications/) · [Remedyforce VPAT](https://docs.bmc.com/docs/BMCHelixRemedyforce/202202/en/vpat-and-wcag-accessibility-for-self-service-3-0-1104104258.html)

---

## Appendix B — What ARIA Sentinel Already Has (Per MEMORY.md)

Excluded from leapfrog gaps since already covered:
- 98.64% routing accuracy on 332K-query stress corpus (project_aria_kb_query_100pct)
- 21 Windows error detectors (Sentinel desktop)
- 3-mode safety (Observe/Suggest/Act)
- R11 privacy guard + Private Pics OFF LIMITS hard rule
- HMAC license tier gating (RUN 23e)
- OTA pipeline + admin licensing console (RUN 22, 23c, 24)
- Aperture observability + post-session email
- AROC Pattern-First law + Research Agent + Self-Learning Loop (project_aria_aroc_extension_law, project_aria_research_agent_law, project_aria_self_learning_loop)
- First-Principles Reasoner + Diagnostic-First v2 + Persona Engine v4 + 13-agent Council (project_aria_first_principles_reasoner, project_aria_diagnostic_first_v2, project_aria_v4_persona_engine, project_aria_v05_council_and_portal)
- 27-agent hierarchy (project_agent_hierarchy)

**Net new from this research:** Publish all of the above as scored, dated, source-cited trust artifacts at iisupp.net/trust/ — none of which any competitor does.

---

End of matrix. 2026-06-23.
