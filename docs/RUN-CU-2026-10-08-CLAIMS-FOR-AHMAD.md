# RUN-CU 2026-10-08 — Public claims only Ahmad can verify

Source: the 2026-10-08 site audit (`review-site.md`, §3 "Honesty / claim risks") plus a repo-wide grep on
2026-10-08. Per the run packet, **none of this copy was changed**. The only copy edited this run is the
objectively fabricated data on `status.html` / `status-history.html` (hard-coded OPERATIONAL pills,
99.99 % / 11.4 s / <2 s / 24×7 literals, "for realism" amber days) — see `RUN-CU-2026-10-08-SITE-CHANGELOG.md`.

Rule 14 (real-or-empty) is the test for every row: keep the claim if it is true today, scope it if it is
true only for ARIA / contracted clients, or soften it ("typically") if it is an aspiration. Line numbers are
1-indexed in the files as of this run; a quick `grep -n` re-finds each if lines shift.

## A. 24/7 and coverage claims (founder-led firm — human coverage is the question, not ARIA's)

| # | File:line | Claim as published | What it implies | Suggested honest form if not true today |
|---|-----------|--------------------|-----------------|------------------------------------------|
| A1 | `index.html:2340`, `m.html:583` | "Call (647) 581-3182 · 24/7" (Service Center emergency row) | A human answers the phone at any hour | "Call (647) 581-3182 — business hours; after-hours on-call for contracted clients" |
| A2 | `index.html:2297`, `m.html:566` | "AI diagnostics · guided fixes · equipment · 24/7 live escalation" | Live (human) escalation around the clock | "… · 24/7 ARIA triage · human escalation in business hours / on-call for retainers" |
| A3 | `index.html:2494`, `m.html:690` | Tier 3 tagline: "24/7 monitoring, Major Incident Management, Six Sigma auditing, and named senior analyst." | A monitoring + incident capability staffed around the clock for Tier 3 | Keep only if monitoring tooling + on-call rota exist for Tier 3 clients; otherwise "monitoring with alerting, business-hours incident management + on-call" |
| A4 | `index.html:2504`, `m.html:700` | Tier 3 bullet: "24/7 monitoring & incident response" | Same as A3 | Same as A3 |
| A5 | `index.html:4302`, `m.html:1213` | Tier 3 mailto template: "☐ 24/7 Monitoring & Incident Response" | Same as A3 (prefilled into the buyer's email) | Match whatever A3 becomes |
| A6 | `index.html:3402` | "Installed Windows agent · resident, 24/7 · 100% on-device" (ARIA Sentinel) | The agent runs continuously on the device | Fine as a product statement if the agent is resident; note the Windows download is currently HELD (`netlify.toml` comment) — the page should not imply it is downloadable today |
| A7 | `m.html:8`, `m.html:10` | meta/og description: "ARIA, our 24/7 AI senior technician" | ARIA (not humans) answers 24/7 | True if ARIA chat is up around the clock — keep, it is scoped to ARIA |
| A8 | `m.html:941` | "Every employee gets 24/7 expertise." | ARIA availability | Keep if scoped to ARIA (it is in the ARIA section) |
| A9 | `m.html:958` | "…one AI senior tech, available 24/7." | ARIA availability | Keep (ARIA-scoped) |
| A10 | `ai-edge.html:509`, `shop.html:614` | Link text "ARIA — 24/7 AI Support" | ARIA availability | Keep (ARIA-scoped) |
| A11 | `shop.html:666` | "Your always-on AI IT assistant — triage, fixes and escalation, 24/7." | "escalation 24/7" implies a human path at any hour | "…triage and fixes 24/7; escalation to a human in business hours / on-call for retainers" |
| A12 | `commercial-real-estate.html:170` | "ARIA, our 24/7 AI helpdesk assistant" | ARIA availability | Keep (ARIA-scoped) |
| A13 | `verticals/finance.html:110`, `verticals/healthcare.html:110`, `verticals/legal.html:110` | Stat tile "24×7 — Always on, never on hold" | ARIA availability, presented as a stat | Keep if ARIA-scoped; the tile sits next to other stat tiles, so label it "ARIA availability" rather than a measured figure |
| A14 | `governance/information-security.html:124` | "Maintains an Incident Response Team (IRT) on call 24x7 for severity-1 and severity-2 incidents." and "A 24x7 monitoring capability — operated internally or through a managed detection & response (MDR) partner" | A formal policy commitment (procurement reviewers read these literally) | Keep only if an on-call rota / MDR contract exists; otherwise "on call during business hours with best-effort after-hours response" |
| A15 | `aria.html:2072` | Ops demo view tile: "Server monitoring — 24/7 ACTIVE" | Live monitoring is running | Owned by the aria.html agent this run (relabel as DEMO); listed for completeness |

Context rows (not claims — already honest, no action): `downloads/library/*-preview.html:136,180,195,205` explicitly say *no* 24/7 promises; `health-check.html:245,611` and `plans/index.html:207–627` use "24/7" as a buyer-chosen calculator input / multiplier, labelled as an assumption.

## B. Response-time and service-level promises

| # | File:line | Claim as published | Verify | If not reliably true |
|---|-----------|--------------------|--------|----------------------|
| B1 | `index.html:2469`, `m.html:667` | Tier 2 bullet: "Priority SLA — 1 hour response or less" | Is a 1-hour response contractually met today for Tier 2 clients? | "Priority response — 1 business hour target" |
| B2 | `index.html:4272`, `m.html:1211` | Tier 2 mailto template: "☐ Priority SLA — 1-hour response" | Same as B1 (prefilled into the buyer's email) | Match B1 |
| B3 | `index.html:2459`, `m.html:657` | Tier 2 tagline "Priority SLA, dedicated senior analyst, and disaster recovery planning baked in. **Most selected.**" | "Most selected" is a popularity claim with no public count | Drop "Most selected" or back it with a real count |
| B4 | `book.html:74` | "Ahmad will pick one of your time slots + send a calendar invite within 4 business hours." | Is a 4-business-hour turnaround kept? Note: `aria-lead-capture` returns `ok:true` even when email delivery fails (audit Top-10 #9) — the promise can be shown for a lead that never arrived | "…typically within one business day" until lead persistence is fixed |
| B5 | `aria.html:5958` | "Same-day reply, usually within hours." (founder card) | Same-day reply on every day, including weekends? | "Same business day, usually within hours" |
| B6 | `security/disclosure.html:68` | "Acknowledgement target: within 24 hours on business days, 72 hours otherwise" | Is `security@iisupp.net` (`.well-known/security.txt`) a monitored mailbox? | Keep the target wording ("target" is honest) once the mailbox is confirmed |
| B7 | `enterprise.html:163–164` | "Founder direct access for first 25 customers … named technical account contact for the first 25 enterprise customers" | A standing offer with a numeric cap | Keep if intended; it is a commitment, not a metric |
| B8 | `enterprise.html:189` | "Multi-year commitments unlock locked-rate guarantees." | A contractual guarantee in marketing copy | Keep only if the MSA contains a rate-lock clause; otherwise "can include locked-rate terms" |

## C. Client / proof claims

| # | File:line | Claim as published | Verify | If not provable |
|---|-----------|--------------------|--------|-----------------|
| C1 | `governance/modern-slavery.html:124` | "Clients include public-sector bodies, enterprise corporations, financial institutions, law firms, real-estate firms, education providers, technology startups, and private clients." | Each category needs at least one real client (the statement is signed as a legal/compliance document) | "The Company serves / targets …" or list only categories with a real client |
| C2 | `aria.html:7` | meta description "72-article **live** KB" | `aria-system-status` reported `kb_generated_at 2026-07-03` (≈97 days old, 281 chunks) on 2026-10-08 — "live" overstates freshness | "curated KB" or regenerate the KB (the cron exists) |

## D. Simulated / demo surfaces that read as live (relabel, not remove — Rule 15)

| # | File:line | What a visitor sees | Status this run |
|---|-----------|---------------------|-----------------|
| D1 | `aria.html:2105–2110, 2669–2682` | "LIVE ACTIVITY · Worldwide · 202.2 M ONLINE GLOBALLY" random-walk counters | Owned by the aria.html agent this run (relabel SIMULATED DEMO FEED) |
| D2 | `aria.html:2023–2100, 5399` | "ENTERPRISE OPERATIONS · LIVE" ops view with invented figures | Owned by the aria.html agent this run (relabel DEMO OPERATIONS) |
| D3 | `aria.html:5411–5435` | Scripted voice reply with fake 00:04 / 00:11 timestamps, "ARIA is listening" with no recognition running | Owned by the aria.html agent this run |
| D4 | `index.html:3059` (video `aria-stats-and-purpose.mp4`) and `aria-cinema.html` | The "stats and purpose" film shows a simulated ARIA-vs-service-desk dashboard (82 tickets resolved, 98.7 % CSAT, "$1,987,000" savings…). The frames carry "LIVE SIMULATION" and the surrounding copy says "usage simulation", so it is labelled — but the numbers are invented and the film is on the homepage | Unchanged (only `preload="none"` + a poster frame of the same film were added). Ahmad to decide whether the on-screen label is prominent enough |
| D5 | `index.html:3974–3997` | Entry gate cycles "DECODING… VERIFY · 68 %… HASH · A6F2… CLEARANCE… VERIFIED" | Unchanged — a simulated security control on a security vendor's site; audit suggests brand/loading words instead |

## E. Mailboxes and channels referenced publicly (real-or-empty)

| # | Where | Address / channel | Verify |
|---|-------|-------------------|--------|
| E1 | `checkout-success.html`, `governance/privacy.html`, `.well-known/security.txt`, `security/disclosure.html` | `support@`, `privacy@`, `security@iisupp.net` | Each alias delivers to a monitored inbox (73 links use `ahmad.wasee@iisupp.net`; these three appear 2–3 times each) |
| E2 | `status.html:… Subscribe to updates` | "email … with 'subscribe' — we'll add you to incident-only emails" | A manual list exists / will be kept |
| E3 | Netlify Forms `contact` ×2, `purchase-tech`, `aria-acquisition-bid`, `sentinel-notify`, `cre-inquiry` | Form detection is a per-site Netlify UI setting | Confirm "Enable form detection" is on and a test entry reaches `integrateditsupp@gmail.com` (`submission-created.mts`) |
| E4 | Netlify env | `RESEND_API_KEY` | Set, otherwise `aria-lead-capture` leads only exist in function logs |

## F. Not a claim, but Ahmad's decision

| # | Item | Why it is here |
|---|------|----------------|
| F1 | Service Center portal `https://ii-support-portal-wd05qh.abacusai.app` | Answers 404 (verified 2026-10-08). The homepage/m.html now check reachability and fall back to ARIA / contact form / purchase-tech. Decide: revive the portal (nothing else to change — `frame-src` already allows it) or re-point the 12 CTAs permanently. |
| F2 | HSTS `preload` | Added to the header this run (inert until submitted). Submit at hstspreload.org only after confirming every `*.iisupp.net` subdomain is HTTPS-only — it is hard to undo. |
| F3 | `SECRETS_SCAN_OMIT_KEYS` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `SENIOR_DIRECTOR_SECRET` are real secrets whitelisted from the build scanner. Rotate, then remove them from the omit list (`netlify.toml` comment explains). |
