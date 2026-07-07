# ARIA Sentinel Desktop Agent Spec

Audit timestamp: 2026-07-06 22:20 ET

## Current Implemented Foundations

- ARIA Central Electron shell.
- Floating globe overlay and renderer.
- System context and process detectors.
- Event log, WER, crash, network, and performance signal mapping.
- Resolution tab: Fix It and Fix History.
- Office File Safety Net service.
- File association guard.
- Tier-0 executor, supervisor, countdown, kill-switch, dry-run policy.
- ARIA Chat web-aligned guided answer cards.

## Required Desktop Behaviors

| Behavior | Status | Notes |
|---|---|---|
| List currently running apps | GREEN | Process/system-context modules and tests exist. |
| Identify high-resource/crashed apps | YELLOW | Generic detection exists; app-specific policy still needed. |
| Read event logs | GREEN | Event-log watcher and sanitizer tests exist. |
| Detect app-specific errors | YELLOW | Generic plus M365/browser recipes; vendor-specific expansion needed. |
| Classify root cause | YELLOW | Diagnostic reasoner exists; needs production calibration. |
| Send findings to ARIA Central | GREEN | Local state/detections and UI surfaces exist. |
| Trigger globe alert | GREEN | Overlay/globe prompt path exists. |
| Offer autonomous/manual/live options | YELLOW | Core mode UI exists; issue-card consistency must be finished for all runbooks. |
| Execute safe local remediation | YELLOW | Tier-0 and confirmed paths exist; broader recipes remain policy-gated. |
| Log every scan/action | YELLOW/GREEN | Audit/Fix History strong locally; fleet observability incomplete. |

## Desktop Release Rules

- Manual stays default.
- Dry-run/test/demo modes must be visibly labeled.
- User-facing product must not display fake success for dry-run actions.
- Packaged app version must match `package.json`.
- Latest local proof should launch `ARIA Sentinel/dist/win-unpacked/ARIA Sentinel.exe` until installer/update channel is refreshed.

