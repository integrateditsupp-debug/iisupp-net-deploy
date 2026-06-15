---
id: l1-network-002
title: "Ethernet says 'Unidentified network' — fix wired connection"
category: networking
support_level: L1
severity: medium
estimated_time_minutes: 8
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
keywords:
  - unidentified network
  - ethernet no internet
  - public network ethernet
  - no network access
  - apipa 169.254
  - ethernet cable plugged in no internet
  - ethernet limited
  - network discovery off
tags:
  - networking
  - ethernet
  - dhcp
  - top-50
related: [l1-wifi-002-connected-no-internet, l1-internet-001-no-internet-at-all]
---

# Ethernet "Unidentified network"

### IP address starts with 169.254 — DHCP isn't responding

Your machine couldn't get an IP from the network. Either the cable isn't truly connected to a live port OR the DHCP server is down. Check: Windows admin cmd → `ipconfig /all` → look at "Autoconfiguration IPv4 Address." If it shows 169.254.x.x, that's APIPA = no DHCP. Try a different port / different cable / restart the switch you're plugged into.

### Renew IP — sometimes just needs a kick

Windows: admin cmd → `ipconfig /release` → `ipconfig /renew`. Mac: System Settings → Network → Ethernet → Details → TCP/IP → "Renew DHCP Lease." iPhone tethering: airplane on/off. Wait 30 seconds. Re-check IP.

### Cable is fine, port is fine, but still no internet

Driver mismatch. Device Manager → Network adapters → right-click your Ethernet adapter → "Uninstall device" (check "Delete the driver software"). Reboot. Windows reinstalls the default driver. If still broken, download latest from your laptop manufacturer's site (HP, Dell, Lenovo, etc.). Don't trust "Update driver" in Device Manager — Microsoft's catalog is often stale.

### "Public network" instead of "Private" — limited features

Windows treats unidentified networks as Public by default, blocking file sharing and discovery. To switch: Settings → Network & Internet → Ethernet → click the network → change profile to **Private** (only if you trust this network — your home or office). For Public networks, leave as Public.

### Cable is loose / port LED off

Visual check at both ends. Activity LED (usually amber/orange) on the Ethernet port indicates physical link. No LED = no link = cable bad or port dead. Try a known-good cable. Try a different port on the switch/router. If laptop has a USB-C dock providing Ethernet, the dock may be the issue — bypass and plug straight in.

### USB-C dock Ethernet inconsistent

USB-C docks (Dell WD19, HP USB-C Universal Dock, CalDigit TS3+, etc.) often drop Ethernet after sleep. Symptom: works after fresh boot, breaks after first laptop sleep. Fix: unplug dock from laptop, replug. Or: Settings → Power Options → uncheck "Allow the computer to turn off this device to save power" on the dock and Ethernet adapter.

### Cisco SecureClient / corporate NAC blocking

Corporate networks may require posture check (antivirus running, OS patches up to date) before granting full access. You're on Ethernet but stuck on a guest VLAN. Visible signs: only some internal sites work, can't reach file shares. Run Cisco SecureClient / Forescout / Aruba ClearPass posture check if installed. Or wait for it to auto-trigger after sign-in.

### Restart the network adapter

Windows: Win + X → Network Connections → right-click Ethernet → Disable → wait 10 sec → Enable. Mac: System Settings → Network → Ethernet → Make Inactive → wait → Make Active. Often clears stuck driver state.

### When to escalate to L2

Cable + port + driver all replaced/refreshed, still no internet on wired but Wi-Fi works fine. Multiple users on the same switch report same issue → switch port/VLAN config or PoE limit. Working in office but not in conference room — possibly different VLAN that needs whitelisting your MAC. Cisco posture check fails repeatedly → endpoint security review.
