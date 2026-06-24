# ARIA Sentinel recipe: windows-update-stuck-v1 / restart-update-services
# Reversible green. Restarts Windows Update (wuauserv), BITS and Cryptographic Services so a
# stuck update state clears. Services restart on their own anyway; no cache folder is deleted.
# This is the 5th recipe promoted to live execution in RUN 1 (R-02 DNS was already live), taking
# the cleared count from 3 to 8. Source-of-truth mirror of the command in src/shared/recipes.mjs.
Restart-Service wuauserv,bits,cryptsvc -Force
