---
title: "DICOM image not displaying"
vertical: healthcare
tier: l1
intent_codes: [PACS.DICOM, IMAGE.VIEWER, WORKSTATION.CLINICAL]
keywords: [pacs, dicom, image, viewer, radiology]
compliance: [HIPAA, HITECH]
created: 2026-06-18
escalation_default: human
---

## Symptom

A DICOM image or study opens to a blank screen, spinner, or viewer error.

## What's happening (1-line cause)

The issue may be a viewer cache problem, workstation graphics issue, PACS route issue, or missing study availability.

## Fix - try these in order

### 1. Test the viewer with a safe workflow

Open the PACS viewer home page or test viewer function without sharing or copying image content.

**Escalation:** if the viewer itself fails to load, go to step 2.

### 2. Restart browser or viewer cache

Close the viewer, clear approved viewer cache if documented, reopen, and try the study link again.

**Escalation:** if the same image remains blank on this workstation, go to step 3.

### 3. Compare workstation and study scope

Ask another authorized workstation to test whether the issue follows the workstation or the study link.

**Escalation:** open a ticket with PACS support if the same study fails for multiple authorized users or devices.

## Compliance reminder

Do not attach DICOM screenshots, patient demographics, or accession numbers in general chat. Use approved PACS ticket references and minimal metadata. Store any exported logs in encrypted support storage.

## Related entries

- [[l1-pacs-002-radiology-workstation-slow-load]]
- [[l1-emr-005-nextgen-emr-pacs-image-load]]
