# ARIA Classifier — Pending Regex Fixes (Human Review Required)

**Run:** 2026-06-22 04:35 (autonomous classifier loop)
**Harness:** run-10k-scenarios.js · 34,209 scenarios · 99.7% pass (34,106) · 103 fail
**Status:** carryover — identical 10 clusters as 2026-06-21. aria.html NOT modified (safety rule: regex changes need Ahmad approval).

These all fail the safe-flip test (a safe flip requires `expected=default → got=specific`). Every cluster below is `expected=specific → got=default` or a routing collision, so each needs a regex broaden / reorder in `aria.html` — human review only.

## Typo-tolerance broadens (84 scenarios, highest ROI)

| Intent | Misspelled tokens | Count | Fix |
|---|---|---|---|
| printer | `prnter`, jammed, again | 27 | Add fuzzy `pr[i]?nter` to printer regex |
| wifi | `wirless`, `conect` | 21 | Add `wir?eless`, `conn?ect` variants |
| vpn | `vpm`, `conect` | 18 | Add `vp[mn]` to vpn regex |
| kb:bluetooth | `blutooth`, pair | 9 | Add `bl[ue]+tooth` variant |
| kb:webcam | `wabcam`, frozen, calls | 9 | Add `w[ae]bcam` variant |

Recommendation: a single shared typo-normalization pre-pass (Levenshtein-1 against the keyword dictionary) would close all 84 at once instead of five separate regex edits. Lower-risk than five hand-tuned patterns. Flag for design review.

## i18n — Spanish inputs (12 scenarios, DEFER)

| Intent | Tokens | Count |
|---|---|---|
| password | `no puedo iniciar sesion` | 9 |
| mail | `mi correo no abre` | 3 |

Spanish (ES) is on the localization roadmap but the classifier dictionary is EN-only today. Adding ES keyword stems is a deliberate scope decision, not a quick broaden — defer to the localization track, not this loop.

## Routing collisions (5 scenarios, need reorder not broaden)

| Cluster | Count | Note |
|---|---|---|
| not-resolution → resolution (`"perfect, no luck"`) | 4 | Sarcasm/negation: "perfect" matches resolution before "no luck" negates it. Needs negation precedence, not a new pattern. |
| password → mail (`"cant sign in to my email"`) | 1 | "email" pulls mail before "sign in" pulls password. Arguably mail is defensible — single scenario, low priority. |

## Adjacency (2 scenarios)

| Cluster | Count | Note |
|---|---|---|
| kb:performance → default (`"fan spinning / laptop hot"`) | 2 | Thermal phrasing without "slow/performance" keyword. Add `fan`, `hot`, `overheat` to perf regex. |

---

**Action for Ahmad:** approve the typo-normalization pre-pass (closes 84) + perf adjacency (closes 2) = +86 scenarios → ~99.95% pass. Hold ES i18n for localization track. Hold the 2 collisions (low value). No aria.html edits made autonomously.

---
**Re-confirmed:** 2026-06-22 15:14 (2nd loop run today). Fresh harness + auto-fix-engine = identical 10 clusters, identical 103 fail. 0 safe flips. aria.html still untouched. Recommendation unchanged: ship the shared Levenshtein-1 typo pre-pass to close the 84 typo failures in one safe change.

---
**Re-confirmed:** 2026-06-22 20:13 (3rd loop run today). Identical 10 clusters / 103 fail / 99.7%. 0 safe flips. aria.html untouched.

**⚠ NEW — working-tree `package.json` corrupted (not classifier):** The iisupp mount truncated the working-tree `package.json` to 3124 bytes (invalid JSON, unterminated string at line 45 in the `scripts` block). Committed `HEAD:package.json` is intact (3337 bytes, valid). `package.json` is on the HANDS-OFF list (CC's uncommitted Tier-2/3 wiring), so it was **not** modified — the harness ran from a clean scratch copy instead. **Ahmad:** before any `npm install` / build / Netlify deploy, restore `package.json` from HEAD (`git checkout HEAD -- package.json`) or recover CC's wiring. Truncation already destroyed the uncommitted tail past line 45.
