# RUN 16 §C — User-behaviour battery results (2026-06-19)
**Suite:** tests/user-journey.test.mjs · **Status:** PASS — 5/5 journeys reached success, 0 dead-ends:
1. First-launch → trial active → globe visible → "outlook wont open" routes a recipe → dry-run sandboxed (ExecutionPolicy Restricted).
2. Trial expiry → app locks → plan-picker forward path exists.
3. License entry → valid HMAC accepted + unlocks; tampered key rejected.
4. Mode Manual→Autonomous → globe pins always-on-top + auto-fix.
5. Stop ARIA → globe vanishes + monitoring stops → Start ARIA → both restart.
