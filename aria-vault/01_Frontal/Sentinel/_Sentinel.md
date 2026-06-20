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
3. Approve Chrome Web Store + MS Partner Store + Apple App Store submits

## Related

<!-- LINK-WEB:auto -->
- [[2026-06-20]]
- [[AXIS]]
- [[Ahmad]]
- [[Backup-agent]]
- [[Brain-Map]]
- [[CLAUDE_CODE_4HR_PACKET]]
- [[Claude-Code]]
- [[Cleaning-agent]]
- [[Codex]]
- [[Cowork]]
- [[DIRECTOR_AUTONOMY]]
- [[KB-agent]]
- [[Leads]]
- [[Leads-agent]]
- [[OPS-agent]]
- [[OTA-pipeline]]
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