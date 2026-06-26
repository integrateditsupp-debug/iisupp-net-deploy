---
brain_region: decisions
type: decision
date: 2026-06-25
tags: [privacy, security, entra, integrations, w5, approval]
---

# DECISION — Approve 2 Microsoft hosts in ARIA Sentinel privacy allowlist

**Decided by:** Ahmad (Director)  **Recorded:** 2026-06-25 21:13 UTC  **By:** Cowork

## Decision
**APPROVED.** Keep `login.microsoftonline.com` and `graph.microsoft.com` in `tests/privacy-audit.mjs` allowlist (alongside `*.service-now.com`). They are the required hosts for the Azure AD / Microsoft Entra ID integration.

## Scope / safeguards
- **GET-only.** The Entra check is read-only (client-credentials token → `GET /users?$top=1`); a test asserts no write verb ever hits Graph.
- **Dormant** until `DIRECTORY_*` creds are provisioned AND Ahmad grants tenant admin consent. No traffic until then.
- Least-privilege read scopes only (User/Group/Device/AuditLog .Read.All).

## Why approved
Expected and necessary for the W5 Integrations "Azure AD / Entra" card to function. Footprint growth is understood and acceptable; no autonomous writes.

## Related

<!-- LINK-WEB:auto -->
- [[D-20260624-aria-web-sentinel-one-product]]
- [[D-20260625-pricing-editions-ad-integration]]
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
