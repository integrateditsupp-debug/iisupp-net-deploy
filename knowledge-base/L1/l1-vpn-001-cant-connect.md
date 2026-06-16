---
id: l1-vpn-001
title: "VPN won't connect / disconnects randomly"
category: vpn
support_level: L1
severity: high
estimated_time_minutes: 15
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
prerequisites: []
keywords:
  - vpn
  - won't connect
  - vpn disconnects
  - vpn timeout
  - cisco anyconnect
  - globalprotect
  - fortinet
  - openvpn
  - always on vpn
related_articles:
  - l2-vpn-001
  - l1-wifi-001
escalation_trigger: "Multiple users in same office / region cannot connect, or certificate revoked, or VPN gateway error reported by client"
last_updated: 2026-05-07
version: 1.0
---

# VPN won't connect / disconnects randomly

## 1. Symptoms
- VPN client shows "Connecting..." indefinitely.
- "Authentication failed" or "Login failed".
- Connects then drops within minutes.
- "VPN is unreachable" / "Cannot contact gateway".
- Connects but corporate resources still inaccessible.
- Certificate error.

## 2. Likely Causes
1. Wrong username/password (or post-password-change client cache).
2. MFA not approved on phone.
3. Network blocking VPN (hotel, public Wi-Fi, geographic).
4. Client outdated.
5. Certificate expired (machine or user).
6. VPN gateway under load / outage.
7. Corporate firewall regional rules blocking user's source IP.
8. Split-tunnel routing not picking up corporate routes.
9. Local DNS preventing gateway resolution.

## 3. Questions To Ask User
1. Which VPN client (AnyConnect, GlobalPalo Alto, Fortinet, OpenVPN, Always-On)?
2. Does it fail at "Connecting", at sign-in, or after connecting?
3. What error message exactly?
4. Are you on home Wi-Fi, mobile hotspot, or public Wi-Fi?
5. Did you change your password recently?
6. Does the VPN icon in system tray show green/red/yellow?

## 4. Troubleshooting Steps
1. Try a different network — mobile hotspot is the cleanest test (no firewall interference).
2. Restart the VPN client (quit fully, reopen).
3. Reboot the device.
4. Test gateway resolution: `nslookup vpn.company.com` — should return an IP.
5. Test reachability: `ping vpn.company.com` (often blocked by gateway, but DNS resolution alone is informative).
6. Try connecting via web portal (e.g., GlobalProtect web portal) if available.

## 5. Resolution Steps
**Authentication issue:**
- Sign in to https://office.com first to confirm password works for cloud.
- Approve any MFA prompt on phone.
- Update VPN client to latest version.

**Network blocking:**
- Switch to mobile hotspot to confirm.
- For public Wi-Fi, complete captive portal first, then try VPN.
- Disable IPv6 temporarily if VPN client doesn't handle dual-stack: Network adapter → Properties → uncheck IPv6.

**Certificate issue:**
- For corporate device cert: connect on corporate LAN once to refresh; or contact L2 to push new cert.
- For user cert: re-enroll via portal.

**DNS resolution failure:**
- Switch DNS to 1.1.1.1 / 8.8.8.8 → retry.

**Split-tunnel routes wrong:**
- After connect, run `route print` (Windows) → corporate subnets should appear via VPN tunnel adapter.
- If missing, reconnect; persistent fix from L2 (gateway config).

**Reinstall:**
- Settings → Apps → uninstall VPN client → reinstall current version from corporate portal or vendor.

## 6. Verification Steps
- VPN client shows green / "Connected".
- Internal site (e.g., intranet.company.com) loads.
- File share / printer accessible.
- Speed acceptable (within 70% of base ISP, allowing for VPN overhead).
- Connection holds 30+ minutes idle.

## 7. Escalation Trigger
- Multiple users in same office / region all failing.
- VPN gateway returns specific error code.
- Certificate revoked or expired and reissue requires admin.
- Always-On VPN profile policy not deploying.
- → Escalate to **L2** with: client version, exact error, attempted gateway, source IP, time, screenshot.

## 8. Prevention Tips
- Keep VPN client auto-updating.
- Always use MFA-protected accounts.
- Don't share corporate VPN credentials across people.
- Reboot device weekly — keeps cert and policy fresh.
- For frequent travelers, install vendor's "VPN Diagnostic" tool — saves time on remote support.

## 9. User-Friendly Explanation
"The VPN is the secure tunnel back to your company's network. If it can't connect, it's usually one of three things: your password got out of sync, your network is blocking it, or the security certificate needs refreshing. We'll try the simplest fixes first — different network, fresh sign-in, restart the client — and most of the time you're back on in five minutes."

## 10. Internal Technician Notes
- Cisco AnyConnect logs: `%programdata%\Cisco\Cisco AnyConnect Secure Mobility Client\` → `vpnui.txt`, `vpnagent.txt`.
- GlobalProtect logs: `%localappdata%\Palo Alto Networks\GlobalProtect\Logs\`.
- Fortinet FortiClient logs: `%appdata%\Fortinet\FortiClient\Logs\`.
- For Always-On VPN (Windows): check `Get-VpnConnection -AllUserConnection`, GP/Intune profile state, and Trusted Network Detection.
- Cert validation: `certutil -store My` (user) / `certutil -store -enterprise NTAuth` for issuer trust chain.
- Common AnyConnect errors:
  - "Certificate validation failure" → expired cert chain.
  - "Login Denied" → bad creds or AAA denied at gateway.
  - "Failed to acquire IP" → DHCP scope full at gateway.
- For split-tunnel where some traffic is missing, dump `route print` and compare against corporate's expected subnets.

## 11. Related KB Articles
- l1-wifi-001 — Wi-Fi connection issues
- l2-vpn-001 — VPN gateway, certs, and Always-On profile management

## 12. Keywords / Search Tags
vpn, won't connect, disconnects, timeout, anyconnect, globalprotect, fortinet, openvpn, always on, certificate
