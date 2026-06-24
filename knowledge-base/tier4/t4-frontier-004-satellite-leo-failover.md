---
id: t4-frontier-004
title: "Satellite / LEO Connectivity Failover"
category: network
support_level: L2
tech_generation: tier-4
tier4_pack: frontier-infra
severity: medium
estimated_time_minutes: 60
audience: it-technician
os_scope: ["Windows 11","macOS","cross-platform"]
prerequisites: []
keywords: ["leo satellite","starlink","satellite failover","backup wan","sd-wan failover","latency jitter","obstruction","cgnat","dual wan","weather fade","internet redundancy","field connectivity"]
related_articles: ["t4-frontier-003","t4-frontier-007","t4-frontier-005"]
escalation_trigger: "Primary WAN fails and satellite failover does not carry critical traffic, or persistent obstruction/latency makes the link unusable."
last_updated: 2026-06-24
version: 1.0
---

## 1. Symptoms
- A site needs internet redundancy where wired options are limited (remote, rural, mobile, field, maritime).
- Failover to a LEO satellite link doesn't happen, is slow to switch, or critical apps break on the backup path.
- Intermittent drops, latency spikes, or jitter on the satellite link.
- Outages during heavy rain/snow or when the antenna's sky view is obstructed.
- Apps misbehave behind carrier-grade NAT (CGNAT) on the satellite service (inbound/VPN issues).

## 2. Likely Causes / Drivers
- **LEO advantages:** lower latency than legacy geostationary satellite, broad coverage where terrestrial WAN isn't available — good as backup or primary in the field.
- **Failover not configured properly:** no SD-WAN/dual-WAN policy, health checks not detecting the primary failure, or asymmetric routing on cutover.
- **Obstruction:** trees/buildings/structures blocking the antenna's required clear sky view.
- **Weather fade:** heavy precipitation attenuating the signal.
- **CGNAT/addressing:** the satellite service hands out shared/CGNAT addresses, breaking inbound connections, some VPNs, and port-forwarding.
- **Latency/jitter sensitivity:** real-time apps (voice/video/remote-control) tolerate the variable path poorly.

## 3. Questions To Ask User
- Is satellite the backup WAN or the primary, and what traffic must survive a primary failure?
- What's the antenna's sky view — any obstructions, and is the mount stable?
- Do the failing apps need inbound connectivity or VPN (CGNAT-sensitive)?
- Does the problem correlate with weather or time of day?
- What handles failover today (router dual-WAN, SD-WAN, manual), and how fast must cutover be?

## 4. Troubleshooting Steps
1. **Confirm physical health:** antenna alignment, stable mount, and an unobstructed sky view; check the service app for obstruction/outage reports.
2. **Baseline the link:** measure latency, jitter, and packet loss on the satellite path under normal conditions.
3. **Test failover deliberately:** simulate a primary-WAN failure and watch whether cutover happens, how fast, and which apps survive.
4. **Check NAT/addressing:** determine if the service uses CGNAT and whether failing apps need inbound/VPN reachability.
5. **Correlate with weather/obstruction:** log drops against precipitation and sky-view events.

## 5. Resolution Steps
1. **Fix line-of-sight:** relocate/raise the antenna to clear obstructions; secure the mount against movement/wind.
2. **Engineer failover:** configure SD-WAN or dual-WAN with reliable health checks so cutover is automatic and fast; prioritize critical traffic on the backup path's limited capacity.
3. **Handle CGNAT:** where inbound/VPN is required, use an outbound-initiated/overlay approach (e.g., VPN that tolerates CGNAT) or a public-IP option from the provider if available.
4. **Protect real-time apps:** apply QoS, accept that voice/video may degrade on the variable path, and set user expectations for failover periods.
5. **Mitigate weather fade:** ensure adequate antenna siting; treat brief weather drops as expected and design apps to reconnect gracefully.
6. **Document the design** including which traffic is protected, expected backup performance, and failback behavior.

## 6. Verification Steps
- A simulated primary-WAN outage triggers automatic failover within the required time, and critical apps continue.
- The satellite link's latency/jitter/loss baseline is acceptable for the intended traffic.
- The antenna has a clear, stable sky view with no obstruction warnings.
- CGNAT-sensitive apps/VPNs work via the chosen approach on the satellite path.
- Failback to primary WAN works cleanly when it recovers.

## 7. Escalation Trigger
Escalate to L3 / provider when the primary fails but satellite failover doesn't carry critical traffic, when obstruction/weather makes the link persistently unusable despite re-siting, or when CGNAT blocks a required inbound/VPN service with no provider remedy.

## 8. Prevention Tips
- Design failover with real health checks and traffic prioritization, not just a second uplink plugged in.
- Site the antenna for a clear, stable sky view from the start; plan for weather margin.
- Confirm CGNAT implications before relying on inbound/VPN over satellite.
- Set user expectations: backup links are for continuity, not full primary-grade performance.
- Test failover and failback regularly — don't discover it's broken during a real outage.

## 9. User-Friendly Explanation
Low-earth-orbit (LEO) satellite internet can keep a site online when the main connection fails, or serve remote places with no good wired option. It's much faster than old satellite but can wobble in latency, drop in heavy weather, or struggle if trees/buildings block the dish's view of the sky. We set it up so the network automatically switches to satellite when the main line dies, make sure the dish has a clear view, and confirm your important apps keep working on the backup.

## 10. Internal Technician Notes
- LEO is referenced generically (Starlink-class) — don't tie guidance to one provider's specifics.
- The #1 silent failure is failover config: a backup uplink with no working health check/cutover policy is not redundancy.
- CGNAT is the common app-breaker (inbound, port-forward, some VPNs) — design around it early.
- Obstruction + weather fade are physical-layer; re-siting beats config tweaks.
- Pairs with t4-frontier-003 (private cellular still needs internet egress) and supports field deployments (t4-frontier-005/007).

## 11. Related KB Articles
- t4-frontier-003 — Private 5G / Private Cellular for Enterprise
- t4-frontier-007 — Robotics / Cobots / OT + Edge-Node Triage
- t4-frontier-005 — AR / Smart-Glasses for Field & Enterprise Work

## 12. Keywords / Search Tags
LEO satellite, Starlink, satellite failover, backup WAN, SD-WAN failover, latency, jitter, obstruction, CGNAT, dual WAN, weather fade, internet redundancy
