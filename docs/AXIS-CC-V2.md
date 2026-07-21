# AXIS Command Center v2 — Runbook

**Persona:** Forge (Lead Product Architect / Full-Stack Engineer)
**Canonical URL:** `/aperture-learning.html` (serves the v2 shell `axis.html` via Netlify rewrite).
**Stack:** static HTML + vanilla JS + Netlify Functions + Netlify Blobs. Local truth = SQLite
(`node:sqlite`, Node 24). No framework, no bundler.
**Status:** branch `axis-command-center-v2` — **DEPLOY-READY, held for Ahmad**. Not pushed, not on `main`.

---

## What it is

One operational hub with 14 screens, all reading a single authed snapshot API:

| # | Screen | Source of truth |
|---|--------|-----------------|
| S1 | Overview (Command Deck) | KPIs + Needs-You-Now, all from SQLite |
| S2 | Action Inbox | `inbox_messages` (Sentry classifier) — **Badge Law** |
| S3 | Pipeline | `businesses.pipeline_stage` (17 stages / 5 phases) |
| S4 | CRM | contacts / businesses / opportunities |
| S5 | Prospect profile | per-business provenance (source + confidence + last_verified) |
| S6 | Prospects | researched set (Cartographer) |
| S7 | Outreach Studio | `outreach_items` — approved template only |
| S8 | Follow-ups | cadence 3/7/14, max 3, auto-cancel on reply |
| S9 | Documents | 16 Ontario DRAFT templates, versioned |
| S10 | Analytics | 3 dashboards, every number reconciles to SQLite |
| S11 | Product Discovery | Miner — 5-axis weighted scoring |
| S12 | Fleet | 27-agent roster |
| S13 | Reports | exceljs / CSV / pdfkit exports |
| S14 | Settings | rails, quiet hours, identity |

## Architecture

```
SQLite (data/axis-sales.db)  ──►  worker computes snapshots  ──►  Netlify Blobs (store: axis-snapshots)
        ▲                                                                    │
        │ agents write here ONLY                            GET /api/axis/snapshot (JWT-gated)
        │                                                                    ▼
  Cartographer / Sentry / Miner                                      axis-app.js (14 screens)
                                                           POST /api/axis/intent (queues, never sends)
```

- **Dev data override:** `axis-snapshot.mjs` reads gitignored `data/axis-snapshots.local.json` first,
  then falls back to committed `netlify/functions/_axis-snapshots-seed.json`.
- **Committed seed = empty honest baseline** (all zeros). Real prospect data lives in SQLite only and
  never ships in git; in prod the worker publishes real snapshots to Blobs.
- **Auth:** aperture JWT (HS256, `verifyAperture`). Client stores `aperture_jwt` in localStorage; every
  `/api/axis/*` endpoint verifies `APERTURE_JWT_SECRET`. The static shell carries **no** prospect data.

## Agents

| Agent | Script | Installer | Role |
|-------|--------|-----------|------|
| Cartographer | `scripts/cartographer-agent.mjs` | `install-cartographer-worker.ps1` | research + maturity/opportunity scoring |
| Sentry | `scripts/sentry-agent.mjs` | `install-sentry-worker.ps1` | inbox classify + side-effects (dormant until Gmail OAuth) |
| Miner | `scripts/miner-agent.mjs` | `install-miner-worker.ps1` | product discovery (5-axis) |

## Run locally

```bash
# real data view (local override present):
APERTURE_JWT_SECRET=<secret> netlify dev --offline --port 8900
# mint a dev JWT (HS256, same secret) → localStorage 'aperture_jwt' → open /aperture-learning.html
```

## Tests (58 assertions, all green)

`tests/axis-auth` (10) · `axis-snapshots` (9) · `sentry` (14) · `p6` (12) · `analytics` (13).
Run: `for t in tests/axis-*.test.mjs tests/sentry.test.mjs tests/p6.test.mjs tests/analytics.test.mjs; do node "$t"; done`

## Guardrails (enforced)

- **Approval-first:** nothing external sends. `POST /api/axis/intent` only queues; drafts are fail-closed.
- **Badge Law:** red inbox badge only for un-actioned `reply_to_outreach` + `new_inbound_request`;
  zero → no badge element (never a gray "0").
- **Provenance law:** every fact carries source + confidence + last_verified; unknowns render
  "Not found — never guessed".
- **Real data → SQLite ONLY**, never git / vault / Netlify.
- Worker stays **paused**; outreach rails DKIM-gated (first batch ≤5/day, no ramp until DKIM verified).

## HELD for Ahmad (do NOT self-serve)

1. **Production deploy / push to `main`.** Branch is ready; Ahmad publishes.
2. **First real email send.** Needs: DKIM "Start authentication" in Google Admin, Gmail OAuth
   (`scripts/gmail-auth.mjs` → `data/secrets/`), then per-item approval of the ≤5 first batch.

## Known follow-ups (not blockers)

- `.well-known/axis/status.json` (public) exposes internal build-lane status. It is owned by the
  observer loop and was left untouched to avoid clobbering worker-managed state; recommend reducing to
  headline-only or gating it in a separate pass. No PII/secrets present.
- Old consoles (`/command-center`, `/agents`, `/agent-command-center.html`) keep their Basic-auth edge
  gate (`aperture-gate.ts`) and then 301 → `/aperture-learning.html`. The double auth on those
  deprecated URLs is harmless; the login edge function was intentionally not modified.
