---
id: l1-vpn-anyconnect-001
title: "Cisco AnyConnect / Cisco Secure Client — connect to corporate VPN, step by step"
category: vpn
support_level: L1
severity: high
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS 12+", "iOS 15+", "Android 12+", "Linux"]
tech_generation: current
year_range: "Cisco AnyConnect rebranded to Cisco Secure Client 2022. Both names in use 2026."
eol_status: "Current. Use Cisco Secure Client 5.1+ for current security baseline."
prerequisites: ["AnyConnect / Secure Client installed", "VPN server hostname (e.g., vpn.<company>.com)", "Credentials + MFA"]
keywords:
  - cisco anyconnect
  - cisco secure client
  - anyconnect
  - cisco vpn
  - asa
  - cisco firepower
  - umbrella
  - duo
related_articles:
  - l1-vpn-001-cant-connect
  - l1-vpn-generic-001-when-to-call-vs-self-fix
  - l1-mfa-001-setup-recovery
escalation_trigger: "Connection attempts repeatedly fail with 'login failed' despite correct credentials. Or 'untrusted server certificate' that persists after client update."
last_updated: 2026-05-12
version: 1.0
---

# Cisco AnyConnect / Cisco Secure Client — connect to corporate VPN

## 1. Symptoms
User needs to connect to corporate VPN using Cisco's client. Older docs say "AnyConnect"; newer say "Cisco Secure Client" — same product since 2022.

## 2. Step-by-Step Connection

### Windows

**Step 1 — Open Cisco Secure Client.**
- Start menu → search **Cisco Secure Client** (or **Cisco AnyConnect**) → open.
- *(What you should see: A small panel with a single text field labeled "Ready to connect" or similar.)*

**Step 2 — Enter VPN server.**
- In the text field, type the VPN server hostname IT gave you (e.g., `vpn.<company>.com`).
- Click **Connect**.

**Step 3 — Sign in.**
- Username + password in the popup.
- Some companies use SAML — a browser opens for sign-in.
- MFA: 6-digit code from token app, OR Duo push (tap **Approve** on phone).

**Step 4 — Confirm connected.**
- Status panel shows **Connected**.
- A lock icon appears on the Cisco Secure Client tray icon.

### macOS / iOS / Android / Linux

Same flow. macOS first-time install requires Privacy & Security approval for system extension.

## 3. Common Errors and Fixes

**"Login failed. The VPN server returned an error."**
- Username format: some servers want `domain\username` or `username@domain`, others just `username`. Check your IT documentation.
- Try webmail with same credentials to confirm password.

**"The secure gateway has rejected the connection attempt — no assigned address"**
- VPN pool may be full (rare). Wait 5 min and retry.
- Account may not be in the right group. Call IT.

**"Certificate validation failure"**
- Update Cisco Secure Client to latest. Run Windows Update for current root CAs.

**Duo push not arriving**
- Open Duo Mobile app manually → check for pending requests.
- Make sure phone has data / Wi-Fi.
- Toggle airplane mode off/on.

**"Connection attempt failed. Please try again"**
- Generic error — retry. If persistent: restart Cisco Secure Client (right-click tray icon → Quit, then reopen).

## 4. Verification Steps
- Tray icon shows lock / connected indicator.
- Internal site loads.
- `ipconfig /all` shows Cisco AnyConnect Virtual Miniport Adapter with company IP.

## 5. When to Call IT
- Persistent login failures despite correct password.
- "No license available" — Cisco licenses are per-user; IT may need to free one.
- "VPN service not running" — system service issue, IT needs to repair install.
- Brand new device.

## 6. Prevention Tips
- Keep client updated (Cisco Secure Client → Settings → Check for Updates).
- Have Duo / authenticator app ready BEFORE clicking Connect.

## 7. User-Friendly Explanation
Cisco Secure Client (older name "AnyConnect") is your VPN. Open it, type your work VPN address, sign in, and approve the prompt on your phone. Once it says "Connected," company sites and apps work the same as if you're at the office.

## 8. Internal Technician Notes
- Modules: Core VPN, ISE Posture, NAM, Umbrella, AMP Enabler, Network Visibility — install only what's needed.
- ASA vs Firepower head-end: same client, different config back-end. Some features (e.g., Always-On) require specific licensing tiers.
- Profile XML deployed via ASDM / FMC and pushed to client on connect. Local edits get overwritten.
- macOS notarization: Cisco Secure Client signed and notarized. Old AnyConnect builds (4.x) NOT notarized — fail on macOS 14+. Must upgrade.
- Log location: Win `%PROGRAMDATA%\Cisco\Cisco AnyConnect Secure Mobility Client\Logs\` (path retained); Mac `~/Library/Logs/Cisco/`.
- Diagnostic bundle: tray icon → Open Cisco Secure Client → gear icon → Diagnostics → Generate.

## 9. Related KB Articles
- `l1-vpn-001` — Can't connect generic
- `l1-vpn-generic-001` — When to call IT
- `l1-mfa-001` — MFA setup

## 10. Keywords / Search Tags
cisco anyconnect, cisco secure client, anyconnect, cisco vpn, asa, cisco firepower, umbrella, duo, ise posture, nam, amp enabler
