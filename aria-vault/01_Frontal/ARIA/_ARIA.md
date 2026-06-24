---
brain_region: frontal-aria
---

# ARIA — Voice/chat AI IT-support SaaS

> Live at iisupp.net/aria. B2B-first. 5 paid tiers.

## What it is
- Voice + chat AI agent that fixes Tier-1 IT issues
- 25 detection→fix recipes
- Symbolic state dictionary (51 codes, expanding to 150)
- Content-blind sanitization
- Self-learning loop (KB grows from thumbs-down patterns)

## Pricing (live)
- Personal: $599/mo + $5,990/yr
- Pro: $1,500/mo + $15,000/yr
- Small Business: $156,000/yr
- Mid-Size: $312,000/yr
- Enterprise: $625,000/yr
- Lifetime: $2M (contact-only — Stripe caps at $999K)

See [[Stripe-Products]] for actual Stripe price IDs.

## Architecture
- Netlify Functions (143+ live)
- Anthropic Claude (Sonnet + Haiku)
- Netlify Blobs for state
- Front-end: aria.html + aria-core.js + aria-trial.js (DO NOT BREAK — Rule 8)

## Recipes
- See [[Recipes]] folder — 25 active, expanding to 75

## Related

<!-- LINK-WEB:auto -->
- [[2026-06-20]]
- [[AXIS]]
- [[Ahmad]]
- [[Backup-agent]]
- [[Brain-Map]]
- [[Claude-Code]]
- [[Cleaning-agent]]
- [[Codex]]
- [[Cowork]]
- [[DIRECTOR_AUTONOMY]]
- [[KB-agent]]
- [[Leads]]
- [[Leads-agent]]
- [[OPS-agent]]
- [[RULES]]
- [[Recipes]]
- [[STACK]]
- [[Stripe-Products]]
- [[VOICE]]
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
- [

<!-- LINK-WEB:auto -->
- [[Recipes]]
- [[Stripe-Products]]
- [[_Amygdala]]
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
- [[2026-06-19]]
- [[2026-06-20]]
- [[Ahmad]]
- [[Aperture]]
- [[ARIA_ADMIN_TOKEN]]
- [[AXIS]]
- [[Backup-agent]]
- [[Brain-Map]]
- [[Campaign]]
- [[CLAUDE_CODE_4HR_PACKET]]
- [[CLAUDE_CODE_AUTOCAPTURE_PACKET]]
- [[Claude-Code]]
- [[Cleaning-agent]]
- [[Codex]]
- [[Cowork]]
- [[Customer]]
- [[D-20260619-bake-stripe-price-ids-in-code]]
- [[D-20260624-aria-web-sentinel-one-product]]
- [[Daily-note]]
- [[Decision]]
- [[DIRECTOR_AUTONOMY]]
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
- [[Help-Desk-Implementation]]
- [[Jarvis-Companion]]
- [[KB-agent]]
- [[Leads]]
- [[Leads-agent]]
- [[link-web]]
- [[M365-Tune-Up]]
- [[Managed-IT-Support]]
- [[Office-Move]]
- [[OPS-agent]]
- [[OTA-pipeline]]
- [[other-note]]
- [[Overflow-Support-Pilot]]
- [[playbook-autonomous-morning]]
- [[playbook-round-velocity]]
- [[project-sentinel-ota-pipeline-live]]
- [[Project-Services]]
- [[Quick-Win-Sprint]]
- [[README]]
- [[reference-ahmad-resume-facts]]
- [[RULES]]
- [[SENTINEL_ADMIN_TOKEN]]
- [[skill-tts-voice-routing]]
- [[STACK]]
- [[VOICE]]
- [[watch-inbox]]
- [[Website-Intake-Fix]]
- [[Workflow-Audit]]
<!-- /LINK-WEB:auto -->

## Web + Sentinel — one product, one brain (2026-06-24)

ARIA web (`iisupp.net/aria`) and **ARIA Sentinel** (Windows desktop) are the **same product, one shared brain** — same KB (`knowledge-base/` + `aria_brain_pack/`), recipes, stop-codes, and the locked fall-through chain (KB $0 → Anthropic → offline local KB). The **same agents** (Claude-Code · KB-agent · OPS-agent) build both surfaces. Only intentional difference: the web "Resolve it for me" routes to a download/walkthrough gate (never runs local fixes), while Sentinel resolves locally through the RUN 29 gated control plane (supervisor → 10s countdown → kill-switch; Confirmed-grade, never autonomous). See [[D-20260624-aria-web-sentinel-one-product]] + `docs/STRUCTURE.md`.
