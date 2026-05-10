---
id: l2-networking-001
title: "Network troubleshooting: latency, packet loss, MTU, switching"
category: networking
support_level: L2
severity: medium
estimated_time_minutes: 45
audience: admin
prerequisites: ["Network admin / read access to switches"]
os_scope: ["Multi-platform"]
keywords:
  - latency
  - packet loss
  - mtu
  - jumbo frames
  - traceroute
  - mtr
  - pmtud
  - duplex
  - errors
related_articles:
  - l1-wifi-001
  - l2-dns-001
  - l3-networking-001
escalation_trigger: "Pattern points to ISP, infrastructure replacement needed, or capacity exhausted"
last_updated: 2026-05-07
version: 1.0
---

# Network deep troubleshoot

## 1. Symptoms
- Slow file transfers, high latency.
- Periodic packet loss / ping spikes.
- VPN / RDP disconnects.
- Specific app slow but speedtest fine.

## 2. Diagnostic toolkit
- `ping -t <host>` — quick loss/latency check.
- `mtr -i 1 -c 100 <host>` (or pathping/tracert) — per-hop loss.
- `iperf3` — throughput between two endpoints.
- `Test-NetConnection -InformationLevel Detailed` — RTT + port + diagnostic.
- Packet capture: Wireshark, Microsoft Message Analyzer.

## 3. Common findings + fixes
- **Hop X has 30% loss while X+1 doesn't:** routing/asymmetry on hop. Often fine if return path is clean.
- **Real loss on first hop:** local switch/cable issue. Check switch port errors (`show interface`).
- **MTU issues (works for small packets, breaks for large):** PMTUD broken. Lower MSS / clamp on edge: `iptables -A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu`.
- **Duplex mismatch:** auto-negotiation failed; force Gigabit full-duplex on both sides.
- **Jumbo frame mismatch:** end-to-end MTU must agree (1500 default; jumbo 9000 if all kit supports).
- **App slow but bandwidth fine:** likely app-level / DNS / TLS — capture and look at handshake times.

## 4. Verification
- 0% loss baseline over 100 pings.
- Throughput ≥ link speed × 80%.
- No errors / discards on switch port.
- App responsive under load.

## 5. Escalation
- ISP-side issue: open carrier ticket with mtr trace + timestamps.
- Hardware replacement.
- Architecture redesign needed.
- → L3 / Vendor.

## 6. Prevention
- Monitor switch errors continuously.
- Cable test on install; label every patch.
- Standard MTU 1500 unless infra all-jumbo.
- Avoid auto-negotiation in legacy environments — configure explicitly.
- Capacity plan: monitor link utilization, upgrade at 70%.

## 7. Notes
- Wi-Fi adds variability; wired is the truth source for diagnosis.
- ICMP can be deprioritized; use `Test-NetConnection -Port` for TCP RTT.
- TCP RWIN issues on long-haul: tune via `netsh int tcp` autotuning.

## 8. Related
- l1-wifi-001 — User-side
- l2-dns-001 — DNS
- l3-networking-001 — Architecture

## 9. Keywords
latency, packet loss, mtu, jumbo frames, traceroute, mtr, pmtud, duplex, errors
