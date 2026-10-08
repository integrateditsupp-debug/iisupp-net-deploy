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
- Today's work: **`cc/run-cu-2026-10-08`** — Ahmad's long-lived local line (`cc/run-bh-2026-08-11`,
  stalled since 2026-08-13) was merged into the shared line in `fa88d34`, so local and remote are
  reconciled on this one branch.
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

## 4 · Current product truth

- **Live on `iisupp.net`:** the marketing + service site (XO elite theme across all pages since the
  2026-10-04 `main`), **ARIA web** at `/aria`, the Aperture/AXIS hub at `/aperture-learning.html`,
  the Growth Library, governance/trust pages, and the Netlify function surface under
  `netlify/functions/` (ARIA chat, lead capture, licensing, billing portal, M365 Graph, etc.).
- **ARIA Sentinel: `0.1.16`** (`ARIA Sentinel/package.json`). A version bump is **pending** with this
  cycle's Sentinel work — do not claim a new version until that bump lands.
- **The public Windows installer is HELD** on purpose (unsigned; pending an EV cert) — `netlify.toml`
  force-404s `/sentinel-binaries/*`. Any page implying "download it today" is a Rule 14 defect.
- **Honesty backlog that is open, not fixed:** `docs/RUN-CU-2026-10-08-CLAIMS-FOR-AHMAD.md` lists the
  24/7 coverage claims, SLA promises and proof claims that **only Ahmad can verify**. The copy was
  deliberately *not* changed; it is his row-by-row keep / scope / soften call.
- **In progress on `cc/run-cu-2026-10-08`** (other agents own these right now — do not edit their
  files): baseline repair (brain build-topic escalation, `scripts/lib/job-registry.mjs` +
  `scripts/job-watchdog.mjs` now tracked, an honest classifier floor); a functions security pass
  across 47 files in `netlify/functions/` (auth gates, notify lib, user-data purge, the voice-mode
  contract in `aria-chat`); a site honesty/perf pass (status page real-or-empty, icons/OG, Service
  Center fallback, mobile intake, sitemap/robots/404/headers); and the **Sentinel build** — setup
  wizard (identity, contacts, autonomy level, approver, report recipients, maintenance window), the
  autonomous detect→notify→approve→fix→report flow, and the conversational voice loop (web + desktop).
  Status of that work is **in progress**, not done — see §9 for the lead's close-out.

## 5 · Tests

```bash
npm test             # guard set: 5 AXIS shell/deploy suites — must always be green
npm run test:all     # every tests/*.test.mjs  (node scripts/run-tests.mjs --all)
node scripts/agent-preflight.mjs   # branch / HEAD / commits / feed age / NEEDS-AHMAD, before you start
```

`--all` **auto-discovers** `tests/*.test.mjs`; a new suite needs no registration. The hand-picked
`GUARD` array in `scripts/run-tests.mjs` is deliberately small (AXIS shell + deploy surface only).

**Measured on this clone, 2026-10-08: `all: 120/125 suites passed`.** The five reds are
**environment-only** — they exercise Windows/desktop behaviour or a live feed that does not exist on a
Linux clone. Do **not** "fix" them by deleting assertions, and do not count them as product defects:

- `tests/axis-app-detect.test.mjs` — probes Windows applications off-Windows.
- `tests/axis-assistant-behaviors.test.mjs` — reads the AXIS brain vault at a Windows path.
- `tests/axis-windows-traps.test.mjs` — Windows-specific traps.
- `tests/axis-worker-offline.test.mjs` — needs the local worker.
- `tests/axis-status-emitter.test.mjs` — red while `.well-known/axis/status.json` is stale.

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
4. **The read-only "ARIA daily health & learning digest" task could not be created** by an agent
   (permission). Its prompt is staged for Ahmad in `senior-director-state/FLEET-REFRESH-2026-10-08.md`.
5. **The two v2 cloud tasks read `senior-director-state/AGENT-BOOTSTRAP.md`, which is gitignored** —
   a fresh clone of `main` will not contain it. Either track that one file (a `.gitignore` negation)
   or point the tasks at `docs/AGENT-BOOTSTRAP.md`, which is tracked. **Ahmad's call** — detail in
   `senior-director-state/FLEET-REFRESH-2026-10-08.md` §1.

## RUN-CU BUILD STATUS (filled by the lead at close)

<!-- Lead: replace this block at close of RUN-CU. Keep it honest — "in progress" until verified.
     Baseline repair: …
     Functions security pass (47 files): …
     Site honesty / perf pass: …
     Sentinel build (setup wizard · autonomous flow · voice loop): …
     Sentinel version after bump: …
     Test result at close (`npm run test:all`): …
     What is still open: … -->

_Status at the time this bootstrap was written: **in progress on `cc/run-cu-2026-10-08`**, nothing
from this cycle claimed as done, nothing pushed, nothing published._
