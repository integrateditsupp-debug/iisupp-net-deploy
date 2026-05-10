---
id: l2-dhcp-001
title: "DHCP scope exhaustion / clients getting APIPA / lease conflicts"
category: dhcp
support_level: L2
severity: high
estimated_time_minutes: 25
audience: admin
prerequisites: ["DHCP server admin"]
os_scope: ["Windows Server 2016+"]
keywords:
  - dhcp
  - apipa
  - 169.254
  - scope exhaustion
  - lease
  - reservation
  - failover
  - rogue dhcp
related_articles:
  - l1-wifi-001
  - l2-dns-001
escalation_trigger: "Rogue DHCP detected, or fleet IP conflicts, or scope cannot be expanded due to subnet limits"
last_updated: 2026-05-07
version: 1.0
---

# DHCP scope exhaustion / lease issues

## 1. Symptoms
- Clients receiving 169.254.x.x (APIPA).
- "IP address conflict" notifications.
- New devices cannot obtain IP.
- Lease pool ~95% utilized.
- Rogue DHCP suspected (unexpected gateway returned).

## 2. Causes
1. Pool too small for number of devices (BYOD growth).
2. Lease duration too long → expired devices still hold IPs.
3. Rogue DHCP on subnet (consumer router plugged in).
4. DHCP failover misconfigured.
5. DHCP guard not enabled on switches.
6. Reservations conflict with dynamic range.

## 3. Resolution
**Scope expansion:**
- Subnet has room → extend scope range.
- Subnet maxed → re-architect to /23 or new VLAN.

**Lease duration:**
- Reduce from 8 days to 1–4 days for high-churn networks (BYOD, guest).

**Rogue DHCP:**
- `Get-DhcpServerInDC` (authorized servers).
- Network capture (`tcpdump port 67 or port 68`) on subnet to see who else is offering leases.
- Locate by MAC → switch port → physical disconnect.
- Enable DHCP Snooping on switches.

**Failover health:**
- `Get-DhcpServerv4Failover` — state should be "Normal".
- Re-sync if "Recover" / "Communication Interrupted".

## 4. Verification
- New client gets valid IP within seconds.
- Pool utilization drops below 70%.
- No 169.254 reports.
- Failover state Normal.

## 5. Escalation Trigger
- Rogue DHCP source can't be located.
- Subnet cannot expand (legacy hardcoded).
- Persistent IP conflicts after lease cycle.
- → Escalate to **L3 / Network Architecture**.

## 6. Prevention
- Right-size scope: total devices × 1.5.
- Lease 1–2 days for laptops, 4–8 for static-ish desktops.
- DHCP Snooping + IP Source Guard on switches.
- Document reservations.
- Monitor scope utilization >70% as warning.

## 7. Internal Notes
- DHCP failover modes: load-balance (50/50) vs hot-standby. Hot-standby simpler for small estates.
- Stats: `Get-DhcpServerv4ScopeStatistics`.
- Rogue detection (Windows): DHCP service refuses to start if not authorized in AD.
- For IPv6 scopes, use SLAAC + DHCPv6 thoughtfully — many clients use SLAAC by default.

## 8. Related Articles
- l1-wifi-001 — Client APIPA symptom
- l2-dns-001 — DNS often co-located with DHCP

## 9. Keywords
dhcp, apipa, 169.254, scope exhaustion, lease, reservation, failover, rogue dhcp
