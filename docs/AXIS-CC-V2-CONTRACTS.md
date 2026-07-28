# AXIS CC v2 — build contracts (2026-07-28)

Binding interface spec for the CC-BRIEF §2 build. Every module below is written against
THESE shapes. Do not invent fields; if something you need is missing, say so rather than
guessing a name.

## 0. Non-negotiables

- **The UI never computes.** Worker → SQLite → `computeSnapshots()` → Netlify Blobs →
  authed `/api/axis/snapshot` → UI polls. A screen renders `data('<module>')` and nothing else.
- **Zero renders as zero.** No placeholder numbers, no sample rows, no "looks full" padding.
  If a list is empty, render the honest empty state.
- **Nothing sends without a human.** The browser NEVER calls Gmail. It posts an intent;
  the worker executes behind `railsCheck()`.
- **`scripts/axis-seed.mjs` must never run.** It DELETEs 16 tables including 25 real businesses.
- **Do not touch `const NAV`** in `assets/axis-app.js` (line ~46). 15 tabs, exact order, exact labels.
- **Do not import `scripts/lib/axis-private-constants.mjs` from anything under `assets/`.**
  `/assets/*` is world-readable; `/scripts/*` is force-404'd. That module holds the locked
  template, the watched mailbox, and pacing strategy.

## 1. Vanilla ESM, no framework

`axis.html` loads `assets/axis-app.js` as `<script type="module">`. There is no bundler and no
npm at browser runtime. New browser modules are plain `.js` files under `assets/` using
`export`/`import`. No JSX, no TypeScript, no external CDN (a strict CSP is in force).

Shared helpers live in `assets/axis-dom.js` (new, extracted): `el`, `$`, `svg`, `fmtMoney`,
`ago`, `toast`, `postIntent`. Import from there; do not redefine them.

```js
import { el, $, toast, postIntent } from './axis-dom.js';
```

## 2. Snapshot module shapes (read side)

`data(m)` returns `state.snap[m].data || {}`. Shapes the worker guarantees:

```
inbox      { badge:int, counts:{replies,new_requests,snoozed,handled,suppressed},
             rows:[{ id, gmail_message_id, thread_id, business_id, from_email, subject,
                     snippet, body, classification, classify_reason, sysnote,
                     received_at, actioned, actioned_at, snoozed_until, unread }] }
prospects  { count, real_count, rows:[{ id, handle, name, city, industry, size, website,
             linkedin_url, stage, est_monthly_value, is_real, maturity:{it,cyber,cloud,ai},
             maturity_detail, opportunities:[{service,est_mrr,basis,confidence}],
             provenance:{<field>:{value,source_url,confidence,last_verified}},
             contacts:[{ name, title, public_email, linkedin_url, source_url, confidence }] }] }
approvals  { pending:int, rows:[{ id, business_id, channel, kind, subject, body, to_email,
             status, template_id, consent_basis, consent_evidence, facts:[], lint:{},
             created_at, criticality:'critical'|'routine', critical_reason }] }
fleet      { agents:[{ agent, role, status, current_task, last_run_at, duration_ms,
                       ok_24h, fail_24h, streak, summary }],
             runs:[{ id, agent, status, started_at, finished_at, duration_ms, summary,
                     detail, items_in, items_out, error }],
             counts:{ agents, running, ok_24h, fail_24h }, log:[{ ts, agent, level, msg }] }
reports    { lastGenerated, files:[{name,size}], sheets:[],
             daily:[{ date, agent, runs, ok, fail, duration_ms, items }],
             quarterly:[{ quarter, agents, runs, ok, fail, hours, top_agent }],
             trends:{ runs_by_day:[{date,n}], outreach_by_day:[{date,n}], replies_by_day:[{date,n}] } }
analytics  { research:{total,researched,by_city,geo_coverage}, sales:{...,funnel:[]},
             insights:{ pipeline_value, assessed_value, assessed_basis, top_value,
                        by_industry, by_stage, opportunity_mrr },
             pipeline_value, assessed_value, funnel }
overview   { kpis:{ pipeline_value, assessed_value, awaiting_approval, messages_waiting,
                    followups_due, meetings_week, mrr }, needs_you_now:[] }
```

### Money vocabulary — do not mix these up
- `pipeline_value` = real opportunities, open or won. **Today: $0.** This is the Overview KPI.
- `assessed_value` = pre-contact research estimate across prospects. **Today: $77,500.**
  Always render with its `assessed_basis` caption. Never label it "pipeline".

## 3. Intent types (write side)

`postIntent(type, payload)` → `POST /api/axis/intent` → Blobs `axis-inbox` `pending/*` →
worker `applyIntent()` → SQLite → next snapshot. Types added for this build:

```
compose_send      { message_id?, business_id?, contact_email, to_email, subject, body,
                    source:'inbox_reply'|'prospect_outreach', template_id }
                  → human already approved these exact bytes in the composer.
                    Worker runs railsCheck(); on pass sends + writes crm_records;
                    on fail stores status 'held' + the failing rail, never sends.
compose_draft     same payload, but stops at a Gmail draft. Never transmits.
agent_run_request { agent, task }        → Fleet "Run now"
issue_file        { area, severity, detail, agent }  → Director self-heal filing
```

Existing types stay as they are (`draft_reply`, `approve`, `reject`, `stage_override`, …).

### Optimistic UI + rollback
Every write: mutate local state, render, then `await postIntent(...)`. On a falsy result,
restore the pre-mutation value, re-render, and `toast()` the failure. Never leave the UI
claiming a success the worker did not confirm.

## 4. The composer (built ONCE, used by A and B)

`assets/axis-composer.js`

```js
export function openComposer({ mode, to, subject, body, businessId, messageId, templateId,
                               onSent }) // → renders an overlay OVER the current screen
```

Hard requirements:
- Opens as an overlay on the **current** screen. It must not call `go()`, must not set
  `state.module`, must not clear `state.ui.thread` / `state.ui.prospect`. **Zero navigation.**
- Shows the **exact bytes that will send**, including the CASL footer, in an editable
  `<textarea>`. What the operator reads is what transmits.
- Live edit → Send. Esc / backdrop click closes. Focus trapped while open.
- Footer shows the live rail read-out (daily cap, quiet hours, suppression, template lock).
- Send is disabled while any hard rail fails, with the reason named in plain words.
- On success: `toast`, close, `onSent()`.

Prospect mode pre-fills from the **LOCKED template** (`generateOutreach()` server-side shape,
mirrored to the client via the approvals/outreach snapshot). **Never re-type the copy in the
browser.** The client only ever *displays* a body the worker produced.

## 5. Charts (`assets/axis-charts.js`)

Self-contained inline SVG, no library, theme-aware via CSS custom properties
(`--gold`, `--c1`..`--c6`, `--txt-2`, `--surface-3`). Every chart must:
- degrade to an honest empty state when the series is empty (never draw a fake baseline);
- expose hover tooltips + keyboard focus on each mark;
- scroll inside `overflow-x:auto` rather than overflowing the page.

Exports: `lineChart`, `areaSpark`, `barChart`, `stackedBar`, `donut`, `heatCal`, `funnelChart`.

## 6. Criticality bar for the AXIS tab (E)

Only two things reach the Director's approval queue:
- **cost** — spends money, or commits to spending it.
- **reputation** — leaves the building under the company name (any outbound email, any
  public artifact), or touches a named third party.

Everything else auto-proceeds and is reported after the fact in the activity log.
Classifier lives worker-side in `scripts/lib/axis-criticality.mjs` and stamps
`criticality` + `critical_reason` onto each approvals row. The UI filters, never decides.
