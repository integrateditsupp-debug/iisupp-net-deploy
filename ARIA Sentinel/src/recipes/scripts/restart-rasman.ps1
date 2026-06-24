# ARIA Sentinel recipe: vpn-connect-fail-v1 / restart-rasman  (R-13 VPN.DROP)
# Reversible green. Restarts Remote Access Connection Manager so a dropped VPN tunnel can
# re-establish. Implemented as a service restart (not `rasdial <profile>`) so it never handles
# credentials, never dials a tunnel on the user's behalf, and needs no command-allowlist change.
# Source-of-truth mirror of the command in src/shared/recipes.mjs (executed inline via -Command).
Restart-Service RasMan -Force
