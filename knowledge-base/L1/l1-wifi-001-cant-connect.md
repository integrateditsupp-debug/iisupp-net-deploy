---
id: l1-wifi-001
title: "Wi-Fi: can't connect / shows 'no internet, secured' / yellow triangle"
category: wifi
support_level: L1
severity: high
estimated_time_minutes: 15
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
prerequisites: []
keywords:
  - wifi
  - wi-fi
  - no internet
  - no internet secured
  - yellow triangle
  - wireless not working
  - can't connect
  - dropped connection
related_articles:
  - l2-networking-001
  - l1-vpn-001
escalation_trigger: "Issue affects multiple users on same SSID, or network adapter shows error code 10/12/43, or DHCP exhaustion suspected"
last_updated: 2026-05-07
version: 1.0
---

# Wi-Fi: can't connect / no internet

## 1. Symptoms
- Wi-Fi connected, but yellow triangle/exclamation on icon.
- "No internet, secured" tooltip.
- Web pages don't load; ping fails.
- Connects then immediately disconnects.
- "Couldn't connect" / "Cannot connect to this network" error.
- Speed test shows <1 Mbps despite "good" signal.

## 2. Likely Causes
1. Router / AP issue (most common — restart fixes ~half).
2. ISP outage upstream of router.
3. DHCP didn't issue valid IP (169.254.x.x = APIPA = no DHCP).
4. DNS server unreachable (config or ISP).
5. Saved wrong password for SSID.
6. Wi-Fi driver glitch / outdated.
7. Captive portal not yet completed (hotel, airport, café).
8. Adapter disabled or in airplane mode.

## 3. Questions To Ask User
1. Are you at home, office, or public Wi-Fi?
2. Are other devices on the same Wi-Fi working?
3. What does the Wi-Fi icon look like (full bars / yellow / X)?
4. Have you connected to this network before successfully?
5. Did you change anything before it stopped (new router, password, OS update)?
6. Have you tried restarting your router?

## 4. Troubleshooting Steps
1. Toggle airplane mode ON → wait 10 seconds → OFF.
2. Forget the network: Settings → Network → Wi-Fi → Manage known networks → select SSID → Forget. Reconnect with password.
3. Restart router: power off 30 seconds → power on. Wait 2 minutes for full boot.
4. Check IP: Win+R → `cmd` → `ipconfig`. If "169.254.x.x" or "0.0.0.0", DHCP failed.
5. Renew lease: `ipconfig /release` then `ipconfig /renew`.
6. Flush DNS: `ipconfig /flushdns`.
7. Reset network stack:
   - `netsh winsock reset`
   - `netsh int ip reset`
   - Reboot.

## 5. Resolution Steps
**If APIPA (169.254.x.x):**
- Router restart fixes ~70%. If persists, check router DHCP scope (admin) or pool exhaustion (more devices than scope).

**If DNS-only failure (you can ping IPs but not load sites):**
1. Settings → Network → Wi-Fi → adapter properties → Edit DNS → Manual → IPv4: `1.1.1.1` and `8.8.8.8`.
2. `ipconfig /flushdns`.
3. Re-test web.

**If wrong password saved:**
- Forget + reconnect with correct password.

**If captive portal (hotel/airport):**
- Open browser → navigate to any HTTP site (try `neverssl.com`) → portal page should auto-redirect → log in.

**If driver:**
- Device Manager → Network adapters → Wi-Fi adapter → right-click Update driver → Search automatically.
- For Intel/Realtek, get latest from OEM support page.

**If adapter disabled:**
- Device Manager → adapter → Enable.
- Or: Settings → Network → adapter properties → Enable.
- Hardware Wi-Fi switch / Fn-key combo: re-enable.

## 6. Verification Steps
- `ipconfig` shows valid IP (not 169.254.x.x), valid gateway.
- `ping 1.1.1.1` succeeds (network).
- `ping google.com` succeeds (DNS).
- Web pages load in browser.
- Speedtest.net within 70% of expected plan speed.

## 7. Escalation Trigger
- Network adapter shows code 10/12/43 in Device Manager (driver/hardware).
- Multiple users on same SSID/AP all affected.
- Reset commands return errors.
- Driver update doesn't take or repeats failure.
- ISP modem light pattern indicates outage.
- → Escalate to **L2** with: `ipconfig /all` output, signal strength, AP name/MAC, router make/model, when last working.

## 8. Prevention Tips
- Reboot home router monthly.
- Keep Wi-Fi driver current via OEM update tool.
- Don't auto-connect to public networks.
- For corporate, use 5 GHz band where available — less congestion.
- Avoid placing router in metal cabinet, near microwaves, or near baby monitors.

## 9. User-Friendly Explanation
"Your Wi-Fi sees the network but the connection isn't fully working. Most often it's the router needing a restart, or your computer's network settings got tangled. We'll restart what needs restarting, refresh the connection, and confirm you can actually load websites. If your Wi-Fi card itself is acting up, we'll update its driver."

## 10. Internal Technician Notes
- `netsh wlan show interfaces` — current SSID, BSSID, signal, RX/TX rate.
- `netsh wlan show profiles` — saved networks; `netsh wlan show profile name="X" key=clear` reveals stored password (admin context, audit-loggable).
- For repeated APIPA → packet capture at AP shows whether DHCP DISCOVER reaches and OFFER returns.
- For captive portal that won't show: try `http://1.1.1.1/cdn-cgi/trace` — Cloudflare's HTTP target dodges HSTS issues.
- Code 10 in Device Manager = driver failed to start; code 12 = resource conflict; code 43 = device reported failure. Each has different fix paths.
- For Mac users, `wdutil info` shows everything in one go (since macOS 14).

## 11. Related KB Articles
- l1-vpn-001 — VPN connection issues
- l2-networking-001 — Network troubleshooting deep dive

## 12. Keywords / Search Tags
wifi, wi-fi, no internet, secured, yellow triangle, wireless not working, can't connect, dropped, dns
