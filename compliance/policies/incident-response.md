# Incident Response Plan

**Owner:** Ahmad Wasee, CISO  |  **Version:** 1.0  |  **Effective:** 2026-06-15  |  **Review cycle:** Annual + after every incident

## Purpose

Define how Integrated IT Support Inc. detects, responds to, contains, eradicates, recovers from, and learns from security incidents affecting ARIA, iisupp.net, and customer data.

## Scope

All security incidents affecting Integrated IT Support Inc. systems, third-party sub-processors, or customer data.

## Definitions

- **Incident:** any event that compromises (or threatens) confidentiality, integrity, or availability of systems or data.
- **Breach:** an incident involving unauthorized access to or disclosure of customer Personal Data or PHI.
- **Severity tiers:**
  - **P1 (Critical):** data exposure, full service outage, ransomware, active intrusion.
  - **P2 (High):** partial service degradation affecting multiple customers, suspected unauthorized access without confirmed exposure, sub-processor breach.
  - **P3 (Medium):** isolated bugs affecting single customer, suspicious activity without confirmation, internal policy violation.
  - **P4 (Low):** minor anomalies, false-positive alerts, informational events.

## Response process

### 1. Detection
**Sources:**
- Aperture observability dashboard alerts
- Netlify build / deploy alerts
- Stripe webhook anomalies
- DigitalOcean monitoring alerts
- Customer reports (integrateditsupp@iisupp.net or WhatsApp (647) 581-3182)
- GitHub Security Advisories / Dependabot
- Sub-processor breach notifications

### 2. Triage (within SLA per severity)

| Severity | Triage SLA |
|---|---|
| P1 | 15 minutes |
| P2 | 1 hour |
| P3 | 4 hours |
| P4 | Next business day |

Triage decisions:
- Confirm whether it's a real incident or false positive.
- Classify severity.
- Assemble response team (today: Founder; expand as company grows).
- Open incident ticket in Aperture with assigned IR ID.

### 3. Containment

**Immediate actions:**
- Isolate affected systems (revoke compromised credentials, suspend tenant access, take service offline if needed).
- Preserve evidence (snapshot droplet, export logs, freeze Aperture data).
- Prevent further damage.

**Short-term:**
- Rotate keys/passwords for any potentially compromised credentials.
- Block source IPs at WAF/firewall level.
- Disable compromised user accounts.

### 4. Eradication

- Identify and remove root cause.
- Patch vulnerabilities.
- Remove malware or backdoors.
- Verify removal via scanning.

### 5. Recovery

- Restore services from clean backups if compromised.
- Reset all credentials.
- Re-enable customer access.
- Increase monitoring for return of attacker or recurrence.

### 6. Customer notification

**For confirmed breaches involving customer data:**
- Notify affected customers within 72 hours of confirmation (GDPR + PIPEDA requirement).
- Notification includes: nature of incident, data affected, mitigation steps, recommendations, ARIA Provider contact for questions.
- Method: email to customer's designated security contact + posted to status page.

**For service incidents (no data exposure):**
- Status page update within 15 minutes of confirmation.
- Email to all affected customers within 1 hour.

### 7. Regulatory notification

- Office of the Privacy Commissioner of Canada (PIPEDA): within 30 days if "real risk of significant harm."
- EU Supervisory Authority (GDPR): within 72 hours if applicable.
- US state AGs / regulators: per applicable state breach notification laws.
- HHS OCR (HIPAA): per BAA — within 60 days, customer leads notification per CFR 164.404.

### 8. Post-incident review (PIR)

Within 5 business days of incident resolution:
- Convene PIR meeting (Founder + any contractors involved).
- Document timeline, root cause, response effectiveness, lessons learned.
- Identify preventive measures and assign owners.
- Update runbooks, policies, and monitoring as needed.
- Share PIR summary with affected customers.
- Add to `governance/incident-history.md` (private, audit-only).

## Communication

### Internal escalation chain
- Founder (Ahmad Wasee): direct line (647) 581-3182, WhatsApp, integrateditsupp@iisupp.net.
- Future: dedicated CISO, IR team as company grows.

### External communications
- Customers: incident-affected customers via email + status page.
- Public: only if material; press release coordinated with legal counsel.
- Regulators: per Section 7 above.
- Insurance: cyber liability insurer notified per policy terms.

### Status page
- `status.iisupp.net` (planned Q3 2026).
- Updated within 15 minutes of confirmed incident.
- Updated every hour during active P1/P2 incidents.

## Training & exercises

- Quarterly tabletop exercise covering realistic incident scenarios.
- Annual full-scale exercise including customer notification simulation.
- Personnel onboarding includes incident response training.

## Tools & systems

- **Detection:** Aperture, Netlify alerts, DigitalOcean alerts, GitHub Security tab.
- **Logging:** Aperture audit dashboard, droplet syslog, Netlify function logs.
- **Communication:** Email, WhatsApp, status page (planned).
- **Forensics:** Droplet snapshots, git history, exported logs.
- **Recovery:** Atomic Netlify deploys, droplet snapshots, git rollback.

## Roles & responsibilities

| Role | Responsibilities |
|---|---|
| CISO (Founder) | Final authority for incident response; customer + regulator notification; PIR convener. |
| Engineering (founder + build agents) | Contain, eradicate, recover under CISO direction. |
| Customer Success (CSM) | Customer communications during incident. |
| Legal (external counsel as engaged) | Regulatory notification review, PR if material. |

## Related documents

- `governance/incident-response.html` — customer-facing summary
- `compliance/SOC2-controls-self-assessment.md` Section CC7
- `legal/DPA-template.md` Section 10
- `legal/BAA-template.md` Section 5
- `governance/incident-history.md` (private — audit only)
