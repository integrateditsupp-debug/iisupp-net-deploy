# ARIA Sentinel — Code-Signing Decision (RUN 29-F)

**Status:** RESEARCH ONLY — no purchase. Ahmad approves any spend.
**Date:** 2026-06-22
**Decision owner:** Ahmad (Integrated IT Support Inc.)

> All dollar figures below are *typical market ranges* observed in the CA market as of early 2026 and **must be re-confirmed on the vendor's checkout page before any purchase** — CA pricing changes often and varies by reseller, term length, and promotions. Nothing here is a quote.

---

## 1. Why this matters for Sentinel

`npm run package:win` produces an **unsigned** `.exe` (`ARIA-Sentinel-<ver>-unsigned.exe`). On a fresh Windows machine an unsigned, low-reputation binary triggers **Microsoft Defender SmartScreen**: a full-screen "Windows protected your PC" warning where the user must click *More info → Run anyway*. For a paid B2B security product this is a conversion killer and a trust problem — exactly the friction Sentinel exists to remove.

Signing does two things:
1. **Authenticode signature** — proves the binary came from "Integrated IT Support Inc." and wasn't tampered with (also satisfies many corporate allow-listing / MDM policies).
2. **SmartScreen reputation** — reduces/eliminates the warning. *How fast* the warning goes away depends on certificate type (below).

---

## 2. Certificate types

| | **OV (Standard) code signing** | **EV (Extended Validation) code signing** |
|---|---|---|
| Org validation | Yes (business verified) | Yes (stricter EV vetting) |
| SmartScreen reputation | **Earned over time** — must accumulate installs/clean telemetry; warnings persist for the first weeks until reputation builds | **Instant** — EV certs get immediate SmartScreen reputation on first signed release |
| Key storage (2023+ CA/B Forum rule) | Must be on FIPS 140-2 hardware: **USB token or cloud HSM** (soft PFX files no longer issued) | Same — hardware/HSM required, EV always was |
| Kernel-mode driver signing | No | Required for EV + Microsoft attestation (Sentinel ships **no kernel driver**, so N/A) |
| Typical annual cost | ~$200–$400 / yr | ~$350–$700 / yr |
| One-time token (if USB) | ~$50–$100 hardware | ~$50–$100 hardware |

**Key implication for Sentinel:** Sentinel is a *new* product with *zero* existing install base. With an **OV** cert, the first ~30 days / first few hundred installs will **still show SmartScreen warnings** while reputation builds — precisely during the launch window when first paying customers install. With **EV**, the warning is gone from the first signed `.exe`.

---

## 3. Vendor comparison (OV and EV)

| Vendor | OV (typical/yr) | EV (typical/yr) | Token / HSM | Notes |
|---|---|---|---|---|
| **Sectigo** (formerly Comodo) | ~$200–$300 | ~$400–$500 | USB token (SafeNet) or Sectigo cloud HSM | Cheapest mainstream OV; widely resold (SSLs.com, The SSL Store) often below list. Good for cost-sensitive launch. |
| **SSL.com** | ~$200–$250 | ~$350–$400 | USB token or **eSigner cloud** (sign in CI without physical token) | **eSigner cloud signing** is the standout: no USB token to plug into Ahmad's build machine, signs from a hosted HSM via API — fits an automated `ota-build.bat`. Often the lowest EV price. |
| **DigiCert** | ~$400–$600 | ~$600–$700 | USB token or DigiCert KeyLocker (cloud HSM) | Most "enterprise trusted" brand; priciest. KeyLocker is a polished cloud-HSM CI story. Overkill for a solo-founder launch unless an enterprise customer demands the DigiCert name. |

---

## 4. The hidden cost: physical token vs cloud HSM

The 2023 CA/B Forum hardware-key mandate means an OV/EV cert is delivered to a **USB token** (must be physically present in Ahmad's build machine every signing) **or** a **cloud HSM** (sign over an API). For an automated `ota-build.bat` pipeline that publishes 0.1.x releases, a USB token is operational friction (the token must be plugged in, drivers installed, PIN entered per build).

**Cloud-HSM signing (SSL.com eSigner / DigiCert KeyLocker) is strongly preferred** for an automated pipeline — it removes the "is the token plugged in?" failure mode and lets signing run unattended.

---

## 5. Recommendation

**Recommended: SSL.com EV Code Signing with eSigner cloud signing.**

Reasoning, in priority order:
1. **EV → zero SmartScreen warnings from day one.** Sentinel launches with no install base; OV's 30-day reputation-build window would put warnings in front of the *first* paying customers. EV removes that risk entirely. For a security product sold on trust, this is worth the EV premium.
2. **eSigner cloud signing → no USB token in the build loop.** Fits the automated `ota-build.bat` → GitHub Releases pipeline; no physical-token failure mode.
3. **Lowest EV price among the three** in the typical range, and SSL.com is an established, broadly-trusted CA.

**Budget to approve (verify at checkout):** ~$350–$400/yr for the EV cert; eSigner cloud signing may add a small per-year or per-signature fee — confirm the eSigner tier on SSL.com's checkout. No USB hardware cost with eSigner.

**Fallback if EV is rejected on cost:** Sectigo **OV** (~$200–$300/yr) — accept the ~30-day SmartScreen reputation ramp, and front-load installs (e.g. sign 0.1.2, ship to the first friendly customers, let reputation accrue before broad outbound). Document the warning in the install email so early customers expect it.

**Not recommended now:** DigiCert (price premium not justified at this stage unless a specific enterprise customer contractually requires the DigiCert name).

---

## 6. What this unblocks / next step (no spend yet)

- Once Ahmad approves: purchase EV cert from SSL.com, complete EV org vetting (can take a few business days), set up eSigner.
- Wire signing into `ota-build.bat` after `package:win` (sign the `-unsigned.exe`, drop the `-unsigned` suffix on the signed artifact).
- Re-test the 0.1.2 download → install flow on a clean VM to confirm SmartScreen is silent.

**No certificate has been purchased. This document is for Ahmad's decision only.**
