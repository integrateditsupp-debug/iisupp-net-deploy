# ARIA Sentinel 0.2.1 Release Notes

Date: 2026-10-14  
Audience: customers (individuals and organisations), pilot IT leads, internal  
Line: `cc/sentinel-prod-2026-10-14` — the "sellable this week" release built from the three 2026-10-14 audits
(main process, renderer, server)

## Status

0.2.1 is the **"it actually does what it says" release.** 0.2.0 told you about problems and asked for approval,
but on a fresh Windows machine no fix could ever run, the trial ended after 12 hours while the screen said 30 days,
every Subscribe button opened a page that did not exist, and the first launch raised alarms about things that had
not happened. 0.2.1 fixes those, says exactly what it cannot do, and ships as an installer an organisation can
deploy. It is still an **unsigned** Windows build (see "What is NOT in this release").

## What 0.2.1 fixes

- **Live fixes run — with your consent and under UAC.** Applying fixes is a setting you turn on in Setup or in
  Settings (off by default; every fix previews until you do). A fix step that needs administrator rights asks you
  through the normal Windows UAC prompt, each time; nothing runs unattended as administrator. The "Resolve it for
  me" buttons, voice "yes", approval links and Control Center → Approve all go through the same gated pipeline on a
  fresh install (no more "Couldn't start this fix").
- **Honest results.** A fix that Windows refused is reported as *failed — needs administrator*, never as "already
  healthy". The Dashboard's fix count and the quarterly PDF count only fixes that actually ran and verified — a
  preview is a preview, and a chat answer is not a resolved incident. The SLA tab, uptime bars and health score
  show *not measured yet* until there is real data. The kill switch says "nothing to undo" when nothing was undone.
- **One 30-day trial.** The trial is 30 days and the screen says 30 days (it used to end after 12 hours). When it
  ends, the Dashboard, the ARIA knowledge chat and Settings (the buy path) stay open; monitoring and fixes need a
  plan; the Walk-Through stays if it was part of your purchase.
- **A buy path that lands somewhere real.** Every Subscribe / Upgrade control opens `iisupp.net/plans` (the old
  link was a 404); after checkout the licence key is emailed and `/downloads` tells you so, with the three steps
  (check your email → install → paste the key). Every price the app shows comes from the one pricing table the
  website uses — no more $1,500 beside $2,250.
- **A quiet first run.** No "ARIA removed from startup" alarm before startup was ever registered; last month's
  Event-Log and crash-report entries are a baseline, not fresh detections; one startup registration instead of two
  (so the Settings window no longer pops up at every logon); the tray icon is visible (it was an empty slot).
- **Quieter monitoring.** CPU and memory are sampled natively instead of launching PowerShell every five seconds;
  network checks probe your own DNS server and gateway on a slower cadence; fewer processes, less battery, fewer
  antivirus alerts.
- **Start ARIA starts again.** Stop → Start now really resumes the watchers (it used to log "monitoring" while
  nothing ran).
- **Ctrl+Alt+K stops everything — and it stays stopped.** The panic key ends every running ARIA process, cancels
  every countdown, blocks every open advise-first escalation for good, puts every pending approval on hold (an emailed
  approval link, a click or a voice "yes", and the "if nobody answers" timeout can no longer run anything), stops the
  approval poll and the watchers, and refuses every later fix, preview and browser-extension request. Quitting and
  relaunching does not undo it: only **Start ARIA** resumes (it is written to the audit log), and it asks again for
  every held approval with new links — an old link can never run a fix. One honest limit: a step that needs
  administrator rights and is already running under its UAC prompt when you press the key finishes its own command
  (Windows does not let ARIA end an elevated process); nothing after that step runs.
- **Keyboard shortcuts that do not steal AltGr.** The everyday chords are configurable and AltGr-safe for
  non-US layouts; the kill switch stays Ctrl+Alt+K.
- **Nothing leaves the device before Setup is finished**, and the licence key never travels in a URL (the update
  check sends a hash in a header).
- **Your folders, your names.** The excluded-folder rule is a configurable list shown as a count; no internal
  rule ids or anyone's folder names appear in the Compliance tab or the PDF.
- **An organisation policy file** (`%USERPROFILE%\.aria-sentinel\policy.json`: disabled recipes, business hours,
  escalation contacts) is read at launch, watched, and re-read daily — no portal needed.
- **One version everywhere.** About, the update check, the heartbeat and the evidence pack all report the
  package version (0.2.1), derived from one place.
- **A slimmer, cleaner customer build.** The installer carries only the code a customer surface can reach;
  internal business tooling that used to ship inside the package (about a third of the source tree) is excluded by
  an explicit allow-list with a test that keeps it that way.
- **An installer an organisation can deploy.** Per-user NSIS installer (`/S` silent switch) **and** a per-machine
  MSI for Intune / SCCM / GPO, with a fixed UpgradeCode for in-place upgrades. Silent install, pre-seeded licence and
  policy files are documented in `docs/distribution/INTUNE_MSI_SILENT_INSTALL.md`.
- **Signing is wired, not pretended.** The same build command signs when a signing identity is present (Azure
  Trusted Signing or a certificate) and names the file `-setup.exe`; without one it produces `-unsigned.exe` and
  says so. Every build ends with the artifact paths, SHA-256 and a signed/unsigned verdict.

## What is NOT in this release (read before you promise it)

- **Unattended administrator fixes.** Full-auto cannot apply a fix that needs administrator rights while nobody is
  at the keyboard; those steps wait for a UAC prompt. The elevated background helper is designed, not built.
- **SMS notifications.** Dormant until Twilio credentials exist on the server; shown as *not sent*, never as sent.
- **A signed installer.** 0.2.1 is unsigned: SmartScreen shows "Windows protected your PC" on first run, the
  compliance pack reports CC8.1 as *not met*, and the public download stays held until signing is done
  (`docs/SIGNING.md`). Pilot customers receive the installer by email with their key.
- **Publisher-verified updates.** The update feed is checked by SHA-512 hash, not by a publisher signature, and the
  manifest itself is unsigned. MSI installs do not self-update; push the next MSI through Intune/SCCM.
- **macOS verification.** The macOS catalog exists (user-level fixes only) but nothing in this release was run on
  a real Mac; there is no macOS installer or notarisation.
- **24/7 human support** is not part of any tier. Business tiers bundle a fixed number of on-site visits per year;
  anything beyond that is a separate, human-delivered contract.
- **A hosted admin portal.** The admin console ships inside the package and unlocks only with an admin-tier key.
- **Two knowledge feeds** (`aria-kb-bundle`, `aria-recipe-feedback`) are declared but not deployed; the app says
  "not available in this version" instead of logging an error at every launch.

## Known limits

- **Verified by automated suites and static checks, not on a live Windows or macOS machine in this run.** The
  physical `build-installer.bat`, the on-device install and the first live fix remain the owner's steps.
- The Windows DNS client service cannot be restarted by anyone on Windows 10/11; the DNS recipe flushes and
  re-registers instead.
- Restore points need an account that can create them; where Windows refuses, the fix is held in preview and the
  app says why.
- The trial starts on first launch; the licence key makes it irrelevant.
- Licence keys are issued per plan tier; per-customer keys and seat counting are server-side work still in
  progress — see the server notes for the state at your purchase date.
- The old `ARIA-Sentinel-0.1.0-unsigned.exe` (102 MB) is still tracked in the website repository and served at
  a held URL. It should leave git history going forward: `git rm --cached "public/sentinel-binaries/ARIA-Sentinel-0.1.0-unsigned.exe"`,
  commit, and host installers on a release host instead (the publish scripts no longer copy installers into the
  repo). This is the owner's call; nothing in 0.2.1 deletes it.

## Safety defaults (unchanged, restated)

- Knowledge base first ($0), then the ARIA brain only for novel questions, then the bundled local KB offline.
- Supervisor critic, 10-second countdown, Ctrl+Alt+K kill switch, control-plane kill switch and overlay disable
  are all preserved. High-risk (red) fixes never run without a person.
- Content-blind: no document text, file names, paths or usernames leave the device; the Privacy verifier shows
  every request.

## Build / deploy note

`build-installer.bat` on the owner's Windows machine: Node 22 check → `npm ci` → `npm test` (must be green) →
`npm run package:win` (allow-list check → voice model → electron-builder NSIS + MSI → verification) → SHA-256 +
signed/unsigned verdict → next step. `ota-build.bat` adds the version bump and publishes the installer to a
GitHub Release plus the update manifest. Installers are **not** committed to git.
