---
id: t4-frontier-002
title: "\"Harvest-Now, Decrypt-Later\" Risk Playbook"
category: cryptography
support_level: L3
tech_generation: tier-4
tier4_pack: frontier-infra
severity: high
estimated_time_minutes: 75
audience: it-technician
os_scope: ["Windows 11","macOS","cross-platform"]
prerequisites: []
keywords: ["harvest now decrypt later","hndl","store now decrypt later","data shelf life","long-lived secrets","interim controls","data classification","quantum risk","encrypted capture","forward secrecy","data minimization","mosca theorem"]
related_articles: ["t4-frontier-001","t4-aigov-003","t4-aithreat-001"]
escalation_trigger: "Long-lived, high-sensitivity data is traversing channels an adversary could capture today and decrypt in the future, with no interim mitigation."
last_updated: 2026-06-24
version: 1.0
---

## 1. Symptoms
- Concern that encrypted data captured today could be decrypted later once quantum computing matures.
- A risk review asks "what data of ours is exposed to future decryption?"
- Highly sensitive data with a long confidentiality requirement traverses public networks or is stored long-term.
- A customer/regulator questionnaire references harvest-now-decrypt-later (HNDL) or store-now-decrypt-later.
- No prioritization exists for which data to protect first against the quantum horizon.

## 2. Likely Causes / Drivers
- **Capture-and-wait threat:** an adversary records encrypted traffic/data now, intending to decrypt it after quantum capability arrives.
- **Long data shelf life:** the data's required confidentiality period extends past the expected arrival of cryptographically relevant quantum computing.
- **Quantum-vulnerable key exchange** protecting the captured data (RSA/ECC) — see t4-frontier-001.
- **Excess exposure:** more sensitive data than necessary is transmitted/retained, widening the harvest surface.
- **No forward secrecy / weak transit protection** making bulk capture more valuable.

## 3. Questions To Ask User
- What categories of data must remain confidential, and for how many years (data shelf life)?
- Where does that data travel or rest — public networks, cloud, long-term archives?
- Who are the plausible adversaries with the patience/resources to harvest and wait?
- Is any of this data already exposed in transit over quantum-vulnerable key exchange?
- Could the data be minimized, shortened in retention, or kept off exposed channels?

## 4. Assessment Steps
1. **Apply the shelf-life test (Mosca-style logic, as a reference):** if (data secrecy lifetime) + (time to migrate) exceeds (time until quantum threat), the data is at risk now.
2. **Classify and locate** long-lived, high-sensitivity data: IP, legal, health, financial, credentials/keys, government, anything with a multi-year secrecy need.
3. **Map exposure:** which of that data crosses public/untrusted channels or sits in long-term storage an adversary could exfiltrate.
4. **Check transit protection:** is forward secrecy in use; is the key exchange quantum-vulnerable.
5. **Prioritize** the intersection of long lifetime + high sensitivity + current exposure as the top of the queue feeding t4-frontier-001's migration.

## 5. Resolution / Mitigation Steps
1. **Reduce exposure now (interim controls):** minimize what sensitive data is transmitted/retained, shorten retention, and keep the most sensitive data off exposed channels where possible.
2. **Strengthen transit today:** ensure forward secrecy and strong configurations so bulk harvested traffic is less useful, and adopt hybrid/PQC key exchange where vendors support it (t4-frontier-001).
3. **Add layered protection** for long-lived data at rest: strong symmetric encryption (less quantum-affected), access controls, and segregation of the most sensitive archives.
4. **Prioritize the PQC migration** for the highest-risk data first, driven by the shelf-life analysis.
5. **Tighten key management:** rotate, protect, and limit lifetime of keys that protect harvest-attractive data.
6. **Document the risk + plan** as advisory/readiness — quantify which data is at risk and the mitigation timeline; no "quantum-proof" claims.

## 6. Verification Steps
- A prioritized list of harvest-at-risk data exists (long lifetime × high sensitivity × current exposure).
- Interim controls (minimization, retention reduction, forward secrecy, strong configs) are applied to the top items.
- The highest-risk data is queued first in the PQC migration roadmap (t4-frontier-001).
- Symmetric protection and access controls are strengthened for long-lived archives.
- The risk and mitigation timeline are documented for stakeholders.

## 7. Escalation Trigger
Escalate to L3 / security architecture when long-lived, high-sensitivity data is traversing channels an adversary could capture today and decrypt in the future and no interim mitigation is feasible, or when the shelf-life analysis shows the migration window has already closed for critical data.

## 8. Prevention Tips
- Run the shelf-life test on new data flows: if it must stay secret beyond the quantum horizon, design protection now.
- Minimize and shorten retention of sensitive data — the smallest harvest surface is the cheapest control.
- Use forward secrecy and strong transit configs everywhere by default.
- Feed the prioritized at-risk list directly into the PQC migration roadmap.
- Treat as readiness/advisory; avoid absolute "future-proof" claims.

## 9. User-Friendly Explanation
Attackers can copy your encrypted data today and simply wait until future computers can crack it — that's "harvest now, decrypt later." It only matters for data that still needs to be secret years from now. So we figure out which of your data has a long secret-life, reduce how much of it is exposed, strengthen today's protection, and put that data first in line when we upgrade to quantum-safe encryption. Data that won't be sensitive in a few years isn't worth an attacker's wait.

## 10. Internal Technician Notes
- The decision tool is the shelf-life inequality (Mosca-style, cite as reference): secrecy-lifetime + migration-time vs. time-to-quantum.
- This article is the **prioritization engine** that feeds t4-frontier-001's migration sequence.
- Interim controls (minimization, retention cuts, forward secrecy, strong symmetric crypto) buy time before full PQC is available — emphasize them; they're actionable today.
- Symmetric encryption is far less quantum-affected — strong symmetric + access control is a meaningful at-rest stopgap.
- Audit trail / exfil-path awareness ties to t4-aigov-003 and t4-aithreat-001 (data leakage is the harvest vector).

## 11. Related KB Articles
- t4-frontier-001 — Post-Quantum Cryptography (PQC) / Quantum-Safe Migration
- t4-aigov-003 — AI Agent Audit Trail
- t4-aithreat-001 — Prompt Injection & RAG/Data Leakage

## 12. Keywords / Search Tags
harvest now decrypt later, HNDL, store now decrypt later, data shelf life, Mosca theorem, long-lived secrets, interim controls, data minimization, forward secrecy, quantum risk, data classification, encrypted capture
