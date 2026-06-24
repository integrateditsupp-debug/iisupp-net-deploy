---
id: t4-endpoint-002
title: "On-Device NPU (Copilot+/AI PC) Issues"
category: endpoint
support_level: L2
tech_generation: tier-4
tier4_pack: next-gen-endpoint
severity: medium
estimated_time_minutes: 50
audience: it-technician
os_scope: ["Windows 11","macOS","cross-platform"]
prerequisites: []
keywords: ["npu","neural processing unit","copilot plus pc","ai pc","onnx runtime","ai accelerator","npu driver","directml","apple neural engine","thermal throttling","on-device inference","ai feature not using npu"]
related_articles: ["t4-endpoint-001","t4-endpoint-004","t4-endpoint-003"]
escalation_trigger: "An NPU fault persists after driver/runtime reinstall and the device cannot run required on-device AI features."
last_updated: 2026-06-24
version: 1.0
---

## 1. Symptoms
- An AI feature that should accelerate on the NPU is slow, falls back to CPU/GPU, or fails to start.
- Device Manager / system info shows the NPU missing, with a warning, or an outdated driver.
- High CPU usage and fan noise during AI tasks that "should" be efficient on the NPU.
- An app reports it can't find a supported AI accelerator or a runtime (e.g., ONNX Runtime) error.
- Battery drains quickly or the device throttles during sustained AI workloads.

## 2. Likely Causes
- **Missing or outdated NPU driver** (the dedicated neural-processing-unit driver, distinct from the GPU driver).
- **AI runtime not installed/registered** (e.g., ONNX Runtime / DirectML execution provider on Windows; the on-device ML runtime on macOS).
- **App not configured to target the NPU** — it defaults to CPU/GPU, or the model isn't in an NPU-compatible format.
- **Power/thermal limits:** a thermal or power-saver state throttles the accelerator; sustained loads heat-soak the device.
- **Unsupported hardware/feature combination** — the feature requires an AI-PC-class NPU the device doesn't have, or a minimum OS build.

## 3. Questions To Ask User
- What feature/app is affected, and does it explicitly require the NPU/AI accelerator?
- Is this a Copilot+ / AI-PC-class machine (or Apple-silicon Mac with a Neural Engine)?
- Does the problem happen on battery only, or also plugged in (suggests power/thermal)?
- When did it start — after a Windows/macOS update or a driver update?
- Any error code or "no accelerator found" message from the app?

## 4. Troubleshooting Steps
1. **Confirm the hardware** actually has an NPU and the OS build meets the feature's minimum requirement.
2. **Check the NPU driver** in Device Manager (Windows) / system report (macOS): present, enabled, current version, no error.
3. **Verify the AI runtime** the app uses is installed and registered (e.g., ONNX Runtime / execution provider). Capture any runtime error text.
4. **Test power/thermal:** repeat on AC power and in a cool state; watch whether performance recovers (points to throttling).
5. **Check app settings** for an accelerator/device selection (NPU vs CPU vs GPU) and whether the model is in a supported format.

## 5. Resolution Steps
1. **Update the NPU driver** from the OEM/silicon vendor channel (not just generic GPU drivers); on Windows pull via the managed update channel, on macOS via OS update.
2. **Install/repair the AI runtime** and its NPU execution provider; re-register if the app reports it missing.
3. **Point the app at the NPU** in its settings if it defaulted to CPU/GPU; ensure the model is in an NPU-supported format/precision.
4. **Address thermal/power:** set the device to a balanced/performance power mode for sustained AI work, ensure ventilation, and update firmware/BIOS if a thermal fix is published.
5. **Roll back a bad driver/runtime** if the fault began right after an update, then pin to the known-good version.
6. **Reboot** after driver/runtime changes so the accelerator re-initializes.

## 6. Verification Steps
- The NPU shows healthy in Device Manager / system report with a current driver.
- The target AI feature runs and the app reports it is using the NPU/accelerator (not CPU fallback).
- CPU usage and fan noise drop during the AI task vs. the failing state.
- Performance holds on battery and AC (no thermal cliff), or the throttling cause is documented.

## 7. Escalation Trigger
Escalate to L3 / OEM when an NPU fault persists after driver and runtime reinstall, the hardware is confirmed capable but the OS won't enumerate the accelerator, or a firmware-level thermal/power fault blocks required on-device AI features.

## 8. Prevention Tips
- Keep NPU drivers and AI runtimes on the OEM/managed update channel; validate them in a test ring (ties to t4-endpoint-001).
- Confirm device + OS build meet AI-feature minimums before promising NPU-accelerated workflows.
- Record known-good driver/runtime versions per device model.
- Ensure adequate cooling and an appropriate power profile for sustained on-device inference.

## 9. User-Friendly Explanation
Newer "AI PCs" have a special chip called an NPU that runs AI features quickly and efficiently. If its driver is missing or outdated, or the app isn't told to use it, the work falls back to the regular processor — making things slow, hot, and battery-hungry. We update the NPU's driver and the AI runtime, point the app at the NPU, and make sure the device isn't overheating or in a power-saving mode that holds it back.

## 10. Internal Technician Notes
- The NPU driver is a **separate** component from the GPU driver — updating the GPU does not update the NPU.
- "Works but slow" usually means CPU/GPU fallback; confirm the app is genuinely on the NPU, not just running.
- ONNX Runtime / DirectML execution providers (Windows) and the Apple Neural Engine path (macOS) are the common runtime layers — name them as references, don't claim certification.
- Runtime/quantization changes here can shift AI output, which surfaces as drift in t4-endpoint-001.
- Sustained inference is a thermal workload — heat-soak throttling masquerades as a "driver" problem.

## 11. Related KB Articles
- t4-endpoint-001 — AI Model Drift & On-Device-AI Auto-Update Breakage
- t4-endpoint-004 — Local-LLM / On-Prem GPU Build-Out
- t4-endpoint-003 — Self-Healing Endpoint → Human Escalation

## 12. Keywords / Search Tags
NPU, neural processing unit, Copilot+ PC, AI PC, ONNX Runtime, DirectML, Apple Neural Engine, AI accelerator, NPU driver, CPU fallback, thermal throttling, on-device inference
