---
id: l1-vpn-mobilepass-001
title: "MobilePASS+ — install, enroll, and use for VPN MFA tokens"
category: mfa
support_level: L1
severity: high
estimated_time_minutes: 12
audience: end-user
os_scope: ["iOS 15+", "Android 12+", "Windows 10/11 desktop variant"]
tech_generation: current
year_range: "MobilePASS+ replaced MobilePASS Classic 2018; current"
eol_status: "Thales (formerly Gemalto / SafeNet) MobilePASS+ is current. Classic MobilePASS EOL March 2025 — must migrate."
prerequisites: ["Enrollment email or QR code from IT", "Smartphone (preferred) OR Windows / Mac for desktop variant"]
keywords:
  - mobilepass
  - mobilepass+
  - mobilepass plus
  - safenet
  - gemalto
  - thales
  - otp
  - one-time password
  - token
  - mfa
  - 6-digit code
  - hardware token replacement
  - rsa alternative
related_articles:
  - l1-vpn-ivanti-001-ivanti-secure-access-connect
  - l1-mfa-001-setup-recovery
escalation_trigger: "Enrollment link expired AND user has critical VPN need — IT must reissue enrollment from SafeNet Authentication Service / Trusted Access console."
last_updated: 2026-05-12
version: 1.0
---

# MobilePASS+ — install, enroll, and use for VPN MFA tokens

## 1. Symptoms
- New user enrolling for VPN access — IT sent an "enrollment email" or "activation link" for MobilePASS+.
- Existing user got a new phone — needs to re-enroll.
- User on old MobilePASS Classic — being migrated to MobilePASS+.
- VPN sign-in asks for a 6-digit code from MobilePASS+.

## 2. About MobilePASS+
- OTP (one-time password) generator app from Thales (acquired Gemalto / SafeNet).
- Replaces physical hardware tokens (key fobs that show a 6-digit number every 60 seconds).
- Common in VPN, banking, healthcare, government environments.
- Generates a fresh 6-digit code every 30 seconds.

## 3. Questions To Ask User
1. Did IT email you an enrollment link or QR code?
2. Phone (iOS / Android) or desktop?
3. Have you used MobilePASS before? (Classic version, or a totally new user?)
4. Is the enrollment email still valid? (Most expire in 7-14 days.)

## 4. Step-by-Step Enrollment

### iPhone / iPad

**Step 1 — Install MobilePASS+.**
- App Store → search **MobilePASS+** (by Thales).
- Tap **GET** → wait for install → tap **OPEN**.

**Step 2 — Open the enrollment email or message on your phone.**
- Look for an email subject like "Your MobilePASS+ activation" from IT or `donotreply@<company>.com`.
- Inside the email, you'll see either:
  - **Method A:** A clickable activation link (`mobilepass://activate/...` or similar)
  - **Method B:** A QR code image
  - **Method C:** A manual enrollment string (long alphanumeric)

**Step 3 — Activate (Method A — link):**
- Tap the activation link.
- Phone prompts: "Open in MobilePASS+?" → tap **Open**.
- App launches and auto-imports the token. Skip to Step 5.

**Step 3b — Activate (Method B — QR code):**
- Open MobilePASS+ app → tap **+** → **Scan QR code**.
- Allow camera access if asked.
- Point camera at the QR code in the email (or on the IT portal). Hold steady ~2 seconds.
- App imports the token automatically.

**Step 3c — Activate (Method C — manual string):**
- Open MobilePASS+ → tap **+** → **Enter activation code**.
- Type the activation code exactly from the email. (Copy/paste works — long-press email text → Copy → long-press in app → Paste.)
- Tap **Activate**.

**Step 4 — Set a token name (and optional PIN):**
- Name: anything memorable, e.g., `Work VPN`.
- PIN: 4-6 digits. Optional but **strongly recommended** — protects the token if your phone is unlocked.

**Step 5 — Test the token.**
- Token entry now shows in the MobilePASS+ home screen with a 6-digit code.
- The code rotates every 30 seconds — a thin progress bar shows time remaining.
- *(What you should see: A 6-digit number, large font, with a colored progress indicator.)*

### Android — same flow as iPhone above.

### Windows / Mac desktop (less common)

**Step 1 — Download from your IT portal.** (Look for "MobilePASS+ for Windows" or `.msi` / `.dmg` installer.)
**Step 2 — Install + open.**
**Step 3 — Activate** with the link / QR / manual code from IT email.
**Step 4 — Token shows in app window.**

## 5. Using the Token at VPN Sign-In

When Ivanti / Pulse / other VPN client prompts for "Token Code" or "OTP" or "Authenticator":

1. Open MobilePASS+ on your phone.
2. (If you set a PIN) Enter your PIN.
3. Read the current 6-digit code displayed.
4. Type it into the VPN sign-in screen exactly. **No spaces. No dashes.**
5. Press **Enter** or click **Submit** within the 30-second window.
6. If the timer runs out mid-typing, the code expires — wait for the next code, then retype.

## 6. Verification Steps
- Token appears in MobilePASS+ home with a name + 6-digit code.
- Code rotates every 30 seconds.
- VPN successfully accepts a code (one-time test).

## 7. Common Errors and Fixes

**"Invalid token" / "Invalid OTP"**
- Phone time is wrong. iOS: Settings → General → Date & Time → enable "Set Automatically." Android: Settings → System → Date & Time → enable "Set time automatically."
- You typed yesterday's code. Open the app fresh and use the current code.

**Activation link expired**
- Ask IT to resend a new enrollment. Old link cannot be reused.

**"Cannot reach activation server"**
- Make sure phone has internet (not just Wi-Fi with no internet pass-through).
- Some corporate enrollment servers are only reachable from inside the company network — try connecting to Wi-Fi at the office or via a temporary VPN provided for enrollment.

**Code doesn't get accepted no matter what**
- Token may have been removed from the back-end (rare). Contact IT to verify the token is still active in SafeNet Authentication Service / Trusted Access console.

## 8. When to Call IT vs Self-Serve

**Self-serve:**
- Fix phone time → almost always resolves "invalid OTP."
- Re-scan QR / re-paste activation string if first try failed.
- Restart phone if app crashes on launch.

**Call IT:**
- Enrollment link expired AND you can't access VPN at all.
- Token works for some attempts but fails randomly — could be a server-side clock drift.
- You replaced your phone and didn't migrate the token (token is bound to original device — needs IT re-issue).
- You see "Account suspended" or "Token revoked."

## 9. Prevention Tips
- **Set up a PIN** on the token. Phone unlock + PIN gives two-factor protection.
- **Back up — but carefully.** Some companies forbid token cloning to multiple devices for compliance. Confirm policy with IT before "moving" or "duplicating" a token.
- **Re-enroll BEFORE you upgrade your phone**, not after. New phone setup with a working old phone makes the migration smooth; phone-already-traded-in makes it painful.

## 10. User-Friendly Explanation
MobilePASS+ is a small app that makes a fresh 6-digit code every 30 seconds. When you sign in to the company VPN, the VPN asks for that code along with your password. It's like a physical token key fob, just on your phone. IT sends you an activation link or QR code one time to set it up — after that, you just open the app, read the number, and type it in when prompted.

## 11. Internal Technician Notes
- Back-end: Thales SafeNet Authentication Service (SAS) cloud OR on-prem SAS-PCE, OR Trusted Access (newer SaaS).
- Token format: time-based OTP (TOTP), RFC 6238 — interoperable with other authenticators in some cases (depends on how IT provisioned it; soft-token-bound tokens are NOT interoperable).
- Bulk enrollment: SAS admin console → Tokens → New → Activate → email to user. Each link is single-use and time-limited.
- Migration from MobilePASS Classic to MobilePASS+: SAS admin runs migration job; users receive new activation link via email. Classic app does not migrate token in place.
- Mobile device theft: SAS console → Token → Revoke → user gets new enrollment. Old token immediately invalid.
- For audit: enrollment date + last used date visible in SAS reporting.

## 12. Related KB Articles
- `l1-vpn-ivanti-001` — Ivanti Secure Access connect (where you USE the token)
- `l1-mfa-001` — MFA setup / recovery (general)

## 13. Keywords / Search Tags
mobilepass, mobilepass+, mobilepass plus, safenet, gemalto, thales, otp, one-time password, totp, 6-digit code, soft token, hardware token replacement, rsa alternative, vpn token, sas, safenet authentication service, trusted access
