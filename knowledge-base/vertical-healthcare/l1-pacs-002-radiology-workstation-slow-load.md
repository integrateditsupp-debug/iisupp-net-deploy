---
title: "Radiology workstation slow load"
vertical: healthcare
tier: l1
intent_codes: [PACS.PERFORMANCE, WORKSTATION.RADIOLOGY, STORAGE.NETWORK]
keywords: [pacs, radiology, workstation, slow, images]
compliance: [HIPAA, HITECH]
created: 2026-06-18
escalation_default: human
---

## Symptom

Radiology studies load slowly, scroll slowly, or hang on a diagnostic workstation.

## What's happening (1-line cause)

Large image sets can expose workstation resource limits, graphics driver issues, network latency, or PACS storage delays.

## Fix - try these in order

### 1. Check local resource pressure

Close non-clinical apps, confirm disk space, and record CPU, memory, and GPU pressure during the slow load.

**Escalation:** if local resources are normal but loads remain slow, go to step 2.

### 2. Compare another workstation

Have another authorized workstation open the same workflow using approved access, without sharing image content in the ticket.

**Escalation:** if multiple workstations are slow, go to step 3.

### 3. Capture timing and system scope

Record safe timing, modality type, workstation name, network location, and whether prior studies load normally.

**Escalation:** open a ticket with PACS support, network, and workstation engineering for repeated multi-user slowness.

## Compliance reminder

Avoid screenshots or exports containing patient images or demographics. Use safe technical timing data. If diagnostic workflow is delayed, follow the clinical downtime and escalation procedure.

## Related entries

- [[l1-pacs-001-dicom-image-not-displaying]]
- [[l2-hipaa-005-encryption-at-rest-audit]]
