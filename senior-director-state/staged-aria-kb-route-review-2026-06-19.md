# Staged ARIA Support-Knowledge Route Review

Prepared: 2026-06-19
Owner: Codex
Status: local-only review packet, no publish performed

Purpose: give `aria.html` a proof-first support-knowledge path so ARIA demo traffic can move directly into the AI-readable KB pack and staged AI Knowledge Base Build lane without needing to detour through other surfaces first.

## What changed

- Added a new `Fix support knowledge before scaling ARIA` conversion card on `aria.html`.
- Added a compact `Proof stack` block directly under the ARIA deployment paths with three explicit next steps:
  - `/downloads/library/ai-readable-it-support-kb-pack-preview.html`
  - `/downloads/library/ai-help-desk-automation-blueprint-preview.html`
  - staged contact request for `AI Knowledge Base Build`
- Increased the visible ARIA demo route count from `7` to `8` so the on-page conversion summary matches the added lane.
- Registered this review packet in `scripts/staged-review-files.mjs` so later approval surfaces keep the slice visible.

## Why this helps revenue

- The ARIA page already handled scoping, overflow support, and intake-first buyers, but it still under-served the support-knowledge buyer who needs proof before approving a scoped build.
- This closes the gap between the ARIA demo and the higher-ticket support-knowledge offers already present on the Growth Library and services surfaces.
- It creates a tighter ladder:
  - ARIA demo proves the support pattern
  - KB preview proves the structure
  - Blueprint preview proves the operating model
  - staged KB build request moves the lead toward a real IIS engagement

## What stayed safe

- No pricing, checkout, payment, ordering, or account logic changed.
- No external send, publish, submit, account creation, or paid action performed.
- No unsupported automation, compliance, or production-integration claims were added.

## Verification

- `node --check scripts/staged-review-files.mjs` passed.
- Local browser QA on `aria.html` confirmed:
  - the new KB conversion card renders inside the existing deployment-path panel
  - the three-step proof stack renders below the main conversion cards
  - all three proof-stack CTAs are present and point to the expected preview/build routes
  - the route count now displays `8`

## Files staged locally

- `aria.html`
- `scripts/staged-review-files.mjs`
- `senior-director-state/staged-aria-kb-route-review-2026-06-19.md`

## CEO action

- `Approve publish` if Ahmad wants ARIA demo traffic routed publicly into the support-knowledge proof lane.
- `Hold local only` if Ahmad wants this route staged until the next deploy grouping review.

## Risk

Low. This is a reversible routing improvement that points only to existing proof assets and a staged request path.
