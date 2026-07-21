@echo off
REM ============================================================
REM  ONE-CLICK PUSH - Flywheel run 114 (2026-07-21)
REM  Advances local main to the prepared RUN-K merge and pushes to origin.
REM  SUPERSEDES AHMAD-PUSH-RUN112-RUN-J.cmd (that work is included).
REM
REM  Why this script has to move the pointer:
REM    The sandbox built, tested and COMMITTED RUN-K (branch da269d98, merge
REM    fd29b71b), but a stale .git\refs\heads\main.lock could not be deleted
REM    from the mount ("Operation not permitted"), so the main pointer could
REM    not be advanced there. Nothing is missing - the merge already exists.
REM
REM  What is in it:
REM    - RUN-K K1 payment receipt ledger: ONE place a real received payment is
REM        recorded. A payment with no processor reference is NOT received - it
REM        is recorded as CLAIMED, UNVERIFIED and counted in its own total, and
REM        it is structurally incapable of reaching the revenue board or the
REM        weekly digest. One recorded payment moves BOTH downstream reports
REM        through a single adapter - no second entry, no manual sync. A
REM        duplicate id is rejected as a bookkeeping error, never counted twice.
REM    - RUN-K K2 time-to-first-dollar clock: measured ONLY from timestamps that
REM        already exist on real artifacts. still-running / completed /
REM        not-enough-data are all reachable; with no payment it reports
REM        "still running, N days" and never a forecast or a close date (a
REM        static scan bans the vocabulary). The single slowest real step in the
REM        chain is named by both of its endpoints instead of guessed.
REM    - RUN-K K3 the one-page ask: composes the real proof pack, the real close
REM        packet and the real capacity verdict into one page a buyer can say
REM        yes to. Missing or unproven input => it REFUSES and names what is
REM        missing. Over observed capacity => it REFUSES outright, because we do
REM        not ask anyone to sign for delivery we have measured we cannot staff.
REM        Every proof line cites a record id or is dropped. Guarantee-style
REM        language is re-screened here and a removed term is counted, never
REM        reprinted onto the buyer's page.
REM    - runs 107-113 payload: RUN-F, RUN-G, RUN-H, RUN-I, RUN-J, and the
REM        Stage-3 ARE packet backlog (9 packets)
REM    - honest AXIS status feed, both mirrors byte-identical, fresh stamp
REM
REM  Verified first-hand before merge (node v22.22.3):
REM    node tests/run-all.mjs  ->  288/290 suites GREEN (clean room)
REM      forums-concierge needs @netlify/blobs -> re-run against the real
REM        node_modules: PASSED (environment only)
REM      deploy-safety-denylist needs a real .git -> re-run in the real repo it
REM        FAILED for a REAL reason: the AXIS status feed carried a currency
REM        figure in a publicly-served file. That was FIXED this cycle, not
REM        waived - the guard now reports OK, 0 of 2407 tracked paths flagged,
REM        all 9 force-404 rules present, 0 sensitive-content leaks.
REM    Effective 290/290. b4-axis-chat re-run separately: 20 passed, 0 failed.
REM    Diff is additive only: 908 insertions, 0 deletions (Rule 15).
REM
REM  This push does NOT deploy. Netlify publish stays your separate one click.
REM ============================================================

cd /d "%~dp0"

if exist ".git\refs\heads\main.lock" (
  echo Removing stale main.lock ...
  del /f /q ".git\refs\heads\main.lock"
)

git rev-parse --verify main-run114-merged >nul 2>&1 || goto :noref

REM Only ever a fast-forward: main must already be an ancestor of the merge.
git merge-base --is-ancestor main main-run114-merged || goto :notff
git update-ref refs/heads/main main-run114-merged || goto :fail

for /f %%i in ('git rev-parse main') do set LOCALMAIN=%%i
echo local main = %LOCALMAIN%

git fetch origin main || goto :fail
git merge-base --is-ancestor origin/main main || goto :originmoved

echo Pushing main -^> origin/main ...
git push origin main || goto :fail

echo.
echo DONE. origin/main updated with RUN-K. Netlify publish is still your one click.
pause
exit /b 0

:noref
echo ABORT: refs/heads/main-run114-merged not found. Nothing was changed.
pause
exit /b 1

:notff
echo ABORT: main is not an ancestor of main-run114-merged - not a fast-forward.
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
