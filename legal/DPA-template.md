# Data Processing Agreement (DPA) — Template

**Status:** TEMPLATE for customer counter-signature. Based on EU SCC (2021/914 Module 2: Controller-to-Processor). For execution, convert to PDF, fill bracketed fields, both parties sign.

**Effective for ARIA customers signing on or after:** Date of execution.

---

## Parties

**Data Controller** ("Customer"): [CUSTOMER LEGAL NAME], a [JURISDICTION] [ENTITY TYPE], located at [CUSTOMER ADDRESS].

**Data Processor** ("ARIA Provider"): Integrated IT Support Inc., a Canadian corporation located at 30 Fothergill Court, Whitby, Ontario L1P 1L4.

This DPA forms part of the Master Services Agreement ("MSA") between the parties dated [MSA DATE]. To the extent of any conflict between this DPA and the MSA, this DPA controls with respect to processing of Personal Data.

---

## 1. Definitions

Defined terms not herein follow GDPR (Regulation (EU) 2016/679), PIPEDA, and applicable Canadian privacy law.

- **"Personal Data"** means any information relating to an identified or identifiable natural person processed by ARIA Provider on behalf of Customer under the MSA.
- **"Processing"** has the meaning given in Article 4(2) GDPR.
- **"Sub-processor"** means any third party engaged by ARIA Provider to assist in processing Personal Data.
- **"Data Subject Request"** means a request from a data subject to exercise rights under applicable law (access, rectification, erasure, restriction, portability, objection).

---

## 2. Subject matter & duration

ARIA Provider processes Personal Data on behalf of Customer solely to provide the ARIA SaaS service per the MSA. Processing lasts for the term of the MSA plus retention periods specified in Section 7.

---

## 3. Nature & purpose of processing

ARIA Provider processes:
- Customer end-user queries submitted to the ARIA AI assistant
- Customer end-user identifiers (anonymised session tokens, license-bound IDs)
- Customer administrator account credentials (managed via Customer's identity provider where SSO is configured)
- Customer-specific knowledge base content uploaded by Customer admins
- Operational metrics (query counts, response latency, deflection events)

ARIA Provider does NOT process:
- Customer end-user credit card numbers (handled directly by Stripe)
- Customer end-user health records unless a BAA is in effect
- Customer end-user biometric data
- Customer financial account numbers

---

## 4. Categories of data subjects

- Customer's employees, contractors, and authorised end-users who interact with ARIA.
- Customer's IT administrators who manage the ARIA tenant.

---

## 5. ARIA Provider's obligations

ARIA Provider shall:

5.1 Process Personal Data only on Customer's documented instructions, including with regard to transfers to a third country, unless required by applicable law to act without such instructions.

5.2 Ensure that persons authorised to process Personal Data have committed to confidentiality or are under appropriate statutory obligation of confidentiality.

5.3 Implement appropriate technical and organisational measures (Annex II — Security Measures) to ensure a level of security appropriate to the risk.

5.4 Engage Sub-processors only with Customer's prior specific or general written authorisation. Current Sub-processors are listed at iisupp.net/trust. ARIA Provider will notify Customer of intended changes to Sub-processors at least 30 days in advance, giving Customer the opportunity to object.

5.5 Taking into account the nature of the processing, assist Customer by appropriate technical and organisational measures, insofar as possible, in fulfilling Customer's obligations to respond to requests from data subjects.

5.6 Assist Customer in ensuring compliance with obligations regarding security of processing, notification of personal data breaches, data protection impact assessments, and prior consultation with supervisory authorities.

5.7 At Customer's choice, delete or return all Personal Data to Customer after the end of the provision of services, and delete existing copies unless applicable law requires storage of the Personal Data.

5.8 Make available to Customer all information necessary to demonstrate compliance with the obligations laid down in this DPA and allow for and contribute to audits, including inspections, conducted by Customer or another auditor mandated by Customer.

---

## 6. Sub-processor list (current)

| Sub-processor | Purpose | Location | Safeguard |
|---|---|---|---|
| Netlify Inc. | Hosting, CDN, edge functions | United States | Standard Contractual Clauses (SCCs) |
| DigitalOcean LLC | Compute (ARIA droplet) | Canada (Toronto data centre) | Direct contract; Canadian processing |
| Stripe Inc. | Payment processing | United States | SCCs + PCI-DSS Level 1 |
| OpenAI LLC | Embeddings (text-embedding-3-small) | United States | OpenAI DPA + SCCs |
| Anthropic PBC | Optional LLM calls (Claude) under governor | United States | Anthropic DPA + SCCs |
| Resend, Inc. | Transactional email | United States | SCCs |
| Google LLC (Workspace) | Internal communications only | United States / Canada | Google Workspace DPA |

Updates to this list published at iisupp.net/trust.

---

## 7. Retention

- **Conversation records:** 30 days from creation, then automatic purge, unless Customer has explicitly enabled extended retention.
- **Operational logs (Aperture):** 90 days from creation.
- **Account / billing data:** for the term of the MSA + 7 years thereafter for tax / accounting requirements (Canadian tax law).
- **Backups:** 90-day rolling window.
- **Upon termination:** Customer Personal Data returned (export) within 30 days; hard delete within 60 days from termination, except where law requires retention.

---

## 8. Data subject rights

ARIA Provider will assist Customer (controller) in responding to Data Subject Requests within 30 days of Customer's relayed request. Mechanisms:
- Access: ARIA Provider supplies a JSON + Markdown export of all Personal Data associated with a named data subject.
- Rectification: Customer corrects via admin console; ARIA Provider updates downstream caches.
- Erasure: Customer initiates via admin console or email request. ARIA Provider purges within 30 days.
- Restriction: Customer flags data subject in admin console; ARIA Provider freezes processing.
- Portability: Same as access export, in machine-readable JSON.
- Objection: Customer flags data subject; ARIA Provider ceases new processing.

---

## 9. International transfers

Customer Personal Data is primarily processed in Canada (DigitalOcean Toronto). Sub-processors in the United States rely on:
- Standard Contractual Clauses (SCCs) 2021/914 — Module 2 for controller-to-processor and Module 3 for processor-to-processor.
- Data Privacy Framework (DPF) certification where the Sub-processor is certified.
- Supplementary measures: encryption in transit (TLS 1.2+), encryption at rest (AES-256), strict access controls, no advertising-platform sharing.

EU data residency option available at Mid-Size+ tier upon Customer's written request.

---

## 10. Personal data breach notification

ARIA Provider shall notify Customer without undue delay (within 72 hours of becoming aware) of any Personal Data breach affecting Customer's data. Notification includes:
- Nature of the breach
- Categories and approximate number of data subjects affected
- Categories and approximate number of records concerned
- Likely consequences
- Measures taken to mitigate

Contact for breach notifications:
- Customer: [CUSTOMER DPO EMAIL]
- ARIA Provider: integrateditsupp@iisupp.net (subject: "SECURITY — Breach Notification") + WhatsApp (647) 581-3182 for urgent escalation.

---

## 11. Audit rights

Customer may, upon 30 days' written notice, conduct an audit of ARIA Provider's compliance with this DPA, limited to once per 12-month period (more frequently if a breach has occurred). ARIA Provider will provide reasonable assistance and access during business hours. Audit costs borne by Customer unless audit reveals material non-compliance.

In lieu of a Customer-led audit, ARIA Provider may provide a current SOC 2 Type II report (once issued — target 2027) as evidence of compliance.

---

## 12. Liability & indemnity

Liability arising under this DPA is governed by the MSA Section [LIABILITY SECTION]. To the extent any Personal Data breach is caused by ARIA Provider's gross negligence or wilful misconduct, ARIA Provider indemnifies Customer for direct damages up to the limits set forth in the MSA.

---

## 13. Term & termination

This DPA continues for the term of the MSA. Sections 7 (Retention), 11 (Audit rights), and 12 (Liability) survive termination.

---

## 14. Governing law

This DPA is governed by the laws of the Province of Ontario and the federal laws of Canada applicable therein, unless the MSA specifies otherwise. For EU customers, GDPR provisions apply additionally where mandatory.

---

## 15. Annex I — Description of processing

**Categories of data subjects:** Customer's employees, contractors, authorised end-users.

**Categories of Personal Data:**
- Identifiers: anonymised session tokens, license-bound user IDs
- Free-text query content (may incidentally contain Personal Data depending on what end-user types)
- Account metadata (admin email, role)

**Sensitive data:** None expected. If Customer enables a Healthcare context, PHI may be processed under a separate BAA.

**Frequency:** Continuous during service operation.

**Nature:** Storage, retrieval, embedding, retrieval-augmented generation, logging.

**Purpose:** AI-powered IT support assistance and operational analytics.

**Duration:** As specified in Section 7.

---

## 16. Annex II — Technical & organisational measures

ARIA Provider implements:

**Security controls:**
- TLS 1.2+ for data in transit; AES-256 for data at rest.
- Per-tenant data isolation (planned by 2026-Q3; today's customers receive single-tenant deployments with hard data segmentation in code).
- Role-based access control (RBAC) for ARIA Provider internal personnel.
- Multi-factor authentication for all ARIA Provider admin access.
- Continuous vulnerability scanning (GitHub Dependabot, npm audit, OWASP ZAP annual).

**Operational controls:**
- Logging and monitoring (Aperture observability dashboard).
- Incident response runbook with tabletop drills.
- Quarterly access reviews for ARIA Provider personnel.
- Pre-employment background checks where permitted by law.

**Resilience:**
- Atomic deploys with instant rollback (Netlify).
- Daily snapshots of droplet.
- Git history as code rollback baseline.
- Tier 2 local KB fallback bundle for service continuity if Tier 1 RAG unavailable.

**Audit & assurance:**
- Annual self-conducted penetration test (Year 1) escalating to external pentest firm (Year 2+).
- SOC 2 Type I self-assessment available on request under NDA.
- SOC 2 Type II audit planned upon first $625K+ enterprise contract execution.

---

## Signatures

**Customer:**
- Signature: ______________________
- Name: [PRINT NAME]
- Title: [PRINT TITLE]
- Date: [DATE]

**ARIA Provider — Integrated IT Support Inc.:**
- Signature: ______________________
- Name: Ahmad Wasee
- Title: Chief Executive Officer
- Date: [DATE]
