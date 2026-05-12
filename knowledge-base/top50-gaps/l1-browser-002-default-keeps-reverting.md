---
id: l1-browser-002
title: "Default browser keeps reverting to Edge / Safari — make Chrome / Firefox stick"
category: browser
support_level: L1
severity: low
estimated_time_minutes: 8
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS", "iOS", "Android"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["The browser you want as default is installed"]
keywords:
  - default browser reverts
  - chrome wont stay default
  - edge keeps opening
  - safari default
  - links open in wrong browser
  - reset default browser
  - protocol handler
  - http https handler
  - microsoft 365 links opening in edge
  - outlook links open in edge
tags:
  - browser
  - default
  - top-50
related: [l1-browser-001-pages-not-loading]
---

# Default browser keeps reverting — make your choice stick

## Symptoms

- You set Chrome (or Firefox / Brave / Arc) as default, but after a reboot Edge / Safari is back.
- Links in Outlook / Teams open in Edge no matter what.
- Clicking a link from email opens Edge, not your default.
- After a Windows update, defaults reset.
- iPhone / iPad keeps opening links in Safari even though Chrome is set.

This is mostly **Microsoft and Apple defending their browsers** + sometimes a Windows update wiping settings.

## Windows 11 — make Chrome (or another browser) the real default

### The right way (Windows 11 22H2 and later)
1. **Settings → Apps → Default apps**.
2. Search for the browser you want (e.g., "Chrome").
3. Click it.
4. **Click "Set default" at the top** — this is the one-click button Microsoft added in 2022.
5. Confirm it took: scroll down, you should see "Default for these file types and link types" with `.htm`, `.html`, `http`, `https`, `.pdf` (optional), `.svg` (optional) all assigned to Chrome.

### If "Set default" doesn't fully work (older Windows 11)
Manually re-assign each file type:
1. Same Default apps screen.
2. Under each of: `http`, `https`, `.htm`, `.html` — click the current default and pick Chrome.
3. Some require an extra "Switch anyway" confirmation Windows uses to discourage you. Click it.

### Make Outlook stop opening links in Edge

This is Microsoft's most-annoying default in 2024-2026. Even if your system default is Chrome, Microsoft 365 apps "feature" opening links in Edge to "save your context."

**Classic Outlook (Windows):**
1. File → Options → Advanced.
2. Scroll to **Link handling**.
3. Change "Open hyperlinks from Outlook in" → **Default browser**.
4. OK. Restart Outlook.

**New Outlook (Windows + Mac):**
1. Settings (gear) → **General → Web browser**.
2. Pick "Default browser."
3. Restart Outlook.

**Teams Desktop:**
1. Profile → Settings → **General**.
2. Look for "Open links in" → set to **Default browser**.
3. Restart Teams.

**Microsoft 365 web apps (browser):**
1. M365 → Settings (gear) → "Search Microsoft 365" → "Search settings."
2. Under **Open links in** → "Default browser."

### Stop Windows Update from resetting defaults
Windows feature updates (annual major versions) sometimes reset defaults to Edge. Workaround:
1. After each feature update, recheck defaults.
2. **Group Policy** (Pro/Enterprise editions only): Computer Configuration → Administrative Templates → Windows Components → File Explorer → "Do not show the 'new application installed' notification" — doesn't directly stop reset but reduces nag.
3. For business: tell IT to use Intune Configuration Profile to lock browser defaults org-wide.

## macOS — make Chrome the real default

1. **System Settings → Desktop & Dock**.
2. Scroll to **Default web browser**.
3. Pick the browser you want.
4. Done — macOS respects this consistently.

### Mail.app and other Apple apps still opening Safari?
- Restart the app.
- If it persists, drag your Chrome icon out of Applications and back in once (forces macOS to re-index installed apps).

## iOS — make Chrome / Firefox / Edge default for links

iOS 14+ lets you pick a non-Safari default browser.

1. **Settings → Apps → Chrome (or Firefox / Edge / Brave / Arc)**.
2. Tap **Default Browser App**.
3. Select your choice.

If the option is missing:
- You're on iOS < 14 — update OS.
- The browser app isn't installed — install from App Store.
- After install, you need to open the app once before iOS lists it as a candidate.

**Note:** Even with Chrome set as default, some Apple-built apps (Mail, Messages quick-look, in-app web views in some apps) still open Safari. That's Apple, not your settings. No fix.

## Android — make Chrome / Firefox / Edge / Brave default

1. **Settings → Apps → Default apps → Browser app**.
2. Pick your choice.
3. Done.

Some OEM skins (Samsung One UI, Xiaomi MIUI) bury this — search settings for "default apps."

## Specific edge cases

### "My PDF links open in Edge"
PDFs are a separate handler. Settings → Apps → Default apps → search ".pdf" → assign to Chrome / Adobe Reader / preferred app.

### "After I install Brave / Arc, Windows nags about defaults"
That's the browser's first-run prompt. If you decline, you can still set it later via Default apps.

### "I'm on a corporate-managed laptop and can't change defaults"
Your IT has locked it via Intune / Group Policy. Ask IT — they may have a security reason (Edge has stricter integration with Microsoft Defender / Conditional Access). Often they'll allow Chrome if you ask.

### "Slack / Discord / Notion are opening links in Edge"
That's because each of those apps has its own setting (not Windows default). In each app: Settings → Advanced (or General) → "Open links with default browser" → On.

## When to escalate

| Situation | Path |
|---|---|
| Defaults reset every reboot | L2 — possible policy / corporate management |
| All file associations broken (not just browser) | L2 — registry corruption (Windows) |
| Browser of choice not listed in Default apps | Install the browser, open it once, then return |
| Default changes after every Windows feature update | Document and tell IT — known annoyance |
| MDM-managed device blocks change | Ask IT — they likely have a reason |

## Prevention

- After any Windows feature update, spend 60 seconds verifying defaults.
- Don't install random "default app fixers" from the internet — most are bloatware.
- Keep your browser updated. Stable channel Chrome / Firefox / Edge auto-update.
- On corporate devices, ask IT once for the official default-browser policy. Save the answer.

## What ARIA can help with

ARIA can walk you through Default apps live, identify which app is overriding (Outlook / Teams / Slack / etc.), and give the exact path to fix each one for your OS version. ARIA cannot click "Set default" for you — that's a one-click action only you can do on a locked-down setting.
