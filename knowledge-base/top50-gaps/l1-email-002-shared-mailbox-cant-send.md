---
id: l1-email-002
title: "Shared mailbox: can read but can't send / 'Send As' denied"
category: email
support_level: L1
severity: medium
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS", "Web"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["You're a delegated user on the shared mailbox", "Admin granted you Send As or Send on Behalf rights"]
keywords:
  - shared mailbox cant send
  - send as denied
  - this message could not be sent
  - send on behalf of
  - your message did not reach some or all
  - delegate sender
  - shared mailbox reply bounces
  - exchange permission error
tags:
  - email
  - shared-mailbox
  - exchange
  - top-50
related: [l1-outlook-001-not-receiving-emails, l1-outlook-002-cant-send-emails, l2-exchange-001-mail-flow]
---

# Shared mailbox can read but can't send — fix Send As permissions

## When this applies

Your team has a shared mailbox like `info@`, `support@`, `sales@`. You can open it, read mail, but when you reply or send new mail from it, you get one of:
- "Your message did not reach some or all of the intended recipients"
- "You do not have permission to send on behalf of [shared mailbox]"
- Email goes from YOUR address, not the shared address
- Outlook removes the From field silently and sends from your personal address

99% of the time this is a permissions issue, not a network or app issue.

## Step 1 — Verify you actually have Send As

Send permissions for shared mailboxes come in TWO flavors:
- **Send As** — recipient sees the email coming from `info@company.com` only (your name hidden)
- **Send on Behalf** — recipient sees "Ahmad Wasee on behalf of info@company.com"

Admin grants these in Exchange Admin Center. Ask:
> "Do I have Send As (or Send on Behalf) on info@company.com?"

If admin says no → request it. Done.

If admin says "yes, I granted it 5 minutes ago" → see Step 2 (permissions take time to propagate).

## Step 2 — Wait for propagation, then refresh

Exchange Online permissions can take **up to 60 minutes** to propagate from admin grant to your client. Most clear within 5-10 minutes.

After waiting:
1. Close Outlook completely.
2. Reopen.
3. Try sending from the shared mailbox.

Still fails? Step 3.

## Step 3 — Force Outlook to recognize the new permission

### Classic Outlook (Windows)
1. File → Account Settings → Account Settings → Email tab.
2. Confirm your work account is selected. Click **Change**.
3. Click **More Settings** → Advanced tab.
4. Make sure **Open these additional mailboxes** lists the shared mailbox. If not, click Add → enter shared mailbox email.
5. OK → Next → Finish.
6. Restart Outlook.

### New Outlook / Web Outlook
- Shared mailboxes appear automatically once permission propagates. If not, sign out + sign back in.

### macOS Outlook
- Tools → Accounts → Advanced → Delegates tab.
- Confirm the shared mailbox is listed under "People I am a delegate for."

## Step 4 — Pick the From address when composing

Even with permission, you have to TELL Outlook to send from the shared address.

### Classic Outlook (Windows)
1. New email → click the **From** dropdown above the To field.
2. If From isn't visible: Options tab → click "From" to enable.
3. Click From → Other Email Address → type or pick the shared mailbox.
4. Send.

### New Outlook + Web Outlook
1. New message → click the small dropdown next to your name in the From line.
2. Pick the shared mailbox.
3. Send.

### macOS Outlook
- Compose new → From dropdown at top.
- Pick shared mailbox.

## Step 5 — Clear stale autocomplete cache

If your previous attempts cached a "from your address" version of the message, Outlook may keep using that. Clear:

### Classic Outlook
- File → Options → Mail → Send Messages → Empty Auto-Complete List.

Then compose fresh.

## Common edge cases

### "Send works internally but external recipients say it bounced"
- DKIM/SPF/DMARC issue. The shared mailbox domain needs proper DNS records to authorize you sending on its behalf. Admin → check DKIM/SPF in Exchange Admin Center.
- Usually fixed in M365 by default; only an issue if domain was set up old-school.

### "I can send, but recipient sees MY name not the shared name"
- You have Send on Behalf, not Send As. Different permission. Ask admin to upgrade.

### "Reply removes the shared mailbox from From silently"
- Outlook bug — happens when shared mailbox is auto-mapped vs explicitly added.
- Workaround: remove auto-map (File → Account Settings → Email → Change → More Settings → Advanced → uncheck shared mailbox → re-add manually).

### "Send works in Outlook but not Outlook Web"
- Web client cache. Clear browser cookies for outlook.office.com, re-sign in.

## When to escalate

| Situation | Path |
|---|---|
| Admin granted permission but it's been 2+ hours, still fails | L2 — Exchange admin checks the grant, may need to re-apply |
| Send works internally, external bounces with SPF/DKIM error | L2 — DNS / mail-flow rules |
| "550 5.7.1" or similar transport error | L2 — Exchange transport rules |
| Need Send As for multiple users on same shared mailbox | L2 — admin batch-applies |
| Compliance / archive requirement | L2 — possibly retention policy interaction |

## Prevention

- New hires: have admin add shared mailbox permissions during onboarding, not after they ask.
- When granting: prefer "Send As" over "Send on Behalf" for customer-facing addresses (recipients see the shared address, more professional).
- Document which mailboxes each team should have access to.

## What ARIA can help with

ARIA can walk through the From-dropdown setup, verify whether Send As vs Send on Behalf is in play, draft the IT ticket if admin hasn't granted access yet, and tell you how long propagation typically takes. ARIA cannot grant Send As permissions — that's admin scope.
