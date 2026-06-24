# RUN 14 · Self-Hosted Auto-Update + Admin Push + Per-License Rollback (~5hr)

> Runs immediately after RUN 13. Adds OTA update from iisupp.net to every installed ARIA Sentinel.

## Pre-read
- `docs/RUN_13_REPORT.md` (just-shipped state, license/login wired)
- `docs/RUN_10_REPORT.md` (existing /aria-binary-update endpoint + GitHub Releases path)
- `src/shared/license.mjs` (RUN 13 rewrite, 12h trial + license key)
- `admin-console/index.html` (where the new fleet/rollback UI lives)
- `netlify/functions/` (where the update manifest server lives)
- `package.json` build config

═══════════════════════════════════════════════════════════════════════
## §1 · Self-hosted update server (Netlify, $0)
═══════════════════════════════════════════════════════════════════════

Replace the RUN 10 GitHub-Releases redirect with our own update server. Two new Netlify Functions:

### `netlify/functions/aria-sentinel-update-manifest.js`
- GET `/.netlify/functions/aria-sentinel-update-manifest?license=<KEY>&version=<CURRENT>&platform=win32&arch=x64`
- Returns electron-updater-compatible `latest.yml`:
  ```yaml
  version: 0.1.3
  files:
    - url: https://iisupp.net/sentinel-binaries/ARIA-Sentinel-0.1.3-unsigned.exe
      sha512: <hash>
      size: 102108634
  path: ARIA-Sentinel-0.1.3-unsigned.exe
  sha512: <hash>
  releaseDate: 2026-06-20T10:00:00.000Z
  releaseNotes: |
    - Fixed admin console focus
    - Added 5 new patch recipes
  ```
- Logic per license:
  - Lookup license in `netlify-blobs.licenses` store → returns `{ device_id, name, company, plan, version_pin?: string }`
  - If `version_pin` set → serve that exact version (manual rollback)
  - Else serve the **latest non-disabled** version

### `netlify/functions/aria-sentinel-update-publish.js` (admin-only)
- POST with admin token → registers a new version in `netlify-blobs.versions` store:
  ```json
  { "version": "0.1.3", "release_date": "...", "sha512": "...", "release_notes": "...", "disabled": false }
  ```
- Admin-only auth via header `X-Admin-Token` matched against `ARIA_ADMIN_TOKEN` env var.

### Binary hosting
- Build artifacts uploaded to Netlify Large Media OR a public S3/R2 bucket (cheapest = R2)
- Path: `https://iisupp.net/sentinel-binaries/ARIA-Sentinel-<version>-unsigned.exe`
- Default → store at the existing Netlify deploy folder under `public/sentinel-binaries/`

═══════════════════════════════════════════════════════════════════════
## §2 · electron-updater integration (the ONE new dep — exception requested)
═══════════════════════════════════════════════════════════════════════

**Add `electron-updater` to package.json devDependencies.** This is the only new dep — every other RUN was zero-new — but it's the industry-standard, well-audited update lib for Electron. Hand-rolling auto-update is a security minefield (signature verification, partial-write handling, rollback safety). Justification documented in `docs/RUN_14_REPORT.md`.

`src/main/main.mjs` additions:
```js
import { autoUpdater } from "electron-updater";

autoUpdater.autoDownload = false;          // user gets a confirm prompt
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.setFeedURL({
  provider: "generic",
  url: `https://iisupp.net/.netlify/functions/aria-sentinel-update-manifest?license=${getLicenseKey()}`
});

// Poll every 4 hours when online
setInterval(checkForUpdate, 4 * 3600 * 1000);
checkForUpdate();  // once at startup, after 30s grace

async function checkForUpdate() {
  try {
    const r = await autoUpdater.checkForUpdates();
    if (r?.updateInfo?.version !== app.getVersion()) {
      // Notify renderer via IPC → user sees a small "Update available · v0.1.3 · [Install] [Later]"
      mainWindow?.webContents.send("update:available", r.updateInfo);
    }
  } catch (e) { /* offline or update server unreachable — silent */ }
}

ipcMain.handle("update:download-and-install", async () => {
  await autoUpdater.downloadUpdate();
  autoUpdater.quitAndInstall(false, true);
});
```

Settings → About → "Update available" panel (renderer side):
- Shows current version vs latest
- Release notes (rendered Markdown)
- [Install update] button → triggers download + restart
- [Later] → reminds in 24h

═══════════════════════════════════════════════════════════════════════
## §3 · Privacy allowlist extension (CRITICAL)
═══════════════════════════════════════════════════════════════════════

The RUN 3 privacy verifier has a 6-host allowlist. Auto-update adds ONE host: `iisupp.net` (already there for tray help-link). But the request goes to a NEW PATH `/.netlify/functions/aria-sentinel-update-manifest` and `/sentinel-binaries/*` — must update the **path allowlist** in `src/shared/network-capture.mjs`:
```js
const ALLOWED_PATHS = [
  ...existing,
  "/.netlify/functions/aria-sentinel-update-manifest",
  "/sentinel-binaries/",  // prefix match
];
```
Update `tests/network-capture.test.mjs` to assert these are allowed + nothing else from iisupp.net is allowed without an explicit allowlist entry.

═══════════════════════════════════════════════════════════════════════
## §4 · User-side update history + manual rollback
═══════════════════════════════════════════════════════════════════════

Settings → About → new "Update history" section:
- Table of all updates this device has installed:
  | Version | Installed | Released | Notes | Action |
  |---|---|---|---|---|
  | 0.1.3 | 2026-06-20 14:22 | 2026-06-20 10:00 | Fix admin console focus | (current) |
  | 0.1.2 | 2026-06-20 09:15 | 2026-06-20 08:00 | Patch recipes +5 | [Roll back to this] |
  | 0.1.1 | 2026-06-19 22:00 | 2026-06-19 18:00 | UI polish | [Roll back to this] |
- Rollback action calls main → `autoUpdater.setFeedURL` with a versioned URL → downloads + installs that specific older binary
- After rollback: shows "Rolled back to 0.1.2 — updates paused until you choose to update again"
- Stored at `~/.aria-sentinel/update-history.json`

Also a "Get latest from website" link → opens `https://iisupp.net/downloads` in default browser (manual install fallback).

═══════════════════════════════════════════════════════════════════════
## §5 · Admin console — fleet update + rollback UI
═══════════════════════════════════════════════════════════════════════

In `admin-console/index.html`, add a new tab "Updates":

### Update history panel
- Table of all published versions with publish date, release notes, count of installed devices on each version
- "Publish new version" button → upload .exe + .sha512 + release notes → POSTs to `aria-sentinel-update-publish`

### Fleet rollout panel
- "Push to %: [10%] [50%] [100%]" — staged rollout (server limits how many licenses get the new version per hour)
- "Disable version 0.1.3" toggle → emergency stop (next-poll devices on 0.1.3 stay, devices NOT yet upgraded won't receive)

### Per-license rollback panel
- **Search bar**: search by license key · first name · last name · company name
- Backend: `aria-sentinel-license-search` function queries `netlify-blobs.licenses`
- Results table: License · Name · Company · Current version · Device(s) · Last seen
- Click a row → modal:
  - Current: `0.1.3`
  - Roll back to: `[dropdown of past versions]`
  - [Confirm rollback] → updates `licenses.<key>.version_pin = "0.1.2"` in Netlify Blobs
  - Next time that license's device polls the manifest endpoint, it gets the pinned version → auto-downgrades
- **Bulk rollback**: select multiple rows → "Roll back N devices to version X"
- **All machines** rollback: "Roll back ALL active licenses to version X" (requires double-confirm + admin token re-entry)

═══════════════════════════════════════════════════════════════════════
## §6 · License registry (extends RUN 13 license system)
═══════════════════════════════════════════════════════════════════════

When user activates a license key in RUN 13, the app POSTs registration:
- `POST https://iisupp.net/.netlify/functions/aria-sentinel-license-register`
- Body: `{ license_key, device_id, first_name?, last_name?, company?, version, os, last_seen: ISO }`
- Netlify Blobs `licenses.<license_key>` stores:
  ```json
  {
    "license_key": "...",
    "email": "user@example.com",
    "first_name": "...",
    "last_name": "...",
    "company": "...",
    "plan": "pro",
    "devices": [
      { "device_id": "...", "os": "win32-x64", "version": "0.1.3", "last_seen": "..." }
    ],
    "version_pin": null
  }
  ```
- Device pings registry every 4h to update `last_seen` + `version`

Backend function `aria-sentinel-license-search` (admin-only):
- Query params: `q=<term>` matches license_key / email / first_name / last_name / company (case-insensitive substring)
- Returns paginated results for admin console table

═══════════════════════════════════════════════════════════════════════
## §7 · Tests
═══════════════════════════════════════════════════════════════════════

- `tests/auto-update.test.mjs` extended — manifest URL includes license key · setFeedURL called correctly · update:available IPC fires
- `tests/update-rollback.test.mjs` (NEW) — manifest endpoint serves pinned version when version_pin set · user-side rollback writes update-history.json
- `tests/admin-publish.test.mjs` (NEW) — publish endpoint requires X-Admin-Token · invalid token returns 401 · valid token registers new version in blobs store
- `tests/license-search.test.mjs` (NEW) — search by license/name/company returns expected matches · pagination works · requires admin token
- `tests/license-register.test.mjs` (NEW) — register endpoint writes to blobs · idempotent on re-register (updates last_seen)
- `tests/network-capture.test.mjs` extended — new update + binary paths in allowlist; everything else still blocked
- All RUN 1-13 suites stay green

Target: ~52-55 suites green.

═══════════════════════════════════════════════════════════════════════
## §8 · Acceptance
═══════════════════════════════════════════════════════════════════════

- ✅ Bump version in package.json to 0.1.1, build .exe, upload to public/sentinel-binaries/, hit publish endpoint → all installed devices receive "Update available" notification within next 4h poll
- ✅ User clicks Install → app downloads, restarts, opens at 0.1.1
- ✅ Settings → About → Update history shows both versions, "Roll back to 0.1.0" works
- ✅ Admin console → Updates tab → publish history visible
- ✅ Admin console → Fleet rollout → "Push to 10%" only sends manifest to 10% of licenses
- ✅ Admin console → search "John" → returns matching licenses → "Roll back John's device to 0.1.0" works
- ✅ "Roll back ALL active licenses" requires double-confirm + admin token re-entry
- ✅ Privacy verifier shows update + binary paths as ALLOWED (no other iisupp.net paths get through)
- ✅ Offline app: update check fails silently (no popup spam)
- ✅ npm test ≥ 52/52 green
- ✅ ENTERPRISE_READINESS bumped to 9.9

═══════════════════════════════════════════════════════════════════════
## §9 · Locked rules
═══════════════════════════════════════════════════════════════════════

- ONE new dep: `electron-updater` — documented exception, no other deps
- Zero new Chrome permissions
- Privacy allowlist: +2 paths only (manifest endpoint + /sentinel-binaries/ prefix) — explicitly tested
- No customer-facing iisupp.net page changes WITHOUT preview-first (Rule 6) — but `/downloads` page may be new; if so, preview-then-push
- Auto-update opt-out: Settings → About → "Disable auto-update" toggle (defaults ON)
- Rollback NEVER bypasses license: a rolled-back version still validates against license server
- Admin token MUST be in env var (`ARIA_ADMIN_TOKEN`) — never hardcoded
- Write `docs/RUN_14_REPORT.md` + update §0 + ENTERPRISE_READINESS.md
- Commit `[sentinel] RUN 14: self-hosted auto-update + admin push + per-license rollback`
- DO NOT push the Netlify functions to live (commit local only; Ahmad reviews + ships when ready)
- DO NOT upload any binary to public/sentinel-binaries/ (functions ready, but actual binary upload waits for Ahmad)

═══════════════════════════════════════════════════════════════════════
## §10 · Order of execution
═══════════════════════════════════════════════════════════════════════

1. Add electron-updater to package.json + npm install — §2
2. Main process: setFeedURL + check loop + IPC handlers — §2
3. Renderer: About → Update available + history panel — §4
4. Netlify functions: manifest + publish + register + search — §1, §6
5. Allowlist extension + privacy tests — §3
6. Admin console: Updates tab + Search + Rollback UI — §5
7. Tests (write as you go, final pass ≥52/52) — §7
8. Report + commit — §9

Ship it.
