# OpenClaw Standing Mission — IIS Lead Hunting

> This file is the standing mission for OpenClaw and **every** agent it runs.
> It is committed to the repo so the mission is inherited automatically the
> moment OpenClaw (or any agent mesh) comes online. Do not require a human to
> re-state it. Set up automation whenever possible; never pause to ask.

## Owner
Ahmad — Integrated IT Support (IIS). Contact: integrateditsupp@gmail.com

## Objective (always-on)
Continuously discover high-value opportunities for IIS and surface them
automatically, ranked by fit. Two streams:

1. **Government & public-sector contracts** (primary)
2. **Business / private-sector IT contracts & RFPs**
3. **High-pay IT roles** (manager / contract / gov)

## Sources (poll on a schedule)
- **CanadaBuys** — federal, official open data. New-tender CSV:
  `https://canadabuys.canada.ca/opendata/pub/newTenderNotice-nouvelAvisAppelOffres.csv`
  (refreshes ~every 2h). This is the deterministic backbone.
- **MERX** (Canada-wide): https://www.merx.com/
- **Ontario Tenders Portal** (Jaggaer): https://ontariotenders.app.jaggaer.com/
- **BC Bid**: https://www.bcbid.gov.bc.ca/
- **Biddingo** (broader public sector): https://www.biddingo.com/
- **Job boards** (high-pay IT/gov roles): Indeed (ca.indeed.com), LinkedIn Jobs.

## What counts as a match (IIS fit)
Managed IT / help desk / service desk / cybersecurity / cloud / Microsoft 365 /
Azure / infrastructure / networking / endpoint / backup & DR / systems
integration / device management (Intune/MDM) / VoIP / identity & SSO.

**High-value ("hot") flag:** managed services, cybersecurity, cloud, M365/Azure,
infrastructure, systems integration.

## Hard constraints (non-negotiable, from Ahmad)
- **ZERO new cost.** No paid APIs, no LLM spend, no paid accounts. Deterministic
  filtering only.
- **Additive only.** Never modify the login gate (`netlify/edge-functions/aria-gate.mjs`),
  `aperture.html`, or any `aria-*` login flow. Public tender data needs no gate.
- **Don't re-ask.** Build and deploy safely; report results, don't request
  permission for in-scope lead hunting.

## Current implementation in this repo
- `netlify/functions/aria-lead-radar.mjs` — scheduled (`@daily`) + manually
  invokable; pulls CanadaBuys, filters, ranks, returns JSON (`?html=1` → page).
- `lead-radar.html` — public bookmarkable dashboard that renders the radar.

## How an agent extends this
Add sources / keywords to `aria-lead-radar.mjs`. Keep it deterministic and free.
When richer scraping (MERX/Ontario live listings) is wanted, add per-portal
fetchers behind the same digest shape. Never introduce cost.
