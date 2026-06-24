---
id: l1-mobile-email-001
title: "Set up work email on a personal or mobile phone"
category: email
support_level: L1
severity: low
estimated_time_minutes: 12
audience: end-user
os_scope: ["iOS","Android"]
prerequisites: []
keywords: ["set up work email on my phone","work email on phone","email on my phone","add work email to phone","outlook mobile setup","exchange email phone","configure email on phone","mobile email setup","add exchange account","m365 email phone","work email iphone","work email android","outlook app email"]
related_articles: ["l1-m365-001","l1-mfa-001","l1-outlook-001"]
escalation_trigger: "Account adds but cannot connect after correct password + MFA, or enrollment/Conditional Access blocks the device from receiving mail."
last_updated: 2026-06-24
version: 1.0
---

# Set up work email on a personal or mobile phone

## 1. Symptoms
- You want your work email, calendar, and contacts on your phone.
- You have a new phone and need to add your company account.
- Mail won't add, or it adds but says it can't connect.
- You're prompted to "enroll" or "register" the device before email will work.
- You're unsure whether to use the built-in Mail app or the Outlook app.

## 2. Likely Causes
1. Account not yet added on the phone.
2. Built-in Mail app used where the company requires the Outlook app.
3. MFA not completed during sign-in.
4. Device must be registered/enrolled (Intune / mobile management) before mail is allowed.
5. Conditional Access policy blocking an unmanaged or non-compliant device.

## 3. Questions To Ask User
1. Is this an iPhone (iOS) or Android phone?
2. Is it a personal phone or a company-issued one?
3. Do you already have the Microsoft Outlook app, or the Authenticator app, installed?
4. Do you know your full work email address and password?
5. Have you been told the company requires the Outlook app or device enrollment?

## 4. Troubleshooting Steps
1. **Confirm credentials first.** Make sure you can sign in to https://office.com in the phone's browser with your work email and password — that proves the account works before app setup.
2. **Use the recommended app.** Most organizations on Microsoft 365 use the **Microsoft Outlook** app (App Store / Google Play) rather than the built-in Mail app, because it supports security policies.
3. **Install Microsoft Authenticator** if you don't have an MFA method yet — you'll likely need to approve a sign-in.
4. **Check for an enrollment prompt.** If sign-in asks to "register" the device or install a company portal, that's expected — IT requires it before mail flows.

## 5. Resolution Steps
**iPhone (iOS) — recommended (Outlook app):**
1. Install **Microsoft Outlook** from the App Store and open it.
2. Tap **Add Account**, enter your full work email, tap **Continue**.
3. Enter your password, then **approve the MFA prompt** in Authenticator or via text/call.
4. If asked, allow notifications and complete any device registration step.
5. Wait a minute for mail, calendar, and contacts to sync.

**Android — recommended (Outlook app):**
1. Install **Microsoft Outlook** from Google Play and open it.
2. Tap **Add account**, enter your work email, tap **Continue**.
3. Enter your password and **approve the MFA prompt**.
4. Complete any "register device" / Company Portal step if prompted.
5. Wait for the inbox to populate.

**If your company uses Exchange via the built-in Mail app instead:**
- iOS: Settings → Mail → Accounts → Add Account → **Microsoft Exchange** → enter email → sign in → approve MFA.
- Android: Settings → Accounts → Add account → **Exchange / Corporate** (varies by phone) → enter email → sign in.

## 6. Verification Steps
- New work email appears in the inbox and you can send a test message to yourself.
- Calendar shows your work meetings.
- A test email sent from a computer arrives on the phone within a minute or two.
- No repeated password prompts after setup.

## 7. Escalation Trigger
- Account adds but shows "cannot connect" after the correct password and approved MFA.
- A registration/enrollment or Conditional Access step blocks the device from receiving mail.
- The device is required to be compliant but won't pass the compliance check.
- → Escalate to **L2** with: phone OS and model, app used (Outlook vs native), the exact error text, and whether device enrollment was completed.

## 8. Prevention Tips
- Use the Microsoft Outlook app for the smoothest, policy-compliant experience.
- Keep the Authenticator app installed so MFA approvals are quick.
- Keep the phone's OS and the Outlook app updated.
- Don't add the same work account in multiple mail apps — it causes duplicate notifications and sync confusion.
- Set a screen lock; many email policies require one before mail will sync.

## 9. User-Friendly Explanation
"Adding work email to your phone is usually a two-minute job: install the Outlook app, type your email and password, then approve the security prompt on your phone. The reason we steer you to the Outlook app instead of your phone's built-in Mail is that it keeps work data in a protected space and follows our security rules. If your phone asks to 'register' during setup, that's normal and expected — it's just confirming the phone is allowed to receive company mail."

## 10. Internal Technician Notes
- Standard path is Outlook mobile + Modern Auth (OAuth) against Exchange Online; native ActiveSync is discouraged where App Protection Policies (MAM) are enforced.
- If MAM/Intune App Protection is on, the user may need to install/sign into the Authenticator (or Company Portal on Android) before Outlook will open the mailbox.
- Conditional Access "require approved client app" or "require compliant device" will block native Mail — direct the user to Outlook and confirm enrollment.
- For setup failures, check Entra sign-in logs for the device for CA/MFA result and the client app used.
- Autodiscover is automatic for M365; manual server settings should rarely be needed — if a user is entering server names, they're likely on the wrong (native) path.

## 11. Related KB Articles
- l1-m365-001 — Can't sign in to Microsoft 365
- l1-mfa-001 — MFA setup, lost device, and recovery
- l1-outlook-001 — Outlook not receiving emails

## 12. Keywords / Search Tags
set up work email on my phone, work email on phone, email on my phone, add work email to phone, outlook mobile setup, exchange email phone, configure email on phone, mobile email setup, add exchange account, work email iphone, work email android
