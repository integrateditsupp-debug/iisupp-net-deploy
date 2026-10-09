# NEEDS AHMAD

> Rewritten 2026-10-08 (RUN-CU). Everything below the rule is history; the list that is live is this one.

> **2026-10-09 (RUN-CU / CU6):** every item here that is dated or has a person waiting is now also a row in
> `senior-director-state/CEO-CRITICAL-ITEMS.md` (the one CEO ledger, 16 open rows, 1 overdue), a **red event on
> Ahmad's calendar** (today 16:00 the three clicks; 16:30 the outbound sends; Tue 10-13 the 141 Bay calls + the
> decision block; Wed 10-14 portal logins; Thu 10-15 the Rule-16 hardware session; the Oct 12/19/26/27/29 deadlines)
> and the **red digest email** sent 12:50 EDT. `node scripts/ceo-critical-items.mjs` prints the block any session
> must put first. Policy: `aria-vault/01_Frontal/Policies/CEO-Critical-Items-Policy.md`.

## 2026-10-08 · RUN-CU — the clean-up cycle: seven clicks, in order of value

**1. Merge RUN-CU to `main` and push.** `cc/run-cu-2026-10-08` holds CU0…CU5 — the reconciled AXIS line,
the baseline repair, the backend security pass, the site honesty pass, Sentinel 0.2.0, the `/aria` voice
conversation, the fleet refresh. Verified: site suite 129/133 (4 environment-only), desktop registry
1030 pass / 0 fail / 57 not taken, headless-Chromium smoke of the wizard and the voice loop. One click:
`AHMAD-MERGE-RUN-CU.cmd` (fast-forwards local `main`, pushes with your credentials, deploys nothing).
   - Category: merge + push
   - Ahmad action: run the one-click, or say "merge it" in a session that has your credentials

**2. Netlify publish.** Your separate, deliberate click after the merge. Until then the live site is the
2026-10-04 `main`: the two new Sentinel endpoints (`aria-sentinel-notify`, `aria-sentinel-approval`) 404,
`/aria` still runs the one-shot mic, the account endpoints still trust an email alone.
   - Category: publish
   - Ahmad action: publish, or hold

**3. Netlify environment for the new paths** (all in Site settings → Environment variables):
`RESEND_API_KEY` + a verified-domain `RESEND_FROM` (every customer email is undeliverable in the
`onboarding@resend.dev` fallback mode); `APERTURE_JWT_SECRET` (magic links + 12-h session tokens);
`INTERNAL_WEBHOOK_SECRET` (license minting + trace writes); `SENTINEL_APPROVAL_SECRET` (signed Approve/Deny
links; falls back to `SENTINEL_LICENSE_SECRET`); `ARIA_MODEL` (without it every voice turn gets the
offline-brain reply). Emergency toggle if a live customer flow breaks before the token flow is proven:
`ARIA_ALLOW_EMAIL_ONLY_ACCOUNT_ACTIONS=1` (flip it back).
   - Category: config
   - Ahmad action: set the values

**4. Flip the GitHub repo private.** `integrateditsupp-debug/iisupp-net-deploy` is public: strategy notes,
lead names in `senior-director-state`-adjacent docs, operator logs — all world-readable even though the site
404s them. GitHub → Settings → Danger zone → Change visibility. The three cloud tasks clone anonymously
today; after the flip they need the repo attached with read access (one `add_repo` call in a session).
   - Category: security
   - Ahmad action: change visibility, then tell the next session so the tasks are re-pointed

**5. Refresh the ~54 desktop agents.** `AHMAD-REFRESH-SCHEDULED-AGENTS.cmd` — puts the dated bootstrap
header on every `Documents\Claude\Scheduled\*\SKILL.md`, rewrites dead-branch references to `main`,
leaves each task's own prompt and model alone (`--model opus` to pin; dry-run variant prints only).
   - Category: fleet
   - Ahmad action: run the one-click

**6. Twilio — paid, so yours.** SMS to device users and tech contacts stays **dormant** (shown as "not sent")
until `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` exist. Email + desktop notifications
work without it. Case: ~$1–2 CAD/mo + per-message cents; it is the channel a business admin actually sees at
2 a.m. Your decision, your card.
   - Category: spend
   - Ahmad action: approve or park

**7. Verify once on real hardware (Rule 16).** Nothing this cycle ran on a live Windows or macOS machine.
Build (`npm run package:win` from the merged line), install, walk the 12-step setup, trigger one detection,
approve one fix from the email link, say "that's all" to the companion. Then the `sentinel-loop-watcher`:
either grant it File Explorer / ARIA Sentinel / Command Prompt in its task settings, or retire it — the new
read-only *ARIA daily health & learning digest* (06:41 daily, cloud) now covers the headless half.
   - Category: verify
   - Ahmad action: one session on the machine

**Claims only you can verify** (copy was deliberately not changed): `docs/RUN-CU-2026-10-08-CLAIMS-FOR-AHMAD.md`.

**What does NOT need you:** the stale public AXIS feed (regenerated from this cycle's own readings), the
build-topic brain regression, the two never-committed AXIS modules, `npm ci` on Sentinel, the status page's
invented numbers, the Service Center dead end, mobile intake, icons/OG, the 3 cloud scheduled tasks
(2 updated to current branch + model, 1 created).

---


> Cleared 2026-08-12 — all items removed by Ahmad.

## 2026-08-12 · RUN-BO — one capability, one click

**1. A code-host credential, or one click on the push script.** Local `main` is **11 commits ahead**
of the shared remote and 0 behind. `git push` refuses here, verbatim: `could not read Username for
'https://github.com'`. Not a decision and not labour — the one capability this environment lacks.
One-click: `senior-director-state/cc-runs/AHMAD-PUSH-RUN128-RUN-BO.cmd`. **Code only. Deploys
nothing.**

**2. Netlify publish** — still your separate, deliberate click. Merging `main` published nothing.

**What does NOT need you this cycle:** the two checks that had been reported open for four cycles are
closed. Registry reads **1074 pass / 0 fail**; site suite **111/111**. The registry still exits 1 on
one suite that fails to LOAD against another seat's *uncommitted* classifier tuning in the working
tree — `main`'s own copy was extracted and run at **93.55%**, green. That file was not touched.

The AXIS status feed is fresh and true: regenerated from readings taken this cycle,
`generatedAt 2026-08-12T19:12:21Z`.

## 2026-08-12 · RUN-BP — one click, and one thing that is not yours

**1. The push.** Local `main` is **2 commits ahead** of the shared remote and 0 behind. `git push`
still refuses here, verbatim: `could not read Username for 'https://github.com'`. Not a decision and
not labour — the one capability this environment lacks.
One-click: `senior-director-state/cc-runs/AHMAD-PUSH-RUN129-RUN-BP.cmd`. **Code only. Deploys nothing.**

**2. Netlify publish** — still your separate, deliberate click. Emitted, not typed:
*2 commit(s) are built and tested but unpublished. 2 of them touch 6 file(s) a visitor can load —
that share, and only that share, is what publishing would change on screen.*

**What does NOT need you:** the quote card names the plan it quotes, and the MSA's two schedules now
agree on one set of names with a suite that fails the moment they drift. The classifier red is
narrowed to a single token and written up for the seat that owns that file — no decision required
from you.

**What you should know, because it is not good news:** this cycle's two test readings were **NOT
TAKEN**, and the feed says so rather than guessing. The build machine's scratch volume is at 100%
(9 MB free), so suites fail on the disk instead of the code — a registry run returned 56 failures
that were all ENOENT, and three site runs disagreed with each other. Roughly 1.7 GB of it is
abandoned scratch directories left by previous cycles that nothing cleans up. Until that volume has
room, no test number from this machine should be believed — including a green one.

## 2026-08-13 · RUN-BR — one click, and it is the same one it has always been

**1. The push.** The verified line is **5 commits** ahead of the shared remote and 0 behind. `git
push` still refuses here, verbatim: `could not read Username for 'https://github.com'`. Not a
decision and not labour — the one capability this environment lacks.

One-click: `senior-director-state/cc-runs/AHMAD-PUSH-RUN130-RUN-BR.cmd`. **Code only. Deploys
nothing.** It pushes a fetched ref straight to the shared line and deliberately does **not** check
anything out, because your working tree holds another seat's uncommitted changes and nothing here
will write over them.

**2. Netlify publish** — still your separate, deliberate click.

**What does NOT need you this cycle:** the shared line could not test itself and now can. 56
assertions were failing on a clean copy of `main`; 53 of them were reading operator records that are
untracked on purpose and are reported NOT TAKEN from now on, and the 2 that were real defects were
fixed rather than skipped. Clean copy reads 1087 / 1030 pass / 0 fail / 57 not taken. This machine
reads 1087 / 1087 / 0 fail / 0 skipped.

**One thing to know, because it was a mistake and not a footnote:** while trying to refresh the
fixed-name delivery bundle, `senior-director-state/delivery/unpublished-line.manifest.json` was
truncated to zero bytes by this environment's inability to replace a file. It was reconstructed
immediately, byte-for-byte at its original 849 bytes, and the reconstruction was verified by
re-digesting the bundle it describes. A stray 17-byte `unpublished-line.bundle.lock` was left beside
it and could not be removed from here — it is inert; delete it whenever convenient.
