# KB Recycle Report — 2026-06-27

- Mode: **DRY-RUN (report only — no files moved/deleted)**
- Cycle: #1 · rolling batch size 20 · cursor 0 → 20
- Articles in manifest: 102
- Recycle-bin size (before): 0 · retention 122 days (~4 months)
- Prior log integrity: **baseline (no prior log)**

## This cycle
| outcome | count |
|---|---|
| KEEP | 20 |
| REVIEW (kept, flagged) | 0 |
| RECYCLE (soft-delete → bin) | 0 |
| HARD-DELETE (retention expired) | 0 |

Batch this cycle: l1-browser-001, l1-email-001, l1-m365-001, l1-m365-002, l1-mfa-001, l1-onedrive-001, l1-onedrive-002, l1-onedrive-003, l1-outlook-001, l1-outlook-002, l1-password-001, l1-printer-001, l1-printer-002, l1-teams-001, l1-teams-002, l1-vpn-001, l1-wifi-001, l1-windows-001, l1-windows-002, l1-windows-003

> Tamper-evident log: `documents/audits/kb-recycle-log.jsonl` (sealed by `kb-recycle-log.seal.json`). No silent deletes — every decision above is one logged, hash-chained entry when applied.