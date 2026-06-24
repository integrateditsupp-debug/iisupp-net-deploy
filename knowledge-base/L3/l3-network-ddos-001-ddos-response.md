---
id: l3-network-ddos-001
title: "DDoS attack response (volumetric / protocol / application-layer)"
category: network-security
support_level: L3
severity: critical
estimated_time_minutes: 180
audience: it-technician
os_scope: ["Network", "Cloud", "All"]
prerequisites: []
keywords:
  - ddos attack
  - volumetric attack
  - protocol attack
  - application layer ddos
  - layer 7
  - scrubbing center
  - bgp blackhole
  - rate limiting
  - geo blocking
  - cdn waf
  - isp engagement
  - syn flood
related_articles:
  - l3-security-001
  - l3-networking-001
  - l3-security-002
  - l3-disaster-recovery-001
escalation_trigger: "Engage the ISP and DDoS-protection/scrubbing vendor immediately when attack volume approaches link/edge capacity or an application-layer attack evades on-box mitigation; loop in security leadership for any extortion/ransom-DDoS note."
last_updated: 2026-06-24
version: 1.0
---

# DDoS attack response (volumetric / protocol / application-layer)

## 1. Symptoms
- Sudden saturation of internet links; legitimate users can't reach services; severe latency/packet loss.
- Firewall/load-balancer/edge devices at high CPU, session-table or connection-limit exhaustion.
- Spikes in SYN/UDP/ICMP, reflected/amplified traffic, or a flood of HTTP(S) requests to expensive endpoints.
- Web apps slow or down while infrastructure links look "only moderately" loaded (signature of an application-layer attack).
- Monitoring/NetFlow shows a steep, anomalous traffic ramp, often from many distributed sources; sometimes an extortion/ransom-DDoS note arrives.

## 2. Likely Causes
- **Volumetric attack** — raw bandwidth flood (UDP/ICMP flood, DNS/NTP/memcached reflection-amplification) aiming to saturate the pipe.
- **Protocol/state-exhaustion attack** — SYN flood, fragmented packets, or connection floods exhausting firewall/LB state tables.
- **Application-layer (L7) attack** — low-bandwidth but high-impact floods of valid-looking requests (HTTP GET/POST, expensive queries, login/search endpoints) that evade simple volume thresholds.
- Targeting of unprotected origin IPs that bypass an existing CDN/WAF.
- Sometimes a smokescreen for a parallel intrusion (correlate with l3-security-001).

## 3. Questions To Ask User
- Which services are affected, and are the network links saturated or are the servers/app the bottleneck?
- When did it start, and what does monitoring/NetFlow show (traffic type, ports, source spread, requests/sec)?
- Is the attack hitting a CDN/WAF front end or the origin directly?
- Do we have a DDoS-protection service or scrubbing arrangement, and an ISP contact for emergency mitigation?
- Has any extortion/ransom note been received (do not engage attackers; involve leadership/legal)?
- What is the business/revenue impact and which services must stay reachable as priority?
- Is there any sign of a concurrent intrusion (this can be a distraction)?

## 4. Troubleshooting Steps
> L3 triage and coordination. The most effective DDoS mitigation usually happens upstream (ISP/scrubbing/CDN), not on your edge device. ARIA documents the attack profile and coordinates vendor/ISP engagement; senior engineers execute mitigations.
1. **Classify the attack type quickly** (volumetric vs protocol vs application-layer) from NetFlow/logs — the mitigation differs sharply, and on-box fixes do nothing against a saturated upstream pipe.
2. **Determine where it lands:** origin directly vs through the CDN/WAF. If the origin IP is exposed, that bypass is the core problem.
3. **Measure scale vs capacity.** If volume approaches your link or edge-device capacity, on-premises mitigation cannot win — upstream help is required (go to escalation early).
4. **Identify attack signatures** (ports, protocols, source ASNs/geos, target URLs, user-agents) to feed ISP/scrubbing/WAF rules.
5. **Protect availability of priority services** — confirm what must stay up and whether non-critical services can be shed to preserve capacity.
6. **Check for a parallel intrusion**; ensure logging/monitoring keeps running so the DDoS doesn't blind detection.

## 5. Resolution Steps
> Section 5 is for a senior network/security engineer, frequently in a bridge with the ISP and DDoS vendor. Upstream engagement is mandatory at scale.
1. **Engage the ISP and DDoS-protection/scrubbing vendor early** to divert traffic through scrubbing (often via DNS redirection or BGP advertisement to the scrubbing center) and to apply upstream filtering. This is the primary lever for volumetric attacks.
2. **Volumetric:** request upstream rate-limiting/filtering; as a blunt last resort, **remote-triggered black-hole (RTBH)** of the targeted IP at the ISP drops all traffic to it (it sacrifices that IP to save the rest of the network — a deliberate trade-off, decided with the ISP).
3. **Protocol/state-exhaustion:** enable SYN cookies, tune connection/rate limits, drop malformed/fragmented traffic, and lean on stateful protections at the edge/scrubber.
4. **Application-layer (L7):** front the service with a CDN/WAF; apply rate-limiting, challenge/CAPTCHA or JS challenges, bot management, and targeted rules for the abused endpoints. Hide/relocate the origin and restrict it to accept only CDN/WAF traffic.
5. **Tactical filters:** apply geo/ACL/source filtering only when it reliably separates attack from legitimate traffic — the goal is keeping real users up, so avoid over-broad blocks that cause self-inflicted outage.
6. **If exploited as cover for intrusion,** run incident response in parallel (l3-security-001). For ransom-DDoS, **do not communicate with or pay attackers without leadership/legal** direction.

## 6. Verification Steps
- Legitimate traffic flows normally; service latency/availability back to baseline for priority services.
- Attack traffic is being absorbed/scrubbed upstream; edge devices (firewall/LB) back to healthy CPU/state-table levels.
- Origin no longer directly reachable by attack traffic (CDN/WAF-only ingress confirmed where applicable).
- Mitigations are documented and reversible; over-broad geo/ACL blocks reviewed to confirm they aren't dropping real users.
- Monitoring/logging intact; no evidence of a concurrent breach (or IR handling it).
- ISP/vendor case documented; post-incident review scheduled.

## 7. Escalation Trigger
Engage the ISP and DDoS-protection/scrubbing vendor immediately once attack volume approaches link/edge capacity, or when an application-layer attack evades on-box mitigation. Black-holing an IP and any DNS/BGP redirection are coordinated with the ISP/vendor. Involve security leadership and legal for any extortion/ransom-DDoS, and invoke l3-security-001 if a concurrent intrusion is suspected.

## 8. Prevention Tips
- Put public services behind a CDN/WAF with DDoS protection; keep origin IPs hidden and lock the origin to accept only CDN/WAF traffic.
- Pre-arrange DDoS-protection/scrubbing service and an ISP escalation contact, with the runbook and contract details documented before an attack.
- Right-size and harden edge devices (connection/rate limits, SYN protection); avoid being your own bottleneck.
- Close reflection/amplification exposure (no open DNS/NTP resolvers/memcached; BCP38 anti-spoofing upstream where possible).
- Build NetFlow/telemetry-based anomaly detection so attacks are seen and classified fast.
- Provision headroom/autoscaling for application tiers and cache aggressively to blunt L7 attacks.
- Run DDoS tabletop drills and validate the scrubbing/redirection path works before you need it.

## 9. User-Friendly Explanation
A DDoS attack floods your services with junk traffic from many sources to crowd out real users — like a mob jamming the doors of a shop. There are three flavors: brute-force "fill the pipe" floods, attacks that exhaust your equipment's capacity to track connections, and sneaky ones that send normal-looking requests to overwhelm the application. The most effective defense usually happens upstream, so we engage your internet provider and a DDoS-protection service to filter the bad traffic before it reaches you, while keeping real customers connected. In extreme cases we may temporarily sacrifice a single attacked address to protect everything else. We never negotiate with or pay attackers.

## 10. Internal Technician Notes
- Classify first (volumetric / protocol / L7) — mitigations don't transfer, and an on-box rule against a saturated pipe is wasted effort. Upstream (ISP/scrubbing/CDN) is the real lever at scale.
- Exposed origin IP that bypasses the CDN/WAF is the most common own-goal; relocating/locking the origin is often the single biggest win.
- RTBH black-holing is a sacrifice play (you drop all traffic to the target IP) — coordinate with the ISP and reserve for when it protects the wider network.
- Beware over-broad geo/ACL blocks: the objective is keeping legitimate users up, not just dropping packets.
- DDoS can be a smokescreen — keep monitoring running and watch for a parallel breach (l3-security-001).
- Ransom-DDoS: no contact/payment without leadership + legal. Capture the note as evidence.

## 11. Related KB Articles
- l3-security-001 — Incident response if DDoS masks an intrusion
- l3-networking-001 — Edge/network architecture and capacity context
- l3-security-002 — Parallel emergency response patterns
- l3-disaster-recovery-001 — Availability/failover if services must be relocated

## 12. Keywords / Search Tags
ddos attack, volumetric attack, protocol attack, application layer ddos, layer 7, scrubbing center, bgp blackhole, rate limiting, geo blocking, cdn waf, isp engagement, syn flood
