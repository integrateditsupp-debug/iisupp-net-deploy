---
id: l2-wifi-survey-001
title: "Wireless site survey and Wi-Fi coverage/performance remediation"
category: network
support_level: L2
severity: medium
estimated_time_minutes: 90
audience: it-technician
os_scope: ["Windows 11","Windows 10","macOS"]
prerequisites: []
keywords: ["wifi site survey","wireless coverage","wifi dead zone","co-channel interference","rssi snr targets","channel utilization","2.4 vs 5 vs 6 ghz","ap placement","predictive survey","passive survey","active survey","wifi roaming issues","channel width","slow wifi remediation","ap density"]
related_articles: ["l2-wifi-001","l2-network-troubleshoot-001","l2-switch-001","l2-dns-001"]
escalation_trigger: "Coverage/capacity gaps require additional access points, cabling, or AP hardware/firmware changes beyond on-site adjustment, or RF interference comes from an uncontrollable external source."
last_updated: 2026-06-24
version: 1.0
---

# Wireless site survey and Wi-Fi remediation

## 1. Symptoms
- Users report slow Wi-Fi, drops, or "no signal" in specific areas (dead zones).
- Calls/video drop while walking between rooms or floors (roaming problems).
- Wi-Fi is fine when empty but unusable when the area is full (capacity problem).
- One band works, another doesn't; devices cling to a far AP.
- Throughput is far below the link rate the client reports.

## 2. Likely Causes
1. **Coverage gaps:** too few APs, poor placement, or signal attenuated by walls/metal/glass.
2. **Capacity:** too many clients per AP / per channel for the band's airtime.
3. **Interference:** co-channel (same channel reused too densely) or adjacent-channel (overlapping channels), plus non-Wi-Fi RF.
4. **Band/channel design:** overuse of 2.4 GHz, channel widths too wide causing overlap, DFS flaps.
5. **Roaming:** APs at too-high power so clients "stick," or missing roaming assistance features.
6. **Backhaul:** uplink/switch/PoE constraint, not the RF at all.

## 3. Questions To Ask User
1. Where exactly is the problem — specific rooms/floors, or everywhere?
2. What time/condition — always, only when busy, or only while moving?
3. Which devices/bands are affected (phones, laptops; 2.4/5/6 GHz)?
4. What changed recently — new walls/furniture, more people, new AP, firmware update, a new neighbor's network?
5. What are the actual symptoms — no connection, connects but slow, or drops/roaming?

## 4. Troubleshooting Steps
**Decide the survey type:**
- **Predictive (design):** model coverage from a floor plan with wall materials before installing — used for new builds/redesigns.
- **Passive:** walk the space listening to RF (no association) to map RSSI, SNR, channel use, and rogue/neighbor APs — fastest for diagnosing existing coverage.
- **Active:** associate to the SSID and measure real throughput, loss, latency, and roaming as you walk — confirms user experience and validates a fix.

**Methodology:**
1. Define goals and target zones; get an accurate scaled floor plan.
2. Run a **passive** survey to baseline RSSI/SNR, channel utilization, and interference; identify dead zones and co/adjacent-channel overlap.
3. Run an **active** survey through the problem path to capture throughput, retries, and roaming behavior.
4. Inventory the RF environment: neighboring networks, DFS radar events, non-Wi-Fi sources (microwaves, BT, cameras).
5. Check backhaul: AP uplink negotiated speed, PoE budget, switch port errors, controller/AP load.

**Targets to compare against (typical design goals):**
- **RSSI:** ≥ -65 dBm for voice/video; ≥ -70 dBm for general data at the cell edge.
- **SNR:** ≥ 25 dB for voice/high throughput; ≥ 20 dB acceptable for data.
- **Channel utilization:** keep below ~40–50% busy; sustained higher means a capacity/interference problem.
- **Co-channel overlap:** minimize cells on the same channel hearing each other above ~-85 dBm.

## 5. Resolution Steps
1. **Band strategy:** treat **2.4 GHz** as coverage-only (use channels **1/6/11** at low density, often reduced power or disabled radios), put capacity on **5 GHz**, and use **6 GHz** (Wi-Fi 6E/7) for clean, high-capacity zones where clients support it.
2. **Channel width:** prefer **20 or 40 MHz** on 5 GHz in dense deployments — wider 80/160 MHz channels boost peak speed but cause overlap and co-channel contention. Reserve wide channels for low-density/6 GHz.
3. **AP placement & density:** place APs for **cell overlap (~15–20%)** without excessive co-channel reuse; favor more APs at **lower power** over fewer at high power. Avoid mounting above hard ceilings/metal; keep away from large RF blockers.
4. **Tune power:** lower 2.4 GHz and trim 5 GHz TX power so cells are appropriately sized and clients roam instead of sticking.
5. **Reduce interference:** re-channelize to break co/adjacent-channel overlap; eliminate or relocate non-Wi-Fi sources; handle DFS flapping by selecting stable channels where radar is frequent.
6. **Fix roaming:** ensure consistent SSID/security across APs, enable roaming-assist features (e.g. 802.11k/v/r where clients support them), and right-size cells so handoff happens.
7. **Fix backhaul:** correct uplink speed/duplex, PoE budget, and switch errors before blaming RF.
8. **Validate** with a fresh active survey along the same path.

## 6. Verification Steps
- Post-change passive/active survey shows target RSSI/SNR met across the problem zones with no remaining dead spots.
- Channel utilization is within target during a busy period.
- Roaming test (walk the path on a call) shows clean handoffs without drops.
- Real throughput/latency measured on the active survey meets the use-case requirement.
- User confirms the issue is resolved during normal load.

## 7. Escalation Trigger
- The fix requires **additional APs, new cabling/PoE capacity, or hardware/firmware changes** beyond on-site tuning. Escalate to **network engineering / procurement** with the survey heatmaps and recommended AP count/placement.
- Interference originates from a source outside your control (neighboring tenant, external radar).
- Capacity demand exceeds what the current AP/controller model can serve.

## 8. Prevention Tips
- Survey **before** occupancy changes (renovations, added staff, new dense areas), not only after complaints.
- Keep an as-built map of AP locations, channels, power, and uplinks; re-validate after any AP/firmware change.
- Standardize on a clean channel plan and disable unneeded 2.4 GHz radios in dense areas.
- Right-size for capacity (clients/AP and airtime), not just coverage bars.
- Re-survey periodically; the RF environment drifts as neighbors and clients change.

## 9. User-Friendly Explanation
"Wi-Fi problems usually aren't 'the internet is slow' — they're about radio coverage and crowding. We walk the space with survey tools to measure how strong and how clean the signal is in each area, find dead zones and channels that are stepping on each other, then adjust where the access points are, how loud they broadcast, and which channels they use. Sometimes the fix is tuning what's there; sometimes we genuinely need another access point in a weak spot."

## 10. Internal Technician Notes
- RSSI is absolute signal (dBm, closer to 0 is stronger); SNR is signal above noise (dB, higher is better) and is often the real throughput limiter in noisy environments.
- Co-channel interference (CCI) = same channel cells contending for airtime (slows everyone via CSMA/CA); adjacent-channel interference (ACI) = overlapping channels raising the noise floor — ACI is worse and is what 1/6/11-only planning on 2.4 GHz avoids.
- Wider channels (80/160 MHz) reduce the number of non-overlapping channels available — a classic cause of self-inflicted CCI in dense offices. Narrower channels + more APs usually beats fewer wide-channel APs for capacity.
- DFS channels (5 GHz) can flap on radar detection; in airport/weather-radar proximity prefer non-DFS or accept the trade-off.
- 6 GHz (6E/7) offers wide clean spectrum but shorter range and client-support gaps; design as a capacity overlay, not sole coverage.
- Always confirm wired backhaul/PoE before RF tuning — a 100 Mbps-negotiated uplink or PoE starvation masquerades as "bad Wi-Fi."

## 11. Related KB Articles
- l2-wifi-001 — Wi-Fi client connection and authentication issues
- l2-network-troubleshoot-001 — Structured network triage methodology
- l2-switch-001 — Switch port, PoE, and uplink troubleshooting
- l2-dns-001 — Internal DNS resolution problems

## 12. Keywords / Search Tags
wifi site survey, wireless coverage, wifi dead zone, co-channel interference, rssi snr targets, channel utilization, 2.4 vs 5 vs 6 ghz, ap placement, predictive survey, passive survey, active survey, roaming, channel width, ap density, slow wifi
