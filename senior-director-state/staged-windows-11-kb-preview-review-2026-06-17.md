# Staged Windows 11 Troubleshooting KB Preview Review

Prepared: 2026-06-17
Owner: Codex
Status: local-only review packet, no publish performed

Purpose: give Ahmad one concise publish/hold review for the new proof-first path around the `Windows 11 Troubleshooting KB` and the staged `Windows 11 and Endpoint Cleanup` lane.

## What changed

- Created `downloads/library/windows-11-troubleshooting-kb-preview.html` as a public-safe sample page for the Windows 11 / endpoint-support lane.
- Fixed the product preview wiring in:
  - `assets/iis-catalog.js`
  - `product.html`
- Added a matching route card in `growth-library.html` so desktop-support buyers can discover the lane without hunting through the full catalog.
- Registered the review packet in `scripts/staged-review-files.mjs` so later queue rebuilds keep surfacing this slice.

## Why this helps revenue

- The Growth Library already had a sellable Windows 11 KB product, but it had no trust asset and the catalog preview path was pointing at the wrong preview page.
- This slice creates a cleaner ladder:
  - sample preview for proof of substance
  - paid pack for the troubleshooting asset
  - staged endpoint cleanup or overflow support when the buyer wants IIS help beyond the pack
- It strengthens the desktop-support and endpoint-cleanup monetization path without drifting into unsupported break-fix promises, hardware repair claims, or autonomous endpoint-action language.

## What stayed safe

- No public price posture changed.
- No checkout, payment flow, or order logic changed.
- No break-fix guarantee, uptime claim, or autonomous admin-action promise was added.
- No external send, publish, submit, account creation, or paid action performed.

## Files staged locally

- `assets/iis-catalog.js`
- `product.html`
- `growth-library.html`
- `downloads/library/windows-11-troubleshooting-kb-preview.html`
- `scripts/staged-review-files.mjs`

## CEO action

- `Approve publish` if Ahmad wants the Windows 11 Troubleshooting KB preview path visible on the public site.
- `Hold local only` if Ahmad wants the new desktop-support lane staged until a later deploy review.

## Risk

Low if kept as a sample-only trust layer. Medium only if anyone later turns the preview into public repair guarantees, endpoint-management claims, or promises that AI can make device changes without human approval.
