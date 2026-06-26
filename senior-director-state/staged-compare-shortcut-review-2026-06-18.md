# Staged Compare Next-Step Shortcut Rail Review

Prepared: 2026-06-18
Owner: Codex
Status: local-only review packet, no publish performed

Purpose: shorten the path from comparison-page traffic into the right next step by adding an above-the-fold shortcut rail before the buyer has to read the full comparison page.

## What changed

- Added a new `Fast route` shortcut rail on:
  - `compare/index.html`
  - `compare/aria-vs-vapi/index.html`
  - `compare/aria-vs-retell/index.html`
  - `compare/aria-vs-msp-x/index.html`
- Added shared rail styling in:
  - `compare/compare.css`
- Registered this review packet in:
  - `scripts/staged-review-files.mjs`

## Why this helps revenue

- The comparison pages already explain fit well, but the buyer still had to scroll before the best next action became obvious.
- This slice moves the most likely next decisions into one short above-the-fold rail:
  - planning number first
  - proof asset first
  - hybrid support route
  - scoped fit review when the lane is already clear
- The compare hub now behaves more like a decision page instead of a content page, which should reduce bounce from high-intent visitors who only need the next route made obvious.
- The detail pages now match that same behavior, so Vapi, Retell, and MSP comparison traffic all get a faster conversion bridge.

## What stayed safe

- Local-only staged work.
- No publish.
- No checkout, payment, pricing, or account logic changed.
- No external sends, submissions, or account creation performed.
- No competitor pricing claims, fake proof, or unsupported capability claims added.

## Verification

- Local browser QA against `http://127.0.0.1:8765` confirmed:
  - compare hub renders the new shortcut rail with `4` route cards on desktop
  - compare hub keeps the shortcut rail single-column friendly at `390x844`
  - Vapi detail page renders the new shortcut rail with `3` route cards on desktop
  - Vapi detail page remains within viewport width at `390x844`
  - MSP detail page renders the new shortcut rail with the expected `queue ROI`, `hybrid proof`, and `hybrid scope` labels on desktop
- Browser verification was DOM-level and cache-busted against the local server.
- No external action was taken.

## Files staged locally

- `compare/compare.css`
- `compare/index.html`
- `compare/aria-vs-vapi/index.html`
- `compare/aria-vs-retell/index.html`
- `compare/aria-vs-msp-x/index.html`
- `scripts/staged-review-files.mjs`
- `senior-director-state/staged-compare-shortcut-review-2026-06-18.md`

## CEO action

- `Approve publish` if Ahmad wants faster above-the-fold routing on the comparison hub and detail pages.
- `Hold local only` if Ahmad wants the shortcut rail staged until the next deploy grouping review.

## Risk

Low. This is a reversible conversion-routing improvement that does not change checkout, pricing, legal posture, or external-send behavior.
