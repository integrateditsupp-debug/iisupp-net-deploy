# ARIA Sentinel — Code-signing decision (research only, no spend)

**Decision date:** 2026-06-22
**Status:** Documented for Ahmad. NO purchase made. Awaiting spend approval.

## Why this matters

Unsigned `.exe` files trigger Windows SmartScreen + Defender warnings on first install. Conversion impact:
- Without code-signing cert → ~30-50% install abandonment on first try (consumer reports vary)
- With OV cert (standard) → 30-day reputation build period before warnings disappear
- With EV cert → instant SmartScreen reputation, no warning ever

For $599–$625K customers, install friction = trust collapse. Code-signing is launch-critical, not nice-to-have.

## Vendor comparison (USD, 1-year)

| Vendor | OV Standard | EV (hardware token / HSM) | Reputation build |
|---|---|---|---|
| **Sectigo** | $179/yr (3-year deal: $107/yr) | $329/yr EV + USB token ~$60 | OV: 30 days · EV: instant |
| **DigiCert** | $474/yr | $599/yr EV + HSM included | OV: 30 days · EV: instant |
| **SSL.com** | $159/yr | $349/yr EV | OV: 30 days · EV: instant |
| **GoGetSSL (reseller)** | $84/yr Sectigo OV | $279/yr Sectigo EV | Same as Sectigo |

## Recommendation

**SSL.com EV at $349/yr** for the launch. Reasoning:
1. EV eliminates the 30-day reputation build entirely → SmartScreen-clean from day one
2. SSL.com offers cloud HSM (no USB token to ship/manage) — better for Ahmad's solo-founder ops
3. $349 fits inside the locked $20-70/mo cap once amortized monthly ($29/mo)
4. Faster onboarding than DigiCert/Sectigo direct
5. EV is required for any future Microsoft Store submission — future-proofs the path

## Alternative if budget tight

**Sectigo OV via GoGetSSL at $84/yr** ($7/mo) — accepts the 30-day reputation build window. Pair with a `docs/install-troubleshooting.md` page guiding customers through "More info → Run anyway" if SmartScreen complains during the build period.

## Process notes

EV cert validation requires:
- D-U-N-S number ✓ (have it: 241726397 per `reference-iis-business-identifiers`)
- Articles of incorporation
- Business phone number callback to verify (operator at the listed business number must confirm identity)
- Typical timeline: 5-10 business days

## Decision pending

Ahmad approves spend (per locked spend cap rule). Two paths:
- **Premium:** SSL.com EV $349/yr → no install friction ever
- **Lean:** Sectigo OV $84/yr → 30-day reputation build window + troubleshooting page

Recommendation: **SSL.com EV** for launch. Friction at $599 entry-price tier is conversion-fatal; the $265/yr delta pays for itself with 1 saved Personal-tier signup.

## Related
- [[reference-iis-business-identifiers]] — D-U-N-S + business address ready for validation
- [[feedback-spend-cap-20-70-per-month]] — spend approval rule
- [[project-sentinel-ota-pipeline-live]] — where the signed .exe will be served
