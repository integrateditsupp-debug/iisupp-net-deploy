# Staged AI Edge Preview Funnel Review

Prepared: 2026-06-18
Owner: Codex
Status: local-only review packet, no publish performed

Purpose: restore the staged `ai-edge.html` funnel lane to the live CEO approval surfaces so Ahmad can make a clean `Approve publish` or `Hold local only` decision instead of leaving the asset hidden in local-only history.

## What changed

- Kept the existing staged AI Edge funnel page:
  - `ai-edge.html`
- Kept the shared styling layer:
  - `assets/ai-edge.css`
- Kept the top-of-page AI Edge attention sections already staged on:
  - `services.html`
  - `growth-library.html`
  - `shop.html`
  - `start-here.html`
  - `index.html`
- Registered this review packet in `scripts/staged-review-files.mjs` so later queue rebuilds keep surfacing the AI Edge lane.

## Why this helps revenue

- AI Edge is a cleaner monetization ladder than a generic AI page because it shows:
  - free diagnosis first
  - low-ticket practical entry next
  - higher-value playbooks and membership after proof
  - deployment and managed support at the top end
- The staged page gives IIS a stronger bridge between Growth Library trust assets and ARIA or implementation revenue without changing checkout logic or forcing a public commitment now.
- Restoring the packet to the CEO queue turns an already-built local asset into a visible decision Ahmad can act on quickly.

## Pricing posture used in preview

- Free:
  - AI Readiness Scorecard
- Low-ticket:
  - `US$29-$79`
- Advanced one-time:
  - `US$149-$299`
- Membership:
  - `US$99-$399/mo`
- Deployment:
  - `US$2.5K-$15K+`
- Care plan:
  - `US$500-$2.5K/mo`

## Verification

- Local preview artifacts still show the lane clearly:
  - `outputs/ai-edge-preview/ai-edge-desktop.png`
  - `outputs/ai-edge-preview/ai-edge-mobile.png`
  - `outputs/ai-edge-preview/services-desktop.png`
  - `outputs/ai-edge-preview/growth-library-desktop.png`
  - `outputs/ai-edge-preview/shop-desktop.png`
  - `outputs/ai-edge-preview/start-here-desktop.png`
- `http://127.0.0.1:8765/ai-edge.html` returned `200` in local preview serving.
- In-app browser navigation to the local target crashed during this run, so this packet remains grounded on the stored desktop/mobile preview artifacts rather than a fresh browser screenshot.

## What stayed safe

- Local-only preview work.
- No publish.
- No commit.
- No checkout, payment, account, or external-send behavior changed.
- No false partnership, autonomous-send, or guaranteed-outcome claim added.

## Files staged locally

- `ai-edge.html`
- `assets/ai-edge.css`
- `services.html`
- `growth-library.html`
- `shop.html`
- `start-here.html`
- `index.html`
- `scripts/staged-review-files.mjs`

## CEO action

- `Approve publish` if Ahmad wants the AI Edge funnel visible on the public site.
- `Hold local only` if Ahmad wants to keep the lane staged until a later deploy review.

## Risk

Low if kept as a staged proof-first funnel. Medium only if later edits turn the page into a vague AI hype promise, add unsupported performance claims, or publish without checking the final live route behavior.
