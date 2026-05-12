---
id: l1-internet-001
title: "No internet at all — total outage, home or office"
category: networking
support_level: L1
severity: critical
estimated_time_minutes: 20
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS 12+", "iOS 15+", "Android 12+"]
tech_generation: current
year_range: "Current"
eol_status: "Current. Applies to any consumer or small-business internet connection."
prerequisites: []
keywords:
  - no internet
  - internet down
  - cant connect
  - outage
  - isp down
  - modem
  - router
  - restart router
  - power cycle
  - wifi no internet
  - ethernet no internet
related_articles:
  - l1-wifi-001-cant-connect
  - l1-internet-002-slow-but-connected
  - l1-internet-003-intermittent-drops
  - l1-vpn-generic-001-when-to-call-vs-self-fix
escalation_trigger: "After 30 minutes of self-fix attempts, internet is still down AND mobile hotspot from a different carrier also has issues (regional outage). Or if your business has an SLA with the ISP — call them immediately."
last_updated: 2026-05-12
version: 1.0
---

# No internet at all — total outage, home or office

## 1. Symptoms
- Browser: "This site can't be reached" / "No internet" on every site.
- Apps: "No network connection" everywhere.
- Phone Wi-Fi icon shows but a warning triangle or X.
- Windows: yellow triangle on the network icon. macOS: Wi-Fi icon with exclamation.

## 2. Likely Causes (most common first)
1. **Modem / router got stuck** — fix: power cycle.
2. **ISP outage** — fix: call ISP / use mobile data temporarily.
3. **Loose cable** — fix: re-seat physical cables.
4. **Captive portal not signed in** (hotel, coffee shop) — fix: open browser to any HTTP site (use `http://neverssl.com`), captive portal will redirect.
5. **DNS issue** — fix: change DNS to Cloudflare 1.1.1.1 or Google 8.8.8.8.
6. **Computer NIC / driver issue** — fix: disable + re-enable network adapter.
7. **VPN client stuck in disconnect state** — fix: quit VPN client.
8. **Antivirus / firewall blocking** — fix: temporarily disable to test.

## 3. Questions To Ask User
1. Is internet down on ONE device or ALL devices?
2. Wi-Fi or wired (Ethernet)?
3. Home or office?
4. Did this start suddenly or has it been intermittent?
5. Anything new — new ISP, new router, new modem?
6. Can you reach your router's admin page (usually 192.168.0.1 or 192.168.1.1)?

## 4. Step-by-Step Self-Fix

### Step 1 — Check if it's just one device or all
- Try a phone connected to the SAME Wi-Fi network.
- **If phone has internet but computer doesn't** → computer-specific. Skip to Step 7.
- **If neither has internet** → it's the network. Continue Step 2.

### Step 2 — Restart the router and modem (the "power cycle")
This single step fixes about 50% of total outages.

1. Find the **modem** (the box from the ISP — usually has cable / DSL / fiber input) and the **router** (Wi-Fi box). They may be the same device.
2. **Unplug BOTH power cables** from the wall.
3. Wait **30 seconds**. Yes, the full 30. Capacitors discharge, internal state clears.
4. Plug the **modem** back in first.
5. Wait until ALL lights on the modem are solid green (about **2-3 minutes**) — typically Power, Cable/DSL/Fiber, Online/Internet, no flashing.
6. Plug the **router** back in.
7. Wait another **2 minutes** for it to broadcast Wi-Fi.
8. Reconnect your devices. Test.

*(What you should see: Lights on the modem go through a startup sequence — Power solid, then Receive/Send flashing then solid, then Online solid. Router's Wi-Fi indicator goes from off → blinking → solid.)*

### Step 3 — Check cables (if wired)
- Ethernet cable from modem to router: unplug both ends, plug back in firmly until you hear a **click**.
- Cable from wall to modem: same.
- Look for kinks or visible damage. A bad cable looks fine but fails.

### Step 4 — Try a captive portal (hotel / coffee shop / airport)
- Open a browser.
- Go to `http://neverssl.com` (must be `http://`, not `https://`).
- A sign-in page should pop up automatically. Sign in or accept terms.
- Now retry your sites.

### Step 5 — Change DNS (if reachable but DNS fails)
- Some ISP DNS servers fail randomly. Switch to a public DNS.
- **Windows:** Settings → Network & internet → Advanced network settings → click your active adapter → Edit DNS server assignment → Manual → IPv4 ON → Preferred DNS: `1.1.1.1` → Alternate: `8.8.8.8` → Save.
- **macOS:** System Settings → Network → click Wi-Fi → Details → DNS → click + → add `1.1.1.1` then `8.8.8.8` → OK.
- Restart browser. Test.

### Step 6 — Check ISP outage status
- Use phone with **mobile data (not Wi-Fi)** to check ISP status:
  - **United States:** https://downdetector.com → search your ISP.
  - **Canada:** Bell / Rogers / Telus / Shaw / Cogeco status pages.
  - **Or:** Tweet at your ISP — most respond fast.
- If outage confirmed: you've done all you can. Use mobile hotspot until restored.

### Step 7 — Computer-specific fix (when other devices work)
- **Windows:**
  1. Right-click network icon (tray) → Network and Internet settings.
  2. Network reset → Reset now → confirm. Computer restarts.
  3. After restart, reconnect Wi-Fi from scratch.
- **macOS:**
  1. System Settings → Network → Wi-Fi → Details → "Forget This Network."
  2. Re-connect from the Wi-Fi menu.
- Disable and re-enable VPN clients (Cisco / GlobalProtect / Ivanti / others) — sometimes stuck VPN routes block normal internet.
- Try a different browser. Chrome stuck? Try Firefox. Firefox stuck? Try Edge.
- Temporarily disable antivirus firewall — test for 60 seconds, then re-enable. (Some endpoint security products block traffic on a bad update.)

## 5. Verification Steps
- `https://www.google.com` and `https://www.cloudflare.com` both load.
- A speedtest at `https://speed.cloudflare.com` returns numbers.
- Multiple sites load, not just one (rules out single-site DNS issue).

## 6. When to Call ISP (Self-fix limit)
- Modem lights show **NO internet light** (or red light) after a 5-minute warm-up post power-cycle.
- ISP status page confirms outage in your area.
- You've done all 7 steps above and still nothing.
- You suspect a physical line issue (recent storm, construction work near the building).

**What to tell the ISP:**
1. Your account / phone number / address.
2. "Internet has been down since [time]."
3. "I've power-cycled the modem and router."
4. "The [internet / online / online send] light is [solid / blinking / off]."
5. Get a ticket number. Ask for an ETA.

## 7. When to Call Office IT (Not ISP)
- You're in the office and only office Wi-Fi is down (your phone hotspot still works).
- You're connecting to corporate Wi-Fi via 802.1X (certificate auth) and your cert may have expired.
- Office uses a custom DNS / proxy and you can't reach anything internal.

## 8. Prevention Tips
- **Reboot your modem and router monthly** — even when working. Memory leaks accumulate.
- **Buy your own modem (DOCSIS 3.1 or DOCSIS 4.0 for cable)** instead of renting from ISP. $200 once vs $15/month forever. Faster + more reliable.
- **Have a mobile hotspot fallback.** Phone hotspot OR a dedicated hotspot. Save your sanity during outages.
- **Note your router admin password** — keep it in a password manager.
- **Document your network setup** with a sketch: modem → router → switch → APs. Helps anyone (you, IT, ISP tech) troubleshoot fast.

## 9. User-Friendly Explanation
The most reliable internet fix is unplugging your modem and router for 30 seconds and plugging them back in — fixes about half of all outages. After that, check if it's just your computer (try your phone on the same Wi-Fi). If everything's down and it's not the router, your internet company probably has an outage — check their status page on your phone's cellular data. Worst case, call your ISP with your account info and the lights showing on the modem.

## 10. Internal Technician Notes
- Modem types: cable (DOCSIS 3.0 / 3.1 / 4.0), DSL (VDSL2 / G.fast), fiber (GPON / XGS-PON / 10G-EPON).
- Common modem statuses worth knowing:
  - **Power:** modem is powered on
  - **Cable / DSL / WAN:** physical line sync
  - **Receive (RX):** downstream signal locked
  - **Send (TX):** upstream signal locked
  - **Online / Internet:** IP address obtained (DHCP from ISP)
- If Power + sync lights are ON but Online is OFF → modem can talk to line but not getting IP. Could be: provisioning lapsed (ISP needs to reset), MAC ban, account suspension, region-wide DHCP problem.
- For office: check uplink switch port LEDs. Solid = link, blinking = traffic.
- Edge cases:
  - IPv6 enabled but DNS server only resolves IPv4 → some sites slow / fail. Test with `nslookup -type=AAAA google.com`.
  - MTU mismatch on PPPoE links → can browse small sites but big downloads stall. Fix by lowering MTU at router to 1492.
  - Captive portal stays open: DNS hijack to portal. Clear DNS cache `ipconfig /flushdns` (Win) or `sudo dscacheutil -flushcache` (Mac).
- Speedtest cli: `npx speedtest` or `cloudflare-speedtest`.

## 11. Related KB Articles
- `l1-wifi-001` — Wi-Fi specifically can't connect
- `l1-internet-002` — Slow but connected
- `l1-internet-003` — Intermittent drops
- `l1-vpn-generic-001` — When VPN is the cause

## 12. Keywords / Search Tags
no internet, internet down, can't connect, outage, isp down, modem, router, restart router, power cycle, wifi no internet, ethernet no internet, captive portal, dns, 1.1.1.1, 8.8.8.8, downdetector
