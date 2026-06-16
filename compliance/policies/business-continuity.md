# Business Continuity & Disaster Recovery Plan

**Owner:** Ahmad Wasee, CISO  |  **Version:** 1.0  |  **Effective:** 2026-06-15  |  **Review:** Annual + after any major incident

## Purpose

Ensure ARIA SaaS service remains available, customer data remains recoverable, and operations resume rapidly after disruption. Aligned with SOC 2 CC7.5, A1.2, NIST SP 800-34.

## Risk scenarios

| Scenario | Likelihood | Impact | Primary mitigation |
|---|---|---|---|
| Netlify regional outage | Low (annual) | High (full site down) | Tier-2 local KB bundle serves; status page; Netlify multi-region edge |
| Droplet outage / corruption | Low (quarterly) | Medium (Tier-1 RAG degrades; Tier-2 fallback) | Daily snapshots; replication to secondary region for Enterprise |
| Database corruption | Very low | High | Daily snapshots; logical replication; restore tests quarterly |
| Sub-processor breach | Low | Medium-High | Vendor mgmt + DPA; rotate immediately |
| Founder unavailability | Low | High | Documented runbooks; backup operators on payroll once revenue supports |
| DDoS attack | Medium (any year) | Medium | Netlify CDN + Cloudflare absorb; rate limiting at function level |
| Ransomware on dev workstation | Low | Medium | Git as source of truth; no production-write from workstation |
| Critical vulnerability in dependency | Medium | High | Dependabot; patch SLA enforced |
| Cyber liability event | Very low | Catastrophic | Insurance (target ≥ $5M, in procurement) |

## Recovery time objectives (RTO) / Recovery point objectives (RPO)

| Service | RTO | RPO | Tier |
|---|---|---|---|
| iisupp.net website | 15 min | 0 (atomic Netlify rollback) | All |
| ARIA chat (Tier-2 local) | 0 (already-cached locally) | N/A | All |
| ARIA chat (Tier-1 RAG) | 4 hours | 24 hours | SBA |
| ARIA chat (Tier-1 RAG) | 30 min | 5 min | Mid-Size |
| ARIA chat (Tier-1 RAG) | 15 min | 5 min | Enterprise (multi-region) |
| Aperture observability | 4 hours | 1 hour | All |
| Stripe billing | 0 (Stripe responsibility) | 0 | All |

## Recovery procedures

### Netlify outage
1. Verify outage at netlifystatus.com.
2. Communicate to customers via status page + email.
3. Tier-2 local bundle continues serving (cached at customer browser).
4. Await Netlify resolution; verify when restored.
5. Post-incident review within 5 business days.

### Droplet outage
1. Verify via droplet console.
2. Attempt restart from DigitalOcean dashboard.
3. If unrecoverable, restore from most recent snapshot (RPO 24h).
4. ARIA falls back to Tier-2 local KB automatically — no user impact for top-50 topics.
5. Re-ingest any KB delta after restoration.

### Database corruption
1. Stop writes (set droplet to read-only).
2. Identify corruption scope.
3. Restore from last clean snapshot.
4. Replay WAL if available.
5. Re-ingest customer data delta from Aperture log replay if needed.

### Founder unavailability
1. Documented runbooks accessible to backup operators (when hired).
2. Insurance / continuity plan for key person risk.
3. Customer notification per SLA.

## Backups

- **Code:** git on GitHub (multi-region replicated by GitHub).
- **Data:** daily droplet snapshots (DigitalOcean, 7-day retention by default; extend to 90-day for $5/mo).
- **Configuration:** Netlify config in git.
- **Secrets:** Netlify env vars (encrypted) + offline encrypted backup (1Password vault) for emergency recovery.
- **Backup encryption:** AES-256.
- **Restore testing:** quarterly. Documented in `governance/dr-test-log.md`.

## Multi-region architecture (Enterprise tier)

- **Primary:** DigitalOcean Toronto.
- **Secondary (Enterprise):** DigitalOcean Frankfurt or NYC (customer choice).
- **Replication:** Postgres logical replication; lag monitored.
- **Failover:** DNS-based (Cloudflare or Netlify Edge).
- **Failback:** automated when primary recovers.

## Customer obligations

- Maintain own backups of customer-uploaded KB content (we provide export but customer is primary custodian).
- Configure failover-aware DNS for custom domains.

## Communication during disruption

- **Customer notification:** within SLA per severity tier.
- **Status page:** updated every 15 min during P1, hourly during P2.
- **Post-incident report:** within 5 business days.

## Testing

- **Annual:** full-scale BCP exercise (simulated regional outage).
- **Quarterly:** tabletop + technical restore drill.
- **After any RFC:** affected procedures retested.

## Related

- `compliance/policies/incident-response.md`
- `compliance/SOC2-controls-self-assessment.md` CC7.5 + A1
- `aria-architecture/2M-ASSET-REQUIREMENTS.md` Section 7
