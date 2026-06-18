---
title: "Secure fax failover explanation"
vertical: healthcare
tier: l2
intent_codes: [HIPAA.FAX, DOWNTIME.FAILOVER, SECURE.TRANSMISSION]
keywords: [hipaa, secure fax, failover, downtime, efax]
compliance: [HIPAA, HITECH]
created: 2026-06-18
escalation_default: human
---

## Symptom

Clinical or administrative users need to send urgent documents while the normal secure fax route is unavailable.

## What's happening (1-line cause)

HIPAA-safe fax failover requires an approved alternate path, recipient verification, and audit trail.

## Fix - try these in order

### 1. Confirm the approved failover path

Check the downtime binder or IT knowledge base for the approved alternate secure fax, eFax, or manual workflow.

**Escalation:** if no approved path is documented, go to step 3 before sending.

### 2. Verify recipient before sending

Confirm the destination number or secure endpoint from an approved source, not from a copied old email thread.

**Escalation:** if the destination cannot be verified, go to step 3.

### 3. Log the downtime send

Record sender role, destination organization, timestamp, transmission status, and ticket number, without pasting document content.

**Escalation:** open a HIPAA downtime workflow ticket with IT, privacy, and the fax service owner if failover is undocumented or transmission fails.

## Compliance reminder

HIPAA requires reasonable safeguards when transmitting ePHI. Do not use personal email or consumer file sharing as a fax workaround. Keep the minimum necessary metadata and preserve failed-send logs.

## Related entries

- [[l2-fax-002-rightfax-srfax-troubleshoot]]
- [[l2-hipaa-001-suspected-ePHI-email-leak]]
