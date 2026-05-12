---
id: l2-network-legacy-001
title: "Office router is WPA2-PSK only — modern devices misbehave, Wi-Fi 6/7 clients drop"
category: networking
support_level: L2
severity: medium
estimated_time_minutes: 60
audience: technician
os_scope: ["Windows 10", "Windows 11", "macOS", "iOS", "Android"]
tech_generation: legacy
year_range: "Router 2010-2018; Wi-Fi 5 era pre-WPA3"
eol_status: "WPA2-PSK still works but loses to KRACK (2017) and is deprecated by WPA3 (2018+). Many enterprise / banking VPN clients now refuse to connect from WPA2-PSK networks."
prerequisites: ["Admin access to the office router and ISP gateway"]
keywords:
  - wpa2
  - wpa3
  - wi-fi 6
  - wi-fi 6e
  - wi-fi 7
  - krack
  - psk
  - sae
  - opportunistic wireless encryption
  - mesh
  - guest network
  - vlan
  - dual band
  - tri band
  - mlo
related_articles:
  - l1-wifi-001-cant-connect
  - l2-networking-001-deep-troubleshoot
  - l3-networking-001-architecture
escalation_trigger: "Office has 30+ devices, multi-floor coverage, or any compliance requirement (PCI-DSS 4.0 requires WPA3 by Mar 2025); design with structured cabling + APs not consumer router."
last_updated: 2026-05-11
version: 1.0
---

# Office router is WPA2-PSK only — replacement to WPA3 / Wi-Fi 6/7

## 1. Symptoms
- Newer phones (iPhone 15+, Pixel 9+) randomly drop Wi-Fi or fail to authenticate.
- VPN clients (Cisco AnyConnect, GlobalProtect, NordLayer) refuse to connect citing "insecure network."
- Wi-Fi 6 / 6E laptops connect but get poor throughput vs claimed speeds.
- iOS 17+ shows "Weak Security" / "Privacy Warning" under Wi-Fi network name.
- Streaming meetings (Zoom, Teams) glitch under load.

## 2. Likely Causes
1. **Router is WPA2-PSK only**, often a 2014-2018 consumer router (Linksys EA-series, ASUS RT-AC, TP-Link Archer C7, Netgear Nighthawk R7000).
2. **2.4 GHz crowding** in dense office buildings — old routers have limited channel options.
3. **No 6 GHz band** — Wi-Fi 6E and Wi-Fi 7 clients can't use their fastest band on a WPA2 router.
4. **Single SSID for everything** — IoT devices, guests, and corporate traffic share one network.

## 3. Questions To Ask Customer
1. Router make/model and approximate year purchased?
2. Number of users + estimated total devices (phones, laptops, printers, cameras, IoT)?
3. Office square footage and number of floors?
4. Internet plan speed?
5. Compliance requirements (PCI, HIPAA, SOC 2)?
6. Budget range for a refresh?

## 4. Diagnostic Steps
1. Log into the router admin page (usually 192.168.1.1 or 192.168.0.1).
2. Note: model, firmware version, supported encryption modes (WPA2-PSK, WPA2/WPA3 mixed, WPA3-SAE).
3. From a Win 11 laptop, run `netsh wlan show interfaces` → confirm "Authentication" line (will show WPA2-Personal if router is WPA2-only).
4. From iPhone: Settings → Wi-Fi → tap (i) next to the network — if it says "Weak Security", router is WPA/WPA2 mixed or WPA2-TKIP.
5. Run a site survey using WiFi Analyzer (Android) or NetSpot (mac/win) — check 2.4/5/6 GHz channel usage and signal levels.

## 5. Resolution Steps

**Path A — Replace consumer router with prosumer Wi-Fi 6E / 7 mesh (most offices < 5,000 sq ft):**
1. Pick a mesh kit:
   - **TP-Link Deco BE85** (Wi-Fi 7, $999/3-pack) — best value for 4,000-6,000 sq ft.
   - **eero Pro 7** (Wi-Fi 7, $599-1,499) — easiest setup, Amazon ecosystem.
   - **Ubiquiti UniFi Express 7 Pro** (Wi-Fi 7, $279 per AP + $199 dream router) — best for offices wanting VLANs and growth.
2. Set 3 SSIDs minimum:
   - `iisupp-corp` — WPA3-SAE only, VLAN 10
   - `iisupp-iot` — WPA2/WPA3 mixed (some smart devices still need WPA2), VLAN 20, isolated
   - `iisupp-guest` — WPA3-SAE + captive portal, VLAN 30, internet-only
3. Configure band steering: prefer 6 GHz for Wi-Fi 6E/7 clients, 5 GHz for older devices, 2.4 GHz only for IoT.
4. Enable MLO (Multi-Link Operation) for Wi-Fi 7 clients — gives 30%+ latency improvement on video calls.

**Path B — UniFi structured deployment (offices > 5,000 sq ft, multi-floor, or compliance):**
1. UniFi Dream Machine Pro Max + 3-6 U7 Pro APs ($1,400-3,000 hardware).
2. Cat6A drops to each AP location, PoE+ injectors or PoE switch.
3. Site-to-site VPN to remote workers, RADIUS for 802.1X enterprise auth on `iisupp-corp` SSID.
4. ~2-day install for licensed cable + AP placement.

**Path C — Cheapest stop-gap (until budget allows replacement):**
1. Buy a single ASUS RT-AX86U Pro ($230) — Wi-Fi 6, supports WPA3.
2. Replace ISP-supplied router. Keep ISP modem in bridge mode.
3. Configure: WPA3-SAE primary SSID + WPA2/WPA3 transitional for legacy IoT.

## 6. Verification Steps
- iPhone shows no "Weak Security" warning on `iisupp-corp`.
- Speedtest on Wi-Fi 7 laptop: at least 70% of wired throughput within 30 ft of an AP.
- VPN clients (AnyConnect, GlobalProtect) connect without security warnings.
- Roaming test: walk across the office on a continuous Zoom call — no drop.

## 7. Escalation Trigger
- More than one floor, more than 50 users, or any compliance audit pending → escalate to network design (L3).
- Building has unique RF challenges (steel framing, glass partitions, microwave ovens near APs) → site survey before install.
- Customer wants 802.1X enterprise auth, RADIUS, certificate-based onboarding → L3 + AD/Entra integration.

## 8. Prevention Tips
- **Replace office Wi-Fi every 5-7 years** even if it "still works" — Wi-Fi standards leap every 5 years.
- **Always deploy at least 3 SSIDs** from day one — corp / IoT / guest.
- **Budget annual line item** for Wi-Fi refresh; it's infrastructure, not a one-time buy.
- **Subscribe to vendor firmware update bulletins** — WPA2 KRACK was patched at the firmware level, many routers never got the fix.

## 9. User-Friendly Explanation
Your office Wi-Fi router is using a security standard from 2004. Most of your newer phones and laptops know it's old and complain about it, and your VPN apps may refuse to use it. We can swap in a modern mesh system with proper office, guest, and smart-device networks — phones stop warning, the Wi-Fi gets faster, and your team stops wrestling with the connection. The mid-range option lands around $1,000 for hardware plus an afternoon to set up.

## 10. Internal Technician Notes
- WPA3-SAE handshake reference: IETF RFC 7664 (Dragonfly).
- Wi-Fi 7 features that depend on WPA3: MLO (Multi-Link Operation), 4K-QAM, 320 MHz channel width in 6 GHz.
- PCI-DSS 4.0 requirement: WPA3 mandatory for cardholder networks effective March 2025 (replacing PCI-DSS 3.2.1's WPA2 minimum).
- iOS 17+ Privacy Warning triggers on: WPA/WPA2 mixed mode, WPA2-TKIP (not AES), no PMF (Protected Management Frames).
- Transitional WPA2/WPA3 mode runs both for IoT compatibility; pure WPA3-SAE is the goal once IoT migrated.
- VLAN tagging requires a managed switch — most ISP routers don't tag, so APs handle VLANs in software.

## 11. Related KB Articles
- `l1-wifi-001` — Can't connect to Wi-Fi
- `l2-networking-001` — Network deep troubleshoot
- `l3-networking-001` — Network architecture

## 12. Keywords / Search Tags
wpa2, wpa3, sae, krack, wi-fi 6, wi-fi 6e, wi-fi 7, mlo, mesh router, ubiquiti, unifi, eero, tp-link deco, captive portal, vlan, ssid, band steering, 802.1x, weak security, pmf, pci-dss
