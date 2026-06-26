# Staged Growth Library Compare-Intent Route Review

Prepared: 2026-06-18
Owner: Codex
Status: local-only review packet, no publish performed

Purpose: turn ARIA comparison-page traffic into a clearer proof-first Growth Library lane instead of dropping those buyers into a generic catalog state.

## What changed

- Added a new compare-intent route section on:
  - `growth-library.html`
- The new section now gives comparison-page buyers three concrete next steps:
  - AI Help Desk Blueprint preview
  - AI Workflow Audit preview
  - Remote L1-L3 Overflow Support Pilot preview
- Repaired the existing compare handoff so:
  - `growth-library.html?focus=compare`
  - now lands on the new compare-intent route section instead of behaving like an unused query parameter.
- Strengthened the compare-intent lane with a new internal-share proof stack so buyers can forward the right asset before anyone asks for a live call:
  - AI Help Desk Blueprint for support-answer and escalation proof
  - Ticket Triage Knowledge Pack for intake/routing proof
  - AI-Readable IT Support KB Pack for support-knowledge structuring proof
- Tightened focus handling so the existing helpdesk route:
  - still presets the relevant search
  - scrolls to the intended support spotlight instead of being overridden by a later generic vault scroll.
- Registered this review packet in:
  - `scripts/staged-review-files.mjs`

## Why this helps revenue

- The compare hub already routes buyers into Growth Library, but one of its main CTAs was landing on a generic page state with no compare-specific guidance.
- Comparison traffic is high-intent but often not ready for a live scoping call yet. The new route gives those buyers a practical internal-share asset path immediately.
- This strengthens three monetization ladders at once:
  - support-brain proof
  - workflow diagnostic proof
  - hybrid AI-plus-human support proof
- It now adds a cleaner buyer choice inside that lane instead of forcing all compare visitors toward the same blueprint or workflow asset:
  - answer/escalation proof
  - ticket-intake proof
  - AI-readable support-knowledge proof

## What stayed safe

- Local-only staged work.
- No publish.
- No pricing, checkout, account, or payment flow changes.
- No external send behavior changed.
- No unsupported claims, fake proof, or platform-risk language added.

## Verification

- Confirmed `growth-library.html` now includes the new compare-intent route section with preview and scoped-review actions.
- Confirmed the compare-intent route now renders the new internal-share proof stack with direct paths into:
  - `AI Help Desk Blueprint`
  - `Ticket Triage Knowledge Pack`
  - `AI-Readable IT Support KB Pack`
- Confirmed query handling now explicitly maps:
  - `focus=helpdesk`
  - `focus=compare`
- `node --check` passed for:
  - `scripts/staged-review-files.mjs`

## Files staged locally

- `growth-library.html`
- `scripts/staged-review-files.mjs`
- `senior-director-state/staged-growth-library-compare-lane-review-2026-06-18.md`
- regenerated approval/handoff state files

## CEO action

- `Approve publish` if Ahmad wants compare traffic on Growth Library routed into a stronger proof-first decision lane with a tighter proof-asset shortlist.
- `Hold local only` if Ahmad wants the slice bundled into a later deploy review.

## Risk

Low. This is a reversible routing improvement that only changes on-page buyer guidance and focus handling.
