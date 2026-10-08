# RUN-CU 2026-10-08 — Netlify functions security / reliability changelog

Branch `cc/run-cu-2026-10-08`. Executes the functions audit (`review-functions.md`, top-10 + §2–§9).
Scope touched: `netlify/functions/**`, `tests/**` (4 new suites), `package.json` (+lock), `sdk/node/index.js:76` (one line, as instructed), this file.
No pages, no `aria-brain.js`, no `netlify.toml`, no `ARIA Sentinel/**`. Nothing committed — all changes sit in the working tree.

Rules applied: **14** (never `ok:true` unless a provider/store confirmed), **15** (every endpoint, success shape and client-visible field kept; gates are additive and the old email-only path survives behind a toggle), **17** (value first: the customer-facing failure modes were fixed before the hygiene).

---

## 1. New shared helpers (`netlify/functions/lib/`)

| File | What it is |
|---|---|
| `lib/notify.mjs` | The ONE honest notification helper. `sendEmail({to,subject,html,text,replyTo,bcc,tag,from,attachments?,icalEvent?}) → {ok,id,provider,error,attempts,dormant?}` (Resend primary, lifted from `stripe-webhook.js` incl. the *checked* `onboarding@resend.dev` fallback; SMTP via nodemailer only when `SMTP_APP_PASSWORD` is set). `sendSms({to,body,tag}) → {ok,sid,dormant,error}` (Twilio block lifted from `aria-sms.js`; `{ok:false,dormant:true}` when unconfigured). `notify({recipients:[{email,phone,name,role}],subject,text,html,sms,tag,tenant})` → per-recipient results + ONE record in the `notify-log` Blobs store (key `YYYY-MM-DD/<id>`, hashed email/phone + status only — never bodies/addresses). Also `sanitizeEmailHtml()`, `sanitizeFrom()`, `hashIdentity()` (sha256 hex, 16 chars). |
| `lib/require-verified-email.cjs` | `requireVerifiedEmail(event, body, {email, scope})` → `{ok,email,via}` or `{ok:false,status,error,hint}`. Accepts (a) a magic-link token (`body.token`/`sessionToken`/`session_token`/`X-ARIA-Session-Token`) whose email equals the acted-on email, (b) the 12-h **session token** `aria-magic-link verify` now mints, (c) an Aperture JWT (`_verify-bearer.cjs`; `role:'admin'` may act on any email). Escape hatch `ARIA_ALLOW_EMAIL_ONLY_ACCOUNT_ACTIONS=1` restores email-only (loud warning on every use). Exports `signToken`/`verifyToken` (same HMAC scheme as `aria-magic-link.js`). |
| `lib/admin-gate.cjs` | `requireAdminToken(eventOrRequest, {envNames, body, allowBodyToken})` — constant-time (`crypto.timingSafeEqual`, length-safe), **503 `not-configured` when no expected token exists (never fail-open)**, 401 otherwise. Reads `X-Admin-Token`, `X-ARIA-Admin-Token`, `X-Internal-Token`, `X-Sentinel-Admin-Token`, `X-ARIA-Tool-Secret`, `Authorization: Bearer <raw>`, and body `admin_token`/`internal_token`/`token` (never the query string). Works with legacy `event` and Fetch `Request`. |
| `lib/contacts.cjs` | `OWNER_EMAIL`, `SUPPORT_EMAIL`, `SALES_EMAIL`, `ESCALATION_EMAILS`, `SUPPORT_PHONE`, `SUPPORT_TEL`, `BRAND` from env (`FOUNDER_EMAIL`/`ORDER_NOTIFY_EMAIL`, `SUPPORT_INTERNAL_EMAIL`/`SUPPORT_EMAIL`, `SALES_NOTIFY_EMAIL`, `ESCALATION_EMAILS`, `SUPPORT_PHONE`/`SUPPORT_TEL`) with the previous literals as documented defaults. Only files touched in this run import it (no mass edit of the other ~40). |
| `lib/cors.cjs` | `corsHeaders(event)` / `corsOrigin(event)` — echoes the request Origin only when it is `https://iisupp.net`, `www`, the deploy URL (`URL`/`DEPLOY_PRIME_URL`/`DEPLOY_URL`) or `ARIA_CORS_EXTRA_ORIGINS`; otherwise `https://iisupp.net`. |
| `lib/user-data.mjs` | `listStoresFor(email,{phone,getStore})`, `purgeUserData(email,{phone,dryRun,getStore})`, `loadTombstones()`, `isTombstonedKey()`. Covers `aria-sessions` (meta scan → session ids + phone), `aria-session-memory`, `aria-cross-device` (hash keys), `aria-learning` (by linked session id), `aria-traces` (rewrites the single `log` without the person), `aria-leads`, `aria-bookings`, `aria-calls` (by phone), `aria-tickets` (+ index patch), `aria-licenses` (`by-email/` + token record). Tombstones (`aria-deletion-log`, `tomb-<hash>-<ts>`) hold hashed keys/identity only. |

---

## 2. Files changed — what / why

### P0 — "email = auth" account endpoints (audit #1)
`aria-billing-portal.js`, `aria-invoice-download.js`, `aria-plan-change.js`, `aria-account-delete.js`, `aria-data-export.js`, `aria-tenant-tier-detect.js`, `aria-session-memory.js` (`load` + `clear`; `save` stays open/write-only so the auto-save keeps working — nothing can be read back without proof).
- Each calls `requireVerifiedEmail` right after email validation → `401 {ok:false,error:'verification_required',hint}` without proof. Success shapes unchanged. Toggle: `ARIA_ALLOW_EMAIL_ONLY_ACCOUNT_ACTIONS=1`.
- CORS narrowed via `lib/cors.cjs` (plan-change/account-delete/data-export were `*`); `Authorization` + `X-ARIA-Session-Token` allowed.
- `aria-billing-portal.js`: `return_url` open redirect closed (own origins / relative only); `detail: e.message` → fixed `error_code`.
- `aria-invoice-download.js`: `invoice_id` format-checked; error detail scrubbed.
- `aria-plan-change.js`: 500 body no longer echoes `e.message`; log line redacts the email.
- `aria-account-delete.js`: now actually erases — `purgeUserData()` across every store, response adds `stores_purged`, `keys_purged`, `purge_errors`, `tombstone`, `verified_via`, `confirmation_email_sent`; Stripe subscriptions are listed explicitly (search results never carried them); customer/ops mail via `lib/notify.mjs` with wording that matches what happened (no "records actioned" when a step failed).
- `aria-data-export.js`: adds `server_side_data.stores` (the person's stored content, licenses masked) + `stores_exported`; audit log uses a hashed email; contact from `contacts.cjs`.
- `aria-tenant-tier-detect.js`: `e.message` → fixed `error_code`.

### P1 — admin / privileged surfaces
- `aria-mrr-dashboard.js`: Aperture JWT **or** admin token (`body.admin_token` — exactly what `revenue-dashboard.html` already sends — or `X-Admin-Token`) vs `ARIA_ADMIN_TOKEN | APERTURE_ADMIN_PASSWORD | ADMIN_PASSWORD`; CORS → own origins; 500 body scrubbed.
- `aria-m365-graph.js` (audit #3): every action except `health-check` needs an Aperture JWT or admin token; CORS → own origins; Azure token-endpoint bodies logged, not returned.
- `aria-m365-graph-write.js` (audit #3): `request` + `execute` gated the same way; **`execute` loads `action`/`params` from the approved `aria-write-gate` record (read straight from Blobs), claims it (`executing`), runs it, marks it `executed` — one approval fires once; caller-supplied action/params are ignored**; approvals expire at `ttl_at`; every Graph path segment URL-encoded + charset-checked, SKU ids must be GUIDs; upstream bodies never returned.
- `aria-trace.js` (audit #5): GET/DELETE need an Aperture JWT or admin token; POST needs `X-Internal-Token` (= `INTERNAL_WEBHOOK_SECRET`, which `aria-chat.js` now sends) or admin token; stored trace shape whitelisted + capped; `detail` scrubbed. GET/DELETE response shapes unchanged. (The browser-side trace POST in `aria.html` is now a silent 401 — that unauthenticated write was the log-poisoning half of #5; the server-side emit from `aria-chat.js` keeps the Aperture feed alive.)
- `aria-license.mts` (audit #2): `issue` requires `X-Internal-Token` (`INTERNAL_WEBHOOK_SECRET`) or `ARIA_ADMIN_TOKEN`, checked before any storage; tokens from `crypto.randomBytes` (32-symbol alphabet, same `ARIA-XXXX-XXXX-XXXX-XXXX` shape); `verify` returns `email` **masked** (`d***a@domain` — `assets/aria-trial.js` keeps deriving the company from the domain) plus `email_domain`; by-email key normalised/guarded.
- `aria-magic-link.js` (audit #4): link host from `process.env.URL`/`DEPLOY_PRIME_URL` only; per-token nonce (`jti`) stored in Blobs (`aria-magic-link` store) and consumed on `verify` (response `single_use_enforced`); rate limit 5/15 min per IP + 3/15 min per email; `verify` additionally returns `session_token` + `session_expires_at` (12 h) that the account endpoints accept; mail through `lib/notify.mjs` — `ok:false, error:'email_delivery_failed'` (502) when nothing was delivered.

### Fail-open gates and literal secrets (audit §7)
| File | Before | Now |
|---|---|---|
| `aria-tenant-offboard.js` | `body.internal_token === undefined` passed when env unset | `requireAdminToken` (INTERNAL_WEBHOOK_SECRET / ARIA_ADMIN_TOKEN / APERTURE_ADMIN_PASSWORD / ADMIN_PASSWORD), 503 when none |
| `aria-analytics-dashboard.js` | `if (ADMIN_TOKEN() && …)` → open when unset | `requireAdminToken`, 503 when none |
| `aria-sms.js` | open when `ARIA_TOOL_SECRET` unset; `ok:true` when Twilio dormant | 503 when unset, constant-time; sends via `notify.sendSms`; dormant → `200 {ok:false,sent:false,dormant:true}` |
| `aria-caller-lookup.mts` | open when `ARIA_TOOL_SECRET` unset | 503 when unset, constant-time |
| `aria-stripe-pilot-events.js` | unsigned accepted when secret unset; `timingSafeEqual` could throw | 503 when unset; length-safe; 5-minute timestamp window |
| `aria-session-recording-hook.js` | `return true` when unconfigured | 503 when unset; `t=,v1=` or bare-hex signatures; length-safe |
| `aria-mesh-task-queue.mjs` | `if (!want) return true` | `BRIDGE_TOKEN` required, constant-time |
| `aria-write-gate.js` | `'changeme-dev-only'` | no literal; 503 when `ARIA_GATE_SECRET`/`APERTURE_JWT_SECRET` unset; approval page + email HTML-escaped; alert via `notify` (logs loudly when the approval mail did not go out); `ARIA_GATE_ALERT_TO` default from `contacts.cjs` |
| `aria-cross-device-sync.js` | `'changeme-dev'` | no literal; 503 when `APERTURE_JWT_SECRET` unset |
| `aria-slack-install.js` | `'dev-only'` | no literal; 503 when `SLACK_STATE_SECRET`/`APERTURE_JWT_SECRET` unset |
| `aria-guided-fix.mjs` | `'CHANGE_ME_IN_NETLIFY_ENV'`; `!==` compare | no literal; `audit` → 503 when `ARIA_AUDIT_SECRET` unset; constant-time verify |
| `forums-threads.js` | static salt `'forums-mvp-static-salt-v1'` | on Netlify every write op → 503 `not-configured` unless `FORUMS_HASH_SALT`/`APERTURE_JWT_SECRET` is set (the literal can no longer reach the live store); the pure core keeps a dev-only salt so `tests/forums-mvp.test.mjs` still runs offline |

### Payments (audit #8)
- `stripe-checkout.js`: `ONE_TIME_CATALOGUE` / `CATALOGUE_FULL_PRICE` / `BOOKS` — every amount copied from the page that renders the button (`index.html` data-stripe-id + data-buy-options, `services.html`/`purchase-tech.html` SKUs, `shop.html` finder's fee, `assets/iis-catalog.js` products/bundles/inventory/books). Known id → server amount (client disagreement logged); `<id>-peek` → 30 %; book ids → recomputed `item + delivery + $40 + 15 % + add-ons` and the fee breakdown in metadata is the server's; `finder-*` → $40; anything else (concierge deposits depend on the shopper's budget) keeps the client amount **clamped to [$1.00, $30,000]** and logged `unlisted-price`. `metadata.kind` is server-decided (`book-order` only for catalogue books); client `meta` keys allow-listed. `successPath` must match `/^\/(?!\/)/` with no backslash/whitespace/control chars; origin comes from the own-origin allow-list / `process.env.URL`, never a raw `Origin` header. PRICE_MAP lines untouched (`tests/stripe-price-staging`, `currency-consistency` green). Pure helpers exported as `_pricing` for tests.
- `stripe-confirm.js`: sends `X-Internal-Token` to `aria-license`; idempotent via Blobs `stripe-confirm` store key `confirmed-<session.id>` (replays return the stored result with `replayed:true` — no second license, no second email); `session_id` format-checked; internal call to `process.env.URL`; welcome mail via `notify.sendEmail`; response adds `license_issued`, `license_error`, `welcome_email_sent`; when a license could not be minted the owner gets an `[ACTION]` email.
- `stripe-webhook.js`: dedupe by `event.id` (Blobs `stripe-webhook-events`; duplicates → `200 {received:true,duplicate:true}`); `customer.subscription.deleted` now revokes `aria-licenses by-email/<email>` (`active:false`, `revokedAt`, `revokedReason`); all mail via `notify` (true only on provider confirmation); META from `contacts.cjs`. The `currency = (invoice.currency || 'usd')` line is unchanged (currency-consistency reads it).

### Silent production failures (audit #9)
- `aria-escalation.mjs`: escalation/resolved/internal mail sent **directly** through `lib/notify.mjs` (no 401 round trip through `aperture-email-report`); results awaited and returned (`notify` on the response, `ticket.notify` persisted); internal copy goes to `contacts.ESCALATION_EMAILS` (env `ESCALATION_EMAILS` → `SUPPORT_INTERNAL_EMAIL` → support inbox — previously nobody was mailed unless the env was set); `ariaScript.goodbye` no longer promises an email that did not go out; research calls use `process.env.URL`; ticket ids from `crypto.randomInt`; 500 body scrubbed.
- `aria-renewal-reminders-cron.mjs` (**new**): `export const config = { schedule: '0 14 * * *' }`, beats the existing `aria-renewal-reminders` heartbeat name, calls the exported `runScan()`.
- `aria-renewal-reminders.js`: logic extracted to `exports.runScan`; HTTP path now gated (Aperture JWT or admin/internal token); mail via `notify`; **the Stripe "sent" stamp is written only when delivery was confirmed**; `failed[]` reported; CORS → own origins; 500 scrubbed.
- `aria-scheduled-tasks-audit.js`: registry entry for the renewal scan updated to `0 14 * * *` (via the cron wrapper) so the self-audit is honest.
- `aria-winback-cron.js` → **renamed `aria-winback-draft.js`** (function-name collision with the scheduled `aria-winback-cron.mjs`); `sdk/node/index.js:76` → `winbackScan()` posts to `aria-winback-draft`.
- `aria-session-end.mjs`, `aria-contact-back.mjs`, `aria-health-lead.mjs`: SMTP-only → `lib/notify.mjs` (Resend first, SMTP fallback, `.ics` attached on both paths); records persisted first; **`202/502 {ok:false, emailSent:false}` when nothing was delivered** (was `202 {ok:true, queued:true}` with nothing queued); session/blob keys charset-guarded; contact-back validates date/time (was an unhandled 500) and escapes `date`/`time`/link; health-lead sets `replyTo` to the prospect and reports `stored`/`delivered`/`owner_notified`.
- `package.json`: `bcryptjs ^3.0.3` added (`aria-admin-auth.js` always returned 401 without it); `aria-admin-auth.js` username compare made length-safe (`timingSafeEqual` threw on mismatch → 500 + length oracle).
- `aria-lead-capture.js`: lead persisted to Blobs `aria-leads` (`lead/<ts>_<hash16>`) **before** any email; mail via `notify`; on owner-alert failure → `{ok:false, stored, delivered:false, confirmation_sent, error, message, fallback:{email,phone}}`; success shape unchanged (+ `stored`, `delivered`, `confirmation_sent`); log line uses a hashed email.

### Privacy (audit #10)
- `lib/user-data.mjs` (above) wired into `aria-account-delete.js` (`stores_purged`) and `aria-data-export.js` (`stores`/`stores_exported`).
- `aria-backup-cron.mjs`: loads erasure tombstones and skips matching keys (`skipped_tombstoned` in the run report); digest mail via `notify` (`digest_email: sent|dormant|failed`); founder address from `contacts.cjs`; `<` escaped in the digest.

### `aria-chat.js` (audit #6, §8 + VOICE MODE)
1. `sessionId` trusted only when it matches `/^[A-Za-z0-9_-]{16,80}$/`; otherwise a fresh `anon-<24 hex>` id is used and **the server-side context is never read or written** for it (the constant `web-2861` can no longer bleed turns between visitors). Trusted ids keep using `_conversation-context.js` as before.
2. Degraded (provider outage) branch returns `text` (= `reply`, kept), `emotion`, `tone`, `takeNotes`, `resolved:false`, `escalate:false`, `category:'other'`, `suggestions:[]` — so `aria.html`/`aria-core.js` show the honest copy instead of "empty reply".
3. `detail: err.message` removed → `error_code`; 502 no longer embeds the model name (`error_code: model_not_found|provider_auth|provider_overloaded|provider_http_<n>`).
4. **VOICE MODE**: `body.voice === true` appends the VOICE MODE block to the system prompt (asks for `speak` ≤ 55 words, spoken English, no markdown/lists/URLs/code, acknowledge → ONE step or ONE question, ends with a question or "tell me what you see"; `needs_input`; `listen`; `action {kind: guide|sentinel-fix|escalate|none, recipeHint}` with `sentinel-fix` only for desktop fixes such as flush DNS / restart print spooler / clear temp / restart audio service). The response **always** carries `speak`, `needs_input`, `listen`, `action` (defaults: first two sentences of `text` with markdown stripped, `!resolved`, `= needs_input`, `{kind:'none',recipeHint:null}`), in the success, offline and degraded branches. `escalation_reason` and `sessionId` are now returned too.
5. `body.platform` (string) / `body.device` ({os, app}) → one `User platform: …` line in the system prompt.
6. Internal fan-out (`aria-learn`, `aria-trace`) targets `process.env.URL` and carries `X-Internal-Token`; `max_tokens` 1500 → 2000; retry 3 → 2 attempts inside a 20 s breaker timeout (stays inside the 26 s function limit).

---

## 3. Environment variables

| Variable | Status | Used by |
|---|---|---|
| `INTERNAL_WEBHOOK_SECRET` | **NEW — required** (≥ 8 chars) | `stripe-confirm` → `aria-license issue`; `aria-chat` → `aria-trace` POST; `aria-tenant-offboard`; alt for `aria-sms`/`aria-caller-lookup`/`aria-renewal-reminders` HTTP |
| `ARIA_ADMIN_TOKEN` (or `SENTINEL_ADMIN_TOKEN` / `APERTURE_ADMIN_PASSWORD` per endpoint) | **NEW — required** for admin calls | `aria-mrr-dashboard`, `aria-m365-graph(-write)`, `aria-trace` GET/DELETE, `aria-analytics-dashboard`, `aria-renewal-reminders` HTTP, manual `aria-license issue` |
| `ARIA_ALLOW_EMAIL_ONLY_ACCOUNT_ACTIONS` | NEW toggle, default **off** | all 7 account endpoints (emergency only; logs a warning per use) |
| `APERTURE_JWT_SECRET` | existing — now required by | `require-verified-email`, `aria-magic-link`, `aria-cross-device-sync`, fallback for `aria-write-gate`, `aria-slack-install`, `forums-threads` |
| `RESEND_API_KEY`, `RESEND_FROM` | existing — `RESEND_FROM` must be a **verified-domain** sender | every email path (`lib/notify.mjs`) |
| `SMTP_APP_PASSWORD`, `SMTP_SENDER`, `SMTP_AUTH_USER`, `SMTP_HOST`, `SMTP_PORT` | existing, optional fallback only | `lib/notify.mjs` |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | existing names, dormant until set | `lib/notify.mjs sendSms`, `aria-sms` |
| `ARIA_TOOL_SECRET` | existing — now **required** | `aria-sms`, `aria-caller-lookup` (ElevenLabs tools) |
| `ARIA_AUDIT_SECRET` | existing — now **required** for audit tokens | `aria-guided-fix` |
| `ARIA_GATE_SECRET` | optional (falls back to `APERTURE_JWT_SECRET`) | `aria-write-gate` |
| `SLACK_STATE_SECRET` | optional (falls back to `APERTURE_JWT_SECRET`) | `aria-slack-install` |
| `BRIDGE_TOKEN` | existing — now **required** | `aria-mesh-task-queue` claim/done/fail |
| `STRIPE_PILOT_WEBHOOK_SECRET` / `STRIPE_WEBHOOK_SECRET`, `WHEREBY_WEBHOOK_SECRET` | existing — now **required** by their webhooks | `aria-stripe-pilot-events`, `aria-session-recording-hook` |
| `FORUMS_HASH_SALT` | optional (falls back to `APERTURE_JWT_SECRET`); one of them required on Netlify for forum writes | `forums-threads` |
| `FOUNDER_EMAIL`/`ORDER_NOTIFY_EMAIL`, `SUPPORT_INTERNAL_EMAIL`/`SUPPORT_EMAIL`, `SALES_NOTIFY_EMAIL`, `ESCALATION_EMAILS`, `SUPPORT_PHONE`/`SUPPORT_TEL` | optional | `lib/contacts.cjs` |
| `ARIA_CORS_EXTRA_ORIGINS` | optional (comma list) | `lib/cors.cjs` |

---

## 4. Needs Ahmad

1. **Netlify env**: set `INTERNAL_WEBHOOK_SECRET` and `ARIA_ADMIN_TOKEN` (long random strings). Until `INTERNAL_WEBHOOK_SECRET` exists, paid checkouts still complete but licenses are **not** auto-issued (response `license_issued:false` + an `[ACTION]` email to you) and the Aperture trace feed stays empty.
2. **`RESEND_FROM` on a verified domain** (resend.com/domains). With the onboarding fallback, customer mail only reaches the Resend account owner — the new helper reports it as `provider:'resend-onboarding'` so it is visible in logs/responses.
3. **Twilio = paid** — your approval before `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` go in. Until then every SMS path honestly reports `dormant:true`.
4. **Client pages must send a token** for account actions (`aria-data-export.html`, `assets/aria-session-memory-client.js`, the `account.html` flows, SDK `exportMyData/deleteMyAccount/changePlan`): a magic-link token or the `session_token` returned by `aria-magic-link verify` (`localStorage aria_session_token` is already the convention in `assets/forums.js`). Those files belong to other agents. If a live flow breaks before they catch up, flip `ARIA_ALLOW_EMAIL_ONLY_ACCOUNT_ACTIONS=1` — and flip it back.
5. `revenue-dashboard.html` keeps working: paste `ARIA_ADMIN_TOKEN` (or `APERTURE_ADMIN_PASSWORD`) into its token box as before.
6. SDK: `mrr()`, `renewalScan()`, `m365Graph()` now need a token (pass `admin_token` in the body or send `X-Admin-Token`); `winbackScan()` now posts to `aria-winback-draft`. `docs/openapi.json` still names `aria-winback-cron.js` (doc update is outside this run's scope).
7. Set `ARIA_TOOL_SECRET` (ElevenLabs tools), `ARIA_AUDIT_SECRET` (guided-fix links), `BRIDGE_TOKEN` (mesh poller), `STRIPE_PILOT_WEBHOOK_SECRET`/`WHEREBY_WEBHOOK_SECRET` (if those webhooks are live) — every one of these now fails **closed** (503) instead of open.
8. Renewal reminders now run at **14:00 UTC** daily (was: never).

## 5. Not done / deliberately left (with why)

- `aria-trace` still uses the single `log` key (read-modify-write races remain) — switching to one blob per trace would change the GET shape the Aperture dashboard reads (Rule 15). Writes are now authenticated and capped.
- `_conversation-context.js` stays in-memory per instance (audit §7 Blobs-backed memory) — the cross-user bleed is closed by the sessionId rule; durable memory is a product decision.
- `ARIA Sentinel/src/shared/sentinel-license-funnel.mjs` (per-customer HMAC keys, revoke-by-subscription) is outside this run's allowed paths.
- The 25 `APERTURE_ADMIN_PASSWORD` body-token gates were **not** mass-migrated; only touched files use `lib/admin-gate.cjs`.
- `_rate-limit.js` remains process-local (the durable Blobs limiter from `aria-abuse-report` was not promoted).
- `aria-escalation` `escalate/research/resolve` and `aria-write-gate request` remain unauthenticated public actions (P2 in the audit).

## 6. Tests

New suites (all offline, `fetch` mocked, no Blobs credentials):
- `tests/notify-lib.test.mjs` — 30 checks (dormant/failed paths never `ok:true`; onboarding fallback is checked; log holds hashes only).
- `tests/aria-chat-voice-contract.test.mjs` — 28 checks (voice fields + defaults, platform line, sessionId trust rule incl. the visitor-A/visitor-B bleed, honest degraded branch, internal token on the trace fan-out).
- `tests/function-gates.test.mjs` — 81 checks (admin gate never fails open; verified-email proofs; every gated handler 401/503 without proof; legacy shapes under the toggle; magic-link host/nonce/session token/rate limit; checkout catalogue; lead-capture honesty).
- `tests/user-data-purge.test.mjs` — 30 checks (export finds exactly the person; purge removes exactly that; index/log patched; tombstones carry no raw email; backup skip).

Verification: `node --check` on every touched `.js/.cjs`; every touched `.mjs` imported; `.mts` checked with `node --experimental-strip-types` and exercised (gate → 401/503/500 as expected).
`node scripts/run-tests.mjs --all` → **120/125** (baseline before this run on the same tree: 114/119). The 5 reds are the known environment-only axis suites (`axis-app-detect`, `axis-assistant-behaviors`, `axis-status-emitter`, `axis-windows-traps`, `axis-worker-offline`). No new reds.
