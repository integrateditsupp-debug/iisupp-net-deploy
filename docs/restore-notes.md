# Restore Notes — iisupp.net

## Fastest restore paths
1. **Any tracked file, any past state** — git history is the primary backup:
   - See history: `git log --oneline --all -- <path>`
   - Restore one file: `git checkout <commit-sha> -- <path>`
   - Restore whole site to a known-good deploy: in Netlify, **publish** the matching ready deploy (`netlify api restoreSiteDeploy --data '{"site_id":"88265b1c-3380-4611-a1c0-28b4f688562a","deploy_id":"<id>"}'`). Find ids: `netlify api listSiteDeploys`.
2. **Pre-change checkpoints** — `/backups/YYYY-MM-DD-description/` holds copies made before risky edits. Copy the file back to its original path and re-deploy.
3. **Archived (deprecated) features** — `/archive/deprecated/` holds superseded files kept for ≥6 months. Move back to restore.

## Known-good live deploys (publish to roll back the whole site)
- `76c27e0` — catalog overhaul ($2k all-access, concierge, KB guides) — current LIVE.
- `7b7cecc` — inventory + search + pricing.
- `3c1bc65` — v2 polish (timeline, sections, product pages, studio).
- `d183b27` — fulfillment (gated downloads).
- `a21e62f` — Shop + Growth Library launch.

## Critical things NOT to break (hard rules)
- `netlify/functions/aperture-auth.mjs` + the ARIA/Aperture logins. Admin email: `integrateditsupp@iisupp.net`.
- Live `aria-*` functions and the `stripe-checkout` priceData flow.
- Netlify **auto-publish is OFF** — pushing builds a ready (not live) deploy; publishing makes it live.

## Restore-from-Netlify (whole site, no local needed)
`netlify api listSiteDeploys --data '{"site_id":"88265b1c-3380-4611-a1c0-28b4f688562a","per_page":10}'` → pick a `state:ready` deploy → `restoreSiteDeploy`.
