---
title: "Lost laptop with possible ePHI"
vertical: healthcare
tier: l2
intent_codes: [HIPAA.EPHI, DEVICE.LOST, ENDPOINT.ENCRYPTION]
keywords: [hipaa, lost laptop, ephi, encryption, intune]
compliance: [HIPAA, HITECH]
created: 2026-06-18
escalation_default: human
---

## Symptom

A laptop used for clinical or administrative work is lost, stolen, or unaccounted for and may contain ePHI.

## What's happening (1-line cause)

HIPAA risk depends on encryption status, device management state, last check-in, and whether ePHI was stored locally.

## Fix - try these in order

### 1. Capture the minimum facts

Record asset tag, user, last known location, last seen time, and whether the device was powered on, without documenting patient details.

**Escalation:** if theft is possible or the device contains clinical data, go to step 2 immediately.

### 2. Check management and encryption state

Verify BitLocker or FileVault status, MDM enrollment, last check-in, remote lock or wipe availability, and sign-in audit events.

**Escalation:** if encryption cannot be proven, go to step 3.

### 3. Execute approved containment

Use the approved MDM process to lock, wipe, revoke sessions, rotate exposed credentials, and preserve audit evidence.

**Escalation:** open a formal HIPAA security incident with privacy/compliance, endpoint, and identity owners.

## Compliance reminder

Do not decide breach status inside the help desk ticket. HIPAA reporting decisions belong to the privacy process. Keep evidence in approved encrypted systems and log every remote action taken.

## Related entries

- [[l1-security-001-lost-stolen-device]]
- [[l2-hipaa-005-encryption-at-rest-audit]]
