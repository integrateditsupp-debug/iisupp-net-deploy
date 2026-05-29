---
id: l1-wifi-003
title: "Wi-Fi: connection keeps dropping or disconnecting intermittently"
category: wifi
support_level: L1
severity: medium
estimated_time_minutes: 15
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
prerequisites: []
keywords:
  - wifi dropping
  - wifi keeps disconnecting
  - intermittent wifi
  - wifi drops every few minutes
  - reconnects by itself
  - unstable wireless
  - wifi cuts out
  - keeps losing connection
  - flaky wifi
related_articles:
  - l1-wifi-001
  - l1-wifi-002
  - l2-networking-001
escalation_trigger: "Many users on the same AP/SSID drop together, drops correlate with DHCP lease renewals, or RF survey shows AP overload — that is an L2 wireless/network problem, not a single endpoint."
last_updated: 2026-05-26
version: 1.0
---

# Wi-Fi keeps dropping / disconnects intermittently

## 1. Symptoms
- Wi-Fi shows "Connected" then drops to "No internet" or disconnects entirely every few minutes, then comes back on its own.
- Teams/Zoom calls cut out briefly; downloads stall and resume.
- Signal bars fluctuate even when the laptop hasn't moved.
- Drops happen more often when the laptop wakes from sleep or moves between rooms.

## 2. Likely Causes
1. **Wi-Fi adapter power management** is turning the radio off to save battery (the single most common cause on Windows laptops).
2. **Band/channel steering** — the laptop keeps roaming between 2.4 GHz and 5 GHz, or between two access points with the same SSID, and drops during the hand-off.
3. **Weak / variable signal** from distance, walls, or interference (microwaves, 2.4 GHz cordless phones, USB 3 hubs).
4. **Outdated or crashing Wi-Fi driver.**
5. **Channel congestion** — too many networks on the same 2.4 GHz channel.
6. **DHCP lease too short or conflicting**, so the device briefly loses its IP.
7. Router/AP firmware bug or an overloaded access point (points to L2 if it's site-wide).

## 3. Questions To Ask User
1. Does it drop on a schedule (e.g., every few minutes) or randomly?
2. Does it only drop after the laptop sleeps, or while actively in use?
3. Does it happen everywhere, or only in one room / far from the router?
4. Do other devices (phone, a colleague's laptop) on the same Wi-Fi drop too?
5. Is the laptop on battery or plugged in when it drops?
6. Recent change — new router, moved desk, Windows update?

## 4. Troubleshooting Steps
1. **Check if other devices drop too.** If a phone on the same network is rock-solid, the problem is this laptop; if everything drops, it's the network (→ escalate).
2. **Plug in / disable battery saver.** If drops stop while plugged in, it's adapter power management (fix in §5).
3. **Move closer to the router** temporarily. If stable up close, it's a signal/range problem.
4. **Forget and reconnect** the network: Settings → Network & internet → Wi-Fi → Manage known networks → Forget → reconnect with the password.
5. **Reboot the laptop** to clear a stuck Wi-Fi service or driver.
6. **Reboot the home router** (unplug 30 seconds) if this is a home/remote worker.

## 5. Resolution Steps
**Windows — stop the adapter from powering down (most common fix):**
1. Device Manager → Network adapters → right-click your Wi-Fi adapter → Properties → **Power Management** tab → **uncheck** "Allow the computer to turn off this device to save power" → OK.
2. Settings → System → Power & battery → set Power mode to **Balanced** (not Best power efficiency) while troubleshooting.

**Windows — lock to the stronger band / stop roaming churn:**
1. Device Manager → Wi-Fi adapter → Properties → **Advanced** tab.
2. Set **Roaming Aggressiveness / Roaming Sensitivity** to **Low / 1**.
3. If 2.4 GHz is congested and 5 GHz reaches the desk, set **Preferred Band** to **5 GHz** (Prefer 5 GHz).

**Windows — refresh the driver:**
1. Device Manager → Wi-Fi adapter → right-click → Update driver → Search automatically.
2. If still flaky, download the latest driver from the **laptop maker's** support site (Dell/HP/Lenovo ship newer Wi-Fi firmware than Windows Update).

**Windows — clear a bad network stack (if drops persist):**
1. Open Command Prompt / PowerShell **as admin** and run, in order:
   - `netsh winsock reset`
   - `netsh int ip reset`
   - `ipconfig /flushdns`
2. Reboot.

**macOS — rebuild Wi-Fi settings:**
1. System Settings → Wi-Fi → Details → **Forget** the network → re-join.
2. If it keeps dropping: remove and re-add Wi-Fi in System Settings → Network, then reboot. (On older macOS, deleting the `SystemConfiguration` network preference files achieves the same — L2 task.)

## 6. Verification Steps
- Stay connected for a continuous 15-minute period (e.g., a Teams call) with no drop.
- `ping -t 8.8.8.8` (Windows) or `ping 8.8.8.8` (macOS) for 5 minutes shows no sustained timeouts.
- Signal stays steady when the laptop is at its normal desk location, on battery.

## 7. Escalation Trigger
- Multiple users / devices on the same SSID or access point drop at the same times.
- Drops line up with DHCP lease renewals or appear in the AP/controller logs.
- A site RF survey is needed (channel overlap, AP placement, co-channel interference).
- Adapter shows hardware errors (Code 43/10) after a clean driver reinstall — possible failing radio.
- → Escalate to **L2** for wireless infrastructure / driver-package / hardware diagnosis.

## 8. Prevention Tips
- Leave the Wi-Fi adapter's power-management off on desktops and docked laptops.
- For home/remote workers, recommend 5 GHz at the desk and keeping the router off the floor / away from microwaves.
- Keep Wi-Fi drivers current from the OEM tool, not just Windows Update.
- Avoid USB 3 hubs/SSDs directly beside the laptop on 2.4 GHz (they radiate 2.4 GHz noise).

## 9. User-Friendly Explanation
"Your laptop is connecting fine but then briefly letting go of the Wi-Fi — usually because Windows is powering the wireless chip down to save battery, or because it's hopping between two signals and stumbling on the hand-off. We'll stop it from powering down, point it at the stronger signal, and freshen the driver. That fixes the great majority of these. If your phone drops on the same network too, then it's the router or office Wi-Fi and we'll get the network team on it."

## 10. Internal Technician Notes
- Confirm power-management cause fast: `powercfg /requests` won't show it, but if drops stop on AC power it's almost certainly the NIC power CSP.
- Check roaming logs: Event Viewer → Applications and Services Logs → Microsoft → Windows → WLAN-AutoConfig (Operational) — disconnect reason codes pinpoint roaming vs. auth vs. signal.
- For managed fleets, a Wi-Fi power-management state can be enforced via Intune/GPO so end users can't re-enable it.
- 802.11r/k/v fast-roaming misconfig on the AP side causes synchronized drops — hand to L2 with the WLAN-AutoConfig export.
- `netsh wlan show interfaces` shows live RSSI / channel; below ~-70 dBm at the desk = range problem.

## 11. Related KB Articles
- l1-wifi-001 — Wi-Fi can't connect at all
- l1-wifi-002 — Connected but no internet
- l2-networking-001 — Deep network troubleshooting

## 12. Keywords / Search Tags
wifi dropping, wifi keeps disconnecting, intermittent wifi, wifi drops every few minutes, reconnects by itself, unstable wireless, wifi cuts out, keeps losing connection, flaky wifi, power management, roaming aggressiveness, 5ghz, wlan-autoconfig
