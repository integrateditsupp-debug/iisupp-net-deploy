---
title: "Prescription printer out of paper"
vertical: healthcare
tier: l1
intent_codes: [PRINT.PRESCRIPTION, CLINICAL.WORKFLOW, HARDWARE.PAPER]
keywords: [prescription printer, paper, printer, rx, clinic]
compliance: [HIPAA, HITECH]
created: 2026-06-18
escalation_default: human
---

## Symptom

The prescription printer reports out of paper, wrong paper, or will not print a required prescription.

## What's happening (1-line cause)

The printer may need approved paper loaded correctly, queue cleanup, or a hardware check.

## Fix - try these in order

### 1. Load approved paper

Use only the clinic-approved prescription paper or tray stock, align it correctly, and close all covers firmly.

**Escalation:** if the printer still reports paper empty, go to step 2.

### 2. Clear local printer errors

Cancel duplicate stuck jobs, restart the printer if allowed, and print one non-clinical test page if policy allows.

**Escalation:** if local test printing fails, go to step 3.

### 3. Confirm printer mapping

Verify the EMR or prescribing app is mapped to the correct prescription printer and not a general office printer.

**Escalation:** open a ticket with clinic IT and printer support if printer mapping or hardware failure blocks prescribing workflow.

## Compliance reminder

Prescription output can contain sensitive information. Secure any misprints immediately according to clinic policy. Do not photograph prescriptions for troubleshooting.

## Related entries

- [[l1-emr-004-athenahealth-print-issues]]
- [[l2-clinical-printer-003-zebra-label-driver-windows-11]]
