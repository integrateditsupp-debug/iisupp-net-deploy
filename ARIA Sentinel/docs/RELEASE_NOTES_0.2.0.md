# ARIA Sentinel 0.2.0 Release Notes

Date: 2026-10-08  
Audience: Internal pilot, founder-led enterprise demos, controlled technical review  
Line: RUN-CU / CU4 (branch `cc/run-cu-2026-10-08`)

## Status

0.2.0 is the **"tell me, ask me, then do it" release.** Until now Sentinel found problems and fixed the
vetted ones on the device it was installed on, and told nobody. This release adds the three things a small
business actually needs from an agent it is going to leave alone: a setup that captures who is responsible
and how much autonomy they are comfortable with, a way to approve a fix from an email or a phone, and a
notification that says what happened — without ever carrying device content. The on-device voice loop
becomes a real back-and-forth conversation, and a set of safety gaps found in the 2026-10-08 audit are
closed and proven by tests.

Still a no-cost, **unsigned** Windows build. Nothing in this release sends anything until the person
running setup turns a channel on, and every channel reports exactly what it did.

## What you get

- **A setup wizard that asks the right questions.** Six new steps after the original six: who you are
  (personal or business — the two identities `app-config.mjs` accepts), who uses this device, who to call when something is wrong
  (up to 12 technical contacts with roles), how much autonomy you want, who approves fixes and how long
  to wait, where reports go and how often, a maintenance window, and which channels to notify on.
  Everything is editable later under **Settings → Autonomy & contacts**. The old six steps and every
  existing setting are untouched.
- **Four autonomy levels with plain consequences.** *Observe* (find and tell, never change), *Safe-auto*
  (low-risk fixes run; medium-risk ones ask first), *Approve-first* (every fix asks), *Full-auto*
  (low-risk runs; medium-risk runs inside the maintenance window **only** after a real restore point;
  high-risk never runs on its own). A business without a technical contact is held at *Approve-first*
  and told why. The legacy Manual / Confirmed / Autonomous mode selector still works and stays in sync.
- **Approvals you can answer from anywhere.** A fix that needs a yes shows up in **Control Center →
  Approvals**, as a desktop notification, and — when email is on — as an email with signed **Approve /
  Deny** links. Links work once, expire with the request, and a link preview can never approve anything.
  The desktop checks for the answer every minute. If nobody answers in time, the request expires per the
  rule you chose (skip, or run only if it was low-risk).
- **Content-blind notifications.** Issue found, approval needed, fix completed, fix failed, and a daily
  or weekly summary. Every message carries the issue's catalog name, severity and platform — never a log
  line, file name, path, URL, document text or username. The guard that enforces this runs on the device
  *and* on the server, and it is the same code in both places.
- **An honest voice conversation.** Tap the globe (or the microphone in the ARIA tab) and talk: Sentinel
  listens on-device, answers, listens again, and stops when you say "that's all". It shows what it heard
  before it sends it. If it can fix something, it says so and waits for a spoken "yes" — which approves
  that one fix through the same gates as a click. Nothing is recognised in the cloud; no bundled model,
  no voice.
- **macOS, honestly.** Six user-level diagnostics and fixes on a Mac (disk space, memory, network
  config, flush DNS, restart Finder/Dock, login items). Anything that would need `sudo`, delete files or
  touch security settings is not in the catalog. Where no fix engine exists the app says "guided" instead
  of "fix".
- **Safety fixes from the audit, each with a test.** The kill switch is the first line of both executors;
  the control plane is re-read at launch and every 24h and the heartbeat reply can kill fixes fleet-wide;
  restore points are real (created, verified, reused for 30 minutes) or reported as unavailable, and a
  medium-risk fix waits for one; policy, overlay disable, supervisor confirm and business hours are
  enforced in the executor; the audit log seal is keyed (HMAC) and kept in its own file, a missing seal
  on a non-empty log reads as tampered, retention actually rotates and archives; a web deep link creates an
  approval instead of running; the "external AI calls" counter reflects reality; the device identifies
  itself by a hash, never its hostname; the local bridge refuses state-changing calls without a trusted
  origin, and `/run-recipe` goes through the supervised pipeline. `SENTINEL_ADMIN_TOKEN` works wherever
  `ARIA_ADMIN_TOKEN` did.
- **Compliance evidence that is measured, not asserted.** The SOC 2 / HIPAA / GDPR mapping now derives
  each control from real state: an audit log that verifies, a privacy capture that actually ran, a signed
  or unsigned build. An unsigned build reports CC8.1 as *not met*. Where nothing was measured the report
  says *not evidenced* instead of green.

## What is NOT done (read this before a demo)

- **SMS is dormant.** The server reports `sms: dormant` until Twilio credentials exist in the Netlify
  environment (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`). Dormant is shown as
  **not sent**, never as sent. This needs Ahmad's account and spend decision.
- **Email needs a sender.** `RESEND_API_KEY` + a verified `RESEND_FROM` on Netlify. Without them every
  email reports `dormant` and the desktop shows it.
- **Approval links need a signing secret.** `SENTINEL_APPROVAL_SECRET` (falls back to
  `SENTINEL_LICENSE_SECRET`). Without it the request is still stored and the email says "approve in the
  app" — no unsigned link ever ships.
- **The two new endpoints are repo-root web assets.** `aria-sentinel-notify` and `aria-sentinel-approval`
  go live only on Ahmad's Netlify publish. The desktop degrades honestly until then (remote: failed, in-app
  approvals still work).
- **The update manifest is still unsigned.** `aria-sentinel-update-manifest` carries no signature; the
  desktop verifies the download hash, not the publisher. Unchanged from 0.1.16.
- **Still an unsigned Windows build.** SmartScreen warnings remain; CC8.1 reads *not met* on purpose.
- **Restore points are Windows-only** and need an account that can create them; macOS fixes are
  user-level and carry no restore point (the app says so before running one).
- **Nothing was tested on a live Windows or macOS machine in this run.** Everything above is proven by
  the automated suites (1,087 node:test checks + the hand-registered suites, 0 failures) and static
  checks; the physical `npm run package:win`, the live Netlify publish and the on-device run remain on
  Ahmad's machine.

## Safety defaults (unchanged, restated)

- Knowledge base first ($0), then the ARIA brain only for novel questions, then the bundled local KB
  offline. Anthropic is never removed; external-AI calls are counted honestly.
- Supervisor critic, countdown, Ctrl+Alt+K kill switch, control-plane kill switch and overlay disable are
  all preserved. High-risk (red) fixes never run without a person.
- 🔒 R11: the personal `Private pics and Vids` folder is never read, listed, scanned or referenced; chat,
  voice history and session content are path-scrubbed.
- The six-host telemetry allowlist is unchanged. The service paths the app may call are now a declared,
  tested list (`SERVICE_OUTBOUND_PATHS`), and every main-process request goes through one wrapper that
  records it into the privacy verifier.

## Build / deploy note

`npm run package:win` and the OTA publish run on Ahmad's Windows machine. The customer build allow-list
still excludes admin-console, tests, fixtures, design-review, docs and `axis/`. The server pieces
(`netlify/functions/aria-sentinel-notify.js`, `netlify/functions/aria-sentinel-approval.js`,
`netlify/functions/lib/sentinel-approvals.cjs`) deploy with the repo-root Netlify site.

## Remaining blocks before paid enterprise launch

- Windows Authenticode certificate and SmartScreen reputation path (no spend yet).
- MSI/SCCM/Intune packaging and silent install switches.
- Live ServiceNow OAuth app and customer assignment group mapping.
- Encrypted local KB store.
- Rollback + restore-point matrix on real Windows pilot machines; macOS Tier-0 run on a real Mac.
- External penetration test / security assessment.
- Legal DPA/EULA/SLA package.
