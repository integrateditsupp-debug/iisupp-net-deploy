---
id: l1-mac-003
title: "Mac Mail stopped syncing after I changed my password"
category: macos
support_level: L1
severity: medium
estimated_time_minutes: 8
audience: end-user
os_scope: ["macOS"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
keywords:
  - mac mail not syncing
  - mail wont sign in after password change
  - keychain password mail mac
  - exchange account stopped working mac
  - mac mail loop password prompt
  - mail offline after password reset
tags:
  - macos
  - mail
  - password
  - top-50
related: [l1-password-002-locked-after-change, l1-outlook-003-send-receive-errors]
---

# Mac Mail stopped syncing after password change

### Mail keeps prompting for password — Keychain has the old one

Mail.app cached your old password in Keychain. Even when you type the new password in the prompt, it doesn't save unless Keychain accepts it. Fix: Open **Keychain Access** (Spotlight: Keychain Access). Search for your email server (e.g., `outlook.office365.com` or your work domain). Delete any entries with your email. Quit Keychain Access. Restart Mail. It'll prompt fresh — type new password, check "Remember in Keychain." Should save this time.

### Mail account shows "Offline" status

System Settings → Internet Accounts → click your account → toggle Mail OFF → wait 5 sec → toggle ON. Or quit Mail entirely, reopen. If still offline, sign out of the account fully (Internet Accounts → click account → "Sign Out") and re-add it with new password.

### M365 / Exchange account — needs modern auth

Older Mac Mail uses Basic Authentication which Microsoft killed in 2022-2023. If your work email is M365 and Mail can't sign in, you need modern auth. Settings → Internet Accounts → remove the M365 account → click "Add Account" → pick **Microsoft Exchange** → enter email → sign in via the M365 browser popup (this does modern auth + MFA properly). Account re-adds with proper token.

### MFA prompt didn't appear

Some M365 tenants require explicit MFA approval per device. Sign-in flow opens a browser popup briefly — if it didn't appear, your default browser is missing or blocking popups. Set default browser to Safari or Chrome temporarily, retry account add.

### Password change happened on phone too — both prompting now

The new password isn't propagating to all devices fast enough. Wait 10 minutes after changing on the web portal (office.com). Then enter new password on Mac Mail. If it instantly locks the account → see KB l1-password-002 (the iPhone Mail or another device is still trying old password and locking the account).

### Account works but sent emails don't appear in Sent folder

After the re-add, IMAP folder mappings may be off. Mail menu → Mailbox → Use This Mailbox For → "Sent." Repeat for Drafts, Trash, Junk. Picks up correctly on next sync.

### Verify the account is genuinely working

Send a test email to your own personal address. Wait 60 seconds. Refresh inbox. Receive it? Then sync is functional, you're done. If not received, Mail isn't actually authenticated — repeat sign-out / sign-in cycle.

### When to escalate to L2

Re-add account fails with "cannot verify server identity" — TLS / cert issue → L2. M365 account works on Outlook iPhone but not Mac Mail — possibly Conditional Access blocking Mac Mail client → L2. Multiple Mac users in same org hit this after a tenant password rotation → admin reviews policy.
