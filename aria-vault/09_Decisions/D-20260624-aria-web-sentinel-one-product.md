---
brain_region: decisions
type: decision
date: 2026-06-24
---

# D-20260624 — ARIA web + ARIA Sentinel are ONE product, ONE brain

## Decision
`iisupp.net/aria` (the cloud surface) and **ARIA Sentinel** (the Windows desktop surface) are the **same
product** with **one shared brain** and built by the **same agents** (Claude-Code · KB-agent · OPS-agent).
They are not two products — they are one product on two surfaces.

## What "one brain" means concretely
- **Shared knowledge:** the same KB (`knowledge-base/` + `aria_brain_pack/`), recipes, and stop-codes.
- **Shared answer chain (locked):** KB first ($0) → Anthropic (novel questions only) → bundled local KB
  offline. Identical on both surfaces.
- **Shared chat UX:** the Sentinel "ARIA Chat" is visually identical to `aria.html` (company header + gold
  globe, bubbles, KB article cards, source badges, markdown).

## The only intentional difference (per surface)
| | Web (`/aria`) | Sentinel (desktop) |
|---|---|---|
| "Resolve it for me" | Opens a gate: **(A) download ARIA Sentinel** for on-device fixes, or **(B) continue the guided walkthrough**. The web **never** executes a local fix. | Runs the matched fix **locally**, gated by the RUN 29 control plane: R11 → supervisor → policy → **10s countdown** → Ctrl+Alt+K kill-switch. **Confirmed-grade**, never autonomous. |

## Why
Security + trust: a website must never reach into a user's machine. Local fixes belong on the user's own
device, gated and reversible. This also makes the value chain obvious — the web proves ARIA's intelligence
and routes serious fixes to Sentinel (the paid desktop agent).

## Implemented (2026-06-24, two review branches — no deploy)
- `cc/web-resolve-gate-2026-06-24` — web "Resolve it for me" → two-option modal (download / walkthrough).
- `cc/sentinel-resolve-parity-2026-06-24` — Sentinel "Resolve it for me" enabled + gated; chat resolve chip.

## Related
- [[_ARIA]] · [[_Sentinel]] · [[RULES]] (R8 ARIA/Sentinel-core never break) · `docs/STRUCTURE.md`


<!-- LINK-WEB:auto -->
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
- [[DIRECTOR_AUTONOMY]]
- [[KB-agent]]
- [[Leads]]
- [[Leads-agent]]
- [[OPS-agent]]
- [[RULES]]
- [[STACK]]
- [[VOICE]]
<!-- /LINK-WEB:auto -->
