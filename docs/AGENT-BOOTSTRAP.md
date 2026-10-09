# AGENT BOOTSTRAP — read this first, every run

**Current as of 2026-10-08 (America/Toronto).** Canonical, **tracked** copy: `docs/AGENT-BOOTSTRAP.md`.
`senior-director-state/AGENT-BOOTSTRAP.md` is a pointer to this file, because `senior-director-state/`
is untracked by design and a cloud clone of `main` never receives it.

This file replaces re-deriving the state from scratch. It links to detail rather than repeating it.
If a fact here is stale, fix it **here first**, then the file that disagrees.

---

## 1 · The code

- **Default / shared branch: `main`.** `origin/main` last moved **2026-10-04** (XO elite theme on all
  pages + the ARIA Atelier build skill in `aria-chat`).
- Today's work: **`cc/run-cv-2026-10-09`** (the reconciled line; `cc/run-cu-2026-10-08` is retired into it, 2026-10-09 17:25Z) — Ahmad's long-lived local line (`cc/run-bh-2026-08-11`,
  stalled since 2026-08-13) was merged into the shared line in `fa88d34`, so local and remote are
  reconciled on this one branch. The cycle shipped as **CU0…CU5** on that branch (see RUN-CU BUILD
  STATUS at the bottom); merging it to `main` and publishing are Ahmad's two clicks
  (`AHMAD-MERGE-RUN-CV.cmd` on his machine stages the first; `AHMAD-MERGE-RUN-CU.cmd` is kept as a one-line wrapper that calls it, so older notes stay correct).
- **Dead / retired lines — do not watch, do not build on, do not "verify" against:**
  `merge-v2-to-main`, `cc/master-fix-2026-07-02`, `axis-command-center-v2`, `cc/run-bh-2026-08-11`.
  Docs that still name them (`docs/SYSTEM_AUDIT.md`, `docs/AXIS-CC-V2*.md`, the historical
  `scripts/emit-axis-status-run-*.mjs`) are **history, not instructions**.
- Get the code: `git clone https://github.com/integrateditsupp-debug/iisupp-net-deploy` then
  `git checkout main`, or in an existing clone `git fetch origin && git checkout main`.
- ⚠ **The GitHub repo is PUBLIC.** Netlify force-404s `/docs/*`, `/scripts/*`, `/data/*`,
  `/senior-director-state/*`, `/netlify/*`, `/aria-vault/*` (see `netlify.toml`), **but GitHub serves
  all of it to anyone.** Never write a lead's name, a price quoted to a named prospect, a credential,
  or a token into any tracked file. Flipping the repo private is Ahmad's click; he has been told.

## 2 · The goal, in one paragraph

Make **ARIA Sentinel** (Windows desktop agent), **ARIA web** (`iisupp.net/aria`) and **Integrated IT
Support Inc.** as a whole genuinely client-ready, so enterprise buyers in finance, healthcare, legal,
real estate, retail and education engage and pay — and scale IIS on the back of it toward a
multi-million-dollar IT services company. Rank every piece of work by *revenue × probability × speed*.
Honesty is the moat: a real-or-empty product beats a demo that over-claims.

## 3 · Standing rails

Canonical rules note (operator machine, untracked):
`aria-vault/01_Frontal/VISION-AND-GOAL-STANDING.md`. Repo-side restatements:
`senior-director-state/STANDING-RULES-FOR-ALL-AGENTS.md`, `senior-director-state/CODEX-OPERATIONS-RULES.md` §2.

Named rules you are expected to know: **14** 100% honesty, no fabricated metric/cert/customer —
real-or-empty · **15** preserve everything, changes are additive; renaming counts as removing ·
**16** verify every "done", re-sweep the whole inventory, never trust another agent's "it's fixed" ·
**17** value-first: lead with the value the customer feels, then the feature · **18** Ahmad's explicit
instruction IS the approval — execute through the safest mechanism, never hand the click back.

**The six hard stops** (each one is escalate-to-Ahmad, never agent-initiated):

1. **No external send/submit/apply/sign/certify** — outreach, bids, forms, filings stop at the final click.
2. **No account creation or supplier/portal registration** — prefill everything, stop before `Register`.
3. **No payment, subscription, paid API, or ads.** $0 is the law; the $20–70 CAD/mo guaranteed-revenue
   exception is presented as a case and paid by Ahmad only.
4. **No production publish, no push to `main`, no deploy** — branch only; publishing is Ahmad's separate click.
5. **No deletion, git-history rewrite, or Rule-15 removal** of a tab, feature, section, control or content.
6. **No legal / financial / medical / privacy / compliance claims and no fake proof** — no invented
   testimonials, partnerships, search volume, certifications or counts.

Standing prohibition, same severity: **never mention Raymond James anywhere**, and
`**/Private pics and Vids/**` on Ahmad's machine is off limits to every agent (no read, list, scan or index).

**The CEO-critical channel (standing instruction from Ahmad, 2026-10-09 — RUN-CV / CV4).** Anything only
Ahmad can do — a contract to sign, an interview, a person waiting to speak with him, a dated deadline, a
credential or payment decision — lives in ONE ledger, `senior-director-state/CEO-CRITICAL-ITEMS.md`
(policy: `aria-vault/01_Frontal/Policies/CEO-Critical-Items-Policy.md`). Four channels, in this order,
every time:

1. **The ledger** — append a row; never remove one. An item leaves `## Open` only when Ahmad acts
   (→ `## Closed`) or parks it (→ `## Parked`). A passed deadline becomes **OVERDUE**, never a removal.
2. **Every chat reply, first thing, in red** — run `node scripts/ceo-critical-items.mjs` and paste its
   block at the TOP of the reply before anything else. Markdown has no red, so the block carries the
   🔴 marker + bold on every row; that is the required form in chat. The hourly digest
   (`scripts/ceo-action-digest-agent.mjs`) already puts the same block first in
   `senior-director-state/ceo-now-action-digest.md`.
3. **Email** — the critical actions go to **integrateditsupp@gmail.com, cc ahmad.wasee@iisupp.net**
   as red HTML (`node scripts/ceo-critical-items.mjs --html` is the block). A second address he named
   in chat on 2026-10-09 is excluded by the standing prohibition above until he explicitly confirms it
   in chat; do not add it on your own.
4. **Calendar** — one red event (colour 11, email + popup reminders) on `ahmad.wasee@iisupp.net` for
   every dated or person-waiting row; the event id goes in the row's `status` cell so nobody creates
   it twice. Sessions without the Calendar connector write "calendar: pending" in the cell instead.

Emailing or calendaring **Ahmad himself** is not an external send; emailing anyone else still is.

## 4 · Current product truth

- **Live on `iisupp.net`:** the marketing + service site (XO elite theme across all pages since the
  2026-10-04 `main`), **ARIA web** at `/aria`, the Aperture/AXIS hub at `/aperture-learning.html`,
  the Growth Library, governance/trust pages, and the Netlify function surface under
  `netlify/functions/` (ARIA chat, lead capture, licensing, billing portal, M365 Graph, etc.).
- **ARIA Sentinel: `0.2.0` on `cc/run-cv-2026-10-09`** (`ARIA Sentinel/package.json`); the installer
  Ahmad's machine last built is still **0.1.16** until he runs `npm run package:win` from the merged line.
  Release notes: `ARIA Sentinel/docs/RELEASE_NOTES_0.2.0.md`.
- **The public Windows installer is HELD** on purpose (unsigned; pending an EV cert) — `netlify.toml`
  force-404s `/sentinel-binaries/*`. Any page implying "download it today" is a Rule 14 defect.
- **Honesty backlog that is open, not fixed:** `docs/RUN-CU-2026-10-08-CLAIMS-FOR-AHMAD.md` lists the
  24/7 coverage claims, SLA promises and proof claims that **only Ahmad can verify**. The copy was
  deliberately *not* changed; it is his row-by-row keep / scope / soften call.
- **Built on `cc/run-cv-2026-10-09` (formerly `cc/run-cu-2026-10-08`), NOT yet live** (nothing is live until Ahmad merges + publishes):
  baseline repair (brain build-topic escalation, `scripts/lib/job-registry.mjs` + `scripts/job-watchdog.mjs`
  tracked, honest classifier floor); the functions security pass (identity on account actions, fail-closed
  gates, `lib/notify.mjs`, delete/export that reach the data, voice mode in `aria-chat`); the site
  honesty/perf pass (status page real-or-empty, real icons/OG, Service Center fallback, mobile intake,
  sitemap/robots/404/headers); **Sentinel 0.2.0** (setup wizard · autonomy levels · approvals · content-blind
  notify · on-device voice conversation · the audit's safety fixes · six macOS user-level recipes); the
  **web voice conversation** at `/aria`; and two new server endpoints `aria-sentinel-notify` +
  `aria-sentinel-approval`. Verified by the suites below and by a real-browser (headless Chromium) run of
  both the `/aria` voice loop and the 12-step Sentinel wizard. Env the live site still needs for the new
  paths: `RESEND_API_KEY` + verified `RESEND_FROM`, `APERTURE_JWT_SECRET`, `INTERNAL_WEBHOOK_SECRET`,
  `SENTINEL_APPROVAL_SECRET` (falls back to `SENTINEL_LICENSE_SECRET`), `ARIA_MODEL`; Twilio is **paid**
  and stays dormant until Ahmad decides (`TWILIO_*`).

## 5 · Tests

```bash
npm test             # guard set: 5 AXIS shell/deploy suites — must always be green
npm run test:all     # every tests/*.test.mjs  (node scripts/run-tests.mjs --all)
node scripts/agent-preflight.mjs   # branch / HEAD / commits / feed age / NEEDS-AHMAD, before you start
```

`--all` **auto-discovers** `tests/*.test.mjs`; a new suite needs no registration. The hand-picked
`GUARD` array in `scripts/run-tests.mjs` is deliberately small (AXIS shell + deploy surface only).

**Measured on this clone at the close of RUN-CU, 2026-10-08: site `all: 129/133 suites passed`;
desktop registry (`ARIA Sentinel`, `node tests/run-all.mjs`) `1087 tests · 1030 pass · 0 fail · 57 not taken`,
14 new suites registered and green.** The four site reds left are **environment-only** — they exercise
Windows/desktop behaviour that does not exist on a Linux clone (the fifth, `axis-status-emitter`, went
green when `scripts/emit-axis-status-run-cu.mjs` regenerated the public feed from this cycle's readings).
Do **not** "fix" them by deleting assertions, and do not count them as product defects:

- `tests/axis-app-detect.test.mjs` — probes Windows applications off-Windows.
- `tests/axis-assistant-behaviors.test.mjs` — reads the AXIS brain vault at a Windows path.
- `tests/axis-windows-traps.test.mjs` — Windows-specific traps.
- `tests/axis-worker-offline.test.mjs` — needs the local worker.
- `tests/axis-status-emitter.test.mjs` — red whenever `.well-known/axis/status.json` is older than 24 h;
  regenerate it with a dated `scripts/emit-axis-status-run-<id>.mjs` (pattern: `emit-axis-status-run-cu.mjs`),
  never by hand.

**Re-measured 2026-10-09 (small-tasks close-out, uncommitted working tree):** site `all: 141/141 suites passed`
(the four environment-only reds above did not reproduce on this clone — baseline before the close-out was
`136/136`); desktop registry `407 of 407 suites taken — all green · 1177 tests · 1120 pass · 0 fail · 57 skipped`
(baseline `402 · 1157 · 1100 · 0 · 57`). Five suites added and registered by hand; details and the per-file
log in `docs/RUN-CU-2026-10-09-SMALL-TASKS-CHANGELOG.md`.

**Re-measured 2026-10-09 17:25Z on the reconciled line `cc/run-cv-2026-10-09` at CV4** (RUN-CU CU0…CU5 +
the desktop flywheel's RUN-BW merge as CV1 + CV2/CV3 + this close-out): site `all: 142/142 suites passed`;
desktop registry `408 of 408 suites taken — all green · 1178 tests · 1121 pass · 0 fail · 57 not taken`
(`scripts/emit-axis-status-run-cv.mjs` took both readings and regenerated the feed from them). Two lines had
merged RUN-BW independently on 2026-10-09 — the sandbox (`8647ad2` on `cc/run-cu-2026-10-08`) and the desktop
flywheel (`71ac6bf` on `cc/run-cv-2026-10-09`) — with the same resolutions; the sandbox's duplicate merge
commit and its second registration of the same 14 suites were dropped, and `ceo-approval-items-override`
is now fixture-only (path derived from `STATE_DIR`, declaration removed) so the manifest's over-declaration
check is green too. **`cc/run-cu-2026-10-08` is retired; the one-click is `AHMAD-MERGE-RUN-CV.cmd`
(`AHMAD-MERGE-RUN-CU.cmd` now just calls it).**

**Trap, measured 2026-10-09:** never run a state-writing worker (`scripts/ceo-action-digest-agent.mjs`,
`scripts/senior-director-worker.mjs`, …) inside a clean clone. Each one appends to
`senior-director-state/codex-claude-queue.md`, which is a *witness* file for `scripts/lib/operator-record.mjs`;
once it exists the clone claims it holds the operator's records and the 57 NOT-TAKEN readings become 57
failures (`1117 pass · 57 fail` instead of `1121 · 0 · 57`). Remove the artifacts the worker created and the
registry is green again. Test a worker's output against a fixture, or on the operator machine.

Separately, assertions that read an **operator record** under `senior-director-state/` report
**NOT TAKEN** on any machine that does not hold those records — never green, never red
(`scripts/lib/operator-record.mjs`). On this clone that is **2 skipped assertions** in
`tests/ledger-head-on-disk.test.mjs`. A figure of **57 "not taken"** has been reported from the
operator machine; **unverified here** — this clone cannot reproduce it.

## 6 · Where things live

| What | Where |
|---|---|
| Shared source of truth (vision, offer, brief) | `docs/COLLAB_BRIEF.md` |
| Loop control layer | `docs/LOOP-ENGINEER.md`, `senior-director-state/loop-engineer/loop-board.md` |
| Operating rules + migrated knowledge | `senior-director-state/CODEX-OPERATIONS-RULES.md` |
| The queue (claim / completed blocks) | `senior-director-state/codex-claude-queue.md` |
| Who is mid-task + Ahmad's open gates | `senior-director-state/active-agent-handoff.md` |
| Ahmad's open one-clicks | `NEEDS-AHMAD.md` (tracked, repo root) |
| Next prompts | `senior-director-state/loop-engineer/{claude,codex}-next-prompt.md` |
| Loops: contracts / registry / ledger | `loops/*.yaml`, `loops/registry.json`, `docs/LOOPS_LEDGER.md` |
| Unattended-job health | `senior-director-state/autonomy/job-watchdog.md`, `scripts/lib/job-registry.mjs` |
| Per-agent run reports | `senior-director-state/autonomy/agent-reports/*.json` |
| Today's fleet inventory | `senior-director-state/FLEET-REFRESH-2026-10-08.md` |
| Repo-observer output | `.codex-observer/codex-playbook.md` |
| Desktop-fleet refresh (SKILL.md sweep) | `scripts/refresh-scheduled-agents.mjs` (+ `AHMAD-REFRESH-SCHEDULED-AGENTS.cmd` on Ahmad's machine) |
| Public AXIS feed regeneration | `scripts/emit-axis-status-run-cu.mjs` (measured, refuses a red build) |
| RUN-CU changelogs | `docs/RUN-CU-2026-10-08-{FUNCTIONS,SITE,ARIA-VOICE}-CHANGELOG.md`, `docs/RUN-CU-2026-10-08-CLAIMS-FOR-AHMAD.md`, `ARIA Sentinel/docs/RELEASE_NOTES_0.2.0.md` |
| Small-tasks close-out (2026-10-09): /health rewrite, capture GET read path, about.html meta/h2, areaServed, Oct-13 Microsoft page, last-verified stamps, loops YAML shape | `docs/RUN-CU-2026-10-09-SMALL-TASKS-CHANGELOG.md` |

`senior-director-state/`, `aria-vault/`, `CLAUDE.md`, `AGENT_EXECUTION_NOTES.md`, `documents/` and the
`*.ps1`/`*.cmd` helpers are **gitignored on purpose** (security lockdown 2026-07-01, `publish="."`).
They exist on Ahmad's machine and are **absent in a clean clone** — a missing one is not a bug.

## 7 · The agent protocol

Per-turn loop, verbatim from `senior-director-state/CODEX-OPERATIONS-RULES.md` §1: **read state first →
claim before touching → execute the safest next slice → log after → write a handoff packet →
commit in coherent groups** (commits/pushes stay Ahmad's). Treat `continue` / `proceed` / `do it` as
"resume the standing mission"; never make Ahmad restate the vision.

Claim, before you touch anything — append to `senior-director-state/codex-claude-queue.md`
(and `AGENT_EXECUTION_NOTES.md` where it exists). Never duplicate another agent's active scope:

```markdown
### 2026-10-08 19:44 - <Agent Name> - active

Scope: <one line — what you are doing>

Target files:
- `path/one`
- `path/two`
```

Close the same way, in the same file:

```markdown
### 2026-10-08 20:10 - <Agent Name> - completed

Scope: <same one-liner>

Changed files:
- `path/one`

Result:
- <what changed, and the company value>
- <verification: the command you ran and its output>
- No external send, submit, apply, contact, account creation, payment, legal commitment, or
  destructive action performed.
```

Then write a **handoff packet** for the next turn: round_id, owner, objective, what changed,
evidence, next best task, files to touch, approval gates, risks, recommended next prompt.

**Canary line — the last line of every result, and it must be TRUE (Rule 14):**
`I have read obsidian Romean` if you actually opened the vision note + the relevant region notes;
`for this task I did not need to read obsidian romean` if the task genuinely did not need it.
Never claim the read you did not take.

## 8 · Paused / needs Ahmad

1. **`sentinel-loop-watcher` is blocked ~47 runs.** A scheduled run cannot be granted desktop access
   on the fly. Ahmad must pre-add **File Explorer / ARIA Sentinel / Command Prompt** to that task's
   settings, or reply once in its conversation. Until then no agent can honestly certify a Rule-16
   live GUI sweep — only headless test results.
2. **Cowork sandbox disk fills repeatedly** (2026-07-21, 08-05, 08-11, 08-12 …). When `/` is full,
   every shell-dependent lane silently no-ops and *green* test numbers are as untrustworthy as red ones.
3. **Repo visibility.** The GitHub repo is public; `senior-director-state/`, `docs/`, `scripts/` are
   world-readable there even though the site 404s them. Flipping it private is one click.
4. ~~The read-only digest task could not be created~~ **Created 2026-10-08** by the lead: *ARIA daily
   health & learning digest (read-only, v1)*, daily 06:41 Toronto, cloud, model `claude-fable-5-1`,
   auto-approval. It replaces the disabled *ARIA daily autonomous build* (which pushed + published).
5. ~~v2 cloud tasks read a gitignored bootstrap~~ **Resolved 2026-10-08**: both v2 tasks and the digest
   read `docs/AGENT-BOOTSTRAP.md` (tracked). *Deliverability Guardian* moved to `claude-fable-5-1`.
6. **The ~54 Cowork DESKTOP agents still carry their July instructions.** Nothing in the cloud can edit
   `C:\Users\Ahmad Wasee\Documents\Claude\Scheduled\*\SKILL.md`. One click on Ahmad's machine —
   `AHMAD-REFRESH-SCHEDULED-AGENTS.cmd` — runs `scripts/refresh-scheduled-agents.mjs`: a dated bootstrap
   header on every task, dead-branch references → `main`, idempotent, prompt text untouched; add
   `--model opus` (or another name) only if he wants the model pinned. Dry-run variant prints without writing.
7. **Merge + publish RUN-CU** — `AHMAD-MERGE-RUN-CU.cmd` fast-forwards `main` to the verified branch
   locally and pushes with his credentials; the Netlify publish remains his separate click. Until then the
   live site serves the 2026-10-04 `main` and the two new Sentinel endpoints return 404.
8. **Everything only Ahmad can do is in the ledger** — `senior-director-state/CEO-CRITICAL-ITEMS.md`
   (16 open rows on 2026-10-09, 1 overdue). Do not keep a second list here; add a row there and run the
   four channels in §3.

## RUN-CU BUILD STATUS (filled by the lead at close, 2026-10-08 21:30 Toronto)

| Slice | Status | Evidence |
|---|---|---|
| CU0 — baseline repair | **done** | aria-brain v2 252/252, matrix 431/431; axis-job-watchdog 16/16 on a clean clone; classifier floor moved with the measured figure written in-file |
| CU1 — functions security pass (`netlify/functions/`, 54 files) | **done, needs env on Netlify** | `tests/function-gates`, `notify-lib`, `user-data-purge`, `aria-chat-voice-contract` green; `docs/RUN-CU-2026-10-08-FUNCTIONS-CHANGELOG.md` |
| CU2 — site honesty / perf pass (31 files) | **done** | `site-status-honesty`, `site-icons-present` green; status page real-or-empty; `docs/RUN-CU-2026-10-08-SITE-CHANGELOG.md` |
| CU3 — fleet bootstrap (this file, preflight, 13 workers, loops truth) | **done** | `tests/agent-preflight` 8/8 |
| CU4 — Sentinel 0.2.0 (wizard · autonomy · approvals · notify · voice · safety fixes · macOS) + web `/aria` voice conversation + `aria-sentinel-notify` / `aria-sentinel-approval` | **done, not live** | registry 1030/0/57 with 14 new suites; real-browser smoke of the 12-step wizard and the `/aria` loop (headless Chromium) passed; `ARIA Sentinel/docs/RELEASE_NOTES_0.2.0.md`, `docs/RUN-CU-2026-10-08-ARIA-VOICE-CHANGELOG.md` |
| CU5 — fleet refresh close-out | **done (cloud) · one click left (desktop)** | 3 cloud tasks current (2 updated, 1 created); desktop sweep script + test ready; public AXIS feed regenerated from measured readings |
| CV4 (2026-10-09, on `cc/run-cv-2026-10-09`) — small-tasks close-out + the CEO-critical channel + line reconciliation | **done** | RUN-BW merge kept as the flywheel's `71ac6bf` (the sandbox's duplicate `8647ad2` dropped), both harness gates green; `/health` redirect, admin-gated GET read path on 3 capture endpoints, about.html meta/h2, areaServed = GTA/Durham/Ontario/Canada, `windows-10-esu-oct-13-check.html` (sourced), data-last-verified on 3 answer pages, 27 agent YAMLs un-swapped + guard; `scripts/lib/ceo-critical-items.mjs` + CLI + digest wiring + `tests/ceo-critical-items-ledger`; vault: 2 policies, 4 procedures, the ledger; 11 red calendar events + the first digest email sent 2026-10-09 |

- **Sentinel version after bump:** `0.2.0` (package.json + lock regenerated; `npm ci` works again).
- **Test result at close:** site `129/133` (4 environment-only reds: axis-app-detect, axis-assistant-behaviors,
  axis-windows-traps, axis-worker-offline); desktop `1087 · 1030 pass · 0 fail · 57 not taken`.
- **Still open (Ahmad):** merge + publish (`AHMAD-MERGE-RUN-CU.cmd`, then Netlify publish); Netlify env listed in
  §4; flip the GitHub repo private; the desktop fleet one-click (§8/6); the sentinel-loop-watcher app grants or
  its retirement in favour of the new read-only digest; the claims list in `docs/RUN-CU-2026-10-08-CLAIMS-FOR-AHMAD.md`;
  Twilio (paid) yes/no; test the magic-link round trip once in production.
- **Honesty note:** nothing from this cycle was tested on a live Windows or macOS machine; "done" above means the
  automated suites, static gates and headless-browser runs passed. The first on-device run is Rule 16's next step.

_Status at the time this bootstrap was last rewritten: **built and verified on `cc/run-cv-2026-10-09` (CV4, 2026-10-09),
nothing pushed, nothing published.**_
