# CC BRIEF — AXIS Command Center rebuild

**Rev 3.1 · 2026-07-28 (evening).** Author: Cowork (Claude).
Every fact below was verified this session against the repo, `data/axis-sales.db`,
the live Netlify project, and the Gmail mailbox. Facts are VERIFIED, not assumed.
Read the whole file before touching code.

---

## CHANGELOG — what changed since Rev 2 (2026-07-24)

If you read Rev 2, these things you were told are now **wrong**. Re-read §0.3, §0.4, §2.B and §3.5.

| # | Rev 2 said | Truth as of 2026-07-28 |
|---|---|---|
| 1 | `main` is ahead by 2 commits (`d0b57fb`) | `main` is **14 commits ahead of `origin/main`** and the branches have **diverged** — see §0.3 |
| 2 | `outreach_items` = 18, all `pending` | **2 pending · 4 sent · 12 rejected** |
| 3 | approvals waiting = 18 | **2** |
| 4 | booking link = the long `calendar.google.com/.../AcZssZ0iSn7...` URL | **`https://calendar.app.google/LUyV5pHxkqJRg5vp8`** — decided by Ahmad, already correct in code as `DEMO_LINK` |
| 5 | B3 blocked on `NETLIFY_API_TOKEN` | **B3 is unblocked.** A token-authed push endpoint now exists — see §3.5 |
| 6 | `.git/index.lock` means a rogue process is writing | **False.** It is a filesystem limitation of the remote bridge — see §0.1 |
| 7 | Support FAQ is a homepage nav tab | Moved: it now lives **under Forums** — **shipped and live** on `iisupp.net`, see §2.G |
| 8 | *(Rev 3)* the live dashboard still shows `$93,250` | **False as of 15:46 today.** Live now reads `pipeline_value 0 / awaiting_approval 2 / messages_waiting 1`. §0.4 rewritten. |
| 9 | *(Rev 3)* a git push to `main` deploys the site | **False.** The published deploy was **`locked`** (auto-publishing stopped). Netlify built every push and published none. See §3.6. |
| 10 | *(Rev 3)* `AXIS_SNAPSHOT_PUSH_TOKEN` just needs setting | **Now set** on Netlify as a secret env var (contexts: production, deploy-preview, branch-deploy; scopes: functions, runtime). Endpoint is live and authing. |
| 11 | — | **Do not compute snapshots with `main`-lineage libs.** They report `pipeline_value $77,500` (assessed) where the shipped v2 libs correctly report `$0` (booked). See §3.5. |

---

## 0. GROUND TRUTH

### 0.0 The Action Inbox is REAL. It is not demo data.

`inbox_messages` holds **26 rows, all real Gmail** with real `gmail_message_id`
values pulled from ahmad.wasee@iisupp.net. The old fictional seeds
(`g-1..g-4`, Harbourline Logistics, Queen West Dental) are **GONE** — already
cleaned. `scripts/axis-seed.mjs` must NEVER be run again; it `DELETE`s 16 tables.

Breakdown: **25 `noise` + 1 `new_inbound_request`**. All 26 are still `unread=1`
in the raw table — do **not** use raw unread as a KPI. See §0.5.

The single actionable item, which drives the badge:

- id **18** — from `jzavitz@houserhenry.com` (Jillian Zavitz, Houser Henry, Toronto law firm)
- Subject: `RE: Managed IT Services & AI automation — quick 15-min demo`
- Body: *"currently we are not looking for a MSP. I will keep your information handy though should this discussion come up in the future."*
- **This is a genuine reply to Ahmad's real cold outreach.** It IS in his mailbox.
  He didn't see it because the inbox is 96% noise (LinkedIn, DMARC reports,
  Best Buy sales, Anthropic billing, and ARIA's own internal digests).

**BUG B1 — misclassification.** id 18 is a *reply to outreach* (subject literally
starts `RE:` and matches a sent campaign) but is classified `new_inbound_request`.
`reply_to_outreach` count is **0** across the whole table, which is wrong.
Fix `scripts/lib/sentry-classify.mjs`: if the message threads to a row in
`outreach_items` (or subject matches a sent template), classify `reply_to_outreach`.

**BUG B2 — noise floor.** ARIA's own mail (`aria@iisupp.net`, `hello@iisupp.net`)
is being ingested into the founder's action inbox. Suppress internal senders at
ingest, not at classify. Same for `noreply-dmarc-support@google.com`,
`*.mimecastreport.com`, `notifications-noreply@linkedin.com`, `newsletter@e.bestbuy.ca`.

### 0.1 ENVIRONMENT — read this before you blame a process

The remote bridge that Cowork uses to reach this repo has three hard limits.
They produce symptoms that look like bugs and are not:

1. **It cannot unlink files.** `rm`, `rmdir`, `unlink` fail with
   `Operation not permitted` on the mounted folder. Git creates `.git/index.lock`,
   does its work, then **fails to delete it**. The same applies to
   `.git/HEAD.lock` and `.git/objects/**/tmp_obj_*`.
   **This litter is expected. It is not a rogue process and it is not a frozen repo.**
   Rev 2 of this brief and `.codex-observer/codex-playbook.md` both blamed a
   phantom writer. Both were wrong.
   Workaround before every git command:
   `[ -f .git/index.lock ] && mv .git/index.lock .git/index.lock.stale-$(date +%H%M%S)`
   To delete anything, `mv` it aside — you cannot remove it.
   **Ahmad's own local git is unaffected.** He can clean the litter normally.
2. **No network access** from the bridge shell. `npm install`, `git push`, `curl`
   all fail there. Network-dependent steps run from a different context.
3. **45-second hard timeout** per command. Anything longer is killed mid-flight.
   Chunk long operations; never assume a partial command rolled back.

### 0.2 INFRASTRUCTURE — verified against the live Netlify project

| item | value |
|---|---|
| Netlify site ID (**real**) | `88265b1c-3380-4611-a1c0-28b4f688562a` |
| Production branch | `main` — context `production` |
| Last production publish | `2026-07-22T04:41:34Z`, from `origin/main` @ `d0b57fbc` |
| Blobs store | `axis-snapshots` — **site-scoped, shared across all deploys** |
| Push endpoint | `/api/axis/snapshot-push` (new, see §3.5) |
| Push token env var | `AXIS_SNAPSHOT_PUSH_TOKEN` — set in Netlify, context `all`, secret |
| Token on disk | `data/secrets/axis-snapshot-push-token.txt`, mode 0600, gitignored |

**Three infra defects, all still open:**

- **`NETLIFY_SITE_ID` env var points at the WRONG SITE** — it is set to
  `0e1fd679-9f73-40b3-af6c-2f72fee8bc38`. Anything that reads that variable to
  address Blobs is aimed at a different project and will silently write nowhere
  useful. This is a strong candidate for why B3 persisted. **Do not "fix" it by
  editing code — the variable itself is wrong.** Awaiting Ahmad's go-ahead to flip it.
- **`SECRETS_SCAN_ENABLED = false`** on the site. Secret scanning is disabled at
  build time. Worth reversing once the tree is clean.
- **`MESH_WRITE_TOKEN` exists only in local `.env`, not in Netlify.** The
  `aria-mesh-*` endpoints are therefore almost certainly non-functional in
  production. Not a valid write path — do not build on it.

Because the Blobs store is **site-scoped, not deploy-scoped**, a *branch* deploy
can legitimately overwrite the blob that *production* reads. That is the mechanism
§3.5 depends on. It is also a footgun: never push a test snapshot from a branch.

### 0.3 REPO STATE — READ THIS BEFORE YOU COMMIT

```
axis-command-center-v2   ceed5ae5   ← working branch, HEAD
origin/axis-command-center-v2       ← branch is  9 commits AHEAD of its remote
main                     15c56ab1   ← 14 commits AHEAD of origin/main
origin/main              d0b57fbc   ← THIS IS WHAT PRODUCTION IS SERVING
```

- **`main` and `axis-command-center-v2` have DIVERGED**: `main` has **14** commits
  the branch lacks; the branch has **22** commits `main` lacks. This is not a
  fast-forward in either direction. Treat any merge as a real merge with conflicts.
- The 14 commits on `main` are the `cc/run-F` … `cc/run-I` workstream plus AXIS
  status-feed regenerations. **They have never been pushed and never been deployed.**
  Pushing `main` publishes all 14 at once to the revenue site. Do not do that
  casually — it needs a review pass first.
- **516 files dirty** in the working tree. Triage before you build. Do not
  `git add -A`.
- Codex lane: **dormant.** `.codex-observer/codex-playbook.md` is STALE (dated
  2026-07-21, still claims "REPO FROZEN"). Do not trust that file's status section.

### 0.4 THE LIVE DASHBOARD IS LYING — and here are the real numbers

**RESOLVED 2026-07-28 15:46Z.** This section is kept because the failure mode is
permanent, not because the symptom is still present.

For weeks `https://iisupp.net/aperture-learning.html` rendered
`$93,250 pipeline / 22 approvals / 2 replies`. That snapshot was pushed BEFORE the
DB was cleaned, and **Netlify Blobs has no TTL** — a stale value serves forever
until something overwrites it. That was the entire root cause of B3.

The live store now reads, verified directly against the `axis-snapshots` blob store:
`version v13 · tick 2026-07-28T15:46:29Z · overview.kpis = {pipeline_value 0,
awaiting_approval 2, messages_waiting 1, followups_due 5, meetings_week 0, mrr 0}`.
The Windows push loop (`axisbuild/push-loop.cmd`, 15-min interval) is alive and is
what keeps it current. **The dashboard is no longer lying.** Assume nothing —
re-read the blob before you claim a KPI is stale again.

Verified DB state, 2026-07-28:

| table / metric | live (wrong) | actual DB |
|---|---|---|
| pipeline value | $93,250 | **$0** — `opportunities` = 0 rows |
| approvals waiting | 22 | **2** — `outreach_items` where `status='pending'` |
| replies waiting | 2 | **1** |
| meetings | 1 | **0** |
| agent runs | — | **0** |
| businesses | — | **25** (all real GTA firms, `Lead-022` → `Lead-046`) |
| contacts | — | **38** |
| documents | — | **16** |
| suppression list | — | **6** |
| outreach by status | — | **2 pending · 4 sent · 12 rejected** |
| assessed pipeline | — | **$77,500** across 25 businesses |

**BUG B3 — no longer blocked.** The fix path is live; see §3.5. What remains is
running it. **If a number is 0, show 0.** A dashboard that lies is worse than a
dashboard that's empty.

### 0.5 The honesty split — already implemented, do not "simplify" it

`scripts/lib/axis-snapshots.mjs` deliberately separates two different things.
Keep them separate:

```js
pipeline_value: oppsAll.filter(o => o.status !== 'lost')
                       .reduce((s, o) => s + (o.est_mrr || 0), 0),   // = $0. Real deals only.
assessed_value: bizAll.reduce((s, b) => s + (b.est_monthly_value || 0), 0), // = $77,500. Guesses.
messages_waiting: openActionable.length,   // NOT raw unread. Raw unread is 26 and means nothing.
mrr: SUM(est_mrr) WHERE status='won' AND is_real=1,
```

Collapsing `assessed_value` into `pipeline_value` would turn $0 into $77,500 and
re-introduce exactly the lie B3 exists to kill. **Verified correct — leave it alone.**

---

## 1. CURRENT TABS (15) — `assets/axis-app.js`, `const NAV` @ line 46

`overview · inbox · pipeline · crm · prospects · outreach · approvals ·
followups · documents · analytics · products · fleet · axis-agent-director ·
reports · settings`

Ahmad's instruction: **"DO not change or move around anything."** Interpret that
strictly — do not rename, merge, or delete tabs, and do not reorder `NAV`.
Fix what's broken *inside* each tab. The one addition he explicitly asked for is
AXIS getting a real dedicated tab (`axis-agent-director` already exists — build it
out, don't create a second one).

---

## 2. THE BUILD — by area

### A. Action Inbox — kill the tab-hopping

**Current defect:** selecting an email → "Draft AI Reply" bounces to another tab,
then another, and never completes.

**Required:** click email → detail opens **in place** (right-hand pane or modal).
"Draft AI Reply" opens an **editable composer over the same view** showing the
exact text that will send. Live edit → **Send**. Zero navigation. Optimistic UI,
rollback on failure. Log the send to CRM (`crm_records`) on success.

The 15s snapshot poll must **not** clobber an open composer. (Partially addressed
in `6d1985cf` — verify it holds under the new in-place composer.)

Also: fix B1 + B2 above. Badge Law stays — red numeric badge ONLY for un-actioned
`reply_to_outreach` + `new_inbound_request`; zero ⇒ render no badge element.

### B. Prospects — send from the profile

Clicking a public decision-maker must expose **Email** + **Draft AI Email**
inline on that profile. Same in-place composer component as (A) — build it once,
reuse it. Every send writes to CRM automatically.

**Default initial outbound = the LOCKED template already in this repo**
(landed in `31740968` "use Ahmad's LOCKED template + exact CASL"). Locate it,
reuse it **verbatim — do not rewrite the copy.** Requirements on top:

- **Booking link: `https://calendar.app.google/LUyV5pHxkqJRg5vp8`**
  Already correct in `scripts/lib/axis-private-constants.mjs:41` as `DEMO_LINK`.
  Ahmad confirmed this explicitly on 2026-07-28 after the link was queried three
  separate times. **The question is closed. Do not change `DEMO_LINK`. Do not
  substitute the long `calendar.google.com/appointments/schedules/...` URL —
  earlier revisions of this brief carried that link and they were wrong.**
- sign-off: **Ahmad Wasee, Founder | Director**
- CASL block stays exactly as locked (identity + mailing address + working opt-out).
  Consent basis = `conspicuous_publication`.
- every outbound tracked in CRM, no exceptions

### C. Fleet — make it actually work

Currently dead. Build it into the **live agent floor**: every agent, its current
task, last run, duration, success/fail, and a streaming activity log. `agent_runs`
is empty (0 rows) — wire agents to actually write run records, then render them.
Real-time or near-real-time (poll ≤15s). No fake activity.

### D. Reports — make it decision-useful

Currently near-empty. Needs: charts, trend lines, drill-down from summary → detail.
**Quarterly report summarizing daily agent work, linked to the detailed records,
exportable to Excel (.xlsx).** Daily rollups feed the quarterly view.

### E. AXIS tab — the director

Majestic, elegant, futuristic. **Voice + text chat.** AXIS commands the sub-agents
from here. This tab also hosts **all critical approvals** — and *critical* means
strictly: **cost-related** or **company-reputation-affecting**. Everything below
that bar auto-proceeds without asking. Do not route low-risk approvals here; that
is what made the old approvals queue noise.

**Director monitoring duty:** AXIS watches every tab, detects breakage, and files
the issue to the responsible agent to fix. The platform should self-heal rather
than silently degrade.

### F. Cross-cutting

- More interactive visuals for data + reports across the whole app.
- Any feature you judge missing — add it, but list it in your report.
- Preserve every existing working feature. Ship a preservation checklist.

### G. Public site IA — Support FAQ now lives under Forums

Changed 2026-07-28 on Ahmad's instruction: *"support FAQ tab should be under the
Forums tab not in the homepage."* **Shipped — live on `iisupp.net` since 15:56Z**
(deploy `6a68d0bdfd820c6451d46eb1`). Verified: 0 FAQ nav tabs on the homepage,
1 under Forums, `/support-faq.html` still `200`.

- **Removed:** the `Support FAQ` nav tab from the homepage primary nav
  (`index.html`, `solutions` nav group). Do not re-add it.
- **Canonical location:** the Forums nav — `forums/index.html` (tab + footer) and
  `forums/commons.html`. It was already there; the homepage entry was a duplicate.
- **Kept:** the contextual in-body link on `index.html` (~line 3788) and
  `support-faq.html`'s own self-referential nav. Those are not nav tabs.
- The page itself (`/support-faq.html`) and `scripts/build-support-faq.mjs` are
  unchanged. No route was removed — no dead links.

---

## 3. HARD RULES

1. **Never run `scripts/axis-seed.mjs`.** It wipes 16 tables incl. 25 real businesses.
2. **Approval-first on send.** Nothing emails without explicit human OK. Rails stay:
   daily cap, suppression list, locked template, quiet hours, CASL footer.
3. **No fabricated numbers.** Zero renders as zero. Never seed to make a chart look full.
   Never collapse `assessed_value` into `pipeline_value` (§0.5).
4. **Snapshot architecture unchanged.** Worker computes from SQLite → pushes to
   Netlify Blobs (`axis-snapshots`) → authed `/api/axis/snapshot` serves → UI polls.
   **The UI never computes.**
5. Routing stays: `netlify.toml` forced rewrite `/aperture-learning.html` → `/axis.html` (200, force).
6. **Do not push `main` without an explicit review pass.** `main` carries 14
   unpublished commits; pushing it deploys all of them to the revenue site (§0.3).
7. **Never `git add -A`.** 516 files are dirty. Stage by path.
8. **Never commit a secret.** Site secret scanning is currently disabled (§0.2), so
   the build will not catch you. `data/secrets/**` is gitignored — keep it that way.

## 3.5 SNAPSHOT PUSH RUNBOOK — how to actually kill a stale KPI

The old path needed a Netlify PAT. **No PAT exists anywhere** — not on disk
(`.env` has only `MESH_WRITE_TOKEN`; `data/secrets/` has only GitHub + Gmail),
and not in the Netlify environment. That deadlock is now solved.

`netlify/functions/axis-snapshot-push.mjs` (commit `ceed5ae5`) is a deliberately
dumb writer: no compute, no DB access, a module allow-list, a constant-time bearer
check, and the `version` doc written **last** so a partial write never advertises
itself as complete. It runs *inside* a Netlify Function, so `getStore(name)` picks
up **ambient Blobs credentials** — no token, no site ID, no PAT.

```
POST /api/axis/snapshot-push
Authorization: Bearer <AXIS_SNAPSHOT_PUSH_TOKEN>
Content-Type: application/json
{ "version": {...}, "envelopes": { "overview": {...}, ... } }

GET /api/axis/snapshot-push   → current version doc (cheap health probe)
```

Responses: `200` wrote · `400` bad body / unknown module · `401` bad token ·
`405` wrong method · `413` >4 MB · `503` token unset or store unreachable ·
`502` write failed (returns which modules landed).

**Procedure:**

1. Compute locally: `node scripts/push-live-snapshot.mjs --dry-run` and read the diff.
2. Read the token from `data/secrets/axis-snapshot-push-token.txt`. Never paste it
   into a file, a log, a commit, or a chat message.
3. POST the computed payload to the endpoint on **any deploy of this site** —
   the store is site-scoped, so a branch deploy writes the blob production reads.
4. Verify with `GET /api/axis/snapshot?module=overview` and confirm
   `pipeline_value = 0`, `awaiting_approval = 2`, `messages_waiting = 1`.
5. Only then call B3 closed.

**LINEAGE WARNING — read before step 1.** `scripts/lib/axis-snapshots.mjs` differs
between `main` and `axis-command-center-v2`. Computing from the **`main`** copy
yields `pipeline_value $77,500` because it sums *assessed* value across the 25
businesses; the **v2** copy yields `$0` because `opportunities` has 0 rows and only
booked value counts. The v2 number is the honest one and is what is live. Pushing a
`main`-lineage payload would silently re-inflate the dashboard — the exact bug this
whole endpoint exists to prevent. Compute from the branch, not from `main`.

**Endpoint status, verified live 2026-07-28:**
`GET` with a valid bearer → `200` + version doc · `POST` with a valid bearer and a
bogus module → `400 unknown module(s)` · `POST` with a wrong bearer → `401`. The
`503 token not set` state is gone; `AXIS_SNAPSHOT_PUSH_TOKEN` is now a secret env
var on the project.

`scripts/push-live-snapshot.mjs` already reads back and diffs every headline KPI,
exiting `2` on NO_STORE and `3` on VERIFY FAILED. Trust its exit code, not its stdout.

## 3.6 PUBLISH RUNBOOK — a git push does NOT deploy this site

This cost an hour. Do not rediscover it.

`stop_builds` is **false**, so Netlify *does* build every push to `main`. But the
published production deploy was **`locked: true`** — Netlify's "stop auto
publishing". Builds succeed, go `ready`, and are never promoted. `currentDeploy`
stays pinned to the old deploy forever and the live site never changes, with no
error anywhere to explain it.

Symptom signature: GitHub `refs/heads/main` is at your new commit, the Netlify
project's `currentDeploy` is an older id, and polling the live URL returns the old
build indefinitely.

**Procedure (needs `NETLIFY_API_TOKEN` — it lives in `axisbuild/push-run.cmd`):**

1. `GET /api/v1/sites/{site_id}/deploys?per_page=12` — find the `ready` deploy whose
   `commit_ref` is your commit. It usually already exists. Do **not** re-upload.
2. Smoke-test it on its permalink `https://{deploy_id}--iisupp.netlify.app` **before**
   publishing. Check the pages you changed, the functions you added, and that every
   force-404 rule still 404s.
3. `POST /api/v1/sites/{site_id}/deploys/{deploy_id}/restore` — publishes it. This
   preserves the "stop auto publishing" posture, just re-pinned to the new deploy.
4. Re-verify on `https://iisupp.net`.

Do **not** reach for the Netlify MCP `deploy-site` operation as a workaround. It
zips and uploads the working directory — 206 MB of tracked files here — and returns
`400 Bad Request`. The build already exists server-side; publish it, don't rebuild it.

---

## 4. DEFINITION OF DONE

- [ ] `main` ↔ `axis-command-center-v2` divergence resolved deliberately (not by luck); 516 dirty files triaged
- [ ] B1 fixed — id 18 reclassifies to `reply_to_outreach`
- [ ] B2 fixed — internal + bulk senders suppressed at ingest
- [ ] B3 fixed — live KPIs match the DB exactly (**verify: pipeline $0, approvals 2, replies 1, meetings 0**)
- [ ] B4 fixed — send path writes `sent_at` / `gmail_message_id` / `thread_id` in the same transaction; refuses to re-send a row that has `sent_at`
- [ ] B5 fixed — no `Hello ,`; pre-send lint hard-fails on any unresolved or empty token
- [ ] B6 fixed — non-ASCII subjects encode correctly; mojibake pattern in the lint
- [ ] B7 investigated — the flagged URL identified and replaced
- [ ] B8 fixed — prospect qualifier has a headcount/revenue ceiling + in-house-IT exclusion
- [ ] Draft AI Reply completes in-place, zero tab changes, send logs to CRM
- [ ] Prospect profile sends using the LOCKED template + `calendar.app.google/LUyV5pHxkqJRg5vp8`
- [ ] Fleet shows live agent work; `agent_runs` populating
- [ ] Reports has charts + drill-down + quarterly + .xlsx export
- [ ] AXIS tab: voice + text, commands sub-agents, hosts critical-only approvals
- [ ] Director monitors tabs and files issues to agents
- [ ] All 15 tabs smoke-tested against live data; screenshot each
- [ ] Feature-preservation checklist attached

## 5. REPORT BACK

Gate report per area: what you changed, files touched, what you verified **and how**,
commit SHA. Flag conflicts instead of guessing — Ahmad wants the conflict surfaced,
not silently resolved.

**Your gate report will be independently verified against the repo before the next
phase is approved.** Rev 2's gate report claimed "4 commits, 4 ahead of origin/main,
0 behind." The repo said 9 ahead of `origin/axis-command-center-v2` and nothing on
`main`. Do not report state you have not read back. Quote the command you ran.

---

# ADDENDUM — OUTREACH · verified against the live Gmail mailbox and Sent folder

## B4 — THE DB IS BLIND TO ACTUAL SENDS. This is the most severe bug in the system.

`outreach_items` reported `sent_at IS NULL` for all 18 rows. That was false.

**201 emails were actually sent from this account in the last 90 days**, including a burst of
roughly 200 on **2026-07-24 between 21:47 and 21:49 UTC** — about 200 messages in 120 seconds —
plus a smaller batch at 19:15–19:27 the same evening.

None of it was written back to `outreach_items`. The approval rail did not gate it. The snapshot
worker therefore reports a pipeline that does not exist, and any agent reading the DB will
re-send to people who were contacted four days ago.

I reconciled ids 21, 23, 24, 25 to `status='sent'` with real `sent_at`, `gmail_message_id` and
`thread_id` pulled from Gmail. Id 22 (info@123-dental.com) is the only genuinely unsent initial —
verified by searching the entire mailbox, no message to that address exists.

**Required fix:** the send path must write `sent_at`, `gmail_message_id` and `thread_id` back to
`outreach_items` in the same transaction as the send, and must refuse to send when a row already
has `sent_at`. Add a reconciliation job that reads the Gmail Sent folder and backfills. Until that
exists, every KPI in the UI is fiction.

## B5 — THE MERGE FIELD IS BROKEN IN THE BODY  ← **fix this before anything else outbound**

Every one of the ~200 sent emails opens with:

    Hello ,

The business-name token resolved to empty string. The **subject line merged fine**
("MSP & AI automation support for Deloitte — Quick 15-min demo?") so the bug is isolated to the
body renderer, not the data. Find the template renderer and fix the body token; then add a
pre-send lint that hard-fails on `Hello ,` / `Hello,` / any unresolved or empty token.

**Ahmad's decision, 2026-07-28: fix the merge bug FIRST.** The 42 real prospects sitting in the
90 stale drafts do **not** get re-staged until the renderer is fixed and the lint is in place.
Rebuilding them against a broken renderer just manufactures 42 more `Hello ,` emails.

## B6 — MOJIBAKE IN SUBJECT LINES

One send went out as `MSP & AI automation support for McCarthy TÃ©trault`. UTF-8 double-encoded.
The subject header is not being encoded correctly for non-ASCII business names. Fix encoding and
add the mojibake pattern to the pre-send lint.

## B7 — LINK TRIPPED A SECURITY FILTER

Mevotech's mail gateway rewrote the subject to `[*Suspicious URL*] MSP & AI automation support...`.
One of the links in the body (calendar short-link or the unsubscribe token URL) is being flagged.
Investigate which; a flagged URL in cold email is a direct deliverability tax.
Note that `calendar.app.google` **is** a shortener-style domain — test it explicitly against a
gateway before concluding the unsubscribe URL is at fault.

## B8 — ICP FAILURE IN THE TARGET LIST

The 2026-07-24 burst went to Microsoft, RBC, CIBC, Deloitte, the Canadian Armed Forces
(forces.gc.ca), Osler, Stikeman Elliott, McCarthy Tétrault, Blakes, Torys, Cadillac Fairview,
Onex and Hines. These are enterprises with in-house IT departments and formal procurement — they
cannot buy from a small MSP via cold email. The prospect qualifier needs a headcount/revenue
ceiling and an exclusion list for firms with in-house IT.

## RESULT OF THAT CAMPAIGN — the number that matters

~201 sent · 4 hard bounces · 8 auto-replies (out-of-office, retired, left-the-company) ·
**0 human replies · 0 meetings booked · 0 opportunities created.**

Do not treat this as a volume problem. It is a merge-bug + ICP problem. Fix B5 and B8 before
anyone sends again.

## Suppression list is now 6 entries

jzavitz@houserhenry.com and @houserhenry.com (explicit decline), plus four hard bounces:
info@apbs.ca, jaime.mares@hemlomining.com, sgeorge@reillyandpartners.com, ddinardo@gipi.com.
The send path must consult this table. Confirm it does.

## 90 stale drafts

The mailbox holds 90 unsent drafts going back to 2026-06-17 — 42 unique real prospects, 7 of them
drafted twice in separate batches. Same duplicate-generation pattern as the follow-up bomb in the
DB. Whatever loop generates drafts is not checking whether the prospect was already drafted or
already sent. Do not clear these until B5 is fixed — they are the source list for the rebuild.

---

# OPEN DECISIONS — Ahmad's call, do not resolve these yourself

1. **`NETLIFY_SITE_ID` flip** to `88265b1c-3380-4611-a1c0-28b4f688562a`. Fix is ready, not applied.
2. **Publishing `main`.** 14 unreviewed commits would go live with it (§0.3).
3. **Correction email** to the ~40 of the ~200 `Hello ,` recipients who actually fit the ICP.
   Not drafted. Nothing sends without explicit approval.
4. **Re-enabling `SECRETS_SCAN_ENABLED`** once the working tree is clean.
