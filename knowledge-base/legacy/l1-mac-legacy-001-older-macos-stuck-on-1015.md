---
id: l1-mac-legacy-001
title: "Older Mac stuck on macOS 10.13-10.15 — app compatibility and security"
category: macos
support_level: L1
severity: medium
estimated_time_minutes: 25
audience: end-user
os_scope: ["macOS 10.13 High Sierra", "macOS 10.14 Mojave", "macOS 10.15 Catalina"]
tech_generation: legacy
year_range: "2017-2020 (Apple security updates ended 2022)"
eol_status: "Apple last released security updates for macOS 11 Big Sur Sept 2023. macOS 10.15 Catalina and earlier no longer receive ANY security updates. Browsers and most apps have dropped support — Chrome 120+, Firefox 117+, Safari (capped at the OS version)."
prerequisites: []
keywords:
  - macos
  - mac os
  - high sierra
  - mojave
  - catalina
  - intel mac
  - macbook pro 2015
  - macbook air 2014
  - imac 2013
  - opencore legacy patcher
  - 32 bit apps
  - kernel extensions
  - notarization
related_articles:
  - l1-mac-001-kernel-panic-spinning-beach-ball
  - l1-windows-legacy-001-windows-7-still-running
  - l1-office-legacy-001
escalation_trigger: "Mac is being used for sensitive business work AND cannot be upgraded; recommend hardware replacement or OpenCore Legacy Patcher per technician judgment."
last_updated: 2026-05-11
version: 1.0
---

# Older Mac stuck on macOS 10.13-10.15 — app compatibility and security

## 1. Symptoms
- "This app cannot be installed on this version of macOS."
- Chrome / Firefox / Edge prompts that updates have stopped on this Mac.
- Banking site, video conferencing app, or business SaaS shows "browser not supported."
- Some apps that used to work now crash on launch ("32-bit app, no longer supported" after Catalina).
- Mac is from 2013-2017 and stuck on the highest macOS its hardware natively supports.

## 2. Likely Causes
1. **Apple dropped hardware support.** macOS Monterey (12) dropped 2013-2015 Macs. macOS Sonoma (14) dropped 2017 Macs. macOS Sequoia (15) dropped 2018 MacBook Air / 2017 Mac Pro.
2. **32-bit apps no longer launch** on macOS 10.15+ (anything pre-2019 from a vendor that didn't update).
3. **Browser EOL on old macOS** — Chrome capped at version 116 on macOS 10.15 (Catalina). New web standards (WebGPU, OAuth flows with Passkeys) fail.
4. **Banks / payroll providers / health platforms** have minimum browser requirements and reject older browsers.

## 3. Questions To Ask User
1. Exact Mac model and year? Apple menu → About This Mac → look for "MacBook Pro (16-inch, 2019)" etc.
2. macOS version? Apple menu → About This Mac → e.g. "macOS Catalina 10.15.7".
3. What specific app or website is failing?
4. Are you the original owner, or did you inherit this Mac?
5. Is the data on this Mac backed up to iCloud, Time Machine, or external drive?

## 4. Troubleshooting Steps
1. Check whether the Mac can be upgraded to a newer supported macOS: Apple menu → System Settings/Preferences → Software Update.
2. If "Your Mac is up to date" — that's the maximum macOS Apple offers for this hardware.
3. Check app vendor for a version compatible with the Mac's macOS — sometimes they keep a legacy version on a separate download page.
4. For browser issues: try Firefox ESR (Extended Support Release) — sometimes goes further back than Chrome.

## 5. Resolution Steps

**Path A — Upgrade to the latest supported macOS for the hardware (preferred):**
1. System Settings → Software Update → install the offered upgrade.
2. Back up first via Time Machine to an external drive.
3. Verify essential apps still work post-upgrade before retiring the old install.

**Path B — Replace the Mac (recommended for business-critical use):**
- Mac mini M4 ($599) is the cheapest path to a current Mac that will get OS support through ~2032.
- MacBook Air M3 ($999-1,299) for portability.
- All current Macs are Apple Silicon — confirm any business app has an Apple Silicon native or Rosetta-compatible build before buying.

**Path C — OpenCore Legacy Patcher (technician judgment, NOT for compliance / regulated use):**
1. Free open-source tool that patches macOS Ventura / Sonoma onto Macs Apple dropped (2009-2017 hardware).
2. Risks: kernel patches may be unstable; Apple updates may break the patch; no Apple support; some peripherals (T2 chip Macs, certain Wi-Fi cards) lose features.
3. Reasonable for personal / home use or single-purpose machines. Do NOT use for regulated data or production line.

**Path D — Browser + app workarounds (until budget allows replacement):**
1. Switch to Firefox ESR for sites that reject Chrome 116.
2. Use webmail / web-based versions of apps instead of native (Outlook web, Zoom web client, etc.).
3. Move banking / sensitive sites to a phone or a modern computer.
4. **Never enter banking credentials on an unsupported OS** — keyloggers / malware risk is real.

## 6. Verification Steps
- After Path A upgrade: System Settings → Software Update shows "macOS [N] is up to date".
- Critical apps launch and function (test the top 3 the user named).
- Browser passes a TLS check at https://www.howsmyssl.com — should report TLS 1.3.

## 7. Escalation Trigger
- Mac handles regulated data (HIPAA, PCI, GDPR) and cannot be upgraded → mandatory replacement, escalate cost/timing decision.
- OpenCore Legacy Patcher candidate but customer has no IT-savvy user on site → schedule technician install rather than self-serve.
- Apple Silicon transition: business has 5+ Macs needing simultaneous refresh → procurement + deployment plan, L2 owns.

## 8. Prevention Tips
- **Mac lifecycle:** plan for 5-7 years per Mac in business use.
- **Buy Apple Silicon now, not Intel** — Apple has fully moved to Apple Silicon; future-proofing.
- **AppleCare+** extends warranty but does not extend OS support — still pay attention to OS EOL.
- **Vendor compatibility check before Mac purchase** — confirm Apple Silicon native versions of QuickBooks, Photoshop, your specific industry apps.

## 9. User-Friendly Explanation
Your Mac is from before Apple started using their newer chips. Apple stopped giving it security updates a couple of years ago, and websites are starting to refuse to load. You've got three real choices: upgrade to a newer macOS if your Mac will take it (free, 30 minutes), replace the Mac with a current model (best for security, $600-1,300), or limp along by using different browsers for specific sites (risky for banking and work data).

## 10. Internal Technician Notes
- macOS support matrix (current as of 2026-05-11):
  - macOS 15 Sequoia: 2018+ MacBook Air, 2018+ MacBook Pro, 2019+ iMac, M1+ Mac mini, 2019 Mac Pro
  - macOS 14 Sonoma: 2018+ MacBook Air/Pro, 2019+ iMac, 2018 Mac mini, 2019 Mac Pro
  - macOS 13 Ventura: 2017+ iMac/Pro/MBP, 2018+ MacBook Air/mini, 2019 Mac Pro
- 32-bit app sunset: macOS 10.15 Catalina is last to run 32-bit apps. Big Sur (11) drops 32-bit kernel + userland fully.
- Kernel extensions (kexts) deprecated in macOS 11 Big Sur in favor of System Extensions. Many legacy security/print/storage products still use kexts and won't load on modern macOS.
- OpenCore Legacy Patcher project: https://dortania.github.io/OpenCore-Legacy-Patcher/ — reasonable code quality, active maintenance, but unsupported by Apple.
- Notarization required for apps distributed outside Mac App Store since macOS 10.15. Older versions of legacy apps may not run cleanly even after upgrade.

## 11. Related KB Articles
- `l1-mac-001` — Mac kernel panic / spinning beach ball
- `l1-windows-legacy-001` — Windows 7 still running
- `l1-office-legacy-001` — Office 2010/2013 mail

## 12. Keywords / Search Tags
macos, high sierra, mojave, catalina, big sur, monterey, ventura, sonoma, sequoia, intel mac, apple silicon, opencore legacy patcher, kernel extensions, 32-bit apps, notarization, rosetta, macbook pro 2015, macbook air 2014, imac 2013
