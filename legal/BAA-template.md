# Business Associate Agreement (BAA) — Template

**Status:** TEMPLATE for healthcare customers. Adapted from US Department of Health & Human Services Office for Civil Rights (OCR) free sample BAA. For execution, convert to PDF, fill bracketed fields, both parties sign.

**Effective for healthcare customers signing on or after:** Date of execution.

**Note:** This BAA supplements the MSA and DPA. To the extent of any conflict regarding PHI, this BAA controls.

---

## Parties

**Covered Entity** ("Customer"): [CUSTOMER LEGAL NAME], a [JURISDICTION] [ENTITY TYPE], located at [CUSTOMER ADDRESS].

**Business Associate** ("ARIA Provider"): Integrated IT Support Inc., a Canadian corporation located at 30 Fothergill Court, Whitby, Ontario L1P 1L4.

---

## 1. Definitions

Defined terms not herein follow the Health Insurance Portability and Accountability Act of 1996 (HIPAA), the Health Information Technology for Economic and Clinical Health Act (HITECH), and implementing regulations at 45 CFR Parts 160 and 164.

- **"PHI"** means Protected Health Information as defined at 45 CFR 160.103, limited to PHI received from, or created or received on behalf of, Customer.
- **"Breach"** has the meaning given at 45 CFR 164.402.
- **"Security Incident"** has the meaning given at 45 CFR 164.304.
- **"Unsecured PHI"** means PHI that is not rendered unusable, unreadable, or indecipherable to unauthorised persons.

---

## 2. Permitted uses and disclosures

ARIA Provider may use or disclose PHI only:

2.1 To perform the functions, activities, or services for, or on behalf of, Customer as specified in the MSA, provided that such use or disclosure would not violate HIPAA if done by Customer.

2.2 For the proper management and administration of ARIA Provider or to carry out the legal responsibilities of ARIA Provider, provided that disclosures are required by law OR ARIA Provider obtains reasonable assurances from the recipient that the information will remain confidential and used or further disclosed only as required by law or for the purpose for which it was disclosed.

2.3 To provide data aggregation services relating to the health care operations of Customer, but only as permitted by 45 CFR 164.504(e)(2)(i)(B).

---

## 3. Obligations of ARIA Provider

ARIA Provider shall:

3.1 Not use or further disclose PHI other than as permitted or required by this BAA or as required by law.

3.2 Implement appropriate administrative, physical, and technical safeguards that reasonably and appropriately protect the confidentiality, integrity, and availability of electronic PHI it creates, receives, maintains, or transmits on behalf of Customer per Section 6.

3.3 Report to Customer:
- Any use or disclosure of PHI not provided for by this BAA of which ARIA Provider becomes aware, including breaches of unsecured PHI as required by 45 CFR 164.410, without unreasonable delay and in any event within 60 calendar days of discovery.
- Any Security Incident of which ARIA Provider becomes aware.

3.4 Ensure that any Subcontractor that creates, receives, maintains, or transmits PHI on behalf of ARIA Provider agrees in writing to the same restrictions and conditions that apply to ARIA Provider with respect to such information, in compliance with 45 CFR 164.314(a)(2).

3.5 Make PHI available to Customer (or the individual) as necessary to meet Customer's obligations under 45 CFR 164.524 within 15 business days of Customer's request.

3.6 Make any amendment(s) to PHI in a designated record set as directed by Customer or to permit Customer to do so per 45 CFR 164.526, within 30 calendar days of Customer's request.

3.7 Maintain and make available the information required to provide an accounting of disclosures to Customer as necessary to meet Customer's obligations under 45 CFR 164.528.

3.8 Make ARIA Provider's internal practices, books, and records relating to the use and disclosure of PHI received from Customer available to the Secretary of the U.S. Department of Health and Human Services for purposes of determining Customer's compliance with the HIPAA Rules.

3.9 At termination of this BAA, return to Customer or destroy all PHI received from, or created or received on behalf of, Customer that ARIA Provider still maintains. If such return or destruction is not feasible, ARIA Provider shall extend the protections of this BAA to such information and limit further uses and disclosures to those purposes that make the return or destruction infeasible.

---

## 4. Obligations of Customer

Customer shall:

4.1 Notify ARIA Provider of any limitations in Customer's Notice of Privacy Practices that may affect ARIA Provider's use or disclosure of PHI.

4.2 Notify ARIA Provider of any changes in, or revocation of, the permission by an individual to use or disclose PHI, to the extent that such changes may affect ARIA Provider's use or disclosure of PHI.

4.3 Not request ARIA Provider to use or disclose PHI in any manner that would not be permissible under HIPAA if done by Customer, except where ARIA Provider would use or disclose such PHI for data aggregation or management and administrative activities as permitted by Section 2.

4.4 Not provide ARIA Provider with PHI other than what is necessary for ARIA Provider to perform the Services.

---

## 5. Breach notification

In the event of a Breach of Unsecured PHI:

5.1 ARIA Provider will notify Customer within 60 calendar days of discovery.

5.2 Notification will include, to the extent known: identification of each individual whose Unsecured PHI has been or is reasonably believed to have been accessed, acquired, used, or disclosed; a brief description of what happened; types of Unsecured PHI involved; steps individuals should take to protect themselves; what ARIA Provider is doing to investigate and mitigate; and contact information.

5.3 ARIA Provider will cooperate with Customer in any investigation, notification to individuals, notification to the Secretary, and notification to media as required.

5.4 ARIA Provider bears reasonable costs of breach notification proportional to its responsibility for the breach.

---

## 6. Safeguards (Security Rule compliance)

ARIA Provider implements administrative, physical, and technical safeguards in compliance with 45 CFR 164.308, 164.310, and 164.312:

**Administrative safeguards:**
- Security management process (risk analysis, risk management, sanction policy, information system activity review).
- Workforce security (authorisation, supervision, clearance, termination procedures).
- Security awareness and training.
- Security incident procedures.
- Contingency plan (data backup, disaster recovery, emergency mode operation, testing).
- Periodic evaluation.

**Physical safeguards:**
- Facility access controls (cloud provider — DigitalOcean Toronto with SOC 2 + ISO 27001 facility).
- Workstation use restrictions for ARIA Provider personnel.
- Workstation security.
- Device and media controls (encryption, disposal, re-use).

**Technical safeguards:**
- Access control (unique user identification, emergency access procedure, automatic logoff, encryption/decryption).
- Audit controls (Aperture audit dashboard).
- Integrity (mechanism to authenticate ePHI).
- Person or entity authentication (MFA for ARIA Provider admin access; SSO for customer access).
- Transmission security (TLS 1.2+ in transit; AES-256 at rest).

---

## 7. Term and termination

7.1 **Term.** This BAA becomes effective on the date of execution and continues until the date Customer terminates the MSA, unless terminated for cause earlier.

7.2 **Termination for cause.** Upon Customer's knowledge of a material breach by ARIA Provider, Customer shall provide an opportunity for ARIA Provider to cure the breach within 30 days. If ARIA Provider does not cure within 30 days, Customer may terminate this BAA. If neither cure nor termination is feasible, Customer shall report the violation to the Secretary.

7.3 **Effects of termination.** Sections 3.9, 4, 5, and 8 survive termination.

---

## 8. Permitted disclosures by Customer

Customer represents that any disclosure of PHI to ARIA Provider is permitted under HIPAA and that Customer has obtained all necessary authorisations.

---

## 9. Subcontractors

ARIA Provider's Subcontractors with PHI access (current):

| Subcontractor | Function | Location | BAA on file |
|---|---|---|---|
| DigitalOcean LLC | Compute (encrypted PHI storage) | Canada (Toronto) | Yes |
| Netlify Inc. | Hosting (PHI may transit) | US | Yes |

ARIA Provider does NOT send PHI to OpenAI, Anthropic, or other LLM providers. Healthcare-tier ARIA operates in Tier-2 local-only mode (no third-party LLM calls) unless Customer explicitly opts in.

---

## 10. Miscellaneous

10.1 **Amendment.** The parties agree to take such action as is necessary to amend this BAA from time to time as is necessary for Customer to comply with the requirements of HIPAA.

10.2 **Survival.** Sections 3.9, 4, 5, 6, and 8 survive termination of this BAA.

10.3 **Interpretation.** Any ambiguity in this BAA shall be resolved in favour of a meaning that permits Customer to comply with HIPAA.

10.4 **Governing law.** This BAA is governed by HIPAA, HITECH, and implementing regulations. To the extent not covered by US federal law, the laws of the Province of Ontario apply.

---

## Signatures

**Customer (Covered Entity):**
- Signature: ______________________
- Name: [PRINT NAME]
- Title: [PRINT TITLE]
- Date: [DATE]

**ARIA Provider (Business Associate) — Integrated IT Support Inc.:**
- Signature: ______________________
- Name: Ahmad Wasee
- Title: Chief Executive Officer
- Date: [DATE]
