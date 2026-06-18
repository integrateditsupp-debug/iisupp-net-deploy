---
title: "MFA recovery for clinical staff"
vertical: healthcare
tier: l2
intent_codes: [HIPAA.ACCESS, LOGIN.MFA, IDENTITY.RECOVERY]
keywords: [hipaa, mfa, authenticator, clinical staff, recovery]
compliance: [HIPAA, HITECH]
created: 2026-06-18
escalation_default: human
---

## Symptom

A clinician cannot complete MFA because the phone, authenticator app, or registered method is unavailable.

## What's happening (1-line cause)

Identity recovery must restore access quickly while preserving HIPAA access controls and auditability.

## Fix - try these in order

### 1. Verify identity through approved workflow

Use the organization's identity proofing process, such as manager verification, badge check, or approved service desk callback.

**Escalation:** if identity cannot be verified in the approved workflow, stop and go to step 3.

### 2. Re-register MFA safely

In the identity admin portal, require re-registration, remove stale methods, and guide the user through the approved authenticator setup link.

**Escalation:** if the account shows risky sign-in activity, go to step 3.

### 3. Check for account compromise indicators

Review recent sign-ins, impossible travel, unfamiliar devices, forwarding rules, and privileged group changes.

**Escalation:** open a HIPAA security review ticket with identity/security if recovery involves suspicious activity or emergency bypass.

## Compliance reminder

HIPAA access controls require unique user access and traceable authentication changes. Do not share temporary codes in group chat. Log the requester, approver, admin, and exact access change.

## Related entries

- [[l1-mfa-001-setup-recovery]]
- [[l2-hipaa-001-suspected-ePHI-email-leak]]
