---
brain_region: hippocampus
---

# RULES — 10 standing rules for every agent + Ahmad

> Locked. Do not soften. Every session every agent reads this.

## R1 · Spend cap $20-70 CAD/mo
- No new operational/SaaS/compliance spend above current baseline without explicit ask
- Baseline allowed (no ask): Netlify · M365 · Stripe · Anthropic API · DigitalOcean
- NO pre-buying compliance (SOC 2 / ISO / insurance) for unsigned contracts

## R2 · Smart qualifier (not hard skip)
When an opp needs something IIS doesn't have, run this tree first:
1. Sub-prime under a certified vendor → apply as subcontractor
2. Scope down to avoid the gap → apply with scoped proposal
3. Obtain cert post-award → apply with "compliance on award" letter
4. Value > Year 1 cert cost × 3? → flag spend ask
Only if all 4 fail → skip + log the attempts

## R3 · Ship now, no tomorrow
- Never say "tomorrow / later / when you have time" if work can ship NOW
- Recurring work → scheduled tasks so loop continues offline
- Idle periods → auto-delegate to $0 improvements in your lane

## R4 · Revenue-first ordering
- Rank by (revenue × probability × speed)
- Revenue-generating tasks ALWAYS before busy work
- Stop polishing what doesn't move money

## R5 · Resume-honest claims
- Ahmad = 15+ years IT (since 2011) — **NEVER 21+**
- Real certs only. No fabrication.
- No fake AWS / Azure / industry experience

## R6 · Visual stability on iisupp.net
- Preview-before-push for structural visual changes
- Never change look/theme/copy without an approved mockup
- ARIA voice-mode + paywall + trial bar must work after every deploy

## R7 · No fake proof
- No fake testimonials / partnerships / search volume
- **No "guarantee / money-back / risk-free / refund" language ANYWHERE on iisupp.net or in Sentinel**
- No platform abuse, no spam, no scraping against rules
- **No Raymond James** anywhere — HARD RULE

## R8 · ARIA + Aperture never break
- After every deploy touching aria.html / aria-core.js / aria-trial.js: verify ARIA loads + paywall fires + trial counts + voice-mode works
- Hotfix immediately if regressed

## R9 · Every detail perfect, limit the count
- Every customer-facing surface: clear in 5s · CEO-grade copy · mobile+desktop intentional · tags balanced · trust signals consistent
- Limit the NUMBER of surfaces. Fewer + higher polish.
- Pruning is first-class. Backend/crons exempt — they compound invisibly.

## R10 · Shortest path first
- Pick the SHORTEST code path that delivers the outcome
- Bake non-secret config in code over env vars (Stripe price IDs, public endpoints, public keys)
- One commit beats a setup script
- Don't ask Ahmad to run scripts when a code edit ships it
- Real secrets (Stripe SECRET, Anthropic key, admin passwords) STAY in env vars


## R11 · Privacy — never graph real names
- Never create a vault note for a real person's name (lead, prospect, customer, vendor, employee)
- All leads/customers/contacts → [[Leads]] (01_Business/IIS/Leads.md) as `Lead-001`, `Lead-002`, etc.
- Real contact info stays in CRM (Apollo) · Gmail Drafts · WhatsApp — never the vault
- Reason: graph + vault appear in demos/docs/screenshots → real names = leak surface
- Exceptions: only Ahmad + agents (Cowork · Codex · Claude-Code · KB-