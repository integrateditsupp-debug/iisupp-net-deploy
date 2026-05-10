# ARIA KB — Escalation Matrix

When ARIA stops being self-serve and a human takes over.

---

## Escalation tiers

| Tier | Who | Response time | Triggers |
|---|---|---|---|
| **L1 → L2** | Tier-2 engineer | 30 min business hours | Article's `escalation_trigger` met; user blocked >15 min; admin action required. |
| **L2 → L3** | Senior / architect | 2 h business hours | Architecture, multi-tenant impact, vendor case needed, new pattern. |
| **L3 → External** | Vendor / MSFT / IR firm | per contract | OS / cloud-platform side, breach, regulator timing. |
| **Any → Security** | SOC / IR | 15 min 24/7 | Phishing-with-creds-entered, ransomware, BEC, exec compromise, exfil. |
| **Any → Human handoff** | On-call human | per SLA | User explicitly requests human; ARIA confidence low; sensitive emotional context. |

---

## P-severity quick reference

- **P1 (Critical)** — production outage, data loss in progress, active attack. Page on-call immediately. Examples: ransomware encrypting, AD compromise, M365 tenant outage.
- **P2 (High)** — major function impaired, no immediate workaround. Same-business-day response. Examples: Outlook down for one user, VPN down for region.
- **P3 (Medium)** — degraded function, workaround exists. Next-business-day. Examples: slow PC, single printer down.
- **P4 (Low)** — informational / convenience. Best-effort. Examples: how-to questions, password tips.

---

## Escalation triggers from articles (compiled)

The following user states ALWAYS trigger immediate escalation, regardless of which KB article was retrieved:

### Security-critical
- User clicked phishing link AND entered credentials → l3-security-001.
- User received ransom note / files renamed `.locked` / `.crypted` → l3-security-001.
- Executive impersonation / wire fraud reported → l3-security-001.
- Mass account lockouts → l3-security-001 + l2-active-directory-001.
- Inbox rules forwarding mail externally appeared without user knowledge → l3-security-001.

### Identity / availability
- Multiple users in same tenant cannot sign in → l2-azure-ad-001 / l2-exchange-001.
- BitLocker recovery key not found in any directory → l3-disaster-recovery-001.
- Cluster node down / DR scenario → l3-server-001 / l3-disaster-recovery-001.
- AD replication failure → l3-hybrid-ad-001.
- Tenant outage → Microsoft.

### Data
- Mass file deletion suspected ransomware → l3-security-001 + l3-backup-dr-002.
- Backup restore validation failure → l3-disaster-recovery-001.
- Litigation hold / legal preservation request → L3 + Legal.

### Compliance
- Suspected data breach involving PII / PHI / PCI → L3 + Legal + Privacy.
- Regulatory deadline pressure (GDPR 72h, SEC 4-day, HIPAA, etc.) → L3 + Legal.

### User well-being signals
- User is panicking → calm tone, slower pace, offer human support.
- User is elderly + scam in progress → stop the action, engage trusted contact.
- User shows signs of being coached by a scammer ("the support agent told me to install...") → STOP, decline to assist with the action they're being instructed to do, offer to help disconnect the scammer.

---

## Communication templates

### Initial human handoff (ARIA says)
> "I want to bring in someone from our team to take this from here. They'll have full context from our conversation so you won't need to repeat anything. Connecting you now."

### Security incident escalation (ARIA says)
> "What you're describing might be a security incident. I'm bringing in our security team right now — every minute matters when an account may be compromised. Please don't close anything or sign in elsewhere until they reach you."

### Out-of-scope (ARIA says)
> "This one's outside what I can help with safely. Let me connect you with someone who specializes in this."

---

## Documentation expectations

Every escalation must capture:
- User identity (UPN / contact info).
- Article(s) consulted and conclusions reached.
- What ARIA tried / what worked / what didn't.
- Error codes, screenshots, log snippets.
- Severity (P1–P4) and rationale.
- Escalation target (named individual / team).
- Time of handoff.

This becomes the ticket attached to the human-side incident.
