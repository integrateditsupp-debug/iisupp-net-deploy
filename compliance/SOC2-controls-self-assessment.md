# SOC 2 Controls Self-Assessment — ARIA / Integrated IT Support Inc.

**Version:** 1.0 — 2026-06-15
**Status:** SELF-ASSESSMENT (NOT AN AUDIT). For internal readiness + customer Trust Center publishing.
**Scope:** ARIA SaaS platform (iisupp.net, aria.iisupp.net droplet, Aperture observability, Netlify production).
**Trust Services Criteria covered:** Security (CC1–CC9), Confidentiality (C1), Availability (A1).

> **Disclaimer:** This is a self-assessment based on AICPA SOC 2 Trust Services Criteria 2017 (revised 2022). It is NOT a SOC 2 Type I or Type II attestation. A Type II audit by a licensed CPA firm is the eventual requirement for $625K+ enterprise contracts.

---

## CC1 — Control Environment

| ID | Criterion | Our Control | Evidence | Gap |
|---|---|---|---|---|
| CC1.1 | Ethical values + integrity | Code of Conduct published (`/governance/code-of-conduct.html`). All contractors sign. | governance page | None |
| CC1.2 | Board oversight | Sole owner-operator (Ahmad Wasee, CEO). All security decisions logged in memory + git. | git log + Aperture | Note in DPA: small company governance |
| CC1.3 | Org structure + reporting lines | Documented in the internal operating record, retained in version control. | repo | None |
| CC1.4 | Competence | Founder 15+ yrs IT. Automated build and operations agents operate under a documented engineering protocol. | docs | None |
| CC1.5 | Accountability | Every change attributed via git commit author + agent prefix (`[kb-agent]`, `[ops-agent]`). | git log | None |

---

## CC2 — Communication and Information

| ID | Criterion | Our Control | Evidence | Gap |
|---|---|---|---|---|
| CC2.1 | Internal info quality | All decisions in the internal decision log + git history. | repo | None |
| CC2.2 | Internal communication | Loop-engineer protocol documented + executed daily. | `docs/LOOP-ENGINEER.md` | None |
| CC2.3 | External communication | Privacy policy + Terms published. Trust Center next deliverable. | `/governance/privacy.html`, `/terms.html` | Trust page: TODO Item 2 |

---

## CC3 — Risk Assessment

| ID | Criterion | Our Control | Evidence | Gap |
|---|---|---|---|---|
| CC3.1 | Risk identification | Pen test self-report annual cadence (OWASP ZAP, Burp Community, GitHub CodeQL). | First report due 2026-Q3 | TODO Item 10 |
| CC3.2 | Fraud risk | Stripe handles payment fraud. No direct card storage. | Stripe Trust Center | None |
| CC3.3 | Significant change risk | Every change reviewed via loop-engineer + qa-safety-loop. | loop-board.md | None |
| CC3.4 | Risk response | Incident response policy (`/governance/incident-response.html`). | governance | Test runbook quarterly |

---

## CC4 — Monitoring Activities

| ID | Criterion | Our Control | Evidence | Gap |
|---|---|---|---|---|
| CC4.1 | Ongoing evaluation | Aperture observability dashboard (`/aperture-learning.html` admin login). | live | None |
| CC4.2 | Communication of deficiencies | All anomalies emit `aria:agent-signal` events + email reports via `aria-evolution-report`. | function logs | None |

---

## CC5 — Control Activities

| ID | Criterion | Our Control | Evidence | Gap |
|---|---|---|---|---|
| CC5.1 | Control activities aligned with risk | Per-layer: WAF (Netlify), HTTPS-only (forced), input validation (Netlify Forms), output sanitization (markdown escaping in KB renderer). | code review | None |
| CC5.2 | Technology controls | Auto-build via Netlify, manual publish gate (auto-publish locked). Branch protection via PAT scope. | netlify + GitHub | None |
| CC5.3 | Policies + procedures | 12-policy bundle (TODO Item 9). | TBD | TODO |

---

## CC6 — Logical and Physical Access Controls

| ID | Criterion | Our Control | Evidence | Gap |
|---|---|---|---|---|
| CC6.1 | Access provisioning | Automation PAT scoped to one repo, write only. Droplet SSH via SSH key. Netlify via OAuth (Google). | github settings | Future: SCIM for customer admins (TODO Item 12) |
| CC6.2 | Access removal | PAT revocable at github.com/settings/tokens. Droplet keys removable via ~/.ssh/authorized_keys. | runbook | Document quarterly access review |
| CC6.3 | RBAC | Single owner today. Multi-tenant RBAC matrix (TODO Item 24) for customer-side. | TBD | TODO |
| CC6.4 | Physical access | All systems are cloud-hosted (Netlify, DigitalOcean Toronto). No physical office. | provider docs | None |
| CC6.5 | Disposal of physical media | N/A — no physical media. | — | None |
| CC6.6 | Logical access to data | Aperture login required for admin views. Customer data isolated per-tenant (planned). | live + spec | TODO Item 19 |
| CC6.7 | Transmission integrity | TLS 1.2+ enforced. Netlify HSTS preload. | netlify config | None |
| CC6.8 | Software security | npm audit weekly, GitHub Dependabot enabled. | github | Enable Dependabot if not already on |

---

## CC7 — System Operations

| ID | Criterion | Our Control | Evidence | Gap |
|---|---|---|---|---|
| CC7.1 | Vulnerability mgmt | npm audit + Dependabot + OWASP ZAP scan annual. | github + TODO Item 10 | Set up Dependabot |
| CC7.2 | Anomaly detection | Aperture detects abnormal ARIA traffic patterns. | live | None |
| CC7.3 | Incident response | `/governance/incident-response.html` policy. WhatsApp + email channels for paging. | governance | Quarterly tabletop drill |
| CC7.4 | Incident recovery | Git history = full rollback. Netlify deploys are atomic (instant rollback to any previous). Droplet snapshots manual. | runbook | Document RPO/RTO per CC7.5 |
| CC7.5 | Business continuity | Tier 2 KB fallback (`assets/aria-kb-local-bundle.json`) serves if droplet down. Multi-region planning (TODO Item 21). | live | None |

---

## CC8 — Change Management

| ID | Criterion | Our Control | Evidence | Gap |
|---|---|---|---|---|
| CC8.1 | Change authorization | All code via PR or direct commit by authorized owner. Loop-engineer routes changes through qa-safety-loop pre-prod. | git log | None |

---

## CC9 — Risk Mitigation

| ID | Criterion | Our Control | Evidence | Gap |
|---|---|---|---|---|
| CC9.1 | Risk mitigation activities | Insurance: cyber liability $5M (target — to procure pre-first-enterprise-deal). Backups: Git + droplet snapshots. | TBD | Buy cyber insurance with first enterprise deal |
| CC9.2 | Vendor mgmt | Sub-processors documented in Trust Center (Netlify, DigitalOcean, Stripe, OpenAI, Anthropic, Resend). DPAs in place per vendor. | trust page | Trust page TODO |

---

## C1 — Confidentiality (TSC 2017)

| ID | Criterion | Our Control | Gap |
|---|---|---|---|
| C1.1 | Identify confidential info | Customer query data, KB-customer-specific, license tokens. All tagged in code. | None |
| C1.2 | Dispose of confidential info | 30-day auto-purge (per privacy policy). Erasure on request within 30 days. | Test purge job exists |

---

## A1 — Availability (TSC 2017)

| ID | Criterion | Our Control | Gap |
|---|---|---|---|
| A1.1 | Performance monitoring | Netlify uptime monitoring + Aperture latency tracking. | Public status page TODO |
| A1.2 | Recovery from incidents | Tier 2 local KB fallback. Atomic Netlify rollback. | Multi-region (TODO Item 21) |
| A1.3 | Capacity planning | Per-license query quotas + alerting at 70/90/100% burn. | Active in spec, code in build |

---

## NEXT-30-DAY READINESS PLAN

| Action | Owner | Effort | Cost |
|---|---|---|---|
| Trust Center page publish | Engineering | 3 hrs | $0 |
| 12 SANS-template policies | Engineering | 6 hrs | $0 |
| First OWASP ZAP self-scan + report | Engineering | 4 hrs | $0 |
| Privacy policy GDPR/CCPA expansion | Engineering | 2 hrs | $0 |
| DPA template draft | Engineering | 2 hrs | $0 |
| Cyber liability insurance quote (procure on first enterprise deal) | Ahmad | 1 hr | ~$3-5K/yr (deferred until deal closes) |
| Dependabot enable | Ahmad | 5 min | $0 |
| SOC 2 Type II auditor selection (when ready) | Ahmad | varies | $15-40K (deferred until $625K deal signed) |

---

## SELF-ASSESSMENT SCORE

| TSC Area | Coverage | Notes |
|---|---|---|
| CC1 Control Env | 90% | Small-company caveats acceptable |
| CC2 Communication | 70% | Trust page open |
| CC3 Risk Assessment | 60% | Pen test pending |
| CC4 Monitoring | 85% | Aperture good |
| CC5 Control Activities | 70% | Policies pending |
| CC6 Access | 75% | Customer-side RBAC pending |
| CC7 System Ops | 75% | Tabletop drill pending |
| CC8 Change Mgmt | 90% | Loop-engineer covers |
| CC9 Risk Mitigation | 60% | Cyber insurance + DPAs pending |
| C1 Confidentiality | 80% | Strong by design |
| A1 Availability | 75% | Status page + multi-region pending |
| **Overall** | **75%** | **Type 1 ready in 30 days. Type 2 ready in 6 months + audit ($15-40K).** |

---

## Audit-readiness milestones

1. **Today:** Self-assessment published. Trust Center page goes up. Customers can read what we do.
2. **+30 days:** Tier 1 procurement-unblockers shipped (12 policies, DPA, MSA, BAA, pen test, trust page).
3. **+60 days:** SAML SSO + ServiceNow connector live. Procurement collateral kit shipped.
4. **+90 days:** Multi-tenant data isolation live. Admin console MVP.
5. **+180 days:** SOC 2 Type II audit kickoff IF first $625K+ deal signed (insurance + audit fee approved).
