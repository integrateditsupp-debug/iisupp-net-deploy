# Disaster Recovery Runbook — IIS / ARIA

**Owner:** Ahmad Wasee
**Last reviewed:** 2026-06-18
**RTO target:** 4 hours
**RPO target:** 24 hours

---

## Component-level DR

### Netlify (hosting + functions + Blobs)
- **Primary region:** US-East (default)
- **Available CA region:** Yes, configurable per-site
- **Backup:** aria-backup-cron weekly Sunday 02 UTC snapshots all 15 source blob stores into aria-backup-store w/ 12-week retention
- **Restore procedure:**
  1. From Netlify dashboard, rollback to previous deploy (instant)
  2. Re-fetch latest backup blob: `aria-backup-store/snapshot-<storeName>-<YYYY-MM-DD>`
  3. Restore via `getStore('aria-<store>').setJSON(key, value)` per entry from snapshot.data

### Anthropic Claude API
- **Failover:** Circuit breaker in `_circuit-breaker.js` trips after 5 failures, returns 60s cooldown
- **Degraded mode:** aria-chat.js detects API down + returns degraded response w/ retry hint
- **Alternative model:** Claude Haiku 4.5 is cheap fallback if Sonnet/Opus overloaded
- **Manual override:** set `ARIA_FORCE_DEGRADED=true` env var to force-show degraded UX

### Stripe (billing)
- **Failover:** none needed — Stripe has 99.99% SLA + multi-region
- **If Stripe goes down:** show maintenance banner; payments queue locally; reconcile when up
- **Webhook resilience:** stripe-webhook.js has signature verification + idempotency

### Resend (email)
- **Failover:** If Resend down >1h, queue email body in aria-email-queue blob; flush when up
- **Alternative:** SMTP fallback via Gmail SMTP (already wired in aria-resend-helper.mjs)

### DNS / domain
- **Registrar:** (Ahmad to confirm)
- **DNS provider:** Netlify DNS (or third-party)
- **TTL:** 300s on critical records (allows fast change if needed)
- **If DNS provider down:** point nameservers to Cloudflare free tier as emergency

---

## Scenario runbooks

### Scenario 1 — Netlify outage (whole site down)
1. Confirm outage via netlifystatus.com
2. Post on /status.html (if reachable) and LinkedIn
3. If outage >2h: spin up emergency Cloudflare Pages mirror from latest git main (~10 min)
4. Update DNS A records (TTL 300s) to point to Cloudflare
5. Communicate ETA to active customers via Resend OR direct email

### Scenario 2 — Anthropic API outage
1. aria-chat.js auto-detects + returns degraded message ("ARIA is having a moment...")
2. Circuit breaker opens; no further calls for 30s cooldown
3. Customers can still use the KB articles directly via knowledge-base/ files
4. Send Ahmad alert via aria-governor-alert-cron
5. ETA: usually <30 min; if >2h, post on /status.html

### Scenario 3 — Data loss (single tenant)
1. Pull most recent snapshot from aria-backup-store (`snapshot-aria-tenant-audit-<date>`)
2. Identify tenant by SHA-256(email) hash
3. Restore the specific tenant's data via setJSON
4. Notify the tenant within 24h of detection

### Scenario 4 — Compromised admin token
1. Rotate APERTURE_ADMIN_PASSWORD + ADMIN_PASSWORD env vars in Netlify
2. Force-invalidate any active sessions: bump SESSION_VERSION env var
3. Audit all admin-gated endpoint hits in the last 24h via Netlify Functions logs
4. Notify any affected tenants if their data was queried
5. Post-mortem within 7 days

### Scenario 5 — Founder unavailable (vacation, sick, etc.)
1. Pre-set `FOUNDER_OOO=true` env var → ARIA escalations route to backup tech (Hire #1 when hired)
2. /aria-warm-handoff sends to backup contact instead
3. Inbox auto-responder enabled
4. Pre-arranged backup: another IT contractor's email + phone in vault
5. Critical decisions deferred until founder back, unless customer SLA breach risk

---

## Backup verification (run quarterly)

1. Identify most recent backup blob from aria-backup-store
2. Pick a small store (e.g. aria-leads) to restore-test
3. Restore to a test-store named "aria-leads-restore-test"
4. Diff entries — confirm all keys present
5. Document result in this runbook

Last verification: NEVER (run first verification before first paying customer)

---

## Emergency contacts

- Ahmad Wasee: ahmad.wasee@iisupp.net · +1-647-581-3182
- Backup tech: TBD (post-Hire #1)
- Netlify support: support@netlify.com
- Anthropic support: support@anthropic.com (or via Console)
- Stripe support: dashboard.stripe.com/support
- Resend support: support@resend.com

---

## Test schedule

- Backup verification: quarterly
- Failover test: semi-annually
- DR runbook review: yearly OR after any incident
