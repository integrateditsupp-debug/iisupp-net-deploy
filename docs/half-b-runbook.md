# Half B runbook — Ahmad's post-deploy execution

After Cowork ships RUN 29 (cherry-pick into main lands + Netlify deploys green), Ahmad runs the steps below to validate the full funnel end-to-end and ship the 0.1.2 customer .exe.

## Prerequisites (one-time setup)

### 1. Verify Netlify env vars all set

Visit `https://app.netlify.com/projects/iisupp/configuration/env` — these must ALL be present (sealed where marked):

| Variable | Sealed | Source |
|---|---|---|
| `SENTINEL_LICENSE_SECRET` | yes | already set 2026-06-22 |
| `SENTINEL_ADMIN_TOKEN` | yes | already set (RUN 23/23b) |
| `STRIPE_WEBHOOK_SECRET` | yes | **PENDING** — see step 2 below |
| `RESEND_API_KEY` | yes | should be present |
| `RESEND_FROM` | no | `ahmad.wasee@iisupp.net` |
| `STRIPE_PRICE_PERSONAL` | no | already set |
| `STRIPE_PRICE_PRO` | no | already set |
| `STRIPE_PRICE_SMALL_BUSINESS_Y` | no | already set |
| `STRIPE_PRICE_MID_SIZE_Y` | no | already set |
| `STRIPE_PRICE_ENTERPRISE_Y` | no | already set |

### 2. Set `STRIPE_WEBHOOK_SECRET` on Netlify

1. Stripe Dashboard → Developers → Webhooks → **Add endpoint**
2. URL: `https://iisupp.net/.netlify/functions/sentinel-stripe-webhook`
3. Events to send: `checkout.session.completed` + `customer.subscription.created`
4. After creation, click the endpoint → "Signing secret" → **Reveal** → copy
5. Netlify env → Add variable → key: `STRIPE_WEBHOOK_SECRET` · value: paste · sealed · all scopes

## Build the 0.1.2 customer .exe

```powershell
cd "C:\Users\Ahmad Wasee\Documents\GitHub\ARIA — Real-Time AI Assistant\iisupp-net-deploy"
ota-build.bat
```

Expected output:
- Version bumps `0.1.1 → 0.1.2`
- `dist/ARIA-Sentinel-0.1.2-unsigned.exe` produced
- Auto-published to GitHub Release + manifest updated

If the version doesn't bump → confirm `src/shared/ota-release.mjs` has the subject-line-only `shouldBump` fix (RUN 23c hotfix).

## Install the new .exe

1. Right-click `dist/ARIA-Sentinel-0.1.2-unsigned.exe` → Run as administrator
2. Walk through installer (SmartScreen warning expected until code-signing — see `docs/code-signing-decision.md`)
3. Launch from Start menu

## Smoke-test the 6 HMAC keys

Set the 6 keys (Ahmad pastes from Cowork memory `reference-sentinel-admin-master-license`):

```powershell
$env:SENTINEL_KEY_ADMIN       = "b2a808581ee58d9609bd49600b124c8a80f19f876471480c98cb779b0c81e088"
$env:SENTINEL_KEY_PERSONAL    = "e60aeffcec5096f52a203080e2f40b5523ee5ba14afde5f77fc906c5db4d5e25"
$env:SENTINEL_KEY_PRO         = "7b22a8b0dcb025348fec4b2efc29d24950787192145118cd52e5890382e7a574"
$env:SENTINEL_KEY_SMB         = "4a9c7de74d4ba51f48c2da8a6699ec1f26b215f8fb9fa722f9240dafa4299c28"
$env:SENTINEL_KEY_MIDSIZE     = "bd14982620e9a6d911da894736cfeb80889f166f99e52baa8cdc3b2b3da3bc69"
$env:SENTINEL_KEY_ENTERPRISE  = "0d4632ef1bfce7c9079d5e1a423a82cb75af18004dc808ba68d2b17a8800d166"
node scripts/smoke-test-funnel.mjs
```

Expected:
- 6 PASS lines for the keys
- 1 PASS line for the heartbeat
- Output file `docs/funnel-smoke-test-results.md` with pass/fail matrix

If any FAIL, the script writes specific "how to fix" hints in the results file.

## End-to-end Stripe test-mode subscription

After keys verify, run one real Stripe test-mode subscription to prove the full funnel:

1. Stripe Dashboard → switch to **Test mode** (top-right toggle)
2. Use a test card (`4242 4242 4242 4242`, any future date, any CVC)
3. Subscribe via `https://iisupp.net/plans/` → click SUBSCRIBE on Personal tier
4. Complete checkout
5. Within 30 seconds:
   - Check Sentinel admin console → Licenses tab — new entry should appear
   - Check `ahmad.wasee@iisupp.net` inbox — admin notify email should arrive
   - Check the test customer email (Stripe shows it in test mode) — license email should arrive
6. Open the new Sentinel .exe → paste the emailed key → tier should unlock (Personal mode features visible, others gated)

Paste the outcome to Cowork:
- Pass/fail per checkpoint
- Any unexpected behavior
- Timing of each step

## Rollback path

If anything breaks customer-visible:
1. Netlify → Deploys → previous green deploy (`fc13223` or whatever was last working) → "Publish deploy"
2. Tells Cowork to revert and re-investigate

## What's next after Half B passes

- Switch Stripe to **live mode**
- First outbound batch to lead list with "ARIA Sentinel Windows now available" message
- Monitor admin Licenses tab for first real customer
