# Staged Marketplace Bridge Conversion Review

Updated: 2026-06-13T23:30:00-04:00

Purpose: give Ahmad one concise publish/hold review for the current local-only Marketplace trust and routeback slice.

## What is staged locally

Files:
- `marketplace.html`
- `scripts/staged-review-files.mjs`

## What Codex changed

- Tightened the Marketplace hero so the first screen explains the real model faster:
  - quote-first sourcing
  - no instant checkout
  - route back to services or digital packs when Marketplace is the wrong path
- Replaced the old `Request quote` mailto-first CTA with stronger buyer-routing actions:
  - `Request sourcing check`
  - `See trend lanes`
  - `Need implementation help`
- Rewrote the top notice so it sounds like a transparent sourcing desk instead of a vague drop-shipping pitch.
- Added a new three-lane route selector directly under the notice:
  - source a physical product
  - buy a practical digital pack
  - need done-with-you execution instead
- Renamed the trend-card CTA from `Source this` to `Start sourcing check` so the page reads like a real process instead of a loose catalog.
- Added a routeback panel under the Marketplace terms block so mismatched visitors can move into:
  - `services.html`
  - `growth-library.html`
  - `ai-edge.html`
- Registered the review packet in `scripts/staged-review-files.mjs` so later queue rebuilds keep surfacing this slice.

## Why this matters

- The existing Marketplace page had useful demand lanes, but the first screen still felt closer to an internal trend board than a buyer decision page.
- Buyers now get a cleaner answer to three different intents:
  - source a physical item through IIS
  - buy a digital pack
  - hire IIS for implementation or support work
- This should reduce low-fit Marketplace form fills while increasing routeback into the higher-trust IIS monetization paths already staged elsewhere.
- It also removes some avoidable trust friction from the phrase `drop-shipping style Marketplace` without hiding the fee, vendor, or warranty realities.

## Safe to publish

- Public-safe wording only
- No new pricing claims beyond the existing sourcing/admin fee posture already staged here
- No Stripe behavior change
- No new checkout logic
- No new account creation
- No new external send behavior
- No false vendor, partner, shipping, warranty, or fulfillment claims

## Verification

- Local HTTP check returned `200` for `/marketplace.html`.
- Confirmed the updated page contains:
  - `Request sourcing check`
  - `Need implementation help`
  - `Source a physical product`
  - `Buy a practical digital pack`
  - `Need done-with-you execution instead?`
  - `Start sourcing check`
- Browser QA was attempted again through the Codex in-app browser, but the browser webview attach timed out before a live visual pass could complete. This slice was verified with local content checks instead of a full browser interaction pass.

## Recommended CEO action

- `Approve publish` if Ahmad wants Marketplace traffic routed more cleanly into the right monetization lane now, with less trust friction and fewer mismatched product-vs-service leads.
- `Hold local only` if Ahmad wants one more visual review before any publish decision.

## Risk

Low. The slice is reversible, keeps the existing fee and vendor-disclosure posture visible, and does not alter payment or external-send behavior.
