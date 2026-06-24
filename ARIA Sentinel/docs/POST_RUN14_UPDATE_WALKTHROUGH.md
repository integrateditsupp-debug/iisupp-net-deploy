# Post-RUN-14 · Update Push & Test Walkthrough

> Use this AFTER CC finishes RUNs 13 + 14 and you've installed the fresh build. Walks you through pushing an update to your own machine end-to-end.

## Pre-flight checklist (verify before testing updates)

- [ ] RUN 13 + 14 reports exist (`docs/RUN_13_REPORT.md`, `docs/RUN_14_REPORT.md`)
- [ ] `npm test` is green
- [ ] Backup of v0.1.0 exists at `dist-backups/v0.1.0-pre-run13/ARIA-Sentinel-0.1.0-unsigned.exe`
- [ ] Git tag `v0.1.0-backup-*` exists (`git tag -l "v0.1.0-backup*"`)
- [ ] You have rebuilt + reinstalled the post-RUN-14 build on your machine
- [ ] Admin token env var `ARIA_ADMIN_TOKEN` is set on Netlify (generate a 32-char random string, store in 1Password too)

═══════════════════════════════════════════════════════════════
## A. Push an update FROM ADMIN CONSOLE (Cowork-style)
═══════════════════════════════════════════════════════════════

### Step 1 — Bump version + build a new .exe
On your machine, in the ARIA Sentinel folder:

```powershell
cd "C:\Users\Ahmad Wasee\Documents\GitHub\ARIA — Real-Time AI Assistant\iisupp-net-deploy\ARIA Sentinel"
# Edit package.json: bump version from 0.1.0 to 0.1.1
# (or just use npm)
npm version patch --no-git-tag-version
# Build new installer
npm run package:win
```

You now have `dist\ARIA-Sentinel-0.1.1-unsigned.exe`.

### Step 2 — Compute SHA-512 of the new .exe
```powershell
Get-FileHash dist\ARIA-Sentinel-0.1.1-unsigned.exe -Algorithm SHA512 | Select-Object -ExpandProperty Hash
```
Copy the hash output.

### Step 3 — Upload the .exe to iisupp.net binaries folder
This is the one manual step (per RUN 14 locked rules — CC doesn't auto-upload binaries):

Option A — drop into the iisupp-net-deploy repo:
```powershell
mkdir public\sentinel-binaries -Force
copy dist\ARIA-Sentinel-0.1.1-unsigned.exe public\sentinel-binaries\
git add public/sentinel-binaries/ARIA-Sentinel-0.1.1-unsigned.exe
git commit -m "[ops] publish Sentinel 0.1.1 binary"
git push origin main
```
Wait ~60s for Netlify deploy. Then verify: `https://iisupp.net/sentinel-binaries/ARIA-Sentinel-0.1.1-unsigned.exe` returns the file.

Option B — if Netlify can't handle 100MB files, use Cloudflare R2 or similar (free tier). Update `update-manifest.js` to point to that URL instead.

### Step 4 — Open the Admin Console
On your machine, ARIA Sentinel → Control Center → "Open admin console". Navigate to **Updates** tab.

### Step 5 — Click "Publish new version"
Fill the form:
- Version: `0.1.1`
- Binary URL: `https://iisupp.net/sentinel-binaries/ARIA-Sentinel-0.1.1-unsigned.exe`
- SHA-512: (paste from Step 2)
- Release notes: (markdown — short bullets of what changed)
- Admin token: (the value of `ARIA_ADMIN_TOKEN`)
- Rollout: 100% (or 10% if you want a canary first)

Click **Publish**. The admin console writes to `netlify-blobs.versions` store.

### Step 6 — Force your local app to check for update now
On your machine: ARIA Sentinel → About → "Check for updates" button.

(Or wait up to 4 hours for the next scheduled poll.)

### Step 7 — Install
You'll see: "Update available · 0.1.1 · [Install update] [Later]". Click **Install update**. App downloads (~100MB), shows progress, then restarts itself at 0.1.1.

### Step 8 — Verify
- Settings → About → version reads `0.1.1`
- Settings → About → Update history shows the row with installed timestamp
- Admin console → Updates → fleet panel shows your device on 0.1.1

═══════════════════════════════════════════════════════════════
## B. Update FROM WITHIN THE APP (user-side, no admin)
═══════════════════════════════════════════════════════════════

For end-users (and for you when you don't want to touch Netlify):

1. ARIA Sentinel → About tab
2. "Check for updates" button → shows what's available
3. Click "Install update" → downloads + restarts
4. Auto-check every 4h while online (silent unless update available)

That's it. The user-side flow doesn't touch Netlify directly — they pull from the update manifest you published.

═══════════════════════════════════════════════════════════════
## C. Roll back YOUR machine to v0.1.0 backup (test the rollback)
═══════════════════════════════════════════════════════════════

### Option 1 — User-side rollback (from app)
1. ARIA Sentinel → About → Update history
2. Find the row for `0.1.0`
3. Click "Roll back to this"
4. App confirms → downloads 0.1.0 from update server → restarts

⚠️ Requires that 0.1.0 binary is still served at the update manifest URL. If you only uploaded 0.1.1, the 0.1.0 manifest entry will 404. Either:
- Also upload `ARIA-Sentinel-0.1.0-unsigned.exe` (from `dist-backups/v0.1.0-pre-run13/`) to `public/sentinel-binaries/`, OR
- Use Option 2 below (manual install).

### Option 2 — Manual install of backup
1. Open `dist-backups/v0.1.0-pre-run13/ARIA-Sentinel-0.1.0-unsigned.exe`
2. Settings → Apps → uninstall current ARIA Sentinel
3. Right-click backup .exe → Run as administrator → SmartScreen "More info" → "Run anyway"
4. Installs 0.1.0 fresh

═══════════════════════════════════════════════════════════════
## D. Roll back a SPECIFIC LICENSE remotely (test the admin search)
═══════════════════════════════════════════════════════════════

(Use this once you have customers — for now, you're the only license.)

1. Admin console → Updates → Search field
2. Search by license key, your name, or company
3. Your license row appears with current version `0.1.1`
4. Click row → modal
5. Select target version `0.1.0` from dropdown
6. Click "Confirm rollback"
7. Within 4h (or after you click "Check for updates" manually), your machine downloads 0.1.0 and restarts

═══════════════════════════════════════════════════════════════
## E. Roll back ALL machines to a previous version (emergency)
═══════════════════════════════════════════════════════════════

If 0.1.1 breaks something in the wild:

1. Admin console → Updates → "Disable version 0.1.1" toggle → ON
   - Stops the rollout: any device not yet on 0.1.1 won't receive it
2. Admin console → Updates → "Roll back ALL active licenses to" → select `0.1.0`
3. Confirm dialog requires re-entering admin token (double-confirm)
4. Next-poll devices (within 4h) auto-downgrade

═══════════════════════════════════════════════════════════════
## F. Where the backup lives
═══════════════════════════════════════════════════════════════

- **Installer .exe**: `ARIA Sentinel\dist-backups\v0.1.0-pre-run13\ARIA-Sentinel-0.1.0-unsigned.exe` (102 MB)
- **Source code snapshot**: git tag `v0.1.0-backup-20260620-0017`
- **Restore source code**: `git checkout v0.1.0-backup-20260620-0017` (then `npm run package:win` to rebuild from clean source)

═══════════════════════════════════════════════════════════════
## Troubleshooting
═══════════════════════════════════════════════════════════════

**"Check for updates" shows no update available even after publishing**
- Verify `ARIA_ADMIN_TOKEN` env var is set on Netlify
- Verify the manifest endpoint returns the new version: `curl https://iisupp.net/.netlify/functions/aria-sentinel-update-manifest?license=YOUR_KEY&version=0.1.0&platform=win32&arch=x64`
- Check Settings → Privacy verifier → Live capture — confirm `/.netlify/functions/aria-sentinel-update-manifest` request is allowed

**Download stalls at X%**
- Likely Netlify gzip/timeout — split the binary into chunks via blockmap (electron-updater does this automatically; verify blockmap was published next to the .exe)

**"Update verification failed"**
- SHA-512 hash mismatch. Re-compute hash on the published .exe and update the manifest entry.

**App won't start after update**
- Use Option C-2 (manual backup install) to revert
- Check `%APPDATA%\ARIA Sentinel\logs\main.log` for errors
