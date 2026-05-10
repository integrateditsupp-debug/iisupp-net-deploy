---
id: l2-exchange-001
title: "Exchange Online: mail flow troubleshooting / NDR analysis"
category: exchange
support_level: L2
severity: high
estimated_time_minutes: 30
audience: admin
prerequisites: ["Exchange Online Admin"]
os_scope: ["Exchange Online"]
keywords:
  - mail flow
  - ndr
  - bounce
  - 5.7.x
  - message trace
  - dkim
  - spf
  - dmarc
  - connector
related_articles:
  - l1-outlook-001
  - l1-outlook-002
  - l1-email-001
escalation_trigger: "Tenant-wide mail flow outage, or domain reputation block, or DMARC enforcement failure"
last_updated: 2026-05-07
version: 1.0
---

# Exchange Online mail flow

## 1. Diagnosis
**Message trace:**
- Exchange Admin Center → Mail flow → Message trace.
- Recipient + date range → click traced message → see hop-by-hop.
- Status: Delivered, Filtered as spam, Failed, Pending, Expanded.

**For inbound from external:**
- Check anti-spam / anti-malware policies (Defender for O365).
- Check connectors (especially partner orgs with hybrid).

**For outbound to external:**
- DKIM signed: Defender → Policies → DKIM → enabled per domain.
- SPF record correct in DNS: `v=spf1 include:spf.protection.outlook.com -all`.
- DMARC published, enforcement level matches readiness.

## 2. Common NDR codes
| Code | Meaning | Fix |
|---|---|---|
| 5.0.0 | Generic delivery failure | Check trace |
| 5.1.1 | Recipient unknown | Verify address |
| 5.1.10 | Recipient unknown to org's relay | Verify alias |
| 5.2.2 | Mailbox full | Recipient quota |
| 5.4.1 | Relay denied | Connector / auth issue |
| 5.4.6 | Hop count exceeded | Loop in routing |
| 5.7.1 | Recipient blocks sender | Domain reputation / policy |
| 5.7.135 | Tenant policy block | Anti-spam / quarantine |
| 5.7.230 | Spam-detected outbound | Sender remediation |
| 5.7.708 | Service-level outbound block | Microsoft escalation |

## 3. Resolution Pathways
**5.7.135 / 5.7.708 (outbound block):**
- Check user's compromised state (cred theft → spam from account).
- Reset password, revoke sessions, scan device.
- Submit to Microsoft if false-positive; Defender → Submissions.

**Connector misconfig (hybrid):**
- Test with `Test-OutlookConnectivity` and partner connector authentication.
- Verify TLS cert on connector.

**Domain reputation:**
- Check sender reputation: Microsoft Sender Insights (smtpguru.com / Talos / Talos Reputation).
- Resolve cause, request delisting if external block lists.

## 4. Verification
- Test send to external (Gmail/Yahoo/Outlook.com) lands in inbox, not spam.
- Test send from external lands inbox.
- DKIM/SPF/DMARC pass per `Authentication-Results` header.

## 5. Escalation
- Tenant-wide block from Microsoft (5.7.708 mass).
- Domain on RBL (Spamhaus, etc.).
- Persistent reputation issues → Microsoft + L3.

## 6. Prevention
- Implement DMARC progressively: monitor → quarantine → reject.
- DKIM both selectors enabled.
- Don't send bulk from regular mailbox; use SendGrid / Postmark.
- Monitor outbound spam alerts.
- User awareness on account compromise.

## 7. Notes
- Defender for O365 quarantine: users can self-release low-confidence; admins for high-confidence.
- Hybrid connectors: cert auth preferred over IP-based.
- Mass mailers should use dedicated subdomain (`marketing.company.com`) so reputation hit doesn't affect main domain.

## 8. Related
- l1-outlook-001 — User not receiving
- l1-outlook-002 — User can't send
- l1-email-001 — Phishing reports

## 9. Keywords
mail flow, ndr, bounce, 5.7.x, message trace, dkim, spf, dmarc, connector
