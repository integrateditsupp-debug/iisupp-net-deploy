# Deletion Log — iisupp.net

Policy: **avoid deletion.** Prefer moving to `/archive/deprecated/`. If a delete is unavoidable:
back up first (`/backups/YYYY-MM-DD-description/`), keep ≥6 months, log it here, and record how to recreate.

| Date | What | Why | Backup location | How to restore / recreate |
|------|------|-----|-----------------|---------------------------|
| 2026-05-28 | _(none — files moved to `/docs/`, not deleted; recoverable via git history)_ | — | git history | `git log --all`, `git checkout <sha> -- <path>` |

> Nothing has been permanently deleted. Moves are tracked by git (`git mv`), fully reversible.
