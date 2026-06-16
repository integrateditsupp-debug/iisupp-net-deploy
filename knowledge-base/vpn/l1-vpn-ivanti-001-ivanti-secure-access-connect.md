---
id: l1-vpn-ivanti-001
title: "Ivanti Secure Access (formerly Pulse Secure) — connect to corporate VPN, step by step"
category: vpn
support_level: L1
severity: high
estimated_time_minutes: 15
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS 12+", "iOS 15+", "Android 12+"]
tech_generation: current
year_range: "Pulse Secure rebranded to Ivanti Secure Access 2021; current as of 2026"
eol_status: "Current. Note: Ivanti VPN suffered major security incidents (CVE-2023-46805, CVE-2024-21887). Ensure client AND gateway are fully patched."
prerequisites: ["Ivanti Secure Access client installed", "Company-issued sign-in URL (https://vpn.<company>.com)", "Username + password + MFA (token / push)"]
keywords:
  - ivanti
  - pulse secure
  - secure access
  - vpn
  - ssl vpn
  - corporate network
  - remote access
  - mfa
  - pulse connect secure
  - rsa token
  - mobilepass
  - duo
  - okta verify
related_articles:
  - l1-vpn-001-cant-connect
  - l1-vpn-pulse-001-pulse-secure-legacy
  - l1-vpn-mobilepass-001-mobilepass-token-setup
  - l1-mfa-001-setup-recovery
escalation_trigger: "User locked out after 5 failed attempts, or gateway URL unreachable from multiple ISPs (likely gateway-side outage), or persistent certificate errors after fresh install."
last_updated: 2026-05-12
version: 1.0
---

# Ivanti Secure Access — connect to corporate VPN, step by step

## 1. Symptoms
User needs to connect to the company VPN to access internal apps (file shares, intranet sites, internal databases, company email on older setups). They've been told to use "Ivanti Secure Access" (or "Pulse Secure" if their company hasn't updated the name).

## 2. Likely Causes if it fails
1. Wrong sign-in URL.
2. Username or password wrong (especially after rotation).
3. MFA prompt missed or token expired.
4. Outdated client version — Ivanti has issued mandatory security updates several times in 2024-2026.
5. Local firewall or antivirus blocking the connection.
6. Captive portal (hotel / coffee shop Wi-Fi) intercepting the connection.
7. Gateway down (rare, but check first if multiple users affected).

## 3. Questions To Ask User
1. Do you have the Ivanti Secure Access app installed? (Windows: Start menu → search "Ivanti". macOS: Applications folder.)
2. What is the sign-in URL? (Should look like `https://vpn.<company>.com` or `https://remote.<company>.com`.)
3. What MFA method does your company use? (Push notification on phone, 6-digit code, hardware token, FIDO2 key?)
4. Are you on home Wi-Fi, public Wi-Fi, or hotspot?
5. Have you connected successfully from this device before, or is this the first time?

## 4. Step-by-Step Connection Instructions

### Windows 10 / 11

**Step 1 — Open Ivanti Secure Access.**
- Click **Start** menu → type `Ivanti` → press **Enter**.
- *(What you should see: A small window with a "Connections" panel. If you see "Pulse Secure" instead, that's the old name — same app.)*

**Step 2 — Add the connection (first time only).**
- Click the **+** (plus) button to add a new connection.
- **Name:** type anything memorable, e.g., `Work VPN`.
- **Server URL:** type your company's sign-in URL exactly: `https://vpn.<company>.com`
- Click **Add**.
- *(What you should see: New row appears in the Connections list with the name you typed.)*

**Step 3 — Connect.**
- Click your VPN entry → click **Connect**.
- *(What you should see: A sign-in dialog asking for your username and password.)*

**Step 4 — Enter credentials.**
- **Username:** your company username (often your email or `firstname.lastname`).
- **Password:** your company password.
- Click **Connect**.
- *(What you should see: A second dialog asking for MFA — either a 6-digit code OR a push notification on your phone.)*

**Step 5 — Approve MFA.**
- **If push:** open the authenticator app on your phone (MobilePASS+, Microsoft Authenticator, Okta Verify, Duo) → tap **Approve**.
- **If 6-digit code:** open the authenticator app → read the current 6-digit code → type it into Ivanti → press **Enter**.

**Step 6 — Confirm connected.**
- *(What you should see: A green check mark or "Connected" status. A small lock icon appears in your system tray.)*
- The VPN status indicator in the system tray turns green / shows a key icon.
- Open a browser → try the internal URL your IT team gave you (e.g., `https://intranet.<company>.local`) → it loads.

### macOS

**Step 1 — Open Ivanti Secure Access.**
- Click **Applications** folder → **Ivanti Secure Access.app**.

**Step 2 — Add connection (first time).**
- File menu → **New Connection** → fill in **Name** + **Server URL**.

**Step 3-6:** Same as Windows above (Connect → username → password → MFA → confirm).

### iPhone / iPad (iOS)

**Step 1 — Install from App Store.**
- App Store → search **Ivanti Secure Access**.

**Step 2 — Open + add connection.**
- Plus icon → enter Name + URL.

**Step 3 — Allow VPN configuration.**
- iOS prompts: "Ivanti Secure Access Would Like to Add VPN Configurations" → **Allow** → Face ID / Touch ID / passcode.

**Step 4 — Connect + sign in + MFA as on Windows.**

### Android

**Step 1 — Install from Google Play.**
- Play Store → **Ivanti Secure Access Client** by Ivanti.

**Step 2-4:** Same as iOS pattern.

## 5. Common Errors and Fixes

**"Cannot connect to the gateway"**
- Try a different network (mobile hotspot from your phone). If it works on hotspot but not Wi-Fi, your Wi-Fi has a captive portal — open a browser and complete the captive portal sign-in, then retry VPN.

**"Invalid credentials"**
- Make sure CapsLock is off.
- Try signing in to a company web app (e.g., webmail) with the same credentials. If that fails, your password may have expired — reset it first.

**"Certificate error" / "The server certificate is not trusted"**
- Do NOT click "Continue anyway." This is a security warning. Close the app. Run Windows Update to install the latest root certificates. Update Ivanti Secure Access to the latest version.

**"MFA timeout"**
- Restart the connection attempt. Have your phone unlocked and the authenticator app open before clicking Connect.

**Connected but internal sites don't load**
- Check that the company applied "tunnel all traffic" or "split tunnel" correctly. Run `ipconfig` on Windows (or `ifconfig` on Mac/Linux) → look for an extra adapter showing the VPN-assigned IP (often starts with `10.` or `172.`). If missing, the tunnel didn't establish — disconnect and reconnect.

## 6. Verification Steps
- System tray (Win) or menu bar (Mac) shows Ivanti connected icon.
- You can reach an internal URL that doesn't work without VPN.
- `ipconfig` (Win) or `ifconfig` (Mac/Linux) shows a VPN adapter with a company-issued IP.

## 7. When to Call IT vs Self-Serve

**Self-serve (try these first, in order):**
- Restart Ivanti Secure Access.
- Restart the computer.
- Try mobile hotspot to rule out network issue.
- Check authenticator app is showing current codes (clock sync).
- Try a different known-working internal URL.

**Call IT (don't self-fix):**
- Account locked after multiple attempts.
- Certificate errors that persist after client update.
- Repeated MFA failures even with correct codes.
- "Your account is not allowed to use this application" — likely group / conditional access policy.
- Brand new device that's never connected before — IT may need to pre-register.
- VPN connects but you can't reach the ONE specific app you need (could be ACL / firewall on the gateway).

## 8. Prevention Tips
- **Keep the Ivanti client updated.** Open the app → Help → Check for Updates monthly.
- **Save credentials securely** in a password manager (1Password, Bitwarden, your company's standard tool).
- **Practice on a slow day** — don't wait until you're traveling on a tight deadline to discover your VPN doesn't work.

## 9. User-Friendly Explanation
The VPN is the secure tunnel that lets you reach company files and apps when you're not at the office. Open the Ivanti app, click Connect, sign in with your work password, then approve the prompt on your phone. Once you see the green "Connected" badge, you can use company sites the same as if you were at your desk. If you get stuck, restart the app and try again — most of the time that fixes it.

## 10. Internal Technician Notes
- Ivanti Connect Secure (gateway product) and Ivanti Secure Access Client (endpoint) are paired.
- Critical CVEs to monitor: CVE-2023-46805 (auth bypass), CVE-2024-21887 (command injection), CVE-2024-22024 (XXE) — all need gateway patches applied.
- Client install logs: Windows `%LocalAppData%\Pulse Secure\Logs\` (path retained from old name), macOS `~/Library/Logs/Pulse Secure/`.
- Multi-host group with role-based access: typically configured at gateway, user sees only the connection name.
- For Mac users with kernel extension prompts: macOS 11+ requires Ivanti's system extension to be approved in System Settings → Privacy & Security → "Allow" button.
- Common Ahead-of-Time Compatibility: Ivanti released a native Apple Silicon build mid-2023. Old Intel-only builds will run under Rosetta but with worse battery.
- For users behind double NAT or strict carrier-grade NAT (CGNAT) on mobile: enable IPv6 in the gateway profile if available.

## 11. Related KB Articles
- `l1-vpn-001` — Can't connect to VPN (generic)
- `l1-vpn-pulse-001` — Pulse Secure (legacy name) reference
- `l1-vpn-mobilepass-001` — MobilePASS+ token setup
- `l1-mfa-001` — MFA setup and recovery

## 12. Keywords / Search Tags
ivanti, pulse secure, secure access, vpn, ssl vpn, corporate vpn, remote access, mfa, pulse connect secure, ica, ivanti connect secure, mobilepass, duo, okta verify, microsoft authenticator, rsa token
