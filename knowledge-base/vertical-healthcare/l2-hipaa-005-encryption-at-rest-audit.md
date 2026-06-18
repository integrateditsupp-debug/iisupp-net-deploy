---
title: "Encryption at rest audit"
vertical: healthcare
tier: l2
intent_codes: [HIPAA.SECURITY, ENCRYPTION.AUDIT, DEVICE.COMPLIANCE]
keywords: [hipaa, encryption, bitlocker, filevault, audit]
compliance: [HIPAA, HITECH]
created: 2026-06-18
escalation_default: human
---

## Symptom

IT needs to prove whether devices or systems storing ePHI are encrypted at rest.

## What's happening (1-line cause)

HIPAA security evidence depends on verifiable encryption state, scope, exceptions, and remediation records.

## Fix - try these in order

### 1. Define the audit scope

List device groups, servers, databases, storage buckets, backup locations, and owners, without exporting actual ePHI.

**Escalation:** if the scope includes unmanaged assets, go to step 2.

### 2. Pull technical evidence

Export BitLocker, FileVault, MDM, cloud storage, database, and backup encryption status from approved admin consoles.

**Escalation:** if any asset lacks encryption proof, go to step 3.

### 3. Open remediation for gaps

Assign each gap an owner, due date, compensating control, and validation step.

**Escalation:** open a HIPAA risk register item if ePHI is stored on unencrypted or unmanaged systems.

## Compliance reminder

Do not export patient data for an encryption audit. Store audit evidence in an approved restricted folder. HIPAA documentation should show control state, remediation, approval, and review date.

## Related entries

- [[l2-hipaa-002-lost-laptop-with-ePHI]]
- [[l2-hipaa-004-business-associate-agreement-checklist]]
