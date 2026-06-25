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
