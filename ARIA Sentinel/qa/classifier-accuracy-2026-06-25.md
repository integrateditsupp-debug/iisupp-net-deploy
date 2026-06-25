# ARIA Web Classifier — Accuracy Results (Q-QA1)

| | |
|---|---|
| **Date** | 2026-06-25 |
| **Branch** | R-ZERO working branch off `main` @ `3e333ea` |
| **Harness** | `tests/run-mega-scenarios.js` + shared `tests/mega-eval.js` |
| **Gate** | `ARIA Sentinel/tests/classifier-accuracy.test.mjs` (in `run-all.mjs`) — **computed at test time** |

> **Integrity.** Every number here is from a real run of the harness on the commit above. The previously
> advertised **98.64%** was a hard-coded string that was never recomputed (finding C-1); it has been removed
> from the tester (`tools/iis-tester-agent.mjs` ACC-1 now computes), the customer trust pages
> (`trust/index.html`, `trust/routing-accuracy.html`), and is corrected below.

## Headline

- **Overall: 92.39%** (306,890 / 332,163), measured at test time.
- **No intent below the 50% HARD floor.**
- **`kb:active-directory`: 49% → 100%** — the release-blocking regression in C-1 is fixed (queries like
  *"account locked in ad"*, *"can't unlock ad account"*, *"locked out in domain"*, *"ad pasword reset"* now
  route to `kb:active-directory` instead of `password`/`default`). Fix applied identically in the live
  classifier (`aria.html`) and the test mirror (`tests/aria-classifier-mirror.js`); azure/entra stays
  `kb:m365`, onboarding stays `kb:onboarding`.

## Per-intent (full corpus, sorted by volume)

| Intent | Pass | | Intent | Pass |
|---|---|---|---|---|
| default | 87% (103592/118495) | | kb:browser | 93% |
| password | 91% (19060/20998) | | kb:networking | 93% |
| mail | 98% | | not-resolution | 93% |
| resolution | 85% | | kb:webcam | 100% |
| kb:teams | 96% | | **kb:active-directory** | **100%** |
| wifi | 95% | | kb:permissions | 99% |
| kb:mfa | 100% | | escalation | 84% |
| printer | 100% | | kb:macos | 99% |
| vpn | 100% | | kb:onboarding | 88% |
| kb:onedrive | 92% | | shopping / trade / news / weather | 100% |
| kb:security | 90% | | kb:bitlocker / voice / quote | 100% |
| kb:performance | 95% | | kb:usb / kb:bluetooth / outlook_ooo | 100% |
| kb:windows | 99% | | kb:m365 | 85% |

## What changed (Q-QA1)

- **C-1 fixed** — `kb:active-directory` 49% → 100%; AD-context rule added before `password`, mirrored in both files.
- **H-1 fixed** — accuracy is now **computed at test time** everywhere (`classifier-accuracy.test.mjs`,
  `iis-tester` ACC-1), via one shared evaluator `tests/mega-eval.js` (no drift between report and gate).
- **M-1 fixed** — `iis-tester` CHAOS-1 path `ARIA Sentinel/src/main.js` → `src/main/main.mjs`.
- **M-2 / REGEN-1** — `classifier-accuracy.test.mjs` asserts EVERY one of the 33 corpus intents by name with a
  50% hard floor + per-intent regression floors + an AD ≥95% lock, giving auditable per-intent traceability.
- Every hard-coded **98.64%** on a live/surfaced path replaced with the honest **92.4%** (computed).

## Remaining (tuning, not blocking)

Sub-90% intents — `escalation` 84%, `resolution`/`kb:m365` 85%, `default` 87%, `kb:onboarding` 88% — are
regression-floored and open as future tuning toward ≥95%. None violate the 50% hard floor.
