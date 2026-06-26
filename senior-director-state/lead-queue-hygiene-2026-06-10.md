# Lead Queue Hygiene - 2026-06-10

Owner: Codex
Mode: internal queue-quality cleanup, no-send, no-submit

## What changed

- Tightened `scripts/senior-director-worker.mjs` lead matching so it uses phrase-boundary checks instead of raw substring matches.
- Removed generic `hardware` from the simple-support trigger set.
- Replaced generic `identity` with narrower identity-support phrases such as `identity management`, `identity and access`, `entra id`, and `single sign-on`.
- Added a `skip_noncore_goods` path for physical goods/equipment procurement noise.
- Updated the operating-board summarizer so historical queue records are re-evaluated with the current classifier instead of trusting stale stored classifications.

## False positives this fixes

1. `Flexible Metal Conduit Spares for Halifax Class Electrical Hardware`
   - Old problem: promoted into the L1 support lane because of the word `hardware`.
   - New posture: non-core goods noise; keep parked.

2. `SMALL ARMS CLEANING KITS AND ACCESSORIES`
   - Old problem: `sso` matched inside `accessories`, which incorrectly pushed it toward L3 research.
   - New posture: non-core goods noise; keep parked.

3. `Global Affairs Canada (GAC) - Printing of Government of Canada Identity Cards (ID)`
   - Old problem: generic `identity` could imply IAM/SSO work when the title was about physical ID-card printing.
   - New posture: light review only unless real IAM language appears.

## Revenue impact

- The Director board should stop overstating safe-pursuit support leads.
- Codex/Claude time should stay focused on real IIS revenue lanes: support, M365, AI, website, documentation, and realistic tenders.
- Samsung ProCare still survives as a support-aligned tender for manual eligibility review because it contains an actual `technical support` signal rather than a goods-only signal.

## Next safe move

- Let the next operating-cycle refresh use the tightened classifier.
- Keep Samsung ProCare as the only current tender worth CEO attention unless a new support-aligned lead appears.
