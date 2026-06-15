---
id: l2-vpn-001
title: "VPN gateway, certificates, and Always-On profile management"
category: vpn
support_level: L2
severity: high
estimated_time_minutes: 45
audience: admin
os_scope: ["Windows 10", "Windows 11", "macOS"]
prerequisites: ["VPN gateway admin", "PKI / cert authority access"]
keywords:
  - vpn gateway
  - certificate expired
  - aovpn
  - always on vpn
  - device tunnel
  - user tunnel
  - rras
  - ikev2
related_articles:
  - l1-vpn-001
  - l3-networking-001
escalation_trigger: "Gateway capacity exhausted, or PKI compromise, or fleet-wide cert reissuance"
last_updated: 2026-05-07
version: 1.0
---

# VPN gateway, certs, Always-On profile management

## 1. Symptoms
- Multiple users / devices fail to connect.
- "Certificate validation failed" on AnyConnect / GlobalProtect / AOVPN.
- Always-On VPN device tunnel up but user tunnel fails.
- Connection succeeds but routes wrong / DNS wrong.
- Concurrent user limit hit.

## 2. Common Causes
1. Server cert expired or chain broken.
2. CRL / OCSP unreachable from internet.
3. Client cert expired or revoked.
4. License / concurrent connection cap.
5. Routing / split-tunnel ACL change.
6. AOVPN profile XML out of sync after Intune push.

## 3. Resolution Pathways
**Server cert renewal:**
1. Generate CSR on gateway (or use ACME if supported).
2. Sign via internal PKI or public CA.
3. Install on gateway; chain order matters.
4. Restart VPN listener service.
5. Verify with `openssl s_client -connect vpn.company.com:443 -showcerts`.

**Client cert reissue (corporate PKI):**
1. Confirm `Computer` cert template's autoenroll GPO/Intune SCEP config.
2. Trigger renewal: `certutil -pulse` or wait for auto-renew threshold.
3. Verify cert chain on client: `certmgr.msc → Personal → Certificates`.
4. Push new profile to client if cert subject changed.

**CRL / OCSP unreachable:**
- Confirm CDP URL in cert is internet-reachable (publish CRL to a CDN / public web server).
- For internal-only CRL, ensure VPN gateway can reach it pre-tunnel.

**AOVPN profile drift:**
- Pull current profile XML from working device: `Get-VpnConnection -AllUserConnection | Out-File`.
- Compare to source XML in Intune.
- Repush profile via Intune; force sync on client.

**Capacity exhausted:**
- License: check vendor portal — increase if undersized.
- Tunnel concurrency: scale gateway out (redundant gateways behind load balancer).

## 4. Verification
- Test users sign in cleanly.
- Cert chain valid + expiry >90 days out.
- `Get-NetIPConfiguration` on client shows VPN tunnel adapter with correct DNS suffix.
- Internal site loads (DNS resolves through tunnel).

## 5. Escalation Trigger
- PKI compromise (issue revocation lists, mass reissue).
- Gateway HA failover misbehavior.
- Concurrent capacity issue requires capex.
- → Escalate to **L3 / Architecture**.

## 6. Prevention
- Monitor cert expiry — at 90/30/7-day thresholds.
- Document AOVPN profile XML in source control.
- Keep gateway firmware on N or N-1.
- Use ACME for public-facing gateway certs (auto-renewal).
- Capacity planning quarterly.

## 7. Internal Notes
- AnyConnect logs (server side): `/var/log/asa.log`, `show vpn-sessiondb`.
- AOVPN debug: `Microsoft-Windows-VPN-Client/Operational` log; `Get-VpnConnection -Name <name> | fl`.
- Device tunnel runs as SYSTEM, requires machine cert; user tunnel requires user cert (or EAP-TLS).
- For RRAS: `netsh ras show authmode` and `netsh ras set tracing * enabled`.
- Conditional Access for VPN: tag the VPN app, require compliant device — keeps external/managed boundaries clear.

## 8. Related Articles
- l1-vpn-001 — User-facing VPN troubleshooting
- l3-networking-001 — Network architecture deep dive

## 9. Keywords
vpn gateway, certificate expired, aovpn, always on vpn, device tunnel, user tunnel, rras, ikev2
