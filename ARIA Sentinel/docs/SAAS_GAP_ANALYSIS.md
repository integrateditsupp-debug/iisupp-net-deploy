# ARIA Sentinel — SaaS Gap Analysis vs Category Leaders

> Built 2026-06-19 by Cowork after RUN 3 ship. Source: training-data on Calendly, HubSpot, Capital IQ, Stripe, Slack, Datadog, Notion/Linear, CrowdStrike/SentinelOne — well-documented patterns.

## What category leaders all do (table stakes)

| Pattern | Calendly | HubSpot | Cap IQ | Stripe | Slack | Datadog | CrowdStrike |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Frictionless onboarding (<3min to first value) | ✓ | ✓ | — | ✓ | ✓ | — | — |
| Free tier with real value | ✓ | ✓ | — | — | ✓ | — | — |
| Public status page | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Weekly/monthly value digest email | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| API + webhooks | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Role-based access (admin/contributor/viewer) | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Audit log export (CSV/PDF) | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Slack/Teams notifications | — | ✓ | — | ✓ | — | ✓ | ✓ |
| Self-serve billing portal | ✓ | ✓ | — | ✓ | ✓ | ✓ | — |
| Command palette (Cmd+K) | — | — | — | ✓ | ✓ | ✓ | — |
| Multi-tenant fleet view | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ROI calculator / value proof | ✓ | ✓ | — | — | — | — | ✓ |
| Embed-anywhere widget | ✓ | ✓ | — | ✓ | — | — | — |
| SOC 2 + ISO 27001 badges (or readiness page) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## ARIA Sentinel — current state (after RUN 3)

**Shipped:** privacy verifier · evidence pack · 11 executable recipes · BSOD Tier A · Health Score · tray dynamic state · per-site disable · auto-pause · attention wiggle · "What's new" modal · content-blind sanitization · ServiceNow bridge · 7-tab Settings + 13-tab admin · restore points · Chrome ext

**Missing vs leaders:**

1. **Weekly value digest** — no "ARIA fixed 47 issues this month, saved you 12hrs" email
2. **Public status page** — no status.iisupp.net for Sentinel uptime/incidents
3. **API + webhooks** — no programmatic interface for MSPs to integrate
4. **Role-based access** — single user only; no admin/contributor/viewer split for IT teams
5. **Audit log CSV/PDF export** — evidence pack ships ZIP but no human-readable summary
6. **Slack/Teams notifications** — auto-fix happens silently; no channel ping
7. **Self-serve billing portal** — Sentinel has no in-app billing (separate from iisupp.net Stripe portal)
8. **Command palette (Cmd+K)** — power users can't keyboard-navigate
9. **Multi-tenant fleet view** — admin console hints at it but not full SOC-style "single pane of glass"
10. **ROI calculator** — no value-proof surface in product
11. **Embed-anywhere widget** — no embeddable "Powered by ARIA Sentinel" status badge for customer's own intranets
12. **Free assessment hook** — IT Health Check on iisupp.net doesn't connect to Sentinel trial
13. **Mobile companion (push)** — desktop-only; no mobile presence
14. **In-product help search / Academy** — no tooltips for power features
15. **Templates marketplace** — recipes are hard-coded; no community/template share

## Gap-to-RUN mapping (no breakage of RUNs 1-3)

All additions are **additive** (new files, new endpoints, new buttons). No existing recipes / detectors / sanitizer logic changes. Tests only grow.

### Inject into existing RUNs

**RUN 4 (macOS port)** — add:
- Same telemetry-event format shared across platforms (one `telemetry-event.mjs` module that both Windows + macOS emit on — sets the stage for weekly digest + fleet view + Slack pings in later runs)

**RUN 5 (Edge + Safari + Chrome polish)** — add:
- Embeddable status badge (single iframe HTML snippet at `/sentinel-status-badge` that any customer can drop on their intranet showing their Sentinel health score)
- "Need help?" deep link in tray menu → opens IIS Calendly booking page

**RUN 6 (Autonomous + safety)** — add:
- Slack/Teams notification webhook: Settings → Integrations → "Notify on auto-fix" → paste webhook URL → optional channel name. Sends sanitized event (recipe id + outcome + endpoint name; never user content)
- Weekly digest email: scheduled `aria-weekly-digest.mjs` Netlify function sends per-customer "ARIA this week" (fixes count · uptime gained · top 3 recipes · escalations). Resend already integrated.

**RUN 7 (recipes 25→50)** — leave as planned. Recipe expansion is on the critical path.

**RUN 8 (recipes 50→75 + nightly fuzz)** — add:
- Public status page at `iisupp.net/sentinel-status` — pulls from existing uptime probe (already in heartbeats) · shows: API uptime · recipe-bundle freshness · last incident · 30-day timeline. Static HTML on Netlify, $0.
- Audit log CSV/PDF export: Settings → Privacy → "Download human-readable audit" (next to existing JSON evidence pack export)

**RUN 9 (v1.0 polish)** — add:
- Command palette (Cmd+K / Ctrl+K) → recipe search + Run · Settings nav · "Open admin console" · "Open globe". Pure in-renderer search, no API.
- ROI calculator in Settings → About: "ARIA has fixed N issues, saved ~M hours @ $X/hr = $Y" (configurable $/hr default 75)
- In-product tooltips on first-visit of each Settings tab (lightweight onboarding — extension of existing 4-coachmark onboarding)
- Multi-tenant admin console at `iisupp.net/sentinel-admin` upgrade: filter by customer · per-customer evidence pack download · "single pane of glass" health-score grid

**RUN 10 (trial license + distribution)** — add:
- Wire IT Health Check on `iisupp.net/it-health-check` → "Want ARIA to handle these automatically?" → email-magic-link trial start (instead of Sentinel's own first-launch email entry — keeps the funnel intact)
- Self-serve billing portal link in Settings → About → "Manage subscription" → opens existing Stripe customer portal in default browser
- API + webhooks v1: `/aria-api/v1/events` (read-only) + `/aria-api/v1/webhooks` (subscribe). Bearer-token auth from license key. Documented in `docs/API.md`.

### Deferred to post-v1 (would dilute the critical path)

- **Mobile companion app** — push notifications when desktop agent triggers. v1.5.
- **Templates marketplace** — community recipe contributions. v1.5 (when there's >50 customers).
- **Anomaly detection ML** — Datadog-style. v2.0.
- **Integrations marketplace** — bot directory. v1.5+.
- **24/7 MDR-as-a-service tier** — CrowdStrike pattern. Requires hiring before sell.

## Adjustments needed to RUNs 1-3 (already shipped)

1. **RUN 3 noted finding: epoch-ms timestamps trip the credit-card sanitizer.**
   - Action: in RUN 4, when CC builds the cross-platform `telemetry-event.mjs`, force all timestamps to ISO-8601 (`new Date().toISOString()`). This also fixes the existing recipe-feedback POST payload as a freebie.
   - No rewrite of RUN 1-3 code needed — just normalize the new shared module so the gap doesn't widen.

2. **RUN 1-3 shared telemetry/event format is implicit.** RUN 4 should define it explicitly so RUNs 6/8/10 (digest · status page · API) all consume one schema.

3. **No other RUN 1-3 changes required.** All gap fixes are additive.

## What customer types expect

**SMB (IIS bread-and-butter, $156-625K/yr tiers):**
- Just works. No config. Local-first. No data leaves their network.
- Monthly invoice + 1-page report = enough for the IT manager to justify the line item.
- Email or chat support during business hours.

**Mid-market (Mid-Size tier $312K/yr):**
- Role-based admin so IT lead can have visibility without giving everyone keys.
- API + webhooks to wire into existing ITSM (ServiceNow already integrated).
- Audit log export for compliance officer.
- SLA on response time (already in pipeline per RUN 14-16).

**Enterprise ($625K/yr):**
- SOC 2 Type II readiness already documented; full audit deferred (Rule 1).
- White-label option (IIS-branded fork) for MSPs reselling.
- Quarterly business review with usage metrics (= weekly digest aggregated).
- SAML/SSO (defer to v1.5).

## Net effect

ARIA Sentinel ships v1.0 with **Stripe-grade transparency · Calendly-grade onboarding hooks · HubSpot-grade value-proof email · Slack-grade workflow integration · CapIQ-grade audit export** — without adding paid services, without breaking RUNs 1-3, and within the existing 10-run plan.

ENTERPRISE_READINESS target after all 10 runs land with these additions: **9.7-9.8** (vs current 9.0).
