# ARIA Classifier — Pending Regex Fixes (HUMAN REVIEW REQUIRED)

**Run:** 2026-06-19 04:12 UTC (loop run #9)
**Harness:** tests/run-10k-scenarios.js — 29,072 scenarios @ 96.0% pass (27,907 pass / 1,165 fail)
**Delta from last run:** 0.0 pts (unchanged — no regex fixes have been applied yet; clusters are identical to 2026-06-18)
**Auto-applied this run:** 0 safe corpus flips
**Pending review:** 24 regex clusters = up to ~1,113 scenarios of potential lift (~3.8 pts → ~99.8% if all land cleanly)

## Why nothing auto-applied
The only expectation-update candidate the engine surfaced is `headphone jack not working` → `kb:bluetooth` (48 scenarios). A headphone jack is a **wired** connection; routing it to the Bluetooth KB is semantically wrong, so the corpus expectation stays `default` and the fail is kept on purpose. The correct fix is a routing change (send wired-audio phrasing to a proper audio KB or `default`), not a corpus flip — logged below. All other clusters require classifier regex edits in `aria.html`, which the safety rules forbid auto-applying.

## SAFETY (hard rules — do not bypass)
- These edit the classifier in `aria.html`. Run the tail-integrity check (tag balance + `</html>`) before any push.
- Use a /tmp clone + python for `aria.html` edits — never the Edit tool on that file (it truncates files >1000 lines).
- Re-run the harness after each change; confirm pass rate rises and no intent regresses.
- Smoke-test ARIA + Aperture after push.

## The 24 clusters (highest impact first)

| # | Impact | Cluster (expected→got) | Fix type | Tokens | Example |
|---|--------|------------------------|----------|--------|---------|
| 1 | 198 | `kb:active-directory→password` | REORDER/COLLISION | account, locked | account locked in ad |
| 2 | 107 | `kb:teams→default` | BROADEN-REGEX | not, loading | team's not loading |
| 3 | 106 | `password→mail` | REORDER/COLLISION | i'm, locked, out, email | i'm locked out of my email |
| 4 | 98 | `resolution→NOT-resolution` | REORDER/COLLISION | great | great :) |
| 5 | 96 | `kb:security→kb:mfa` | REORDER/COLLISION | mfa, bombing | mfa bombing |
| 6 | 54 | `kb:onedrive→password` | REORDER/COLLISION | onedrive, keeps, prompting, password | onedrive keeps prompting for password |
| 7 | 51 | `kb:active-directory→default` | BROADEN-REGEX | can't, unlock, account | can't unlock ad account |
| 8 | 48 | `wifi→kb:networking` | REORDER/COLLISION | dhcp, not, assigning | dhcp not assigning ip |
| 9 | 48 | `kb:performance→kb:security` | REORDER/COLLISION | antimalware, service, executable, high, cpu | antimalware service executable high cpu |
| 10 | 48 | `kb:browser→kb:performance` | REORDER/COLLISION | firefox, slow | firefox slow |
| 11 | 48 | `kb:onboarding→kb:m365` | REORDER/COLLISION | deactivate, user | need to deactivate user |
| 12 | 48 | `mail→default` | BROADEN-REGEX | emials, not, sending | emials not sending |
| 13 | 37 | `mail→outlook_ooo` | REORDER/COLLISION | outloook, open | outloook won't open |
| 14 | 36 | `escalation→kb:bitlocker` | REORDER/COLLISION | help, find, recovery, key | please help me find my recovery key |
| 15 | 36 | `escalation→default` | BROADEN-REGEX | i'm, stuck, help | please i'm stuck |
| 16 | 17 | `wifi→default` | BROADEN-REGEX | wfi, connect | wfi not connecting |
| 17 | 8 | `kb:onedrive→default` | BROADEN-REGEX | files, won, sync | files won t sync |
| 18 | 6 | `kb:windows→default` | BROADEN-REGEX | won, boot | won t boot |
| 19 | 6 | `kb:security→default` | BROADEN-REGEX | suspicious, emial | suspicious emial |
| 20 | 4 | `kb:permissions→default` | BROADEN-REGEX | user, can, open, folder | user can t open folder |
| 21 | 4 | `kb:networking→default` | BROADEN-REGEX | can, reach, internal, site | can t reach internal site |
| 22 | 4 | `kb:macos→default` | BROADEN-REGEX | mac, won, start | mac won t start |
| 23 | 3 | `not-resolution→resolution` | REORDER/COLLISION | longer, working | no longer working |
| 24 | 2 | `password→outlook_ooo` | REORDER/COLLISION | reset, password, outloook | reset password for outloook |

Plus the wired-audio routing fix: `headphone jack not working` (48) currently lands on `kb:bluetooth`. Route wired-audio phrasing (`headphone jack`, `aux`, `3.5mm`, `wired earbuds`) to `default`/audio KB instead of Bluetooth.

## Recommended attack order (best ROI, lowest risk)
1. **Cluster #1 (198) `kb:active-directory→password`** — biggest single win. Add an AD check (tokens: `ad`, `active directory`, `domain`, `domain controller`) *before* the password pattern. Verify password cluster doesn't regress.
2. **Cluster #2 (107) `kb:teams→default`** — broaden kb:teams for typo variants (`teamz`, `teem`, `team's`) + `{not, loading}`. Pure additive, low collision risk.
3. **Cluster #5 (96) `kb:security→kb:mfa`** — "mfa bombing" / "mfa fatigue" is an attack, not setup. Add a security-precedence guard for `bombing` / `fatigue` / `push spam`.
4. **Cluster #4 (98) `resolution→NOT-resolution`** — emoji/short positive acks ("great :)", "great 🎉") misread. Tighten the NOT-resolution negative lookahead so emoji/short praise still counts as resolution.

Each REORDER fix risks pulling scenarios from the `got` intent — re-run the full harness after every change and confirm the donor intent's pass count holds.

## Push state
Sandbox could not commit/push: `.git/index.lock` is unremovable (Operation not permitted via the Windows mount), so `git add` fails; HEAD is on `codex/revenue-synthesis-2026-06-17` not `main`; and `tests/` is untracked (`?? tests/`). Nothing tracked changed this run. **Ahmad:** clear the stale `.git/index.lock` locally, apply the approved regex fixes, and push. run-stats.json was updated via file tools and persists in the working tree.
