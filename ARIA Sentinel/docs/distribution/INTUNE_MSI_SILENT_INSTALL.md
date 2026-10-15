# Deploying ARIA Sentinel to an organisation (Intune / SCCM / GPO / scripted)

For IT administrators. Applies to ARIA Sentinel **0.2.1** on Windows 10 1809+ / Windows 11, x64.

Read first — the honest state of this release:

- The build is **unsigned** until the owner completes `docs/SIGNING.md`. An unsigned installer trips SmartScreen on
  interactive installs and may be blocked by AppLocker/WDAC publisher rules. Silent installs through Intune/SCCM run
  in the system context and are not stopped by SmartScreen, but your security tooling may still flag an unsigned
  binary — allow-list by hash (the SHA-256 is printed by the build and stored in `dist/RELEASE-<version>.json`).
- Live fixes are **off by default** and are a per-user consent. Fixes that need administrator rights ask the user
  through a UAC prompt each time; nothing runs unattended as administrator in this version.
- There is no SMS channel, no unattended elevated runner and no hosted admin portal in this version.

## The two installers one build produces

| File | Type | Scope | Use it for |
|---|---|---|---|
| `ARIA-Sentinel-<v>-setup.exe` (signed) or `ARIA-Sentinel-<v>-unsigned.exe` | NSIS, assisted (`oneClick: false`) | **per-user** (`%LOCALAPPDATA%\Programs\ARIA Sentinel`), no admin needed | individuals, small teams, self-service; the only type the in-app updater can update |
| `ARIA-Sentinel-<v>-setup.msi` / `-unsigned.msi` | Windows Installer (WiX) | **per-machine** (`Program Files\ARIA Sentinel`), system context | Intune LOB/Win32, SCCM/MECM, GPO software installation |

Both are produced by `npm run package:win` (`build-installer.bat`). The name carries the signing state — a file
called `-setup` was signed at build time and verified; `-unsigned` was not. Never rename one to the other.

## Silent install — NSIS `.exe`

```bat
ARIA-Sentinel-0.2.1-setup.exe /S
ARIA-Sentinel-0.2.1-setup.exe /S /D=C:\Apps\ARIA Sentinel      :: /D must be the LAST argument, unquoted
ARIA-Sentinel-0.2.1-setup.exe /S /allusers                     :: per-machine from the assisted installer (needs admin)
ARIA-Sentinel-0.2.1-setup.exe /S /currentuser                  :: explicit per-user (the default)
```

Silent uninstall (per-user install):

```bat
"%LOCALAPPDATA%\Programs\ARIA Sentinel\Uninstall ARIA Sentinel.exe" /S
```

Exit code 0 = success. The installer creates a Start Menu and a desktop shortcut and, when run interactively,
launches the app at the end (`runAfterFinish`); with `/S` nothing is launched.

## Silent install — MSI (Intune / SCCM / GPO)

```bat
msiexec /i "ARIA-Sentinel-0.2.1-setup.msi" /qn /norestart /l*v "%TEMP%\aria-sentinel-install.log"
msiexec /x "ARIA-Sentinel-0.2.1-setup.msi" /qn /norestart
```

- `UpgradeCode` is fixed (`6404D180-7EB3-40BF-B230-A85EE5F32EBE`), so installing a newer MSI over an older one is an
  in-place upgrade (major upgrade; no manual uninstall). The `ProductCode` changes per version — read it from the
  MSI (Intune fills it automatically when you upload the MSI as a Line-of-business app).
- Per-machine install location: `%ProgramFiles%\ARIA Sentinel` (verify in the `/l*v` log: `INSTALLDIR`).
- The MSI does **not** launch the app after install (`runAfterFinish: false`). The app registers itself to start at
  logon the first time each user runs it (HKCU Run key) — push a Start Menu launch or let users open it once.

### MSI limits you must plan around (honest)

1. **No in-app auto-update for MSI installs.** The in-app updater (electron-updater) only updates NSIS installs.
   Fleet upgrades = push the new MSI from Intune/SCCM (the fixed `UpgradeCode` makes it an in-place upgrade).
2. **Per-machine binary, per-user state.** Settings, consent, licence, audit log and policy live in each user's
   `%USERPROFILE%\.aria-sentinel\`. A shared PC = one Sentinel state per Windows user.
3. **Interactive runs of the MSI show a UI** (`oneClick: false`); always use `/qn` for deployment.
4. **Building the MSI needs WiX on the build PC** — electron-builder downloads WiX 3 automatically the first time
   (internet required). If that download is blocked, `npm run package:win:nsis` builds the NSIS installer alone.
5. **AppLocker / WDAC**: with an unsigned build, a publisher rule cannot match; use a hash rule from
   `dist/RELEASE-<version>.json` (`sha256`) and re-issue it per version. Signed builds (docs/SIGNING.md) allow a
   publisher rule on `Integrated IT Support Inc.`.

## Intune (Microsoft Endpoint Manager)

**Option 1 — Line-of-business app (simplest):** Apps → Windows → Add → *Line-of-business app* → upload the `.msi`.
Intune reads the product code and the silent command itself. Set *Install behavior = System*, assign to a device
group. Command line arguments: `/qn /norestart`.

**Option 2 — Win32 app (when you need requirements/detection rules):** wrap the `.msi` with
`IntuneWinAppUtil.exe -c <folder> -s ARIA-Sentinel-0.2.1-setup.msi -o <out>`, then:

- Install command: `msiexec /i "ARIA-Sentinel-0.2.1-setup.msi" /qn /norestart`
- Uninstall command: `msiexec /x "{ProductCode}" /qn /norestart`
- Install behavior: System · Device restart behavior: No specific action
- Requirements: 64-bit, Windows 10 1809+
- Detection rule: MSI → product code (auto-filled from the package), or File → `%ProgramFiles%\ARIA Sentinel\ARIA Sentinel.exe` exists

## SCCM / MECM

Software Library → Applications → Create Application → *Windows Installer (*.msi file)*. MECM reads the product
code and silent switches. Deployment type: Install for system, whether or not a user is logged on. Supersedence:
add the previous version's deployment type as superseded (the fixed UpgradeCode handles the actual upgrade).

## Group Policy

Computer Configuration → Policies → Software Settings → Software installation → New package → the `.msi` (must be
on a UNC share the computer account can read). GPO installs MSI only (not the NSIS `.exe`).

## Per-user configuration an organisation can pre-seed

All files live in `%USERPROFILE%\.aria-sentinel\` and are read at launch (policy.json is also watched and re-read
daily). Drop them with a logon script, Intune PowerShell script (user context) or your RMM.

| File | Purpose | Shape |
|---|---|---|
| `license.json` | pre-enter the organisation's licence key so users never paste it | `{ "key": "<64-hex key>", "email": "it@example.com" }` — verified online once the user finishes Setup (nothing is sent before that; the email stays on the device); the server's signed answer is cached for this device |
| `customer.json` | per-customer scoping and kill switch | `{ "customerId": "acme", "displayName": "Acme Inc.", "disabled": false }` — `"disabled": true` = detect-only |
| `policy.json` | organisation policy overlay | `{ "recipes_disabled": ["printer-spooler-v1"], "business_hours": { "start": 8, "end": 18, "tz": "America/Toronto" }, "confirmation_threshold": "medium", "escalation_contacts": ["helpdesk@example.com"] }` — unknown recipe ids are ignored; nothing can be *enabled* from this file |

Not pre-seedable in 0.2.1 (the user decides in the app): the live-fix consent, the autonomy level, notification
channels. These are per-user choices by design.

## Verifying a deployment

- `"%ProgramFiles%\ARIA Sentinel\ARIA Sentinel.exe"` (MSI) or `"%LOCALAPPDATA%\Programs\ARIA Sentinel\ARIA Sentinel.exe"` (NSIS) exists.
- The tray icon appears after the user's first launch; Settings → About shows the version you deployed.
- `Get-AuthenticodeSignature "<path>\ARIA Sentinel.exe"` → `Valid` only for a signed build; `NotSigned` for the
  pilot build (expected until signing is set up).
- Outbound: `iisupp.net` (licence, update feed, notifications, knowledge, the hosted update binary — or the download
  host you publish to), plus only what you configure (the customer's own ServiceNow instance, Microsoft Graph,
  Slack/Teams webhooks) and the network watcher's local reachability probes (your own DNS server / gateway). No
  third-party analytics or telemetry. The in-app Privacy verifier lists every request it saw.

## Uninstall / cleanup

Uninstalling removes the program. Per-user state in `%USERPROFILE%\.aria-sentinel\` (audit log, licence cache,
settings) is deliberately left in place; delete that folder to remove it.
