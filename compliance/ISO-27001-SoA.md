# ISO/IEC 27001:2022 Statement of Applicability (SoA) — ARIA / Integrated IT Support Inc.

**Version:** 1.0 — 2026-06-24
**Status:** SELF-ASSESSMENT / READINESS MAP (NOT A CERTIFICATION OR AUDIT).
**Scope:** ARIA SaaS platform + ARIA Sentinel desktop agent.
**Standard covered:** ISO/IEC 27001:2022 Annex A — 93 controls across 4 themes (Organizational, People, Physical, Technological). Summarized by theme and representative controls.

> **Disclaimer:** This is a self-assessment / readiness Statement of Applicability prepared internally. It is NOT an ISO/IEC 27001 certification, a certification-body audit, or an attestation, and it does not state or imply that IIS/ARIA is "ISO 27001 certified," "compliant," or "audited." Certification can only be issued by an accredited certification body following a formal audit. This SoA complements the existing `compliance/iso-27001-readiness.html` readiness page. Formal audit and legal review are pending.

---

## How to read this SoA
- **Applicable?** Y = control is in scope for IIS/ARIA; N = excluded with justification.
- **Implementation status:** Implemented / Partial / Planned.
- Representative controls are shown per theme (the standard has 93 Annex A controls; this SoA summarizes rather than enumerating all 93).

---

## A.5 — Organizational Controls (37 controls)

| Control | Applicable? | Justification | Implementation status | Gap |
|---|---|---|---|---|
| A.5.1 Policies for information security | Y | Core to running a SaaS + agent. | Partial | Consolidate into a single approved ISMS policy set (12-policy bundle pending) |
| A.5.7 Threat intelligence | Y | Dependabot + npm audit + provider advisories. | Partial | Formalize threat-intel intake |
| A.5.9 Inventory of information + assets | Y | Repo, droplet, Netlify, sub-processors documented. | Partial | Maintain a formal asset register |
| A.5.15 Access control | Y | Scoped PAT, SSH keys, admin login. | Implemented | Quarterly access review to document |
| A.5.19–5.22 Supplier / sub-processor security | Y | Sub-processors + DPAs documented. | Partial | Add supplier security review cadence + BAAs where needed |
| A.5.23 Cloud services security | Y | Netlify + DigitalOcean cloud posture. | Partial | Document cloud-service security requirements |
| A.5.24–5.28 Incident management | Y | Incident-response policy + git rollback. | Partial | Quarterly tabletop drill |
| A.5.30 ICT readiness for continuity | Y | Tier-2 KB fallback, atomic rollback. | Partial | Document RPO/RTO |
| A.5.31 Legal/regulatory requirements | Y | Privacy/Terms published; readiness maps maintained. | Partial | Legal review pending |
| A.5.34 Privacy + PII protection | Y | Content-blind telemetry, 30-day purge, erasure on request. | Implemented | None for current scope |

---

## A.6 — People Controls (8 controls)

| Control | Applicable? | Justification | Implementation status | Gap |
|---|---|---|---|---|
| A.6.1 Screening | Y | Small workforce; contractors vetted. | Partial | Document screening procedure |
| A.6.2 Terms + conditions of employment | Y | Conduct code signed by contractors. | Implemented | Reference security responsibilities explicitly |
| A.6.3 Awareness, education + training | Y | Founder experienced; no formal records. | Planned | Establish + record security training |
| A.6.4 Disciplinary process | Y | Owner-operator governance. | Planned | Document disciplinary process |
| A.6.5 Responsibilities after termination | Y | Access removable (PAT, SSH, OAuth). | Implemented | Document offboarding checklist |
| A.6.7 Remote working | Y | Fully remote operation. | Partial | Document remote-working security policy |
| A.6.8 Information security event reporting | Y | agent-signal events + email reports. | Implemented | None |

---

## A.7 — Physical Controls (14 controls)

| Control | Applicable? | Justification | Implementation status | Gap |
|---|---|---|---|---|
| A.7.1–7.4 Physical perimeter / entry / monitoring | N | No physical office or data center; all cloud-hosted. | N/A | Rely on cloud providers' physical attestations |
| A.7.5–7.8 Protection against physical/environmental threats | N | Inherited from Netlify / DigitalOcean facilities. | N/A | Obtain provider attestations on file |
| A.7.9 Security of assets off-premises | Y | Founder/endpoint devices off-premises. | Partial | Document endpoint security baseline |
| A.7.10 Storage media | N | No physical media handled by IIS. | N/A | None |
| A.7.14 Secure disposal/re-use of equipment | Y | Endpoint device disposal applies. | Partial | Document secure-disposal procedure for endpoints |

---

## A.8 — Technological Controls (34 controls)

| Control | Applicable? | Justification | Implementation status | Gap |
|---|---|---|---|---|
| A.8.1 User endpoint devices | Y | Sentinel runs on endpoints; content-blind. | Implemented | Endpoint hardening guidance |
| A.8.2/8.3 Privileged + restricted access | Y | Admin login, scoped PAT, server-side license resolve. | Implemented | Add MFA for admin |
| A.8.5 Secure authentication | Y | Admin token + HMAC license scheme. | Partial | MFA + unique IDs |
| A.8.8 Management of technical vulnerabilities | Y | npm audit + Dependabot + planned ZAP scan. | Partial | Enable Dependabot + first ZAP report |
| A.8.9 Configuration management | Y | Infra-as-config (netlify.toml), git-tracked. | Implemented | None |
| A.8.12 Data leakage prevention | Y | Content-blind sanitization + 6-host telemetry allowlist (test-guarded). | Implemented | None for current scope |
| A.8.15 Logging | Y | Tamper-evident audit log + Aperture. | Implemented | None |
| A.8.16 Monitoring activities | Y | Aperture anomaly detection. | Implemented | None |
| A.8.23 Web filtering | Y | Outbound restricted to allowlist paths. | Implemented | None |
| A.8.24 Use of cryptography | Y | TLS 1.2+, HMAC, HSTS preload. | Implemented | Document key-management for at-rest |
| A.8.25–8.29 Secure development lifecycle | Y | Tests-per-feature, loop-engineer + qa-safety gating, `node --check`. | Implemented | Document SDLC policy formally |
| A.8.31 Separation of environments | Y | Build vs. customer build allow-list; manual publish gate. | Implemented | None |

---

## Gaps & Roadmap

Open items, stated honestly:

1. **ISMS policy set** — consolidate scattered rules into an approved 12-policy ISMS bundle (pending).
2. **Asset + risk register** — maintain a formal asset register and risk-treatment plan (required to back an SoA in a real audit).
3. **People controls** — establish and record security training, screening, disciplinary, and offboarding procedures.
4. **MFA + unique IDs** — add MFA and unique user IDs for privileged/admin access (A.8.2/8.5).
5. **Vulnerability management** — confirm Dependabot is enabled and produce the first ZAP self-scan report (A.8.8).
6. **Continuity documentation** — document RPO/RTO and run a continuity/incident tabletop drill (A.5.24–5.30).
7. **Cloud + endpoint attestations** — obtain Netlify/DigitalOcean physical-security attestations and document an endpoint security baseline.
8. **Key management** — document encryption-at-rest key-management procedure (A.8.24).
9. **Certification path** — formal certification can only follow an accredited certification-body audit; none is claimed. Legal/audit engagement is **pending**.

*This SoA is a self-assessment artifact and does not represent an ISO/IEC 27001 certification.*
