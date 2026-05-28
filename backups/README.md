# /backups/

Pre-change checkpoints. Structure: `/backups/YYYY-MM-DD-description/` containing copies of files
as they were *before* a risky/major change. Keep ≥6 months. Restore by copying back to the
original path (see `docs/restore-notes.md`).

Public access to this folder is blocked in `netlify.toml`. Git history is the primary backup;
this folder is for explicit pre-change snapshots and anything not otherwise version-controlled.
