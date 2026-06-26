# ARIA Classifier — Pending Regex Fixes (Human Review Required)

**Latest run:** 2026-06-23 ~20:19 UTC (autonomous classifier loop, run #20) — supersedes the 04:13 run notes below.
**Harness:** run-10k-scenarios.js · 34,209 scenarios · 99.7% pass (34,106) · 103 fail
**Status:** 6-day carryover — identical 10 clusters as 2026-06-18 to 06-22. aria.html NOT modified (safety rule: regex changes need Ahmad approval). 0 safe corpus flips this run (every failure is under-routing, not a flip candidate).

> INCIDENT (20:19 run) — working-tree `aria.html` is TRUNCATED/CORRUPTED.
> Working-tree copy: 5,856 lines, ends mid-statement `...arr.lengt`, NO `</html>` (fails tail-integrity).
> Committed `HEAD:aria.html`: 5,929 lines, valid, ends `</script></body></html>`, 0 nulls -> live site unaffected (last push was skipped).
> The uncommitted Tier-2/3 wiring that lived only in the working tree is likely lost/damaged.
> Do NOT apply any regex fix below until aria.html is restored. Recovery: check `git reflog`/stash/CC working tree for the wiring FIRST, else `git show HEAD:aria.html > aria.html`. Clean HEAD copy + the broken file are saved in the session outputs folder.
> Same run: `tests/run-stats.json` had 2,677 null bytes appended (recovered + rewritten clean this run). Root cause = known "iisupp mount truncates large writes."

**Environment note (04:13 run):** working-tree files were found null-byte corrupted (mount write-truncation): `package.json`, `tests/aria-classifier-mirror.js`, `tests/scenario-corpus.js`, `tests/scenario-corpus-10k.js`, `tests/run-stats.json`. All restored from clean git HEAD objects before running. The `.git/index` is corrupted (`unknown index entry format 0x4c460000`). As of the 20:19 run, `package.json` + all `tests/*.js` are clean (node loads them); only `aria.html` + `run-stats.json` were corrupt.

Every cluster below fails the safe-flip test (a safe flip requires `expected=default -> got=specific`). All 10 are `expected=specific -> got=default` (regex broaden) or routing collisions — human review only.

## Typo-tolerance broadens (84 scenarios, highest ROI — 6 days pending)

| Intent | Misspelled tokens | Count | Fix |
|---|---|---|---|
| printer | `prnter`, jammed, again | 27 | Add fuzzy `pr[i]?nter` to printer regex |
| wifi | `wirless`, `conect` | 21 | Add `wir?eless`, `conn?ect` variants |
| vpn | `vpm`, `conect` | 18 | Add `vp[mn]` to vpn regex |
| kb:bluetooth | `blutooth`, pair | 9 | Add `bl[ue]+tooth` variant |
| kb:webcam | `wabcam`, frozen, calls | 9 | Add `w[ae]bcam` variant |

**RECOMMENDATION (escalated):** Single highest-ROI unaddressed classifier item — 6 consecutive days pending. One shared typo-normalization pre-pass (Levenshtein-1 against the keyword dictionary) closes all 84 at once and is lower-risk than five hand-tuned regex edits (adds no new branches to routing order). ETA pass rate after: ~99.7% -> ~99.95%. BLOCKED until aria.html working tree is restored (see incident).

## i18n — Spanish inputs (12 scenarios, DEFER)

| Intent | Tokens | Count |
|---|---|---|
| password | `no puedo iniciar sesion` | 9 |
| mail | `mi correo no abre` | 3 |

ES is on the localization roadmap; classifier dictionary is EN-only today. Defer to the localization track, not this loop.

## Routing collisions (5 scenarios, need reorder not broaden)

| Cluster | Count | Note |
|---|---|---|
| not-resolution -> resolution (`"perfect, no luck"`) | 4 | Sarcasm/negation: "perfect" matches resolution before "no luck" negates it. Needs negation precedence. |
| password -> mail (`"cant sign in to my email"`) | 1 | "email" pulls mail before "sign in" pulls password. mail arguably defensible — low priority. |

## Adjacency (2 scenarios)

| Cluster | Count | Note |
|---|---|---|
| kb:performance -> default (`"laptop is running hot and loud"`) | 2 | Thermal phrasing without keyword slow/performance. Add `running hot`, `fan spinning` to kb:performance. |

**Net if all approved:** 103 -> ~3 fails (99.7% -> ~99.99%). Highest ROI = the typo pre-pass (84/103).

## Standing push blocker (pre-existing, NOT this run)
`sprint-0-backend` history contains >100MB binaries under `ARIA Sentinel/dist-backups/` (97MB `.exe` + 102MB `.tar.gz`). GitHub pre-receive rejects the whole-history push; the branch has never been pushed. Remediation: `git filter-repo --path "ARIA Sentinel/dist-backups" --invert-paths` (or BFG / Git LFS), then push. Local classifier commit `3cee21f` rides along once the branch can push.
