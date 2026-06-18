---
title: "RightFax or SRFax troubleshooting"
vertical: healthcare
tier: l2
intent_codes: [HIPAA.FAX, RIGHTFAX.SRFAX, QUEUE.FAILURE]
keywords: [hipaa, rightfax, srfax, fax, queue]
compliance: [HIPAA, HITECH]
created: 2026-06-18
escalation_default: human
---

## Symptom

RightFax, SRFax, or another secure fax platform is failing, stuck in queue, or returning failed transmission notices.

## What's happening (1-line cause)

The failure may be a service outage, bad destination, authentication issue, connector issue, or fax line/provider problem.

## Fix - try these in order

### 1. Check service and queue status

Review the admin dashboard for outage banners, failed queues, connector health, and recent error codes.

**Escalation:** if platform-wide errors or connector failures appear, go to step 3.

### 2. Validate one safe test send

Send a non-ePHI test page to an approved internal test destination and confirm send and receive status.

**Escalation:** if the test fails, go to step 3.

### 3. Isolate destination versus platform

Compare failures by destination, sender, queue, connector, and time window using metadata only.

**Escalation:** open a HIPAA-aware vendor ticket with RightFax or SRFax plus IT messaging/network support.

## Compliance reminder

Do not attach faxed clinical documents to vendor tickets. Use job IDs, timestamps, destination organization, and redacted logs. HIPAA minimum necessary rules apply to fax troubleshooting.

## Related entries

- [[l2-fax-001-secure-fax-failover-explain]]
- [[l2-hipaa-004-business-associate-agreement-checklist]]
