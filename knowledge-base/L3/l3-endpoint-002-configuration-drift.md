---
id: l3-endpoint-002
title: "Endpoint configuration drift: detecting and remediating managed devices that no longer match baseline"
category: endpoint
support_level: L3
severity: high
estimated_time_minutes: 90
audience: technician
os_scope: ["Windows 10", "Windows 11", "macOS", "iOS", "Android"]
prerequisites: ["Intune/MDM admin", "Understanding of configuration profiles, compliance, and security baselines", "Reporting access (Intune/Defender/Log Analytics)"]
keywords:
  - configuration drift
  - endpoint drift
  - baseline drift
  - policy not applied
  - compliance regression
  - settings reverted
  - config drift remediation
  - intune baseline
  - desired state
related_articles:
  - l2-intune-001
  - l2-endpoint-001
  - l3-endpoint-001
escalation_trigger: "This IS the L3 article. Engage vendor support only for confirmed MDM platform/agent defects after remediation patterns are exhausted."
last_updated: 2026-05-26
version: 1.0
---

# Endpoint configuration drift — detect and remediate

## 1. Symptoms
- Devices that were compliant now report **Not compliant** or **Error/Conflict** on policies.
- Security settings (BitLocker, Defender, firewall, ASR rules) silently revert to non-baseline values.
- A subset of the fleet shows different applied settings than the rest despite identical assignment.
- Audits find local changes (registry, local admins, disabled services) diverging from desired state.
- Newly enrolled devices match baseline; older ones have "rotted" over months.

## 2. Likely Causes
1. **Conflicting policies** — two profiles set the same CSP/setting differently → "Conflict," last-writer or none wins.
2. **Local/manual changes** by users or scripts overriding MDM where the CSP allows local precedence.
3. **GPO vs. MDM tug-of-war** on co-managed/hybrid devices (group policy re-asserting old values).
4. **Failed/partial policy application** — device offline at sync, token expiry, or CSP error left settings half-applied.
5. **Assignment scope changes** — a device left/was removed from a group, so a profile stopped applying without being "removed."
6. **Baseline version skew** — security baseline updated centrally but some devices still on the prior version.
7. **Third-party agents** (legacy AV, RMM) reverting security settings.

## 3. Questions / Scoping
1. What is the **authoritative baseline** (which profiles + security baseline version define "correct")?
2. Is the fleet **co-managed** (Intune + ConfigMgr/GPO) or Intune-only?
3. Drift on **specific settings** or broad? Which CSPs/areas?
4. Drift correlated with **OS version, hardware model, or enrollment date**?
5. Any recent **policy edits, baseline bumps, or group membership changes**?

## 4. Detection / Triage Steps
1. **Establish desired state explicitly:** export the assigned configuration profiles, compliance policies, and security baseline version that define correct.
2. **Run the drift report:** Intune → Devices → Monitor → **Configuration/Compliance** reports; filter Error/Conflict/Not applicable. Endpoint security → Security baselines → versions and per-setting status.
3. **Inspect a drifted device locally:**
   - Windows: Settings → Access work or school → Info → Sync + view policy report; `dsregcmd /status`; Event Viewer → EnterpriseMgmt (MDM Diagnostics, `mdmdiagnosticstool.exe -area DeviceEnrollment;DeviceProvisioning -cab out.cab`).
   - Check `gpresult /h` on co-managed devices to spot GPO re-asserting values.
4. **Correlate:** group the drifted set by OS/model/enrollment date/baseline version to find the common factor.
5. **Identify conflicts:** Intune per-setting status shows "Conflict" with the two competing profiles — that's your root cause for those settings.

## 5. Remediation Steps
**Resolve policy conflicts (do this first):**
1. Consolidate duplicate settings to a **single source of truth** profile; remove the same CSP from competing profiles.
2. Prefer **security baselines** for security settings; don't also set them in ad-hoc config profiles.

**Re-converge co-managed devices:**
1. Decide authority per workload (Intune vs. ConfigMgr) and set the **co-management workload sliders** accordingly so one system owns each area.
2. Remove the legacy **GPO** that re-asserts a setting MDM now owns (GPO generally wins on hybrid devices for the same setting).

**Force re-application:**
1. Trigger an MDM **Sync** (Company Portal / Settings) or run the EnterpriseMgmt scheduled sync task; for compliance, use **on-demand** evaluation.
2. For stubborn CSP errors, remove and re-assign the profile to the group, or use a **remediation script** (Intune → Remediations: a detection + fix scriptpair) to enforce desired state on a schedule — this is the durable answer to recurring local drift.

**Handle third-party reverts:**
1. Identify the agent reverting settings (Defender vs. legacy AV both managing the firewall, etc.) and decommission/whitelist appropriately.

**Re-baseline laggards:**
1. Move devices on an old security-baseline version to the current version (assign the new baseline, retire the old), validate no new conflicts.

## 6. Verification Steps
- Drift/compliance report shows the target devices return to **Compliant**, with **0 Conflict** on the affected CSPs.
- A previously drifted setting is confirmed correct on a sample device locally (registry/CSP value matches baseline).
- The remediation script's **detection** reports "compliant" on the next run (no fix needed) across the fleet.
- A deliberate test change on a pilot device is **auto-corrected** within the next remediation cycle (proves desired-state enforcement, not just one-time fix).

## 7. Escalation Trigger
- Confirmed **MDM agent / CSP defect** reproducible after conflicts and GPO contention are eliminated → open a vendor (Microsoft) support case with MDM diagnostics CAB.
- Drift caused by an unmanaged change-control gap → route to the **change-management process**, not a technical fix.

## 8. Prevention Tips
- **One setting, one owner:** never set the same CSP in two profiles; use security baselines for security settings.
- Deploy **Intune Remediations** (detect+fix scripts) for the handful of settings prone to local drift — continuous desired-state enforcement.
- Version and document baselines; roll updates in **rings** (pilot → broad) and retire old versions promptly.
- On hybrid devices, decide GPO-vs-MDM authority deliberately and document it; avoid dual ownership.
- Schedule periodic drift audits (monthly) rather than discovering it during an incident.

## 9. User-Friendly Explanation (for stakeholders)
"Over time, managed devices can quietly drift away from our security standard — a setting gets changed locally, two policies fight over the same option, or an old device never picked up the latest baseline. We detect that with reporting, find the common cause, remove the conflict, and put a self-healing check in place so the setting corrects itself automatically from now on. The outcome is the fleet reliably matching the approved security baseline, with proof in the compliance reports."

## 10. Internal Technician Notes
- `mdmdiagnosticstool.exe -area "DeviceEnrollment;DeviceProvisioning;Autopilot" -cab C:\temp\mdm.cab` then review the report HTML — fastest per-CSP application/error view on Windows.
- Conflict resolution order is not "newest wins" reliably — Intune marks Conflict and may apply nothing; eliminate duplicates rather than relying on precedence.
- Remediations (Proactive Remediations) require the corresponding license tier; the detect/fix PowerShell pair is the canonical desired-state-config pattern for Intune.
- Co-management: BitLocker/Defender/firewall workload ownership is set centrally; a device can show Intune as "managed" while ConfigMgr still owns a workload.
- macOS drift: compare against the assigned `.mobileconfig`; settings the user can change locally need a managed (forced) profile, not a default.

## 11. Related KB Articles
- l2-intune-001 — Device compliance
- l2-endpoint-001 — Defender / ASR
- l3-endpoint-001 — EDR strategy

## 12. Keywords / Search Tags
configuration drift, endpoint drift, baseline drift, policy not applied, compliance regression, settings reverted, config drift remediation, intune baseline, desired state, proactive remediations, co-management, csp conflict, mdmdiagnosticstool
