---
id: l1-internet-002
title: "Internet is slow but connected — speed troubleshooting"
category: networking
support_level: L1
severity: medium
estimated_time_minutes: 20
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS 12+", "iOS 15+", "Android 12+"]
tech_generation: current
year_range: "Current"
eol_status: "Current"
prerequisites: []
keywords:
  - slow internet
  - slow wifi
  - speedtest
  - bandwidth
  - latency
  - buffering
  - lag
  - speed test
  - ookla
  - cloudflare speed test
  - mesh
  - extender
  - wifi signal
related_articles:
  - l1-internet-001-no-internet-at-all
  - l1-wifi-001-cant-connect
  - l2-network-legacy-001-wpa2-only-router-replacement
  - l1-network-be-001-wifi-7-rollout-compatibility
escalation_trigger: "Wired speed is more than 30% below the ISP's advertised plan AND modem signal levels are out of spec — escalate to ISP for line work."
last_updated: 2026-05-12
version: 1.0
---

# Internet is slow but connected — speed troubleshooting

## 1. Symptoms
Browser loads but slowly. Video calls glitch. Streaming buffers. Downloads crawl. Speed used to be faster.

## 2. Likely Causes
1. **Wi-Fi distance / interference** — you're far from the router or there's a microwave / Bluetooth headset / cordless phone nearby.
2. **Too many devices** competing for the same Wi-Fi.
3. **One device hogging bandwidth** (large download, cloud backup, game install).
4. **ISP throttling** (rare in 2026 but happens).
5. **Old router** (Wi-Fi 4 / 5 capping speeds far below your plan).
6. **DNS slowness.**
7. **VPN slowing things down** (VPN adds ~10-30ms latency, sometimes more).
8. **Outdated network drivers.**

## 3. Questions To Ask User
1. What internet plan are you paying for? (e.g., 500 Mbps cable, 1 Gbps fiber.)
2. Wired or Wi-Fi?
3. How far from the router?
4. How many devices in the house / office?
5. Is anyone running a backup, download, or stream right now?
6. Slow on all sites or one specific site?

## 4. Step-by-Step Diagnosis

### Step 1 — Run a speed test
- Go to `https://speed.cloudflare.com` (most accurate for varied measurements).
- Note three numbers:
  - **Download speed** (Mbps).
  - **Upload speed** (Mbps).
  - **Latency / ping** (ms).

### Step 2 — Compare to your plan
- Your ISP plan should match within 70-100% of the advertised speed when wired.
- 500 Mbps plan → expect 350-500 Mbps wired.
- On Wi-Fi: expect 50-70% of wired speed within 15 feet of a modern router. Drop sharply beyond.

### Step 3 — Test wired vs Wi-Fi
- Plug an Ethernet cable from the router directly to your laptop.
- Run speedtest again.
- **Wired fast, Wi-Fi slow** → Wi-Fi issue. Go to Step 4.
- **Both slow** → ISP / router issue. Go to Step 6.

### Step 4 — Wi-Fi triage
- Move closer to the router (within 10 ft, line-of-sight). Retest.
- Faster close-up? → distance / signal is the issue. Possible fixes:
  - Move router to a more central location.
  - Add a mesh node / Wi-Fi extender.
  - Replace ancient router with Wi-Fi 6 or Wi-Fi 7 mesh (see `l2-network-legacy-001`).
- Still slow close-up? → router configuration or radio issue.
  - Reboot router.
  - Switch your device to 5 GHz band (not 2.4 GHz). 2.4 GHz tops out around 50 Mbps in most homes due to interference.
  - 5 GHz band crowded? → try 6 GHz if your router and device support it.

### Step 5 — Wi-Fi interference
Common offenders:
- **Microwave oven** — kills 2.4 GHz Wi-Fi while running.
- **Older cordless phones** — 2.4 GHz / DECT 6.0.
- **Bluetooth speakers** when actively streaming heavy audio.
- **Baby monitors.**
- **Neighbors' Wi-Fi** on the same channel (apartments).
- **Solid walls / metal cabinets** between your device and the router.

### Step 6 — One-device hogging
- Open Task Manager (Win: Ctrl+Shift+Esc) → Performance tab → Wi-Fi or Ethernet.
- Watch for sustained high "Send" or "Receive" rates while you're not actively doing anything.
- Common culprits:
  - **Windows Update** downloading.
  - **OneDrive / Google Drive / Dropbox** large sync.
  - **Backblaze / Carbonite** initial backup.
  - **Game launcher** (Steam, Epic) downloading.
  - **Updates to Chrome / Edge / Office** in background.
- Pause / quit the heavy task. Speedtest again.

### Step 7 — Check DNS
- Run a speedtest with a different DNS:
  - **Windows:** Settings → Network → Advanced → Edit DNS → Manual → 1.1.1.1 + 8.8.8.8.
  - **macOS:** System Settings → Network → Wi-Fi → Details → DNS → +1.1.1.1.
- If sites suddenly load faster, your old DNS was slow.

### Step 8 — Check ISP / modem signal
- Log into your router admin page (usually 192.168.0.1 or 192.168.1.1).
- Look for "Connection Status" or "Modem Status" or "Cable Diagnostics."
- For cable (DOCSIS):
  - **Downstream signal-to-noise ratio (SNR):** should be > 35 dB.
  - **Downstream power level:** should be between -10 and +10 dBmV.
  - **Upstream power level:** should be between +35 and +50 dBmV.
- If any of these are way out of range → call ISP, line needs attention.

### Step 9 — Update network drivers (Windows)
- Settings → Windows Update → Optional updates → Driver updates.
- Apply any network-related driver updates.
- Reboot.
- Retest.

### Step 10 — VPN check
- Disconnect any VPN clients (Cisco, GlobalProtect, Ivanti, NordVPN, ExpressVPN, etc.).
- Retest.
- If much faster without VPN: VPN is the cause. Either accept the speed hit (corporate VPN is usually slower) or switch VPN gateway location.

## 5. Verification Steps
- Cloudflare or Ookla speedtest shows speeds within 70% of your plan when wired.
- Wi-Fi within 15 ft of router shows at least 50% of wired speed.
- Video calls are stable.

## 6. When to Call ISP
- Wired speeds are < 50% of advertised plan AND you've rebooted the modem.
- Modem signal levels are out of spec (see Step 8).
- The speed has been getting progressively worse over weeks.
- ISP can do a "line conditioning" or send a technician.

## 7. When to Call Office IT (Office context)
- Office-wide slowness, not just your computer.
- Slow only when on VPN (could be gateway congestion).
- Slow only to specific internal services (could be server-side, not network).

## 8. Prevention Tips
- **Upgrade Wi-Fi to current standard.** Wi-Fi 6E or Wi-Fi 7 in 2026. See `l2-network-legacy-001`.
- **Place router centrally** in the home or office. Up high (top of bookshelf), not in a cabinet.
- **5 GHz default for laptops + phones.** Reserve 2.4 GHz for IoT (smart bulbs, doorbells).
- **Schedule backups overnight** so they don't fight with daytime work.
- **Wired Ethernet for desktops** when possible — always faster.

## 9. User-Friendly Explanation
First test by plugging an Ethernet cable in to your laptop. If wired speed is good, your Wi-Fi is the issue — usually distance or interference. If wired speed is also bad, the problem is either your modem, your router, or your ISP. Run a speedtest at speed.cloudflare.com on cellular vs Wi-Fi to compare. If you're paying for 500 Mbps and only getting 150 wired, call your ISP.

## 10. Internal Technician Notes
- Single-stream limits: a single TCP connection rarely uses full link bandwidth. Speedtests use parallel streams.
- TCP window scaling: ensure enabled on Windows; older Windows builds with it disabled cap at ~50 Mbps over long-latency links.
- Bufferbloat: high load increases ping dramatically. Test at https://speed.cloudflare.com to see "loaded latency." > 100ms loaded = bufferbloat. Fix: enable SQM / Cake AQM on router (Ubiquiti, OpenWrt support; consumer routers vary).
- WMM / QoS settings on router help VoIP / video over best-effort traffic.
- For multi-AP setups: ensure same SSID + same security on all APs for seamless roaming. Different SSIDs force manual re-connect.

## 11. Related KB Articles
- `l1-internet-001` — No internet at all
- `l1-wifi-001` — Wi-Fi connection issues
- `l2-network-legacy-001` — Old router upgrade
- `l1-network-be-001` — Wi-Fi 7 deployment

## 12. Keywords / Search Tags
slow internet, slow wifi, speedtest, bandwidth, latency, buffering, lag, ookla, cloudflare speed test, mesh, extender, wifi signal, dns, snr, docsis, mtu, throughput
