# ARIA Classifier — Pending Regex Fixes (HUMAN APPROVAL REQUIRED)
**Date:** 2026-06-21 (Sunday autonomous loop run)
**Status:** NOT applied. aria.html classifier untouched per safety rule. Approve before editing.
**Source:** 5,134-scenario adversarial layer added to tests/scenario-corpus-10k.js this run.
**Run result:** 34,209 scenarios · 99.7% pass · 103 genuine-gap failures (10 clusters).

All fixes below target `aria.html`'s `classify()` / `looksLikeResolution()` regex tree
(mirrored in tests/aria-classifier-mirror.js). Each is a BROADEN — adds a missed pattern.
None are auto-applied. Apply mirror + aria.html together, then re-run the harness.

## High-confidence typo broadens (low false-positive risk) — 84 scenarios
1. **printer→default [27]** — typos `prnter`, `priner`, `prntr` miss `/print/`.
   ADD alternation to printer rule: `print|prnter|priner|prntr`.
2. **wifi→default [21]** — `wirless`, `wireles` miss `/wireless/`.
   ADD to wifi rule: `wireless|wirele?ss|wirless|wireles`.
3. **vpn→default [18]** — `vpm` (m/n slip) misses `/vpn/`.
   ADD to vpn rule: `vpn|vpm` (bounded `\bvpm\b` to avoid in-word hits).
4. **kb:bluetooth→default [9]** — `blutooth`, `bluetoth` miss `/bluetooth/`.
   ADD: `bluetooth|blutooth|bluetoth|bluteeth`.
5. **kb:webcam→default [9]** — `wabcam` misses `/webcam/`.
   ADD: `webcam|wabcam|webcm`.

## Regex rigidity (adjacency too strict) — 2 scenarios
6. **kb:performance→default [2]** — "fan **is** spinning" / "laptop **is** hot" infix breaks
   `fans? (spin|spinning)` and `laptop hot`.
   BROADEN: `fans?\s+(is\s+|are\s+)?(spin|spinning)` and `laptop\s+(is\s+)?(hot|running\s+hot)`.

## Resolution NEG gap (sarcasm) — 4 scenarios
7. **not-resolution→resolution [4]** — "perfect, no luck" → POS 'perfect' wins; 'no luck' not in NEG.
   ADD `no\s+luck` to the NEG alternation in `looksLikeResolution()`.

## i18n / code-switching (OPTIONAL — defer to localization track) — 12 scenarios
8. **password→default [9]** — Spanish "no puedo iniciar sesion".
   Optional: add `iniciar sesi[oó]n|no puedo iniciar` to password rule.
9. **mail→default [3]** — Spanish "mi correo no abre".
   Optional: add `correo` to mail rule.
   NOTE: piecemeal ES/FR/DE keyword adds are brittle. Prefer the localization layer
   over regex spray. Recommend DEFER unless ES is a near-term market.

## Design review (NOT a bug) — 1 scenario
10. **password→mail [1]** — "cant sign in to my email" routes to `mail` because the email
    keyword is checked before the login rule. Defensible either way. DECISION NEEDED:
    keep mail (email-context) OR add a login-intent guard so "cant sign in"+email → password.
    Recommend KEEP mail unless login-reset volume says otherwise.

---
**Recommended apply order:** 1–5 (typos, safe, +84 pass) → 6–7 (rigidity/NEG, +6) →
defer 8–9 (i18n) → resolve 10 (product call). Items 1–7 would lift this corpus to ~100% on
real gaps; items 8–10 are judgment calls, not defects.
