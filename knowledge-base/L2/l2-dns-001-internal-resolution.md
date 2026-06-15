---
id: l2-dns-001
title: "DNS: internal name resolution failing / split-brain issues"
category: dns
support_level: L2
severity: high
estimated_time_minutes: 30
audience: admin
prerequisites: ["DNS server admin", "AD permissions"]
os_scope: ["Windows Server 2016+"]
keywords:
  - dns
  - name resolution
  - split brain
  - conditional forwarder
  - stub zone
  - dns scavenging
  - srv records
  - aging
related_articles:
  - l1-wifi-001
  - l3-networking-001
  - l2-active-directory-001
escalation_trigger: "Replication failure, root hint corruption, or DNS poisoning suspected"
last_updated: 2026-05-07
version: 1.0
---

# DNS: internal name resolution failing

## 1. Symptoms
- Internal hostname doesn't resolve from clients but pings by IP works.
- External DNS works, internal doesn't (split-brain mismatch).
- DCs cannot replicate (DNS is foundational).
- Stale records causing wrong-host responses.
- Long resolution times (>2s for internal).

## 2. Common Causes
1. Client using public DNS (8.8.8.8) instead of internal DC DNS.
2. Conditional forwarder missing or pointing to dead IP.
3. Aging/scavenging mis-configured → stale or missing records.
4. Replication broken between DCs.
5. _msdcs zone delegation broken.
6. DNS service not running on DC.

## 3. Diagnosis
1. On client: `ipconfig /all` — confirm DNS servers point to internal DCs.
2. `nslookup <internal-host>` — check authoritative response.
3. `nslookup _ldap._tcp.dc._msdcs.<domain>` — should list DCs.
4. On DC: `dcdiag /test:dns /v` — comprehensive DNS health.
5. `Get-DnsServer | fl` and check zones.
6. `repadmin /replsummary` — replication health.

## 4. Resolution Pathways
**Client mis-configured:**
- DHCP scope must hand out internal DNS only (not public). Update scope.
- Static-IP devices: correct manually.

**Conditional forwarder broken:**
- DNS Manager → forward lookup zones → adjust forwarders / conditional forwarders.

**Stale records:**
- Enable aging on relevant zones (Properties → Aging, no-refresh 7 / refresh 7).
- Run scavenging once cleanly.

**Replication:**
- `repadmin /syncall /A /e /P` — force replication.
- `dcdiag /test:replications` to identify lag/source.

**Service down:**
- `Restart-Service DNS` — confirm event log clean after.

**_msdcs delegation:**
- Verify _msdcs zone exists, delegated, replicated to all DCs in forest.

## 5. Verification
- `nslookup` returns correct results from clients.
- `dcdiag /test:dns` clean.
- `repadmin /replsummary` no errors.
- 24h with no DNS-related ticket.

## 6. Escalation Trigger
- Replication failure persists after sync attempts.
- Suspected DNS poisoning (wrong answers from authoritative).
- Forest-wide DNS outage.
- → Escalate to **L3 / Architecture**.

## 7. Prevention
- Always point AD-joined clients to AD-integrated DNS (DCs), never to public.
- Enable aging on all dynamic zones; run scavenging weekly.
- Monitor DNS event log + replication daily.
- Document forwarders, conditional forwarders, secondary zones.
- Don't expose internal DNS to internet.

## 8. Internal Notes
- AD-integrated zones replicate via AD; non-integrated zones via DNS NOTIFY/AXFR.
- `dnscmd /info /version` shows DNS server version + flags.
- `Get-DnsServerStatistics` for performance.
- For conditional forwarders, store-in-AD makes them replicate; otherwise per-DC.
- For Azure private zones / hybrid scenarios, use Azure DNS Private Resolver as the conduit.

## 9. Related Articles
- l1-wifi-001 — Client-side DNS issues
- l2-active-directory-001 — AD foundational
- l3-networking-001 — Architecture

## 10. Keywords
dns, name resolution, split brain, conditional forwarder, stub zone, dns scavenging, srv records, aging
