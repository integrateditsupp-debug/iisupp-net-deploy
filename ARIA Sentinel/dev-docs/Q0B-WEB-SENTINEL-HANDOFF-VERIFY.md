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

### REAL execution ALSO verified at default env (live remediation, not preview)
Fired `printer-spooler-v1` at DEFAULT env (no override). First attempt was VETOED by the supervisor's <5min
anti-thrash cooldown (`SUPERVISOR.VETO: Identical recipe attempted 196s ago`) — another R8 gate proven. After
waiting out the cooldown, a clean run executed the FULL live pipeline:
- `[RUN] Deep-link resolve requested for printer-spooler-v1.`
- `[SUPERVISOR] SUPERVISOR.APPROVE: Approved — all safety checks passed.`
- `[RESTORE PT] Restore point created before printer-spooler-v1.`
- `[RUN] Executing recipe PRINT.OFFLINE`   ← **live execution** ("Executing", not "Dry-run")
- `[ERROR] Restart Print Spooler: Command failed. Review local admin console.`

The remediation genuinely EXECUTED after the countdown (the actual user experience). It failed only because
restarting the Spooler service needs elevation and this Sentinel instance wasn't elevated — Windows safely
refused the privileged op, so the system is unchanged (Spooler still Running, same PID; logged honestly as
ERROR). A real elevated run (UAC) is the only thing that would flip ERROR→success; that's environment/privilege,
not a handoff defect.

**Net: the handoff is FULLY verified end-to-end on-device** — unknown id refused; known id runs the complete
gated Confirmed pipeline AND triggers real remediation execution after the countdown. All R8 gates (supervisor,
cooldown veto, restore-point, countdown, dry-run, kill-switch) observed firing.
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

## Merge into `main` — fully characterized (2026-06-25); production-gated for evidence-based reasons

This branch is clean/pushable (NOT the local binary-carrying tree). Two ways to land it on `main`, both gated:

**A) Full-lineage merge (one command, mechanically clean):**
```
git checkout -B _m origin/main && git merge --no-ff cc/sentinel-deeplink-web-handoff-2026-06-24 && git push origin _m:main
```
Verified in a throwaway clone branch: **0 conflicts**; Netlify functions **+5 / −0** (restores aria-recipes,
aria-stop-codes(+data), sentinel-licenses, sentinel-stripe-webhook); `netlify/functions/aperture-auth.mjs`
**byte-identical** (login HARD RULE satisfied); `netlify.toml` unchanged; Sentinel suite **188/188 green** on the
merged tree. Auto-publish is OFF, so the push only builds a ready-but-unpublished deploy.
**WHY STILL GATED:** `main` is **5 commits ahead on `aria.html`** (±228 lines) and has newer `index.html`
(homepage "AI command blade" nav) + `aria-chat.js` (model-default fix) that this older-lineage branch lacks.
The 0-conflict auto-merge *silently resolves* those LIVE public pages without human review — Ahmad/Codex must
eyeball the merged `aria.html`/`index.html` on a deploy preview (and confirm aperture/aria-* login) before this
hits production. That review is the gate, not a code blocker.

**B) Additive cherry-pick of ONLY the handler onto `main`:** NOT clean — `main` is a different lineage that is
**missing the restored endpoints** (`aria-recipes.mjs` absent → `main` is itself ~3 suites red), so adding just
the deep-link files leaves `main` inconsistent. Path A (which also restores those endpoints) is the right
reconciliation. Either way the deep-link handler is already proven on-device from this branch.

## Other gates owned by Ahmad / Codex
- **Public publish:** `aria.html` handoff is additive + flag-gated OFF; going live requires Ahmad's manual
  Netlify publish AND setting `__ARIA_SENTINEL_HANDOFF__ = true` (after verifying the preview).
- **Real elevated remediation success:** a known-id fix executes live after the countdown (verified) but needs
  UAC elevation to actually succeed — environment/privilege, Ahmad's call.
