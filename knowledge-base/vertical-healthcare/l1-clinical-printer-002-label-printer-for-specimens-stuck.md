---
title: "Specimen label printer stuck"
vertical: healthcare
tier: l1
intent_codes: [PRINT.LABEL, SPECIMEN.WORKFLOW, HARDWARE.ZEBRA]
keywords: [label printer, specimen, stuck, zebra, clinic]
compliance: [HIPAA, HITECH]
created: 2026-06-18
escalation_default: human
---

## Symptom

The specimen label printer is stuck, labels are not advancing, or labels print misaligned.

## What's happening (1-line cause)

The label roll, sensor, queue, or driver setting may be out of alignment with the specimen label format.

## Fix - try these in order

### 1. Check media and sensor path

Confirm the approved label roll is installed correctly, labels feed under the guides, and the cover is fully closed.

**Escalation:** if labels still do not advance, go to step 2.

### 2. Calibrate or feed one label

Use the printer feed or calibration process documented for the model, then print one non-clinical test label.

**Escalation:** if calibration fails or labels remain misaligned, go to step 3.

### 3. Verify driver and size

Check the mapped printer, label dimensions, orientation, and EMR label template setting.

**Escalation:** open a ticket with clinic IT, lab workflow owner, and printer support if specimen labeling is delayed.

## Compliance reminder

Do not leave specimen labels with identifiers exposed or discarded in regular trash. Use blank or test labels for troubleshooting whenever possible. Follow lab downtime labeling policy if printing is unavailable.

## Related entries

- [[l2-clinical-printer-003-zebra-label-driver-windows-11]]
- [[l1-emr-004-athenahealth-print-issues]]
