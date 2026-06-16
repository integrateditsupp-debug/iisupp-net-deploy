---
id: l1-vpn-globalprotect-001
title: "Palo Alto GlobalProtect — connect to corporate VPN, step by step"
category: vpn
support_level: L1
severity: high
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS 12+", "iOS 15+", "Android 12+", "Linux"]
tech_generation: current
year_range: "Current"
eol_status: "Current. Stay on GP client 6.2+ on Windows and 6.2+ on macOS for current security baseline."
prerequisites: ["GlobalProtect client installed (from IT or https://gpdownload.<company>.com)", "Portal hostname (e.g., gp.<company>.com)", "Sign-in credentials"]
keywords:
  - globalprotect
  - global protect
  - palo alto
  - pan
  - gp
  - prelogon
  - always-on
  - on-demand
  - user-logon
related_articles:
  - l1-vpn-001-cant-connect
  - l1-vpn-generic-001-when-to-call-vs-self-fix
  - l1-mfa-001-setup-recovery
escalation_trigger: "Portal authentication fails AND credentials work on webmail. Or HIP (Host Information Profile) check fails repeatedly (device compliance issue)."
last_updated: 2026-05-12
version: 1.0
---

# Palo Alto GlobalProtect — connect to corporate VPN, step by step

## 1. Symptoms
User has the GlobalProtect ("GP") client and needs to connect. May see a small globe / shield icon in the system tray or menu bar.

## 2. About GlobalProtect
- VPN client from Palo Alto Networks, paired with PA-Series next-gen firewalls.
- Three connection modes (set by IT):
  - **User-logon (recommended for office staff):** prompts to connect when you sign in.
  - **Pre-logon:** connects BEFORE Windows sign-in (for domain-joined laptops).
  - **On-demand:** user must explicitly click Connect.
- Performs a "HIP check" (Host Information Profile) on each connection: confirms antivirus is on, disk encryption enabled, OS patched, etc. If HIP fails, you connect but with restricted access (or no access depending on policy).

## 3. Questions To Ask User
1. Do you see a small **globe / shield icon** in your system tray (Win) or menu bar (Mac)?
2. What portal hostname were you given? (Often `gp.<company>.com` or `vpn.<company>.com`.)
3. What's your MFA method?

## 4. Step-by-Step Connection

### Windows

**Step 1 — Find GlobalProtect.**
- Look for a small globe icon in the system tray (lower-right, near the clock). Click it.
- *(If missing: Start menu → search "GlobalProtect" → open. If still missing → install from your IT portal.)*

**Step 2 — Enter portal.**
- The panel opens. Click **Sign In** (or it may auto-prompt).
- **Portal:** type the hostname you were given (e.g., `gp.<company>.com`). No `https://`. Hit **Connect**.

**Step 3 — Sign in.**
- Username + password.
- MFA prompt appears (push to phone, 6-digit code, or browser-based SAML).

**Step 4 — Wait for HIP check.**
- The client checks your device against company policy: AV running, disk encrypted, OS patches up to date, screen lock enabled.
- *(What you should see: A short progress indicator labeled "Checking..." then "Connected.")*

**Step 5 — Confirm connected.**
- Globe icon turns blue / shield with check mark.
- Right-click the icon → "Status" shows your assigned IP + connection time.

### macOS

Same flow. First-time install requires approval in System Settings → Privacy & Security → Allow GlobalProtect's system extension.

### Mobile (iOS / Android)

App Store / Play Store → install "GlobalProtect" by Palo Alto Networks → enter portal hostname → sign in → approve VPN profile when iOS prompts → connect.

## 5. Common Errors and Fixes

**"Cannot connect to portal" / "Portal unreachable"**
- Verify portal hostname exactly. Try opening `https://<portal-hostname>/global-protect/portal/portal.esp` in a browser — should show a Palo Alto-branded sign-in page.
- Try mobile hotspot — captive portal / ISP DPI may block.

**"Authentication failed"**
- Test the same credentials on webmail. If those fail too → password expired.
- For SAML auth: Allow popups for the portal hostname in your browser.

**"HIP check failed — restricted access"**
- Antivirus running and updated? Make sure Defender / CrowdStrike / SentinelOne is enabled.
- BitLocker (Win) or FileVault (Mac) enabled? IT may require disk encryption.
- Are all critical Windows / macOS updates installed? Run updates → reboot → retry.
- Screen lock enabled with short timeout? (Settings → Personalization → Lock screen → Screen timeout.)
- *If you don't know which check is failing:* right-click GP icon → Settings → Host Information Profile → see which item is red.

**"Sign-in completed but no internet through VPN"**
- Connection is split-tunnel — only certain traffic goes through VPN. Test the specific internal URL or IP you need.
- If everything should route through VPN ("tunnel-all" mode), and nothing reaches → escalate to IT (gateway policy issue).

## 6. Verification Steps
- GP icon shows connected status (blue / check).
- An internal-only URL loads in browser.
- `ipconfig /all` (Win) shows a PANGP adapter with company-issued IP.

## 7. When to Call IT
- HIP failed and you don't know what triggered it (sometimes the check looks for very specific AV signatures or patch versions).
- "Pre-logon" mode broke after a Windows update — needs config refresh.
- Multi-factor auth fails after correct codes — gateway policy or MFA provider issue.
- Brand new laptop hasn't been domain-joined / Entra-joined — pre-logon mode won't work without that.

## 8. Prevention Tips
- Keep GP client updated.
- Make sure Windows / macOS updates install promptly — HIP enforces these.
- Antivirus must be running — don't disable to "speed up" the computer.

## 9. User-Friendly Explanation
GlobalProtect is the VPN. Click the small globe icon at the bottom-right of your screen, sign in, and approve the prompt on your phone. The system also checks that your computer is up to date and has antivirus running — if any of those are off, the VPN connects but with limited access. Keep Windows updates and antivirus running and you'll never see that issue.

## 10. Internal Technician Notes
- Portal vs Gateway: portal authenticates + downloads config; gateway is the actual VPN tunnel endpoint. Multi-gateway deployments common.
- HIP profile XML pushed from Panorama / firewall. Update HIP profiles at the firewall, not at the client.
- Connection methods controlled by Portal config → Agent → User Login Settings.
- Pre-logon: requires machine certificate. Stored in LocalMachine cert store (Win) or system keychain (Mac). For Win, deploy via GPO/MDM. For Mac, via Jamf/Kandji/Intune profile.
- GP icon does not appear on Linux. Linux uses `globalprotect` CLI or `openconnect` with `--protocol=gp`.
- Log paths: Win `%PROGRAMDATA%\Palo Alto Networks\GlobalProtect\PanGPS.log` and `PanGPA.log`. Mac `/Library/Logs/PanGPS.log`.
- Common HIP fails: outdated AV definitions (rotation policy), disk encryption not enabled or not 100% complete, OS patch missing (specific KB).

## 11. Related KB Articles
- `l1-vpn-001` — Can't connect (legacy)
- `l1-vpn-generic-001` — When to call IT
- `l1-mfa-001` — MFA setup

## 12. Keywords / Search Tags
globalprotect, global protect, palo alto, pan, gp, hip, host information profile, prelogon, user-logon, on-demand, pangp, pan-os, pangps, pangpa
