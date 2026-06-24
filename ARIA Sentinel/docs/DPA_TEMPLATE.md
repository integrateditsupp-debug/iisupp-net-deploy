# ARIA Sentinel — Data Processing Agreement (DPA) Template

> **TEMPLATE — NOT LEGAL ADVICE.** This Data Processing Agreement is a drafting
> template prepared for Integrated IT Support Inc. It has **not** been reviewed by
> licensed counsel. It must be reviewed, adapted to the applicable laws and to the
> specific processing actually performed, and approved by qualified legal
> professionals **before** it is offered to or executed with any customer.
> Bracketed items marked `[ ]` require completion. This template is aligned to
> **GDPR Article 28** and **PIPEDA** principles but is **not** a representation of
> compliance.

This Data Processing Agreement ("DPA") forms part of the agreement between:

- **Customer** — `[ Customer legal name and address ]` (the **"Controller"**); and
- **Integrated IT Support Inc.** ("IIS"), an Ontario, Canada corporation,
  ahmad.wasee@iisupp.net, 647-581-3182 (the **"Processor"**),

(each a "party" and together the "parties"), and governs IIS's processing of
Personal Data on the Customer's behalf in connection with the ARIA Sentinel
software and related services (the "Services").

In the event of conflict between this DPA and the underlying agreement or EULA,
this DPA controls with respect to the processing of Personal Data.

---

## 1. Definitions

Terms such as "Personal Data", "processing", "data subject", "controller",
"processor", "sub-processor", and "personal data breach" have the meanings given
in the **EU General Data Protection Regulation (GDPR)** and, where applicable, in
**Canada's Personal Information Protection and Electronic Documents Act
(PIPEDA)**. "Applicable Data Protection Law" means GDPR, PIPEDA, and any other
data-protection or privacy law applicable to the processing.

## 2. Roles of the Parties

- The **Customer is the Controller** (or processor acting on behalf of a
  third-party controller) and determines the purposes and means of processing.
- **IIS is the Processor**, processing Personal Data **only on documented
  instructions** from the Customer, including as set out in this DPA, the EULA,
  and the Customer's configuration of the Services.
- IIS will inform the Customer if, in its opinion, an instruction infringes
  Applicable Data Protection Law.

## 3. Subject Matter, Duration, Nature and Purpose

- **Subject matter:** processing of Personal Data necessary to provide the ARIA
  Sentinel IT-support and device-maintenance Services.
- **Duration:** for the term of the underlying agreement and until deletion or
  return of Personal Data under Section 10.
- **Nature and purpose:** on-device diagnosis and remediation of IT issues;
  delivery of pull-only knowledge content; and optional, opt-in recipe-outcome
  telemetry, all in support of the Services.

## 4. Types of Personal Data and Categories of Data Subjects

> **Minimal by design.** ARIA Sentinel is **content-blind and local-first.** It
> is engineered so that IIS, as Processor, processes **opaque symbolic signatures
> and non-content metadata — not raw personal content.**

- **Categories of data subjects:** the Customer's authorized end users / employees
  whose devices run the Software.
- **Types of Personal Data processed by IIS (Processor):** minimal and limited to
  what the content-blind architecture exposes, for example:
  - **opaque symbolic signal identifiers** (e.g., `BROWSER.CACHE.STALE`);
  - non-identifying **origin categories** (e.g., `public`, `sso`, `saas`,
    `internal`, `localhost`);
  - **opt-in** recipe-outcome telemetry limited to non-content fields
    (e.g., `{ recipe_id, outcome, timestamp }`).
- **Data NOT transmitted to IIS by design:** page bodies, document/file contents,
  form fields, credentials, cookies, local-storage values, and screenshots.
  Such data, where present, is processed **locally on the device** and remains
  under the Customer's control.
- **Special categories** of Personal Data are **not** intended to be processed by
  IIS and must not be introduced into the symbolic-signal channel.

## 5. Obligations of IIS as Processor

IIS shall:

1. process Personal Data only on the Customer's documented instructions;
2. ensure persons authorized to process Personal Data are bound by **confidentiality**;
3. implement the **technical and organizational security measures** in Section 8;
4. respect the conditions in Section 6 for engaging sub-processors;
5. **assist the Customer** (taking into account the nature of processing) in
   responding to data-subject requests and in meeting obligations under Articles
   32–36 GDPR (security, breach notification, impact assessments, prior
   consultation), and the equivalent PIPEDA accountability/safeguard duties;
6. at the Customer's choice, **delete or return** Personal Data on termination
   (Section 10); and
7. make available information necessary to demonstrate compliance and allow for
   **audits** as set out in Section 9.

## 6. Sub-Processors

The Customer provides **general written authorization** for IIS to engage
sub-processors, subject to IIS imposing data-protection obligations on each
sub-processor substantially equivalent to those in this DPA, and remaining liable
for their performance.

**Current sub-processors:**

| Sub-processor | Role / Service | Processing location | Notes |
|---|---|---|---|
| **Netlify, Inc.** | Hosting of the pull-only `iisupp.net` knowledge endpoints and edge/serverless functions used by the Services | `[ region — confirm ]` | Serves knowledge content; receives only opt-in, non-content telemetry per the content-blind design. |

IIS will give the Customer **prior notice** of any intended addition or
replacement of a sub-processor (at least `[ 30 ]` days), giving the Customer the
opportunity to object on reasonable data-protection grounds.

## 7. International Transfers

Where processing involves a transfer of Personal Data across borders (including
to the United States), IIS will ensure an appropriate transfer mechanism is in
place (e.g., the EU Standard Contractual Clauses and any required supplementary
measures), and will comply with PIPEDA's accountability requirements for
transfers to third parties for processing.

## 8. Security Measures

Taking into account the state of the art, costs, and the nature/scope/context and
risk of processing, IIS implements appropriate technical and organizational
measures, including:

- **Content-blind data minimization / sanitization** — the architecture restricts
  IIS-side processing to opaque symbolic signatures and non-content metadata;
  raw content is not transmitted to IIS.
- **Encryption in transit** — Personal Data exchanged with IIS endpoints is
  protected using TLS/HTTPS.
- **Access controls** — least-privilege access to systems processing Personal
  Data, with authentication and logging.
- **Execution safety boundaries** — dry-run-by-default operation, allow-listed
  recipe actions, blocking of destructive command families, and local
  transparency logging on the device.
- **Operational controls** — change management, dependency/license review, and
  (planned) supply-chain attestation as described in `docs/PRIVACY_AND_SECURITY.md`.

> Some controls are **roadmap items** for production (e.g., code signing,
> encrypted local knowledge store, formal SBOM/supply-chain attestation, external
> security assessment). The parties acknowledge the current readiness state and
> `[ may agree on a remediation timeline ]`.

## 9. Audit Rights

IIS shall make available to the Customer information reasonably necessary to
demonstrate compliance with this DPA and shall allow for and contribute to
audits, including inspections, conducted by the Customer or an auditor mandated by
the Customer, no more than once per `[ 12 ]` months (unless required by a
supervisory authority or following a breach), on reasonable prior notice, during
business hours, subject to confidentiality, and without unreasonably disrupting
IIS's operations. IIS may satisfy audit requests by providing relevant
third-party reports or attestations where available.

## 10. Return and Deletion on Termination

Upon termination or expiry of the Services, IIS shall, at the Customer's choice,
**delete or return** all Personal Data processed on the Customer's behalf and
delete existing copies, unless retention is required by law. Given the local-first
design, much of the Customer's data remains on the Customer's own devices under
its control. IIS will confirm deletion in writing upon request.

## 11. Personal Data Breach Notification

IIS shall notify the Customer **without undue delay, and in any event within
seventy-two (72) hours**, after becoming aware of a personal data breach affecting
Personal Data processed under this DPA. The notice will describe, to the extent
known, the nature of the breach, the categories and approximate number of data
subjects and records affected, the likely consequences, and the measures taken or
proposed. IIS will reasonably assist the Customer in meeting its own notification
obligations to supervisory authorities, affected individuals, and (under PIPEDA)
the Office of the Privacy Commissioner of Canada where required.

## 12. Liability

Each party's liability under this DPA is subject to the limitations and exclusions
of liability set out in the underlying agreement / EULA, except to the extent
those limitations are not permitted by Applicable Data Protection Law.

## 13. Governing Law

This DPA is governed by the laws of the **Province of Ontario and the federal laws
of Canada** applicable therein, except where Applicable Data Protection Law
requires otherwise for the protection of data subjects.

## 14. Term

This DPA takes effect on the date of last signature below and remains in force for
as long as IIS processes Personal Data on the Customer's behalf.

---

## Signature Block

**Controller (Customer)**

- Legal entity: `[ Customer legal name ]`
- Signature: ______________________________
- Name: `[ name ]`
- Title: `[ title ]`
- Date: `[ date ]`

**Processor — Integrated IT Support Inc.**

- Signature: ______________________________
- Name: `[ name ]`
- Title: `[ title ]`
- Date: `[ date ]`
- Contact: ahmad.wasee@iisupp.net — 647-581-3182

---

### Annex A — Processing Details (summary)

| Item | Detail |
|---|---|
| Subject matter | Provision of ARIA Sentinel IT-support Services |
| Duration | Term of the agreement + deletion/return period |
| Nature & purpose | On-device diagnosis/remediation; pull-only knowledge delivery; opt-in outcome telemetry |
| Personal Data types | Opaque symbolic signal IDs; origin categories; opt-in `{ recipe_id, outcome, ts }` (content-blind — no raw content to IIS) |
| Data subjects | Customer's authorized end users / employees |
| Sub-processors | Netlify, Inc. (hosting) |

---

*Template pending counsel review. See `docs/LEGAL_INVENTORY.md` for the overall
legal-readiness inventory and `docs/EULA.md` for the end-user license terms.*
