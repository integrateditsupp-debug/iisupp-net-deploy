# SIG-Lite Pre-filled — ARIA / Integrated IT Support Inc.

**Standard:** Shared Assessments SIG-Lite (Standardized Information Gathering questionnaire — Lite version, 2024 edition).

**Status:** Pre-filled by Integrated IT Support Inc. for customer procurement review.

**Last updated:** 2026-06-15.

**Contact for clarifications:** integrateditsupp@iisupp.net | (647) 581-3182 — Ahmad Wasee, Founder + Security Officer.

---

## A. Enterprise Risk Management

| Q# | Question | Answer |
|---|---|---|
| A.1 | Does the company have a documented risk management program? | Yes. See `governance/risk-management.html` and `compliance/SOC2-controls-self-assessment.md` Section CC3. |
| A.2 | How often is risk assessment reviewed? | Annually + after any material change (new sub-processor, architecture change, breach). |
| A.3 | Is there a designated Risk / Security Officer? | Yes. Ahmad Wasee, Founder + CISO function. |
| A.4 | Is there cyber insurance? | In procurement. Target $5M cyber liability, to be in place upon first $625K+ contract signing. |

## B. Security Policy

| Q# | Question | Answer |
|---|---|---|
| B.1 | Documented security policies exist? | Yes. 12-policy bundle in `compliance/policies/*.md` (acceptable use, access control, BCP/DR, change mgmt, data classification, encryption, incident response, password, physical, risk mgmt, vendor mgmt, vuln mgmt). |
| B.2 | Reviewed annually? | Yes. |
| B.3 | Communicated to all personnel? | Yes. Onboarding + annual refresh. Single-operator company today; loop-engineer pattern documents agent compliance. |

## C. Organizational Security

| Q# | Question | Answer |
|---|---|---|
| C.1 | Background checks for personnel? | Yes where permitted by law. |
| C.2 | Security awareness training? | Annual minimum. Topics: phishing, social engineering, password hygiene, incident reporting. |
| C.3 | Confidentiality agreements signed? | Yes — all contractors and sub-processors. |

## D. Asset Management

| Q# | Question | Answer |
|---|---|---|
| D.1 | Asset inventory maintained? | Yes — `compliance/asset-inventory.md` (cloud-only assets: Netlify project, DigitalOcean droplet, GitHub repo, Stripe, Resend). |
| D.2 | Data classification scheme? | 3 tiers — public, internal, confidential. Customer data = confidential by default. |
| D.3 | Encryption requirements documented? | Yes. TLS 1.2+ in transit. AES-256 at rest. |

## E. Human Resources Security

| Q# | Question | Answer |
|---|---|---|
| E.1 | Pre-employment screening? | Yes for direct hires. Contractors: NDA + reference check minimum. |
| E.2 | Termination procedures? | Yes — checklist includes access revocation within 1 business day, equipment return, data deletion verification. |

## F. Physical & Environmental Security

| Q# | Question | Answer |
|---|---|---|
| F.1 | Physical premises secured? | Not applicable — fully cloud-based. Sub-processors (DigitalOcean Toronto, Netlify) inherit SOC 2 + ISO 27001 physical controls. |
| F.2 | Environmental controls (fire, flood, power)? | Inherited from cloud providers. |

## G. Operations Management

| Q# | Question | Answer |
|---|---|---|
| G.1 | Change management process? | Yes. All changes through git PR + loop-engineer + qa-safety-loop pre-prod. |
| G.2 | Capacity planning? | Yes. Aperture monitors. Per-license quotas + alerting at 70/90/100% burn. |
| G.3 | Backup procedures? | Git history (code). Daily droplet snapshots (data). Atomic Netlify deploys (instant rollback). |
| G.4 | Backup testing frequency? | Quarterly restore test. |
| G.5 | Logging & monitoring? | Yes. Aperture observability dashboard captures all admin and ARIA query events. 90-day retention. |
| G.6 | Anti-malware controls? | GitHub Dependabot + npm audit + GitHub CodeQL. Continuous. |
| G.7 | Vulnerability management? | Same. Annual external pen test starting Year 2 (Year 1 = self-conducted with OWASP ZAP). |
| G.8 | Patch management cadence? | Critical: ≤ 24 hours. High: ≤ 7 days. Medium: ≤ 30 days. |

## H. Access Control

| Q# | Question | Answer |
|---|---|---|
| H.1 | Access control policy documented? | Yes. `compliance/policies/access-control.md`. |
| H.2 | Unique user IDs? | Yes. |
| H.3 | Strong password requirements? | Yes. NIST SP 800-63B aligned. ≥ 12 chars, no expiration (per NIST). |
| H.4 | Multi-factor authentication? | Yes for all admin access. Customer-side MFA enforced via IdP (SSO required at Mid-Size+ tier). |
| H.5 | Access reviews frequency? | Quarterly. |
| H.6 | Privileged access management? | Yes. Production write access limited to founder + automation (via PAT scoped to one repo). |
| H.7 | Account lockout? | Yes after 5 failed sign-in attempts (15-minute auto-unlock). |
| H.8 | Session timeout? | 30 min idle default. Configurable per customer policy. |

## I. Application Security

| Q# | Question | Answer |
|---|---|---|
| I.1 | Secure SDLC? | Yes. Loop-engineer + qa-safety-loop precede every deploy. |
| I.2 | Code reviews? | Yes. PR-based via GitHub. |
| I.3 | SAST tools used? | GitHub CodeQL. |
| I.4 | DAST tools used? | OWASP ZAP (planned 2026-Q3 — see SOC 2 self-assess). |
| I.5 | Dependency scanning? | GitHub Dependabot + npm audit weekly. |
| I.6 | OWASP Top 10 awareness? | Yes. All input validated, output encoded, parameterized queries, CSP headers set. |
| I.7 | Encryption at rest for sensitive data? | AES-256 — managed Postgres on droplet, Netlify Blobs encrypted by default. |
| I.8 | Encryption in transit? | TLS 1.2+ enforced via Netlify HSTS preload + droplet Caddy reverse proxy. |

## J. Incident Event & Communications Management

| Q# | Question | Answer |
|---|---|---|
| J.1 | Incident response plan documented? | Yes. `governance/incident-response.html` + SOC 2 self-assess CC7.3. |
| J.2 | 24/7 incident reporting? | Yes for Enterprise tier ($625K+) customers. Founder phone + WhatsApp for paging. |
| J.3 | Incident notification SLA? | P1 within 1 hour to Customer. P2 within 4 hours. Breach notification within 72 hours of confirmation. |
| J.4 | Forensic capability? | Aperture audit logs + git history + droplet snapshots provide forensic baseline. |
| J.5 | Post-incident review? | Yes within 5 business days. Shared with affected customers. |
| J.6 | Tabletop exercises? | Quarterly. |

## K. Business Resiliency

| Q# | Question | Answer |
|---|---|---|
| K.1 | Business continuity plan documented? | Yes. `compliance/policies/business-continuity.md`. |
| K.2 | Disaster recovery plan? | Yes. RTO 15 min (multi-region for Enterprise). RPO 5 min (Postgres logical replication for Enterprise). |
| K.3 | DR plan testing frequency? | Quarterly. |
| K.4 | Alternative processing site? | Multi-region failover available at Enterprise tier (active-passive Toronto + secondary region). |
| K.5 | Single point of failure analysis? | Yes. Tier-2 local KB bundle serves if droplet unavailable (already live). |

## L. Compliance

| Q# | Question | Answer |
|---|---|---|
| L.1 | SOC 2 Type II report? | Self-assessment available now under NDA. Type II audit planned upon first $625K+ contract execution. |
| L.2 | ISO 27001 certified? | Planned 2027. |
| L.3 | PCI-DSS scope? | Out of scope — Stripe handles all cardholder data. |
| L.4 | HIPAA compliant? | BAA available for healthcare customers (`legal/BAA-template.md`). Technical safeguards documented in BAA Section 6. |
| L.5 | GDPR compliant? | Yes. DPA available (`legal/DPA-template.md`). Standard Contractual Clauses 2021/914 in force for any US sub-processor transfers. |
| L.6 | CCPA / CPRA compliant? | Yes. Privacy policy expansion in progress for CCPA-specific disclosures. |
| L.7 | PIPEDA compliant? | Yes (Canadian privacy law). Privacy policy aligned. |
| L.8 | FedRAMP authorised? | No. Planned for US federal opportunities (>$1M tier). |

## M. End User Device Security

| Q# | Question | Answer |
|---|---|---|
| M.1 | MDM for company devices? | Yes — Microsoft Intune planned for Q4 2026. Today: documented BYOD policy with required controls (disk encryption, screen lock, OS patching). |
| M.2 | Anti-malware on endpoints? | Yes — Microsoft Defender on Windows, built-in macOS XProtect on Mac. |
| M.3 | Remote wipe capability? | Yes via Microsoft Account + Intune (when deployed). |

## N. Network Security

| Q# | Question | Answer |
|---|---|---|
| N.1 | Firewall / WAF deployed? | Netlify CDN provides WAF + DDoS protection. Droplet protected by Caddy reverse proxy + DigitalOcean firewall. |
| N.2 | Network segmentation? | Yes. Customer data in Postgres on droplet (private network). Public-facing static site separated. |
| N.3 | IDS/IPS? | Aperture-level anomaly detection. Cloud provider perimeter IDS. |
| N.4 | Penetration testing of network? | Annual (Year 1 self; Year 2+ external). |

## O. Privacy

| Q# | Question | Answer |
|---|---|---|
| O.1 | Privacy policy published? | Yes at `/governance/privacy.html`. |
| O.2 | Data subject rights process? | Yes per DPA Section 8. Erasure within 30 days. |
| O.3 | Data inventory maintained? | Yes per SIG question D.1. |
| O.4 | Privacy impact assessments? | DPIA template available for customer compliance teams. |
| O.5 | Cross-border data transfers? | Primary processing in Canada. US sub-processor transfers under SCCs. EU residency at Mid-Size+ tier. |
| O.6 | Data minimisation practiced? | Yes. 30-day default retention. Anonymised session tokens. No PII in operational logs. |

## P. Threat Management

| Q# | Question | Answer |
|---|---|---|
| P.1 | Threat intelligence consumed? | Yes — npm audit, GitHub Security Advisories, OWASP Top 10 quarterly review. |
| P.2 | Phishing simulation? | Quarterly for company personnel. |

## Q. Server Security

| Q# | Question | Answer |
|---|---|---|
| Q.1 | Server hardening per CIS benchmarks? | DigitalOcean Ubuntu droplet hardened per CIS Ubuntu LTS Benchmark Level 1 (firewall, fail2ban, SSH key-only, no root login, unattended-upgrades). |
| Q.2 | Patch management for servers? | Unattended-upgrades enabled. Manual review of major version upgrades. |
| Q.3 | Logging enabled? | Yes. Aperture + system logs. |

## R. Cloud Hosting

| Q# | Question | Answer |
|---|---|---|
| R.1 | Cloud provider has SOC 2? | Yes — Netlify, DigitalOcean, Stripe all SOC 2 Type II + ISO 27001. |
| R.2 | Multi-tenant isolation? | Per-tenant data isolation in roadmap for Q3 2026. Today's customers receive single-tenant deployments with code-level segmentation. |
| R.3 | Data location? | Canada primary (DigitalOcean Toronto). US sub-processor regions documented in DPA Section 6. |
| R.4 | Customer can choose region? | Yes at Mid-Size+ tier. |

---

## Notes for procurement reviewers

- Areas marked "planned" or with future dates have a clear roadmap in `outputs/ARIA-2M-READY-PLAN.md`.
- The SOC 2 Type II audit is the single largest gap; it will be funded and started upon first $625K+ contract execution.
- All answers above are verifiable through documents in the `compliance/`, `legal/`, `governance/`, and `aria-architecture/` directories of our system of record.
- Custom security questions not covered above: email integrateditsupp@iisupp.net subject "SIG follow-up — [Company]".
