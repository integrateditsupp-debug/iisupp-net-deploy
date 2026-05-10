# ARIA Phase 1 Plan — Stabilize & Plug Leaks

**Budget:** $0 · **Visuals:** untouched · **All changes reversible via Netlify deploy rollback**

Phase 1 goal: fix the revenue-leaking bug, plug self-learning into the live brain, get continuous monitoring running, eliminate silent-failure footguns. **No new product, no visual change, no spend.**

---

## P1.1 — Kill PayPal sandbox leak on index.html (HIGHEST PRIORITY)

**Problem:** `index.html:16` loads `https://www.paypal.com/sdk/js?client-id=sb&...`. `sb` = sandbox. Every "purchase" through the technical-services PayPal modal is fake.

**Two clean options:**
- (A) Swap to live PayPal client ID via env var + small inline-script lookup. Requires Ahmad's PayPal live client ID.
- (B) Replace PayPal flow with Stripe Checkout for technical services (mirror the ARIA pattern). Requires creating Stripe Products/Prices for technical-service line items.

**Recommendation:** (B) — one payment processor, one license/billing pipeline, easier to scale. Stripe is already wired and battle-tested in this project. PayPal adds a second SDK, second integration, second reconciliation surface.

**Decision needed from Ahmad:** A or B? (See `decisions.md`)

**Cost:** $0 either way (PayPal/Stripe both take per-transaction %, no monthly fee).

**Visual change:** zero on (A). On (B), button label/host swaps but card layout untouched — pixel-stable for the user.

---

## P1.2 — Wire aria.mts (live web brain) to aria-learn

**Problem:** aria.html chat → `/api/aria` (aria.mts). aria.mts does NOT log to aria-learn. So the self-learning loop has zero web data.

**Fix:** add a fire-and-forget `fetch('/.netlify/functions/aria-learn', {...})` inside aria.mts after the response is composed, mirroring aria-chat.js pattern. ~15 lines of code. Reversible. Visual change: zero.

**Cost:** $0. Adds an extra free Netlify function invocation per chat turn.

---

## P1.3 — Decide ARIA brain consolidation

**Problem:** aria.mts and aria-chat.js are two brains with different prompts, different output contracts, different models.

**Options:**
- (A) Keep aria.mts as the only web brain. Retire aria-chat.js (or leave dormant for ElevenLabs reuse).
- (B) Adopt aria-chat.js's richer prompt (25-year-pro mindset, emotional intelligence) and merge into aria.mts. Keep aria.mts's web_search + JSON contract structure.

**Recommendation:** (B) — aria-chat.js's prompt is meaningfully better (emotional state detection, tone adaptation, customer-service framework). aria.mts has the right output contract for the web UI. Merging gives best of both. Net code change: ~50 lines in aria.mts.

**Decision needed from Ahmad:** A or B?

---

## P1.4 — Ship the missing voice-agent webhook stubs

**Problem:** `aria-sms`, `aria-call-summary`, `aria-caller-lookup` are referenced in tools-spec.json but not deployed. If voice agent goes live, tools fail silently.

**Fix:** add minimal stubs that:
- `aria-sms`: POST to Twilio's REST API `/2010-04-01/Accounts/{SID}/Messages.json` with `to`/`body`. Falls back to logging-only if Twilio env vars unset (so no error if not configured yet).
- `aria-call-summary`: receive ElevenLabs post-call webhook, store transcript in Blobs (`aria-calls` store), email summary via Resend to `SALES_NOTIFY_EMAIL`. HMAC-verify via `ELEVENLABS_WEBHOOK_SECRET` if set.
- `aria-caller-lookup`: query Blobs `aria-calls` for prior interactions by phone E.164. Return empty array if none.

**Cost:** $0 to ship the code (functions free until invoked at scale; Twilio per-message charges only when SMS actually sends).

**Note:** these don't ENABLE the voice agent — they just keep the tool-call surface from silently failing once it IS enabled. The user must still approve ElevenLabs + Twilio signups (estimated ~$80/mo) before flipping the voice agent on.

---

## P1.5 — Continuous uptime monitor (Netlify-native, free)

**Problem:** No automated uptime check.

**Fix:** add `netlify/functions/aria-monitor.mts` as a **scheduled function** (Netlify cron, free). Runs every 5 min. Hits `/.netlify/functions/health`. Tracks consecutive failures in Blobs (`aria-monitor` store). On 3 consecutive failures: send Resend email to `integrateditsupp@gmail.com` + write incident record. On recovery: send recovery email + close incident. Records every check (timestamp, status, latency) in `aria-monitor/checks/{date}.json`.

**Schedule via netlify.toml:**
```toml
[[plugins]]
[functions."aria-monitor"]
  schedule = "*/5 * * * *"
```
(Or, since `function_schedules: []` is empty in current deploy, configure via the function file's exported `config = { schedule: '*/5 * * * *' }`.)

**Cost:** $0. Netlify scheduled functions are free on `nf_team_pro` (already in place). Resend has free tier (3k/mo).

**Visual change:** zero.

---

## P1.6 — Friday review job (self-learning analysis)

**Problem:** aria-learn is collecting data, but no review pipeline distills weak responses into prompt fixes.

**Fix:** add `netlify/functions/aria-review.mts` as scheduled function (`0 9 * * 5` = Fri 9am). Reads last 7 days of aria-learning summaries + sample of low-resolution turns (resolved=false, escalated=true). Sends a Resend digest to integrateditsupp@gmail.com with: top 10 weakest interactions, top emotion/category trends, suggested prompt patches. **Does not auto-deploy prompt changes** — proposes them; Ahmad approves.

**Cost:** $0 (Netlify scheduled + Resend free tier + Anthropic API for the analysis call ~$0.05–0.20/week).

---

## Build Order (single PR per item, each independently shippable)

1. **P1.1 (PayPal leak)** — waits on Ahmad's A/B decision.
2. **P1.2 (aria.mts → aria-learn)** — can ship today, no decision needed.
3. **P1.5 (uptime monitor)** — can ship today, no decision needed.
4. **P1.4 (voice-agent stubs)** — can ship today, dormant until voice agent enabled.
5. **P1.3 (brain merge)** — waits on Ahmad's A/B decision.
6. **P1.6 (Friday review)** — depends on P1.2 landing first to ensure web data is being captured.

**Total Phase 1 net code change estimate:** ~600 lines across 6 files. ~3 hours implementation + test. Each PR: <100 lines, small, reviewable.

**Each ships behind:** uptime check + Netlify deploy preview before merge to production.

---

## Out of Scope for Phase 1 (Phase 2+)

- Voice agent activation (ElevenLabs + Twilio) — paid, requires explicit approval.
- ARIA mobile app / native — separate effort.
- Lead-gen pipeline integration to HubSpot — separate Phase.
- Pricing page A/B tests — risks visual change.
- Outbound sales sequencing for cold IT-support contracts — Hormozi-side outbound work, separate from product.
