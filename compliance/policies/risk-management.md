# Risk Management Policy

**Owner:** Ahmad Wasee, CISO  |  **Version:** 1.0  |  **Effective:** 2026-06-15  |  **Review:** Annual + after material change

## Purpose

Identify, assess, treat, and monitor risks affecting Integrated IT Support Inc. and ARIA service delivery. Aligned with SOC 2 CC3, NIST SP 800-30/37/53, ISO 31000.

## Risk categories

| Category | Examples |
|---|---|
| Strategic | Market positioning, competitive threats, product fit |
| Operational | Service availability, customer onboarding, sub-processor failures |
| Financial | Cash flow, billing failures, fraud, audit costs |
| Compliance | Regulatory change, certification gaps, contractual breaches |
| Reputational | Public security incident, customer dissatisfaction, social media incident |
| Cybersecurity | Data breach, ransomware, vulnerability, supply chain attack |
| Privacy | PIPEDA/GDPR/CCPA violation, data subject rights mishandling |
| Legal | IP infringement, contract dispute, regulatory action |

## Risk assessment

### Process
1. **Identify:** brainstorm, threat modeling, vulnerability assessments, audit findings, incident lessons.
2. **Analyze:** likelihood (1–5) × impact (1–5) = risk score (1–25).
3. **Evaluate:** compare against risk appetite; prioritize treatment.
4. **Treat:** mitigate / transfer / accept / avoid.
5. **Monitor:** review periodically; track risk indicator metrics.

### Risk register

Maintained at `governance/risk-register.md` (private — audit only). Reviewed annually.

### Current top risks (illustrative)

| # | Risk | Likelihood | Impact | Score | Treatment |
|---|---|---|---|---|---|
| 1 | Sub-processor breach affecting customer data | 2 | 5 | 10 | DPA + insurance + monitoring |
| 2 | Critical CVE in production dependency | 3 | 4 | 12 | Dependabot + 24h patch SLA |
| 3 | Founder unavailability (key person risk) | 2 | 5 | 10 | Runbooks + insurance + backup operator hire |
| 4 | Vendor lock-in (Netlify / DigitalOcean) | 3 | 3 | 9 | Multi-provider DR planning |
| 5 | Regulatory change (AI Act, EU AI rules) | 4 | 3 | 12 | Continuous monitoring + legal review |
| 6 | Public security incident | 1 | 5 | 5 | Strong IR + cyber insurance |
| 7 | Customer disputes over AI hallucination | 3 | 3 | 9 | Disclaimer + confidence tagging + human escalation |
| 8 | Cash flow constraint pre-revenue ramp | 3 | 4 | 12 | Founder runway + zero-cost build path |

## Risk appetite

| Score | Tolerance |
|---|---|
| 1–6 (Low) | Accept with monitoring |
| 7–12 (Medium) | Treat (mitigate or transfer) |
| 13–19 (High) | Treat aggressively or avoid |
| 20–25 (Critical) | Treat immediately or do not proceed |

## Risk treatment

- **Mitigate:** reduce likelihood or impact via controls.
- **Transfer:** insurance, customer indemnification, sub-processor contracts.
- **Accept:** documented business decision with CISO approval.
- **Avoid:** do not pursue activity creating the risk.

## Roles

- **CISO (Founder):** owns risk register; final approval on treatment plans.
- **Loop-engineer / qa-safety-loop:** identifies risks during change cycles.
- **All personnel:** report identified risks via integrateditsupp@iisupp.net or memory entry.

## Monitoring

- **Annual review:** full risk register reassessment.
- **Quarterly:** top-10 risk dashboard.
- **Event-driven:** incident, regulatory change, major customer escalation triggers re-assessment.

## Related

- `compliance/policies/incident-response.md`
- `compliance/policies/business-continuity.md`
- `compliance/SOC2-controls-self-assessment.md` CC3
