---
brain_region: cortex-frontal
type: agent
role: build
created: 2026-06-19
---

# Claude Code — build agent (same as [[Codex]])

## Role
- Code-execution agent that runs in Ahmad's terminal
- Picks up packets from [[Cowork]] and ships them
- Lives at: anthropic.com/claude-code

## Operating mode
- Reads `aria-vault/CLAUDE.md` first when invoked inside the vault
- Reads project-root CLAUDE.md when invoked inside iisupp-net-deploy
- Output: code changes + green tests + a report markdown

## Active assignment
- ARIA Sentinel v1.0 roadmap → `ARIA Sentinel/docs/ROADMAP_TO_V1.md`
- 10 runs, ~4hr each, currently RUN 1 → RUN 2 in progress

## Hand-off path
- [[Cowork]] writes the RUN N packet → Ahmad pastes into Claude Code → Code ships → posts report
- [[Cowork]] verifies + writes RUN N+1 packet

## Bound by
- [[RULES]] — every standing rule
- [[VOICE]] — same tone
- ARIA Sentinel locked rules in `ARIA Sentinel/CLAUDE.md`

## Why two names
- "Codex" = legacy naming (from earliest Anthropic agent experiments)
- "Claude Code" = current official product name
- Both terms refer to the same agent in this vault

## Related

<!-- LINK-WEB:auto -->
- [[2026-06-19]]
- [[2026-06-20]]
- [[AXIS]]
- [[Ahmad]]
- [[Aperture]]
- [[Backup-agent]]
- [[Brain-Map]]
- [[Cleaning-agent]]
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
- [[reference-ahmad-resume-fac