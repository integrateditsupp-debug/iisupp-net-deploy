# ARIA Sentinel recipe: onedrive-sync-stuck-v1 / reset-onedrive + relaunch-onedrive  (R-10 ONEDRIVE.SYNC.STUCK)
# Yellow tier — restore point taken first, always confirmed. Reversible: `/reset` only rebuilds the
# sync database; no synced file is touched and OneDrive re-downloads state from the cloud. The second
# line relaunches the client so syncing resumes. Source-of-truth mirror (executed inline via -Command).
Start-Process "$env:LOCALAPPDATA\Microsoft\OneDrive\OneDrive.exe" -ArgumentList '/reset'
Start-Process "$env:LOCALAPPDATA\Microsoft\OneDrive\OneDrive.exe"
