---
id: l2-rdp-001
title: "Remote Desktop (RDP) / RDS connection issues"
category: rdp
support_level: L2
severity: medium
estimated_time_minutes: 25
audience: admin
prerequisites: ["RDS / Server admin", "AD"]
os_scope: ["Windows Server 2016+", "Windows 10/11 RDP"]
keywords:
  - rdp
  - remote desktop
  - rds
  - terminal server
  - rd gateway
  - cant connect
  - certificate
  - licensing grace period
related_articles:
  - l1-vpn-001
  - l2-vpn-001
  - l3-networking-001
escalation_trigger: "Mass RDS outage, license server failure, or session host capacity exhausted"
last_updated: 2026-05-07
version: 1.0
---

# Remote Desktop / RDS issues

## 1. Symptoms
- "Remote Desktop can't connect to remote computer".
- Black screen after authentication.
- "The remote session was disconnected because there are no Remote Desktop License Servers available".
- "Your computer can't connect to the remote computer because the Remote Desktop Gateway server is temporarily unavailable".
- Frequent disconnects.

## 2. Causes
1. Network unreachable / firewall blocking 3389.
2. NLA mismatch (client doesn't support).
3. RD Gateway cert expired.
4. Licensing grace period (120 days) expired without proper RDS CALs.
5. Session host overloaded.
6. UDP path issues (RDP uses UDP for performance, falls back to TCP).
7. Profile load failure (FSLogix / UPD).

## 3. Resolution
**Network / firewall:**
- Test reachability: `Test-NetConnection <host> -Port 3389`.
- For RD Gateway: 443 TCP/UDP.

**Cert expired (RD Gateway / Connection Broker):**
- Renew SSL cert; bind via Server Manager → Remote Desktop Services → Edit Deployment → Certificates.

**Licensing grace expired:**
- Server Manager → RD Licensing Diagnoser.
- Activate license server, install per-user/per-device CALs.

**Profile load failure (FSLogix):**
- Check user's profile container (`Profile_<username>.vhd(x)`) on storage path.
- Look at FSLogix Apps logs in `%programdata%\FSLogix\Logs\`.
- Common: storage path unreachable, container locked by previous session, disk full.

**Session host overload:**
- Server Manager → RDS deployment → check session count vs capacity.
- Scale out: add session host, rebalance.

## 4. Verification
- User connects in <15 seconds.
- Profile loads cleanly.
- App suite responsive.
- 30-min idle without disconnect.

## 5. Escalation Trigger
- Mass outage (>10 users).
- License server fails to activate.
- Session host crash loop.
- → **L3**.

## 6. Prevention
- Document license model and CAL count.
- Monitor session host CPU/RAM/profile-load times.
- Cert expiry alerts at 90/30/7 days.
- Use Connection Broker for HA.
- For Azure Virtual Desktop, use Azure Monitor / Log Analytics.

## 7. Internal Notes
- RDP UDP transport: `gpedit → Computer Config → Admin Templates → Windows Components → Remote Desktop Services → Remote Desktop Connection Client → Turn Off UDP On Client`.
- For "Black screen", `gpedit → ...→ Remote Session Environment → Use hardware default graphics adapter for all RDS sessions`.
- FSLogix container disk performance: avoid SMB over slow links — use Azure Files Premium / FSx.
- For AVD: stuck session → drain mode + log off via Azure Portal.

## 8. Related Articles
- l2-vpn-001 — Often paired with RDP for remote
- l3-networking-001 — Network architecture

## 9. Keywords
rdp, remote desktop, rds, terminal server, rd gateway, cant connect, certificate, licensing grace period
