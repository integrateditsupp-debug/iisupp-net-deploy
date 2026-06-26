# Staged Outlook Fix Guide Preview Review

Prepared: 2026-06-13
Owner: Codex
Status: local-only review packet, no publish performed

Purpose: give Ahmad one concise publish/hold review for the new sample-preview path around the `Outlook Fix Guide`.

## What changed

- Created `downloads/library/outlook-fix-guide-preview.html` as a public-safe sample page for the Outlook troubleshooting lane.
- Updated `assets/iis-catalog.js` so `gl-outlook-fix` now points to the new preview path instead of having no trust layer.
- Added dedicated product-page preview, cleanup-request, and route-back bands in `product.html` so the product now offers:
  - `View sample section`
  - `Stage cleanup request`
  - `View M365 preview`
- Added a matching Growth Library route card in `growth-library.html` so the Outlook lane is easier to discover from the current problem-first entry grid.
- Registered the review packet in `scripts/staged-review-files.mjs` so later queue rebuilds keep surfacing this slice.

## Why this helps revenue

- The product already existed in the catalog, but it still lacked the proof-first trust layer now present on the stronger IIS packs.
- This closes a real buyer-friction gap:
  - sample-first proof for teams dealing with repeated Outlook pain before they pay
  - a cleaner cleanup-request lane for buyers whose Outlook issue is really a recurring M365 admin problem
  - a tighter bridge into the existing M365 tune-up when the mailbox symptom is only the visible part of broader support drift
- It strengthens one of the fastest-close support lanes without drifting into guaranteed repair claims, licensing posture, or a broad managed-services promise.

## What stayed safe

- No live publish was performed.
- No checkout, payment, or order logic changed.
- No account creation, external send, tool signup, or paid action was performed.
- No public guarantee, admin-access promise, or tenant-wide remediation claim was added.

## Files staged locally

- `downloads/library/outlook-fix-guide-preview.html`
- `assets/iis-catalog.js`
- `product.html`
- `growth-library.html`
- `scripts/staged-review-files.mjs`

## CEO action

- `Approve publish` if Ahmad wants the Outlook Fix Guide preview path visible on the public site.
- `Hold local only` if Ahmad wants the new Outlook trust layer staged until a later deploy review.

## Risk

Low if kept as a sample-only trust layer. Medium only if someone later turns the preview into public mailbox-recovery guarantees, tenant-wide fix claims, or unsupported admin promises without review.
