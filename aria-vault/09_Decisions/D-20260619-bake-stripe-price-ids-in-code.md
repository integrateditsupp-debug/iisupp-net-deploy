---
brain_region: frontal-decisions
type: decision
date: 2026-06-19
status: locked
---

# D-20260619 · Bake Stripe price IDs in code

## Context
- Stripe is **Live mode** — 36 products created → [[STACK]]
- Price IDs are non-secret config; only the SECRET key is sensitive

## Decision
- **Bake all Stripe price IDs directly in code** #important
- Keep `STRIPE_SECRET_KEY` (and other real secrets) in env vars only

## Why
- Rule 10 — shortest path: one commit beats a setup script → [[RULES]]
- Non-secret config in code removes an env-var failure point

## Tradeoffs
- Price-ID change needs a commit (acceptable — IDs rarely change)
- Must never let a real secret follow the same pattern

## What this commits us to
- New Stripe products → add price ID in code, ship in the same commit
- Secrets stay in env per [[RULES]]

## Revisit when
- Stripe pricing model changes, or price IDs start churning often

## Related

<!-- LINK-WEB:auto -->
- [[_Decisions]]
- [[D-20260623-director-safe-autonomy-mandate]]
- [[D-20260624-vault-corruption-recovery]]
- [[_Amygdala]]
- [[_ARIA]]
- [[_Brainstem]]
- [[_Campaigns]]
- [[_capture]]
- [[_CorpusCallosum]]
- [[_Glia]]
- [[_HOME]]
- [[_IIS]]
- [[_Inbox]]
- [[_Sentinel]]
- [[2026-06-19]]
- [[Ahmad]]
- [[AXIS]]
- [[Backup-agent]]
- [[Brain-Map]]
- [[Claude-Code]]
- [[Cleaning-agent]]
- [[Codex]]
- [[Cowork]]
- [[D-20260624-aria-web-sentinel-one-product]]
- [[D-20260625-pricing-editions-ad-integration]]
- [[D-20260625-privacy-hosts-entra]]
- [[DIRECTOR_AUTONOMY]]
- [[KB-agent]]
- [[Leads]]
- [[Leads-agent]]
- [[OPS-agent]]
- [[RULES]]
- [[STACK]]
- [[VOICE]]
<!-- /LINK-WEB:auto -->
