---
brain_region: frontal-sentinel
---

# ARIA Sentinel — Windows desktop agent (MVP shipping)

> The big bet. Resident IT support that never sleeps. Strict privacy.

## Current state
- v0.1.0 unsigned NSIS · internal pilot artifact
- Enterprise readiness: 8.6/10 per docs/ENTERPRISE_READINESS.md
- All 6 test suites green
- Shell is solid (Electron + Chrome ext + admin console + 25 recipes)

## What ships in v1
- Floating gold globe (SVG, 6 states) + cursor-dodge + edge-hugging
- 7 Windows detectors (disk · event log · perf · crash-control · service · network · WER)
- 25 fix recipes (8 desktop · 6 browser, expanding)
- BSOD Tier C (crash-on-resume) + Tier A (BCD boot menu entry)
- Content-blind sanitization (sanitizeToSignature)
- Chrome / Edge / Safari extensions (Manifest V3)
- ServiceNow ticket bridge (per-customer OAuth)
- Privacy verifier UI (proves no upload paths)

## Hand-off packet
- [[CLAUDE_CODE_4HR_PACKET]] — single-paste 4hr build spec for Claude Code

## Sprints (per docs/CODEX-COMPLETE-PACKAGE-A-Z.md)
- Sprint 0: backend extensions (mostly done)
- Sprint 1: Windows + Chrome MVP (in progress)
- Sprint 2: macOS port
- Sprint 3: Edge + Safari
- Sprint 4: Autonomous mode + BSOD Tier A
- Sprint 5: Recipe expansion to 75
- Sprint 6: v1.0 polish

## What needs Ahmad's hands (only)
1. Microsoft Authenticode EV cert (~$300/yr, after MVP test)
2. Apple Developer ID ($99/yr, before macOS port)
3. Approve Chrome Web Store + MS Partner Store + Apple App Store submits## Web + Sentinel — one product, one brain (2026-06-24)

ARIA web (`iisupp.net/aria`) and **ARIA Sentinel** (Windows desktop) are the **same product, one shared brain** — same KB (`knowledge-base/` + `aria_brain_pack/`), recipes, stop-codes, and the locked fall-through chain (KB $0 → Anthropic → offline local KB). The **same agents** (Claude-Code · KB-agent · OPS-agent) build both surfaces. Only intentional difference: the web "Resolve it for me" routes to a download/walkthrough gate (never runs local fixes), while Sentinel resolves locally through the RUN 29 gated control plane (supervisor → 10s countdown → kill-switch; Confirmed-grade, never autonomous). See [[D-20260624-aria-web-sentinel-one-product]] + `docs/STRUCTURE.md`.

## Related

<!-- LINK-WEB:auto -->
- [[CLAUDE_CODE_4HR_PACKET]]
- [[OTA-pipeline]]
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
- [[_Inb]]
- [[_Inbox]]
- [[2026-06-20]]
- [[2026-06-24]]
- [[Ahmad]]
- [[AXIS]]
- [[Backup-agent]]
- [[Brain-Map]]
- [[Claude-Code]]
- [[Cleaning-agent]]
- [[Codex]]
- [[Cowork]]
- [[D-20260624-aria-web-sentinel-one-product]]
- [[DIRECTOR_AUTONOMY]]
- [[KB-agent]]
- [[Leads]]
- [[Leads-agent]]
- [[Live-Operations-Log]]
- [[OPS-agent]]
- [[RULES]]
- [[STACK]]
- [[VOICE]]
<!-- /LINK-WEB:auto -->
