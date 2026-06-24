---
brain_region: cortex
type: agent
role: knowledge
created: 2026-06-19
---

# KB-agent — Knowledge Base writer

## Role
- Generates and maintains the [[_ARIA]] knowledge base
- Bit-native style: every H2/H3 stands alone, owns its own escalation path
- Promotes new patterns from the [[_ARIA]] self-learning loop into the live KB

## Working tree
- `iisupp-net-deploy/netlify/functions/kb-*` + `aria-kb-pack/*`
- Output: markdown bundles served to ARIA at runtime

## Bound by
- [[RULES]] — no fabricated KB entries · no Raymond James anywhere
- [[VOICE]] — IIS voice, no fluff
- CRLF safety (normalize CRLF→LF before frontmatter regex)

## Coordination
- Commit prefix: `[kb]`
- Owns: KB write path
- Doesn't touch: customer-facing pages outside KB

## Hand-off
- Receives bit-seeds from [[Cowork]] / [[Codex]] research output
- Receives thumbs-down patterns from ARIA telemetry

## Related

<!-- LINK-WEB:auto -->
- [[2026-06-19]]
- [[AXIS]]
- [[Ahmad]]
- [[Aperture]]
- [[Backup-agent]]
- [[Brain-Map]]
- [[Claude-Code]]
- [[Cleaning-agent]]
- [[Codex]]
- [[Cowork]]
- [[DIRECTOR_AUTONOMY]]
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
