# ARIA Sentinel MVP

ARIA Sentinel is the Windows desktop + Chrome extension branch of ARIA. This MVP is built for no-cost local testing:

- Windows Electron app with tray, settings, transparent globe overlay, local bridge, recipe engine and dry-run fix runner.
- Chrome Manifest V3 extension with in-page globe, browser detectors and browser-only fixes.
- Pull-only recipe and stop-code endpoints on iisupp.net.
- Local privacy verifier, transparency log and ServiceNow incident-draft flow.

## No-cost safety defaults

- Live fixes are OFF until the person running setup turns them on (Settings → Autonomy → Live fixes). `ARIA_SENTINEL_ALLOW_SYSTEM_FIXES=1`/`=0` is a developer override of that consent; unset = the consent decides. Fixes that need administrator rights ask through Windows UAC.
- Sentinel does not send raw symptoms, page content, URLs, file paths, credentials, or document text to AI APIs.
- ServiceNow posting is disabled until a customer instance and OAuth app are configured.
- Chrome fixes operate on the current origin only.

## Run locally

```powershell
cd "<path-to-repo>\ARIA Sentinel"
npm install
npm run start:dry-run
```

The desktop bridge listens on:

```text
http://127.0.0.1:37841/health
```

## Load Chrome extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Load unpacked.
4. Select:

```text
<path-to-repo>\ARIA Sentinel\chrome-extension
```

## Package unsigned Windows build

```powershell
cd "...\ARIA Sentinel"
npm run package:win
```

The output is unsigned until code signing is purchased. Windows SmartScreen warnings are expected for unsigned builds.

## Enterprise MVP rating rubric

The audit in `docs/ENTERPRISE_READINESS.md` scores:

- Product completeness
- Privacy and data boundaries
- Safety/rollback posture
- ITSM readiness
- Deployment readiness
- Security/compliance readiness
- Supportability and observability
