#!/bin/bash
cd "$(dirname "$0")"
if [ ! -f ~/.axis-local.json ]; then read -p "Paste your Axis pairing key: " KEY; node axis-local.mjs pair "$KEY"; fi
node axis-local.mjs
