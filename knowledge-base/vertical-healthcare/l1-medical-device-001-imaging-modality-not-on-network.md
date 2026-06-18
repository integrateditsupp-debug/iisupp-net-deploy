---
title: "Imaging modality not on network"
vertical: healthcare
tier: l1
intent_codes: [DEVICE.IMAGING, NETWORK.CONNECTIVITY, PACS.DICOM]
keywords: [imaging, modality, network, dicom, pacs]
compliance: [HIPAA, HITECH]
created: 2026-06-18
escalation_default: human
---

## Symptom

An imaging modality cannot reach PACS, modality worklist, or the clinical network.

## What's happening (1-line cause)

The device may have lost physical network, IP configuration, VLAN access, or DICOM destination reachability.

## Fix - try these in order

### 1. Check physical link safely

Confirm the network cable is seated, switch port lights are active, and the device has not been moved to an unapproved jack.

**Escalation:** if there is no link light after reseating the cable, go to step 2.

### 2. Confirm network identity

Record device name, IP address shown on the device, room, wall jack, and last successful send time.

**Escalation:** if the IP is missing, wrong, or duplicated, go to step 3.

### 3. Test DICOM destination reachability

Ask IT or biomedical engineering to validate route, firewall, VLAN, and PACS destination status using approved tools.

**Escalation:** open a ticket with biomedical engineering, network, and PACS support if connectivity does not restore quickly.

## Compliance reminder

Do not photograph images, demographics, or order lists from the modality screen. Use device identifiers, safe timestamps, and room location only. Preserve vendor service logs in the approved support system.

## Related entries

- [[l1-pacs-001-dicom-image-not-displaying]]
- [[l2-hipaa-005-encryption-at-rest-audit]]
