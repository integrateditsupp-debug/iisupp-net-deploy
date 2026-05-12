---
id: l1-mobile-email-001
title: "Set up work email on your phone — iPhone, Android, new device"
category: m365
support_level: L1
severity: medium
estimated_time_minutes: 10
audience: end-user
os_scope: ["iOS 15+", "Android 12+"]
tech_generation: current
year_range: "Current"
eol_status: "Current"
prerequisites: ["Work email address + password", "MFA already set up (or about to set up)"]
keywords:
  - mobile email
  - email on phone
  - outlook mobile
  - gmail mobile
  - iphone email setup
  - android email setup
  - exchange activesync
  - microsoft 365 mobile
  - work email phone
  - new phone email setup
related_articles:
  - l1-mfa-001-setup-recovery
  - l1-outlook-001-not-receiving-emails
  - l1-security-001-lost-stolen-device
escalation_trigger: "MFA succeeds but mobile mail won't sync after 3 attempts AND conditional access policy blocks unknown device → IT to register device or grant exception."
last_updated: 2026-05-12
version: 1.0
---

# Set up work email on your phone

## 1. Symptoms
- New phone, need work email on it.
- Existing email app stopped working after a phone reset.
- Switching from old phone to new.

## 2. Recommended app — Outlook mobile (best for Microsoft 365)

Microsoft Outlook mobile is the cleanest path for work email + calendar + contacts on iPhone and Android. Native iPhone Mail and Gmail apps also work but have limitations.

### Step-by-Step — Outlook mobile

#### iPhone / iPad

**Step 1 — Install.**
- App Store → search **Microsoft Outlook** → tap **GET** → **OPEN**.

**Step 2 — Add account.**
- First launch: tap **Add Account** → enter your work email address → tap **Add Account**.

**Step 3 — Sign in.**
- Microsoft sign-in screen appears.
- Enter your work password.
- *(What you should see: A Microsoft sign-in dialog, not a generic email form. If you see a generic form, your domain may not be set up for cloud sign-in — see IT.)*

**Step 4 — MFA.**
- Push notification to your authenticator app (MobilePASS+, Microsoft Authenticator, etc.) → tap **Approve**.
- OR enter the 6-digit code from your authenticator.

**Step 5 — Allow notifications + add another?**
- Permission prompt → tap **Yes** to notifications.
- "Add another account?" → **Maybe Later** if just one work account.

**Step 6 — Set up Focused Inbox + signature.**
- Settings (top-left → gear) → toggle **Focused Inbox** ON (sorts important mail).
- Settings → Signature → set your signature.

#### Android

Identical flow. Play Store → "Microsoft Outlook" → install → sign in → MFA.

## 3. Alternative — Apple Mail (iPhone) with work account

If you prefer the built-in Mail app on iPhone:

1. **Settings** → **Mail** → **Accounts** → **Add Account** → **Microsoft Exchange**.
2. Enter email + description → **Next**.
3. **Sign In** → Microsoft sign-in page → enter password → MFA.
4. Choose what to sync: Mail / Contacts / Calendars / Reminders / Notes → **Save**.

Apple Mail limitations vs Outlook mobile:
- No Focused Inbox.
- Less detail in calendar invites.
- Slightly slower sync.
- Better OS integration (Mail widget, Spotlight search).

## 4. Alternative — Gmail app (Android, Microsoft 365 account)

Gmail app supports Microsoft work accounts:

1. Gmail app → tap profile (top-right) → **Add another account** → **Exchange and Microsoft 365** (or Outlook / Hotmail / Live).
2. Enter work email → Next → Microsoft sign-in → MFA.

## 5. After setup — first 10 minutes

- **Confirm last 30 days of email** synced.
- **Check Sent folder** also synced (some setups only sync Inbox initially).
- **Open a calendar invite** to confirm it lands on your calendar.
- **Test reply** to an email — confirm it sends from your work address.

## 6. Common Issues

**"This account requires Microsoft Authenticator" but you don't have it:**
- Tap the link in the prompt → installs Authenticator → activate per company QR/code.
- Some organizations require Microsoft Authenticator specifically; you can't substitute another app.

**"Your IT department has restricted email on personal devices":**
- Likely conditional access policy. Options:
  - Enroll in Intune / Microsoft Defender for Endpoint as required (Settings → … → Get the [Company Portal] app).
  - OR use Outlook on the Web in browser instead of a native app.
  - OR ask IT to grant exception.

**Sync seems incomplete (only some old emails missing):**
- Default mobile sync only fetches recent emails. To get older:
  - Outlook mobile: Settings → tap account → **Sync All Mail** (or scroll mailbox to bottom to trigger more fetch).
  - Apple Mail: Settings → Mail → Accounts → tap account → Days of mail to sync → set "No Limit."

**Notifications not arriving:**
- iOS: Settings → Notifications → Outlook → enable Alerts, Sounds, Badges.
- Android: Settings → Apps → Outlook → Notifications → allow.
- In-app: Outlook → Settings → Notifications → toggle on.
- Don't Disturb / Focus modes can suppress — check.

## 7. Verification
- Send test email from work computer → arrives on phone within 30 seconds.
- Reply from phone → arrives at recipient + appears in your Sent on the computer.
- Calendar invite shows on phone's calendar app.

## 8. When to Call IT
- Conditional access policy that says "device must be enrolled" — needs IT to walk you through Intune enrollment, or get an exception.
- MFA prompt repeats indefinitely — token clock skew, needs IT.
- Brand new device that's never been registered — IT may need to add it to the company directory.

## 9. Prevention Tips
- **Use Outlook mobile for work; keep personal email separate.** Easier security boundary.
- **Backup your MFA tokens BEFORE switching phones.** MobilePASS+ tokens are bound to the device — moving to a new phone usually requires IT re-enrollment.
- **Don't use the same password as personal email** on work account.

## 10. User-Friendly Explanation
Download Microsoft Outlook from the app store, sign in with your work email and password, approve the MFA prompt on your authenticator. Within 60 seconds you'll have email, calendar, and contacts. If the company requires extra setup like Intune enrollment, follow the prompts — that's normal for work email on a personal phone.

## 11. Internal Technician Notes
- Outlook mobile uses Microsoft Graph + REST APIs, NOT classic ActiveSync. More efficient, better feature support.
- Apple Mail with Exchange uses Exchange ActiveSync (EAS) — fewer features, but native OS integration.
- Conditional access: typical policies require compliant device (Intune-enrolled) OR managed app (Outlook mobile with app protection policy).
- Outlook mobile supports app-level encryption + remote wipe without device-level MDM (good BYOD pattern).
- "Hybrid modern auth" needed for on-prem Exchange + cloud SSO mix.
- Disable IMAP / POP at Exchange level if all users on Outlook mobile / native — reduces attack surface.

## 12. Related KB Articles
- `l1-mfa-001` — MFA setup and recovery
- `l1-outlook-001` — Outlook not receiving emails
- `l1-security-001` — Lost / stolen device

## 13. Keywords / Search Tags
mobile email, email on phone, outlook mobile, gmail mobile, iphone email setup, android email setup, exchange activesync, microsoft 365 mobile, work email phone, new phone email setup, intune enrollment, conditional access
