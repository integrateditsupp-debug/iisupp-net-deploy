# AXIS CC v2 — P4 Outreach & Gmail runbook

**Outreach identity (one, everywhere):** `Ahmad Wasee <ahmad.wasee@iisupp.net>` — From, Reply-To, CASL contact, and the mailbox the P5 monitor watches. Wired in `assets/axis-constants.js` (`OUTREACH_IDENTITY`).

## Mailbox architecture (confirmed)
`iisupp.net` is **Google Workspace** (MX = `smtp.google.com`), so `ahmad.wasee@iisupp.net` is a real Workspace mailbox. We OAuth **directly against it** — drafts, sends, and reply-monitoring all resolve to that single inbox (not a send-as alias, which would split sending from replies). The claude.ai Gmail *connector* is authed as `integrateditsupp@gmail.com` (a different mailbox) and is **not** used for outreach.

## Domain authentication (verify before the real send)
| Record | Status | Value |
|---|---|---|
| SPF | ✅ | `v=spf1 include:_spf.google.com ~all` — Google authorized to send for iisupp.net |
| DMARC | ✅ | `v=DMARC1; p=none; rua=mailto:ahmad.wasee@iisupp.net` (monitoring) |
| DKIM | ❌ **action needed** | No `google._domainkey.iisupp.net`. Workspace DKIM is **off**. |

Mail authenticates today via SPF alignment (DMARC passes), but **enable Workspace DKIM before a cold batch**: Google Admin → Apps → Google Workspace → Gmail → *Authenticate email* → Generate for iisupp.net → publish the `google._domainkey` TXT it gives you → Start authentication. Then re-verify `google._domainkey.iisupp.net` resolves. (Optional hardening: move SPF `~all` → `-all` and DMARC `p=none` → `p=quarantine` once DKIM is live.)

## One-time OAuth setup (local only)
1. Google Cloud Console → new/existing project → **enable the Gmail API**.
2. APIs & Services → Credentials → Create credentials → **OAuth client ID → Desktop app**.
3. Save it as `data/secrets/gmail-oauth-client.json` = `{ "client_id": "...", "client_secret": "..." }` (this dir is gitignored + `/data/*` is 404-forced).
4. Run `node scripts/gmail-auth.mjs`, open the printed URL, **sign in as ahmad.wasee@iisupp.net**, grant `gmail.compose` + `gmail.modify`. A refresh token is written to `data/secrets/gmail-tokens.json`.
5. Tokens **never** leave this machine — not Netlify env, not Blobs, not git.

Scopes: `gmail.compose` (create drafts + send) and `gmail.modify` (read replies for P5). Least privilege for the whole research→send→reply motion.

## Send flow (draft-then-send, approval-gated)
1. Cartographer/Pitch generate a draft → `outreach_items` (status `pending`) → **Approvals**. No send path exists at generation (S7 has no send button).
2. You approve a specific item in Approvals.
3. The outbound queue calls `railsCheck()` **at send time** — daily cap, suppression, approved template, quiet hours (America/Toronto), CASL footer, consent basis. Any fail → held.
4. `gmail-outreach.createDraft()` materializes the Gmail draft, then `sendDraft()` sends it (draft-then-send so replies thread). Only after your per-item approval.

## Copy = Ahmad's LOCKED approved template
Body copy is **not** invented. It comes verbatim from `aria-vault/01_Frontal/Outreach-Template-Approved.md`
(locked 2026-06-25), mirrored into `APPROVED_TEMPLATE` in `axis-constants.js`. Personalize **only** `{name}`;
the demo link, contact line, and signature stay exactly as written. Subject (the one element not in the
locked body) is minimal + factual: "Managed IT & AI automation for {company}".

## Lint (conformance, enforced at generation)
Because the body is authoritative, lint enforces **conformance**: `{name}` personalized (no leftover
placeholder), the approved markers survive (offer, demo link, contact, phone), it opens with the approved
greeting (drift guard), no *residual* banned filler, length sane. See `lint()` in `scripts/lib/outreach.mjs`.

## Pacing (P4 addendum — deliverability)
First batch is **personalized, ≤5/day, no blast**. Volume does **not** ramp until Workspace DKIM is live —
enforced in `railsCheck()` (`OUTREACH_PACING.requires_dkim_to_ramp`): with DKIM absent the daily cap is
pinned to 5 and the rails surface a ⚠ until it's enabled.

## CASL
Exact footer on every commercial email (`CASL.line` in `axis-constants.js`):
`Integrated IT Support Inc. · 30 Fothergill Crt, Whitby, ON L1P 1L4 · ahmad.wasee@iisupp.net · 647-581-3182 · instant one-click unsubscribe: <link>`
plus a `List-Unsubscribe` header (one-click), honored immediately via the suppression list. Consent basis
(`conspicuous_publication` + the public URL where the business email was found) is recorded per contact in
`consent_basis`. Max 3 follow-ups then stop.

## Secrets / env
| Name | Where | Read by |
|---|---|---|
| `data/secrets/gmail-oauth-client.json` | local, gitignored | `gmail-auth.mjs`, `gmail-outreach.mjs` |
| `data/secrets/gmail-tokens.json` | local, gitignored | `gmail-outreach.mjs` |

No Gmail secret is ever a Netlify function/env/Blobs value.
