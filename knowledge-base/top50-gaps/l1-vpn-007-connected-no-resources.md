---
id: l1-vpn-007
title: "VPN says connected but can't reach file shares or intranet"
category: vpn
support_level: L1
severity: high
estimated_time_minutes: 8
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
keywords:
  - vpn connected no access
  - cant reach intranet
  - file share not accessible vpn
  - dns resolution vpn
  - split tunnel issue
  - vpn doesnt route internal
  - flush dns vpn
  - ipconfig all vpn
  - internal site times out
tags:
  - vpn
  - networking
  - top-50
related: [l1-vpn-001-cant-connect, l1-vpn-ivanti-001-ivanti-secure-access-connect, l2-vpn-001-gateway-and-certs]
---

# VPN connected, internal resources unreachable

### Test 1 — Can you ping an internal IP?

Open Command Prompt (Win+R → cmd) or Terminal (Mac). Type: `ping 10.0.0.1` (replace with an actual internal server IP if you know one, or your gateway). If ping replies → VPN is routing correctly, the issue is DNS or permissions. If ping times out → VPN tunnel isn't actually carrying traffic; the connection looks up but isn't routing. Reconnect VPN, escalate if it persists.

### DNS isn't resolving internal hostnames

Most common after split-tunnel VPNs reconnect. Try: `nslookup internalserver.company.local`. If it fails or returns external IPs, your DNS is pointing at the wrong server. Flush DNS: Windows `ipconfig /flushdns` (admin cmd). Mac `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`. Reconnect VPN. If still failing, your VPN's DNS suffix list is missing — that's L2.

### Internal site loads slowly or partial — split-tunnel routing some traffic outside

Split-tunnel VPN routes only specific subnets through the tunnel; everything else (including some intranet servers if misconfigured) goes via your home internet. Symptom: some internal sites work, others don't. Check VPN client status: does it show "Full tunnel" or "Split tunnel"? If split, ask IT which subnets are tunneled and whether the missing resource should be added. L2 task.

### Mapped network drives show red X after VPN connect

Windows mapped drives are sticky to the network state at boot. Reconnect drives manually: Win+R → `\\fileserver\share` → Enter. If it opens, drive credentials propagated; remap with persistent option. If it times out, the file server's IP changed or it's on a subnet not routed by your VPN — L2.

### Browser intranet works, ping doesn't

Browser uses your VPN's proxy; ping uses raw ICMP which may be blocked at the firewall on purpose. Don't trust ping as the only diagnostic. Try opening the intranet URL directly in a browser. If browser works → VPN is fine for HTTP, ICMP is blocked (normal corporate policy). If browser fails → real connectivity problem.

### VPN dropped silently — status says connected but isn't

Common with Ivanti and Cisco AnyConnect after long idle. Tunnel status shows green but traffic isn't moving. Force-disconnect: VPN client → Disconnect button. Wait 5 seconds. Reconnect. Test ping to internal IP again. If happens repeatedly, your idle-timeout setting needs adjustment — L2 reviews client config.

### Routes are wrong — VPN didn't push the right routes

Command line check: Windows `route print` → look for entries for your company's internal subnets. Mac `netstat -nr | grep "10\.\|192\.168\."`. If your VPN should route 10.x.x.x but no route exists for it, the VPN policy didn't push it. Disconnect + reconnect. Still missing → L2 fixes the VPN profile.

### When to escalate to L2

Ping fails to internal IPs after VPN reconnect → tunnel routing issue. DNS suffix list missing or wrong → VPN profile config. Split-tunnel needs a new subnet added → policy change. Mapped drives need updated server IPs → file server team. Cert errors on connect → certificate renewal needed.
