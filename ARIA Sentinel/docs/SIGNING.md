# Code signing the Windows installer

Status today (0.2.1): **the build is unsigned.** Nothing in this repo holds a certificate, and no build has been
signed yet. Until one of the two options below is set up, every installer is named
`ARIA-Sentinel-<version>-unsigned.exe`, Windows SmartScreen shows "Windows protected your PC" on first run, and
the compliance evidence pack reports control CC8.1 as *not met*. That is the honest state; do not rename the file.

The build command does not change when signing arrives. `npm run package:win` (what `build-installer.bat` and
`ota-build.bat` call) reads the environment:

| Environment present | What happens |
|---|---|
| none of the below | artifact `ARIA-Sentinel-<v>-unsigned.exe` / `.msi`; the script prints **UNSIGNED build — SmartScreen will warn** |
| Azure Trusted Signing variables | electron-builder signs every `.exe`/`.dll` and the installers through Azure; artifact `ARIA-Sentinel-<v>-setup.exe` / `.msi`; `forceCodeSigning` is on, so a signing failure **fails the build** instead of producing an unsigned file under a signed name |
| `CSC_LINK` + `CSC_KEY_PASSWORD` (a `.pfx`) | same, through `signtool` |
| `SIGN_CERT_SUBJECT` or `SIGN_CERT_SHA1` (a certificate in the Windows store / on a USB token) | same, through `signtool` picking the certificate from the store |

After the build, `scripts/package-win.mjs --verify-only` (run automatically) prints each artifact's path, size,
SHA-256 and an Authenticode verdict (`Get-AuthenticodeSignature`, plus `signtool verify /pa` when the Windows SDK
is installed) and writes `dist/RELEASE-<version>.json`. **Only a `Valid` verdict is "signed".**

Where to put the variables: `%USERPROFILE%\.aria-sentinel-signing.bat` (outside the repo, never committed; the two
`.bat` files `call` it when it exists; `scripts/package-win.ps1` dot-sources the PowerShell twin
`%USERPROFILE%\.aria-sentinel-signing.ps1` with `$env:NAME = "value"` lines), for example:

```bat
rem <region> is the Trusted Signing account's region: eus (East US), wus2 (West US 2), weu (West Europe) ...
set AZURE_SIGNING_ENDPOINT=https://<region>.codesigning.azure.net
set AZURE_SIGNING_ACCOUNT=iis-trusted-signing
set AZURE_SIGNING_PROFILE=aria-sentinel-public
set AZURE_SIGNING_PUBLISHER=CN=Integrated IT Support Inc.
set AZURE_TENANT_ID=00000000-0000-0000-0000-000000000000
set AZURE_CLIENT_ID=00000000-0000-0000-0000-000000000000
set AZURE_CLIENT_SECRET=...
```

## Option A — Azure Trusted Signing (recommended: cheapest, no token, reputation from day one)

What it is: Microsoft's cloud signing service. Microsoft validates the organisation once, then issues short-lived
certificates on every signing call from a **public trust** root, so SmartScreen reputation accrues to the
organisation identity rather than to one certificate file.

Price: **Basic ≈ US$9.99 per month** (5,000 signatures/month, 1 certificate profile of each type); Premium ≈ US$99.99 per
month. Pay-as-you-go on the Azure subscription; prices are Microsoft's list prices at the time of writing — confirm on
the Azure pricing page before budgeting.

What the owner must do (one-time, ~1–3 business days for validation):

1. **Azure subscription** (any existing one; the resource is tiny). Register the resource provider
   `Microsoft.CodeSigning` on the subscription.
2. **Create a Trusted Signing account** in a supported region (East US / West US 2 / West Europe / North Europe …).
   The account name becomes `AZURE_SIGNING_ACCOUNT`; the region endpoint (for example
   `https://<region>.codesigning.azure.net`, where `<region>` is `eus` for East US) becomes `AZURE_SIGNING_ENDPOINT`.
3. **Identity validation** → *Public* → organisation: legal name "Integrated IT Support Inc.", registered address,
   a business registration number, a domain (iisupp.net) and a contact who can answer the verification email/call.
   This is the step that takes days; the account is unusable until it shows *Completed*.
4. **Certificate profile** of type *Public Trust*, bound to the validated identity. Its name becomes
   `AZURE_SIGNING_PROFILE`; its subject (`CN=Integrated IT Support Inc., O=…`) is `AZURE_SIGNING_PUBLISHER`.
5. **Credentials for the build PC.** Either `az login` on that PC with a user that holds the
   *Trusted Signing Certificate Profile Signer* role on the account, or an app registration (service principal) with
   that role and `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` in the signing file above.
6. **Build PC prerequisites:** .NET 8 runtime (the `TrustedSigning` PowerShell module needs it); electron-builder
   installs the module itself (`Install-Module TrustedSigning -Scope CurrentUser`) the first time it signs. Windows
   SDK `signtool` is required by electron-builder for the actual signing step — install "Windows SDK Signing Tools for
   Desktop Apps" (part of the Windows 10/11 SDK).
7. Run `build-installer.bat`. The first line says `SIGNED build via Azure Trusted Signing (...)`; the verification at
   the end must say `signed  SIGNED (CN=Integrated IT Support Inc. ...)`.

Exact variables: `AZURE_SIGNING_ENDPOINT`, `AZURE_SIGNING_ACCOUNT`, `AZURE_SIGNING_PROFILE` (required, all three);
`AZURE_SIGNING_PUBLISHER` (optional); `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` (or `az login`).

## Option B — an OV or EV code-signing certificate from a CA

What it is: a certificate bought from DigiCert, Sectigo, GlobalSign, SSL.com, Certum … Since June 2023 the
CA/Browser Forum requires the private key of a code-signing certificate to live on hardware, so a new OV/EV
certificate arrives on a **USB token** or in the CA's **cloud HSM**, not as a downloadable `.pfx`.

Prices (approximate list prices at the time of writing; resellers are often cheaper; confirm before buying):

- **OV code signing:** roughly **US$200–600 per year** (Sectigo/Certum at the low end, DigiCert at the high end), plus
  a token (~US$50–100) when the CA does not include one.
- **EV code signing:** roughly **US$300–900 per year**. EV used to give instant SmartScreen reputation; since 2024
  Microsoft treats OV and EV the same for SmartScreen, so EV is mostly a procurement checkbox now.
- Organisation validation (both): legal entity lookup, a verified phone number, and a signed authorisation letter —
  typically 1–5 business days.

What the owner must do:

1. Buy the certificate as **Integrated IT Support Inc.** (the subject must be the legal name customers will see).
2. Complete the CA's organisation validation.
3. Install the certificate on the build PC: plug in the token (its driver/middleware puts the certificate in the
   Windows *Personal* store), or install the `.pfx` if the CA delivered one (older issuance / exported from a cloud HSM).
4. Install the Windows SDK signing tools (`signtool`).
5. Set the variables in `%USERPROFILE%\.aria-sentinel-signing.bat`:
   - token / store: `set SIGN_CERT_SUBJECT=Integrated IT Support Inc.` (or `set SIGN_CERT_SHA1=<thumbprint>`); the token's
     PIN prompt appears once per signing session (electron-builder signs several files; some tokens cache the PIN);
   - `.pfx`: `set CSC_LINK=C:\secure\iis-codesign.pfx` and `set CSC_KEY_PASSWORD=<password>`.
6. Run `build-installer.bat`; the verification must say `signed  SIGNED (...)`.

Exact variables: `CSC_LINK`, `CSC_KEY_PASSWORD` (also accepted as `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD`), or
`SIGN_CERT_SUBJECT` / `SIGN_CERT_SHA1`. Timestamping uses DigiCert's RFC 3161 server (`timestamp.digicert.com`, set by the build script) so signatures
stay valid after the certificate expires.

## What signing does and does not fix

- Signed + reputation → no SmartScreen interstitial, Intune/SCCM admins can pin the publisher, the evidence pack
  reports CC8.1 as met. Reputation with a brand-new OV certificate still takes some installs to accrue; Azure Trusted
  Signing and EV start with it.
- Signing the installer does **not** sign the update feed. The manifest (`latest.yml`) carries a SHA-512 the desktop
  verifies; publisher verification of a downloaded update works only once the app itself is signed (electron-updater
  compares the new installer's publisher with the running app's). Until then updates are hash-checked, not
  publisher-checked — stated in the release notes.
- macOS is a separate chain (Apple Developer ID + notarisation, US$99/year). Not started; the macOS build stays an
  ad-hoc `dir` target.

## Checklist before a customer download goes live

1. `build-installer.bat` ends with `RESULT: OK` and `signed  SIGNED (...)` for the `.exe` and the `.msi`.
2. `dist/RELEASE-<version>.json` → `"signed": true`.
3. A fresh Windows 11 VM runs the installer without a SmartScreen "Unknown publisher" interstitial.
4. Only then: `netlify.toml` HELD rules for the download may be lifted (another lane owns that file) and `/downloads`
   can say "download" instead of "emailed after purchase".
