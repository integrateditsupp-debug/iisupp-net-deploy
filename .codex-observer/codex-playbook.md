# Codex Playbook — scan 2026-08-04T14:05Z (window: 2d)

## Headline
Repo **thawed**. 2 commits on 2026-08-04 after 6 days of silence. **Zero are Codex.**
Codex proper: 0 commits, **33 days dormant** (last real Codex-authored work 2026-07-02).

## Commits in window
| sha | author | subject | churn |
|---|---|---|---|
| `79bfe34f` | Claude Cowork (CC) | `[cc] STAGE 2 — free to try, paid tier for heavy use, hard ceiling on our own spend (branch-only)` | 6 files, +551/-0 |
| `c4cb9f80` | Cowork | `chore(axis): regenerate the public status feed from real sources this cycle` | 3 files, +35/-208 |

## What's new (worth reading)
**New subsystem — vision spend metering.**
- `netlify/functions/lib/vision-allowance.mjs` (200 lines) — allowance/tier logic
- `netlify/functions/aria-vision-diagnose.mjs` (79) — handler
- `tests/vision-allowance.test.mjs` (178) + `tests/vision-diagnose-handler.test.mjs` (42)
- `assets/aria-vision-diagnose.js` + `ARIA Sentinel/src/renderer/vendor/` shim (26 each)

Test-to-source ratio **220:305** — the highest in any observed window. This is the
first commit in observed history that ships a **hard ceiling on our own inference
spend**, which is the enforcement layer the $20–70/mo cap has been missing.
Marked branch-only — not on main, not on origin.

**AXIS status feed regen** — `_axis-status-full.json` collapsed by 208 lines,
generated bloat replaced with real-source output. `.well-known/axis/status.json`
and its `public/` mirror updated in lockstep.

## Deltas vs prior scan (2026-08-04T05:55Z)
- commits in window: **0 → 2**
- new directories: **none** (first clean-dir scan since `_incoming-patches`)
- new commit verbs: **none** (`axis` 18, `stage` 8, `fix` 8, `feat` 6 over 14d)
- new author strings: `Cowork`, `Claude Cowork (CC)`, `Claude Cowork`, `Fable 5 (Stage-3 ARE lane)`
  — identity sprawl is now **10 distinct author strings in 14 days** for what is
  effectively 3 actors. Attribution is degrading.
- dirty working-tree paths: **382 → 383**

## Unchanged structural problems (worsening by age)
1. `.git/index.lock` — 0-byte, mtime frozen at `2026-07-28T15:38:00 -0400`, now
   **6d22h** old, **identical across five consecutive scans**. Definitively stale.
   Sandbox cannot unlink it (mount perms). Agents are now *routing around* it
   rather than it being fixed.
2. HEAD sits on `cc/run-ac-passive-signal-2026-07-29` — **no upstream**. Today's
   two commits are stranded there alongside RUN-AC.
3. `main` is **14 ahead AND 49 behind** `origin/main`. Diverged both directions.
   RUN-F..RUN-K revenue work unpushed; origin's 07-29 legal/downloads/pricing
   burst unmerged locally. Origin refs last fetched 2026-07-29T14:13.
4. Codex framing is obsolete — this loop has observed only Cowork/CC output for
   33 days.

## Loop note
`observe-codex.mjs` remains absent (its path resolves to an unmounted prior-session
outputs dir). Every scan since 2026-07-21 is manual git-log reconstruction.
