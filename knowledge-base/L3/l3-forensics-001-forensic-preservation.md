---
id: l3-forensics-001
title: "Digital forensic evidence preservation during a suspected breach"
category: security
support_level: L3
severity: critical
estimated_time_minutes: 180
audience: it-technician
os_scope: ["All"]
prerequisites: []
keywords:
  - forensic preservation
  - order of volatility
  - memory image
  - disk image
  - chain of custody
  - do not power off
  - isolate not wipe
  - incident response firm
  - evidence integrity
  - hashing
  - timeline analysis
  - tipping off the attacker
related_articles:
  - l3-security-001
  - l3-security-002
  - l3-endpoint-001
  - l3-disaster-recovery-001
escalation_trigger: "Stop and engage the external IR firm, legal/privacy counsel, cyber-insurance, and (where applicable) law enforcement before remediating; do not power off, re-image, or alter suspect systems until evidence is preserved."
last_updated: 2026-06-24
version: 1.0
---

# Digital forensic evidence preservation during a suspected breach

## 1. Symptoms
- A breach is suspected or confirmed (ransomware note, data-exfil alert, web-shell, attacker tooling, anomalous privileged activity).
- EDR/SIEM alerts or a third party (vendor, partner, law enforcement, extortion email) indicate compromise.
- Strong instinct on the floor to "just reboot/re-image/clean it" — which would destroy the evidence needed to understand scope.
- Unknown blast radius: it isn't yet clear which systems, accounts, or data are involved.

## 2. Likely Causes
- Active or recent intrusion: credential theft, lateral movement, persistence, ransomware staging, or data theft.
- This article applies whenever the cause is under investigation — the goal is to preserve the ability to determine root cause, scope, and impact, not to assume one.

## 3. Questions To Ask User
- What was observed, when, and by whom — what's the first indicator and timestamp?
- Which systems/accounts/data look involved, and how critical/sensitive are they?
- Has anyone already rebooted, logged in, run AV scans, deleted files, or re-imaged anything (i.e., already altered evidence)?
- Is the attacker possibly still active (don't tip them off — avoid obvious "we caught you" actions)?
- Do we have cyber-insurance, a retained IR firm, and legal/privacy counsel to engage now?
- Are there regulatory or contractual breach-notification obligations likely in scope?
- Where are the relevant logs (endpoint, network, cloud, identity) and what is their retention?

## 4. Troubleshooting Steps
> This is a STOP-and-preserve posture. ARIA's role is to triage, document, isolate, and escalate — NOT to remediate, clean, or power off. Improper handling can destroy evidence and harm legal/insurance standing. Engage the IR firm/legal before invasive action.
1. **Pause the urge to "fix it."** Do not power off, reboot, re-image, run cleanup/AV remediation, or delete anything on suspect systems — these destroy volatile and on-disk evidence.
2. **Isolate, don't wipe.** Contain at the network level (EDR network-isolation, switch port/VLAN quarantine, or pull the network cable) so the system stays powered and intact but can't spread or be controlled remotely. Powered-on isolation preserves memory.
3. **Respect order of volatility** when planning collection: most volatile first — memory/RAM, running processes, network connections, then disk, then archived logs/backups. Capture the perishable evidence before it's gone.
4. **Preserve logs and identity/cloud trails** that age out: endpoint, firewall/NetFlow, DNS, proxy, mail, and cloud/identity audit logs. Extend retention and export copies before rotation deletes them.
5. **Avoid tipping off the attacker.** Don't make changes that broadcast detection (mass password resets, blocking their C2 in an obvious way) before IR has a containment plan — premature moves can trigger destruction or acceleration. IR/leadership choose the timing.
6. **Document everything contemporaneously** (who/what/when/why) — this record is litigation- and insurance-relevant.

## 5. Resolution Steps
> Section 5 is for a senior responder, ideally the external IR firm. Acquisition must preserve integrity (write-blocking, hashing, custody). Mandatory human/vendor/legal engagement is called out.
1. **Engage the external IR firm, legal/privacy counsel, and cyber-insurance now.** Insurance often dictates approved vendors and notification timing; legal involvement helps preserve privilege. This step gates the rest.
2. **Acquire volatile data first:** capture a memory image from the live, isolated system using forensically sound tooling before any shutdown; record running processes/connections. Memory is lost the instant power is removed.
3. **Acquire disk images** as forensic (bit-for-bit) copies using write-blocking; compute and record cryptographic hashes of each image to prove integrity. Work from copies — never investigate on the original.
4. **Establish chain of custody:** label evidence, record every handler/transfer with timestamps, and store securely. Gaps in custody can render evidence unusable.
5. **Preserve cloud/SaaS and identity evidence** (audit logs, sign-in logs, mailbox/audit exports, snapshots) per provider guidance before retention windows expire.
6. **Build the timeline** from preserved sources to establish initial access, scope, and impact — this drives the eventual eradication/recovery in l3-security-001, which only proceeds once evidence is secured and IR approves.
7. **Coordinate law-enforcement notification** where applicable through legal — do not contact attackers; preserve any extortion communications as evidence.

## 6. Verification Steps
- Suspect systems isolated but intact (still powered where memory was needed); no remediation/reboot/re-image occurred prematurely.
- Memory and disk images acquired with recorded hashes that verify; originals untouched and secured.
- Chain-of-custody records complete and continuous for every evidence item.
- Volatile and short-retention logs (endpoint/network/cloud/identity) exported and preserved before rotation.
- IR firm, legal, and cyber-insurance engaged and steering; notification obligations being tracked by counsel.
- Investigation timeline underway; no actions taken that tipped off the attacker ahead of the containment plan.

## 7. Escalation Trigger
Stop and escalate before any remediation: engage the external IR firm, legal/privacy counsel, and cyber-insurance immediately, and law enforcement where applicable (via legal). Do not power off, reboot, re-image, run cleanup, or make attacker-visible changes until volatile and disk evidence is preserved and IR approves the containment/eradication plan. When in doubt, preserve and call IR — destroyed evidence cannot be recovered.

## 8. Prevention Tips
- Pre-arrange an IR retainer, cyber-insurance, and legal counsel, with contacts in an out-of-band runbook (assume email/identity may be compromised).
- Maintain robust, centralized, tamper-resistant logging with sufficient retention across endpoint, network, cloud, and identity (you can't reconstruct what wasn't logged).
- Have forensic acquisition tooling and trained staff (or vendor on call); never improvise acquisition during a live incident.
- Define and train the "isolate-don't-wipe, don't-power-off, preserve-first" posture so responders don't reflexively clean systems.
- Use immutable/offline backups (l3-disaster-recovery-001 / l3-backup-dr-002) so recovery doesn't depend on destroying evidence.
- Run tabletop exercises that explicitly practice evidence preservation and chain of custody.

## 9. User-Friendly Explanation
When we suspect a break-in, the natural reaction is to wipe the affected computer and move on — but that's like scrubbing a crime scene before investigators arrive. We need to find out how the attacker got in, what they touched, and whether they're still inside, and that evidence lives in the computer's memory and disk. So we keep affected systems powered but cut off from the network, make exact protected copies (with a tracked chain of custody, like an evidence bag), and preserve the logs before they age out. We also avoid obvious moves that would warn the attacker we've noticed. Specialists — an incident-response firm, your lawyers, and your cyber-insurer — guide this, and only then do we clean up and recover.

## 10. Internal Technician Notes
- The cardinal sins: powering off, rebooting, re-imaging, or running AV "cleanup" on a suspect host before imaging. Memory dies with power; on-disk artifacts die with re-image.
- Isolate ≠ wipe. Network-isolate (EDR/VLAN/cable) while keeping power on to preserve RAM. Capture memory before any shutdown.
- Order of volatility: RAM/processes/connections → disk → archived logs/backups. Grab the perishable stuff first.
- Chain of custody and image hashing are what make evidence usable later — sloppiness here can void it for insurance/legal/court.
- Don't tip off the attacker: hold loud containment (mass resets, obvious C2 blocks) until IR sets the timing, or they may destroy data or accelerate.
- Engage IR/legal/insurance before remediating — insurance may mandate vendors and notification timing, and legal involvement helps preserve privilege. Eradication/recovery happens in l3-security-001 after evidence is secured.

## 11. Related KB Articles
- l3-security-001 — Incident response runbook (containment/eradication/recovery after preservation)
- l3-security-002 — Zero-day response that may pivot into a breach
- l3-endpoint-001 — EDR isolation and endpoint telemetry used for preservation
- l3-disaster-recovery-001 — Clean recovery from immutable backups post-investigation

## 12. Keywords / Search Tags
forensic preservation, order of volatility, memory image, disk image, chain of custody, do not power off, isolate not wipe, incident response firm, evidence integrity, hashing, timeline analysis, tipping off the attacker
