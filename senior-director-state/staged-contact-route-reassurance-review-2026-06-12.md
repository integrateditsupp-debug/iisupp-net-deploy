# Staged Contact Route Reassurance Review

Date: 2026-06-12
Status: Local-only review packet
Scope owner: Codex

## What changed

- Tightened the homepage contact widget on [`/index.html`](/C:/Users/Ahmad%20Wasee/Documents/GitHub/ARIA%20%E2%80%94%20Real-Time%20AI%20Assistant/iisupp-net-deploy/index.html) so staged revenue-path requests now explain what happens next before the buyer submits.
- Kept the existing staged-request behavior, but added a second context panel that clarifies:
  - how IIS will treat that route
  - what IIS will review first
  - what the buyer should expect as the next scoped step
- Added route-specific reassurance for:
  - Book a scoping call
  - AI Workflow Audit
  - Remote L1-L3 Overflow Support Pilot
  - AI Help Desk Blueprint Implementation
  - M365 Security and Productivity Tune-Up
  - AI Workflow Quick-Win Sprint
  - Website + AI Intake Conversion Fix

## Why it matters

- Most newer conversion slices route through the homepage contact form. This reduces drop-off caused by uncertainty after the buyer clicks a staged CTA.
- The change improves trust without publishing pricing, turnaround guarantees, or unsupported commitments.
- It keeps the first response narrow and credible, which aligns with the current revenue thesis: one pain, one path, one next step.

## Risk check

- No checkout, payment, pricing, legal, or external-send behavior changed.
- No new public claims about response times, SLAs, customers, or partnerships were added.
- The change is reversible and content-only.

## Local verification

- Confirm the contact widget still opens when `contact=1` or `subject` / `desc` query params are present.
- Confirm each staged subject swaps in the correct reassurance note and next-step bullets.
- Confirm the new panel still fits inside the chat window at mobile width.

## CEO final action

- Ahmad can review this local-only contact-route reassurance slice and choose:
  - `Approve publish`
  - `Hold local only`

## Files in this slice

- [`/index.html`](/C:/Users/Ahmad%20Wasee/Documents/GitHub/ARIA%20%E2%80%94%20Real-Time%20AI%20Assistant/iisupp-net-deploy/index.html)
- [`/scripts/staged-review-files.mjs`](/C:/Users/Ahmad%20Wasee/Documents/GitHub/ARIA%20%E2%80%94%20Real-Time%20AI%20Assistant/iisupp-net-deploy/scripts/staged-review-files.mjs)
