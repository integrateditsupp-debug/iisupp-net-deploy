---
id: l1-windows-time-001
title: "Computer clock is wrong / time out of sync — calendar, meetings, and logins affected"
category: windows
support_level: L1
severity: high
estimated_time_minutes: 10
audience: end-user
os_scope: ["Windows 10", "Windows 11"]
tech_generation: current
year_range: "Current"
eol_status: "Current. Applies to all supported Windows desktops/laptops, domain-joined or standalone."
prerequisites: []
keywords:
  - clock wrong
  - time wrong
  - clock showing wrong time
  - wrong time
  - time is off
  - clock is behind
  - clock is ahead
  - time keeps changing
  - time out of sync
  - clock out of sync
  - date is wrong
  - wrong date
  - wrong timezone
  - time zone wrong
  - calendar appointments off
  - calendar times wrong
  - meeting times wrong
  - outlook times wrong
  - teams meeting wrong time
  - sync now greyed out
  - time not syncing
  - w32time
  - windows time service
  - certificate error wrong time
  - cant sign in clock
  - kerberos time skew
related_articles:
  - l1-windows-007-update-stuck-reboot-loop
  - l1-outlook-001-not-receiving-emails
escalation_trigger: "Time will not hold after sync and drifts again within minutes (likely dead CMOS battery or Group Policy time source misconfig on a domain controller). Or domain-joined machines org-wide show wrong time — escalate to whoever manages the domain/DC, do not change a single PC."
intent: break-fix
vertical: generic
safe_recipe: "w32tm-resync"
last_updated: 2026-06-28
version: 1.0
---

# Computer clock is wrong / time out of sync

## 1. Symptoms
- The clock in the taskbar shows the wrong time or date.
- Calendar appointments, Outlook/Teams meetings, or reminders appear at the wrong time or shifted by whole hours.
- Websites throw certificate errors ("your connection is not private", "certificate not yet valid").
- You can't sign in to work resources / SSO, or get "authentication failed" — a clock more than ~5 minutes off breaks Kerberos and many logins.
- Time briefly corrects then drifts again.

## 2. Likely Causes (most common first)
1. **Time not syncing** — the Windows Time service didn't reach a time server. Fix: force a resync (safe, reversible).
2. **Wrong time zone** (most common cause of a "whole hours off" calendar) — fix: set the correct time zone.
3. **"Set time automatically" turned off** — fix: turn it back on.
4. **Daylight-saving confusion** — fix: ensure "Adjust for daylight saving automatically" is on.
5. **Dead CMOS/motherboard battery** — clock resets every shutdown (often jumps to a past year). Fix: replace the coin battery (hardware).
6. **Domain-joined PC** — it should sync from the domain controller, not the internet. If the DC's time is wrong, every PC is wrong → that's a server-side fix, not a per-PC fix.

## 3. Questions To Ask User
1. Is the **time** wrong, the **date** wrong, or both?
2. Is it off by a few minutes, or by whole hours (suggests time zone), or by years (suggests dead battery)?
3. Is this PC part of a work domain (do you sign in with a company account)?
4. Did it start after travel to another time zone?
5. Does the wrong time come back after you fix it and reboot?

## 4. Step-by-Step Self-Fix

### Step 1 — Set time zone and automatic time (fixes most cases)
- Windows: Settings → **Time & language → Date & time**.
- Turn **Set time zone automatically** ON if you travel; otherwise pick the correct **Time zone** manually.
- Turn **Set time automatically** ON.
- Make sure **Adjust for daylight saving time automatically** is ON.

### Step 2 — Click "Sync now"
- Same screen: under **Additional settings**, click **Sync now**.
- It should say "Last successful time synchronization: [just now]".
- If **Sync now** is greyed out or fails → continue to Step 3.

### Step 3 — Force a resync from an Admin terminal (SAFE, reversible)
Open **Command Prompt as Administrator** and run, in order:
```
w32tm /query /status
net start w32time
w32tm /resync /force
w32tm /query /status
```
- `net start w32time` starts the Windows Time service if it was stopped.
- `w32tm /resync /force` pulls the correct time from the configured source. **This is non-destructive and fully reversible** — it only adjusts the system clock to the correct time.
- After it runs, the clock should be correct and "Source" should show a time server (e.g. `time.windows.com`) or your domain controller.

### Step 4 — If it still won't sync (standalone PC), re-point the time source
From an Admin Command Prompt:
```
w32tm /config /manualpeerlist:"time.windows.com,0x9 time.nist.gov,0x9" /syncfromflags:manual /reliable:no /update
net stop w32time && net start w32time
w32tm /resync /force
```
This tells Windows which internet time servers to use, then restarts the service and resyncs.

### Step 5 — If the clock resets after every shutdown
- This is almost always a **dead CMOS battery** (a CR2032 coin cell on the motherboard). It's a cheap hardware swap (desktops easy; laptops vary). Until replaced, the time will keep resetting.

## 5. Verification Steps
- Taskbar clock matches your phone's time (to the minute).
- `w32tm /query /status` shows a recent "Last Successful Sync Time" and a valid "Source".
- Calendar/Outlook/Teams meeting times now look correct.
- Websites load without certificate-date errors.

## 6. When to Escalate (Self-fix limit)
- **Domain-joined / work PC where everyone is off:** do NOT change one machine — the domain controller's time is the source of truth. Escalate to whoever manages the domain.
- Time drifts again within minutes after a successful resync (battery or policy issue).
- You get "Access is denied" running the `w32tm` commands (you're not actually elevated, or policy restricts it).

## 7. Prevention Tips
- Leave **Set time automatically** and **Adjust for daylight saving** ON.
- On desktops more than ~4 years old, expect the CMOS battery to eventually die — a clock jumping to a past year is the classic sign.
- On domain networks, keep one authoritative time source (the PDC emulator) synced to a reliable external NTP source.

## 8. User-Friendly Explanation
Your computer's clock being wrong sounds small, but it quietly breaks calendars, meeting times, secure websites, and even signing in to work. The quickest fix is to open Settings → Time & language → Date & time, make sure your time zone is right and "Set time automatically" is on, then click "Sync now". If that's greyed out, an admin can run `w32tm /resync /force` — it just nudges the clock to the correct time, nothing risky. If the clock keeps resetting every time you shut down, the little battery on the motherboard is dead and needs replacing.

## 9. Internal Technician Notes
- A clock skew > 5 minutes breaks Kerberos (default tolerance) → cascading SSO/login failures that look unrelated. Always check the clock when "random" auth errors appear.
- `w32tm /query /source` shows where time is coming from. On domain members it should be the DC; "Local CMOS Clock" or "Free-running System Clock" means it isn't syncing.
- `w32tm /query /configuration` dumps the full config; `w32tm /monitor` (on a DC) shows offsets across the domain.
- Don't set `/reliable:yes` on a normal workstation — that flag is for the authoritative DC only.
- VMs can show drift if host time sync and guest NTP fight each other; pick one source.

## 10. Related KB Articles
- `l1-windows-007` — Windows Update stuck (another common L1 Windows fix)
- `l1-outlook-001` — Outlook issues (wrong clock can also surface as mail/calendar weirdness)

## 11. Keywords / Search Tags
clock wrong, time wrong, wrong time, clock out of sync, time not syncing, sync now greyed out, wrong timezone, calendar times off, meeting wrong time, w32tm, w32time, windows time service, certificate error wrong time, kerberos time skew, cmos battery clock reset, set time automatically
