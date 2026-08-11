# HIPAA Security Rule Readiness Map — ARIA / Integrated IT Support Inc.

**Version:** 1.0 — 2026-06-24
**Status:** SELF-ASSESSMENT / READINESS MAP (NOT A CERTIFICATION OR AUDIT).
**Scope:** ARIA SaaS platform + ARIA Sentinel desktop agent, as potentially used by Covered Entity / Business Associate healthcare clients.
**Standard covered:** HIPAA Security Rule, 45 CFR Part 164 Subpart C — Administrative (§164.308), Physical (§164.310), and Technical (§164.312) Safeguards, plus the BAA requirement (§164.314 / §164.308(b)).

> **Disclaimer:** This is a self-assessment / readiness map only. **There is no such thing as "HIPAA certification,"** and nothing here states or implies that IIS/ARIA is "HIPAA certified," "HIPAA compliant," "audited," or "attested." A signed **Business Associate Agreement (BAA) is REQUIRED before IIS/ARIA may create, receive, maintain, or transmit any Protected Health Information (PHI).** Until a BAA is executed and the controls below are verified, ARIA/Sentinel must not be used to process PHI. Formal legal review is pending.

---

## 0. Threshold Requirement — Business Associate Agreement

| ID | Requirement / Criterion | Our Control / Status | Evidence | Gap |
|---|---|---|---|---|
| BAA-1 | A signed BAA is in place before any PHI is handled (§164.308(b), §164.314) | **Not yet executed.** IIS will not process PHI until a BAA is signed. A BAA template is a near-term deliverable. | DPA template (analogous) | **OPEN — BAA template + execution process required before any healthcare PHI engagement** |
| BAA-2 | Sub-processors are bound by downstream BAAs | Model/hosting/payment sub-processors documented; healthcare-grade BAAs not yet secured with each. | sub-processor list | Confirm which sub-processors offer BAAs (and disable those that do not, for PHI workloads) |

---

## 1. Administrative Safeguards (§164.308)

| ID | Requirement / Criterion | Our Control / Status | Evidence | Gap |
|---|---|---|---|---|
| A-1 | §164.308(a)(1) Security management / risk analysis | General security self-assessment exists (SOC 2 map); a PHI-specific risk analysis does not. | `SOC2-controls-self-assessment.md` | Conduct PHI-specific §164.308(a)(1)(ii)(A) risk analysis |
| A-2 | §164.308(a)(2) Assigned security responsibility | Owner-operator (CEO) is the security official. | governance docs | Name the HIPAA Security Official in writing |
| A-3 | §164.308(a)(3) Workforce security | Small workforce; least-privilege access; contractors under conduct code. | access model | Document workforce authorization/clearance for PHI |
| A-4 | §164.308(a)(4) Information access management | RBAC single-owner today; tenant isolation planned. | access notes | Multi-tenant PHI isolation must be live before PHI |
| A-5 | §164.308(a)(5) Security awareness + training | Founder trained (15+ yrs IT); no formal HIPAA training record. | — | Complete + record HIPAA workforce training |
| A-6 | §164.308(a)(6) Security incident procedures | Incident-response policy exists. | `/governance/incident-response.html` | Add HIPAA breach-notification procedure (§164.400–414) |
| A-7 | §164.308(a)(7) Contingency plan | Git rollback, Netlify atomic deploys, Tier-2 KB fallback, snapshots. | runbook, fallback bundle | Document RPO/RTO + test restore for PHI data |
| A-8 | §164.308(a)(8) Evaluation | This readiness map = periodic evaluation. | this doc | Schedule recurring re-evaluation |

---

## 2. Physical Safeguards (§164.310)

| ID | Requirement / Criterion | Our Control / Status | Evidence | Gap |
|---|---|---|---|---|
| P-1 | §164.310(a) Facility access controls | All systems cloud-hosted (Netlify, DigitalOcean); no physical office/server room. | provider docs | Obtain cloud providers' physical-security attestations for PHI region |
| P-2 | §164.310(b)/(c) Workstation use + security | Sentinel runs on customer-controlled endpoints; content-blind to user files. | `ARIA Sentinel/src/shared/network-capture.mjs`, sanitization | Provide workstation-security guidance for PHI endpoints |
| P-3 | §164.310(d) Device + media controls | No physical media handled by IIS. Endpoint media controls are the customer's. | — | Document media-disposal expectations in BAA |

---

## 3. Technical Safeguards (§164.312)

| ID | Requirement / Criterion | Our Control / Status | Evidence | Gap |
|---|---|---|---|---|
| T-1 | §164.312(a)(1) Access control (unique IDs, emergency access, auto-logoff, enc/dec) | Admin login required; license-token gating; HMAC key→plan scheme. | admin auth, license scheme | Add unique-user IDs + auto-logoff for PHI-facing access |
| T-2 | §164.312(b) Audit controls | Tamper-evident audit log records system activity. | RUN 17 audit-tamper banner | Ensure audit trail captures PHI access events specifically |
| T-3 | §164.312(c) Integrity | Audit-integrity verification + git history; content-blind sanitization. | audit banner, sanitization tests | Wire audit-integrity verification at startup (noted open in prior runs) |
| T-4 | §164.312(d) Person/entity authentication | Admin token + license verification; server-side license resolve keeps secrets off the client. | `netlify/functions/sentinel-resolve.mjs` | Add MFA for PHI-facing admin access |
| T-5 | §164.312(e) Transmission security | TLS 1.2+ enforced, HSTS preload; content-blind telemetry on a 6-host allowlist. | netlify config, `ARIA Sentinel/src/shared/network-capture.mjs` | Confirm encryption-in-transit + at-rest specifically for any PHI store |

---

## Gaps & Roadmap

Open items, stated honestly:

1. **BAA first, always** — execute a signed BAA (and confirm downstream sub-processor BAAs) before any PHI is created, received, maintained, or transmitted. This is the gating control; until then ARIA/Sentinel must not process PHI.
2. **PHI-specific risk analysis** — perform a §164.308(a)(1)(ii)(A) risk analysis scoped to PHI data flows.
3. **Named Security Official + workforce training** — designate the HIPAA Security Official in writing and complete/record HIPAA workforce training.
4. **Breach-notification procedure** — add §164.400–414 breach-notification workflow to the incident-response policy.
5. **Multi-tenant PHI isolation + MFA** — tenant data isolation and MFA for PHI-facing access must be live before any PHI engagement.
6. **Audit-integrity at startup** — finish wiring audit-integrity verification at startup and ensure PHI access events are captured.
7. **Encryption at rest for PHI** — confirm and document encryption-at-rest for any PHI store; confirm cloud providers' physical-security attestations.
8. **Contingency testing** — document RPO/RTO and test restore for PHI data.
9. **Legal review** — independent counsel to review BAA, risk analysis, and breach procedures. Formal legal review is **pending**.

*Reminder: HIPAA has no government "certification." This map cannot and does not make IIS "HIPAA certified."*
