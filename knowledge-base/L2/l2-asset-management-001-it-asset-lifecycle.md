---
id: l2-asset-management-001
title: "IT asset lifecycle: procurement, deployment, refresh, retirement"
category: asset-management
support_level: L2
severity: medium
estimated_time_minutes: 45
audience: admin
os_scope: ["Multi-platform"]
prerequisites: ["asset register / CMDB access", "Intune or equivalent MDM"]
keywords:
  - asset management
  - asset register
  - cmdb
  - itam
  - procurement
  - device refresh
  - hardware lifecycle
  - asset tag
  - serial number
  - depreciation
  - device retirement
  - e-waste
  - asset audit
related_articles:
  - l2-onboarding-001
  - l2-offboarding-001
  - l2-deployment-001
escalation_trigger: "Lost/stolen device, missing serial in audit, or device returned with sensitive data not wiped"
last_updated: 2026-05-08
version: 1.0
---

# IT asset lifecycle management

## 1. Symptoms / triggers
- New hire needs a device today and the bench is empty.
- Audit reveals devices in CMDB without users, or users without devices.
- Finance asks for accurate depreciation by quarter.
- Devices show up at the help desk with no asset tag.
- Returns from offboarded users sit on a shelf for weeks.
- Vendor renewal quote arrives and we don't know what we have.

## 2. Likely causes
1. No single source of truth — spreadsheet + Intune + procurement portal disagree.
2. Asset tags applied physically but not digitally (or vice versa).
3. Receiving process bypasses the IT register when bought by a department directly.
4. Returns aren't reconciled before being marked "available".
5. No defined refresh policy (3 yrs / 4 yrs / on-demand).

## 3. Questions to ask
1. What's the source of truth — Intune Devices, a SaaS like Lansweeper/Snipe-IT, or a spreadsheet?
2. Who owns the asset register — IT, Finance, or both?
3. What's the device standard — current SKU, accepted alternates, by role?
4. Do we have asset tags AND serial numbers in the register?
5. Who authorises a write-off (lost/stolen/damaged)?

## 4. Troubleshooting / triage
1. **Reconcile** — pull a CSV from Intune (or your MDM), pull purchase orders for the period, compare. Anything in MDM not in PO = grey-market or BYOD. Anything in PO not in MDM = unenrolled.
2. **Tag every active device** with both a physical sticker AND a digital tag stored in MDM custom attribute.
3. **Define states**: Procured · In stock · Deployed · Returned · In repair · Retired · Lost.
4. **Set a refresh cadence** — typical: laptops 3 yrs (knowledge workers) / 4 yrs (light users) / 5 yrs (servers); phones 2 yrs.
5. **Wipe on return** — auto-trigger MDM wipe on offboarding. Don't shelve a device until wipe-success is logged.

## 5. Resolution / runbook
**Procurement intake:**
1. PO is created in finance system → IT receives notification.
2. IT enters: serial, model, supplier, PO #, projected user, asset tag (next sequential).
3. Device arrives → physical sticker applied → enrolled in MDM with tag attribute.
4. State = "In stock" until assigned.

**Assignment / deployment:**
1. New hire ticket → pull next-available device matching role.
2. Update register: state = "Deployed", user UPN, deployed-at timestamp.
3. Asset transfers (user-to-user) require a ticket for audit.

**Returns / offboarding:**
1. Device returned to IT inbox → state = "Returned".
2. Trigger MDM wipe → wait for confirmation.
3. Hardware inspection: damage/missing keys/screen → state = "In repair" or "Retired".
4. If usable → state = "In stock", ready for the next deployment.

**Retirement / e-waste:**
1. Device is end-of-life or beyond economic repair.
2. Confirm wipe (NIST 800-88 destruction certificate for stored sensitive data).
3. Log destruction certificate against the asset record.
4. Send to certified e-waste vendor.
5. State = "Retired" — never delete the record (audit trail).

## 6. Verification
- Random sample of 10 devices → CMDB record matches physical sticker matches MDM enrollment.
- Refresh report — devices over policy age count = projected procurement budget.
- Returns aging — no device sits in "Returned" >5 business days.
- Audit log — no asset state change without a corresponding ticket.

## 7. Escalation trigger
- Lost / stolen device suspected → Security incident pathway, not asset cleanup. Run l3-security-001.
- Audit gap >5% (unaccounted devices) → Pause procurement, run a fleet sweep.
- Returned device with un-wiped sensitive data → Privacy incident.

## 8. Prevention
- Standardise on 1–3 device SKUs per role; resist the urge to one-off purchase.
- Refresh budget reviewed quarterly with Finance.
- Asset tag at receiving, not at deployment.
- Auto-wipe on offboarding — never shelf without confirmation.
- Quarterly reconciliation between Finance, MDM, and CMDB.

## 9. User-friendly explanation
"Asset management is just keeping the list of company devices honest. We tag everything when it arrives, update the list when it gets used or returned, and confirm it's wiped before it's stored or thrown out. That keeps audits clean, keeps purchasing on schedule, and stops a stolen laptop from becoming a data breach."

## 10. Internal technician notes
- Intune: `Get-IntuneManagedDevice | Where-Object { $_.deviceCategoryDisplayName -eq $null }` finds untagged devices.
- Custom attributes for asset tag are configured under `Devices → Configuration → Custom`.
- For warehouses with bulk receiving, batch-enroll via Autopilot CSV upload then bulk-set tag attribute.
- NIST 800-88 destruction certificate template should be attached to every Retired record — auditors ask for this.
- Snipe-IT (open source) is the cheapest CMDB for SMBs <500 devices; ServiceNow / Jira Asset for larger.

## 11. Related KB articles
- l2-onboarding-001 — New user onboarding (where assignment is triggered).
- l2-offboarding-001 — User offboarding (where wipe + return is triggered).
- l2-deployment-001 — Image build / Autopilot.

## 12. Keywords / search tags
asset management, asset register, cmdb, itam, procurement, device refresh, hardware lifecycle, asset tag, serial number, depreciation, device retirement, e-waste, asset audit, snipe-it, lansweeper
