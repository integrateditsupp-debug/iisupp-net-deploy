---
id: l1-browser-003
title: "SSO sign-in loops endlessly — SAML / Microsoft / Okta redirect bouncing"
category: browser
support_level: L1
severity: high
estimated_time_minutes: 6
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS", "iOS", "Android"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
keywords:
  - sso loop
  - saml redirect loop
  - sign-in bouncing
  - cant sign in to slack
  - okta login keeps redirecting
  - microsoft login loop
  - too many redirects
  - identity provider loop
  - cookies blocked sso
tags:
  - browser
  - sso
  - authentication
  - top-50
related: [l1-m365-001-cant-sign-in, l1-browser-001-pages-not-loading, l1-mfa-002-lost-authenticator-phone]
---

# SSO sign-in loop

### Browser bounces between identity provider and app forever

You click "Sign in with Microsoft / Google / Okta" and the browser cycles through login pages without ever landing on the app. Open a fresh InPrivate / Incognito window. Try the SSO sign-in there. If it works in private mode but not regular, your normal browser has stale cookies — clear cookies for the specific identity provider domain (see next bit).

### Clear cookies for login.microsoftonline.com / okta.com / accounts.google.com

Chrome: click the lock icon in address bar while on the IdP login page → Site settings → Clear data. Or Settings → Privacy & security → Cookies → "See all site data" → search for the IdP domain → trash. Repeat for the target app domain (e.g. slack.com). Sign in fresh.

### Third-party cookies blocked — most common cause in 2025+

Chrome and Edge are phasing out third-party cookies; SSO often relies on them. Settings → Privacy → Cookies → set to "Block third-party cookies in Incognito" instead of "Block all third-party cookies." Or add exceptions for login.microsoftonline.com, okta.com, login.live.com, accounts.google.com. Restart browser, retry SSO.

### Browser profile is in a bad state — try a different profile or browser

Sometimes only one Chrome profile is broken. Click profile picture top-right → switch to a different profile → try SSO there. Or open a different browser entirely (Edge, Firefox) to confirm whether the issue is profile-specific or system-wide. Profile-specific = create fresh profile, copy over what you need.

### Conflicting browser extensions

Ad blockers (uBlock Origin, AdGuard) and privacy extensions can block SSO redirects. Disable ALL extensions: chrome://extensions → toggle each off. Try SSO. If it works, re-enable one at a time to find the culprit. Whitelist the SSO domains in the offending extension.

### Clock is wrong on your device

SSO uses SAML or OAuth tokens that include timestamps. If your clock is more than 5 minutes off UTC, the identity provider rejects tokens as expired or future-dated. Check: Windows Settings → Time & language → Date & time → "Set time automatically" ON. Mac System Settings → General → Date & Time → "Set automatically" ON. Restart browser after correction.

### Different account is signed in to the IdP

Microsoft sign-in flow is sticky to whichever account last signed in to login.microsoftonline.com. If you have personal + work Microsoft accounts, the personal might be intercepting. Open login.microsoftonline.com → sign out completely → close all browser windows → reopen → try SSO again. Force-prompt: append `?prompt=login` to the SSO URL.

### When to escalate to L2

Loop persists after Incognito + cookie clear + clock check. Multiple users in your org hit the same loop today (likely IdP outage — check status of your IdP). Error code visible (AADSTS, OKTA-, GSO-) → L2 reads the IdP sign-in log. App-side SAML config broken (SP error rather than IdP) → L2/admin reconfigures.
