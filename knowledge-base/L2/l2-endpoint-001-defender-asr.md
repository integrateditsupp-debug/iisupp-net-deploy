---
id: l2-endpoint-001
title: "Defender ASR rules / Attack Surface Reduction tuning"
category: endpoint
support_level: L2
severity: medium
estimated_time_minutes: 30
audience: admin
prerequisites: ["Defender for Endpoint admin"]
os_scope: ["Windows 10", "Windows 11"]
keywords:
  - asr
  - attack surface reduction
  - defender
  - block office macros
  - block credential stealing
  - audit mode
  - rule guid
related_articles:
  - l2-malware-001
  - l3-security-001
escalation_trigger: "Mass block on legitimate business app or ASR rule conflict with business workflow"
last_updated: 2026-05-07
version: 1.0
---

# Defender ASR rules

## 1. Goals
ASR rules block exploit techniques without breaking apps. Use Audit mode first, Block mode after tuning.

## 2. High-value rules to enable
- Block credential stealing from LSASS.
- Block Office apps from creating child processes.
- Block Office macros from internet origin.
- Block all Office apps from injecting code into other processes.
- Block executable content from email/webmail.
- Block Adobe Reader from creating child processes.
- Use advanced protection against ransomware.

## 3. Deploy
- Intune → Endpoint security → Attack surface reduction → ASR Rules profile.
- Set each rule: Audit / Block / Warn / Off.
- Pilot Audit on all → review in MDE → Block in waves.

## 4. Investigate alerts
- MDE → Alerts → filter "ASR".
- Review process tree, parent, command line.
- If legitimate app blocked: add file/path/folder exclusion via ASR rules profile.
- Don't disable rule globally to fix one app.

## 5. Verification
- Rule in Block mode and report shows expected blocks.
- No business-app regression after 7d.
- Alerts triaged, exclusions documented.

## 6. Escalation
- Mass block on critical line-of-business app.
- ASR conflict with EDR vendor (if 3rd party).
- → L3.

## 7. Prevention
- Always Audit-first, 30-day soak.
- Document why each rule is on, exceptions, owner.
- Review exclusions quarterly.
- Don't blanket-disable.

## 8. Notes
- Rule GUIDs published by Microsoft; necessary for advanced hunting.
- Some rules need Defender AV active (not 3rd-party).
- Tamper Protection on prevents users / malware from disabling.
- "Warn" mode lets user override once — use sparingly.

## 9. Related
- l2-malware-001 — Triage
- l3-security-001 — IR runbook

## 10. Keywords
asr, attack surface reduction, defender, block office macros, block credential stealing, audit mode, rule guid
