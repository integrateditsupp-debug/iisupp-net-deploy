---
id: l3-networking-001
title: "Network architecture: segmentation, zero trust, hub-and-spoke / SD-WAN"
category: networking
support_level: L3
severity: high
estimated_time_minutes: 90
audience: technician
prerequisites: ["Network architect"]
os_scope: ["Multi-vendor"]
keywords:
  - network architecture
  - segmentation
  - zero trust
  - sd-wan
  - hub spoke
  - microsegmentation
  - vlans
  - firewall
  - nva
related_articles:
  - l2-networking-001
  - l3-security-001
escalation_trigger: "Architectural change, vendor hardware EOL, mass remediation"
last_updated: 2026-05-07
version: 1.0
---

# Network architecture: design + evolution

## 1. Principles
- **Default deny.** All traffic blocked unless allowed.
- **Segmentation by trust zone.** Public / DMZ / Corp / Restricted / Crown jewels.
- **Microsegmentation east-west** — limit lateral movement.
- **Identity in the data plane** — Zero Trust.
- **Encrypt everywhere** — TLS / mTLS / IPsec.
- **Observability as a primary requirement** — flow logs, NetFlow, packet capture taps.

## 2. Topology patterns
**Hub-and-spoke (cloud / Azure):**
- Hub VNet contains shared services (firewall, VPN, AD).
- Spokes peer to hub; no spoke-spoke.
- Hub firewall enforces inter-spoke policy.

**SD-WAN:**
- Replaces MPLS for branch connectivity.
- Centralized policy, dynamic path selection.
- Encryption + telemetry built-in.

**Zero Trust:**
- No implicit trust based on network location.
- Per-request authentication + authorization.
- Continuous verification.

## 3. Migration considerations
- Identify crown jewels first; segment them tightly.
- Phase the rollout — never big-bang for prod.
- Document existing flows before policy change (NetFlow / capture-based).
- Monitor for drops post-change; have rollback plan.
- User experience matters — Zero Trust shouldn't add friction.

## 4. Capacity + performance
- Right-size: bandwidth, firewall throughput, VPN concurrent sessions.
- Plan for 2x peak headroom.
- Monitor utilization; capex at 70%.
- Avoid bottlenecks at choke points (firewall, NVA, gateway).

## 5. Failover
- HA pairs for firewall, VPN gateway.
- BGP for dynamic routing where possible.
- ECMP for multipath.
- Test failover quarterly (planned outage drill).

## 6. Vendor selection
- Single-vendor simpler; multi-vendor avoids lock-in.
- Right-size: don't buy enterprise iron for SMB needs.
- Support contracts, end-of-life dates, replacement cadence.

## 7. Observability
- NetFlow / sFlow / IPFIX exports.
- Packet capture tap or SPAN ports at key chokepoints.
- SIEM ingestion for security signals.
- Network performance monitoring (NPM) for end-to-end latency, loss.

## 8. Related Articles
- l2-networking-001 — Operational troubleshooting
- l3-security-001 — Network is in scope of IR

## 9. Keywords
network architecture, segmentation, zero trust, sd-wan, hub spoke, microsegmentation, vlans, firewall, nva
