# AXIS works the list with you — RUN-AX3 (2026-10-15)

**Branch:** `cc/axis-tasks-2026-10-15` (from `b42dfea7`). Code only — deploys nothing; Ahmad's merge + Netlify
publish land it.

## The ask (Ahmad, 2026-10-15)

> "AXIS cannot see the live task view, the to-do list of the company so we can work on it together and get things
> actioned. Fix this issue so it can view everything … and edit, adjust, modify, remove, delete, update, action,
> follow up, reject, approve, cancel, acknowledge, reply, etc."

## Why it could not (findings)

| # | Finding | Where |
|---|---------|-------|
| T1 | RUN-AX2 gave every brain the *ranked text* of the situation, but no ids and no way to act. "Mark that one done", "snooze this", "approve the first one" were declined in the console with "I can't do that one by voice yet" — by design, there was no rail. | `assets/axis-priorities.js` `unsupportedBoardCommand`, `assets/axis-app.js` `axisSend` |
| T2 | "Let's work on the top urgent items" was routed by `workspaceIntent()` to the Workspace brain (a document writer) before the director ever reasoned about it. | `netlify/functions/axis-director.js` |
| T3 | The sources lived in five places with five shapes (assistant to-dos/approvals/automations, the worker's board rows, the CEO ledger on Ahmad's machine, the Claude worker queue, the fleet state file) and no shared id, so nothing could say "this row" to anything else. | — |
| T4 | Rows this side cannot write (the ledger file, the worker's SQLite rows) had no way to be acknowledged/snoozed/done, so a handled item kept ranking as "needs you" forever. | `lib/axis-situation.cjs` |
| T5 | `axis-director.js` is a Lambda-compatibility function: Netlify hands it no Blobs context (measured 2026-08-11 in `lib/axis-brain.cjs`, again 2026-10-14 in `lib/sentinel-store.cjs`), and strong reads are impossible there even after `connectLambda`. A tool loop that read/wrote Blobs in-process would have failed live. | `netlify/functions/axis-director.js` |

## What was built

```
 every source ──► lib/axis-tasks.cjs  listTasks()  ── ONE list, stable ids, actions per row, audit (last 5)
   axis-exec: todos · tasks · approvals ·             mutate()     ── update · complete · reopen · archive ·
              followups (new) · workspace ·                           snooze · follow_up · approve · reject ·
              local-jobs                                              acknowledge · cancel · assign ·
   axis-snapshots: overview.ceo_critical ·                            draft_reply · create
              followups · approvals · inbox ·            │
              documents · waiting_reply                  ▼
   axis-brain-jobs · _axis-state-full.json      /api/axis/tasks  (v2, Aperture-gated, no-store)
   axis-task-overlay · axis-task-audit                ▲         ▲
                                                      │         └── assets/axis-tasks.js — the Live task view
 axis-director.js ── task ask? ── lib/axis-task-loop.cjs ─┘          (Overview panel + full screen)
                                  Anthropic tools, ≤ 8 calls, receipts from the audit
```

### 1. One live task model — `netlify/functions/lib/axis-tasks.cjs`
`listTasks({ getStore, now })` returns `{ ok, generatedAt, local, items, counts, filters, sources, overlay, situation }`.
Each item: `{ id, source, label, kind, title, detail, status, priority, due, dueLabel, owner, createdAt, updatedAt,
actions[], next, needsMe, axisHandling, rank, draft, staged, followUps, parent, overlay, audit[≤5] }`.

* **status** is one of `open · done · snoozed · archived · approved · rejected · cancelled · acknowledged` and comes
  from the store (or the overlay store) — never inferred. A ledger row stamped `cleared` reads `done` because the
  ledger says so.
* **needsMe / rank** come from the situation model (`buildSituation`, now with ids), so the list, the Overview's
  "Today — needs you" card and every brain rank the same rows the same way.
* **sources** says, per store, whether it answered: `exec: ok | partial (names the keys) | unavailable`,
  `board: live | seed | missing`, `overlay`, `audit`, `queue`. A store that did not answer is reported
  unavailable and its rows are absent — never shown as "nothing open" (Rule 14).

### The id scheme (`lib/axis-task-ids.cjs`)
`<source>:<key>` — the key is the source's own id, never a list position.

| Source | Id | Store |
|---|---|---|
| to-do | `todo:<todo.id>` | Blobs `axis-exec` / `todos` |
| follow-up AXIS created | `followup:<fu.id>` | `axis-exec` / `followups` (new key) |
| automation | `automation:<task.id>` | `axis-exec` / `tasks` |
| assistant approval | `approval:<apr.id>` | `axis-exec` / `approvals` |
| Axis Local command | `pc:<job.id>` | `axis-exec` / `local-jobs` |
| CEO ledger row | `ledger:#5` (the ledger's own number); Watch bullet `ledger:watch-<sha1(what)[0..8]>` | `axis-snapshots` / `overview.ceo_critical` |
| board follow-up | `board-followup:<follow_ups.id>` | `axis-snapshots` / `followups` |
| board approval (outreach draft) | `board-approval:<outreach_items.id>` | `axis-snapshots` / `approvals` |
| client message | `inbox:<inbox_messages.id>` | `axis-snapshots` / `inbox` |
| draft document | `document:<documents.id>` | `axis-snapshots` / `documents` |
| waiting-reply thread | `waiting:<outreach_item id>` (aggregate: `waiting:needs-delegation`) | `axis-snapshots` / `waiting_reply` |
| Claude worker job | `job:<job.id>` | `axis-brain-jobs` |
| failed agent | `agent:<name>` | `_axis-state-full.json` |

A row with no store id gets `h-<sha1 of its identifying fields>` — still stable. Ids do not change when rows
re-rank, re-sort or a worker tick republishes (tested by shuffling every store).

### The overlay (`axis-task-overlay`, key `rows`)
One record per row id: `{ status, until, sig, edits, draft, staged, followUps, at, by, via }`. It is how a row
this side **cannot write** (the ledger file on Ahmad's machine, the worker's SQLite rows, worker jobs, the fleet
file) is acknowledged / snoozed / done / archived / edited — without touching its own store.

* `acknowledged · done · archived · cancelled · rejected · approved` take the row out of the "needs Ahmad"
  ranking; `snoozed` does until `until` passes, then the row is back on its own.
* An acknowledgement remembers the row's signature (`sig`: what, deadline, overdue, cleared…). When the row
  itself changes — a new deadline, the ledger stamps it OVERDUE — the acknowledgement lapses and the row ranks
  again. A new development never hides behind an old "seen it".
* Honoured by: `buildSituation` / `loadSituation` (the Overview card, `/api/axis/situation`, every brain's
  system block), `scripts/lib/axis-ceo-ledger.mjs` (`applyLedgerOverlay`, `ceoLedgerBlock({ overlay })` — the
  worker reads the overlay once a minute for the ledger block its model jobs carry), and the console's
  `collectPriorities` (Priorities screen, Talk rail, the board text the brains read) via `setTaskOverlay`.
* The ledger file is never edited, and `computeSnapshots` still ships every row — so any row can be found and
  reopened.

### Mutations (each returns `{ ok, action, item, audit, receipt }`, each audited)
| Action | What it does |
|---|---|
| `update` | title / detail / due / priority / owner — the store for to-dos, follow-ups, automations; the overlay for rows this side cannot write |
| `complete` / `reopen` | to-do `done`, follow-up `status`; overlay `done` elsewhere (a client message also queues the console's own `mark_handled` intent) |
| `archive` (= delete / remove) | **never a hard delete**: to-do `archived:true`, follow-up `status:'archived'`, automation paused + `archived`, overlay elsewhere. Archived rows stay readable under *Done / archived* and can be reopened (Rule 15). |
| `snooze(until)` | overlay `snoozed` until a future Toronto date |
| `follow_up(when, note, owner)` | creates a dated `followup:` item linked to its parent (`parent`, parent's `followUps`) |
| `approve` / `reject` | `approvals.decide` semantics on the assistant store; the console's own `approve`/`reject` intents for board drafts; `local.decide` for PC commands. See "the approval gate" below. |
| `acknowledge` | overlay `acknowledged` + the row's signature |
| `cancel` | automation → paused; approval → `cancelled`; follow-up → `cancelled`; PC job → declined; board follow-up → the console's `cancel_followup` intent (the worker applies it); board draft → `skip` intent |
| `assign(agent)` | queues the director's own `{action:'command', agent, intent}` to `axis-inbox`; owner → `agent:<Name>` (a waiting thread queues the Waiting Reply `delegate_followup` intent the worker applies) |
| `draft_reply(text)` | writes a `Reply draft: …` document into `axis-exec` / `workspace` (`reply_for`, `status:'draft'`); the row shows **draft ready**. Nothing is sent. |
| `create` | a to-do (`todos.add` shape + `due`, `owner`) |

Every mutation writes `axis-task-audit` / `log` (newest first, capped 2000):
`{ at, actor: "ahmad"|"axis", action, id, before, after, via: "chat"|"voice"|"console" }`. A refused action
writes nothing. Bookkeeping that fails *after* the real action (an intent already queued) is reported
(`overlayWritten:false`) rather than turned into "nothing changed".

### 2. The endpoint — `netlify/functions/axis-tasks.mjs` (`/api/axis/tasks`)
`GET [?filter=open|needs-me|axis|approvals|follow-ups|snoozed|done|all][&q=…][&situation=1]` →
`{ ok, generatedAt, local, items, counts, filters, sources, overlay[, situation] }`.
`POST { action, id | match, …fields, via }` → a mutation. 401 without the Aperture login; 400 unknown action / id /
bad field; 409 an ambiguous `match` (with up to 3 `candidates`) or an action the row does not offer (with its
`actions`); 503 a store did not answer (nothing changed). `Cache-Control: no-store` on every answer. No
`netlify.toml` block: it reaches no heavy external (the externals guard agrees).

### 3. The director acts — `lib/axis-task-loop.cjs` + `axis-director.js`
A task ask (`taskIntent`: "what's on my list", "what needs me", "let's work on the top items", "Let's work on: …",
and a verb on an item — done, snooze, follow up, approve, reject, cancel, archive / delete / remove,
acknowledge, assign to <Agent>, draft a reply, rename, change the due date, add … to my list) is checked
**before** the Workspace route and **before** the cascade. The turn:
1. reads the list + the situation once, `GET /api/axis/tasks?situation=1` with Ahmad's own bearer (the v2
   function has Blobs; the director does not — finding T5);
2. builds the system prompt: persona + **the task rules** + `situationInstruction()` + the live list with ids;
3. runs Anthropic Messages with the 14 tools (`list_tasks, update_task, complete_task, reopen_task,
   archive_task, snooze_task, follow_up, approve, reject, acknowledge, cancel, assign_to_agent, draft_reply,
   create_task`), **at most 8 tool calls**, then forces an answer (`tool_choice: none`);
4. every tool POSTs to `/api/axis/tasks` with `actor:"ahmad"` and `via:"chat"|"voice"` — set by the executor,
   never by the model (a model asking for `via:"console"` still only stages a sending approval);
5. composes the reply: **one receipt per action that actually ran, built from the endpoint's answer (the
   audit)**, then the model's text with (a) any glyph-led line removed, (b) any sentence claiming an action
   that did not run this turn dropped, (c) any first-person "I don't have access to your tasks…" replaced by the
   list itself, (d) an ambiguous target turned into one short question naming the top 3 candidates.

Model: `AXIS_MODEL_TASKS` → `AXIS_MODEL_FAST` → `claude-haiku-4-5` (the whole turn must fit the function's
~10 s; the loop budgets 9 s from the handler's first line). No key → a list ask is answered from the list ($0)
and an action ask says nothing changed. List unreadable → `degraded`, `reason:'tasks_unavailable'`, and the
console falls back to its old local rails. Model call refused → the body is classified like axis-director's
`classifyBrainError` (same codes: `no_credit` · `auth` · `permission` · `bad_model` · `rate_limit` · `overloaded` ·
`unreachable` · `error_<status>`), logged as `[axis-task-loop] Anthropic <status> <body>`, and the reply carries
`degraded:true` + `reason` + `modelError` — a list ask is still answered from the list, an action ask says in one
sentence why nothing changed (the console badge reads "brain: out of credit", "brain: key rejected", …).

**Found live 2026-10-15 (first real turn on iisupp.net):** the list, the panel and the $0 list answers work; the
metered tool loop itself was refused by the Anthropic account with HTTP 400, which the old reply reported only
as "(400)". Until Ahmad funds that account (or the local Max-plan worker takes the turn), AXIS reads and ranks
the live list but does not act on it by voice/chat — the panel's own buttons (Done · Snooze · Draft reply · Work
it) are unaffected, they call `/api/axis/tasks` directly.

**The receipt contract** — glyph + verb + the row's title:
`✔ Done: …` · `↩ Reopened: …` · `🗄 Archived: …` · `⏰ Snoozed … to Fri Oct 16` · `🔁 Follow-up set for … — Mon Oct 19` ·
`✔ Approved: …` · `🖐 Your click: approve … — it sends; the button is waiting in the Live task view` ·
`✖ Rejected: …` · `👁 Acknowledged: …` · `⊘ Cancelled: …` · `👤 Assigned … to Pitch — queued for its next run` ·
`📝 Reply drafted for … — your send` · `✎ Updated …: due Fri Oct 17` · `➕ Added: …`.
The reply carries `receipts[]`, `actions[]`, `staged[]`, `tasksChanged`, `toolCalls`. The console speaks the
receipts as words (the glyphs are stripped by `axisHumanizeForSpeech`).

**Voice.** Push-to-talk and hands-free turns go through `axisSend` → the same director path, with
`via:"voice"`; the receipts are shown in the transcript and spoken. The *live call* (the XO bridge's realtime
voice, `aria-live-voice.js`) is a separate brain hosted in the XO app: it cannot call these tools, and its
"workspace" action reaches the Workspace brain — which now carries the live list in its prompt, so it no longer
answers "no access" either.

### 4. The console — `assets/axis-tasks.js`
* **Overview panel** "Live task view — N open · M need you · K AXIS handling": the top six open rows (needs-you
  first) with Done · Snooze · Approve/Reject · Draft reply · Work it, the sources line, and the way in. The
  "Today — needs you" and "Needs You Now" cards are unchanged (Rule 15).
* **Full screen** (`SCREENS.tasks`, reached from Priorities' new entry card, the Overview panel, the Actions menu
  and "Open" on an AXIS follow-up): counts, filters (Needs me · AXIS handling · Approvals · Follow-ups · Snoozed ·
  Done / archived · All open), search, and per row: Done · Snooze ▾ · Follow up · Approve — your click / Reject ·
  Acknowledge · Cancel · Edit (title + due, inline) · Assign ▾ · Archive · Draft reply / Open draft (→ Copy, or
  for a client message **Review & send** in the existing composer) · Work it · Open, plus the row's last audit.
* Optimistic: a click moves the row at once; the server's item + receipt replace it; a refusal puts it back and
  says why. Approving something that sends, spends or runs a command asks first ("Approving sends it").
* Refresh every 30 s, and **at once** when a chat or voice turn changed the list (the console dispatches
  `axis:tasks-changed` with the receipts). Any change also re-ranks "Today — needs you".
* The chat routes task asks to the director's task loop first; board.remove's spoken confirm, the board's count
  answers and the honest "can't do that by voice yet" are untouched and are the fallback when that path does not
  answer. The To-do tab hides archived to-dos (with a count) — they stay readable in the Live task view.
* Phone width 390: rows wrap, controls drop to their own line, no horizontal scroll. Dark and light: theme tokens
  only.

## What still needs Ahmad's click (by design)
1. **Anything that sends, pays, publishes or runs a command on his PC.** Approving a reply/outreach draft, a spend
   above $0, or an Axis Local command from chat or voice is *staged* ("🖐 Your click…"); the Live task view's
   Approve button (via `console`) is the click. The cron still sends approved replies — one place sends mail.
2. Sending a drafted reply — "Review & send" opens the existing composer; its send button is his.
3. Board intents the worker does not yet apply (`approve`, `reject`, `skip`, `mark_handled`, `snooze` on board rows)
   are queued exactly as the console's own buttons queue them and are held by the worker for him, as before;
   AXIS's list reflects the decision immediately through the overlay. `cancel_followup` and `delegate_followup`
   are applied by the worker.
4. The merge + Netlify publish; the Google sign-in for the calendar and mailboxes (unchanged from RUN-AX2).

## Tests (all registered in the root GUARD and the desktop registry)
| Suite | Proves |
|---|---|
| `tests/axis-tasks-model.test.mjs` (8 groups) | every source on one list; stable ids (shuffled stores, hash ids); every mutation on every source with its store effect and receipt; archive never deletes; the audit shape and per-row last 5; the overlay honoured by `loadSituation`/`buildSituation`, the ledger consumers and `collectPriorities` (snooze ends, acknowledgement lapses on change); unavailable ≠ empty; refusals write nothing; Toronto dates |
| `tests/axis-tasks-endpoint.test.mjs` (6 groups) | 401 (none / forged / expired), 405 (no DELETE), GET shape, `no-store`, filters, `?situation=1`, 400 / 409 / 503 shapes, the approval gate over HTTP, camelCase actions, no mail / payment / model path in the handler, the literal config path |
| `tests/axis-director-tools.test.mjs` (8 groups) | the real director with a fake model emitting `tool_use`: the 14 tools and no send/pay/publish tool; the roster enum matches the director; "let's work on top urgent items" → `list_tasks` → ranked answer, never the Workspace; two tools in one voice turn → receipts equal the audit; the model's own claims and glyph lines dropped; the max-8 bound; ambiguity → one question with the candidates; archive/cancel/reject run immediately; the forbidden "I don't have access" replaced; no-key / list-down / model-down fallbacks; the browser and server detectors agree; spoken receipts |
| `tests/axis-tasks-console.test.mjs` (24 checks) | headless Chromium against the real endpoint: the panel renders the endpoint's rows and counts; a Done click POSTs `via:"console"` and the row updates from the server; Priorities → the full screen; the filters; a chat action refreshes the list at once; 1440 + 390 × dark + light; no horizontal scroll; 0 page errors. Skips with a clear line where Playwright/Chromium are absent. |

Also kept green: `tests/axis-situation.test.mjs` (9 groups), `tests/netlify-function-externals.test.mjs`,
`tests/netlify-function-config-static.test.mjs`, every `tests/axis-*` suite, `node scripts/suite-census.mjs`
(0 UNEXPLAINED). `tests/axis-remove-scenarios.test.mjs` records the graduation of "mark that one done / snooze
this / approve the first one" from the honest decline to the task rail.

Run: `node scripts/run-tests.mjs` · `node tests/axis-director-tools.test.mjs --transcript` (prints the fake-model
turns) · `AXIS_SHOTS_DIR=<dir> node tests/axis-tasks-console.test.mjs` (screenshots).

## Follow-up worth doing (not done here)
The director's *general* (non-task) path still loads the situation in-process (`loadSituationSafe({ fnDir:
__dirname })`); by finding T5 that read cannot reach Blobs in a Lambda-compat function, so those turns likely see
the bundled seed with "assistant store unavailable". Task asks are unaffected (they read through the v2 endpoint).
Reading `/api/axis/situation` over HTTP for the general path too would close it; it was left out of this run
because it adds a round trip ahead of the cascade's 7.8 s Max-plan wait inside a 10 s function.
