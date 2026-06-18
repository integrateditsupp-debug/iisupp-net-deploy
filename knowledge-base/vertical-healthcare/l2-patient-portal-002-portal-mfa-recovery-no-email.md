---
title: "Patient portal MFA recovery when email is unavailable"
vertical: healthcare
tier: l2
intent_codes: [HIPAA.PORTAL, LOGIN.MFA, EMAIL.RECOVERY]
keywords: [hipaa, patient portal, mfa, recovery, email]
compliance: [HIPAA, HITECH]
created: 2026-06-18
escalation_default: human
---

## Symptom

A portal user cannot receive MFA or recovery email because the mailbox is inaccessible or outdated.

## What's happening (1-line cause)

The portal must re-establish identity and contact method control before restoring access to ePHI.

## Fix - try these in order

### 1. Try alternate registered methods

Use the portal's approved SMS, authenticator, phone, or backup recovery option if it is already registered.

**Escalation:** if no registered method works, go to step 2.

### 2. Use official identity verification

Route the user through clinic-approved identity verification before changing recovery email or MFA method.

**Escalation:** if identity cannot be verified remotely, go to step 3.

### 3. Update recovery details through authorized staff

Have authorized portal support update recovery contact details only after verification and document the change.

**Escalation:** open a HIPAA portal access ticket with clinic IT, portal support, and privacy owner if recovery is disputed.

## Compliance reminder

HIPAA requires reasonable identity verification before portal access changes. Do not accept email-only proof for sensitive recovery. Log who approved the change, what changed, and when.

## Related entries

- [[l2-patient-portal-001-mychart-account-locked]]
- [[l2-hipaa-003-mfa-recovery-for-clinical-staff]]
