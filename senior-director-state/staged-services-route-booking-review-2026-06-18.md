# Staged Services And ARIA Route-Aware Booking Review

Prepared: 2026-06-18
Owner: Codex
Status: local-only review packet, no publish performed

Purpose: replace the remaining generic contact-form detours on the main revenue entry pages with route-aware booking paths so homepage, Growth Library, Services, and ARIA visitors arrive with clearer scoping context before Ahmad ever sees the lead.

## What changed

- Added a new `Website + AI intake conversion fix` lane to `book.html` with:
  - lane-specific hero copy
  - lane-specific scoping guidance
  - lane-specific alternate routes back to Start Here, Services, and Growth Library
  - a dedicated booking subject for website-conversion work
- Redirected the highest-intent route buttons away from `/?contact=1...` and into `book.html` on:
  - `index.html`
  - `growth-library.html`
  - `services.html`
  - `aria.html`
- Upgraded the following offer routes to use lane-aware intake instead of a generic contact path:
  - general scoping
  - AI workflow audit
  - website + AI intake conversion fix
  - hybrid / overflow support review
  - AI Edge consult
- Registered this review packet in `scripts/staged-review-files.mjs`.

## Why this helps revenue

- The booking upgrade from earlier work only captured compare and ROI traffic; several of the main site entry pages were still dropping stronger buyers into a broad contact form.
- This slice keeps the buyer context matched to the offer that caused the click:
  - website-intake buyers land in a conversion-fix lane
  - workflow buyers land in a proof-first workflow lane
  - support and overflow buyers land in scoping or hybrid-support lanes
- That should improve founder-call quality because Ahmad receives narrower, better-scoped intake notes instead of generic “contact us” submissions with missing context.

## What stayed safe

- Local-only staged work.
- No publish.
- No checkout, payment, pricing, or order logic changed.
- No external send, submit, apply, account creation, or irreversible action performed.
- No unsupported claims, guaranteed-results language, or fake proof added.

## Verification

- `git diff --check -- book.html index.html growth-library.html services.html aria.html scripts/staged-review-files.mjs`
- `node --check scripts/staged-review-files.mjs`
- Local HTTP preview probe against `http://127.0.0.1:8765/`
- Content checks passed for the new route-aware booking lane and rerouted CTAs:
  - `Website + AI intake conversion fix`
  - `Stage conversion-fix call ->`
  - `source=services-route`
  - `source=aria-conversion-grid`
- Flow checks passed:
  - homepage `Stage conversion fix` now opens `book.html?lane=conversion-fix...`
  - Services `Stage AI Edge consult` now opens `book.html?lane=workflow-proof...`
  - ARIA `Stage overflow pilot` now opens `book.html?lane=hybrid-support...`

## Files staged locally

- `book.html`
- `index.html`
- `growth-library.html`
- `services.html`
- `aria.html`
- `scripts/staged-review-files.mjs`
- `senior-director-state/staged-services-route-booking-review-2026-06-18.md`

## CEO action

- `Approve publish` if Ahmad wants the main revenue entry pages to capture scoped booking context instead of generic contact-form intent.
- `Hold local only` if Ahmad wants this booking-routing slice bundled into a later deploy review.

## Risk

Low. This is a reversible conversion-routing improvement that changes only page guidance and intake destinations into the existing booking surface.
