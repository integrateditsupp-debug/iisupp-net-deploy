---
id: l2-sharepoint-001
title: "SharePoint Online: permissions, broken inheritance, sharing audit"
category: sharepoint
support_level: L2
severity: medium
estimated_time_minutes: 30
audience: admin
prerequisites: ["SharePoint Admin", "Site Collection Admin"]
os_scope: ["SharePoint Online"]
keywords:
  - sharepoint
  - permissions
  - broken inheritance
  - access denied
  - sharing audit
  - link sharing
  - everyone except external
  - guests
related_articles:
  - l1-onedrive-003
  - l2-azure-ad-001
escalation_trigger: "Site collection-wide permission corruption, or external sharing risk audit, or compliance review"
last_updated: 2026-05-07
version: 1.0
---

# SharePoint permissions and sharing

## 1. Symptoms
- "You don't have access to this page".
- File visible in search but locked when opened.
- External user can't access shared file.
- Inherited permissions don't propagate down.
- "Stop sharing" doesn't fully revoke.

## 2. Causes
1. Item-level "Stop inheriting permissions" set unintentionally.
2. Sharing link expired.
3. Guest user not invited / still pending.
4. "Everyone except external users" filter excluded a guest.
5. Sensitivity label restricting access.
6. SharePoint admin policy blocks anonymous links.

## 3. Resolution
**Broken inheritance:**
- Site → Settings → Site permissions → check inheritance level.
- Item → Manage access → "Advanced" → "Restore inheritance" if intentional break wasn't required.

**Sharing audit:**
- Microsoft Purview audit log → search for `SharingSet`, `SharingInvitationCreated`, `AnonymousLinkCreated`.
- Bulk report: SharePoint admin → Reports → External sharing.

**External user trouble:**
- Confirm invitation in user's email; resend if needed.
- Verify external sharing setting at tenant + site level (more restrictive wins).
- Guest user objects in Entra → check status `Accepted`.

**Sensitivity label clash:**
- Confirm user has access to the label per Purview.
- Or remove label if mis-applied.

## 4. Verification
- Affected user opens file successfully.
- No new audit alerts.
- Inheritance restored where appropriate.

## 5. Escalation
- Compliance violation suspected.
- Site collection corruption.
- → L3.

## 6. Prevention
- Use security groups, not individual users.
- Default external sharing to "Only people in organization" unless business needs broader.
- Sensitivity labels with rationale documented.
- Quarterly access review.
- Don't grant Everyone except external users to highly sensitive sites.

## 7. Notes
- SharePoint vs OneDrive — both share underlying engine but policies differ.
- Tenant external sharing > site collection > library > item — most restrictive applies.
- "Anyone with the link" vs "People in your organization" vs "Specific people" — communicate the difference clearly.
- Microsoft 365 Groups ownership flows to the site — adding/removing owners affects access.

## 8. Related Articles
- l1-onedrive-003 — Sync conflicts
- l2-azure-ad-001 — Conditional Access on SharePoint

## 9. Keywords
sharepoint, permissions, broken inheritance, access denied, sharing audit, link sharing, everyone except external, guests
