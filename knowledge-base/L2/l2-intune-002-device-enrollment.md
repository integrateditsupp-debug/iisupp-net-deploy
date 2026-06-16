---
id: l2-intune-002
title: "MDM enrollment: enroll a Windows / iOS / Android device into Intune (and fix failed enrollment)"
category: intune
support_level: L2
severity: medium
estimated_time_minutes: 40
audience: technician
os_scope: ["Windows 10", "Windows 11", "iOS", "Android"]
prerequisites: ["User has an Intune/EMS license", "Entra ID account in good standing", "Device meets OS minimums"]
keywords:
  - intune enrollment
  - mdm enroll
  - enroll device
  - autopilot
  - company portal
  - enrollment failed
  - 0x80180014
  - mdm enrollment blocked
  - device not compliant
  - byod enroll
related_articles:
  - l2-intune-001
  - l2-byod-001
  - l2-azure-ad-001
escalation_trigger: "Enrollment restrictions, Autopilot profile assignment, or APNs/managed-Google-Play tenant config — tenant-level MDM platform work for L3."
last_updated: 2026-05-26
version: 1.0
---

# MDM enrollment into Intune (and failed-enrollment fixes)

## 1. Symptoms / Requests
- "Enroll my new laptop / phone into management."
- New hire's device needs to be managed before it can access email or apps.
- Enrollment fails with errors like **0x80180014**, "Something went wrong," "This device is already enrolled," or "Your administrator hasn't given you access."
- Device shows **Not compliant** after enrolling, so Conditional Access blocks apps.

## 2. Likely Causes (for failures)
1. **No Intune license** assigned to the user.
2. **Enrollment restrictions** block the platform/version, or the **device limit** (default 5/user) is hit.
3. **MDM user scope** not set to include the user (Entra ID → Mobility/MDM).
4. **Device already enrolled / orphaned** record from a prior owner or wipe.
5. **Windows**: trying to "Connect work account" (registration only) instead of full enrollment; or device is **Hybrid-joined** and racing with Autopilot.
6. **iOS**: missing/expired **APNs certificate**, or Company Portal not installed.
7. **Android**: managed Google Play / work-profile not configured, or personal-vs-corporate mismatch.
8. **Time/date skew** breaking token issuance (see l1-clock-001).

## 3. Questions To Ask
1. What platform and OS version? Corporate-owned or BYOD?
2. Brand-new out-of-box (Autopilot?) or already in use?
3. Exact error text / code at the point it fails?
4. Was the device previously enrolled or owned by someone else?
5. Does the user have an Intune license (you can confirm in admin center)?

## 4. Triage Steps
1. **Confirm licensing:** the user has Intune/EMS in Microsoft 365 admin → Licenses.
2. **Check MDM user scope:** Entra ID → Mobility (MDM and MAM) → Microsoft Intune → MDM user scope includes the user (All or their group).
3. **Check enrollment restrictions:** Intune admin → Devices → Enrollment → restrictions allow the platform/version and the user isn't over the device cap.
4. **Look for an existing device record:** Intune → Devices → All devices — search the serial/name for a stale/duplicate object.

## 5. Resolution Steps
**Windows — standard user enrollment (Entra join):**
1. Settings → Accounts → **Access work or school** → **Connect** → **Join this device to Azure AD** (full join = MDM enroll), sign in with the work account, complete MFA.
2. *Or* if already Entra-joined: Settings → Access work or school → click the account → **Info** → confirm MDM is connected; if not, "Connect" enrolls into MDM.
3. Force a policy sync: Settings → Access work or school → Info → **Sync**, or `dsregcmd /status` to confirm `AzureAdJoined: YES` and MDM URLs present.

**Windows — Autopilot (new corporate device):**
1. Ensure the hardware hash is uploaded and an Autopilot **deployment profile** is assigned to the device group.
2. OOBE → connect network → sign in with work account → Autopilot applies the profile and enrolls automatically.
3. If it falls back to a normal OOBE, the profile wasn't assigned in time (→ check group membership / escalate).

**iOS/iPadOS (BYOD or corporate):**
1. Install **Intune Company Portal** from the App Store.
2. Open it → sign in → **Begin** → install the management profile (Settings prompts to allow) → trust it.
3. Confirm the device appears in Intune and the management profile is installed under Settings → General → VPN & Device Management.

**Android (work profile / fully managed):**
1. Install **Intune Company Portal** from Google Play → sign in → follow the **work profile** setup.
2. Approve the managed Google Play account; corporate apps land in the work-profile section.

**Fix common failures:**
- **0x80180014 / "blocked":** almost always an **enrollment restriction** or **MDM scope** excluding the user, or a missing license — fix in §4 then retry.
- **"Already enrolled" / orphaned record:** delete the stale device object in Intune, then on the device run `dsregcmd /leave` (Windows) or remove the management profile (mobile), reboot, re-enroll.
- **Device cap reached:** raise the per-user device limit in enrollment restrictions or remove old devices.

## 6. Verification Steps
- Device appears in **Intune → Devices** with the correct user and **Managed by: Intune (MDM)**.
- `dsregcmd /status` (Windows) shows `AzureAdJoined: YES` and an MDM enrollment URL.
- Compliance state flips to **Compliant** after first policy evaluation.
- A Conditional-Access-gated app (e.g., Outlook) opens, proving the managed/compliant state is honored.
- Company Portal lists the device as managed; assigned apps begin installing.

## 7. Escalation Trigger
- Enrollment **restrictions / Autopilot profiles / APNs cert / managed Google Play** need tenant changes.
- Hybrid Azure AD join + Autopilot timing conflicts requiring AAD Connect / GPO work.
- Compliance fails for a policy reason that needs the baseline redesigned.
- → Escalate to **L3 endpoint/identity engineering** with the device's enrollment status and the exact error.

## 8. Prevention Tips
- Assign Intune licenses as part of onboarding (l2-onboarding-001) so devices can enroll on day one.
- Keep the **APNs certificate** renewed (annual) — expiry breaks all iOS management at once; calendar it.
- Pre-provision corporate Windows devices via **Autopilot** so users get a hands-off, compliant setup.
- Set a sensible per-user device limit and clean up stale device records regularly.

## 9. User-Friendly Explanation
"Enrolling your device means it gets registered with the company so it can safely receive email, apps, and security settings — and so we can wipe just the work data if it's ever lost. On a phone you'll install the Company Portal app and follow a couple of prompts; on a new laptop it often happens automatically the first time you sign in. Once it's enrolled and shows as 'compliant,' your work apps will open without being blocked."

## 10. Internal Technician Notes
- `dsregcmd /status` is the fastest Windows truth source: AzureAdJoined, DeviceId, MDM URL, and tenant details.
- Distinguish **Entra registration** (BYOD, identity only) from **Entra join** (full MDM) — users often do the former and wonder why management never applies.
- Stale objects: delete in Intune AND Entra ID; a duplicate Entra device can block re-enroll.
- 0x80180014 maps to enrollment-restriction/scope blocks far more often than a device fault.
- iOS APNs cert is tenant-wide and silent on expiry until devices stop checking in — track its expiry date.
- Force Windows MDM sync via Task Scheduler → Microsoft → Windows → EnterpriseMgmt → run the sync task for fast policy pull.

## 11. Related KB Articles
- l2-intune-001 — Device compliance
- l2-byod-001 — Bring-your-own-device
- l2-azure-ad-001 — Conditional Access block

## 12. Keywords / Search Tags
intune enrollment, mdm enroll, enroll device, autopilot, company portal, enrollment failed, 0x80180014, mdm enrollment blocked, device not compliant, byod enroll, dsregcmd, entra join, apns certificate, enrollment restrictions
