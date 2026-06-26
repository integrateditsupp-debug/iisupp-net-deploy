# Staged Cybersecurity Basics for Employees Preview Review

Prepared: 2026-06-13
Owner: Codex
Status: local-only review packet, no publish performed

Purpose: give Ahmad one concise publish/hold review for the new sample-preview path around `Cybersecurity Basics for Employees`.

## What changed

- Created `downloads/library/cybersecurity-basics-preview.html` as a public-safe sample page for the employee-security-awareness lane.
- Updated `assets/iis-catalog.js` so `gl-cyber-basics` now points to the new preview path instead of having no trust layer.
- Added a dedicated product-page preview band in `product.html` so the product now offers:
  - `View sample section`
  - `Stage security review`
  - `View M365 preview`
- Added a matching Growth Library route card in `growth-library.html` so the product is easier to discover from the current problem-first entry grid.
- Registered the review packet in `scripts/staged-review-files.mjs` so later queue rebuilds keep surfacing this slice.

## Why this helps revenue

- The product already existed in the catalog, but it still lacked the proof-first trust layer now present on the stronger IIS packs.
- This closes a real buyer-friction gap:
  - sample-first proof for SMBs and lean teams that want simple employee guidance before paying
  - a clean security-review lane for buyers who want help rolling out the basics
  - a tighter bridge into the existing M365 tune-up when the security issue is really admin hygiene
- It strengthens the safety and support product ladder without drifting into compliance theater, cyber-insurance claims, or exaggerated protection promises.

## What stayed safe

- No live publish was performed.
- No checkout, payment, or order logic changed.
- No account creation, external send, tool signup, or paid action was performed.
- No public guarantee, audit-readiness claim, or incident-response promise was added.

## Files staged locally

- `downloads/library/cybersecurity-basics-preview.html`
- `assets/iis-catalog.js`
- `product.html`
- `growth-library.html`
- `scripts/staged-review-files.mjs`

## CEO action

- `Approve publish` if Ahmad wants the Cybersecurity Basics for Employees preview path visible on the public site.
- `Hold local only` if Ahmad wants the new employee-security trust layer staged until a later deploy review.

## Risk

Low if kept as a sample-only trust layer. Medium only if someone later turns the preview into public compliance, insurance, or guaranteed-risk-reduction claims without review.
