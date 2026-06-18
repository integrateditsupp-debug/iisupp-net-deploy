---
title: "Cerner PowerChart crashes on launch"
vertical: healthcare
tier: l1
intent_codes: [EMR.CERNER, APP.CRASH, WORKSTATION.CLINICAL]
keywords: [cerner, powerchart, crash, citrix, workstation]
compliance: [HIPAA, HITECH]
created: 2026-06-18
escalation_default: human
---

## Symptom

Cerner PowerChart opens, freezes, closes, or crashes before the user can reach the patient list.

## What's happening (1-line cause)

The local workstation profile, Citrix session, or required plugin is failing before the EMR workspace loads.

## Fix - try these in order

### 1. Restart the clinical app session

Sign out of PowerChart, close all Citrix or EMR windows, wait 60 seconds, and launch PowerChart from the approved clinical shortcut.

**Escalation:** if the app crashes again on first launch, go to step 2.

### 2. Test another workstation or profile

Have the same user try a known-good clinical workstation, then have another user try the original workstation.

**Escalation:** if only one workstation fails, go to step 3.

### 3. Capture safe crash details

Record the workstation name, time, Windows event error, app version, and whether Citrix was involved, without including chart data.

**Escalation:** open a ticket with Cerner support plus IT endpoint support if the crash repeats after restart and profile isolation.

## Compliance reminder

Do not include patient names, MRNs, encounter IDs, orders, or chart screenshots in crash logs. If a screenshot is required, crop to the error window only. Store logs in the approved encrypted ticketing system.

## Related entries

- [[l2-emr-006-citrix-receiver-emr-disconnect-frequently]]
- [[l2-hipaa-005-encryption-at-rest-audit]]
