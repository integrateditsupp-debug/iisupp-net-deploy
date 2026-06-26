# Staged Compare Funnel Bridge Review

Prepared: 2026-06-18
Owner: Codex
Status: local-only review packet, no publish performed

Purpose: give Ahmad one clear publish-or-hold decision for the staged comparison-funnel bridge that turns ARIA comparison traffic into a more practical next step.

## What changed

- Added a new `Best next move by situation` bridge on:
  - `compare/index.html`
- Added a new `Best next move` conversion section on:
  - `compare/aria-vs-vapi/index.html`
  - `compare/aria-vs-retell/index.html`
  - `compare/aria-vs-msp-x/index.html`
- Extended the shared comparison styling in:
  - `compare/compare.css`
- Registered this review packet in:
  - `scripts/staged-review-files.mjs`

## Why this helps revenue

- The comparison pages already explain the fit difference well, but they were weak at telling a buyer what to do next.
- This slice adds a proof-first ladder instead of forcing every comparison visitor into the same generic CTA:
  - estimate the business case
  - preview a practical support asset
  - stage a scoped IIS review only when the lane is already clear
- The MSP comparison now has a stronger hybrid-support bridge, which is the closest route to service revenue because the buyer already understands support operations.
- The Vapi and Retell pages now separate `voice automation later` from `IT support friction now`, which should reduce mismatched inquiries and improve routing quality.

## What stayed safe

- Local-only staged work.
- No publish.
- No checkout, payment, account, or external-send logic changed.
- No pricing promises, performance guarantees, fake proof, or unsupported competitor claims added.
- Existing fit verdicts and source citations stayed intact.

## Verification

- Tail-integrity check passed for:
  - `compare/index.html`
  - `compare/aria-vs-vapi/index.html`
  - `compare/aria-vs-retell/index.html`
  - `compare/aria-vs-msp-x/index.html`
- `node --check` passed for:
  - `scripts/staged-review-files.mjs`
  - `scripts/ceo-action-digest-agent.mjs`
  - `scripts/ceo-action-console-agent.mjs`
  - `scripts/autonomy-supervisor-agent.mjs`
- Local browser QA against `http://127.0.0.1:8765` confirmed:
  - compare hub renders `4` route cards in desktop view
  - Vapi detail page renders `3` route cards in desktop view
  - Retell detail page renders `3` route cards in desktop view
  - MSP detail page collapses the new route grid to a single mobile column at `390x844`
- Browser screenshot capture timed out in this runtime, so this packet is grounded on DOM-level browser verification rather than stored preview PNGs.

## Files staged locally

- `compare/compare.css`
- `compare/index.html`
- `compare/aria-vs-vapi/index.html`
- `compare/aria-vs-retell/index.html`
- `compare/aria-vs-msp-x/index.html`
- `scripts/staged-review-files.mjs`

## CEO action

- `Approve publish` if Ahmad wants the comparison funnel to route buyers into proof-first ARIA next steps on the public site.
- `Hold local only` if Ahmad wants the compare lane staged until another deploy window or copy review.

## Risk

Low if kept as a scoped routing improvement. Medium only if later edits overstate savings, imply competitor deficiencies that are not evidenced, or turn fit guidance into hard capability claims.
