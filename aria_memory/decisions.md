# Decisions Awaiting Ahmad — opened 2026-05-06

Each item is a single yes/no or A/B. Reply in chat with the number + choice (e.g. "D1: B, D2: A, D3: skip").

---

## D1 — PayPal leak fix path (P0, revenue-impacting)

`index.html` is loading PayPal sandbox (`client-id=sb`). No real money is being collected on technical-service purchases.

**A.** Swap to PayPal live: I'll wire up env-var-driven client ID. You give me your PayPal live client ID (or business email + I'll guide you to retrieve it).

**B.** Replace PayPal flow with Stripe Checkout for technical services. One processor, one pipeline, less surface area. You'd create Stripe Products for each technical-service line item (~5 min in Stripe dashboard) and give me the price IDs.

**Recommendation:** B. Same pipeline as ARIA. Less to maintain.

---

## D2 — ARIA brain consolidation

We have two different ARIA prompts/contracts in the repo. Web chat only uses one. The other (better) one is unrouted.

**A.** Keep web on `aria.mts`, retire `aria-chat.js` for now (or save for ElevenLabs voice).

**B.** Merge `aria-chat.js`'s richer prompt (emotional intelligence, 25-year-pro mindset, customer-service framework) INTO `aria.mts`. Keep aria.mts's JSON contract for the web UI. Best of both.

**Recommendation:** B. Better answers without changing the UI contract.

---

## D3 — Voice agent activation (paid, ~$80/mo)

The voice-agent files (`aria-voice-agent/`) are paste-ready for ElevenLabs + Twilio. README estimates ~$80/mo at 100 calls × 5 min.

**A.** Defer. Build everything else first. Decide later.

**B.** Approve ~$80/mo cap for voice agent. I'll ship the missing webhooks, you sign up ElevenLabs + Twilio yourself, paste the prompt + KB files, connect the number.

**Recommendation:** A right now. Get the web product clean and revenue-flowing first. Voice agent is leverage but not the bottleneck.

---

## D4 — Health endpoint sanity check (you, 30 seconds)

I can't hit iisupp.net from my sandbox (egress blocked). Open this URL in your browser and tell me what it returns:

`https://iisupp.net/.netlify/functions/health`

Expected: `{"status":"ok","service":"ARIA","version":"1.4.0","time":"...","anthropic":true,"stripe":true}`

If `anthropic` or `stripe` is `false`, that env var isn't set in production and the corresponding feature is silently degraded.

---

## D5 — Daily digest delivery channel

Two daily digests (7am + 7pm local) are about to be scheduled. Where do you want them?

**A.** Email only (integrateditsupp@gmail.com).

**B.** Email + Cowork notification.

**Recommendation:** B. Cowork is faster to scan, email is the receipt trail.

---

## Standing items (no decision needed unless you disagree)

- I'll proceed with **Phase 1.2** (aria.mts → aria-learn) and **Phase 1.5** (uptime monitor) without further approval — they're zero-spend, zero-visual, fully reversible. If you want me to wait, say so.
- I'll keep all spend at $0 by default per `feedback_spend.md`. Any cost = explicit ask first.
