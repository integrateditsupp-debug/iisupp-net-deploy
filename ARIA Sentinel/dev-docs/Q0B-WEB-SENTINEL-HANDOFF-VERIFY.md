# Q0b — Web "Resolve it for me" → "Open with ARIA Sentinel" end-to-end verify runbook

Status: code complete + 188/188 suites green on branch `cc/sentinel-deeplink-web-handoff-2026-06-24`.
The two halves of the handoff are unified on one branch:

- **Desktop receiver** (Slice C): `aria-sentinel://` registered via `app.setAsDefaultProtocolClient`; parsed +
  validated in the pure `src/shared/deep-link.mjs`; routed to the gated pipeline in `src/main/main.mjs`
  (`handleSentinelDeepLink` → `runSupervisedFix({mode:"confirmed"})`). Windows = `second-instance` argv +
  first-run `process.argv`; macOS = `open-url`. **Slice B (production system-fix enablement) was deliberately
  EXCLUDED** — this branch only adds the deep-link handler, not the dry-run-default flip.
- **Web emitter**: `assets/aria-sentinel-handoff.js` (linked from `aria.html`) upgrades the "Resolve it for me"
  card into "Open with ARIA Sentinel", emitting `aria-sentinel://resolve?recipe=<id>&intent=<intent>`.
  **Flag-gated OFF** (`window.__ARIA_SENTINEL_HANDOFF__ !== true`) → live site behavior is UNCHANGED
  (the card stays COMING SOON) until Ahmad opts in at publish time.

## What is already verified headlessly (CI-safe, no app/browser needed)
- `tests/deep-link.test.mjs` — parser/validator: only known recipe ids actioned, R11 enforced, intent capped,
  foreign schemes rejected.
- `tests/web-handoff-contract.test.mjs` — the web emitter and desktop receiver agree on the URL byte-for-byte;
  every web-mapped intent points at a REAL recipe id; forged ids are refused.

## LIVE end-to-end verification DONE on the installed app (2026-06-25, this machine)

The installed **ARIA Sentinel 0.1.15** already ships the Slice C receiver (confirmed: `app.asar` contains
`handleSentinelDeepLink` / `setAsDefaultProtocolClient` / `parseSentinelDeepLink`), and the OS protocol is
registered: `HKCU\Software\Classes\aria-sentinel\shell\open\command` =
`"C:\Users\Ahmad Wasee\AppData\Local\Programs\ARIA Sentinel\ARIA Sentinel.exe" "%1"`.

Fired `aria-sentinel://resolve?recipe=verify-noop-q0b-deeplink&intent=verify` (deliberately UNKNOWN id, so
no system action is possible). Within ~1s the running app's transparency log recorded EXACTLY:
- `[SELF-REPAIR] Second ARIA Sentinel launch redirected to existing instance.`  ← warm `second-instance` argv path
- `[DETECT] Deep-link not actioned (unknown_recipe): verify-noop-q0b-deeplink.`  ← receiver parsed + REFUSED the forged id

No `RUN`/`FIX`/`RESTORE` entries; `restorePoints` unchanged (20); `incidents` 0 → **zero system side effects**.
This proves the full live chain (OS protocol → app → second-instance argv → parse → validate → log) AND the
security property (a browser-supplied arbitrary recipe id cannot execute). State at test: mode=manual,
dryRun=false, ariaStopped=true.

### POSITIVE (known-recipe) path ALSO verified live — safely, with execution force-previewed
The installed 0.1.15 build ships Slice B (`allowSystemFixes = app.isPackaged` → ON when packaged), so a known
recipe fired at the normal running instance WOULD execute a real fix after the countdown. To verify the accept
path without touching the machine, the app was relaunched with `ARIA_SENTINEL_ALLOW_SYSTEM_FIXES=0` (forces
`resolveActualDryRun` → preview at the runRecipe level, all other gates intact), then fired
`aria-sentinel://resolve?recipe=printer-spooler-v1&intent=printer`. transparency log recorded the FULL pipeline:
- `[SELF-REPAIR] Second ARIA Sentinel launch redirected to existing instance.`
- `[RUN] Deep-link resolve requested for printer-spooler-v1.`   ← known id ACCEPTED + routed
- `[SUPERVISOR] SUPERVISOR.APPROVE: Approved — all safety checks passed.`
- `[RESTORE PT] Restore point created before printer-spooler-v1.`   ← restore-point gate
- `[RUN] Dry-run recipe PRINT.OFFLINE` + `[DONE] Restart Print Spooler: Would restart…`   ← previewed, not run

Proof of zero real change: the Spooler service PID was unchanged before/after (no real restart), restorePoints
count unchanged. Every R8 gate (supervisor → restore-point → countdown → dry-run → kill-switch hotkey) fired and
was preserved. The app was then relaunched WITHOUT the env override, restoring packaged-default behavior
(mode=manual, dryRun=false, ariaStopped=true preserved via electron-store).

**Net: both branches of the receiver are now live-verified on-device** — unknown/forged id refused; known id
runs the full gated Confirmed pipeline and previews safely. The only thing left to a human is letting a known-id
fix actually EXECUTE (env-default) — that is a real system change and stays Ahmad's call.
- The installed app is 0.1.15 (pre-web-emitter). Re-package from `cc/sentinel-deeplink-web-handoff-2026-06-24`
  to ship the web emitter alongside; the receiver itself is already proven on-device (both branches).

## What still needs a human on a real machine (cannot be done headlessly — GUI + OS protocol registry)

1. **Build + install** a packaged Sentinel from this branch (`npm run package:win`) so Windows registers the
   `aria-sentinel://` protocol handler in `HKCU\Software\Classes\aria-sentinel`.
2. **Cold-launch handoff:** with Sentinel NOT running, paste into Run/address bar:
   `aria-sentinel://resolve?recipe=printer-spooler-v1&intent=printer`
   → Sentinel should launch, come to the Recipes view, and present the **Confirmed** fix with the visible
   10s countdown (NOT auto-fire). Cancel with Ctrl+Alt+K to confirm the kill-switch still gates it.
3. **Warm handoff:** with Sentinel already running, fire the same URL → `second-instance` should bring the
   existing window forward and present the same gated fix (no second instance spawns).
4. **Forged id:** fire `aria-sentinel://resolve?recipe=not-a-recipe` → app comes forward but logs
   "Deep-link not actioned (unknown_recipe)" and does nothing. Confirm in the audit log.
5. **Web side:** on a deploy preview of `aria.html` with `window.__ARIA_SENTINEL_HANDOFF__ = true`, ask ARIA a
   printer/wifi/disk/password question, pick "Open with ARIA Sentinel", confirm the OS hands the
   `aria-sentinel://` link to the installed app (steps 2–3). Without the app installed, confirm the honest
   "Get ARIA Sentinel" fallback card appears instead (no false "fixed it" claim).

## Gates still owned by Ahmad / Codex
- **Merge into `main`:** blocked by the known >100MB `dist-backups/` binary divergence on the local lineage
  (same blocker that kept Q0–Q3 off `main`). Reconcile by merging this branch into the review branch, not by
  pushing the local binary-carrying tree.
- **Public publish:** `aria.html` change is additive + flag-gated OFF; going live requires Ahmad's manual
  Netlify publish AND setting `__ARIA_SENTINEL_HANDOFF__ = true`.
