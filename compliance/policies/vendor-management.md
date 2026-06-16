# Vendor / Sub-processor Management Policy

**Owner:** Ahmad Wasee, CISO  |  **Version:** 1.0  |  **Effective:** 2026-06-15  |  **Review:** Annual

## Purpose

Govern selection, onboarding, ongoing assessment, and offboarding of vendors and sub-processors that handle ARIA Provider or customer data. Aligned with SOC 2 CC9.2.

## Scope

All third-party vendors handling Integrated IT Support Inc. data or customer data, including but not limited to: Netlify, DigitalOcean, Stripe, OpenAI, Anthropic, Resend, Google Workspace.

## Vendor selection

### Pre-onboarding due diligence
- Security certifications review: SOC 2 Type II, ISO 27001, or equivalent.
- Data Processing Agreement available.
- Sub-processor list reviewed (transitive risk).
- Incident response history.
- Financial viability check.
- Regulatory compliance (GDPR, PIPEDA, HIPAA, applicable).

### Approval
- CISO approves all vendor onboarding.
- Documented business justification.
- Risk classification: Critical (production data path), High (operational data path), Medium (support tooling), Low (no data access).

## Contractual requirements

Every vendor handling Critical or High data path must have:
- **DPA** signed (or equivalent).
- **Confidentiality clauses** in MSA.
- **Right-to-audit** clause (or SOC 2 report acceptance).
- **Sub-processor change notification** ≥ 30 days advance notice.
- **Breach notification** ≤ 72 hours of awareness.
- **Termination + data return / deletion** clause.

## Current sub-processor inventory

| Vendor | Tier | Data | Certification | DPA |
|---|---|---|---|---|
| Netlify Inc. | Critical | Hosting + functions | SOC 2 Type II + ISO 27001 | Yes |
| DigitalOcean | Critical | Compute + Postgres | SOC 2 Type II + ISO 27001 | Yes |
| Stripe | Critical | Payments | SOC 2 Type II + PCI-DSS L1 | Yes |
| OpenAI | High | Embeddings | SOC 2 Type II | Yes |
| Anthropic | High | LLM (governor-gated) | SOC 2 Type II | Yes |
| Resend | Medium | Transactional email | SOC 2 Type II | Yes |
| Google Workspace | Medium | Internal email | SOC 2 Type II + ISO 27001 | Yes |
| GitHub | Medium | Source code | SOC 2 Type II + ISO 27001 | Yes |

Public sub-processor list maintained at `/trust` (iisupp.net) once Trust Center page ships.

## Ongoing assessment

### Annual review
- Re-verify certifications.
- Review incident reports.
- Re-assess sub-processor risk classification.
- Update DPA if vendor's terms changed.

### Continuous monitoring
- Subscribe to vendor security bulletins.
- Monitor vendor status pages.
- React to publicly disclosed vendor breaches within 48 hours.

## Sub-processor change notification

Per DPA Section 5.4: notify customers ≥ 30 days before adding or replacing a sub-processor. Notification methods:
- Email to designated security contact.
- Update at `/trust` page.
- Allow customer to object (escalate to MSA termination clause if objection unresolvable).

## Offboarding

When terminating a vendor:
1. Data returned or deleted per contract.
2. Verification of deletion within 90 days.
3. Credentials / API keys revoked.
4. Update sub-processor inventory.
5. Notify customers of removal.

## Exceptions

Critical / High vendors without full DPA: documented exception with risk mitigation plan; CISO approval; 90-day review.

## Related

- `legal/DPA-template.md` Sections 4, 5.4, 9
- `compliance/SOC2-controls-self-assessment.md` CC9.2
