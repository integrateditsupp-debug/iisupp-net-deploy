@echo off
REM ============================================================
REM  ONE-CLICK PUSH - Flywheel run 112 (2026-07-21)
REM  Advances local main to the prepared RUN-J merge and pushes to origin.
REM  SUPERSEDES AHMAD-PUSH-RUN111-RUN-I.cmd (that work is included).
REM
REM  Why this script has to move the pointer:
REM    The sandbox built, tested and COMMITTED RUN-J (merge 488ec6e1), but a
REM    stale .git\refs\heads\main.lock could not be deleted from the mount
REM    ("Operation not permitted"), so the main pointer could not be advanced
REM    there. Nothing is missing - the merge commit already exists.
REM
REM  What is in it:
REM    - RUN-J J1 deal-blocker autopsy: every non-converted opportunity gets
REM        its REAL blocker read off a real artifact (packet/handoff refusal,
REM        missing artifact, recorded objection, gone-quiet date). No evidence
REM        => UNKNOWN with the gap named and COUNTED on the face of the report.
REM        A pattern needs 3 real cases; below that it says "single case - not
REM        a pattern". "Lost on price" appears nowhere in code or output.
REM    - RUN-J J2 delivery capacity truth: observed minutes ONLY. No modelled,
REM        estimated or default fix time exists in the module (static-locked).
REM        Operator weekly minutes must be recorded or the verdict is
REM        not-enough-data - never a comfortable "under". under/at/over all
REM        reachable; every minute cites its record ids; unrecorded records and
REM        never-delivered staged customers are excluded BY NAME.
REM    - RUN-J J3 weekly truth digest: composes the real revenue board, the
REM        autopsy and the capacity report into what moved, what did not, ONE
REM        derived action and the honest $ figure. "Nothing moved this week."
REM        is reachable and is the default. Staged is never money, never done.
REM        Vanity language is test-banned.
REM    - runs 107-111 payload: RUN-F, RUN-G, RUN-H, RUN-I
REM    - honest AXIS status feed, both mirrors byte-identical, fresh stamp
REM
REM  Verified first-hand before merge (node v22.22.3):
REM    node tests/run-all.mjs  ->  276/278 suites GREEN
REM    Both reds are ENVIRONMENT, not code, and each was re-run and PASSED:
REM      deploy-safety-denylist needs a real .git -> re-run in the real repo:
REM        OK, 0 of 2402 tracked paths flagged, all 9 force-404 rules present
REM      forums-concierge needs @netlify/blobs -> re-run against the real
REM        node_modules: PASSED
REM    Effective 278/278. Diff is additive only: 857 insertions, 0 deletions.
REM
REM  This push does NOT deploy. Netlify publish stays your separate one click.
REM ============================================================

cd /d "%~dp0"

if exist ".git\refs\heads\main.lock" (
  echo Removing stale main.lock ...
  del /f /q ".git\refs\heads\main.lock"
)

git rev-parse --verify main-run112-merged >nul 2>&1 || goto :noref

REM Only ever a fast-forward: main must already be an ancestor of the merge.
git merge-base --is-ancestor main main-run112-merged || goto :notff
git update-ref refs/heads/main main-run112-merged || goto :fail

for /f %%i in ('git rev-parse main') do set LOCALMAIN=%%i
echo local main = %LOCALMAIN%

git fetch origin main || goto :fail
git merge-base --is-ancestor origin/main main || goto :originmoved

echo Pushing main -^> origin/main ...
git push origin main || goto :fail

echo.
echo DONE. origin/main updated with RUN-J. Netlify publish is still your one click.
pause
exit /b 0

:noref
echo ABORT: refs/heads/main-run112-merged not found. Nothing was changed.
pause
exit /b 1

:notff
echo ABORT: main is not an ancestor of main-run112-merged - not a fast-forward.
echo Ask Cowork to re-merge cleanly. Nothing was changed, nothing lost.
pause
exit /b 1

:originmoved
echo ABORT: origin/main moved and is no longer an ancestor of local main.
echo Ask Cowork to re-merge onto the new origin/main. Nothing was force-pushed.
pause
exit /b 1

:fail
echo ABORT: git command failed above. Nothing was force-pushed.
pause
exit /b 1
