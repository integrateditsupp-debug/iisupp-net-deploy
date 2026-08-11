# CLAIM REGISTER — every factual assertion a client's reviewer can read, accounted for

> **What this file is for.** Twenty-seven documents leave this building: four contracts, twenty
> compliance documents, three sales sheets. They assert things — certifications, audits, insurance
> cover, retention periods, uptime, years of experience — to the one reader who checks them line by
> line: an enterprise buyer's security reviewer. `docs/QUOTED-FIGURES.md` did this for money.
> This file does it for facts.
>
> Every claim ends in exactly one of four states and there is no fifth:
>
> - **PUBLISHED** — the same assertion appears on a page this company publishes.
> - **DISCLAIMED** — the sentence explicitly denies the claim. A disclaimer is not an assertion.
> - **DECLARED** — listed below, with a reason a person wrote. A forward-looking claim must carry
>   **the condition** it is contingent on; a present-tense claim must point at **the evidence**.
> - **REFUSED** — asserted, unpublished, undeclared. Nothing evidences it.
>   `tests/claim-register.test.mjs` goes red on it.
>
> **This is a register, not a permission slip.** Listing a claim does not make it true. It makes it
> *deliberate*. Several entries below are open questions Ahmad still has to answer, and they say so
> in capital letters.
>
> **Nothing was deleted to build this list** (Rule 15). Reconciliation is additive: documents were
> read, and this file was written. The one edit made to a document was the correction of
> `Founder 21+ yrs IT` to `15+`, which is a Rule 14 fix, not a reconciliation.
>
> Format: `| claim | where | condition (forward-looking) or evidence (present-tense) | why it is stated this way |`

---

## Certification and audit status — all forward-looking, all conditioned

| claim | where | condition or evidence | why it is stated this way |
|---|---|---|---|
| `ISO 27001 certified` | compliance/SIG-Lite-prefilled.md:125 | by 2027, and only after an accredited certification body completes a formal audit | The answer in the questionnaire is the single word "Planned" plus a year. It is a target date, not a status. `compliance/ISO-27001-SoA.md` disclaims certification explicitly in its own opening paragraph and again in its closing line, so the two documents a reviewer reads together do not contradict each other. |
| `ISO/IEC 27001 certification` | compliance/ISO-27001-SoA.md:95 | by 2027, subject to an accredited certification-body audit | The closing line of the Statement of Applicability, which exists to say the document is NOT a certification. Registered here rather than left to the disclaimer detector alone, so the intent survives a rewrite of the sentence. |
| `SOC 2 Type I or Type II attestation` | compliance/SOC2-controls-self-assessment.md:8 | upon signature of the first $625K+ annual contract, when the audit fee is approved | The self-assessment's own framing line. The threshold is the same $625K used in ten other places (`docs/QUOTED-FIGURES.md`), so a reviewer comparing documents finds one number. |
| `SOC 2 Type II report` | legal/DPA-template.md:150 · compliance/SIG-Lite-prefilled.md:124 | once issued — target 2027; offered in lieu of a customer-led audit only after it exists | Contract language written in the conditional. The DPA does not promise the report; it promises that the report, once it exists, may be offered instead of an on-site audit. |
| `penetration test` | legal/DPA-template.md:217 · compliance/policies/vulnerability-management.md:19 · compliance/CAIQ-Lite-prefilled.md:153 · compliance/SIG-Lite-prefilled.md:70,148 | annual cadence: Year 1 self-conducted with OWASP ZAP, external firm from Year 2 after the first enterprise contract funds it | Stated identically in five documents on purpose. The Year-1 test is self-conducted and every document says so — an unqualified "annual penetration testing" would read to a reviewer as an external engagement. |
| `Pen test` | compliance/SOC2-controls-self-assessment.md:38,148,164 | first self-conducted report due 2026-Q3; external engagement after the first enterprise deal | Appears in a control row, a percent-complete table and a 30-day plan. All three are the same pending item, and all three are marked pending rather than done. **OPEN — the 2026-Q3 date has now passed; either the first self-report exists and should be cited, or the date needs correcting.** |
| `SOC 2 / PIPEDA / GDPR / CCPA **readiness self-assessment**` | ARIA Sentinel/sales/ARIA-Sentinel-Sales-One-Pager.md:38 | evidence: the readiness maps and self-assessments in `compliance/`, exported as an evidence pack; the same line says "evidence export, not a certification" | The sales sheet describes a DELIVERABLE, and the qualifier is inside the sentence. It is registered rather than left to the disclaimer detector because the negation here comes AFTER the claim, and a detector that accepted a trailing "not a certification" as a disclaimer would launder every assertion in the pack that ends with a hedge. |
| `SOC 2 + ISO 27001 certified` | compliance/policies/encryption.md:32 | evidence: the certifications are held by Netlify and DigitalOcean, published on those providers' own trust pages, not by Integrated IT Support | A claim about SUB-PROCESSORS, not about this company — the sentence names the providers. Declared here because a reviewer skimming for the string "ISO 27001 certified" must be able to see, in one place, that this occurrence is about somebody else's certificate. |

---

## Insurance — cover that is being procured, never cover that is in force

| claim | where | condition or evidence | why it is stated this way |
|---|---|---|---|
| `cyber liability, to be in place upon first $625K+ contract signing` | compliance/SIG-Lite-prefilled.md:20 | upon signature of the first $625K+ annual contract | The model answer. It states the target amount, the trigger, and that the cover is not yet bound. Every other insurance sentence in the pack is measured against this one. |
| `Cyber liability in procurement` | compliance/CAIQ-Lite-prefilled.md:83 | upon signature of the first enterprise contract; target $5M, consistent with the SIG-Lite answer | Terser than the SIG-Lite answer because the CAIQ cell is narrow. "In procurement" is accurate and is not a claim of cover. |
| `cyber liability $5M (target — to procure pre-first-enterprise-deal)` | compliance/SOC2-controls-self-assessment.md:103 | prior to the first enterprise deal closing | The word "target" and the parenthetical carry the condition inside the claim itself. |
| `Cyber liability insurance quote (procure on first enterprise deal)` | compliance/SOC2-controls-self-assessment.md:136 | upon the first enterprise deal closing | A line item in the remediation plan, priced and deferred. It is an action, not a status. |
| `Cyber liability event` | compliance/policies/business-continuity.md:21 | upon signature of the first enterprise contract the mitigation named in this row — insurance, target ≥ $5M — moves from procurement to bound | The row NAMES A RISK; the mitigation column is where the insurance appears ("Insurance (target ≥ $5M, in procurement)"). Registered under the risk name rather than the mitigation text because that is what a reader searching the pack for "cyber liability" actually lands on, and an entry that does not match what the document says is an entry that rots. |
| `cyber liability insurer notified per policy terms` | compliance/policies/incident-response.md:114 | **OPEN — NEEDS-AHMAD. This is the one insurance sentence in the pack that presumes a policy is already in force.** Every other document says the cover is in procurement. The step is correct once cover is bound and reads as a contradiction until then | Registered rather than quietly reworded, because the fix is a decision: either mark the step contingent ("once cover is bound"), or bind the cover. Software may not choose between those two, and deleting the step would leave an incident runbook with a missing obligation. |

---

## Compliance status — the four "Yes" answers

| claim | where | condition or evidence | why it is stated this way |
|---|---|---|---|
| `GDPR compliant` | compliance/SIG-Lite-prefilled.md:128 | evidence: `legal/DPA-template.md`, and Standard Contractual Clauses 2021/914 in force for US sub-processor transfers | GDPR has no certifying body, so "compliant" here means the controller-processor obligations are met by contract and the transfer mechanism exists. Both artefacts are named in the answer itself and both are in the shared line. **OPEN — NEEDS-AHMAD: the bare word "Yes" is doing more work than the evidence behind it. A reviewer reads "Yes" as "audited". Consider "Yes — by contract; no supervisory-authority audit has been performed."** |
| `PIPEDA compliant` | compliance/SIG-Lite-prefilled.md:130 | evidence: the published privacy policy, aligned to the ten PIPEDA fair information principles | Canadian federal privacy law, self-assessed, no certification exists. Same open question as GDPR: the word "Yes" carries an implication the evidence does not. |
| `CCPA / CPRA compliant` | compliance/SIG-Lite-prefilled.md:129 | once the CCPA-specific disclosures are published in the privacy policy — that expansion is the condition, and until it lands the answer is not yet a yes. **OPEN — NEEDS-AHMAD.** | **The answer contradicts itself in one line:** "Yes. Privacy policy expansion in progress for CCPA-specific disclosures." A reviewer who reads both halves sees a "Yes" whose own sentence says the disclosures are not written yet. This is the sharpest of the four and the cheapest to fix, and the fix is a decision about what to say, not a deletion. |
| `HIPAA compliant` | compliance/SIG-Lite-prefilled.md:127 | evidence: `legal/BAA-template.md`, technical safeguards documented in BAA Section 6 | The answer deliberately does NOT say yes. It names the BAA and the safeguards section, and `compliance/HIPAA-readiness-map.md` states in bold that HIPAA certification does not exist and that a BAA is required before any PHI is processed. This is the pattern the other three should follow. |

---

## Retention periods — present-tense operational facts

| claim | where | condition or evidence | why it is stated this way |
|---|---|---|---|
| `Retention:** 30 days` | compliance/policies/data-classification.md:29 | evidence: the data classification policy is the defining document for conversation-record retention; 90 days for logs is stated in the same clause | The number a customer's DPO copies into their own record of processing. It is defined here and referenced elsewhere, so this policy line is the source rather than a repetition. |
| `retention: 90 days` | compliance/policies/data-classification.md:87 | evidence: backup retention, 90 days rolling, defined in the same policy | Distinct from the 30-day conversation-record period on purpose; a reviewer who sees both must be able to tell which is which. |
| `retained 90 days` | compliance/policies/access-control.md:50 | evidence: privileged session recordings, where supported by the provider — the access control policy states the qualifier | The qualifier "where supported by provider" is part of the claim and is not dropped, because a blanket 90-day recording claim would be unevidenced for providers that do not record. |
| `retained for 90 days` | compliance/policies/change-management.md:76 | evidence: previous sub-processor configuration, per the change management policy rollback clause | Same period, different subject. Registered separately so that changing one does not silently appear to change the other. |

---

## Experience — the honest ceiling, stated identically

| claim | where | condition or evidence | why it is stated this way |
|---|---|---|---|
| `15+ yrs IT` | compliance/SOC2-controls-self-assessment.md:19 · compliance/HIPAA-readiness-map.md:29 | evidence: the ceiling published on `about.html` and enforced by the experience-claim check in `scripts/lib/client-facing-leak.mjs` | **Both of these read `21+ yrs` until RUN-AW.** They were written in an abbreviation the leak gate's pattern did not match, and sat above the honest ceiling in the first two documents an auditor opens. The claim is now stated identically in both, and the check was strengthened to catch the abbreviation rather than the number being quietly changed and the gap left open. |
