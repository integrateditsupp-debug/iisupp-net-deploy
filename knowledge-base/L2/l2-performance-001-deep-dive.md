---
id: l2-performance-001
title: "Performance deep dive: WPR / xperf / consistent slowness diagnosis"
category: performance
support_level: L2
severity: medium
estimated_time_minutes: 60
audience: technician
prerequisites: ["Local admin", "ADK with Windows Performance Toolkit"]
os_scope: ["Windows 10", "Windows 11"]
keywords:
  - performance
  - wpr
  - xperf
  - traces
  - boot performance
  - high cpu
  - long delay
  - hang
related_articles:
  - l1-windows-003
  - l2-drivers-001
escalation_trigger: "Trace shows kernel-mode driver or firmware issue requiring vendor"
last_updated: 2026-05-07
version: 1.0
---

# Performance deep dive (WPR / xperf)

## 1. When to use
- L1 cleanup didn't resolve consistent slowness.
- Hang on specific action (slow file open, slow browser).
- Boot >2 minutes without obvious cause.
- High kernel time (red in Task Manager).

## 2. Capture
- Install Windows Performance Recorder (ADK).
- WPR profiles: General, CPU usage, Disk IO, Networking IO, etc.
- Capture: `wpr -start GeneralProfile -filemode` → reproduce → `wpr -stop trace.etl`.

## 3. Analyze
- Open .etl in Windows Performance Analyzer (WPA).
- Common views:
  - **CPU Usage (Sampled):** which process / module consumed CPU.
  - **Disk Usage:** I/O heat per file/process.
  - **Network Usage:** byte-by-byte.
  - **Window in focus:** UI delay attribution.

## 4. Common findings
- 3rd-party AV consuming CPU on file access → exclusion list audit.
- Telemetry agent hammering disk → version upgrade or disable.
- DPC/ISR storm from driver → driver update / replace.
- WMI Provider Host (svchost) high → identify provider via `wmiprvse.exe` PID + `Get-WmiObject` query in trace.
- Search indexer rebuilding → wait or rebuild index.

## 5. Action
- Document fix in KB (specific to user's environment).
- Push policy / driver / exclusion via Intune.
- Verify post-fix with second trace.

## 6. Escalation
- Vendor regression in driver / firmware → vendor case.
- Microsoft case for OS-level regressions.
- → L3.

## 7. Prevention
- Standardize endpoint apps; reduce surface area.
- Curate AV exclusions per Microsoft's published guidance per role.
- Monitor key counters: CPU time per logon, disk queue length, DPC time.

## 8. Notes
- For boot perf, WPR `Boot` profile + `wpr -boottrace -addboot GeneralProfile`.
- ProcMon for individual file access narratives.
- For VDI / RDS, capture is heavier — coordinate window with users.

## 9. Related
- l1-windows-003 — User-facing slow PC
- l2-drivers-001 — Driver fleet management

## 10. Keywords
performance, wpr, xperf, traces, boot performance, high cpu, long delay, hang
