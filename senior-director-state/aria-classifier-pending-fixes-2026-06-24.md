# ARIA Classifier — Pending Regex Fixes (HUMAN REVIEW REQUIRED)

**Run:** 2026-06-24T20:23:04Z (autonomous classifier loop, run #20) — AUTHORITATIVE
**Harness:** tests/run-10k-scenarios.js — 34,209 scenarios, 99.7% pass (34,106 / 103 fail)
**aria.html touched:** NO. Nothing below was auto-applied. All require approval.

> **Supersedes the earlier 2026-06-24 04:15 entry.** That run reported 29,072 scenarios @ 96.0%
> with 22 routing-collision clusters (AD→password, security→mfa, onedrive→password, etc.). Those
> collisions are ALREADY FIXED in the current `aria-classifier-mirror.js` / aria.html (precedence
> branches added 06-19→06-21), and that run never persisted to tests/run-stats.json (still showed
> total_runs=19, last 06-22). It executed against stale/corrupt mount data — disregard it. This
> 20:23 run is a byte-faithful reconstruction (Read→clean-mount→node) and reproduces the durable
> 06-21/06-22 baseline exactly (34,209 / 34,106 / 103 / 99.7%).

## Why nothing was auto-applied
Safe auto-apply = corpus expectation flips where `expected=default → got=specific` and ARIA is
semantically correct. This run produced **0** such cases (auto-fix-engine: 0 expectation-update
candidates). All 10 failure clusters are `expected=specific → got=default` (regex too narrow) or
routing collisions — both require edits to `classify()` / `looksLikeResolution()` in aria.html,
gated on human review. Identical cluster set to 2026-06-21 / 2026-06-22 (deterministic carryover).

## The 10 clusters (103 fails total)

| # | Cluster | Count | Example | Root cause |
|---|---------|------:|---------|-----------|
| 1 | printer→default | 27 | `prnter jammed again` / `the priner is offline` | typo "prnter"/"priner" |
| 2 | wifi→default | 21 | `wirless wont conect` / `wireles network` | typo "wirless"/"wireles" + "conect" |
| 3 | vpn→default | 18 | `vpm wont conect` / `cant reach the vpm` | typo "vpm" (m↔n) |
| 4 | kb:bluetooth→default | 9 | `blutooth wont pair` / `bluetoth headset dead` | typo "blutooth"/"bluetoth" |
| 5 | kb:webcam→default | 9 | `my wabcam is frozen on calls` | typo "wabcam" |
| 6 | password→default | 9 | `no puedo iniciar sesion` | Spanish (no ES keyword) |
| 7 | not-resolution→resolution | 4 | `perfect, no luck` | sarcasm: "perfect" hits POS, "no luck" not in NEG |
| 8 | mail→default | 3 | `mi correo no abre` | Spanish (no ES keyword) |
| 9 | kb:performance→default | 2 | `my fan is spinning and the laptop is hot` | infix breaks `fans? (spin\|spinning)` adjacency |
| 10 | password→mail | 1 | `cant sign in to my email` | "email" keyword wins over login |

## Recommended fixes, grouped by leverage

**A. Typo-tolerance pre-pass — clusters 1–5 (+84, highest leverage).**
Add ONE shared normalization pre-pass at the top of `classify()` (Levenshtein-1 / common-slip map)
instead of 5 separate regex hacks: `prnter|priner→printer`, `wirless|wireles→wireless`,
`conect→connect`, `vpm→vpn`, `blutooth|bluetoth→bluetooth`, `wabcam→webcam`. Mirror the same map
into tests/aria-classifier-mirror.js. Single highest-recovery change; keeps the regex tree clean.

**B. Sarcasm NEG broaden — cluster 7 (+4, low risk, contained).**
In `looksLikeResolution()`, add `no luck` (and `no joy`, `no dice`) to the `NEG` alternation so
"perfect, no luck" reads as NOT resolution. Self-contained; no routing impact.

**C. Spanish i18n — clusters 6 + 8 (+12, defer to localization track).**
"iniciar sesion"→password, "correo"→mail. Belongs in the ES localization layer, not a one-off
hardcode. Defer.

**D. Performance adjacency — cluster 9 (+2, low value, low risk).**
Relax `fans? (spin|spinning)` to allow an infix ("fan is spinning"); add `running hot`.

**E. Routing collision — cluster 10 (+1, lowest priority / arguably correct).**
"cant sign in to my email" → mail before password. Defensible (it IS about email access). Design
call, not a clear bug. Recommend leaving as-is unless product disagrees.

## If A–E approved
All 103 → pass (≈100% on the 34,209 corpus). Path: edit aria.html, mirror into
tests/aria-classifier-mirror.js, re-run harness + smoke before deploy. Tackle **A + B first**
(86 of 103 fails, both low-risk and contained).

**Owner:** Ahmad / Codex (regex change = human-review gate). Loop will re-detect and re-log until applied.
