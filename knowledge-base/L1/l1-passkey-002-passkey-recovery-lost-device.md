---
id: l1-passkey-002
title: "Recover passkey access after a lost, replaced, or broken device"
category: identity
support_level: L1
severity: high
estimated_time_minutes: 15
audience: end-user
os_scope: ["Windows 11","Windows 10","macOS"]
prerequisites: []
keywords: ["lost passkey","passkey not working","new phone passkey","replaced laptop passkey","remove old passkey","passkey locked out","backup sign in method","delete lost device passkey","security info microsoft account","register new passkey","passkey recovery","admin reset passkey","cant sign in passkey","passkey failed"]
related_articles: ["l1-passkey-001","l1-mfa-001","l1-password-001","l1-m365-001"]
escalation_trigger: "User has lost all passkeys and has no remaining backup sign-in method, requiring an admin to reset authentication methods after identity verification."
last_updated: 2026-06-24
version: 1.0
---

# Recover passkey access after a lost or replaced device

## 1. Symptoms
- Phone or laptop that held the passkey was lost, stolen, reset, or stopped working.
- "Sign in with a passkey" no longer works on the new device.
- User got a new phone and the passkey did not carry over.
- Passkey prompt appears but fails ("couldn't verify" / "this passkey isn't recognized").
- User is worried they are locked out completely.
- An old/lost device still shows under the account's sign-in methods and needs removing.

## 2. Likely Causes
1. The passkey was **device-bound** (Windows Hello on the old PC, or a security key) and that device is gone — it cannot be moved.
2. The passkey was on a phone but **cloud sync was off**, so the replacement phone did not restore it.
3. The user is trying to use a **synced** passkey but is not signed into the same Apple/Google account on the new device.
4. Bluetooth is off, breaking the phone-as-passkey cross-device flow.
5. Account security info still lists a device the user no longer controls.

## 3. Questions To Ask User
1. Which account is affected — work/school (M365 / Entra) or a personal Microsoft account?
2. Do you still have **any** other way to sign in (a second passkey, the Authenticator app, a phone number for text/call)?
3. Where was the lost passkey — on the phone, the laptop (Windows Hello), or a USB security key?
4. Is your new phone signed into the same iCloud/Google account as the old one?
5. Was the lost device potentially stolen (vs. just retired)? This affects how urgently we remove its access.

## 4. Troubleshooting Steps
1. If the passkey "won't work" but the device still exists: confirm **Bluetooth is on** (for phone cross-device), the OS/browser is current, and the user is unlocking with the correct face/fingerprint/PIN.
2. For a synced phone passkey on a new phone: confirm the new phone is signed into the **same iCloud Keychain (iPhone)** or **Google Password Manager (Android)** account; synced passkeys restore from there.
3. If the device is genuinely gone, do **not** keep retrying the missing passkey — move to a backup sign-in method instead (Resolution).
4. Identify whether *any* backup method remains; this determines whether the user can self-serve or needs an admin.

## 5. Resolution Steps
**A. Sign in with a backup method (preferred — no admin needed):**
1. At sign-in, choose **Other ways to sign in / I can't use my passkey**.
2. Pick a remaining method: a **second passkey**, the **Microsoft Authenticator** app, or a **text/call** to a registered phone number.
3. Complete sign-in with that method.

**B. Register a new passkey on the replacement device:**
1. Once signed in, go to **Security info** (work/school: https://aka.ms/mysignins → Security info; personal: account.microsoft.com → Security → Advanced security options).
2. Choose **Add sign-in method → Passkey** and follow l1-passkey-001 to enroll on the new device or phone.

**C. Remove the lost device's passkey from the account:**
1. In **Security info / sign-in methods**, find the entry for the old/lost device (named by device, with the date added).
2. Select it and choose **Delete / Remove**. This revokes that passkey so a thief cannot use it.
3. Repeat for any other stale entries.

**D. All passkeys lost and NO backup method (admin reset):**
1. Contact IT to verify identity per policy (photo ID, manager confirmation).
2. An admin (L2) resets the account's authentication methods in Entra.
3. The user signs in with the temporary method provided, then immediately enrolls a fresh passkey **and** a second backup method.

## 6. Verification Steps
- The user can complete a full sign-in on the **new** device with a newly enrolled passkey.
- The lost device's passkey no longer appears under sign-in methods.
- At least **two** working methods are now registered (e.g., new passkey + Authenticator or phone).
- Recent sign-in activity shows the successful recovery and no unexpected sign-ins from the lost device.

## 7. Escalation Trigger
- User has **no** remaining sign-in method (all passkeys lost, no Authenticator, no phone) — requires admin authentication-methods reset after identity verification. Escalate to **L2**.
- The lost device was stolen and there are signs of unauthorized sign-ins.
- The personal/account portal will not let the user delete the stale passkey.

## 8. Prevention Tips
- **Two methods, always.** Never rely on a single passkey on a single device — keep a second passkey (another device or a security key) or the Authenticator app as backup.
- Turn on passkey cloud sync (iCloud Keychain / Google Password Manager) so a replacement phone restores passkeys automatically.
- Before retiring or selling a device, **remove its passkey from the account first**.
- Keep one registered phone number or a hardware security key as an offline fallback.

## 9. User-Friendly Explanation
"If the device that held your passkey is gone, don't panic — but don't keep tapping the missing passkey either. The fix is to sign in another way (a second passkey, the Authenticator app, or a text code), then add a fresh passkey on your new device and delete the old device from your account so nobody else can use it. If you've truly lost every way in, IT can reset things once we confirm it's really you. The lesson for next time: always keep two ways to sign in."

## 10. Internal Technician Notes
- Device-bound passkeys (Windows Hello, FIDO2 security keys) **cannot** be migrated — recovery always means re-enroll on the new device. Synced passkeys restore from the platform keychain.
- Admin reset path (Entra): **Users → user → Authentication methods → Delete** the stale passkey, or **Require re-register**. Confirm the lost credential's entry is removed, not just the device record.
- Deleting the passkey from Security info revokes the credential server-side; the orphaned credential on a stolen device becomes useless without the account entry.
- Watch for "all methods lost" cases caused by single-method rollouts — push the two-method standard during onboarding to prevent these tickets.
- For personal Microsoft accounts the portal is account.microsoft.com (Advanced security options); for work/school it is My Sign-Ins / Entra.

## 11. Related KB Articles
- l1-passkey-001 — Set up and sign in with a passkey
- l1-mfa-001 — MFA setup, lost device, and recovery
- l1-password-001 — Password reset and self-service password reset
- l1-m365-001 — Can't sign in to Microsoft 365

## 12. Keywords / Search Tags
lost passkey, passkey not working, new phone passkey, remove old passkey, backup sign in method, register new passkey, admin reset passkey, delete lost device passkey, security info, passkey recovery, locked out passkey
