# RUN 14 — CHECKPOINT (clean stop before starting)

**Date:** 2026-06-19 · **Reason:** RUN 13 landed (a ~2× run); insufficient context budget to execute RUN 14 to a *clean green* finish in the same turn. Per the loop protocol (step 4) this checkpoint stops cleanly with the repo green + committed rather than risk a half-applied dependency / partial Netlify functions / red suite.

## State at checkpoint (DONE)
- RUN 13 **complete + committed** (`7c64352`): 46/46 suites green, `node --check` clean, readiness 9.8.
- All prior commits intact (RUN 5–13), nothing pushed to live, nothing published.
- `git log` is the source of truth; working tree clean for `ARIA Sentinel/` except this checkpoint file.

## RUN 14 — NOT STARTED. Execute these in order next session (from `docs/RUN_14_UPDATE_SYSTEM_PACKET.md`):

1. **One-dep exception** — `npm install --save-dev electron-updater`. Document the exception in `RUN_14_REPORT.md`. **Guard the import** in `main.mjs` (dynamic `import()` in try/catch) so the app still boots if the dep is absent — tests never import main, so the suite stays green regardless.
2. **Main integration (§2)** — `autoUpdater.setFeedURL({provider:"generic", url:".../aria-sentinel-update-manifest?license=<key>"})`, `autoDownload=false`, 4h poll + 30s-grace startup check, IPC `update:download-and-install`, `update:available` → renderer. Add Settings → About "Disable auto-update" toggle (defaults ON).
3. **Pure cores + tests FIRST (cheap, gate-safe):**
   - `src/shared/update-manifest.mjs` — `pickVersionForLicense({versions, license})` (honor `version_pin` else latest non-disabled); `buildLatestYml(version)`. Test `update-rollback.test.mjs`.
   - `src/shared/admin-auth.mjs` — `requireAdminToken(headers, env)` → 401 on mismatch (token from `ARIA_ADMIN_TOKEN`, never hardcoded). Test `admin-publish.test.mjs`.
   - `src/shared/license-registry.mjs` — `searchLicenses(records, q)` (case-insensitive substring over key/email/first/last/company, paginated) + `registerDevice(record, device)` (idempotent, updates `last_seen`/`version`). Tests `license-search.test.mjs`, `license-register.test.mjs`.
4. **Netlify functions (PROJECT-LOCAL, do NOT push):** `aria-sentinel-update-manifest.js`, `aria-sentinel-update-publish.js`, `aria-sentinel-license-register.js`, `aria-sentinel-license-search.js` — thin wrappers over the pure cores + `@netlify/blobs` (already a root dep; verify available). Admin endpoints gated by `X-Admin-Token`.
5. **Privacy allowlist +2 paths ONLY (§3):** add to `ALLOWED_OUTBOUND_PATHS` in `src/shared/recipes.mjs` (consumed by `network-capture.mjs`): `/.netlify/functions/aria-sentinel-update-manifest` and the `/sentinel-binaries/` **prefix**. Extend `tests/network-capture.test.mjs` to assert these are allowed AND that an arbitrary other iisupp.net path is still rejected. **Do NOT change the 6-host CAPTURE_HOST_ALLOWLIST.**
6. **User update history (§4)** — About "Update history" table + "Roll back to this version" + `~/.aria-sentinel/update-history.json` + "Get latest from website" → `https://iisupp.net/downloads` (default browser).
7. **Admin Updates tab (§5)** — `admin-console/index.html` new "Updates" view (add to the 13→14 views list + nav): publish history, staged rollout 10/50/100%, disable-version toggle, per-license **search** + per-license/**bulk**/**all-machines** rollback (all-machines requires double-confirm + admin-token re-entry). Note: `ui-shell.test` asserts the admin views array — update it to include `"updates"`.
8. **Tests** target ≥52: `update-rollback`, `admin-publish`, `license-search`, `license-register` (new) + `auto-update`/`network-capture` extended. All RUN 1–13 stay green.
9. **Report + commit** — `docs/RUN_14_REPORT.md`, bump §0 + ENTERPRISE_READINESS → 9.9, commit `[sentinel] RUN 14: self-hosted auto-update + admin push + per-license rollback`, then `LOOP_COMPLETE_RUN_14.md`, STOP.

## Locked rules to carry into RUN 14
- ONE new dep (`electron-updater`) ONLY — documented. Zero others.
- Netlify functions committed LOCAL only (Ahmad reviews + ships). **No binary uploaded** to `public/sentinel-binaries/`.
- `ARIA_ADMIN_TOKEN` in env, never hardcoded. Rollback NEVER bypasses license validation.
- Allowlist extension = exactly +2 paths, with explicit test proving no other iisupp.net path passes.
- Nothing pushed to live; the runtime 6-host telemetry verifier is unchanged (only the path allowlist grows by 2).

**Gotcha reminders for the next session:** preload is `src/main/preload.cjs` (not `src/preload/...`); main window factory is `createMainWindow`; IPC channels use the `sentinel:` prefix; `git add "ARIA Sentinel"` then commit (project is tracked since RUN 5; nothing else in the parent repo should be staged); clear `.git/index.lock` if a prior git call left one.
