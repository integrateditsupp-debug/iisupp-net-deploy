---
brain_region: cortex
type: agent
role: vault-cleanup
created: 2026-06-20
---

# Cleaning-agent — Vault hygiene + cleanup pass

## Role
- Daily 02:00 ET sweep of vault for cruft, stale stubs, dead wikilinks, duplicate notes
- Routes any unrouted `_capture.md` lines older than 24h into the right folder OR archives
- Removes empty folders, fixes broken wikilinks, prunes test-text stubs (per the link-web noise list)
- Calls [[Backup-agent]] BEFORE any deletion to take a snapshot

## Working tree
- `aria-vault/scripts/cleaning-pass.mjs` (to be written in next session)
- `aria-vault/scripts/link-web.mjs` (existing — re-run after every cleanup)

## Bound by
- [[RULES]] (R11 privacy — never touch real-name data; that's not cruft)
- [[DIRECTOR_AUTONOMY]] retention table
- NEVER deletes without [[Backup-agent]] confirmation
- NEVER touches files Ahmad has touched in last 7 days

## Coordination
- Commit prefix: `[clean]`
- Owns: vault hygiene, cruft removal, stub pruning
- Doesn't touch: customer data, decision logs, financial records

## Standing schedule
- Daily 02:00 ET: light pass (dead links, empty folders, _capture overflow)
- Weekly Sun 02:00 ET: deep pass (stub audit, duplicate detection, archive 90+ day daily notes)
- Monthly 1st 02:00 ET: archive pass (cold-storage old build artifacts, hash old audit logs)

## Hand-off
- Flags anything ambiguous → [[Cowork]] queue for human-in-the-loop
- Reports daily pass results into the day's `04_Daily/YYYY-MM-DD.md` Detail section

## Related

<!-- LINK-WEB:auto -->
- [[AXIS]]
- [[Ahmad]]
- [[Aperture]]
- [[Backup-agent]]
- [[Brain-Map]]
- [[Claude-Code]]
- [[Codex]]
- [[Cowork]]
- [[DIRECTOR_AUTONOMY]]
- [[KB-agent]]
- [[Leads]]
- [[Leads-agent]]
- [[OPS-agent]]
- [[RULES]]
- [[STACK]]
- [[VOICE]]
- [[_ARIA]]
- [[_Amygdala]]
- [[_Brainstem]]
- [[_Campaigns]]
- [[_CorpusCallosum]]
- [[_Decisions]]
- [[_Glia]]
- [[_HOME]]
- [[_IIS]]
- [[_Inbox]]
- [[_Sentinel]]
- [[_capture]]
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
- [[playbook-autonomous-morning]]
- [[playbook-round-velocity]]
- [[reference-ahmad-resume-facts]]
<!-

<!-- LINK-WEB:auto -->
- [[Ahmad]]
- [[Aperture]]
- [[Backup-agent]]
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
- [[2026-06-19]]
- [[ARIA_ADMIN_TOKEN]]
- [[AXIS]]
- [[Brain-Map]]
- [[Campaign]]
- [[CLAUDE_CODE_4HR_PACKET]]
- [[CLAUDE_CODE_AUTOCAPTURE_PACKET]]
- [[Claude-Code]]
- [[Codex]]
- [[Cowork]]
- [[Customer]]
- [[Customers]]
- [[D-20260619-bake-stripe-price-ids-in-code]]
- [[Daily-note]]
- [[Decision]]
- [[DIRECTOR_AUTONOMY]]
- [[Help-Desk-Implementation]]
- [[Jarvis-Companion]]
- [[Leads]]
- [[link-web]]
- [[Live-Operations-Log]]
- [[M365-Tune-Up]]
- [[Managed-IT-Support]]
- [[Marketing]]
- [[Office-Move]]
- [[Operations]]
- [[OTA-pipeline]]
- [[other-note]]
- [[Overflow-Support-Pilot]]
- [[Partners]]
- [[project-sentinel-ota-pipeline-live]]
- [[Project-Services]]
- [[Quick-Win-Sprint]]
- [[R11 Private folder OFF LIMITS]]
- [[README]]
- [[Recipes]]
- [[reference-ahmad-resume-fac]]
- [[RULES]]
- [[Sales]]
- [[SENTINEL_ADMIN_TOKEN]]
- [[skill-tts-voice-routing]]
- [[STACK]]
- [[Stripe-Products]]
- [[VOICE]]
- [[watch-inbox]]
- [[Website-Intake-Fix]]
- [[Workflow-Audit]]
- [[YouTube-Channel-Plan]]
<!-- /LINK-WEB:auto -->
