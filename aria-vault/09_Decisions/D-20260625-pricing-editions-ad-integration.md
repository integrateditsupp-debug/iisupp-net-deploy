---
brain_region: decisions
type: decision
date: 2026-06-25
---

# D-20260625 — Pricing, Editions & Directory/Identity Integration

## Decision
1. **Two editions.** Standalone (ARIA only) vs Integrated (ARIA + AD/Entra, ServiceNow, RSA, PingOne, Dynamics, Outlook — verified self-service reset/unlock, manager-delegated actions, asset mgmt, minimal human visits).
2. **Pricing** (monthly display): Personal $899/mo · Pro $2,250/mo; Small Business $234K/yr · Mid $468K/yr · Enterprise $937.5K/yr (+50% on base). **$70/mo ARIA Web + AI Edge** = on-ramp. Implementation **$10–60K per connector** (quote at checkout).
3. **Bundled human support**: 1 on-site visit/yr (Small Business), 2 (Mid), 4 (Enterprise) + occasional remote jump-ins. Anything more = a **separate human-support contract**.
4. **Directory/Identity**: optional per business (like ServiceNow); governed L1–L3. **IDV via the business's trusted verifier** (PingOne/RSA) — ARIA is a middleman, never handles biometrics. Never emails a plaintext password. Writes never autonomous.

## Why
- Integrated edition is the enterprise/gov **moat** — justifies the six-figure tiers; price on **value** (verified self-service reset deflects 20–40% of helpdesk tickets).
- IDV-middleman + no biometric retention = far lower liability. Read-only-first + gated writes + read-back-verify + auto-rollback = "cannot mess up" identity.
- Keep Standalone + $70 web cheap as the funnel; Integrated is the upsell.

## Status
- 6 Stripe prices live + env-wired. Code shipped (R-ZERO, R-ONE, directory live slice-2; on main `8322e9d`).
- Ahmad-gated: publish; set the three `DIRECTORY_*` env vars; finish the Azure dev tenant; Phase-5 live QA.

## Related

<!-- LINK-WEB:auto -->
- [[D-20260624-aria-web-sentinel-one-product]]
- [[D-20260625-privacy-hosts-entra]]
- [[_Amygdala]]
- [[_ARIA]]
- [[_Brainstem]]
- [[_Campaigns]]
- [[_capture]]
- [[_CorpusCallosum]]
- [[_Decisions]]
- [[_Glia]]
- [[_HOME]]
- [[_IIS]]
- [[_Inbox]]
- [[_Sentinel]]
- [[Ahmad]]
- [[AXIS]]
- [[Backup-agent]]
- [[Brain-Map]]
- [[Claude-Code]]
- [[Cleaning-agent]]
- [[Codex]]
- [[Cowork]]
- [[D-20260619-bake-stripe-price-ids-in-code]]
- [[D-20260623-director-safe-autonomy-mandate]]
- [[D-20260624-vault-corruption-recovery]]
- [[DIRECTOR_AUTONOMY]]
- [[KB-agent]]
- [[Leads]]
- [[Leads-agent]]
- [[OPS-agent]]
- [[RULES]]
- [[STACK]]
- [[VOICE]]
<!-- /LINK-WEB:auto -->
