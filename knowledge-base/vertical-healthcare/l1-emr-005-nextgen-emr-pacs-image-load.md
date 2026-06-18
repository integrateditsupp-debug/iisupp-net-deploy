---
title: "NextGen EMR cannot load PACS images"
vertical: healthcare
tier: l1
intent_codes: [EMR.NEXTGEN, PACS.IMAGE, BROWSER.PLUGIN]
keywords: [nextgen, pacs, image, viewer, dicom]
compliance: [HIPAA, HITECH]
created: 2026-06-18
escalation_default: human
---

## Symptom

NextGen opens the chart but linked images, DICOM studies, or PACS viewer content do not load.

## What's happening (1-line cause)

The EMR link, PACS viewer, browser setting, or workstation network route is blocking image retrieval.

## Fix - try these in order

### 1. Test the viewer outside the chart

Open the approved PACS viewer shortcut or portal directly and confirm whether the viewer loads without opening patient-specific content.

**Escalation:** if the viewer itself does not load, go to step 2.

### 2. Check browser and pop-up permissions

Use the approved browser, allow pop-ups for the EMR and PACS domains, and retry from a fresh browser session.

**Escalation:** if the viewer opens but images do not display, go to step 3.

### 3. Confirm local network access

Verify VPN or clinic network connection, workstation time, and whether other users at the same location can open PACS.

**Escalation:** open a ticket with NextGen, PACS vendor support, and clinic IT if the issue follows the study link or affects multiple workstations.

## Compliance reminder

Do not send image screenshots or study identifiers through email or chat. Use accession-free timing details and approved ticket references only. If image access changes are made, retain the support audit record.

## Related entries

- [[l1-pacs-001-dicom-image-not-displaying]]
- [[l2-hipaa-005-encryption-at-rest-audit]]
