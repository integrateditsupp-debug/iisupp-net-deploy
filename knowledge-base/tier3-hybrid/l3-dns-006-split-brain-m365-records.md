---
title: Split-brain DNS breaks Microsoft 365 records
category: dns
support_level: L3
severity: high
audience: senior-it
keywords: [split brain dns, m365, autodiscover]
created: 2026-06-18
escalation_trigger: Internal users resolve different records than external users.
---
# Split-brain DNS breaks Microsoft 365 records

## Symptom

The requester reports a dns support issue that matches: split brain dns, m365, autodiscover.

## What ARIA should do first

Compare internal/external DNS for autodiscover, MX, SPF, DKIM, Teams, and federation endpoints.

## Guardrails

- Collect only the minimum operational details needed to troubleshoot.
- Do not expose student, patient, employee, or production records in screenshots or notes.
- Do not make privileged changes, production changes, legal claims, or vendor submissions without owner approval.

## Escalation

Escalate when: Internal users resolve different records than external users.

## Support tier

Default tier: L3. Default severity: high. Article ID: l3-dns-006-split-brain-m365-records.
