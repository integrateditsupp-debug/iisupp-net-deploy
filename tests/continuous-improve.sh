#!/usr/bin/env bash
# Continuous-improvement loop for ARIA classifier
# Run: bash tests/continuous-improve.sh
# Repeats: run scenarios → analyze → suggest → human approve fix → repeat
cd "$(dirname "$0")"
node run-10k-scenarios.js | tail -20
echo
node auto-fix-engine.js
echo
echo "Suggestions written to suggested-fixes.md — review + apply to aria.html"
