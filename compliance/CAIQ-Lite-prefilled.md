# CAIQ-Lite Pre-filled — ARIA / Integrated IT Support Inc.

**Standard:** Cloud Security Alliance Consensus Assessments Initiative Questionnaire (CAIQ) v4.0.2 — Lite version.

**Status:** Pre-filled. Available to customers as part of procurement collateral.

**Last updated:** 2026-06-15.

---

## Application & Interface Security (AIS)

| Q# | Question | Y/N | Notes |
|---|---|---|---|
| AIS-01 | Are applications designed in accordance with industry-accepted secure coding standards? | Yes | OWASP Top 10 + ASVS Level 2 alignment. |
| AIS-02 | Are inputs validated to prevent injection (SQLi, XSS, etc.)? | Yes | Parameterized queries; output encoding; CSP. |
| AIS-03 | Are vulnerabilities tested before deployment? | Yes | GitHub CodeQL on every PR + Dependabot. |
| AIS-04 | Are security-related configurations documented? | Yes | `compliance/policies/encryption.md` + Netlify config in repo. |

## Audit Assurance & Compliance (AAC)

| Q# | Question | Y/N | Notes |
|---|---|---|---|
| AAC-01 | Are audit plans, activities, and results documented? | Yes | Self-assessment available; SOC 2 Type II audit planned. |
| AAC-02 | Are independent third-party audits performed? | Planned | First external audit upon first $625K+ contract execution. |
| AAC-03 | Are compliance violations tracked and remediated? | Yes | Aperture flags + remediation tickets logged. |

## Business Continuity Management (BCR)

| Q# | Question | Y/N | Notes |
|---|---|---|---|
| BCR-01 | Is there a documented BCP/DR plan? | Yes | `compliance/policies/business-continuity.md`. |
| BCR-02 | Is the plan tested annually? | Yes (quarterly) | Tabletop + technical restore tests. |
| BCR-03 | Are backups encrypted? | Yes | AES-256. |
| BCR-04 | Is data backed up regularly? | Yes | Git history (code), daily droplet snapshots (data). |
| BCR-05 | RTO documented? | Yes | 15 min Enterprise; 4 hours SBA. |
| BCR-06 | RPO documented? | Yes | 5 min Enterprise; 24 hours SBA. |

## Change Control & Configuration Management (CCC)

| Q# | Question | Y/N | Notes |
|---|---|---|---|
| CCC-01 | Are changes documented and approved? | Yes | git PR + loop-engineer + qa-safety-loop gate. |
| CCC-02 | Are emergency changes tracked? | Yes | Auto-publish lock + manual deploy approval. |
| CCC-03 | Are configurations baselined? | Yes | git as source of truth. |

## Data Security & Information Lifecycle Management (DSI)

| Q# | Question | Y/N | Notes |
|---|---|---|---|
| DSI-01 | Data classified? | Yes | Public / internal / confidential. |
| DSI-02 | Data encrypted at rest? | Yes | AES-256. |
| DSI-03 | Data encrypted in transit? | Yes | TLS 1.2+. |
| DSI-04 | Data retention defined? | Yes | 30 days conversations; 90 days logs; 7 years billing. |
| DSI-05 | Secure data disposal process? | Yes | DPA Section 7. Hard delete within 60 days post-termination. |
| DSI-06 | Customer data segregation? | In progress | Single-tenant deployment today; per-tenant pgvector schema by Q3 2026. |
| DSI-07 | Data lineage tracked? | Yes | Aperture logs all data flows. |

## Datacenter Security (DCS)

| Q# | Question | Y/N | Notes |
|---|---|---|---|
| DCS-01 | Datacenters physically secure? | Inherited | DigitalOcean Toronto SOC 2 + ISO 27001. |
| DCS-02 | Environmental controls? | Inherited | Same. |
| DCS-03 | Access logged? | Inherited | Same. |

## Encryption & Key Management (EKM)

| Q# | Question | Y/N | Notes |
|---|---|---|---|
| EKM-01 | Encryption standards used? | Yes | AES-256-GCM at rest, TLS 1.2+ in transit. |
| EKM-02 | Key management process documented? | Yes | `compliance/policies/encryption.md`. |
| EKM-03 | Key rotation cadence? | Annual minimum; on personnel change. |
| EKM-04 | Customer-managed encryption keys (CMEK)? | Planned for Enterprise tier (Q4 2026). |

## Governance & Risk Management (GRM)

| Q# | Question | Y/N | Notes |
|---|---|---|---|
| GRM-01 | Information security policies documented? | Yes | 12-policy bundle. |
| GRM-02 | Risk assessment performed? | Yes annually + after material change. |
| GRM-03 | Designated security officer? | Yes | Ahmad Wasee, Founder + CISO. |
| GRM-04 | Insurance coverage? | Cyber liability in procurement. |

## Human Resources (HRS)

| Q# | Question | Y/N | Notes |
|---|---|---|---|
| HRS-01 | Background checks? | Yes where permitted. |
| HRS-02 | Confidentiality agreements? | Yes — all personnel and sub-processors. |
| HRS-03 | Security training? | Annual minimum. |
| HRS-04 | Offboarding process documented? | Yes — access revoked within 1 biz day. |

## Identity & Access Management (IAM)

| Q# | Question | Y/N | Notes |
|---|---|---|---|
| IAM-01 | Unique user IDs? | Yes. |
| IAM-02 | MFA for admin access? | Yes. |
| IAM-03 | Customer SSO supported? | SAML / OIDC planned Q3 2026. |
| IAM-04 | RBAC implemented? | In progress for customer-side. Provider-side: single owner + scoped PATs. |
| IAM-05 | Privileged access management? | Yes — production write limited to founder + a scoped automation PAT. |
| IAM-06 | Access logged? | Yes — Aperture + GitHub audit log. |
| IAM-07 | Access reviewed quarterly? | Yes. |

## Infrastructure & Virtualization Security (IVS)

| Q# | Question | Y/N | Notes |
|---|---|---|---|
| IVS-01 | Network segmentation? | Yes — public CDN vs private droplet network. |
| IVS-02 | Hypervisor security? | Inherited from DigitalOcean. |
| IVS-03 | VM image hardening? | Yes — CIS Ubuntu Benchmark L1. |
| IVS-04 | Vulnerability scanning? | Trivy on droplet images; npm audit on dependencies. |

## Interoperability & Portability (IPY)

| Q# | Question | Y/N | Notes |
|---|---|---|---|
| IPY-01 | Customer data export available? | Yes — JSON + Markdown export within 30 days. |
| IPY-02 | Standard APIs documented? | Yes — REST + webhooks (full docs Q4 2026). |
| IPY-03 | No vendor lock-in for customer KB? | Yes — KB articles are plain markdown, fully portable. |

## Mobile Security (MOS)

| Q# | Question | Y/N | Notes |
|---|---|---|---|
| MOS-01 | Mobile app secure? | ARIA is web-first (iOS Safari + Android Chrome). Mobile-specific app planned 2027. |
| MOS-02 | Mobile sessions secured? | Yes — TLS + token-based. |

## Security Incident Management (SEF)

| Q# | Question | Y/N | Notes |
|---|---|---|---|
| SEF-01 | Incident response plan? | Yes. |
| SEF-02 | 24/7 incident contact? | Yes for Enterprise — founder phone + WhatsApp. |
| SEF-03 | Forensic capability? | Yes — Aperture + git + snapshots. |
| SEF-04 | Customer notification SLA? | 72 hours for confirmed PHI / PII breach (PIPEDA + GDPR). |

## Supply Chain Management (STA)

| Q# | Question | Y/N | Notes |
|---|---|---|---|
| STA-01 | Sub-processor inventory? | Yes — published at `/trust` (planned) + DPA Section 6. |
| STA-02 | Sub-processor security reviewed? | Yes annually + on onboarding. |
| STA-03 | Sub-processor agreements include security? | Yes — DPAs in place with all. |

## Threat & Vulnerability Management (TVM)

| Q# | Question | Y/N | Notes |
|---|---|---|---|
| TVM-01 | Vulnerability scanning frequency? | Continuous (Dependabot) + weekly (npm audit). |
| TVM-02 | Patch SLA? | Critical 24h; High 7d; Medium 30d. |
| TVM-03 | Penetration testing? | Annual — Year 1 self; Year 2+ external. |

---

## Notes

- Items marked "in progress," "planned," or with future dates have a clear roadmap in `outputs/ARIA-2M-READY-PLAN.md`.
- Customer with custom CAIQ-Lite questions: email integrateditsupp@iisupp.net subject "CAIQ follow-up — [Company]".
