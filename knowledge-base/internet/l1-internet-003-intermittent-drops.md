---
id: l1-internet-003
title: "Internet drops randomly — intermittent disconnects"
category: networking
support_level: L1
severity: high
estimated_time_minutes: 25
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS 12+", "iOS 15+", "Android 12+"]
tech_generation: current
year_range: "Current"
eol_status: "Current"
prerequisites: []
keywords:
  - internet drops
  - intermittent
  - disconnects
  - drops randomly
  - flaky internet
  - wifi drops
  - keeps disconnecting
  - modem reboot loop
related_articles:
  - l1-internet-001-no-internet-at-all
  - l1-internet-002-slow-but-connected
  - l1-wifi-001-cant-connect
escalation_trigger: "Modem reboots itself randomly (logs show power-cycle events with no user action) → hardware failure, ISP must replace. Or multiple devices in the office drop simultaneously several times per day → likely AP / switch issue, escalate to L2."
last_updated: 2026-05-12
version: 1.0
---

# Internet drops randomly — intermittent disconnects

## 1. Symptoms
Internet works for 5-30 minutes then drops for 30 seconds to a few minutes. Comes back without manual action. Video calls disconnect. Cloud apps lose sync. Often "fine" by the time you check.

## 2. Likely Causes
1. **Modem signal levels marginal** — close to spec limit but crossing it occasionally.
2. **Router overheating** — common in summer or when router is in a cabinet.
3. **Wi-Fi channel congestion** — neighbors' Wi-Fi keeps drowning yours.
4. **Faulty cable** — passes basic tests but fails under load / vibration / heat.
5. **DNS caching weirdness** — first request hangs, others work.
6. **ISP line work** in your area (sometimes scheduled, sometimes not).
7. **Wi-Fi adapter driver bug** on the device.
8. **Power adapter on router** failing intermittently.

## 3. Questions To Ask User
1. Which devices drop? Just one or multiple?
2. Wi-Fi or wired or both?
3. Time of day? (Evenings often = neighborhood congestion. Mid-afternoon = peak temps = overheating.)
4. Anything trigger it? (Specific app, large download, video call?)
5. How long has this been happening?

## 4. Step-by-Step Diagnosis

### Step 1 — Multi-device vs single
- Are multiple devices in the house dropping at the same time?
- **All devices drop simultaneously** → network (modem/router/ISP) issue.
- **Only one device** → that device's adapter / drivers / settings.

### Step 2 — Wired vs Wi-Fi
- If only Wi-Fi drops, wired is rock solid → Wi-Fi issue.
- If wired also drops → ISP or modem.

### Step 3 — Check modem signal stability (cable internet)
1. Log into router/modem admin page (192.168.0.1 or 192.168.100.1 for modem-only).
2. Look for **Event Log** or **System Log**.
3. Look for entries like:
   - "T3 timeout"
   - "T4 timeout"
   - "RNG REQ timeout"
   - "DHCP RENEW WARNING"
   - Power-cycle events not initiated by you
- Multiple T3/T4 timeouts in a day = unstable upstream signal. Call ISP, line issue.

### Step 4 — Router heat / power test
- Touch the top of the router (carefully — should be warm but not hot enough to be uncomfortable).
- Router in a closed cabinet? Move it out.
- Power adapter / brick — is it warm? Power adapters can fail intermittently. Swap with a replacement if available.

### Step 5 — Cable check
- Both Ethernet (modem to router) and coax (wall to modem):
  - Unplug both ends, inspect connector for damage / bent pins.
  - Re-seat firmly until click.
- If you have a spare cable, swap with it for a few hours. Fixed = old cable was bad.

### Step 6 — Wi-Fi channel scan
- Use an app: **WiFi Analyzer** (Android free), **NetSpot** (Mac/Win free tier), **Wi-Fi Analyzer** (Windows store).
- On 2.4 GHz: identify which channels have the LEAST overlap with your neighbors' Wi-Fi. Use channels 1, 6, or 11.
- On 5 GHz: pick a channel range that's quiet. Auto setting usually does fine, but if you see lots of competitors, override.
- Router admin → Wireless → Channel → manually pick → Save. Reboot router.

### Step 7 — Wi-Fi adapter driver (single device dropping)
- **Windows:** Device Manager → Network adapters → right-click your Wi-Fi → Update driver. Or visit laptop maker's support site (Dell, HP, Lenovo) for latest Wi-Fi driver — it's often newer than what Windows Update offers.
- **macOS:** Wi-Fi driver bundled with OS — update macOS via Software Update.
- After update, restart and test.

### Step 8 — Wi-Fi power management (Windows)
- Device Manager → Network adapters → right-click Wi-Fi → Properties → Power Management tab.
- UNcheck "Allow the computer to turn off this device to save power."
- OK. Restart.
- *This causes random Wi-Fi drops on many laptops when idle.*

### Step 9 — Ping monitor (proves the drop)
- Open command prompt / terminal.
- **Windows:** `ping -t 1.1.1.1`
- **Mac/Linux:** `ping 1.1.1.1`
- Leave running. When internet drops, you'll see "Request timed out" lines. When it comes back, replies resume.
- Note time/duration of each drop. Pattern (every X minutes? Triggered by something?) gives the diagnosis.

### Step 10 — Check ISP status
- Like Step 6 of internet-001 KB — outage in your area?

## 5. Verification Steps
- 24-hour ping monitor with < 1% packet loss.
- Video call lasts 30+ minutes without dropping.
- Modem log clean (no T3/T4 events).

## 6. When to Call ISP
- Modem log shows repeated T3/T4 timeouts → line conditioning / drop replacement needed.
- Modem reboots itself (without your action) more than once a week.
- Multiple devices in the home drop simultaneously several times per day, and the modem is < 5 years old.
- ISP has noted area issue (call them, they may already see it).

## 7. When to Call Office IT
- Multiple staff report drops at the same times of day → AP / switch issue.
- VPN drops mid-session (different KB — `l1-vpn-generic-001`).
- Only office Wi-Fi affected, not personal cellular.

## 8. Prevention Tips
- **Ventilate your router.** Out of cabinets, off the floor (dust intake).
- **Replace cables every 5-7 years** even if they look fine.
- **Modem age:** if > 5 years and unstable, replace (own or ISP-rent).
- **Keep firmware updated** — set router to auto-update if available.
- **Monitor with a Smokeping or similar** if you're tech-savvy and want hard data.

## 9. User-Friendly Explanation
Random drops are usually one of three things: a flaky cable connection (re-seat them), Wi-Fi channel congestion (switch channels), or a modem signal issue (check the modem logs). Run a continuous ping in a terminal window so you can see when it drops, and check the modem's status page when it does. If you find T3/T4 timeouts, call the ISP — they need to fix the line.

## 10. Internal Technician Notes
- T3 timeout = upstream MAC management failure (cable modem can't sync).
- T4 timeout = downstream sync loss.
- Both indicate physical layer issues — bad splitter, water in line, loose F-connector at amp, neighborhood plant issue.
- Channel bonding: DOCSIS 3.0+ bonds 24+ channels. Losing one or two won't drop the connection, but losing 5+ will.
- Wi-Fi DFS (Dynamic Frequency Selection) channels (5 GHz upper) require radar checks — connection can drop briefly when radar detected. Common near airports, military bases. Disable DFS channels in router config if this is the cause.
- For office: configure 802.11k/v/r on multi-AP setups for fast roaming. Without it, devices "stick" to a weak AP instead of switching.
- Mesh systems: backhaul over wireless can drop under load. Ethernet backhaul for stationary nodes is much more stable.

## 11. Related KB Articles
- `l1-internet-001` — No internet at all
- `l1-internet-002` — Slow but connected
- `l1-wifi-001` — Wi-Fi can't connect

## 12. Keywords / Search Tags
internet drops, intermittent, disconnects, drops randomly, flaky internet, wifi drops, keeps disconnecting, modem reboot, t3 t4 timeout, docsis, channel congestion, dfs, power management
