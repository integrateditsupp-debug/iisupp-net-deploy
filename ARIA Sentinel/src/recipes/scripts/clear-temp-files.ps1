# ARIA Sentinel recipe: disk-low-space-v1 / clear-user-temp  (CLEAR_TEMP_FILES)
# A System Restore point is created first (recordRestorePoint in main). Clears only the
# current user's %TEMP%; Windows recreates it on demand. Never touches system or profile data.
# Source-of-truth mirror of the command in src/shared/recipes.mjs (executed inline via -Command).
Remove-Item -Path "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue
