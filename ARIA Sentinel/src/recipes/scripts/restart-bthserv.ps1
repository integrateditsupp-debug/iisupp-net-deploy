# ARIA Sentinel recipe: bluetooth-off-v1 / restart-bthserv  (R-12 BLUETOOTH.OFF)
# Yellow tier — restore point taken first, always confirmed. Reversible: restarts the Bluetooth
# Support Service so adapters and paired devices re-initialise; no pairing is removed.
# Source-of-truth mirror of the command in src/shared/recipes.mjs (executed inline via -Command).
Restart-Service bthserv -Force
