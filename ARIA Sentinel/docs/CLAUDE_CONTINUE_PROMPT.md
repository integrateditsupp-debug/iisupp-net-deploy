# Claude Continue Prompt - ARIA Sentinel UI Split

Continue ARIA Sentinel from this state:

Current 2026-07-05 Codex continuation note:

- Active work is no longer only the old UI split. Ahmad is now asking for proactive user-error prevention and system scans in ARIA Sentinel.
- First concrete issue: `.txt` files should not open in Adobe/Acrobat. The floating globe should warn: "Problem detected: text files are opening in Adobe. Shall I switch them back to Notepad?"
- Live check on Ahmad's PC: `C:\Users\Ahmad Wasee\Desktop\ARIA sentinel test.xml.txt` exists; current `.txt` default is Notepad (`AppX4ztfk9wxr86nxmzzq47px0nh0e58b8fw`); `Acrobat.exe` is only in OpenWith history.
- Codex added `src/shared/file-association-guard.mjs`, recipes, main-process read-only scan, startup/60-second interval/autonomous-mode recheck, manual scan IPC, overlay prompt, safe user-approved `Fix in Settings` remediation, and tests. Full Sentinel suite passed `227/227`; local package rebuilt at `dist/win-unpacked/ARIA Sentinel.exe`.
- Safety rule: do not silently write Windows default-app/UserChoice registry keys. Use read-only detection and an explicit user-approved Windows Settings / Notepad correction path. Do not claim true pre-commit blocking until a real shell-extension/policy hook exists.

- Repo path: `C:\Users\Ahmad Wasee\Documents\GitHub\ARIA — Real-Time AI Assistant\iisupp-net-deploy`
- Product path: `ARIA Sentinel`
- Design source of truth: `ARIA Sentinel/design_handoff_aria_sentinel/README.md`, `tokens.css`, `copy.md`, and Ahmad's latest screenshot showing Sentinel Admin + Documentation side by side.

Important correction from Ahmad:

The Windows desktop app must NOT be the full admin dashboard. The desktop app is the resident user agent/settings surface:

- floating gold globe at the top center by default
- hidden/compact unless an issue is detected
- fix card appears only when a detection exists
- close on the Settings window hides the globe
- Settings tabs only: Mode, Recipes, ServiceNow, Knowledge & policy, Privacy verifier, Hotkeys, About

The admin dashboard from the screenshot must be a separate owner-only web/admin surface:

- current local file: `ARIA Sentinel/admin-console/index.html`
- it must visually match the screenshot much more closely
- it needs the screenshot options: Overview, Release Gate, Endpoints, Policies, Recipes, KB Bundles, Stop Codes, Audit Events, Reports, Integrations, Settings, Access, System
- it should remain separate from the desktop user's Electron settings window

Files to continue from:

- Desktop Settings: `ARIA Sentinel/src/renderer/index.html`
- Desktop Settings controller: `ARIA Sentinel/src/renderer/renderer.js`
- Desktop + overlay styles: `ARIA Sentinel/src/renderer/sentinel.css`
- Floating globe overlay: `ARIA Sentinel/src/renderer/overlay.html`, `overlay.js`
- Electron lifecycle and admin opener: `ARIA Sentinel/src/main/main.mjs`, `preload.mjs`
- Local owner admin console: `ARIA Sentinel/admin-console/index.html`
- Test enforcing the split: `ARIA Sentinel/tests/ui-shell.test.mjs`
- Shared collab note already updated: `docs/COLLAB_BRIEF.md`

What to do next:

1. Improve `ARIA Sentinel/admin-console/index.html` to be pixel-faithful to Ahmad's screenshot:
   - shield logo, exact dark/gold tone, top metric bar, left nav, cards, table density, circuit breaker, incident cards, quick actions.
   - Keep it web/local-admin only.
2. Improve the desktop Settings surface so it matches the Claude handoff settings window:
   - 760-ish px window, left rail tabs, Mode selected by default, side ServiceNow and assignment mapping panels.
   - Do not add Release Gate / Endpoints / Reports / Access as desktop tabs.
3. Improve the overlay:
   - default must show only the gold globe, no cut-off card.
   - card expands only on detection.
   - close/hide behavior must remove the top icon when the user closes Settings.
4. Run:
   - `node --check` on `src/main/main.mjs`, `src/main/preload.mjs`, `src/renderer/renderer.js`, `src/renderer/overlay.js`
   - `npm test` from `ARIA Sentinel`
   - Browser visual QA against the latest screenshot at desktop width and a narrow width.
5. If packaging after fixes:
   - `npm run package:dir`
   - `npm run package:win`

Do not spend money. Do not create accounts. Do not add paid services. Any code signing, Chrome Web Store, ServiceNow OAuth, Intune/MSI, security audit, or legal/DPA work stays in the do-buy/approve-later list.

Tone for final handoff:

Be direct. Ahmad is right that the prior layout drifted. Confirm the split, list exact files changed, show test results, and explain remaining fidelity gaps honestly.
