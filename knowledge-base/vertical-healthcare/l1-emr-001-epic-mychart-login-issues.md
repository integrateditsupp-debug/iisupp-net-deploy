---
title: "Epic MyChart login issues"
vertical: healthcare
tier: l1
intent_codes: [LOGIN.MFA, EMR.EPIC, PORTAL.MYCHART]
keywords: [epic, mychart, login, password, browser]
compliance: [HIPAA, HITECH]
created: 2026-06-18
escalation_default: human
---

## Symptom

User cannot sign in to Epic MyChart, sees a password loop, or the portal rejects the verification code.

## What's happening (1-line cause)

The account, browser session, or MFA method is out of sync with the portal identity record.

## Fix - try these in order

### 1. Confirm the right portal and reset path

Open the official MyChart portal link from the provider website, choose the password reset or username recovery link, and complete the visible prompts.

**Escalation:** if the reset email or code does not arrive within 10 minutes, go to step 2.

### 2. Clear the browser session

Open an incognito or private window, disable autofill for this login attempt, and sign in again using the recovered username.

**Escalation:** if the same loop appears in a private window, go to step 3.

### 3. Check account lock or identity mismatch

Ask the clinic portal support desk to confirm the account is active and that the recovery email or phone on file is correct.

**Escalation:** open a ticket with Epic portal support plus clinic IT if the account is locked, merged, or mapped to the wrong identity record.

## Compliance reminder

Do not paste screenshots showing appointment details, chart notes, medications, or messages into a general ticket. Keep the ticket to error text, timestamp, browser, and device. If portal access is changed, clinic IT should preserve an access-change audit trail.

## Related entries

- [[l2-hipaa-003-mfa-recovery-for-clinical-staff]]
- [[l2-patient-portal-001-mychart-account-locked]]
