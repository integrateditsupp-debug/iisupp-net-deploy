---
title: "Business Associate Agreement checklist"
vertical: healthcare
tier: l2
intent_codes: [HIPAA.BAA, VENDOR.RISK, COMPLIANCE.REVIEW]
keywords: [hipaa, baa, business associate, vendor, checklist]
compliance: [HIPAA, HITECH]
created: 2026-06-18
escalation_default: human
---

## Symptom

A team wants to use a vendor, app, consultant, or support provider that may access ePHI.

## What's happening (1-line cause)

HIPAA may require a Business Associate Agreement before the vendor can receive, process, store, or support ePHI.

## Fix - try these in order

### 1. Identify the ePHI touchpoint

Document what data the vendor can see, store, transmit, support, or administer, using data categories rather than real records.

**Escalation:** if the vendor touches ePHI in any way, go to step 2.

### 2. Confirm BAA and security review status

Check whether a signed BAA exists, who approved it, renewal date, security questionnaire status, and subcontractor language.

**Escalation:** if no signed BAA exists, go to step 3.

### 3. Block production ePHI until approved

Keep the vendor in demo or synthetic-data mode until legal/compliance approves the BAA and security controls.

**Escalation:** open a HIPAA vendor-risk ticket with procurement, compliance, legal, and system owner review.

## Compliance reminder

Do not send production ePHI to a vendor before the approved agreement and security review are in place. IT can document technical scope, but BAA approval belongs to compliance/legal.

## Related entries

- [[l2-hipaa-001-suspected-ePHI-email-leak]]
- [[l2-hipaa-005-encryption-at-rest-audit]]
