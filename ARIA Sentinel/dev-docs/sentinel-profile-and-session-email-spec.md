# ARIA Sentinel — First-Run Profile + Session-End Email (build spec)
**Date:** 2026-06-26  **For:** Forge (CC)  **Why:** Ahmad — Sentinel must know who the user is so it can email the resolution/escalation + SLA at session end.

## A. First-run profile (mandatory, local)
- On first launch (or any launch where profile is missing), show a MANDATORY modal form — same fields ARIA web asks: First name, Last name, Company, Email (required + validated), Phone.
- User cannot use the app until it's filled (block the main UI behind it, like ARIA web's gate).
- Save to the ARIA Sentinel app data folder (e.g. %LOCALAPPDATA%\ARIA Sentinel\profile.json) — LOCAL ONLY, never uploaded except to deliver the end-of-session email (below).
- On EVERY launch Sentinel reads profile.json; if present, skip the form. Add an "Edit profile" option in Settings.

## B. Session-end emails (resolution / escalation + SLA)
- A "session" = from issue start (e.g. a Resolve-for-me handoff or a chat) to when the user ends it OR we/escalation ends it.
- At session end, Sentinel compiles: the issue, the steps taken (recipe actions, mostly backend), the outcome (resolved / escalated), and METRICS — start time, end time, time-to-resolve, SLA status. Plus the ARIA-tab transcript (as if the user was chatting).
- Sentinel POSTs that payload to a Netlify function (reuse/extend the existing aria-warm-handoff pattern, or new sentinel-session-report) which sends TWO emails:
  1. To the COMPANY (integrateditsupp@gmail.com) — the same data ARIA web shares (transcript + context + metrics).
  2. To the USER (the email from their local profile) — their issue, what was done/solution, and the speed/SLA metrics.
- Send ONLY at session end. If escalated, send the escalation email. Never send mid-session.

## C. Honesty + safety (Rule 14)
- Metrics must be REAL (measured timestamps), never fabricated SLA numbers.
- Emails state truthfully what was done; if escalated (not resolved), say so — never claim a fix that didn't happen.
- Profile PII stays local; only transmitted to deliver the user's own session report. No selling, no other use.
- Run the on-device fix behind the existing gates (approve + 10s countdown + System Restore point + Ctrl+Alt+K). Backend/automated as much as possible; surface a clean transcript.

## D. Acceptance
- First run blocks until profile saved; profile.json persists + is re-read each launch.
- A completed session fires both emails with REAL transcript + real SLA metrics; an escalated session fires the escalation email. Tests cover: profile gate, persistence, payload build (content-safe), email-trigger-on-end-only.
