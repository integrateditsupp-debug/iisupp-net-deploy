# NIST AI RMF 1.0 Readiness Map — ARIA / Integrated IT Support Inc.

**Version:** 1.0 — 2026-06-24
**Status:** SELF-ASSESSMENT / READINESS MAP (NOT A CERTIFICATION OR AUDIT).
**Scope:** ARIA SaaS platform + ARIA Sentinel desktop agent.
**Framework covered:** NIST AI Risk Management Framework (AI RMF 1.0, NIST AI 100-1, Jan 2023) — functions GOVERN, MAP, MEASURE, MANAGE.

> **Disclaimer:** This is a voluntary self-assessment / readiness map against the NIST AI RMF 1.0, which is a non-binding, voluntary framework. It is NOT a certification, audit, accreditation, or attestation, and it does not state or imply that IIS/ARIA is "certified" or "compliant." NIST does not certify against the AI RMF. Subcategory references are representative, not exhaustive. Independent review is pending.

---

## GOVERN — Culture, accountability, and oversight

| ID | Subcategory (representative) | Our Control / Status | Evidence | Gap |
|---|---|---|---|---|
| GOV-1.1 | Policies/processes for AI risk are in place | Loop-engineer + qa-safety protocol governs AI changes; privacy invariants are policy. | `docs/LOOP-ENGINEER.md`, CLAUDE.md working rules | Formalize a standalone AI risk-management policy |
| GOV-2.1 | Roles + responsibilities documented | Owner-operator model; agent roles documented (KB-agent, ops-agent, supervisor). | `senior-director-state/`, agent roster | Document accountable owner for each AI risk explicitly |
| GOV-3.2 | Decision-making accountable + traceable | Every change attributed via git author + agent prefix; tamper-evident audit log. | git log, RUN 17 audit-tamper banner | None for current scope |
| GOV-4.1 | Risk culture: critical thinking + safety-first | Governor gates low-confidence/low-quality outputs; human oversight default-on. | governor gating, kill-switch | None |
| GOV-6.1 | Third-party / supply-chain risk addressed | Sub-processors (model providers, hosting, payments) documented with DPAs. | sub-processor list / Trust Center | Maintain upstream model-provider risk documentation |

---

## MAP — Context and risk framing

| ID | Subcategory (representative) | Our Control / Status | Evidence | Gap |
|---|---|---|---|---|
| MAP-1.1 | Intended purpose + context established | ARIA = IT-support Q&A; Sentinel = device admin agent under human oversight. Scope documented. | product spec, README-MVP | None |
| MAP-2.3 | Capabilities + limitations characterized | Source badges + confidence scores expose uncertainty; KB-first then LLM fallback. | KB source badges, RUN 31 routing | Publish a documented limitations statement |
| MAP-3.1 | Benefits + potential harms identified | Privacy-first design; content-blind telemetry limits data-exposure harm. | `network-capture.mjs`, sanitization tests | Maintain a living harm/impact log |
| MAP-4.1 | Third-party AI components inventoried | Foundation-model providers inventoried as sub-processors. | sub-processor list | None |
| MAP-5.1 | Impacts to individuals/groups assessed | Limited PII handling; 30-day purge; erasure on request. | privacy policy | Document a lightweight AI impact assessment |

---

## MEASURE — Analyze, assess, and track

| ID | Subcategory (representative) | Our Control / Status | Evidence | Gap |
|---|---|---|---|---|
| MEA-1.1 | Appropriate metrics/methods identified | Classifier harness (~99.7% on 34K cases); test suites per feature. | `npm test` suites, classifier harness | Add ongoing quality dashboards |
| MEA-2.5 | System validity + reliability evaluated | Per-feature test suites kept green; mode-execution proof harness for Sentinel. | suite results | Add recurring regression eval cadence |
| MEA-2.7 | Security + resilience evaluated | Privacy invariants test-guarded; tamper-evident audit log; kill-switch. | tests, audit banner | Schedule periodic adversarial/abuse testing |
| MEA-2.11 | Fairness + bias evaluated | Not a decisioning system; low bias surface (IT-support context). | use-case scope | Document a bias review even if low-risk |
| MEA-3.1 | Risks tracked over time | Aperture observability + agent-signal events surface anomalies. | Aperture, function logs | Centralize AI-risk tracking register |
| MEA-4.1 | Feedback from users incorporated | Learning loop ingests curated knowledge; governor filters echo-chamber slop. | learning-loop notes | Continue; document feedback governance |

---

## MANAGE — Prioritize and act on risks

| ID | Subcategory (representative) | Our Control / Status | Evidence | Gap |
|---|---|---|---|---|
| MAN-1.1 | Risks prioritized + resourced | Loop-board prioritizes work; safety items gated before prod. | loop-board.md | Add explicit AI-risk prioritization tiering |
| MAN-2.1 | Mechanisms to sustain value while managing risk | Restore points + atomic rollback (git/Netlify) + Tier-2 KB fallback. | runbook, fallback bundle | None |
| MAN-2.3 | Mechanism to deactivate/override the system | Kill-switch; auto-execution dormant by default; manual publish gates. | kill-switch, RUN 23 notes | None |
| MAN-2.4 | Incidents + recovery handled | Incident-response policy; git rollback = full recovery. | `/governance/incident-response.html` | Quarterly tabletop drill |
| MAN-3.1 | Third-party risks managed | Vendor DPAs; content-blind boundary limits data shared with model providers. | DPAs, `network-capture.mjs` | Retain upstream model-provider risk records |
| MAN-4.1 | Post-deployment monitoring | Aperture latency/anomaly tracking + email evolution reports. | Aperture, `aria-evolution-report` | Add post-deployment AI-incident logging |

---

## Gaps & Roadmap

Open items, stated honestly:

1. **Standalone AI risk-management policy** — formalize the GOVERN function into a single documented policy with named accountable owners per risk.
2. **Limitations + impact statements** — publish a documented capabilities/limitations statement and a lightweight AI impact assessment (MAP).
3. **Central AI-risk register** — one tracked register for identified AI risks, status, and mitigations over time (MEASURE/MANAGE).
4. **Recurring evaluation cadence** — schedule periodic regression, adversarial/abuse, and bias reviews with retained results (MEASURE).
5. **Post-deployment AI-incident logging** — explicit incident category + tabletop drill cadence (MANAGE).
6. **Upstream model-provider risk records** — retain providers' safety/usage documentation as supply-chain evidence.
7. **Independent review** — third-party review of this self-assessment is pending; NIST does not certify, so no certification will ever be claimed.

*This map reflects voluntary alignment work. It is not, and does not claim to be, a certification or audit result.*
