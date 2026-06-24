---
id: l1-passkey-001
title: "Set up and sign in with a passkey (passwordless / FIDO2 / Windows Hello)"
category: identity
support_level: L1
severity: medium
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 11","Windows 10","macOS"]
prerequisites: []
keywords: ["passkey setup","passwordless sign in","fido2 key","windows hello passkey","phone as passkey","microsoft 365 passkey","entra passkey","how to use a passkey","sign in without password","add a passkey","passkey vs password","security key login","scan qr code to sign in","platform passkey","roaming passkey"]
related_articles: ["l1-passkey-002","l1-mfa-001","l1-m365-001","l1-password-001"]
escalation_trigger: "User cannot enroll a passkey because the tenant has not enabled the passkey/FIDO2 authentication method, or the device does not support a platform authenticator."
last_updated: 2026-06-24
version: 1.0
---

# Set up and sign in with a passkey

## 1. Symptoms
- User wants to "go passwordless" or was told to "add a passkey" for their work account.
- Sign-in screen now offers "Sign in with a passkey" / "Use Windows Hello or a security key" / "Face, fingerprint, or PIN."
- User has a new phone or laptop and wants the same fast sign-in they had before.
- "Other ways to sign in" appears but the user does not understand which option is a passkey.
- User is unsure whether the passkey lives on the phone, the laptop, or a USB key.

## 2. Likely Causes
This is usually a setup/how-to request, not a fault. Common reasons the user is asking:
1. Organization is rolling out phishing-resistant passwordless sign-in.
2. User received a prompt to "register a passkey" during sign-in.
3. User bought a new device and the passkey did not automatically appear.
4. Confusion between a **platform passkey** (built into a device — Windows Hello, Touch ID, the phone) and a **roaming passkey** (a separate FIDO2 security key like a USB/NFC key).

## 3. Questions To Ask User
1. Which account is this for — your work/school (Microsoft 365 / Entra) account, or a personal account?
2. What device are you setting it up on — Windows PC, Mac, or phone?
3. Does your PC have a fingerprint reader, a face camera (Windows Hello), or at least a Hello PIN set up?
4. Do you have a physical security key (USB/NFC), or do you want to use the device itself / your phone?
5. Is this your first passkey, or are you adding a second device?

## 4. Troubleshooting Steps
Before enrolling, confirm the prerequisites:
1. Confirm the device is up to date (Windows Update / macOS update) — passkey support improves with OS updates.
2. On Windows, confirm Windows Hello is set up: **Settings → Accounts → Sign-in options → set up Face, Fingerprint, or PIN.** A passkey on Windows is protected by Hello, so Hello must exist first.
3. On Mac, confirm Touch ID or a device password is configured and the user is signed into iCloud (for syncing).
4. Confirm the browser is current (Edge, Chrome, or Safari) — passkey prompts use the browser/OS, not a plugin.
5. If "Add passkey" is greyed out or missing for a work account, the tenant may not have enabled the method — see Escalation.

## 5. Resolution Steps
**A. Enroll a passkey on Windows (Windows Hello as the passkey):**
1. Go to your account security/My Sign-Ins page (for M365: https://aka.ms/mysignins → **Security info**).
2. Choose **Add sign-in method → Passkey** (or "Security key / Passkey").
3. When prompted "Where do you want to save this passkey?", choose **This device (Windows Hello)**.
4. Approve with your fingerprint, face, or Hello PIN. The passkey is now stored in the PC's secure hardware (TPM).

**B. Enroll a passkey on a phone (phone-as-passkey):**
1. On the account security page on your **computer**, choose **Add passkey → iPhone, iPad, or Android device** (or "Use a different device").
2. A **QR code** appears on the computer screen.
3. **Scan the QR code with the phone's camera.** The phone connects over Bluetooth (keep both devices close and Bluetooth on).
4. Approve on the phone with Face ID / fingerprint / screen lock. The passkey is saved to the phone's keychain (iCloud Keychain on iPhone, Google Password Manager on Android).

**C. Enroll a roaming passkey on a security key (USB/NFC FIDO2 key):**
1. Choose **Add passkey → Security key**.
2. Insert the USB key (or tap an NFC key to the device).
3. Create or enter the key's **PIN**, then touch the gold disc/sensor to confirm presence.
4. The passkey now lives on the physical key and works on any device you plug it into.

**D. Sign in with a passkey afterward:**
1. At the sign-in screen, enter the username (or it may be remembered), then choose **Sign in with a passkey / other ways to sign in → Passkey**.
2. For a device passkey: approve with Hello/Touch ID/PIN.
3. For a phone passkey on a different computer: choose "phone," scan the QR with the phone, approve on the phone.
4. For a security key: insert/tap the key, enter its PIN, touch the sensor.

## 6. Verification Steps
- The new passkey is listed under **Security info / Sign-in options** with the device name and the date added.
- Open a fresh private/incognito browser window and complete one full passkey sign-in successfully.
- Confirm the user has **at least one backup sign-in method** (a second passkey, the Authenticator app, or a phone number) — see l1-passkey-002.
- For phone-as-passkey, confirm it works against a different computer (the cross-device flow), not only the enrolling computer.

## 7. Escalation Trigger
- The passkey / FIDO2 method is **not enabled in the tenant**, so "Add passkey" is missing or fails — requires an admin to enable it in the Entra authentication-methods policy. Escalate to **L2**.
- The device has no platform authenticator (no Hello, no Touch ID) and the user has no security key.
- Enrollment repeatedly fails with a hardware/TPM error.

## 8. Prevention Tips
- **Always register two passkeys/methods** (for example, the laptop *and* the phone, or a passkey *and* the Authenticator app). One device failure should never cause a lockout.
- Keep a physical security key as a phishing-resistant backup for high-value accounts.
- Enable cloud sync for phone passkeys (iCloud Keychain / Google Password Manager) so a replacement phone restores them.
- Never share a passkey QR code with anyone — a passkey login request you did not start is a red flag.

## 9. User-Friendly Explanation
"A passkey replaces your password with something only you have — your phone, your laptop, or a little security key — unlocked by your face, fingerprint, or PIN. There's nothing to type and nothing for an attacker to phish, because the secret never leaves your device. You can store a passkey right on your computer (Windows Hello), on your phone (scan a QR code to use it on other computers), or on a USB security key. The golden rule: set up two of them, so losing one device never locks you out."

## 10. Internal Technician Notes
- Passkeys are FIDO2/WebAuthn credentials. **Platform** passkeys are bound to the device's authenticator (Windows Hello/TPM, Apple Secure Enclave); **roaming** passkeys live on an external FIDO2 authenticator (security key).
- Phone-as-passkey uses the CTAP 2.2 "hybrid" transport (QR + BLE proximity) — Bluetooth must be on for both devices; it is presence-proximity, not internet-relayed.
- Synced passkeys (iCloud Keychain, Google Password Manager) roam across a user's own devices; device-bound passkeys (Windows Hello, security keys) do not sync and must be enrolled per device.
- For Entra: passkey (FIDO2) is enabled under **Authentication methods policy**. Attestation enforcement and AAGUID allow-lists can restrict which key models are accepted.
- Passkeys satisfy MFA in a single gesture (possession + biometric/PIN) and are phishing-resistant — prefer for admins and high-value users.

## 11. Related KB Articles
- l1-passkey-002 — Passkey recovery when a device is lost or replaced
- l1-mfa-001 — MFA setup, lost device, and recovery
- l1-m365-001 — Can't sign in to Microsoft 365
- l1-password-001 — Password reset and self-service password reset

## 12. Keywords / Search Tags
passkey setup, passwordless sign in, fido2 key, windows hello passkey, phone as passkey, microsoft 365 passkey, entra passkey, scan qr code to sign in, platform passkey, roaming passkey, security key login, add a passkey
