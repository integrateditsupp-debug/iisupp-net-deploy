# RUN 24 — Auto-license funnel go-live checklist

The funnel SOFTWARE is built, tested (166/166 suites) and committed (Half A: A1–A4). The steps below are
the operational/infra actions to turn it on. Claude Code cannot do these from the sandbox (no Netlify/
Stripe access, no binary publish). 🔒 R11 holds throughout; `SENTINEL_LICENSE_SECRET` is server-side only.

## ⚠️ Reconcile first — branch divergence

This clone (`sprint-0-backend`, HEAD `0fc91c6`) does NOT contain the commits the RUN 24 packet listed as
"closed" — `25ab20c` (RUN 23f), `a275f15` (website), `789f4c2` (downloads) are absent on every branch, and
`plans/index.html` is still the uncommitted RUN 23e injection. RUN 24-A1…A4 were built on top of RUN 23e.
**Cowork must cherry-pick/merge RUN 24 (`c8d74ca`, `ddac1aa`, `ce0982a`, `0fc91c6`) into the working copy
that holds RUN 23f**, or push RUN 23f here, before deploy. The webhook's `planFromLookupKey` already accepts
both the RUN 23e `sentinel_*` keys and the RUN 23f canonical IDs, so it works under either scheme.

## A — Netlify / Stripe wiring

1. **Stripe webhook endpoint** → Dashboard → Developers → Webhooks → Add endpoint:
   - URL: `https://iisupp.net/.netlify/functions/sentinel-stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`
   - Copy the signing secret → Netlify env `STRIPE_WEBHOOK_SECRET`.
2. Confirm Netlify envs are set: `SENTINEL_LICENSE_SECRET` (sealed), `STRIPE_SECRET_KEY`, `RESEND_API_KEY`,
   `RESEND_FROM`, `SENTINEL_ADMIN_TOKEN`.
3. Blobs store `sentinel-licenses` is created automatically on first write — no setup.
4. Smoke the API: `curl -H "X-Admin-Token: $TOKEN" "https://iisupp.net/.netlify/functions/sentinel-licenses?action=list"`
   → `{"records":[]}`. And `?action=is-revoked&key-hash=<64hex>` (no token) → `{"revoked":false}`.

## B — Desktop 0.1.2 build (Ahmad runs `ota-build.bat`)

- Expected bump: `0.1.1 → 0.1.2`. The shouldBump subject-line hotfix (B1) is already in main
  (`src/shared/ota-release.mjs`, covered by `tests/version-bump.test.mjs`).
- **🚨 BLOCKER for B3 — client license secret.** Tier resolution + the 6-key test rely on the desktop app
  knowing `SENTINEL_LICENSE_SECRET` (`resolvePlanFromKey` / `enterLicense` read `process.env.SENTINEL_LICENSE_SECRET`,
  which is EMPTY on a customer machine). Without it, every key resolves to Personal and **B3 fails the HARD
  STOP**. Decide ONE before building:
  - (a) **Secret-in-client** (what the packet's `verifyLicenseStatus(key, secret)` implies): inject the secret
    at build time (e.g. ota-build writes a gitignored resource the app reads). Tradeoff: anyone who extracts
    the secret can mint an admin key. Mitigated only by server revocation. **This is a security-posture call —
    confirm before shipping.**
  - (b) **Server-side resolve**: add a `sentinel-licenses?action=resolve&key-hash=…` endpoint that returns the
    plan (server has the secret + registry), and have `enterLicense` call it. Keeps the secret off the client,
    but the 6 manual test keys must be in the registry (mint them via the admin console **Add manually**, or an
    `addManual` call, so they resolve). Recommended.
- Do NOT let Claude Code run the build/publish — it publishes binaries to GitHub Releases (out of policy).

## B3 — Verify the 6 keys against 0.1.2 → write `docs/run-24-key-verification.md`

Per key (admin-lifetime / personal / pro / smb / midsize / enterprise): paste → confirm the gated surface
(admin: console + Updates publish + fleet; personal: Manual only; pro: 3 modes + 77 recipes + Reports PDF;
smb/mid/ent: + fleet + compliance + custom recipes). Pass/fail per key. Keys live in Cowork memory
`reference-sentinel-admin-master-license` — never commit them.

## B4 — End-to-end smoke → write `docs/funnel-smoke-test.md`

Stripe test-mode subscription on `/plans` → `sentinel-stripe-webhook` fires → admin console **Licenses** tab
shows the record within ~30s → customer email contains the key + `https://iisupp.net/downloads` → install
0.1.2 → paste key → tier unlocks. Document any drop-off.

## Revocation sanity

After a record exists, hit **Revoke** in the Licenses tab → the desktop app downgrades to free within 6h
(it polls `?action=is-revoked&key-hash=…`, cached 6h, fail-open on offline). The check sends only sha256(key).
