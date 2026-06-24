# ARIA Sentinel recipe: wifi-no-internet-v1 / restart-wlan  (R-03 NET.WIFI.DROP)
# Reversible green. Restarts the WLAN AutoConfig service; Windows immediately reconnects to
# saved networks. No profile is deleted and no credential is touched. Implemented as a service
# restart (not netsh disconnect/connect) so it needs no command-allowlist widening.
# Source-of-truth mirror of the command in src/shared/recipes.mjs (executed inline via -Command
# under -ExecutionPolicy Restricted, which forbids running .ps1 files).
Restart-Service WlanSvc -Force
