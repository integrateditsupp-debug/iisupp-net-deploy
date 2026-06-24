# ARIA Sentinel recipe: dns-fail-v1 / flush-dns  (FLUSH_DNS)
# Reversible green. Clears the Windows DNS resolver cache; it rebuilds itself on next lookup.
# Source-of-truth mirror of the command in src/shared/recipes.mjs. The agent executes the
# command inline via -Command under -ExecutionPolicy Restricted (Restricted forbids .ps1 files),
# so this file is the human-readable / audit reference, not the live execution path.
ipconfig /flushdns
