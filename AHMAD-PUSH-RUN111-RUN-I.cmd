@echo off
REM ============================================================
REM  ONE-CLICK PUSH - Flywheel run 111 (2026-07-21)
REM  Pushes local main (RUN-I merge 7a5bfc2d + AXIS feed commit) to origin/main.
REM  SUPERSEDES AHMAD-PUSH-RUN110-RUN-H.cmd (that work is included).
REM
REM  What is in it:
REM    - RUN-I I1 billing handoff: the exact one-click invoice steps, built
REM        ONLY from a close packet that actually rendered. charged:false /
REM        invoiced:false / sent:false are CONSTANTS - the module imports
REM        nothing at all and has no transport, spawn, disk, or payment SDK
REM        (static-scan locked). A refused packet produces NO handoff.
REM    - RUN-I I2 renewal readiness: renewal is EARNED, never assumed. An
REM        account that went quiet is at risk with the silence named; the
REM        escalation rate is disclosed; thin delivery blocks "healthy".
REM        healthy / at-risk / not-enough-data all reachable, every verdict
REM        cites its record ids, booked renewal revenue is a hard $0.
REM    - RUN-I I3 revenue truth board: real money in (CAD $0 today, printed
REM        as $0 because it is true), unweighted pipeline where each entry
REM        carries its evidence, and blocked-on-Ahmad separated from
REM        blocked-on-us. No weighted pipeline, no projected ARR, ever.
REM    - runs 107-110 payload: RUN-F, RUN-G, RUN-H
REM    - honest AXIS status feed, both mirrors byte-identical, fresh stamp
REM
REM  Verified first-hand before merge (node v22.22.3):
REM    node tests/run-all.mjs  ->  273/275 suites GREEN
REM    Both reds are ENVIRONMENT, not code, and each was re-run and PASSED:
REM      deploy-safety-denylist needs a real .git -> re-run in the real repo:
REM        OK, 0 of 2402 tracked paths flagged, all 9 force-404 rules present
REM      forums-concierge needs @netlify/blobs -> re-run against the real
REM        node_modules: PASSED
REM    Effective 275/275.
REM
REM  This push does NOT deploy. Netlify publish stays your separate one click.
REM ============================================================

cd /d "%~dp0"

for /f %%i in ('git rev-parse main') do set LOCALMAIN=%%i
echo local main = %LOCALMAIN%

git fetch origin main || goto :fail
git merge-base --is-ancestor origin/main main || goto :notff

echo Pushing main -^> origin/main ...
git push origin main || goto :fail

echo.
echo DONE. origin/main updated. Netlify publish is still your one click.
pause
exit /b 0

:notff
echo ABORT: origin/main moved and is no longer an ancestor of local main.
echo Ask Cowork to re-merge cleanly onto the new origin/main. Nothing lost.
pause
exit /b 1

:fail
echo ABORT: git command failed above. Nothing was force-pushed.
pause
exit /b 1
