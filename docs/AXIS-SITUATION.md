# AXIS sees everything — RUN-AX2 (2026-10-13) · the Situation Model

**Persona:** Fable 5.1 (Claude Code), executing directly. Third commit on `cc/axis-one-2026-10-13` (after AXIS ONE
`e9ad3cf` and PRO LOOK `f3183ab`). Code only — deploys nothing; Ahmad's `.cmd` + Netlify publish land it.

## The ask (Ahmad, 2026-10-13 21:27 ET)

AXIS answered "let's work on top urgent items" with:

> "I don't have access to your tasks, calendar, or work messages here, so I can't verify the top three yet …
> Reference date: October 14, 2026 (fallback; workspace local date and time zone unavailable) … [needs info]"

> "AXIS is the director autonomous agent that manages all other agents and should have all the business operations
> and tasks being worked on and what's needing action … if there is anything in the company that needs my attention
> AXIS would be aware of it, bring it up in front of me … Remember how I would and grow with me, give me suggestions
> for better approaches … working smart not hard and ensure we grow revenue … at least $100k–$500k per month."

## Why it said that (findings)

| # | Finding | Where |
|---|---------|-------|
| S1 | "let's work on …" is routed by `workspaceIntent()` to the **Workspace brain** (`axis-exec.mjs` `workspace.open`), whose model call received **only Ahmad's sentence** — no board, no ledger, no to-dos, no date. It told the truth about what it had. | `netlify/functions/axis-exec.mjs` |
| S2 | The director's brains received the conversation plus the eight priority rows the page sends (`axisBoardContext`, capped 1500 chars) — no CEO ledger, no assistant store, no worker queue, no clock. | `netlify/functions/axis-director.js`, `assets/axis-app.js` |
| S3 | The CEO-CRITICAL ledger (`senior-director-state/CEO-CRITICAL-ITEMS.md`) lives only on Ahmad's machine (gitignored). No cloud brain had ever seen it. | `scripts/lib/axis-snapshots.mjs` |
| S4 | Every brain guessed the date from the function's UTC clock (Netlify runs in UTC; 21:27 ET is already "October 14"). | all three brains |
| S5 | The `brief` action was built from three assistant lists only. | `axis-exec.mjs` |
| S6 | (Rule-16 sweep) `axis-grants.js` — new in AXIS ONE — had no `must-revalidate` header rule, so a browser would keep its first copy for seven days. | `netlify.toml` |

## What was built

**One Situation Model** — `netlify/functions/lib/axis-situation.cjs`:

```
sources ──► buildSituation() ──► { local clock (America/Toronto), sources{present/missing},
  board (Blobs 'axis-snapshots')        revenue, needsAhmad[ranked], axisCanDo[], deadlines[], counts, text }
  CEO ledger (overview.ceo_critical)
  assistant store (Blobs 'axis-exec')   ──► situationInstruction()  → system prompt of the director (metered API
  Claude worker queue ('axis-brain-jobs')                              + XO bridge), the Workspace brain, the brief
  fleet state / program status (files)  ──► situationBoard()        → the `board` slot the Claude worker reads
  calendar / mailboxes: NOT connected   ──► GET /api/axis/situation → the Overview card + orbit status line
```

Ranking: CEO ledger open rows (70, +10 dated) › client replies (62) › overdue follow-ups (60) › board approvals (58)
› needs-you to-dos (57/50/40) › spend approvals (56) › due-today follow-ups (55) › draft documents with a date (50)
› waiting-reply decisions (48) › ledger Watch rows (45) › failed automations (42) › failed worker jobs (41) › failed
agents (38); then +40 overdue / +30 today / +20 ≤3d / +10 ≤7d. Whole Toronto calendar days, never 24-hour blocks.

**The brains** (`axis-director.js`, `axis-exec.mjs`): every model call now carries the block plus the rules —
answer FROM the list, ranked, next step + who does it; never say you lack access to tasks/board/approvals/to-dos;
the only two unconnected sources are the calendar and the three mailboxes (say so in one line, name the Google
sign-in one-click); use the local date; revenue first; "Faster: …" when a cheaper route exists; HOW HE DECIDES
(revenue first, shortest path, free before paid, recurring over one-time, enterprise + government, no busywork).
Loading is bounded (2.5 s) and never throws — with no block the brain says the board did not answer.

**The ledger bridge** (`scripts/lib/axis-ceo-ledger.mjs` → `computeSnapshots()` → `overview.ceo_critical`): the
worker on Ahmad's machine parses `## Open` (table) and `## Watch` (bullets) each tick. Closed rows stay home;
rows stamped `cleared … Nothing left for Ahmad` are kept but never ranked as needing him. Verified against the
real ledger on his machine: 16 open + 6 watch rows parsed, #1 OVERDUE, one-clicks kept, "none — his send" = none.
The worker's own model jobs (`cowork.ask`, `plan`, tasks) attach the ledger block when the board lacks it.

**The console** (`assets/axis-app.js`, `axis-priorities.js`, `axis-tokens.css`): Overview gains **"Today — needs
you"** (ranked rows · OVERDUE/TODAY/Nd badges · Open / Work it / one-click · "AXIS is handling N" · sources line with
calendar ✗ mailboxes ✗ + the one-click). The original "Needs You Now" card stays (Rule 15). The orbit status line
leads with "N need you · overdue · today" instead of "All quiet" when the situation says otherwise (Rule 14). The
Talk rail, the Priorities screen and the board text the brains read now carry the ledger rows (source "CEO ledger").

## Honesty rails (Rule 14)

- Every source is reported present/missing from what actually answered; a store that timed out is "unavailable",
  never ✓. The bundled seed is an empty baseline — it cannot invent a row.
- Calendar + mailboxes are reported NOT connected until `scripts/gmail-auth.mjs` + `AXIS_GMAIL_*` land (Ahmad's
  Google sign-in — a credential click, his). When that lands, the model gains two more sources and the flags flip.
- The endpoint is read-only and behind the Aperture login; the ledger rows ship text only (no secrets).

## "Remember how I would and grow with me"

- HOW HE DECIDES rides in every call (above). The worker's conversation log (`scripts/lib/axis-conversation-log.mjs`,
  `recallBlock`) and the vault brain (`axis-vault-brain.mjs`) already feed earlier conversations and Obsidian into
  the Claude-worker tier; the situation is the third lane. Corrections Ahmad makes in chat land in the log the same
  way they did before.

## Exit criteria (Rule 16) — met
- `node scripts/run-tests.mjs` 7/7 (guard now includes `tests/axis-situation.test.mjs`, 9 groups); all 45
  `tests/axis-*` suites green; `snapshot-module-parity` + `analytics` green.
- Headless sweep (1440 + 390): 0 page errors; Overview card renders ranked rows at both widths, dark + light;
  phone rows wrap (controls on their own line); no horizontal scroll.
- Ledger parser run against the real file on Ahmad's machine (not a fixture).
- Both shells still byte-identical; push allow-list unchanged (15 modules).

## Still Ahmad's clicks
1. `AHMAD-MERGE-AXIS-ONE.cmd` (lands RUN-CV + AXIS ONE + PRO LOOK + this) → Netlify publish.
2. Google sign-in for the calendar + three mailboxes (`scripts/gmail-auth.mjs`, then `AXIS_GMAIL_*` in Netlify).
3. Keep the worker running on his machine — the CEO ledger reaches the cloud only through its hourly tick.
