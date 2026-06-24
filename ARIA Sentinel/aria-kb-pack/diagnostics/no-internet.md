# No Internet Connection

## Symptom: The computer cannot reach websites or online services.
> User phrasings: "no internet", "can't get online", "internet not working", "no connection"

### Cause: DNS resolver failure
**Probability:** 24%
**Detection:** IP addresses ping but names do not resolve; network-source errors may appear in eventLog.errorsBySubsystem and nslookup fails while ping 1.1.1.1 succeeds.
**Safe diagnostic:** Run read-only checks: nslookup example.com and Get-DnsClientServerAddress to inspect current DNS.
**Safe fix:** With user confirmation, flush DNS (ipconfig /flushdns) and optionally set a reliable resolver.
**Escalation:** If name resolution still fails, escalate to verify DNS at the router/ISP level.

### Cause: Adapter disabled / APIPA address
**Probability:** 22%
**Detection:** The NIC holds a 169.254.x.x APIPA address meaning no DHCP lease; adapter state shows down in Get-NetAdapter.
**Safe diagnostic:** Read adapter status read-only via Get-NetAdapter and Get-NetIPAddress to spot APIPA or disabled state.
**Safe fix:** With user confirmation, renew the lease (ipconfig /release then /renew) or re-enable the adapter.
**Escalation:** If no DHCP lease is obtained, escalate to check cabling, switch port, or DHCP server.

### Cause: Router/modem offline
**Probability:** 20%
**Detection:** Multiple devices are also offline and the default gateway does not respond to ping.
**Safe diagnostic:** Read the gateway via ipconfig and ping it read-only to confirm local-network reachability.
**Safe fix:** With user confirmation, power-cycle the modem/router (off 30 seconds, then on) per user action.
**Escalation:** If the gateway stays unreachable after a reboot, escalate to ISP/network hardware support.

### Cause: Firewall/VPN blocking
**Probability:** 14%
**Detection:** Connectivity drops only with a VPN/security tool active; check eventLog.errorsBySubsystem for firewall/filter-driver events.
**Safe diagnostic:** Read firewall profile and VPN status read-only via Get-NetFirewallProfile and Get-VpnConnection.
**Safe fix:** With user confirmation, disconnect the VPN or toggle the blocking rule temporarily to test.
**Escalation:** If a misconfigured policy is blocking traffic, escalate to IT to correct the firewall/VPN config.

### Cause: Outdated network driver
**Probability:** 12%
**Detection:** Intermittent drops or adapter resets; NIC errors appear in eventLog.errorsBySubsystem under the network source.
**Safe diagnostic:** Read driver version read-only via Get-NetAdapter | Select Name,DriverVersion.
**Safe fix:** With user confirmation, update the network driver via Windows Update or vendor package.
**Escalation:** If drops persist after updating, escalate for driver rollback or NIC hardware check.

### Cause: ISP outage
**Probability:** 8%
**Detection:** Local LAN works and the gateway responds, but no traffic reaches the internet; no local eventLog.errorsBySubsystem network faults.
**Safe diagnostic:** Read whether the gateway is reachable but external pings fail to confirm an upstream issue.
**Safe fix:** With user confirmation, advise checking the ISP status page or contacting the ISP.
**Escalation:** If the ISP confirms an outage, document the ticket and wait for restoration.
