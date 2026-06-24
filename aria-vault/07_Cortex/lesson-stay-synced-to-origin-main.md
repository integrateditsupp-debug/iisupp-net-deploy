---
brain_region: cortex
type: lesson
created: 2026-06-23
---

# Lesson — stay synced to `origin/main`, push review branches, merge promptly

## What happened
The local clone drifted **172 commits behind `origin/main`** while work was committed to side branches
(`sprint-0-backend`, `kb-bulk-push`) that were never reconciled. This produced the *feeling* of "falling
behind / missing commits."

## What was actually true (audited 2026-06-23, master run)
- **No additive work was lost.** Every genuinely-missing item already existed on `origin/main`:
  - 27/30 kb-bulk-push KB articles → all present on `main` (already reorganized into the current layout).
  - 11/11 AEGIS governance policies (+ `downloads/governance/*.docx`) → all present on `main`.
  - RUN 35 (chat scroll, routing iter-7, checkout-success, Sentinel 0.1.13) → already deployed to `main`
    via `119b90e`.
- The only thing truly off `main` is the **full ARIA Sentinel desktop app**, which is **by design** kept on
  the `sprint-0-backend` dev branch (`main` carries only a deploy subset). See `docs/STRUCTURE.md`.

## Root cause
A **stale local clone**, not lost commits. `git fetch` had not been run, so the local view of `main` was
172 behind reality. Side branches compounded the confusion.

## The rule (going forward)
1. **Branch off CURRENT `origin/main`** — always `git fetch origin main` first. Never build on the local
   `main` or a long-lived side branch without fetching.
2. **Push review branches** (e.g. `cc/<run>-<date>`) so Ahmad gets a Netlify branch-deploy preview (R6).
3. **Merge promptly** after preview — don't let review branches age into the next "172 behind."
4. **One batched commit + push per run** (R14) — gather everything, act once.
5. The Sentinel desktop app stays on its dev branch; only cherry-pick deploy-relevant files to `main`.

## Related
- [[RULES]] (R6 preview-before-push, R8 ARIA/Aperture-never-break, R14 expense discipline)
- [[Live-Operations-Log]]
- `docs/STRUCTURE.md`
