---
title: "Suspected ePHI email leak"
vertical: healthcare
tier: l2
intent_codes: [HIPAA.EPHI, EMAIL.LEAK, SECURITY.INCIDENT]
keywords: [hipaa, ephi, email, leak, breach]
compliance: [HIPAA, HITECH]
created: 2026-06-18
escalation_default: human
---

## Symptom

A user may have emailed ePHI to the wrong recipient, external address, or unapproved mailbox.

## What's happening (1-line cause)

Potential HIPAA exposure exists until privacy, security, and mail administrators confirm scope and containment.

## Fix - try these in order

### 1. Preserve the evidence without forwarding it

Record sender, recipient, subject, timestamp, and message ID if available, but do not forward the message or copy ePHI into a new ticket.

**Escalation:** if any external recipient is involved, go to step 2 immediately.

### 2. Start containment

Ask the mail administrator to attempt message recall or purge where supported, block auto-forwarding if relevant, and preserve mailbox audit logs.

**Escalation:** if the message left the organization or cannot be recalled, go to step 3.

### 3. Notify the privacy officer workflow

Route the incident to the HIPAA privacy or compliance owner with the minimum metadata needed for breach assessment.

**Escalation:** open a formal security incident with privacy officer, legal/compliance, and email administrator ownership.

## Compliance reminder

HIPAA breach analysis must follow the organization's privacy process. Do not promise breach status, notification timing, or legal conclusions in the IT ticket. Keep ePHI out of screenshots, comments, and unencrypted attachments.

## Related entries

- [[l2-hipaa-004-business-associate-agreement-checklist]]
- [[l2-hipaa-005-encryption-at-rest-audit]]
