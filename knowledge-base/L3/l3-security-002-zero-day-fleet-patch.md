---
id: l3-security-002
title: "Zero-day / actively-exploited vulnerability emergency fleet response"
category: security
support_level: L3
severity: critical
estimated_time_minutes: 240
audience: it-technician
os_scope: ["All"]
prerequisites: []
keywords:
  - zero day
  - actively exploited
  - cisa kev
  - cvss
  - emergency patch
  - compensating control
  - virtual patching
  - ring deployment
  - ioc hunting
  - exploited in the wild
  - emergency change
  - out of band update
related_articles:
  - l3-security-001
  - l3-endpoint-001
  - l3-forensics-001
  - l3-network-ddos-001
escalation_trigger: "Engage security leadership/CISO, the affected vendor, and (if exploitation is confirmed internally) the incident-response process the moment an actively-exploited zero-day is suspected to affect exposed assets."
last_updated: 2026-06-24
version: 1.0
---

# Zero-day / actively-exploited vulnerability emergency fleet response

## 1. Symptoms
- A vendor advisory or threat feed reports a vulnerability **actively exploited in the wild** (often added to a known-exploited catalog such as CISA KEV).
- A widely deployed product in your fleet (edge appliance, VPN, mail/web server, hypervisor, browser, OS component) is named.
- No patch yet exists, or an out-of-band emergency patch was just released ahead of the normal cycle.
- Possible early signs of compromise on exposed assets: unexpected outbound connections, new accounts/web-shells, anomalous auth, or EDR/IDS alerts matching the published IOCs.

## 2. Likely Causes
- A newly disclosed flaw with public or in-the-wild exploit code and no/limited vendor fix at disclosure time.
- Internet-facing or high-value assets running the affected, unpatched version.
- Patch gaps from deferred maintenance, unmanaged/shadow assets, or end-of-life software with no fix path.
- The vulnerability is reachable given current exposure (open ports, enabled feature, default config) — exposure, not mere presence, drives risk.

## 3. Questions To Ask User
- Which product/version is named, and do we run it — where, and is it internet-facing?
- Is it confirmed exploited in the wild (KEV/vendor), and what is the CVSS plus real exploitability for our exposure?
- Is a patch available now, and is there a vendor-recommended interim mitigation if not?
- Are there any current signs of compromise on the candidate assets (alerts, IOCs, anomalies)?
- What is the business impact of patching urgently (downtime, reboot) vs the risk of waiting?
- Who can approve an emergency change outside the normal window, and who must be notified?
- Do we have complete asset inventory/coverage to be confident we found every affected instance?

## 4. Troubleshooting Steps
> ARIA's role here is to triage, document, and coordinate — gather facts, build the exposure picture, and stage the change. Humans (security leadership) decide; senior engineers execute. ARIA does not autonomously push emergency changes or take production offline.
1. **Confirm the advisory from authoritative sources** (vendor advisory + known-exploited catalog). Record CVE, affected versions, exploit status, and IOCs.
2. **Answer "am I exposed?"** Inventory affected products/versions, prioritizing internet-facing and high-value assets. Note that exposure depends on reachability/config, not just presence of the software.
3. **Prioritize by real risk:** exploited-in-wild + internet-facing + sensitive data = top ring. Use CVSS as input, not the sole driver.
4. **Identify the response option:** vendor patch available now, vendor-provided interim mitigation, or, if neither, a compensating control (block the port/feature, WAF/IPS virtual-patch signature, disable the vulnerable component, network-isolate).
5. **Look for prior compromise BEFORE assuming patching is enough.** Hunt the published IOCs/TTPs (web-shells, new accounts, persistence, anomalous outbound). If exploited assets are found, pivot to incident response (l3-security-001 / l3-forensics-001) — patching a compromised box does not evict the attacker.
6. **Stage the emergency change package** (targets, method, rollback, validation) for approval.

## 5. Resolution Steps
> Section 5 is senior-engineer execution under an approved emergency change. Decision authority and vendor engagement points are mandatory where noted.
1. **Apply interim mitigations immediately on exposed assets** where no patch exists or patching will take time: restrict access (ACL/firewall/geo), disable the vulnerable feature, deploy WAF/IPS virtual-patch signatures, or isolate. Document each compensating control.
2. **Invoke the emergency change process** (not the normal cycle) with **security leadership/CISO approval**. Capture risk acceptance, rollback plan, and comms.
3. **Deploy the patch in rings (ring-0 → broad):** pilot on a small, representative ring to catch breakage, then accelerate to the full fleet. For critical internet-facing assets, prioritize speed over broad pilot soak — leadership owns that trade-off.
4. **Engage the vendor** for guidance/fixed builds, especially appliances and anything where the mitigation or upgrade path is non-obvious; follow vendor severity-1 channels.
5. **If compromise is confirmed**, stop treating this as patching and follow the **incident-response runbook (l3-security-001)** and forensic preservation (l3-forensics-001) — contain, preserve evidence, then eradicate and recover. Do not wipe assets you may need as evidence.
6. **Track unpatched/EOL stragglers** with continued compensating controls and a remediation/replacement plan; nothing exposed should be left both unpatched and unmitigated.

## 6. Verification Steps
- Every affected, in-scope asset is patched to the fixed version or covered by a documented compensating control — with no exposed gaps.
- Authenticated vulnerability scans / vendor checks confirm the fix on a representative sample (and re-scan after reboots).
- IOC hunt completed across the relevant estate with results recorded; no signs of active exploitation remain (or IR is running if there were).
- Mitigations that were temporary are removed only after the real patch is verified.
- Asset inventory reconciled so no affected instance was missed (including shadow/unmanaged assets).
- Emergency change documented with approvals, timeline, and lessons-learned captured.

## 7. Escalation Trigger
Escalate to security leadership/CISO and engage the vendor the moment an actively-exploited zero-day plausibly affects exposed assets — and invoke the incident-response process (l3-security-001) immediately if any indicator of actual compromise is found. Emergency changes that risk production downtime require explicit risk-acceptance from leadership; ARIA coordinates and documents but does not approve or self-execute these.

## 8. Prevention Tips
- Maintain a complete, continuously updated asset inventory (you can only protect what you can see) including internet-facing exposure mapping.
- Subscribe to vendor advisories and known-exploited catalogs; wire alerting into the triage process.
- Pre-define and rehearse the emergency/out-of-band change process and approval chain, so it's fast under pressure.
- Reduce attack surface continuously: minimize internet-facing services, retire EOL software, enforce least functionality.
- Keep EDR/IDS/WAF in place so virtual-patching and IOC hunting are possible when no patch exists.
- Adopt ring-based patch rings and tested rollback so emergency deploys are low-drama.
- Run periodic tabletop exercises for "actively-exploited zero-day in a core product."

## 9. User-Friendly Explanation
A "zero-day" is a security hole that attackers are using right now, sometimes before the vendor even has a fix. The danger isn't just having the affected software — it's whether attackers can reach it (like internet-facing systems). Our job is to find every place we run it, decide what's most at risk, and either patch immediately or put up a temporary barrier (block access or turn off the risky feature) until a patch exists. We also check whether anyone already broke in — because patching a system that's already compromised doesn't remove the intruder. Some steps mean brief downtime; leadership weighs that against the risk of waiting.

## 10. Internal Technician Notes
- Exposure > presence. Prioritize internet-facing and high-value first; CVSS is input, "exploited in the wild + reachable" is the real driver.
- Always hunt IOCs before declaring victory — patching a box that's already owned just locks the attacker in with you. Found compromise = pivot to l3-security-001 / l3-forensics-001, don't wipe.
- When there's no patch, compensating controls (block port/feature, virtual-patch, isolate) buy time and are legitimate first responses.
- Use the *emergency* change process with leadership risk-acceptance — don't shoehorn this into the normal cycle, and don't skip rollback planning.
- ARIA documents and coordinates; humans approve and decide on downtime. Keep a contemporaneous record (it may become IR-relevant).
- Don't forget EOL/shadow assets — they're the common "missed" instance that stays exploited.

## 11. Related KB Articles
- l3-security-001 — Incident response runbook (pivot here if exploited)
- l3-forensics-001 — Evidence preservation if a host is compromised
- l3-endpoint-001 — EDR strategy enabling IOC hunting / containment
- l3-network-ddos-001 — Parallel network-layer attack response patterns

## 12. Keywords / Search Tags
zero day, actively exploited, cisa kev, cvss, emergency patch, compensating control, virtual patching, ring deployment, ioc hunting, exploited in the wild, emergency change, out of band update
