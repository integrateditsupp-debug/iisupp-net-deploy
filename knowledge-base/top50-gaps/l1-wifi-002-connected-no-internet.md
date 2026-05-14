---
id: l1-wifi-002
title: "Wi-Fi says connected but no internet — fix in 3 minutes"
category: networking
support_level: L1
severity: high
estimated_time_minutes: 5
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS", "iOS", "Android"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
keywords:
  - wifi connected no internet
  - no internet secured
  - limited connectivity
  - browser cant reach site
  - dns probe failed
  - wifi works but websites dont
  - captive portal
  - guest wifi sign in
tags:
  - wifi
  - networking
  - top-50
related: [l1-wifi-001-cant-connect, l1-internet-001-no-internet-at-all, l1-internet-003-intermittent-drops]
---

# Wi-Fi connected, no internet

### Captive portal didn't show — open browser to any HTTP site

Most "connected but no internet" on coffee shop / hotel / airport Wi-Fi is captive portal. Open a browser → type `http://neverssl.com` (use HTTP not HTTPS — captive portal needs to intercept). Login page appears, accept terms, you're online. iPhone usually auto-detects but sometimes doesn't.

### Forget Wi-Fi and reconnect

Windows: Settings → Network & Internet → Wi-Fi → Manage known networks → click your network → Forget. Then reconnect, re-enter password. Mac: System Settings → Wi-Fi → Details next to network → Forget This Network. Reconnect. Fixes corrupted Wi-Fi profiles 50% of the time.

### Renew your IP address

Windows admin cmd: `ipconfig /release` then `ipconfig /renew`. Mac: System Settings → Network → Wi-Fi → Details → TCP/IP tab → "Renew DHCP Lease." iOS/Android: airplane mode on for 5 sec then off. If your machine has a 169.254.x.x address ("APIPA"), DHCP isn't giving you a real IP — restart your router or contact the network owner.

### Flush DNS — fixes "your DNS server might be unavailable"

Browser shows DNS_PROBE_FINISHED_NXDOMAIN or "cannot find server." Windows admin cmd: `ipconfig /flushdns`. Mac: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder` in Terminal. Restart browser, retry. If still broken, try a public DNS — Settings → set DNS to 1.1.1.1 (Cloudflare) or 8.8.8.8 (Google).

### Restart the router (for home Wi-Fi)

If you control the router: unplug power, wait 60 seconds, plug back. Full reboot takes 2-3 minutes (DSL/cable modems even longer). Reconnect after lights go green. Most "intermittent no-internet" is router-side after days of uptime. Schedule monthly reboot if it's chronic.

### VPN connected but internet dead

VPN is routing everything through a broken tunnel. Disconnect VPN, test internet without it. If works, the VPN profile or gateway is the issue — see KB l1-vpn-007 for VPN-connected-no-resources or L2 for VPN routing fix.

### Date/time wrong → HTTPS sites fail

If your clock is way off, every HTTPS site refuses to load with cert errors. Windows Settings → Time & language → Date & time → "Set automatically" ON. Mac System Settings → General → Date & Time → "Set automatically" ON. Restart browser after fix.

### Test if it's a website-specific issue

If only one site is unreachable, others fine — that site is down (not you). Try downforeveryoneorjustme.com to check. If multiple major sites down but Wi-Fi shows connected, your DNS or VPN is the issue (Steps above).

### When to escalate to L2

All steps tried, no internet on this network specifically but mobile hotspot works → corporate Wi-Fi / NAC blocking your device → L2. Same network works on phone but not laptop → laptop driver or profile → L2. Whole office can't reach internet → ISP outage or perimeter firewall, IT escalates upstream.
