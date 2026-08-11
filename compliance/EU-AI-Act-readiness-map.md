# EU AI Act Readiness Map — ARIA / Integrated IT Support Inc.

**Version:** 1.0 — 2026-06-24
**Status:** SELF-ASSESSMENT / READINESS MAP (NOT A CERTIFICATION OR AUDIT).
**Scope:** ARIA SaaS platform + ARIA Sentinel desktop agent.
**Regulation covered:** Regulation (EU) 2024/1689 (the "EU AI Act") — risk-based obligations, transparency duties (Art. 50), GPAI provisions (Art. 51–55), and provider/deployer record-keeping.

> **Disclaimer:** This is a self-assessment / readiness map prepared internally against the EU AI Act. It is NOT a conformity assessment, CE marking, notified-body certification, or legal opinion, and it does not state or imply that IIS/ARIA is "compliant," "certified," "audited," or "attested." Risk classification and obligations under the Act are fact-specific; formal legal review and (where applicable) conformity assessment are pending.

---

## 1. Prohibited AI Practices (Art. 5)

| ID | Requirement / Criterion | Our Control / Status | Evidence | Gap |
|---|---|---|---|---|
| P-1 | No subliminal / manipulative techniques causing harm | ARIA is an IT-support assistant; no manipulative/persuasive-design objectives. Outputs are informational answers + guarded device actions. | product spec, KB renderer | None identified; confirm in legal review |
| P-2 | No exploitation of vulnerabilities (age, disability, socio-economic) | No targeting of vulnerable groups; B2B IT support context. | offer/positioning docs | None identified |
| P-3 | No social scoring | Not performed. | — | None |
| P-4 | No real-time remote biometric identification / emotion inference in workplace | ARIA does not process biometrics or infer emotion. Sentinel is content-blind to user files. | `ARIA Sentinel/src/shared/network-capture.mjs`, sanitization tests | None identified |
| P-5 | No untargeted scraping of facial images | Not performed. | privacy invariants | None |

---

## 2. Risk Classification (Art. 6 + Annex III)

| ID | Requirement / Criterion | Our Control / Status | Evidence | Gap |
|---|---|---|---|---|
| RC-1 | Determine if system is "high-risk" per Annex III use-cases | Preliminary self-classification: ARIA (IT-support Q&A) and Sentinel (device admin agent under human oversight) are **NOT** within an Annex III high-risk category as currently scoped (not biometrics, critical infrastructure operation, education scoring, employment decisions, essential-services eligibility, law enforcement, migration, or justice). | use-case mapping (this doc) | Re-classify before any deployment into HR/hiring, credit, critical-infrastructure, or public-service eligibility workflows |
| RC-2 | Confirm limited-/minimal-risk status | Treated as **limited-risk** by virtue of being an AI system users converse with → triggers Art. 50 transparency duties. Most embedded helper features are minimal-risk. | transparency controls below | Document classification rationale formally in legal review |
| RC-3 | Re-assessment on material change | Loop-engineer / qa-safety process reviews significant changes. | `docs/LOOP-ENGINEER.md` | Add explicit "AI Act re-classification" checkpoint to change template |

---

## 3. Transparency Obligations (Art. 50)

| ID | Requirement / Criterion | Our Control / Status | Evidence | Gap |
|---|---|---|---|---|
| T-1 | Inform natural persons they are interacting with an AI system | ARIA is branded and presented as an AI assistant; chat surfaces identify ARIA. | aria.html chat UI, product copy | Add an explicit, persistent "You are talking to an AI assistant" notice in every conversational surface (web + Sentinel chat tab) |
| T-2 | Label AI-generated / manipulated content (deepfakes, synthetic media) | IIS C2PA / content-provenance policy commits to labeling AI-generated/assisted marketing media. | `compliance/C2PA-content-provenance-policy.md` | Operationalize Content Credentials on produced media |
| T-3 | Disclose AI use in generated text published to inform the public | Marketing/KB content authored or assisted by AI is internally tracked. | provenance policy | Add visible AI-assistance disclosure where text is published to inform the public |
| T-4 | Provide info in clear, distinguishable manner at first interaction | Disclosure intended at first interaction. | UI | Verify timing/placement meets "at the latest at first interaction" standard |

---

## 4. General-Purpose AI (GPAI) Considerations (Art. 51–55)

| ID | Requirement / Criterion | Our Control / Status | Evidence | Gap |
|---|---|---|---|---|
| G-1 | Identify reliance on GPAI / foundation models | ARIA uses third-party foundation models (e.g., Anthropic, OpenAI) as **downstream deployer**, not as a GPAI provider. IIS does not train or place a foundation model on the market. | `netlify/functions/aria-chat.js`, sub-processor list | None as provider; confirm downstream-deployer posture in legal review |
| G-2 | Upstream provider obligations flow-down | Rely on model providers' own GPAI documentation/usage policies. | vendor docs / DPAs | Collect + retain upstream providers' GPAI transparency documentation |
| G-3 | Copyright + training-data transparency (provider duty) | Not applicable to IIS as deployer; tracked for vendor due diligence. | vendor due-diligence notes | Add to vendor review checklist |

---

## 5. Human Oversight (Art. 14 principles, applied voluntarily)

| ID | Requirement / Criterion | Our Control / Status | Evidence | Gap |
|---|---|---|---|---|
| H-1 | Human-in-the-loop for consequential actions | Sentinel device actions run under human oversight: dry-run tiers, 10s countdown, restore points, and a kill-switch before execution. | Sentinel supervisor/critic, restore-point + kill-switch features | None for current scope |
| H-2 | Ability to override / stop the system | Kill-switch + manual publish gates; auto-execution dormant by default. | RUN 23 self-service loop notes, runbook | None |
| H-3 | Avoid automation bias | Answers carry source badges + confidence; low-confidence routes to human/clarify. | KB source badges, governor gating | Continue; document oversight protocol |

---

## 6. Record-Keeping, Risk & Data Governance

| ID | Requirement / Criterion | Our Control / Status | Evidence | Gap |
|---|---|---|---|---|
| R-1 | Logging / traceability of AI events | Tamper-evident audit log + Aperture observability; content-blind telemetry. | RUN 17 audit-tamper banner, `ARIA Sentinel/src/shared/network-capture.mjs` | None for current scope |
| R-2 | Technical documentation of the system | Architecture + README + readiness maps maintained. | repo docs | Consolidate into a single AI Act technical-documentation file before any high-risk deployment |
| R-3 | Data governance / quality | KB curation + governor gating against low-quality "slop." | learning-loop gating notes | Document data-governance procedure formally |
| R-4 | Accuracy, robustness, cybersecurity | Tests green per suite; privacy invariants protected by tests. | `npm test` suites | Add adversarial/robustness eval cadence |

---

## Gaps & Roadmap

Open items, stated honestly:

1. **Persistent AI-interaction notice** — add an explicit, always-visible "you are interacting with an AI assistant" disclosure to every conversational surface (web ARIA + Sentinel Chat tab) to fully satisfy Art. 50 timing/placement.
2. **Formal classification memo** — produce a legally reviewed risk-classification rationale (Annex III walk-through) and store it as the system of record.
3. **AI-content labeling in production** — operationalize Content Credentials / visible AI-assistance disclosure on published marketing and KB content.
4. **Change-control checkpoint** — add an explicit "AI Act re-classification" gate to the loop-engineer change template, triggered on entry into any HR, credit, critical-infrastructure, or public-service workflow.
5. **Upstream GPAI documentation** — collect and retain foundation-model providers' GPAI transparency documentation as part of vendor due diligence.
6. **Consolidated technical documentation** — single AI Act technical-documentation pack (would be mandatory only if a system is later classified high-risk).
7. **Robustness evaluation cadence** — establish recurring accuracy/adversarial testing with retained results.
8. **Legal review** — independent counsel to confirm classification, deployer vs. provider posture, and EU market applicability. Formal conformity assessment (if ever high-risk) and legal review are **pending**.

*Nothing in this map should be read as a representation that IIS/ARIA has completed an EU AI Act conformity assessment or holds any certification.*
