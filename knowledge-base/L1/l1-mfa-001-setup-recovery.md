---
id: l1-mfa-001
title: "Multi-factor authentication (MFA): setup, lost device, and recovery"
category: mfa
support_level: L1
severity: high
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS", "iOS", "Android"]
prerequisites: []
keywords:
  - mfa
  - 2fa
  - two factor
  - multi factor
  - authenticator
  - lost phone
  - new phone
  - mfa code
  - microsoft authenticator
  - authy
  - google authenticator
related_articles:
  - l1-m365-001
  - l1-password-001
  - l2-azure-ad-002
escalation_trigger: "User locked out with no recovery method, or admin reset required for MFA, or token replay/abuse suspected"
last_updated: 2026-05-07
version: 1.0
---

# MFA: setup, lost device, and recovery

## 1. Symptoms
- "Approve sign-in" prompt never arrives on phone.
- Lost or replaced phone — no MFA app installed yet.
- New phone but old phone still has Authenticator entries.
- "Need more information" sign-in interruption when MFA hasn't been enrolled.
- Six-digit code rejected as "incorrect".
- Locked out completely.

## 2. Likely Causes
1. Phone lost or replaced.
2. Authenticator app reinstalled (entries gone).
3. Phone clock skewed (TOTP codes are time-based — must be within ±30s).
4. MFA method was SMS to a number the user no longer has.
5. New device not yet trusted.
6. Notification permissions revoked on phone.

## 3. Questions To Ask User
1. Do you still have any working MFA method (text, call, alternate app)?
2. Did your phone change recently (replaced, reset, lost)?
3. Is your phone's date/time set automatically?
4. Are you receiving the push notification but it's slow, or not at all?
5. Is your work account verified at https://aka.ms/mfasetup right now?

## 4. Troubleshooting Steps
1. Verify phone time is auto-set; correct skew.
2. Open Microsoft Authenticator → ensure app has notification permission (phone Settings → Apps → Authenticator → Notifications).
3. Check phone is online (data or Wi-Fi).
4. If push not arriving, try the alternate method (text, phone call, secondary app) from the sign-in prompt's "Other ways to sign in".
5. Manually open Authenticator and use the rolling 6-digit code.

## 5. Resolution Steps
**Setting up MFA for the first time:**
1. Visit https://aka.ms/mfasetup (or follow the prompt during sign-in).
2. Click "Add sign-in method" → choose Microsoft Authenticator.
3. Install Microsoft Authenticator on phone (iOS App Store / Google Play).
4. In the app: Add account → Work or school account → Scan QR code shown on the website.
5. Approve the test prompt.
6. Add a backup method (phone number for text, in case device lost).

**New phone (old phone still works):**
1. Install Authenticator on new phone.
2. On old phone, in Authenticator: Settings → Backup → ensure cloud backup ON (with iCloud / Microsoft account).
3. On new phone, in Authenticator: Begin recovery → sign in with same recovery account → entries restore.
4. Re-verify each entry — Authenticator may require re-verification on new device.

**New phone (old phone gone):**
1. Try sign-in with backup method (text/call to phone number on file).
2. If backup works → https://aka.ms/mfasetup → remove old Authenticator entry → add new.
3. If no backup methods work → Escalate (admin reset).

**Lost phone, no backup methods:**
1. Submit identity verification request to IT (photo ID, manager confirmation per policy).
2. Admin (L2) clears MFA registration via Entra portal.
3. User signs in once with password only → re-enrolls fresh.

## 6. Verification Steps
- Sign-in test from a different browser session succeeds with MFA.
- Authenticator shows current account with green "Active" status.
- Two registered methods minimum (one primary + one backup).
- "Sign-in activity" in My Sign-Ins shows recent successful MFA challenges.

## 7. Escalation Trigger
- User has zero working recovery methods.
- Admin reset of MFA needed.
- MFA prompts arriving for sign-ins user did not initiate (possible token theft / phishing).
- Conditional Access requires compliant device and user is on personal device.
- → Escalate to **L2** with: UPN, identity verification status, last successful sign-in, suspicious activity flags.

## 8. Prevention Tips
- Always register at least 2 MFA methods (Authenticator + phone number).
- Enable cloud backup in Authenticator (Settings → Backup).
- Keep a printed/secure list of verification phone numbers used.
- Never approve MFA prompts you didn't initiate. If prompts come unprompted, your password may be compromised — change it immediately and report.
- For very sensitive accounts, use FIDO2 security key (YubiKey) — phishing-resistant.

## 9. User-Friendly Explanation
"MFA is the extra check that protects your account from someone who guessed or stole your password. If your phone's gone or unhappy, we have a few ways to get you back in: try a backup method like text-to-phone, restore your authenticator from cloud backup, or have IT reset it after we confirm it's really you. Adding a second method now is the best favor you can do for future-you."

## 10. Internal Technician Notes
- Admin MFA reset (Entra/Azure AD): Users → user → Authentication methods → Require re-register MFA.
- Or PowerShell: `Reset-MsolStrongAuthenticationMethodByUpn -UserPrincipalName user@domain`.
- Number matching (push notifications now show 2-digit code in browser; user types into app) is now default — reduces approval-spam attacks.
- TOTP codes valid for current 30s window + grace; clock skew >60s breaks them.
- For "MFA fatigue" attacks (attacker spams pushes hoping user approves): enable Authenticator number-matching policy and review sign-in logs for repeated denied prompts.
- FIDO2 / Passkey rollout — recommended for admin accounts and high-value users.

## 11. Related KB Articles
- l1-m365-001 — Can't sign in to M365
- l1-password-001 — Password reset and SSPR
- l2-azure-ad-002 — MFA admin policy and Conditional Access integration

## 12. Keywords / Search Tags
mfa, 2fa, two factor, multi factor, authenticator, lost phone, new phone, mfa code, microsoft authenticator, push notification not arriving
