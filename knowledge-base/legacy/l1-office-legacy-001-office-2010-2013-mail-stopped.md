---
id: l1-office-legacy-001
title: "Office 2010 / 2013 Outlook stopped sending or receiving mail in 2026"
category: outlook
support_level: L1
severity: high
estimated_time_minutes: 30
audience: end-user
os_scope: ["Windows 7", "Windows 10", "Windows 11"]
tech_generation: legacy
year_range: "2010-2023 (Microsoft EOL Office 2010: 2020-10-13; Office 2013: 2023-04-11)"
eol_status: "Office 2010 EOL 2020-10-13. Office 2013 EOL 2023-04-11. Neither receives security updates or Microsoft 365 / Exchange Online connectivity guarantees."
prerequisites: []
keywords:
  - office 2010
  - office 2013
  - outlook 2010
  - outlook 2013
  - basic auth deprecation
  - exchange online
  - imap
  - smtp
  - modern auth
  - oauth
  - tls 1.0
  - tls 1.1
  - cipher suite
related_articles:
  - l1-outlook-001-not-receiving-emails
  - l1-outlook-002-cant-send-emails
  - l1-windows-legacy-001-windows-7-still-running
escalation_trigger: "Customer is dependent on Office 2010/2013 with no upgrade budget AND needs to keep using Microsoft 365 / Exchange Online; engineering needs to design a relay or migration path."
last_updated: 2026-05-11
version: 1.0
---

# Office 2010 / 2013 Outlook stopped sending or receiving mail in 2026

## 1. Symptoms
Outlook 2010 or Outlook 2013 suddenly stopped sending or receiving mail. Repeated password prompts. "0x800CCC0E" or "0x800CCC0F" errors. "Cannot connect to server" messages. Worked fine last week. Customer says "nothing changed."

## 2. Likely Causes
1. **Microsoft turned off Basic Authentication for Exchange Online** (rolled out in waves 2022-2023, fully off for nearly all tenants by end of 2023). Outlook 2010 + 2013 cannot do Modern Auth / OAuth 2.0 to M365.
2. **TLS 1.0 / 1.1 deprecated** at the mail provider. Many SMTP / IMAP providers (Microsoft, Gmail, Yahoo) require TLS 1.2 or 1.3. Outlook 2010 ships with TLS 1.0 only by default.
3. **Cipher suite mismatch** — old Outlook can't negotiate modern ciphers (especially after Windows 7 endpoint).
4. **Account credentials changed** at the provider (MFA enrolled, password rotation).

## 3. Questions To Ask User
1. What exact version of Office? (Outlook → File → Office Account → About Outlook → look for "Microsoft® Outlook® 2010" or "2013".)
2. What email provider? (Microsoft 365 / Exchange Online, Gmail, Yahoo, GoDaddy, custom domain?)
3. When did it last work?
4. Did you recently enable two-factor / two-step / MFA on this email?
5. Is this Outlook the only mail app, or do you also have it on a phone that's working?

## 4. Troubleshooting Steps
1. Confirm version: File → Office Account → About Outlook.
2. Try webmail (outlook.com, gmail.com, etc.) — confirm credentials still work and mail is arriving there. If yes, the problem is the Outlook client, not the account.
3. Check Windows TLS settings: open Internet Options → Advanced tab → scroll to Security section → confirm "Use TLS 1.2" is checked. If missing, this is Windows 7 / Win 8 — see Internal Notes.

## 5. Resolution Steps

**Path A — Replace Outlook 2010/2013 with a supported client (preferred and almost always required):**
1. **Best:** install Microsoft 365 Apps (subscription) or buy Office 2021 / 2024 perpetual license. New Outlook supports Modern Auth out of the box.
2. **Free fallbacks:** Outlook on the Web (https://outlook.office.com), or eM Client free tier (supports OAuth to M365 / Gmail).
3. Re-import old PST: in new Outlook, File → Open & Export → Import/Export → Import from another program → Outlook Data File (.pst) → point to old PST.
4. Set up the account fresh using auto-discovery (just enter email + password, modern client handles OAuth redirect).

**Path B — Use IMAP / SMTP via an app password (works only on Gmail-style providers, NOT M365):**
1. Sign in to the email provider's web UI.
2. Enable 2FA on the account.
3. Generate an "app password" (Google: Security → App passwords; Yahoo: Account Security → Generate app password).
4. In Outlook 2010/2013: Account Settings → Change → use IMAP server settings with the app password.
5. **Note:** Microsoft 365 / Exchange Online does NOT issue app passwords for Outlook 2010/2013 — Path A is required.

**Path C — On-prem mail relay (for businesses that genuinely can't upgrade):**
1. Stand up a small SMTP relay (hMailServer, Postfix, or Exchange 2019 in mailbox-less hybrid mode) on a modern Windows Server.
2. Configure the legacy Outlook to send through the relay over plain SMTP / no TLS or TLS 1.0.
3. Relay authenticates to M365 with Modern Auth on the outbound leg.
4. Inbound: configure transport rules to forward to a shared mailbox the legacy client reads via POP3 over the relay.
5. This is non-trivial L2/L3 work — escalate.

## 6. Verification Steps
- New Outlook receives mail within 60 seconds of webmail receiving it.
- Send a test email out, confirm it arrives at an external address (e.g., gmail).
- No more password prompts within first hour.

## 7. Escalation Trigger
- Customer refuses Path A and is on Microsoft 365 → only Path C works → escalate to L2/L3 to design the relay.
- Customer has 10+ users on Office 2010/2013 → migration project, not a ticket.
- PST files larger than 50 GB → split + import requires staged plan.

## 8. Prevention Tips
- Treat any office suite older than 5 years as "scheduled for replacement, not for ongoing support."
- Microsoft 365 Apps subscription auto-updates, so this scenario never repeats once migrated.
- Keep PST backups outside the user's profile (OneDrive or external) — easy import to new client when needed.

## 9. User-Friendly Explanation
Your Outlook is from 2010 or 2013. Microsoft and email providers turned off the older way of signing in last year, and the old Outlook can't talk to the new system. The fix is to install a current version of Outlook — your emails, contacts, and calendar will all come with you. We can do it now and you'll be sending mail again within 20 minutes.

## 10. Internal Technician Notes
- Win 7 TLS 1.2 registry enablement: `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Internet Settings\WinHttp` → DWORD `DefaultSecureProtocols` = `0x0A00` (TLS 1.1 + 1.2). Reboot.
- Win 7 + Office 2010 also needs KB3140245 + the SchUseStrongCrypto registry keys for .NET to honor TLS 1.2.
- Microsoft basic auth disablement reference: Microsoft Tech Community announcement Oct 2022, fully enforced by 2023. Tenants can no longer re-enable via support ticket.
- Exchange Online connection state: PowerShell `Get-AuthServer` and `Test-OAuthConnectivity` from Exchange Management Shell.
- Customers on legacy on-prem Exchange 2010/2013/2016 hit the same wall once they migrate to M365 hybrid.

## 11. Related KB Articles
- `l1-outlook-001` — Outlook not receiving emails
- `l1-outlook-002` — Outlook can't send emails
- `l1-windows-legacy-001` — Windows 7 still running

## 12. Keywords / Search Tags
office 2010, office 2013, outlook 2010, outlook 2013, basic auth, modern auth, oauth, exchange online, tls 1.2, 0x800ccc0e, 0x800ccc0f, app password, imap, smtp, eol, legacy office
