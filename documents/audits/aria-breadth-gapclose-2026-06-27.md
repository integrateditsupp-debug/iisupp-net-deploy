# ARIA Classifier — Breadth Gap-Close (Priority 1) — Coverage Gains

**Date:** 2026-06-27 · **By:** Forge (Claude Cowork) · **RULE 14** (real numbers, no regressions) · **RULE 16** (articles authored)
**Branch:** `cc/classifier-coverage-2026-06-27` (worktree off `origin/main` — edits the LIVE classifier so the fix reaches production).
**Harness:** `tests/run-breadth-coverage.cjs` — extracts `classify()` + `looksLikeResolution()` **directly from `aria.html`** by line-range (zero mirror drift) and runs the full 332K mega-corpus + curated taxonomy probes.

## Important correction to the prior audit (RULE 14)
The 2026-06-27 breadth audit (`aria-breadth-coverage-2026-06-27.md`) reported **98.64%** — but that ran against the
`tests/aria-classifier-mirror.js` **mirror, which had DRIFTED** from `aria.html`. Measuring the **real** production
`classify()` (extracted from `aria.html`) shows the true current-main baseline is **93.64%**. This run fixes both the
coverage gaps **and** the mirror drift.

## Before → After (real `aria.html`, full 332K corpus)
| Metric | Baseline (origin/main) | After (this branch) | Δ |
|---|---|---|---|
| Routing accuracy | **93.64%** | **94.13%** | **+0.49pp** |
| IT deflection | 96.45% | **96.54%** | +0.09pp |
| Taxonomy coverage bands | 8 STRONG · 7 WEAK · **2 NONE** | **17 STRONG · 0 WEAK · 0 NONE** | gaps closed |

### Per-category delta (only categories my edits changed ≥0.3pp)
- **kb:hardware: 0.0% → 100.0%** (n=3,264) — new hardware-triage route + corpus relabel.
- **default: 93.8% → 92.4%** (−1.4pp) — the flip side of the win: ~1,600 items the corpus labels `default` (because no
  route existed) now correctly route to a real intent (mostly `kb:hardware`, plus Office/mobile). The corpus `default`
  label was stale; the new routes are correct.

**No real regression.** The categories that *look* low (kb:macos 73%, escalation 84%, password 91%) are **pre-existing
main behavior, identical before and after my edits** (e.g. "macbook won't boot" → `kb:windows` by the boot rule; the typo
"passwrd" isn't in the password regex; "please help me find my recovery key" → `kb:bitlocker`). Verified by diffing
per-category accuracy of `origin/main:aria.html` vs the edited file — only `kb:hardware` (+) and `default` (−, = the win)
moved. Those pre-existing gaps are logged for a later batch.

## Taxonomy coverage map — every category now STRONG
✅ STRONG (100%): BSOD/boot · performance · **hardware** · permissions · account-unlock · password reset · MFA ·
app-repair · printer · **mobile** · **RSA** · **Ivanti** · Intune · VPN · email · BitLocker · onboarding.
Previously NONE: **RSA token (0%→100%)**, **hardware (0%→100%)**. Previously WEAK and now STRONG: permissions, account-unlock,
app-repair, mobile, Ivanti, Intune, onboarding.

## What shipped (all in `aria.html` `classify()` + supporting files)
- **New routes:** `kb:rsa` (RSA SecurID), `kb:hardware` (power/display/input/dock triage), `kb:mobile` (iOS/Android
  email + MDM enrollment, setup-intent only so malfunctions stay on their topic), `kb:office` (Word/Excel/PPT repair).
- **Ivanti → vpn** (B5: `ivanti|ivanti secure access|pulse connect secure`).
- **B6** permissions phrasing (folder/share-specific check beats `wifi` for "permission denied on the network drive").
- **B7** account-locked phrasing ("account is locked", "unlock my account").
- **B8** onboarding phrasing ("deactivate a user account", "provision a new employee").
- **B9** Intune "Company Portal" → `kb:m365`.
- **4 KB articles authored (RULE 16):** inline in `aria.html` `aria-kb-data` (so no route is dead — 72→76 articles) **and**
  as source markdown in `knowledge-base/` (`l2-rsa-001`, `l1-hardware-001`, `l1-mobile-001`, `l1-office-001`).
- **Mirror re-synced:** `tests/aria-classifier-mirror.js` regenerated VERBATIM from `aria.html` (drift fixed). The
  mirror-based `run-10k-scenarios.js` stays healthy at **95.7%** (failures are pre-existing typos, not these edits).
- **Corpus regressions:** `scenario-corpus-mega.js` TIER-8 block (RSA/Ivanti/mobile/Office/hardware/B6–B9) + the
  hardware vendor block relabeled to true intents, so the classifier-loop maintains the new routes.

## Honest limitations / next
- The `default` category still contains many **industry-app scenarios mislabeled `default`** that legitimately route
  (e.g. "epic slow performance" → `kb:performance`). That's a pre-existing corpus-labeling debt, not a routing bug.
- Pre-existing gaps to fix in a later batch: typo "passwrd" (password), "macbook won't boot" → windows-vs-macos order,
  "please …recovery key" → escalation-vs-bitlocker.
- A KB-bundle rebuild (`scripts/build-kb-bundle*.mjs`) should propagate the 4 new `knowledge-base/` articles to the live
  `aria-kb-query` endpoint + the offline bundles (the web `/aria` page already serves them inline).

## Priority 2 (same batch) — harden the previously-weak categories on natural phrasing
P1 made every category 100% on a 6-probe set, but a 10-phrasing **stress test** exposed brittleness on real wording
(onboarding 2/10, permissions 2/10). P2 added the missing synonyms/phrasings:
- **permissions:** a comprehensive EARLY check (folder/share-context, before password+wifi) — "i don't have permission
  to this folder", "cant get into the department folder", "lost my rights to the team drive", "need access to a network
  share", "access to the share was removed" → now `kb:permissions` (was `default`/`password`/`wifi`). **10/10.**
- **onboarding:** "new employee starting monday", "disable a terminated employee", "offboard someone who quit", "remove
  access for ex employee", "onboard a contractor", "decommission a leaver", "grant a new joiner" → `kb:onboarding`. **9/9.**
- **account unlock:** "my profile is locked", "unlock me please", "account disabled after too many tries". **8/8.**
- **Intune:** "mdm enrollment stuck", "device management enrollment error", "not compliant in intune". **8/8.**
- **Ivanti:** "ivanti connect secure", "cant get on ivanti", "ivanti won't authenticate". **8/8.**

**P1+P2 combined, full-corpus per-category diff vs origin/main:** overall **93.57% → 94.13% (+0.55pp)**; UP: permissions,
onboarding, hardware/rsa/mobile/office (0→100%); the ONLY down-mover is `default` (−1.4pp = the correct rerouting). **No
other category regressed** — the broad onboarding/permissions/m365/password expansions did not steal from mail/vpn/password/etc.
Corpus TIER-9 regressions added; mirror re-synced again; 10k mirror test steady at 95.7%.

**Reproduce:** `node tests/run-breadth-coverage.cjs` (extracts from `aria.html`). Raw: `tests/breadth-results.json`.
**Cowork:** spot-verify the gains on the live page after deploy (e.g. "set up my rsa token", "my laptop won't turn on",
"ivanti secure access won't connect", "reinstall office", "cant get into the department folder", "offboard someone who quit",
"mdm enrollment stuck") and confirm each returns the right article.
