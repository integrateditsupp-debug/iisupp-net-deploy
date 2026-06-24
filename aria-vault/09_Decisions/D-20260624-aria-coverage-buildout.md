---
brain_region: decisions
type: decision
date: 2026-06-24
---

# D-20260624 — ARIA coverage build-out vs the 230-call catalog

## Decision
Close the coverage gaps against the 230-call Future-of-Computing catalog **additively** — new KB articles,
dry-run/guided recipes, L3 runbooks, and compliance readiness maps — **without touching** ARIA core, the
paywall, the trial bar, Aperture, Sentinel core, the locked fall-through chain (KB $0 → Anthropic → offline
KB), or recipe safety gates (R8). Shipped in slices, each committed + pushed (R15) from an isolated worktree
(R16) on review branch `cc/coverage-buildout-2026-06-24` (Sentinel renderer work branches off the Sentinel
dev line).

## Audit baseline (why)
Tier 1 ~85–90% · Tier 2 ~55–65% · Tier 3 ~50% (escalate-correct, runbooks missing) · Tier 4 "Coming" ~5–10%
(the strategic gap). Today's volume/margin is covered; the premium AI-era differentiators are not.

## Slices
- **0** — restore the truncated `aria-vault/scripts/link-web.mjs` mesh linker (the "wifi link").
- **A** — quick win: Office/Excel recipe + offline intent matcher (synonyms→recipe) + Recipes-tab finder
  (A→Z dropdown + search).
- **1** — Tier 1/2 volume KB + web recipes (passkey/passwordless, mail auth SPF/DKIM/DMARC, SASE/SSE,
  Wi-Fi survey, patch mgmt, suspicious-login self-check, OneDrive KFM repair).
- **2** — Tier 3 premium runbooks (RAID/SAN, hypervisor-down, CA expiry, zero-day fleet patch, DDoS,
  forensic-preservation) + DR/BC + tenant-migration.
- **3** — Tier 4 "Coming": AI-agent governance, AI-threat, next-gen endpoint, frontier-infra packs.
- **4** — compliance readiness maps (EU AI Act, NIST AI RMF, HIPAA, ISO 27001 SoA, C2PA).

## Guardrails
- Recipes inherit the Tier-0 safety schema (allowlist, dry-run default, audit-logged, content-blind, confirm
  + countdown + kill-switch). Web never executes local fixes — guided only.
- **No compliance/cert claim is published as "certified"** — these are readiness maps / self-assessments
  only (legal review pending). Anything that reads as an external compliance assertion is flagged for Ahmad.

## Related
- [[RULES]] · [[_ARIA]] · [[_Sentinel]] · [[Live-Operations-Log]] · `knowledge-base/_meta/routing.md`
