# Staged Comparison Hero Proof-Ladder Review

Prepared: 2026-06-18
Owner: Codex
Status: local-only review packet, no publish performed

Purpose: strengthen the first screen on the ARIA comparison detail pages so buyers can move into a lower-friction proof step before a live review instead of stalling at generic hero CTAs.

## What changed

- Reworked the hero CTA ladders on:
  - `compare/aria-vs-vapi/index.html`
  - `compare/aria-vs-retell/index.html`
  - `compare/aria-vs-msp-x/index.html`
- Each hero now routes the buyer into three clearer first-screen actions:
  - planning number first via the ROI calculator
  - forwardable proof asset first
  - scoped fit review only when the lane is already clear
- Added shared hero-note styling in:
  - `compare/compare.css`
- Updated:
  - `roi/aria-calculator/index.html`
  so `?buyingJob=voice` and `?buyingJob=hybrid` links preselect the right calculator route instead of landing on the generic default
- Registered this review packet in:
  - `scripts/staged-review-files.mjs`

## Why this helps revenue

- Comparison traffic is already high intent, but some visitors are not ready to open ARIA immediately or jump into a live fit discussion.
- The old hero CTAs were too generic for that stage, which made the top of the page weaker than the deeper proof-first sections lower down.
- This slice moves the proof ladder above the fold:
  - voice-platform shoppers can quantify support drag first
  - support buyers can open a concrete blueprint or overflow preview immediately
  - warm buyers can still route into a scoped review with a better prefilled brief
- The ROI query-default fix makes the new hero paths more precise because the calculator now lands in the correct buying-job state.

## What stayed safe

- Local-only staged work.
- No publish.
- No checkout, payment, pricing, or account logic changed.
- No external send, submit, contact, or irreversible action performed.
- No unsupported competitor or savings claims added.

## Verification

- Tail-integrity check passed for:
  - `compare/aria-vs-vapi/index.html`
  - `compare/aria-vs-retell/index.html`
  - `compare/aria-vs-msp-x/index.html`
  - `roi/aria-calculator/index.html`
- `node --check` passed for:
  - `scripts/staged-review-files.mjs`
- Local browser QA against `http://127.0.0.1:8765` using Playwright with the installed Edge channel confirmed:
  - the Vapi hero shows `Estimate support ROI`, `View blueprint preview`, and `Stage fit review`
  - the Retell hero shows the same proof ladder
  - the MSP hero shows `Estimate queue ROI`, `View overflow preview`, and `Stage hybrid review`
  - the ROI calculator honors `?buyingJob=voice` and `?buyingJob=hybrid` by preselecting the matching buying-job state
  - mobile width still renders the MSP hero CTA ladder as three full-width stacked actions
  - no browser console errors were observed during the validation pass

## Files staged locally

- `compare/compare.css`
- `compare/aria-vs-vapi/index.html`
- `compare/aria-vs-retell/index.html`
- `compare/aria-vs-msp-x/index.html`
- `roi/aria-calculator/index.html`
- `scripts/staged-review-files.mjs`
- `senior-director-state/staged-compare-hero-proof-ladder-review-2026-06-18.md`

## CEO action

- `Approve publish` if Ahmad wants stronger above-the-fold proof routing on the live comparison detail pages.
- `Hold local only` if Ahmad wants the hero CTA ladders staged until the next deploy grouping review.

## Risk

Low. This is a reversible conversion-routing improvement that keeps the claims posture unchanged and does not touch checkout, pricing, or external-send behavior.
