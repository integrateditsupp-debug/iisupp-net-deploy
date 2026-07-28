# ARIA Classifier — Pending Regex Fixes (MEASURED) — 2026-07-21

Loop run 34. Baseline **92.27%** (35,346 / 38,307). All five patches below were
built and measured in an isolated `/tmp` clone of `tests/aria-classifier-mirror.js`.
**No production file was modified.** Numbers are measured, not estimated.

**Combined result: 92.27% -> 93.02% (net +288 scenarios, 7 regressions).**

| # | Patch | Net | Gains | Regressions | Verdict |
|---|-------|-----|-------|-------------|---------|
| P4 | browser-name + fault before kb:performance | **+166** | kb:browser +169 | kb:performance -3 | APPROVE — highest ROI |
| P1d | new `kb:hardware` intent (guarded) | **+65** | kb:hardware +69 | wifi -4 | APPROVE *only with KB wiring* (see below) |
| P2 | `new <role> ... access` -> kb:onboarding | **+27** | kb:onboarding +27 | **NONE** | APPROVE — zero risk |
| P5 | typo-tolerant "files won't sync" -> kb:onedrive | **+27** | kb:onedrive +27 | **NONE** | APPROVE — zero risk |
| P3 | Spanish password phrases | **+3** | password +3 | **NONE** | APPROVE — zero risk |

Zero-regression subset (P2+P3+P5) = **+57, no downside at all**. Ship that first if
you want the safest possible increment.

## The 7 regressions, in full

- `wifi -4`: "workstation on wheels wont connect to wifi", "handheld scanner wifi
  not working". These are arguably hardware, not wifi — corpus expectation is
  debatable either way.
- `kb:performance -3`: "chrome using high cpu"-shaped queries move to kb:browser.
  Also defensible.

Nothing else moved. No intent lost more than 4 scenarios.

## BLOCKER on P1d (kb:hardware)

`kb:hardware` does **not exist** in `aria.html` today — 408 corpus scenarios route
to `default` and score 0%. Adding the regex alone would route users to a
non-existent KB and produce a dead end (same failure shape as the "Something else"
loop bug). Adding it requires **five** coordinated edits in `aria.html`:

1. line ~3452 — add `'kb:hardware'` to the intent list
2. line ~3721 — add a 3-step remediation array
3. line ~3939 — add the intent -> KB slug mapping
4. line ~4062 — add the tier mapping (`'kb:hardware':'L1'`)
5. author the KB article itself

Recommend: write the hardware KB article first, then apply P1d.

## Exact patch text

See `tests/pending-patch-2026-07-21.txt` for the literal insert blocks and their
anchor lines. Apply to `aria.html` first, then mirror into
`tests/aria-classifier-mirror.js` so the harness stays a true mirror.

## Corpus inconsistency found (no action taken)

48 variants of "docking station not working" expect `default`, while
"docking station not working for clinical laptop" expects `kb:hardware`. Once
kb:hardware exists, flip the 48 to `kb:hardware`. Not flipped this run because
flipping to a non-existent intent would fail.

## Safe auto-applies this run: 0

The fix engine found **zero** expectation-update candidates (no cluster had
`expected=default` with correct specific routing). Every remaining cluster needs a
regex change, which is human-review-gated. Flipping expectations to match today's
wrong routing would game the metric, so nothing was flipped.
