# ARIA Sentinel recipe: teams-cache-v1 / clear-cache  (CLEAR_TEAMS_CACHE)
# Reversible: Teams rebuilds these cache folders from the cloud on next launch. The recipe
# closes Teams first (close-teams action) so the cache is not locked.
# Source-of-truth mirror of the command in src/shared/recipes.mjs (executed inline via -Command).
Remove-Item -Path "$env:APPDATA\Microsoft\Teams\Cache","$env:APPDATA\Microsoft\Teams\GPUCache","$env:APPDATA\Microsoft\Teams\blob_storage","$env:APPDATA\Microsoft\Teams\Code Cache","$env:APPDATA\Microsoft\Teams\databases","$env:APPDATA\Microsoft\Teams\IndexedDB","$env:APPDATA\Microsoft\Teams\Local Storage","$env:APPDATA\Microsoft\Teams\tmp" -Recurse -Force -ErrorAction SilentlyContinue
