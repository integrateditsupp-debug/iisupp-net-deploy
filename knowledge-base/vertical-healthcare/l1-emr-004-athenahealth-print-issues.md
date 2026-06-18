---
title: "athenahealth print issues"
vertical: healthcare
tier: l1
intent_codes: [EMR.ATHENA, PRINT.QUEUE, CLINICAL.PRINTER]
keywords: [athenahealth, print, printer, forms, labels]
compliance: [HIPAA, HITECH]
created: 2026-06-18
escalation_default: human
---

## Symptom

athenahealth will not print forms, visit summaries, labels, or documents to the expected clinical printer.

## What's happening (1-line cause)

The browser, printer mapping, print queue, or athenahealth print setting is pointing to the wrong output path.

## Fix - try these in order

### 1. Confirm the selected printer

From the print dialog, select the approved clinic printer by name and verify paper size, tray, and label size before printing one test page.

**Escalation:** if the printer is missing from the list, go to step 2.

### 2. Clear the stuck print queue

Cancel stuck jobs for that printer, restart the printer if safe, and print a non-clinical Windows test page first.

**Escalation:** if the Windows test page prints but athenahealth does not, go to step 3.

### 3. Test browser and athena print settings

Try the approved browser, disable pop-up blocking for athenahealth, and verify the user is not printing to PDF by default.

**Escalation:** open a ticket with athenahealth support plus clinic IT if only athena print output fails after the local queue works.

## Compliance reminder

Do not leave failed printouts containing ePHI in output trays. Use a generic test page when possible. If clinical documents printed to the wrong device, record the incident through the clinic privacy process.

## Related entries

- [[l1-clinical-printer-001-prescription-printer-out-of-paper]]
- [[l2-clinical-printer-003-zebra-label-driver-windows-11]]
