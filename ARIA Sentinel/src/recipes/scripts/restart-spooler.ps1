# ARIA Sentinel recipe: printer-spooler-v1 / restart-spooler  (R-05 PRINT.OFFLINE)
# Reversible green. Restarts the Print Spooler service so a stuck queue is re-read. Unlike the
# old stop/purge/start sequence this never deletes queued spool files, so nothing is lost.
# Source-of-truth mirror of the command in src/shared/recipes.mjs (executed inline via -Command).
Restart-Service Spooler -Force
