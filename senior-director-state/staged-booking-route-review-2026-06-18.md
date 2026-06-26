# Staged Booking Route Upgrade Review

Prepared: 2026-06-18
Owner: Codex
Status: local-only review packet, no publish performed

Purpose: turn the generic booking page into a route-aware founder-call intake and connect high-intent comparison and ROI traffic to that intake instead of dropping those buyers into a generic contact-form state.

## What changed

- Rebuilt `book.html` into a route-aware booking surface with:
  - lane-specific hero copy
  - lane-specific call guidance
  - alternate proof/compare/ROI routes
  - structured intake fields for team size, tools, and scoped context
  - query-driven prefilled brief handling
- Routed high-intent call CTAs from:
  - `compare/index.html`
  - `compare/aria-vs-vapi/index.html`
  - `compare/aria-vs-retell/index.html`
  - `compare/aria-vs-msp-x/index.html`
  - `roi/aria-calculator/index.html`
- Kept proof-asset and compare-reading routes intact for buyers who are not ready to book a live founder call.
- Registered this review packet in:
  - `scripts/staged-review-files.mjs`

## Why this helps revenue

- Comparison and ROI traffic is already higher intent than generic homepage traffic, but those pages were still pushing many buyers into broad contact-form staging.
- The upgraded booking page now keeps the call context matched to the lane that produced the click:
  - ARIA fit assessment
  - ARIA vs Vapi / Retell fit
  - hybrid AI plus human support
  - ROI-backed pilot review
  - workflow-proof review
- This should improve founder-call quality because the first message now preserves the compare or ROI context, the repeated friction, the tools in scope, and the intended next step.

## What stayed safe

- Local-only staged work.
- No publish.
- No checkout, payment, pricing, or order logic changed.
- No external send, submit, apply, account creation, or irreversible action performed.
- No unsupported claims, guaranteed ROI language, fake proof, or platform-risk language added.

## Verification

- Target flow under test:
  - comparison hub -> `Book fit call` -> route-aware booking page
  - ROI calculator -> `Book hybrid call` -> route-aware booking page
- In-app Browser plugin path was attempted first but blocked twice by:
  - `Timed out waiting for the Browser webview to attach for this browser-use page`
- Fallback verification used Playwright with installed system Chrome against:
  - `http://127.0.0.1:8765/compare/`
  - `http://127.0.0.1:8765/roi/aria-calculator/`
- Desktop check passed:
  - compare hub opened `book.html?lane=compare-fit...`
  - booking page showed `ARIA fit assessment`
  - heading rendered as `Sort the right ARIA lane first.`
  - staged brief card was visible
- Mobile check passed:
  - ROI calculator hybrid path opened `book.html?lane=roi-hybrid...`
  - booking page showed `ARIA + overflow support review`
  - heading rendered as `Use the number to sort hybrid coverage.`
  - staged brief card was visible
- No framework error overlay was observed in either flow.
- Local screenshots captured outside the repo during QA:
  - compare desktop: `%TEMP%/iis-booking-compare-desktop.png`
  - ROI mobile: `%TEMP%/iis-booking-roi-mobile.png`

## Files staged locally

- `book.html`
- `compare/index.html`
- `compare/aria-vs-vapi/index.html`
- `compare/aria-vs-retell/index.html`
- `compare/aria-vs-msp-x/index.html`
- `roi/aria-calculator/index.html`
- `scripts/staged-review-files.mjs`
- `senior-director-state/staged-booking-route-review-2026-06-18.md`

## CEO action

- `Approve publish` if Ahmad wants higher-intent compare and ROI buyers pushed into a route-aware founder-call intake.
- `Hold local only` if Ahmad wants the booking upgrade bundled into a later deploy grouping review.

## Risk

Low. This is a reversible conversion-routing improvement that changes only on-page guidance and the intake path into the existing lead-capture function.
