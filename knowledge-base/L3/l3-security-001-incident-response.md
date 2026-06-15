---
id: l3-security-001
title: "Security incident response runbook (P1 cyber incident)"
category: security
support_level: L3
severity: critical
estimated_time_minutes: 240
audience: technician
prerequisites: ["SOC / IR lead authority", "MDE/Sentinel/Defender XDR access", "Forensic tooling"]
os_scope: ["All"]
keywords:
  - incident response
  - cyber incident
  - p1
  - soc
  - kill chain
  - mttc
  - mttd
  - exfiltration
  - lateral movement
  - tabletop
related_articles:
  - l2-malware-001
  - l1-email-001
  - l3-disaster-recovery-001
escalation_trigger: "Always engage executive leadership for P1; engage cyber-insurance, legal, external IR firm"
last_updated: 2026-05-07
version: 1.0
---

# Security incident response runbook

## 1. Phases (NIST 800-61)
1. **Preparation** — runbook, contacts, tooling, retainers.
2. **Detection & Analysis** — confirm incident, scope.
3. **Containment** — short-term + long-term.
4. **Eradication** — remove root cause + persistence.
5. **Recovery** — restore systems + monitoring.
6. **Lessons Learned** — postmortem + improvements.

## 2. Severity matrix
- **P1**: Ransomware, active data exfil, exec account takeover, AD compromise. Activate full IR, engage legal/insurance/external firm.
- **P2**: Malware on single endpoint, suspected phishing victim, single account compromise. SOC handles.
- **P3**: Policy violation, suspicious-but-bounded activity. Investigate and document.
- **P4**: Awareness / informational.

## 3. P1 immediate actions (first 60 min)
1. Activate IR bridge (call line) + Slack/Teams war room.
2. Assign roles: IC (incident commander), Comms, Tech Lead, Scribe, Liaison (legal/exec).
3. Snapshot scope: affected systems, users, data classifications.
4. Containment decisions:
   - Isolate compromised endpoints (MDE → Isolate).
   - Disable compromised accounts (Entra → Block sign-in + revoke sessions).
   - Block IoCs (firewall, MDE indicators).
   - Optional: full network segmentation if lateral spread suspected.
5. Preserve evidence — full disk image of compromised hosts via forensic tool.
6. Notify cyber-insurance (within 24h typical policy).
7. Notify executive leadership.
8. Engage external IR firm if retainer or per-incident.

## 4. Key investigation queries
- MDE Hunting: process tree of suspicious binary (`DeviceProcessEvents`).
- Sentinel: sign-in anomalies, mailbox rule changes, SharePoint sharing spikes.
- Audit log: privileged ops, group changes, app consents.
- Mailflow trace for BEC.
- DNS logs for C2 callbacks.

## 5. Eradication checklist
- Remove malware persistence (autoruns, services, scheduled tasks, WMI subscriptions).
- Reset credentials for affected and adjacent accounts.
- Reset KRBTGT twice (separated by replication interval) if AD compromise suspected.
- Revoke / re-issue certificates if PKI involved.
- Patch the entry vector.

## 6. Recovery
- Restore from clean backup (immutable / offline preferred).
- Re-image endpoints rather than clean.
- Monitor restored systems with elevated logging for 30 days.
- Phased return to service with sign-off gates.

## 7. Lessons learned
- Schedule postmortem within 14 days of close.
- Blameless format.
- Action items: owner + due date + measurable outcome.
- Update runbook + detections.
- Tabletop exercise quarterly.

## 8. Communication
- Internal: factual updates every 2h during active phase.
- External (customers, partners): only after legal+exec approval.
- Regulators: per jurisdiction (GDPR 72h, HIPAA, SEC 4-day rule, etc.).
- Media: never without comms lead; one spokesperson.

## 9. Tooling (recommended)
- EDR: Microsoft Defender for Endpoint.
- SIEM: Microsoft Sentinel or Splunk.
- Forensic: KAPE, Velociraptor, FTK.
- Network: Zeek, Wireshark.
- Communication: out-of-band (signal/phone) if email compromised.

## 10. Compliance / legal
- Document everything contemporaneously — IR is litigation-relevant.
- Chain of custody for evidence.
- Privilege: engage legal early to preserve attorney-client privilege over investigation.
- Cyber-insurance triggers timing of notifications, vendor selection.

## 11. Related Articles
- l2-malware-001 — Triage at L2
- l1-email-001 — Phishing entry point
- l3-disaster-recovery-001 — Recovery infra

## 12. Keywords
incident response, cyber incident, p1, soc, kill chain, mttc, mttd, exfiltration, lateral movement, tabletop
