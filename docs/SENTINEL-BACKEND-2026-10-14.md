# ARIA Sentinel — server-side fixes (2026-10-14, lane F1)

> **Read §7 first** — an independent review the same day found ship-blocking defects in this lane's work (a $1 checkout
> minting an Enterprise key, a bypassable recipient binding, an email-unlocked Walk-Through, …). §7 lists every fix,
> the new env var `SENTINEL_RESOLVE_SIGNING_KEY`, the new admin action `approve-contact` and the Stripe events to add.
> Where §1–§6 below disagree with §7, §7 is current.

Branch `cc/sentinel-prod-2026-10-14` · base: published main `6c2dec96` · scope: the Netlify functions behind the
desktop agent, the Stripe funnel, and the two `netlify.toml` rules the audit named. Implements findings
B1–B20 of the 2026-10-14 backend audit (scratchpad `audit-backend.md`). Nothing here was deployed or committed by
this lane; nothing live was changed. No email, SMS, Stripe session or Blob record was created while working.

**Verification:** `node --check` on all 32 touched JS files (0 failures); root `node scripts/run-tests.mjs` → **14/14** (the six new
Sentinel suites joined the guard set, ~1.6 s total, no network, no `node_modules`); existing covering suites green
(`aria-sentinel-approval` 41, `aria-sentinel-notify` 51, `notify-lib` 30, `stripe-price-staging`, `netlify-function-
externals`, `netlify-health-redirect` 4/4, `deploy-safety-denylist`); app-side suites that touch these files green
(`endpoint`, `web-tier-contract`, `update-feedurl`, `outbound-declared`, `network-capture`, `heartbeat-endpoint`,
`sentinel-resolve`, `sentinel-licenses-api`, `sentinel-license-funnel`, `license-features`, `update-manifest`,
`license-register`, `admin-publish`). The real `@netlify/blobs@7.4.0` was loaded through the new store lib
(connect → open) as a smoke test. `tests/capture-read-path.test.mjs` still cannot load on a tree without
`node_modules` — the cause is `aria-health-lead.mjs`'s static `@netlify/blobs` import (not in this lane), as the
audit already recorded.

---

## 1. What changed, per file

### New shared libs (`netlify/functions/lib/`)

| File | What it is |
|---|---|
| `sentinel-store.cjs` | **B1/B17.** The one way a Sentinel v1 handler opens Blobs: `openStore(name, event)` runs `connectLambda(event)` (once per event) before `getStore(name)`, never asks for `consistency:'strong'` (unavailable in Lambda-compat mode — every read threw), returns `null` instead of throwing, and `unavailable()` is the shared `503 {ok:false, reason:'store-unavailable'}` (no stack, no `/var/task` paths). Test seams: `_setStoreFactory(fn)` (in-memory stores) and `_setBlobsModule(mod)` (assert the connect-then-open order). |
| `sentinel-license-v2.cjs` | **B3.** Per-customer key scheme v2: `code2 + cust16 + tag46` = **64 lowercase hex** — `01..06` plan code, `sha256(seed).slice(0,16)` customer id, `HMAC(secret,"sentinel-license:v2:<plan>:<cust16>").slice(0,46)` (184-bit tag). `issueCustomerKey`, `parseKeyV2`, `verifyCustomerKey` (constant-time, fail-closed), `resolveAnyKey(key, secret, {resolveV1})` = v2 → shared v1 (`license-features.resolvePlanFromKey`) → legacy `"sentinel-license:v1:admin-lifetime"` alias → `null`. Plan codes are a frozen contract. |
| `sentinel-license-records.cjs` | **B3/B4/B5/B14.** The server data model + helpers: store names, the O(1) **key index** (`sentinel-license-keys/<sha256(key)>` → subscription, tier, status, seats, email, contacts, `disabled`), the **one revocation store** (`sentinel-licenses-revocations/<sha256(key)>`), the device registry (`licenses/<sha256(key)>`), and the recipient-binding rule `isAllowedRecipient` — **narrowed by §7 (P1-2)**: Stripe buyer email · admin-approved contact · admin inbox (no device-registered email, no same-domain colleague; a shared v1 key → admin inbox only). |

### Functions

| File | Change |
|---|---|
| `sentinel-crash.mjs` | B1/B16/B17: store via the lib; 503 JSON (keeps `error:"store error"`) instead of 500; 64 KB body cap; 60/10 min per-IP limit. |
| `sentinel-resolve.mjs` | B9: v1 keys resolve through the **shared** `license-features.resolvePlanFromKey` (admin key minted by the shared module now activates; `admin-lifetime` still accepted). B3: v2 keys resolve first; `keyVersion`, `seats`, `revocationChecked` are additive. B4: revocation read from `sentinel-licenses-revocations` + the key index (an upper-cased paste of a revoked key is caught too). B1: Blobs via the lib; still fail-open on a Blobs blip. Response shape for the desktop unchanged. |
| `sentinel-licenses.mjs` | B1/B17: 503 JSON when the store is down (was 502 + stack). B4: **Revoke writes the revocation entry resolve reads**; for a shared v1 plan key it is written only when no other ACTIVE record holds the same key, and the response says `enforced:false` + why (Rule 14). B3: `addManual` mints a v2 key, writes the key index, reports `emailed:{customer,admin}` honestly; `resend` answers 503 `resent:false` when email is unconfigured (was a fake `resent:true`). New admin actions: `setFlags` (`disabled` / `contacts` / `seats`), `unrevoke`, `revokeKeyHash` (cut a leaked credential off for everyone). `is-revoked` is O(1) first, legacy scan second. |
| `sentinel-stripe-webhook.mjs` | B7: verifies with `STRIPE_SENTINEL_WEBHOOK_SECRET`, falling back to `STRIPE_WEBHOOK_SECRET`. B12: only `sentinel_*` tiers (session `metadata.tier`, price `lookup_key`, price `metadata.sentinel_tier`, subscription `metadata.tier`) mint — ARIA-web `pro` etc. are `skipped:"not-a-sentinel-plan"`. B3: v2 key per subscription, `seats` + `key_version` on the record, key index written. B4: `customer.subscription.deleted` → record revoked + revocation entry. B1/Rule 14: a store that cannot be opened/written → **503 before any email** (Stripe retries); always logs before any non-2xx. Concierge Walk-Through path kept (now a v2 Personal key). Stripe client is loaded lazily with a `_setStripeFactory` test seam. |
| `sentinel-session-report.js` | **B2 (P0 open relay closed).** Device auth (`x-sentinel-key`) or admin token — 401 sends nothing. The user copy goes only to an address the license vouches for (`recipient-not-registered` otherwise, and the response says so); transcript + backend actions are never mailed; free text passes the desktop's `mustBeTelemetrySafe` guard (422 fail-closed) and is then path/secret-scrubbed; no CORS `*`; 24 KB cap; 5 reports/10 min per credential; `ok:true` only on a provider id. |
| `aria-sentinel-approval.js` | B1: passes the event to the store (`A.openStore(name, event)`). |
| `aria-sentinel-notify.js` | B5: recipients bound to the license record where one exists (403 `recipients-not-registered`, nothing sent; legacy v1 keys without a record keep caller-named recipients behind the content guard). Rate bucket per tenant **and** device. B1: event passed to the store. `recipientBinding` is additive in the response. |
| `aria-sentinel-heartbeat.js` | B10: uses the APP's heartbeat module; response = app shape + stub's `licenseActive` + `killed`/`reason`/`tenantDisabled` (exactly what `kill-switch.mjs parseControlPlaneKill` reads) from `ARIA_RECIPES_KILLED`/`ARIA_RECIPES_KILL_REASON` or the record's `disabled` flag. A WRITE needs `x-sentinel-key`; the record is keyed `<day>/<sha256(credential)>` and the desktop's `licenseId` (16 raw key chars) is stored only as a hash. Unauthenticated pings still get the directive + latest version (nothing stored). |
| `aria-sentinel-license-register.js` | B13/B5: device auth required (header, or the legacy body `license_key` hashed on arrival); records keyed by the credential with `key_hash`, never the raw key; `seats`/`overSeats` reported honestly. |
| `aria-sentinel-license-search.js` | B19: masks any legacy raw key; rollback by credential (or legacy raw key, hashed); app admin gate (both env names); 503 JSON. |
| `aria-sentinel-update-manifest.js` | B13: credential from `x-sentinel-key` (legacy `?license=` still accepted, hashed, never logged); client `?rollout=` ignored — the server's published `rollout` + the record's `version_pin`/`rollout_override` decide; manifest rendered by the app module so a record `url` is honoured. |
| `aria-sentinel-update-publish.js` | B13/B20: keeps `url`, `mandatory`, `path`; validates `url` (https + a host the desktop can reach: `iisupp.net`, `download.iisupp.net`, + `SENTINEL_UPDATE_HOSTS`); version/sha512 format checks; `update-events` audit rows; both admin env names. |
| `aria-recipes.mjs`, `aria-stop-codes.mjs` | B8: `config.path` is now an array covering `/aria-recipes` **and** `/.netlify/functions/aria-recipes` (same for stop-codes) — the path the desktop pulls answered 404 live, so the kill switch never reached a device. B18: the sha256 header is documented as an integrity checksum, not a signature. |
| `stripe-checkout.js` | B11: `sentinel_*` subscriptions return to `/downloads/?checkout=success&session_id={CHECKOUT_SESSION_ID}` (cancel → `/plans/?checkout=canceled`); ARIA-web tiers untouched. The tier is also written to `subscription_data.metadata` so subscription events can tell Sentinel from ARIA-web. |
| `stripe-confirm.js` | B1: idempotency store via the lib (connectLambda, no strong consistency). Behaviour otherwise unchanged. |
| `lib/sentinel-approvals.cjs` | B14: device auth is O(1) — revocation entry → key index → device registry → v1 derivation from the secret; the 2,000-blob `sentinel-licenses` scan on every notify/poll is gone. B9: `admin` and `admin-lifetime` both derive. `authenticate()` now also returns `record` (key index) and `device` (registry). `openStore(name, event)`. |
| `lib/capture-read.cjs` | B1: `openStore(name, event)` via the lib (no strong consistency); `handleCaptureGet` passes the request through. |
| `src/shared/heartbeat-server.mjs`, `update-manifest.mjs`, `admin-auth.mjs` (root) | B10/B13/B20: pure re-exports of the app modules under `ARIA Sentinel/src/shared/` — every previous export name kept; no version, host or file name hard-coded at the root any more. |
| `netlify.toml` | B6: the two HELD force-404 rules now sit **above** the `/sentinel-binaries/*` rewrite (and below `/health`, which must precede every 404 rule) — the hold is real, the comment is true. B15: `/sentinel-admin` → 302 `/downloads/`, `/aria-sentinel` and `/aria-sentinel/*` → 302 `/plans/` (the old targets did not exist). Nothing else touched. |
| `scripts/run-tests.mjs` | The six `tests/sentinel-*.test.mjs` suites added to GUARD. |
| `tests/aria-sentinel-notify.test.mjs` | One block updated: revocation is asserted through the revocation store / key index (what revoke + cancellation actually write), not a registry scan. |

### New tests (`tests/`)

`sentinel-store-and-keys` (34) · `sentinel-resolve-and-licenses` (54, cross-handler: revoke → resolve says revoked) ·
`sentinel-session-report` (32) · `sentinel-stripe-webhook` (35) · `sentinel-fleet-endpoints` (54) ·
`sentinel-notify-binding-and-contracts` (28, incl. the toml order + checkout URL contracts). All run the deployed
handlers with in-memory Blobs and a stubbed `fetch`; they are safe for the one-process desktop registry
(each points both store seams at its own stores).

---

## 2. Data model (Netlify Blobs)

| Store | Key | Holds | Written by | Read by |
|---|---|---|---|---|
| `sentinel-licenses` | `subscription_id` (`sub_…`, `manual_…`, Concierge `cs_…`) | the admin-visible record incl. `key`, `tier`, `status`, `seats`, `key_version`, `contacts`, `disabled` | webhook, `addManual`, `revoke`, `setFlags` | admin console (`list/get/exportCsv/resend`) |
| `sentinel-license-keys` | `sha256(key)` = the device credential | key index (no key): subscription, tier, status, seats, email, contacts, disabled | same as above | resolve, notify, session-report, heartbeat, register (one read) |
| `sentinel-licenses-revocations` | `sha256(key)` | `{revoked:true, at, reason, subscription_id}` | `revoke` (when enforceable), `revokeKeyHash`, Stripe `customer.subscription.deleted` | resolve, every device-auth check |
| `licenses` | `sha256(key)` | device check-in registry: `key_hash`, email/name/company given at activation, `devices[]`, `version_pin`, `rollout_override` | license-register, search rollback | manifest, session-report (device email), notify |
| `sentinel-walkthrough-entitlements` | lowercased email | Concierge entitlement + `trialEndsAt` | webhook | resolve |
| `versions` | `index`, `rollout` | published version records (`url`, `mandatory`, `sha512`, `size`, `disabled`), rollout % | update-publish | manifest, heartbeat |
| `heartbeats` | `<day>/<sha256(credential)>` | allow-listed heartbeat fields (+ hashed licenseId) | heartbeat | fleet view (future) |
| `update-events`, `sentinel-crashes`, `sentinel-approvals`, `sentinel-resolve-rl` | — | audit rows / crashes / approvals / IP counters | as before | as before |

Nothing was migrated: every store write from these functions 502'd before today, so there are no legacy records.

---

## 3. Env vars Ahmad must set (Netlify → Site settings → Environment variables)

| Name | Unlocks | Where it comes from | Status |
|---|---|---|---|
| `STRIPE_SENTINEL_WEBHOOK_SECRET` | signature verification of **this** endpoint (`sentinel-stripe-webhook`) — without it the function falls back to `STRIPE_WEBHOOK_SECRET`, which belongs to the ARIA-web endpoint and will not verify Sentinel events | Stripe Dashboard → Developers → Webhooks → the new endpoint → *Signing secret* (`whsec_…`) | **click needed** (see §4) |
| `STRIPE_PRICE_SENTINEL_PERSONAL_M`, `_PRO_M`, `_BUSINESS_Y`, `_MIDSIZE_Y`, `_ENTERPRISE_Y` (aliases `STRIPE_PRICE_PERSONAL_M`, `_PRO_M`, `_SMB_Y`, `_MID_Y`, `_ENT_Y`) | the five SUBSCRIBE buttons on `/plans` and `/downloads` (today: `400 Unknown tier`) | `node "ARIA Sentinel/scripts/setup-stripe-sentinel.mjs" --set-netlify` with `STRIPE_SECRET_KEY` (creates/reuses the prices by `lookup_key sentinel_*`, sets the env) | **click needed** |
| `SENTINEL_LICENSE_SECRET` | every key (v1 + v2), device auth | already set (live evidence) | keep; never rotate without re-issuing keys |
| `SENTINEL_ADMIN_TOKEN` (or `ARIA_ADMIN_TOKEN`) | admin console, publish, `sentinel-licenses` admin actions | already set | keep |
| `SENTINEL_APPROVAL_SECRET` | signed Approve/Deny links (falls back to the license secret) | optional | fine as is |
| `RESEND_API_KEY`, `RESEND_FROM` | every customer/admin email (key delivery, session reports, notify) — `RESEND_FROM` must be on a **verified** Resend domain or delivery is owner-only | Resend → Domains | `RESEND_API_KEY` set; **verify the domain** |
| `ARIA_RECIPES_KILLED=1` (+ `ARIA_RECIPES_KILL_REASON`) | fleet-wide detect-only (recipes + heartbeat carry it) | emergency only | leave unset |
| `SENTINEL_UPDATE_HOSTS` | extra hosts a published binary `url` may use (comma list), e.g. `github.com,objects.githubusercontent.com` — only after the desktop allow-list grows | optional | leave unset until the desktop can reach the host |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | as before | set | keep |
| `INTERNAL_WEBHOOK_SECRET` | ARIA-web license issue (`stripe-confirm` → `aria-license`) — **not** on the Sentinel path (B21) | optional | — |
| `TWILIO_*` | SMS channel (dormant, reported honestly as not sent) | Ahmad's decision | — |

---

## 4. Stripe steps (Ahmad, ~10 minutes)

1. **Prices**: `STRIPE_SECRET_KEY=sk_live_… node "ARIA Sentinel/scripts/setup-stripe-sentinel.mjs" --set-netlify`
   (idempotent; prints `netlify env:set …` lines if run without `--set-netlify`). Lookup keys: `sentinel_personal_m`,
   `sentinel_pro_m`, `sentinel_business_y`, `sentinel_midsize_y`, `sentinel_enterprise_y`; each price carries
   `metadata.sentinel_tier` — both are what the webhook reads.
2. **Webhook endpoint**: Stripe → Developers → Webhooks → *Add endpoint*
   - URL: `https://iisupp.net/.netlify/functions/sentinel-stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.deleted`
     **+ (§7, P2-5) `customer.subscription.updated`, `invoice.payment_failed`, `invoice.paid`**
   - Copy the signing secret → Netlify env `STRIPE_SENTINEL_WEBHOOK_SECRET` → redeploy.
   The existing ARIA-web endpoint (`/.netlify/functions/stripe-webhook`) keeps its own `STRIPE_WEBHOOK_SECRET`.
3. **Smoke** (after deploy, read-only): `GET https://iisupp.net/.netlify/functions/sentinel-licenses?action=is-revoked&key-hash=<64×0>` must answer `200 {"revoked":false}` (today: 502). `GET …/aria-recipes` (the `/.netlify/functions/` path) must answer 200 with `killed:false`. Then Stripe → the endpoint → *Send test event* `checkout.session.completed` with `metadata.tier=sentinel_personal_m` and watch the function log for `minted:true`.

Customer flow after that: `/plans` SUBSCRIBE → Stripe → `/downloads/?checkout=success` (lane F4 renders "your key
is on its way to <email>") → webhook mints a **per-customer v2 key**, stores it, emails it → desktop paste →
`sentinel-resolve` → `plan/status`. Cancel in Stripe → `customer.subscription.deleted` → the key stops working at
the device's next license check (≤24 h; notify/approvals/session-report/check-in stop immediately).

---

## 5. Hand-offs to other lanes (not this lane's files)

- **Desktop (F2/F3)** — `ARIA Sentinel/src/main/main.mjs`:
  - heartbeat (`sendHeartbeat`, ~line 1044): add `"x-sentinel-key": licenseKeyHash()` to the POST headers so the
    fleet record is written (the directive works without it already).
  - `openPlanCheckout` fallback `https://iisupp.net/aria-sentinel/` now 302s to `/plans/`; point it at
    `https://iisupp.net/plans/?from=app&tier=<plan>` to skip the hop.
  - update feed (`auto-update.mjs buildFeedUrl` / `update-listener.mjs`): send the credential as the
    `x-sentinel-key` request header (`requestHeaders`) instead of `?license=<raw key>` — the server accepts both.
  - lowercase a pasted key before storing (the server tolerates an upper-cased paste for resolve/revocation, but the
    device credential `sha256(key)` would not match the record for notify/heartbeat).
  - No change is needed for v2 keys: they are 64 hex, so the four `/^[a-f0-9]{64}$/i` gates pass. Optional one-liner
    if the shared module should understand v2 itself: in `ARIA Sentinel/src/shared/license-features.mjs`
    `import { resolveAnyKey } from "../../../netlify/functions/lib/sentinel-license-v2.cjs";` (server-side use only —
    the desktop must never hold the secret).
  - version lockstep (B20): `recipes.mjs SENTINEL_VERSION = "0.1.16"` vs `package.json 0.2.0`.
- **Admin console** (`ARIA Sentinel/admin-console/index.html:93`): the Revoke confirm says "stops working within
  6 hours" — make it "stops notifications/approvals immediately; the desktop drops to the free tier at its next
  license check (within 24 hours)". The `revoke` response now returns `enforced` + `enforcement` text to show.
  New actions it can call: `setFlags`, `unrevoke`, `revokeKeyHash`.
- **Funnel copy** (`ARIA Sentinel/src/shared/sentinel-license-funnel.mjs customerEmail`): "ARIA Sentinel desktop
  ships on Windows within a month" must match the installer reality before the first sale.
- **Registry** (`ARIA Sentinel/tests/run-all.mjs`, being edited by another lane): `scripts/suite-census.mjs` is RED
  until the six `../../tests/sentinel-*.test.mjs` suites are registered (one line each; they are one-process safe).
- **Downloads page** (F4): render the `?checkout=success` state.
- **Binary hosting**: `public/sentinel-binaries/ARIA-Sentinel-0.1.0-unsigned.exe` (102 MB) is still tracked in git and
  ships in every deploy; the HELD rule now really blocks it. Host signed builds at `download.iisupp.net` (already on
  the desktop allow-list) and publish with `url` set.

---

## 6. Not finished / open risks

- **Seat enforcement** is a flag (`overSeats`) — no device is locked out server-side yet (§4(b) of the audit).
- **Rate limits** are per warm instance (`_rate-limit.js`) except resolve's Blobs counter; `sentinel-resolve-rl`
  entries now carry an `expires` metadata but nothing purges them (B16, P2).
- **Manifest signing** (B13) is not implemented — the feed is sha512 + a validated host, not a signature.
- `aria-kb-bundle` / `aria-recipe-feedback` (declared by the desktop) still do not exist (audit §2 #15/#16; not in
  this lane's list).
- `config.path` arrays on `aria-recipes` / `aria-stop-codes` are the documented Netlify form; confirm with the first
  deploy's read-only GET (§4 step 3) — the fallback is a `netlify.toml` rewrite.
- `STRIPE_WEBHOOK_SECRET` fallback: if Ahmad pastes the Sentinel signing secret into the shared variable instead of
  `STRIPE_SENTINEL_WEBHOOK_SECRET`, Sentinel verifies and ARIA-web breaks — use the dedicated name.
- The ARIA-web `stripe-webhook.js` still requests strong consistency (`:185,:207`) — outside this lane's remit
  (only touched if the secret split needed it; it did not).

---

## 7. Review fixes (2026-10-14, evening)

An independent review of §1–§6 found ship-blocking defects and proved each with a proof-of-concept script. Every item
below is fixed in `netlify/functions/**` (+ the funnel copy and a new public-key module in `ARIA Sentinel/src/shared/`),
has a regression test in the root guard suites, and its PoC no longer demonstrates the defect (table at the end).

### P0-1 — a $1 one-time checkout minted an Enterprise key (and an Enterprise ARIA-web license)
- `stripe-checkout.js`: a one-time (`priceData`) session no longer copies the client's `body.tier` into
  `metadata.tier`; it records the priced item id (what `library-download` reads), and an id that names a subscription
  tier (`sentinel_*`, `pro`, …) is recorded as `one-time`. The Stripe client is lazy with a `_setStripeFactory` seam;
  `exports._plans` exposes the server's own `PRICE_MAP` read backwards (`subscriptionTierForPriceId`).
- `sentinel-stripe-webhook.mjs`: mints **only** for `mode === "subscription"` with `payment_status` `paid` /
  `no_payment_required` and a subscription in `active`/`trialing`. The plan comes from the **subscription's price**
  (retrieved with the Stripe SDK): `lookup_key` → price `metadata.sentinel_tier` → `PRICE_MAP` → the server-set
  `subscription_data.metadata.tier` — never the session metadata. The `subscription_id = session.id` fallback is gone.
- `stripe-confirm.js`: an ARIA-web license is issued only for a paid **subscription** session, for the tier its price
  maps to in `PRICE_MAP`; a one-time session → `422 not-an-aria-subscription` (nothing issued); an unknown price → no
  license, the owner is paged.
- Tests (`tests/sentinel-stripe-webhook.test.mjs`): `[review P0-1] a $1 one-time checkout naming an Enterprise tier mints
  NOTHING` (→ `{skipped:"not-a-subscription"}`, no email) · `a real subscription whose price lookup_key is sentinel_pro_m
  → a PRO key … even though metadata says enterprise` · `[review P0-1] stripe-confirm …`.

### P2-1 — the Walk-Through (homepage: "Includes a 30-day ARIA Sentinel trial") granted nothing
- Checkout marks the catalogue-priced `ai-setup-walkthrough` session server-side: `metadata.product =
  "ai-setup-walkthrough"` (`product` is not a client-settable meta key). The fixed-price `walkthrough` tier gets the same.
- The webhook recognises it **only** by that server-set marker (+ paid, + pre-discount subtotal ≥ the 700000-cent
  catalogue price when Stripe sends it) and mints a per-customer **trial key**: new plan code **`07 trial`**
  (`lib/sentinel-license-v2.cjs issueTrialKey`) whose expiry (purchase + 30 days) sits *inside* the HMAC-covered key —
  it cannot be extended without the secret and resolves with no store read. The record (`tier:"trial"`,
  `walkthroughEntitled:true`, `expires_at`, `trialEndsAt`) and key index are written, the entitlement is stored under the
  lowercased buyer email (`sentinel-walkthrough-entitlements`, with a key **hash**, never the key), and the key is
  emailed with honest trial copy (`sentinel-license-funnel.mjs trialCustomerEmail`: Pro features until the date, then
  the Walk-Through stays and the rest drops to the free tier; nothing renews or charges).
- `sentinel-resolve` honours `expires_at`: a live trial key → `plan:"pro", status:"active"`; after expiry →
  `plan:"free", status:"expired"`, `walkthroughEntitled:true` either way. `addManual` refuses `tier:"trial"`.
- Tests: `[review P2-1] the AI Setup Walk-Through grants its 30-day trial (the p2-walkthrough-dead.mjs shape)` (webhook
  suite) · `[review P2-1] the time-boxed trial key` (`tests/sentinel-store-and-keys.test.mjs`).

### P2-2 — `sentinel-resolve` unlocked Pro + a permanent Walk-Through for any key + a buyer's email (and was a buyer oracle)
- The request body's `email` is never read. Entitlement comes only from the key: a trial key's plan code, or the
  key's own key-index record (`walkthroughEntitled` / `trialEndsAt`). Known, unknown and absent emails get identical
  answers. Test: `[review P2-2] resolve never reads a caller-supplied email` (`tests/sentinel-resolve-and-licenses.test.mjs`).

### P1-2 — the recipient binding was bypassable; the rate limit was per instance and keyed by a caller-chosen `device`
- Recipients (`lib/sentinel-license-records.cjs isAllowedRecipient` / `isAllowedPhone`) = the **Stripe buyer email** on
  the license record + **admin-approved contacts/phones** + the **admin inbox** (`ahmad.wasee@iisupp.net`,
  `integrateditsupp@gmail.com`, + `SENTINEL_ADMIN_INBOX`). A same-domain colleague no longer counts. A **v1 shared plan
  key** (detected by derivation, even if a legacy record holds it) or a credential with **no record** may name the
  admin inbox only. Applies to `aria-sentinel-notify` (email **and** SMS phones) and `sentinel-session-report`.
- `aria-sentinel-license-register`: a declared email is stored as **pending** (`pending_contacts` on the device
  record) and answered `contact.status:"pending-admin-approval"`; it is never a recipient until an admin approves it.
- **New admin action** `POST /.netlify/functions/sentinel-licenses?action=approve-contact` (admin token, as every other
  action) — body `{ "key_hash": "<sha256(key)>" | "subscription_id": "<id>", "email"?: "…", "phone"?: "…" }` →
  `200 { ok, subscription_id, approved:{email,phone}, contact_approved_at, contacts, contact_phones, indexed,
  pendingCleared }`. It adds the address to the record's approved contacts (and `contact_approvals` audit list),
  records `contact_approved_at`, refreshes the key index and clears the address from the device's pending list.
  `409 shared-plan-key` for a v1 shared key, `404 no-license-record` for a credential without a record, `400` for a bad
  address. `setFlags` also accepts `contact_phones`.
- Rate limits are per **credential** (never per `device`): the in-memory 30/10 min burst guard stays, and a **durable
  Blobs limiter** (`lib/sentinel-store.cjs durableLimit`, store `sentinel-rate-limits`, key `rl/<scope>/<hour#>/<hashed
  id>`) caps notify at `SENTINEL_NOTIFY_PER_HOUR` (default 20) per credential and `SENTINEL_NOTIFY_GLOBAL_PER_HOUR`
  (default 200) overall, and session reports at `SENTINEL_SESSION_REPORTS_PER_HOUR` (10) / `…_GLOBAL_PER_HOUR` (100).
  The limiter **fails closed**: store unreachable → `503 rate-limiter-unavailable`, nothing sent.
- Tests: `[notify] REVIEW P1-2: the reviewer's p1-notify-relay.mjs scenario — 403 on the victim, 200 only for the buyer,
  durable limit` (100 posts with rotating device ids → 20 accepted, 80 × 429) and the binding/limit blocks in
  `tests/sentinel-notify-binding-and-contracts.test.mjs`, `tests/sentinel-session-report.test.mjs`,
  `tests/sentinel-fleet-endpoints.test.mjs`, `[review P1-2] approve-contact …` (resolve/licenses suite).
  `tests/aria-sentinel-notify.test.mjs` now delivers through a per-customer key (a shared v1 key → admin inbox only).

### P1-3 (server half) — signed license verdicts + a server-anchored trial
- Every `200` from `sentinel-resolve` carries
  `verdict = { key_sha256, plan, status, seats, expires_at, verified_at, device }` — keys in exactly that order;
  `seats`/`expires_at` may be `null`; `device` = the `X-Sentinel-Device` request header (or `""`); `status` ∈
  `active | revoked | expired | past_due`. With `SENTINEL_RESOLVE_SIGNING_KEY` set it also carries
  `sig = base64url(Ed25519.sign(JSON.stringify(verdict)))`; without it the answer has no `sig` and says
  `"signing":"unconfigured"` (the desktop must treat the verdict as unsigned/short-lived). A set-but-unparseable key →
  `500 {status:"server-misconfigured", signing:"misconfigured"}` (fail closed). When the revocation store could not be
  read the answer stays available but is left unsigned, `"signing":"withheld"` — a signed (24-hour) "active" is never
  issued for a key whose revocation was not checked. The key is never logged or echoed.
- The payload is built by `ARIA Sentinel/src/shared/sentinel-resolve-pubkey.mjs verdictPayload()` — the same module the
  desktop verifies with (`verifyResolveSignature(verdict, sig)` against the embedded
  `SENTINEL_RESOLVE_PUBKEY_SPKI_B64 = MCowBQYDK2VwAyEABJ3c5Hwd7rykf6NHfGnwJslUjQJNKEKQxuZq2jmcP7g=`), so the two cannot drift.
- `sentinel-resolve` and `aria-sentinel-heartbeat` (keyless pings included) record the first time a device was seen —
  store `sentinel-trial-anchors`, key `trial-anchor/<X-Sentinel-Device>`, value `{ first_seen_at }` and nothing else —
  and return it as `trialStartedAt` (ISO). An anchor is never overwritten; a non-hash device value (e.g. the desktop's
  fallback `"device"`) is never anchored; new anchors are capped at 30 per IP per hour per instance on the heartbeat; a
  store blip → `trialStartedAt:null`, never an invented date.
- Tests: `[review P1-3] every 200 carries the verdict …` and `[review P1-3] server-anchored trial …` (resolve suite —
  signed with a **throwaway** in-test keypair; the production private key is not in the repo and was not used),
  `[review P1-3] the app's verdict verifier — embedded public key + a throwaway round-trip` (store/keys suite),
  `[heartbeat] REVIEW P1-3 …` (fleet suite).

**`SENTINEL_RESOLVE_SIGNING_KEY`** (Netlify → Site settings → Environment variables; *Functions* scope; secret) — the
Ed25519 **private** key that signs resolve verdicts, PKCS#8 DER, base64. The public half is compiled into the desktop
(`SENTINEL_RESOLVE_PUBKEY_SPKI_B64` above) and **must match** it, or every signed verdict fails verification on every
desktop. The embedded public key belongs to a key pair generated outside this repo: set the env var to *that* pair's
private key. To check a candidate private key against the embedded public key (prints only the public half):

```sh
SENTINEL_RESOLVE_SIGNING_KEY='<base64>' node -e 'const c=require("crypto");const k=c.createPrivateKey({key:Buffer.from(process.env.SENTINEL_RESOLVE_SIGNING_KEY,"base64"),format:"der",type:"pkcs8"});console.log(c.createPublicKey(k).export({format:"der",type:"spki"}).toString("base64"))'
```

To generate a NEW pair (then put the printed public key into `sentinel-resolve-pubkey.mjs` and ship a desktop build —
until that build is out, installed desktops cannot verify the new signatures):

```sh
node -e 'const c=require("crypto");const {publicKey,privateKey}=c.generateKeyPairSync("ed25519");console.log("SENTINEL_RESOLVE_SIGNING_KEY="+privateKey.export({format:"der",type:"pkcs8"}).toString("base64"));console.log("SENTINEL_RESOLVE_PUBKEY_SPKI_B64="+publicKey.export({format:"der",type:"spki"}).toString("base64"))'
```

Never commit, paste into chat, or log the private key. Unset → resolve still answers (unsigned, `signing:"unconfigured"`).

### P2-3 — `is-revoked` scanned every record on a miss (2,002 Blobs reads for one anonymous request at 2,000 records)
- O(1) by key hash only: the revocation entry + the key's own index entry; a miss is `{revoked:false}` with no scan
  (the legacy record scan is removed). Either store unreadable → `503` (never a guessed answer). Durable limit: 120 per IP
  and 60 per key-hash per hour (fail closed). The response literal `return json(200, { revoked })` and the
  before-the-admin-gate position are unchanged (the app's `admin-licenses-tab` test reads them).
- Test: `[review P2-3] is-revoked: O(1) by key hash, no scan on a miss, durable per-IP / per-key limit` (≤ 4 reads, 0 lists).

### P2-5 — the subscription lifecycle was ignored
- `customer.subscription.updated`: `past_due` / `unpaid` / `canceled` / `incomplete_expired` → the record is revoked with
  `revoked_reason:"stripe:subscription.<status>"`, the key index flips and the revocation entry is written (a failed entry
  write is a 503 so Stripe's retry finishes it). Back to `active`/`trialing` after `past_due`/`unpaid` → **restored**
  (entry cleared); `canceled`/`incomplete_expired`/admin revocations stay revoked. A **price change** → the old key is
  revoked (entry + index) and a new key is minted for the new price (`seed = <subscription>#g<generation>`, so a later
  change back never reuses a revoked key) and emailed once (`planChangeEmail`); an interruption leaves
  `plan_change_pending` on the record and the retry resumes it. A subscription that was `incomplete` when created is
  minted on its first `active` update. A record holding a shared v1 key is never cut off from a lifecycle event (logged).
- `invoice.payment_failed` → `payment_failed_at` (the first failure kept) on the record + key index; `sentinel-resolve`
  reports `status:"past_due"` once it is 7 days old. `invoice.paid` / `invoice.payment_succeeded` / an `active` update
  clear it. Both the pre-2025 `invoice.subscription` and the newer `invoice.parent.subscription_details` shapes are read.
- Duplicate completion events (`checkout.session.completed` + `customer.subscription.created` land together; Stripe
  redelivers on timeouts) are serialised by a one-writer claim (`lib/sentinel-store.cjs claimOnce`, store
  `sentinel-mint-claims`): a conditional create when the Blobs client supports `onlyIfNew` (≥ 8.x), otherwise
  write → wait `SENTINEL_CLAIM_SETTLE_MS` (default 250 ms) → read back. The loser answers `409` (logged) and Stripe's
  retry finds the record (`idempotent`); a finished holder answers `idempotent` at once.
- **Interaction to decide (Ahmad):** Stripe flips a subscription to `past_due` on the *first* failed renewal, at the same
  moment `invoice.payment_failed` fires — so with `past_due → revoke` (as specified) the key is cut off immediately and
  the 7-day `past_due` verdict is only reached when `customer.subscription.updated` is not delivered. If a grace period
  is wanted, drop `past_due` from `REVOKE_SUB_STATUSES` in `sentinel-stripe-webhook.mjs`; the 7-day verdict then applies.
- Tests: `[review P2-5] subscription lifecycle …`, `[review P2-5] invoice.payment_failed → past_due after 7 days …`,
  `[review P2-5] concurrent duplicate completion events → the key is emailed ONCE` (both claim modes).

### P2-9 — the revocation copy
`REVOCATION_EFFECT` now reads: "Notifications and approvals stop at once; the desktop drops to the free tier at its
next license check (within 1 hour when the verdict is unsigned, within 24 hours when signed)." — returned by revoke,
`revokeKeyHash` and the Stripe paths. The admin console's Revoke confirm (`ARIA Sentinel/admin-console/index.html`,
the `data-lic-revoke` handler line) carries the same sentence (one-line change).

### Stripe / env / stores to add
- Stripe → the Sentinel webhook endpoint → add events **`customer.subscription.updated`, `invoice.payment_failed`,
  `invoice.paid`** (keep the three from §4).
- Env (all optional except the signing key for signed verdicts): `SENTINEL_RESOLVE_SIGNING_KEY` (above),
  `SENTINEL_NOTIFY_PER_HOUR`, `SENTINEL_NOTIFY_GLOBAL_PER_HOUR`, `SENTINEL_SESSION_REPORTS_PER_HOUR`,
  `SENTINEL_SESSION_REPORTS_GLOBAL_PER_HOUR`, `SENTINEL_ADMIN_INBOX`, `SENTINEL_CLAIM_SETTLE_MS`.
- New Blobs stores (created on first write, nothing to provision): `sentinel-rate-limits`, `sentinel-mint-claims`,
  `sentinel-trial-anchors`. Counters carry an `expires` field; nothing purges them yet (same as `sentinel-resolve-rl`).

### Hand-offs (not this lane's files)
- **Desktop (app half of P1-3, in progress by the app lane against the contract above):** send `X-Sentinel-Device` on
  the resolve POST; verify `sig` with `verifyResolveSignature` and require `verdict.key_sha256 === sha256(key)` and
  `verdict.device === deviceIdHash()`; treat **any status other than `active`** as not granting the plan (`expired`
  carries `plan:"free"`; `past_due` still names the paid plan); use `trialStartedAt` (resolve + heartbeat) to anchor the
  local trial. The shipped `refreshLicense` caches only `active`/`revoked`, so on an old build an expired/past-due verdict
  degrades through the cache's staleness tiers instead of at once.
- `tests/suite-census` stays green: every new regression test lives in the six existing root guard suites (a new root
  suite file would be UNEXPLAINED until registered in `ARIA Sentinel/tests/run-all.mjs`).

### Verification (this section)
- Root guard `node scripts/run-tests.mjs` → **15/15** (no new suite files: every regression test is in the six root guard
  suites). Suites: `sentinel-store-and-keys` 75 · `sentinel-resolve-and-licenses` 88 · `sentinel-session-report` 37 ·
  `sentinel-stripe-webhook` 79 · `sentinel-fleet-endpoints` 64 · `sentinel-notify-binding-and-contracts` 42 ·
  `aria-sentinel-notify` 52 · `aria-sentinel-approval` 41 — all green standalone and imported into one process in two
  orders (the app registry's mode). Also green: `function-gates`, `stripe-price-staging`, `netlify-function-externals`,
  `notify-lib`, and the app suites `sentinel-license-funnel`, `admin-licenses-tab`, `walkthrough-webhook-grant`,
  `sentinel-resolve`, `sentinel-licenses-api`, `heartbeat-endpoint`, `license-register`, `web-tier-contract`,
  `sales-copy-prices`, `customer-build-allowlist`, `record-dependency-declared` (+ 19 more that read these files or `src/shared`);
  `scripts/suite-census.mjs` → 0 unexplained. `node --check` on all 23 touched JS files: 0 failures.
- Reviewer PoCs, before → after (run against this tree):

| PoC | Before | After |
|---|---|---|
| `p0-one-dollar-enterprise` | `webhook 200 {"minted":true,…"tier":"enterprise"…}` → resolve `plan:"enterprise"` | `webhook 200 {"skipped":"not-a-subscription","mode":"payment"}` (no mail, so the script's next step finds no key) |
| `p0-stripe-confirm` | `200 {"license":"ARIA-ENTE-XXXX",…"plan":"enterprise","license_issued":true}` | `422 {"ok":false,"error":"not-an-aria-subscription","license_issued":false}` (aria-license never called) |
| `p1-notify-relay` | after check-in `200 … resend calls: [["victim@elsewhere.example"]]`; rotating devices `accepted: 100` | after check-in `403 … resend calls: []`; rotating devices `accepted: 0` |
| `p2-walkthrough-dead` | `{"skipped":"not-a-sentinel-plan"}`, `customer mail sent: false` | `{"walkthroughEntitled":true,…"tier":"trial"…}`, `customer mail sent: true` |
| `p2-resolve-email` | victim email → `pro walkthroughEntitled=true` | victim email → `personal walkthroughEntitled=false trialEndsAt=null` (same as no email) |
| `p2-isrevoked-amplification` | `Blobs reads for ONE request: 2002` | `Blobs reads for ONE request: 4` |
| `p1-local-license` | forged cache → `admin` | unchanged — the desktop half (verify `sig`, anchor the trial on `trialStartedAt`) belongs to the app lane; the server half it needs is above |
