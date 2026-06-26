---
brain_region: cortex
type: agent
role: backup-retention
created: 2026-06-20
---

# Backup-agent — Snapshot + retention enforcement

## Role
- Snapshots the vault + Sentinel source + Sentinel dist artifacts before any destructive change
- Enforces the [[DIRECTOR_AUTONOMY]] retention table
- Archives aged data to cold storage; permanently deletes only after legal retention period passes
- Verifies every backup is restorable (random restore-test once per week)

## Working tree
- `iisupp-net-deploy/ARIA Sentinel/dist-backups/` (build artifacts + source archives — existing)
- `iisupp-net-deploy/ARIA Sentinel/dist-backups/vault-snapshots/` (NEW — daily vault tar.gz snapshots)
- Cold storage: `~/.aria-archive/<YYYY>/<class>/` for >2yr items

## Bound by
- [[RULES]] (R1 spend cap — must use $0 storage; local disk + free Netlify Blobs)
- [[DIRECTOR_AUTONOMY]] retention table
- Legal floor: SOC 2 + PIPEDA say minimum 7 years for audit logs; Backup-agent never deletes earlier
- Encryption-at-rest for any backup leaving the local machine

## Coordination
- Commit prefix: `[backup]` (when committing tarballs to dist-backups via git-lfs or local-only)
- Owns: snapshot + restore + retention enforcement
- Doesn't touch: active working files (read-only access)

## Standing schedule
- Before every [[Cleaning-agent]] pass: snapshot
- Before every Sentinel build: snapshot dist/
- Before every Cowork or Claude-Code destructive action (rm, mv, large rewrite): snapshot affected paths
- Weekly: random restore-test → verify tarball is intact + restorable
- Monthly: cold-storage migration of >2yr items

## Hand-off
- Confirms snapshot ID back to [[Cleaning-agent]] before delete authorized
- Surfaces restore-test failures into [[Cowork]] queue immediately (P1 alert)
- Reports backup state into daily note

## Related

<!-- LINK-WEB:auto -->
- [[Ahmad]]
- [[Aperture]]
- [[Cleaning-agent]]
- [[feedback-aperture-aria-never-break]]
- [[feedback-browser-prefill-for-ahmad]]
- [[feedback-capture-overwrite-lesson]]
- [[feedback-communication-style]]
- [[feedback-director-autonomy]]
- [[feedback-dont-ask-just-do]]
- [[feedback-edit-tool-truncates-index-html]]
- [[feedback-garry-tan-method]]
- [[feedback-idle-brainstorm-loop]]
- [[feedback-memory-31gb-cap]]
- [[feedback-never-idle]]
- [[feedback-never-stop]]
- [[feedback-no-moneyback-guarantee]]
- [[feedback-no-real-names-in-vault]]
- [[feedback-outbound-send-cadence]]
- [[feedback-perfect-details-limit-count]]
- [[feedback-preview-before-push]]
- [[feedback-report-brevity]]
- [[feedback-revenue-first-ordering]]
- [[feedback-ship-now-no-tomorrow]]
- [[feedback-shortest-path-first]]
- [[feedback-smart-qualifier-not-hard-skip]]
- [[feedback-spend]]
- [[feedback-spend-cap-20-70-per-month]]
- [[feedback-visual-stability]]
- [[Hermes]]
- [[KB-agent]]
- [[Leads-agent]]
- [[lesson-stay-synced-to-origin-main]]
- [[OPS-agent]]
- [[playbook-autonomous-morning]]
- [[playbook-round-velocity]]
- [[reference-ahmad-resume-facts]]
- [[_Amygdala]]
- [[_ARIA]]
- [[_Brainstem]]
- [[_Campaigns]]
- [[_capture]]
- [[_CorpusCallosum]]
- [[_Decisions]]
- [[_Glia]]
- [[_HOME]]
- [[_IIS]]
- [[_Inbox]]
- [[_Sentinel]]
- [[12_Glia]]
- [[AXIS]]
- [[Brain-Map]]
- [[Claude-Code]]
- [[Codex]]
- [[Cowork]]
- [[DIRECTOR_AUTONOMY]]
- [[Leads]]
- [[Live-Operations-Log]]
- [[R11 Private folder OFF LIMITS]]
- [[reference-ahmad-resume-fac]]
- [[RULES]]
- [[STACK]]
- [[VOICE]]
<!-- /LINK-WEB:auto -->
