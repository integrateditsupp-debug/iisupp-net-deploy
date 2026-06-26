# Half-B Runbook — ship Sentinel 0.1.2 + verify the funnel (RUN 29-I)

The exact sequence Ahmad runs **on his machine** after CC's RUN 24/25/29 commits are on `main` and Netlify has deployed. CC cannot run any of this (it requires production secrets). Order matters.

---

## 0. Prerequisites — verify these env vars exist on **Netlify** (Site → Settings → Environment)

The funnel is dead without these. Verify each is set (values are server-side only — never paste them into chat, code, or git):

| Var | Used by | Purpose |
|---|---|---|
| `SENTINEL_LICENSE_SECRET` | `sentinel-resolve`, `sentinel-stripe-webhook`, `sentinel-licenses` | HMAC that mints/resolves license keys. **Single point of failure.** |
| `STRIPE_SECRET_KEY` | `sentinel-stripe-webhook` | Stripe API (live for production). |
| `STRIPE_WEBHOOK_SECRET` | `sentinel-stripe-webhook` | Verifies the Stripe webhook signature. Set **after** adding the webhook endpoint in Stripe. |
| `RESEND_API_KEY` + `RESEND_FROM` | webhook + `sentinel-licenses` | Sends the customer key email + admin notify. |
| `SENTINEL_ADMIN_TOKEN` | `sentinel-licenses` (every mutation + the registry-poll) | Bearer token guarding the admin registry API. |
| `STRIPE_PRICE_*` (all 5 tiers) | checkout / webhook lookup | Maps Stripe price/lookup-key → plan. |

> Note: the desktop `.exe` does **NOT** carry `SENTINEL_LICENSE_SECRET` (RUN 24-A6). It resolves licenses by POSTing the pasted key to `/sentinel-resolve`, which keeps the secret server-side.

---

## 1. Build + publish 0.1.2

```powershell
cd "C:\Users\Ahmad Wasee\Documents\GitHub\ARIA — Real-Time AI Assistant\iisupp-net-deploy"
.\ARIA Sentinel\ota-build.bat        # package:win → sign (once cert is set up, RUN 29-F) → GitHub Release → manifest
```

This produces `ARIA-Sentinel-0.1.2-unsigned.exe` (or signed, once the EV cert from `docs/code-signing-decision.md` is wired) and publishes the GitHub Release + update manifest.

> Until the code-signing cert is purchased, the `.exe` is unsigned → SmartScreen will warn on a clean machine (expected; see `docs/code-signing-decision.md`).

## 2. Install on a clean Windows VM

Install the published `.exe`. On first run it should show the license-entry / trial flow (RUN 29-C onboarding, when shipped). No `SENTINEL_LICENSE_SECRET` is present locally — that's correct.

## 3. Run the funnel smoke test

Set the secrets in **your shell** (TEST mode for Stripe), then run the one-command harness:

```powershell
$env:SENTINEL_LICENSE_SECRET = "<the production secret>"   # same value as Netlify
$env:SENTINEL_ADMIN_TOKEN    = "<admin token>"
$env:STRIPE_SECRET_KEY       = "sk_test_..."               # TEST mode — the script refuses sk_live
$env:STRIPE_SMOKE_PRICE      = "price_..."                 # a Sentinel TEST-mode price id
node scripts/smoke-test-funnel.mjs
```

What it does (see `scripts/smoke-test-funnel.mjs`, RUN 29-H):
1. Computes the 6 HMAC keys (personal/pro/smb/midsize/enterprise/admin) and POSTs each to `/sentinel-resolve` → asserts each returns `{plan, status:"active"}`.
2. Confirms a forged key is rejected (401).
3. (if Stripe env set) Creates a TEST subscription → polls the admin registry up to 60s for the minted record → asserts the raw key is never returned.
4. Writes a pass/fail matrix to `docs/funnel-smoke-test-results.md`.

**Expected:** `✅ ALL PASS`. If a tier resolves to the wrong plan → the HMAC secret on Netlify differs from the one in your shell. If the Stripe record never lands → check `STRIPE_WEBHOOK_SECRET` + the webhook endpoint in the Stripe dashboard + `RESEND_*`.

## 4. Manual paste-key check (the real customer path)

In the installed Sentinel, paste each of the 6 keys (the smoke test prints masked keys; generate the real ones the same way the script does) and confirm the tier unlocks: Personal = Manual only, Pro = paid modes, … admin = admin console visible. Revoke one via the admin Licenses tab and confirm the desktop degrades within the cache window (RUN 24-A6b: ≤24h fresh / 24–72h toast / >72h Personal).

## 5. Live Stripe end-to-end (final)

With a **real** card on the live checkout: subscribe to one tier → confirm the customer key email arrives (Resend) → install → paste → tier unlocks. Then cancel/refund the test purchase.

---

## Done when

- `docs/funnel-smoke-test-results.md` shows ✅ ALL PASS.
- All 6 keys unlock the correct tier in the installed 0.1.2.
- A real Stripe purchase delivers a working key by email.

Report the smoke-test matrix + any failures back into `senior-director-state/loop-engineer/claude-code-next-prompt.md` so Cowork can queue follow-ups.
