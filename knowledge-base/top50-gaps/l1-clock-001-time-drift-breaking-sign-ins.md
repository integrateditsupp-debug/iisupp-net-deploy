---
id: l1-clock-001
title: "Clock is wrong — breaking sign-ins, certs, and meeting times"
category: system
support_level: L1
severity: high
estimated_time_minutes: 4
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS", "iOS", "Android"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
keywords:
  - clock wrong
  - time off
  - cert error
  - your connection is not private
  - sign-in failed time skew
  - kerberos clock skew
  - cant sign in microsoft
  - calendar showing wrong time
  - time sync failed
tags:
  - system
  - time
  - authentication
  - top-50
related: [l1-browser-003-saml-sso-redirect-loop, l1-m365-001-cant-sign-in]
---

# Clock drift breaking sign-ins

### "Your connection is not private" — NET::ERR_CERT_DATE_INVALID

Your clock is more than 5 minutes off real time. SSL certs are date-bound; browser thinks they're expired or future-dated. Open Settings → fix clock first, then retry the site. Don't click "Proceed anyway" — fixing the time fixes every site at once.

### Windows clock keeps drifting — re-sync to time.windows.com

Settings → Time & language → Date & time → "Set time automatically" should be ON. Click "Sync now" under "Additional settings" — pulls fresh time from Microsoft's servers. If sync fails, switch source: same page → click the time server dropdown → try `pool.ntp.org` or `time.nist.gov`. Apply, sync again.

### Mac clock drift

System Settings → General → Date & Time → "Set time and date automatically" ON. Source defaults to `time.apple.com`. If sync silently fails, run `sudo sntp -sS time.apple.com` in Terminal — forces a sync with output you can read. Restart if clock still wrong after.

### Sign-in failures right after I left a different time zone

Time zone is correct but the clock's offset got stuck. Restart the machine — usually fixes it. Or toggle time zone Settings → Date & time → set time zone manually wrong → back to correct → resync.

### iPhone / Android — calendar showing wrong meeting times

Time zone of your phone is wrong. iOS: Settings → General → Date & Time → set automatic. Android: Settings → System → Date & time → automatic. If you fly often: keep "Automatic time zone" ON; iOS uses GPS + cellular to detect zone changes.

### Domain-joined PC — Kerberos clock skew error

Domain controllers enforce strict clock sync (5 min max). If you see "Kerberos clock skew" or "time difference too great" in logs, your machine isn't syncing with the domain. Admin cmd: `w32tm /resync /force`. If still skewed, `w32tm /config /update /manualpeerlist:dc01.company.local /syncfromflags:manual` (replace with your DC). Then resync.

### Battery-pulled-laptop clock reset to 2009 or 2001

Motherboard CMOS battery is dying. Time resets on every boot. Replace CMOS battery (CR2032 coin cell, $3, takes 5 min if you can open the laptop OR a tech does it). Until replaced: enable "Set time automatically" — clock will be wrong at boot but corrects within seconds online.

### When to escalate to L2

Time sync fails on every server (network blocking NTP port 123 outbound). Multiple PCs in office show wrong time → upstream NTP server problem, L2 checks. Domain-joined PC shows persistent Kerberos skew despite manual resync → AD time hierarchy is broken, L2/AD admin fixes from the top down.
