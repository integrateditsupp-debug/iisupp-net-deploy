---
title: "MyChart account locked"
vertical: healthcare
tier: l2
intent_codes: [HIPAA.PORTAL, ACCOUNT.LOCKED, IDENTITY.RECOVERY]
keywords: [hipaa, mychart, locked, account, portal]
compliance: [HIPAA, HITECH]
created: 2026-06-18
escalation_default: human
---

## Symptom

A MyChart or patient portal account is locked after repeated sign-in attempts or failed recovery.

## What's happening (1-line cause)

The portal is protecting access to ePHI until identity recovery is completed through an approved workflow.

## Fix - try these in order

### 1. Confirm approved support route

Direct the user to the provider's official portal support number, portal link, or in-clinic identity verification process.

**Escalation:** if the user cannot verify identity through the standard route, go to step 3.

### 2. Reset using portal tools

Have authorized portal support unlock or reset the account only after approved identity verification.

**Escalation:** if unlock fails or identity data appears mismatched, go to step 3.

### 3. Check duplicate or merged records

Ask authorized portal support to verify whether duplicate records, merged accounts, or outdated contact details are blocking recovery.

**Escalation:** open a HIPAA-aware portal support ticket with clinic IT and the portal vendor if identity mapping needs correction.

## Compliance reminder

HIPAA access safeguards apply to patient portal recovery. Do not disclose account status to unverified callers. Record the recovery action and keep patient details out of general IT notes.

## Related entries

- [[l1-emr-001-epic-mychart-login-issues]]
- [[l2-patient-portal-002-portal-mfa-recovery-no-email]]
