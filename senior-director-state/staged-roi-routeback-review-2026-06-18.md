# Staged ROI Routeback Conversion Review

Prepared: 2026-06-18
Owner: Codex
Status: local-only review packet, no publish performed

Purpose: turn the ARIA ROI calculator into a stronger monetization bridge so buyers who quantify support drag can immediately move into the right proof-first lane instead of stopping at one generic pilot CTA.

## What changed

- Rebuilt `roi/aria-calculator/index.html` so the calculator now captures the current buying job alongside the support-drag inputs.
- Added a dynamic recommendation panel that changes the headline, CTA labels, and destination links based on whether the buyer needs:
  - an ARIA-first pilot review
  - a proof asset first
  - a hybrid AI plus human support lane
  - a voice-platform comparison before any ARIA scope discussion
- Added a new `Pick the next proof-first move` section with four route cards so the page no longer dead-ends after showing the planning number.
- Registered this review packet in `scripts/staged-review-files.mjs` so future CEO queue rebuilds keep surfacing the slice.

## Why this helps revenue

- The ROI page already attracts higher-intent comparison and ARIA traffic, but it previously sent every buyer into the same generic pilot path even when they needed proof, hybrid support, or voice-platform discipline first.
- This change improves conversion quality by matching the CTA to the real buying job instead of forcing every visitor into one motion.
- It also protects revenue posture by keeping telephony-first shoppers on the comparison path rather than letting them misread an IT-support ROI estimate as a phone-agent business case.

## What stayed safe

- No pricing, checkout, payment, or order logic changed.
- No public savings guarantee or unsupported vendor claim was added.
- The calculator still presents planning guidance only, not a contractual ROI promise.
- No external send, publish, submit, payment, account creation, or irreversible action performed.

## Files staged locally

- `roi/aria-calculator/index.html`
- `scripts/staged-review-files.mjs`
- `senior-director-state/staged-roi-routeback-review-2026-06-18.md`

## Verification

- Browser QA on `http://127.0.0.1:8765/roi/aria-calculator/` using local Chrome via Playwright.
- Confirmed the voice-agent buying job changes the primary CTA to `Compare with Vapi` and routes to `/compare/aria-vs-vapi/`.
- Confirmed switching back to the support buying job restores the primary CTA to the ARIA pilot lane and highlights the ARIA-first route card.
- Fresh preview evidence saved to:
  - `outputs/roi-routeback-preview/roi-routeback-desktop.png`
  - `outputs/roi-routeback-preview/roi-routeback-mobile.png`

## CEO action

- `Approve publish` if Ahmad wants the stronger ROI-to-next-step buyer routing visible on the public site.
- `Hold local only` if Ahmad wants the routeback slice staged until a later deploy review.

## Risk

Low if kept as a planning-and-routing layer. Medium only if a later edit turns the calculator output into a guaranteed savings claim or collapses support ROI and telephony ROI into one vague promise.
