---
id: l1-network-be-001
title: "Wi-Fi 7 in the office — 320 MHz, MLO, and backward compatibility with Wi-Fi 6/6E/5 clients"
category: networking
support_level: L1
severity: low
estimated_time_minutes: 25
audience: end-user
os_scope: ["Windows 11 24H2+", "macOS 15+", "iOS 17+", "Android 14+"]
tech_generation: bleeding-edge
year_range: "2024-present (IEEE 802.11be ratified Jan 2024; first 6 GHz country approvals through 2024-2026)"
eol_status: "Current. Backward compatible with Wi-Fi 6E, Wi-Fi 6, Wi-Fi 5, Wi-Fi 4 clients."
prerequisites: ["Wi-Fi 7 capable AP / router", "Wi-Fi 7 client (Snapdragon X, Intel BE200/202, Apple M4 iPad Pro / iPhone 16 Pro)"]
keywords:
  - wi-fi 7
  - 802.11be
  - 320 mhz
  - mlo
  - multi-link operation
  - 4k qam
  - wi-fi 6e
  - 6 ghz
  - backward compatibility
  - tri-band
  - quad-band
  - unifi
  - eero
  - deco
  - asus
  - intel be200
related_articles:
  - l1-wifi-001-cant-connect
  - l2-network-legacy-001-wpa2-only-router-replacement
  - l3-networking-001-architecture
escalation_trigger: "Deploying Wi-Fi 7 across 20+ APs, multi-floor, or regulated industry → L3 network design with proper spectrum management."
last_updated: 2026-05-11
version: 1.0
---

# Wi-Fi 7 in the office — 320 MHz, MLO, and backward compatibility

## 1. Symptoms
- Customer bought a Wi-Fi 7 router/mesh but speed tests don't show the advertised gigabit+ throughput.
- Mixed device fleet: some Wi-Fi 7, some Wi-Fi 6E, some Wi-Fi 6, some Wi-Fi 5 — wants to know what each gets.
- 6 GHz band shows in Wi-Fi 7 router admin but client doesn't connect to it.
- Cordless phones, microwave, or older smart-home gear seem to slow Wi-Fi randomly.

## 2. Likely Causes
1. **No Wi-Fi 7 client** — even with a Wi-Fi 7 router, only Wi-Fi 7 clients get MLO + 4K-QAM + 320 MHz. Win 11 24H2+, iOS 17+, macOS 15+ Apple Silicon are required at minimum.
2. **DFS / weather-radar channels** blocking 80/160/320 MHz — some 5 GHz channels require DFS scan time, others are unavailable per country.
3. **6 GHz country restrictions** — different countries (US, EU, UK, Canada, Japan) allow different 6 GHz channel ranges; some still 2024-2026 in regulatory process.
4. **AFC (Automated Frequency Coordination)** for Standard Power 6 GHz operation — not approved everywhere yet.
5. **Wi-Fi 5 / Wi-Fi 6 client on a 2.4 GHz / 5 GHz radio** — they don't reach 6 GHz no matter what.

## 3. Questions To Ask User
1. Router/AP make + model? (Confirm Wi-Fi 7.)
2. Country / region?
3. Device list — what Wi-Fi versions across phones, laptops, tablets, printers, cameras, IoT?
4. Highest priority device for performance — usually a specific laptop or workstation.
5. Throughput target — current ISP plan speed?

## 4. Diagnostic Steps
1. Identify the priority client's Wi-Fi version:
   - Win 11: Settings → Network & internet → Wi-Fi → click the network → Properties → look for "Network band" (2.4, 5, 6 GHz) and "Protocol" (Wi-Fi 7 / Wi-Fi 6E / etc.).
   - macOS: Option-click the Wi-Fi icon in menu bar → details: PHY mode (e.g., "802.11be" = Wi-Fi 7).
   - iOS: Settings → Wi-Fi → tap (i) next to network → see "Mode" (Wi-Fi 7 if applicable).
2. From router admin: confirm 6 GHz radio is enabled and broadcasting the same SSID.
3. Speedtest on each device using ookla.app or speedtest.net (use a wired computer for the upstream baseline).

## 5. Resolution Steps

**To deliver Wi-Fi 7 throughput to clients that support it:**
1. **Use single SSID with band steering** rather than separate 6 GHz SSID. Modern routers do this well (eero, Deco, UniFi U7 Pro).
2. **Enable 320 MHz channel width** on 6 GHz radio (router admin → 6 GHz → channel width: 320 MHz auto). 320 MHz only available in 6 GHz.
3. **Enable MLO (Multi-Link Operation)** — clients can use 2.4 / 5 / 6 GHz simultaneously, ~30% latency drop, much smoother for video calls. Requires Wi-Fi 7 on both ends.
4. **Enable 4K-QAM** — higher modulation = more throughput on short range. Most Wi-Fi 7 routers ON by default.
5. **Use WPA3-SAE or WPA3 + WPA2 transitional**. 6 GHz spec requires WPA3 — Wi-Fi 7 clients refuse WPA2-only on 6 GHz.

**For older clients on the same network:**
- Wi-Fi 6E client → 6 GHz, max ~1.6 Gbps real-world.
- Wi-Fi 6 client → 5 GHz, max ~800 Mbps real-world.
- Wi-Fi 5 client → 5 GHz, max ~400 Mbps real-world.
- Wi-Fi 4 / b/g/n client → 2.4 GHz, max ~50 Mbps real-world.

**Common upgrades to unlock Wi-Fi 7 on existing fleet:**
1. **Replace internal Wi-Fi card** on desktop / older laptop: Intel BE200/202 (M.2 module, ~$30) → upgrades a Wi-Fi 6E laptop to Wi-Fi 7 if mainboard + driver support it. Check vendor / Linux kernel compat.
2. **USB Wi-Fi 7 adapter** for desktops: not many shipping yet (early 2026), early ones from MediaTek, ASUS.
3. **For phones / iPads:** no upgrade path — must buy newer hardware.

## 6. Verification Steps
- Priority Wi-Fi 7 laptop: speedtest at 1.5+ Gbps within 15 feet of AP.
- MLO active: Win 11 Wi-Fi details shows "Wi-Fi 7" protocol AND multiple link addresses; macOS shows "Multi-Link".
- Latency on video call < 30ms RTT to home Wi-Fi → server (use `ping` to a regional server).
- All older devices continue working without manual intervention (proves band steering).

## 7. Escalation Trigger
- Office > 5,000 sq ft or multi-floor → site survey + L3 design.
- Throughput target > 2 Gbps internet plan → check switch backhaul (1 GbE switches throttle; need 2.5 GbE or 10 GbE).
- Regulated industry / 802.1X enterprise auth → certificate-based RADIUS deployment.

## 8. Prevention Tips
- **Buy Wi-Fi 7 today for any router refresh.** Backward compat is full, future-proof through ~2030.
- **Wired backhaul for mesh APs** if running Wi-Fi 7 mesh — wireless backhaul caps throughput; Ethernet preserves it.
- **2.5 GbE or 10 GbE switch + ISP modem upgrade** if you're paying for > 1 Gbps internet, otherwise the wired path is the bottleneck.

## 9. User-Friendly Explanation
Wi-Fi 7 is the new standard. It's roughly twice as fast as Wi-Fi 6 if your phone or laptop also supports Wi-Fi 7. Older devices keep working at their own speed — they're not slowed down. If you're getting a new router, get Wi-Fi 7. If you want your existing laptop to also be Wi-Fi 7, sometimes we can swap in a small card for around $30; phones and iPads can't be upgraded so they'll stay on whatever Wi-Fi they came with.

## 10. Internal Technician Notes
- IEEE 802.11be — Wi-Fi 7 — ratified January 2024.
- 320 MHz channel width only available in 6 GHz, and only when AFC is active for Standard Power; Low Power Indoor (LPI) limited to 160 MHz.
- MLO modes:
  - eMLSR (enhanced Multi-Link Single Radio): cheaper clients, switches between bands.
  - STR (Simultaneous Transmit Receive): premium clients, uses bands simultaneously — most latency benefit.
- 4K-QAM (4096-QAM): 20% PHY rate gain over Wi-Fi 6's 1024-QAM, but only at very high SNR (close-range).
- AFC: FCC approved Q4 2024 for US Standard Power 6 GHz; EU CEPT decision pending. EU mostly LPI only as of mid-2026.
- Country variations: Japan opened 6 GHz mid-2024; UK opened lower 6 GHz earlier; Canada follows US.
- Intel BE200/BE202 driver: Windows 11 24H2+ supports natively; Linux kernel 6.6+; macOS not yet supported (Apple has own silicon).
- Aruba InstantOn AP25 ($300) / UniFi U7 Pro ($279) / Cisco Meraki MR57 ($1,200) — enterprise Wi-Fi 7 APs.

## 11. Related KB Articles
- `l1-wifi-001` — Can't connect to Wi-Fi
- `l2-network-legacy-001` — WPA2-only router replacement
- `l3-networking-001` — Network architecture

## 12. Keywords / Search Tags
wi-fi 7, 802.11be, 320 mhz, mlo, multi-link operation, 4k-qam, wi-fi 6e, 6 ghz, backward compatibility, tri-band, quad-band, unifi u7, eero pro 7, tp-link deco be85, intel be200, asus rt-be96u, afc, automated frequency coordination, wpa3-sae
