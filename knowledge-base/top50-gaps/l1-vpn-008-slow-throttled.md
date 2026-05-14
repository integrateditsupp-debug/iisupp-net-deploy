---
id: l1-vpn-008
title: "VPN is connected but everything is slow — diagnose the throttle"
category: vpn
support_level: L1
severity: medium
estimated_time_minutes: 10
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
keywords:
  - vpn slow
  - vpn throttle
  - slow when connected to vpn
  - everything slow on vpn
  - intranet sluggish
  - vpn bandwidth
  - speedtest while on vpn
  - vpn protocol switch
  - tcp udp vpn
tags:
  - vpn
  - performance
  - top-50
related: [l1-vpn-007-connected-no-resources, l1-internet-002-slow-but-connected]
---

# VPN is slow

### Test 1 — Speed without vs with VPN

Disconnect VPN. Go to fast.com or speedtest.net. Note download speed. Reconnect VPN. Test again. Drop more than 50%? That's VPN-side throttling. Drop less than 20%? Normal overhead, the real issue is upstream internet (see KB l1-internet-002). Equal? Something else (DNS, route).

### Switch VPN protocol — TCP → UDP usually 2x faster

Most enterprise VPN clients (Ivanti, Cisco AnyConnect, GlobalProtect) default to TCP for compatibility but support UDP for speed. TCP-over-TCP is slow ("TCP meltdown" on bad networks). In the VPN client settings, switch to UDP if available. Reconnect, retest speed.

### Server choice — pick the closest gateway

If your VPN client lets you choose a gateway, pick the geographically closest one. Toronto user connecting to a Frankfurt gateway = 100ms+ added latency, half the speed. Some clients auto-pick — verify in client settings or status panel.

### Split-tunnel — exclude high-bandwidth apps

If your VPN routes ALL traffic through corporate, YouTube and Zoom calls eat your tunnel bandwidth. Ask IT to enable split-tunnel for trusted SaaS apps (Teams, Zoom, OneDrive, YouTube) so they bypass the VPN. Saves 60-90% of bandwidth for actual corporate traffic.

### Wi-Fi is the bottleneck, not VPN

Run speedtest first on Wi-Fi WITHOUT VPN. If you're getting 30 Mbps over Wi-Fi but you pay for 500 Mbps, your Wi-Fi is the issue. Move closer to router, switch to 5 GHz band, or use Ethernet. VPN can't be faster than your underlying link.

### Antivirus is scanning every VPN packet

Enterprise antivirus deep-packet-inspects VPN traffic. Symptoms: CPU pegged when VPN active, network slow. Temporarily disable AV → retest speed. If huge difference, work with IT to add VPN client to AV exclusions.

### MTU mismatch — packets getting fragmented

Rare but possible. Symptoms: web pages load partial or images broken on VPN only. Windows admin cmd: `ping -f -l 1472 8.8.8.8` — if it says "Packet needs to be fragmented but DF set," your MTU is too high. Set VPN client MTU to 1400 (most clients have this in advanced settings). Restart VPN.

### Two VPN clients installed at once — fighting

If you have both Cisco AnyConnect AND Ivanti AND GlobalProtect installed (e.g., from old jobs), they can fight over network adapters even when only one is "connected." Uninstall the ones you don't actively use. Restart.

### Speed test on VPN gateway directly

If your IT exposes an internal speedtest server, use it. Tells you the speed inside the tunnel without external internet interference. If internal is fast but external is slow, the corporate egress proxy/firewall is the bottleneck — L2 problem.

### When to escalate to L2

Speed cut >70% on VPN even after protocol switch + closest gateway. AV exclusion didn't help. Whole team complains the VPN is slow today → gateway concentrator is overloaded, L2 scales it. Specific apps slow but internet OK → DPI / proxy filtering specific traffic → L2 reviews policy.
