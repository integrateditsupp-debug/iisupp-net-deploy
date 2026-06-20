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
- [[2026-06-19]]
- [[AXIS]]
- [[Ahmad]]
- [[Backup-agent]]
- [[Brain-Map]]
- [[Claude-Code]]
- [[Cleaning-agent]]
- [[Codex]]
- [[Cowork]]
- [[DIRECTOR_AUTONOMY]]
- [[KB-agent]]
- [[Leads]]
- [[Leads-agent]]
- [[OPS-agent]]
- [[RULES]]
- [[STACK]]
- [[VOICE]]
- [[_ARIA]]
- [[_Amygdala]]
- [[_Brainstem]]
- [[_Campaigns]]
- [[_CorpusCallosum]]
- [[_Decisions]]
- [[_Glia]]
- [[_HOME]]
- [[_IIS]]
- [[_Inbox]]
- [[_Sentinel]]
- [[_capture]]
<