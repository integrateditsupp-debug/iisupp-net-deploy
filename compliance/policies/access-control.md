# Access Control Policy

**Owner:** Ahmad Wasee, CISO  |  **Version:** 1.0  |  **Effective:** 2026-06-15  |  **Review cycle:** Annual + on material change

## Purpose

Ensure that access to Integrated IT Support Inc. systems, applications, and data is authorized, monitored, and revoked promptly. Aligned with SOC 2 CC6, NIST SP 800-53 AC family, ISO 27001 A.9.

## Scope

All Integrated IT Support personnel (employees, contractors, agents), sub-processors with access to customer data, and automated systems (build agents, operations agents, ARIA).

## Policy

### 1. Authorization
- Access requests require documented business justification.
- Approved by CISO (Ahmad Wasee) for production systems.
- Principle of least privilege enforced — only the minimum access needed for the role.

### 2. Identification & authentication
- Unique user IDs for every human and service account.
- Strong passwords required: minimum 12 characters per NIST SP 800-63B; no forced periodic expiration; required after breach indicator.
- MFA required for all administrative access (GitHub, Netlify, DigitalOcean, Stripe, Resend).
- SSH keys for droplet access (no password auth).
- Personal access tokens (PATs) scoped to least privilege; documented at issuance.

### 3. Authorization & RBAC
- Roles defined: Founder (full), knowledge-base agent (KB-owned files + push), operations agent (OPS-owned files + push), build agents (per-packet branch only).
- Customer-side RBAC matrix per `aria-architecture/2M-ASSET-REQUIREMENTS.md` Section 5.2.
- Service accounts use minimum scoping.

### 4. Access reviews
- Quarterly review of all active access credentials.
- Stale credentials revoked within 1 business day.
- Sub-processor access audited annually.

### 5. Termination
- Upon personnel termination (or sub-processor offboarding), all access revoked within 1 business day.
- Credentials rotated where shared (rare).
- Asset return verified.

### 6. Session management
- 30-minute idle timeout on administrative consoles.
- Reauth required on permission elevation.
- Suspicious session terminated and investigated.

### 7. Privileged access
- Production write access limited to Founder + automation (PAT scoped to one repo).
- All privileged actions logged to Aperture or git audit log.
- Privileged session recordings retained 90 days (where supported by provider).

### 8. Customer data access
- Customer data accessed only when necessary for support, debugging, or compliance.
- Access logged with reason.
- Customer notified of any direct access to their data outside automated processing.

### 9. Emergency access
- Break-glass procedure documented in `governance/incident-response.html`.
- Emergency access logged + reviewed within 24 hours.

### 10. Monitoring & enforcement
- Aperture audit dashboard reviews all administrative actions.
- Anomalous patterns trigger alerts.
- Violations result in immediate access suspension pending investigation.

## Roles & responsibilities

- **CISO (Ahmad Wasee):** approves access; conducts quarterly reviews; investigates violations.
- **Personnel:** comply with policy; report suspected violations; protect credentials.
- **Customers:** manage their own admin console RBAC per provided tools.

## Exceptions

Exceptions require documented written justification and CISO approval. Reviewed every 90 days.

## Enforcement

Violations may result in access revocation, contract termination, or legal action.

## Related documents

- `compliance/policies/password.md`
- `compliance/policies/incident-response.md`
- `compliance/SOC2-controls-self-assessment.md` Section CC6
- `aria-architecture/2M-ASSET-REQUIREMENTS.md` Section 5.2
