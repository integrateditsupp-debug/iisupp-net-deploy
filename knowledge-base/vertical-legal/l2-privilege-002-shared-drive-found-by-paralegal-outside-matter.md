---
title: Shared drive folder accessible to paralegal outside the matter
vertical: legal
tier: l2
intent_codes: [PRIV.ACCESS,SHAREPOINT]
keywords: [legal, law firm, privilege]
compliance: [privilege, retention, model_rules]
created: 2026-06-18
escalation_default: partner_referral
---

## Symptom

Shared drive folder accessible to paralegal outside the matter — interrupts billable work, may have privilege/ethics implications if mishandled.

## What is happening (1-line cause)

Configuration, sync, or permissions issue in privilege category. Most commonly a stale credential, expired token, or platform-side outage.

## Fix — try these in order

### 1. Reproduce + scope

Confirm the issue affects all users or just one. Open privilege dashboard / status page if available. Capture exact error text and the matter/file ID involved.

**Escalation:** if multiple users affected, this is a tenant-wide incident — log to /aria-tenant-audit and escalate.

### 2. Standard reset path

For most privilege tools: log out fully, clear browser cache for the vendor domain, sign back in. If desktop app: kill process, restart. If a cloud sync: pause and resume.

**Escalation:** if step 2 does not resolve in 10 min, vendor ticket required.

### 3. Vendor ticket + interim workaround

Open a ticket with the vendor (Clio / LEAP / Relativity / etc.) with reproduction steps. Provide screen recording NOT screenshot (privilege exposure risk in screenshots that show case captions). Use a generic test matter for the recording.

**Escalation:** if work is time-sensitive (court deadline, statute of limitations approaching), notify managing partner immediately.

## Privilege + ethics reminder

Any troubleshooting that exposes case content (file names, party names, matter notes, privileged communications) must:
- Be performed by a person authorized to see that matter
- Avoid screenshots that capture client-identifying or privileged content
- Avoid sharing logs containing case data with vendor support without redaction
- Document the troubleshooting in the matter file per firm policy
- For trust accounting issues specifically: do not adjust balances; freeze and escalate to firm's compliance officer

Cross-border data: if the firm has Canadian or EU clients, ensure any cloud backup or screen-share session keeps data in-region per applicable rules (PIPEDA, GDPR, provincial Law Society rules).

## Related entries

- [[l2-privilege-001-accidental-cc-of-opposing-counsel]]
- [[l2-privilege-002-shared-drive-found-by-paralegal-outside-matter]]
- [[l2-conflict-001-conflict-check-database-down]]
