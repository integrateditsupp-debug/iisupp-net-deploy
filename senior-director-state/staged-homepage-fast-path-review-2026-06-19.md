# Staged Homepage Fast-Path Rail Review

Prepared: 2026-06-19
Owner: Codex
Status: local-only review packet, no publish performed

Purpose: surface the strongest scoped IIS next steps directly below the homepage hero so higher-intent visitors can move into support, workflow, AI setup, or knowledge-build lanes before they need to decode the rest of the site.

## What changed

- Added a new homepage fast-path rail to `index.html` directly below the hero and before the AI Edge band.
- Added a hero shortcut link so visitors can jump straight from the hero into the new rail.
- The new rail now surfaces four scoped routes:
  - overflow support scoping call
  - AI workflow audit request
  - Small Business AI Agent Setup preview
  - AI Knowledge Base Build preview
- Added a footer bridge for the `Website + AI Intake Conversion Fix` intake path plus a Growth Library fallback route.
- Registered the review packet in `scripts/staged-review-files.mjs` so later queue rebuilds keep surfacing this slice.

## Why this helps revenue

- The homepage already had premium service cards, but the newer proof-first and scoped-service routes were still too far down the page for many visitors.
- This slice makes the front door more decisive:
  - support buyers can stage a scoped call immediately
  - workflow buyers can request the audit without a generic contact detour
  - SMB AI buyers can inspect a bounded implementation lane
  - KB buyers can inspect the knowledge-architecture offer before a live conversation
- It also gives the website-conversion lane a direct intake path near the hero instead of relying on a later section or generic browsing.

## What stayed safe

- Local-only staged work.
- No publish.
- No checkout, payment, pricing, or order logic changed.
- No external send, submit, apply, account creation, or irreversible action performed.
- No unsupported claims, fake proof, or guaranteed-outcome language added.

## Verification

- `git diff --check -- index.html scripts/staged-review-files.mjs`
- `node --check scripts/staged-review-files.mjs`
- Local HTTP preview probe via `http://127.0.0.1:8765/`
- Content checks passed:
  - `Start with one scoped move`
  - `Open setup preview`
  - `Open KB build preview`
  - `Stage conversion fix`
- Ordering check passed:
  - `id="home-fast-path"` renders before `class="ai-edge-band"`
- Hero shortcut check passed:
  - `See Fastest Next Steps`
  - `Stage overflow call`
  - `Stage audit request`

## Files staged locally

- `index.html`
- `scripts/staged-review-files.mjs`
- `senior-director-state/staged-homepage-fast-path-review-2026-06-19.md`

## CEO action

- `Approve publish` if Ahmad wants the homepage to route buyers faster into the newest scoped IIS offers and proof assets.
- `Hold local only` if Ahmad wants this front-door conversion slice bundled into a later deploy review.

## Risk

Low. This is a reversible homepage conversion-routing improvement that only changes buyer guidance and route emphasis without touching pricing, checkout behavior, or external automations.
