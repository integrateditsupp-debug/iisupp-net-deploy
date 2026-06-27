# Setup Video — Code signing the Windows build (Azure Trusted Signing)
*Build/config script. Forge owns the build config; Ahmad supplies 3 account values + Azure auth.*

**Outcome:** the Windows installer is **Authenticode-signed** → installs clean (no SmartScreen scare) and runs
as a normal grantable process. **Cost:** Azure Trusted Signing ≈ **$9.99/mo** (Ahmad approved).

> **Why this matters for testing too:** an *unsigned* build is a masked process — Cowork's computer-use can't
> reliably grant/drive it. A *signed* build is a normal process Cowork can grant + screenshot. (Local install
> on Ahmad's own machine works either way — that's how 0.1.17 is driveable now.)

---

## Current build state (0.1.18)
`package.json → build.win`:
```jsonc
"win": {
  "icon": "build/icon.ico",
  "target": ["nsis"],
  "artifactName": "ARIA-Sentinel-${version}-unsigned.${ext}",
  "signExecutable": false          // ← unsigned today
}
```
Build log line today: `file signing skipped via signExecutable configuration`.

## What Ahmad provides (3 values + auth) — NOT secrets except the Azure auth
After he creates the **Azure Trusted Signing** account + a **certificate profile** (identity/org validation can
take days; orgs < 3 yrs take longer):

| Value | Example | Where it goes |
|---|---|---|
| **Endpoint** (region URI) | `https://eus.codesigning.azure.net` | `win.azureSignOptions.endpoint` |
| **Trusted Signing account name** | `iis-trusted-signing` | `win.azureSignOptions.codeSigningAccountName` |
| **Certificate profile name** | `iis-cert-profile` | `win.azureSignOptions.certificateProfileName` |

Azure auth (Ahmad supplies; Cowork never handles): a service principal via env —
`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` (or `az login` on the build machine).

## Build-config change (Forge applies once the 3 values exist)
```jsonc
"win": {
  "icon": "build/icon.ico",
  "target": ["nsis"],
  "artifactName": "ARIA-Sentinel-${version}.${ext}",   // drop the -unsigned suffix
  "azureSignOptions": {
    "endpoint": "https://eus.codesigning.azure.net",
    "codeSigningAccountName": "iis-trusted-signing",
    "certificateProfileName": "iis-cert-profile"
  }
  // remove "signExecutable": false
}
```
electron-builder ≥ 26 drives Azure Trusted Signing through `azureSignOptions` (signtool + the Trusted Signing
dlib). The signing identity comes from the `AZURE_*` env at build time.

## Steps on camera
1. Show the Trusted Signing account + certificate profile in the Azure portal. `[SCREENSHOT: account + profile]`
2. Show the `package.json` diff (unsigned → azureSignOptions). `[SCREENSHOT: config diff]`
3. Set `AZURE_*` env, run `npm run package:win`. `[SCREENSHOT: build log now showing the sign step, not "skipped"]`
4. Right-click the produced `.exe → Properties → Digital Signatures` → show the valid signature. `[SCREENSHOT: signature tab]`
5. Install on a clean machine → no SmartScreen "unknown publisher" block. `[SCREENSHOT: clean install]`

## Keep producing an unsigned build until validation completes
Until Azure finishes identity/org validation, keep a parallel unsigned build (the current config) so testing
isn't blocked. Flip to the signed config only once the certificate profile is active.

## Safety to say on camera
Signing proves publisher identity and integrity to Windows — it does **not** change what the app does. ARIA's
read-only-first, approval-gated behavior is unchanged; signing just removes the install-time warnings.
