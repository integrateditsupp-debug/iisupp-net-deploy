// tests/axis-situation.test.mjs — RUN-AX2 "AXIS sees everything" (2026-10-13).
//
// Ahmad asked AXIS "let's work on top urgent items" and the Workspace brain answered: "I don't have
// access to your tasks, calendar, or work messages here … Reference date: October 14, 2026 (fallback;
// workspace local date and time zone unavailable)". This suite fails the moment any brain can be
// called without the situation block, the moment the block guesses the date from UTC, the moment a
// source it does not have is reported as present (Rule 14), and the moment his own CEO ledger stops
// out-ranking the agents' rows. Run: node tests/axis-situation.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const require = createRequire(import.meta.url);
const S = require(path.join(ROOT, 'netlify/functions/lib/axis-situation.cjs'));
const L = await import(pathToFileURL(path.join(ROOT, 'scripts/lib/axis-ceo-ledger.mjs')).href);
const P = await import(pathToFileURL(path.join(ROOT, 'assets/axis-priorities.js')).href);
let n = 0; const ok = () => { n++; };

// A Toronto evening: 2026-10-13 21:50 EDT is already 2026-10-14 in UTC — the exact trap the brain fell into.
const NOW = new Date('2026-10-14T01:50:00Z');

// ---- 1. The clock is Toronto's, never UTC's ----
{
  const c = S.localClock(NOW);
  assert.equal(c.date, '2026-10-13', 'local date is the Toronto date, not the UTC date');
  assert.equal(c.time, '21:50');
  assert.equal(c.weekday, 'Tuesday');
  assert.equal(c.tz, 'America/Toronto');
  ok();
}

// ---- 2. The ledger parser reads the real ledger's shape ----
const LEDGER = `# CEO-CRITICAL ITEMS — the one ledger

Row format: what · who · deadline · category · source · one-click · found by · on · status

## Open

| # | what | who is waiting | deadline | category | source file | one-click | found by · on | status |
|---|---|---|---|---|---|---|---|---|
| 1 | Answer the HEC IT-RFP question (bid intent 2026-10-19, closes 2026-10-26) | the agency's desk | **2026-10-09T12:00-04:00** | deadline-14d | \`aria-vault/Chat-Sync/2026-10-08.md\` | none | Cowork · 2026-10-09 | **OVERDUE** — question window passed · calendar \`abc\` |
| 2 | Run \`AHMAD-MERGE-RUN-CU.cmd\` then publish | every fix | none (oldest delivery was 58 days on 2026-10-08) | decision | \`NEEDS-AHMAD.md\` | \`AHMAD-MERGE-RUN-CU.cmd\` (his machine) | Cowork · 2026-10-09 | open · calendar \`x\` |
| 5 | Fix the Apollo payment method (card declined 2026-10-07) | enrichment, outbound | none | payment | \`aria-vault/Chat-Sync/2026-10-08.md\` | Apollo billing page | Cowork · 2026-10-09 | open |
| 9 | Suite-census 14-day clock | the test programme | **2026-10-22** | deadline-14d | \`ledger.md\` | none — a CC task | Cowork · 2026-10-09 | **cleared 2026-10-09 18:10Z by RUN-BX** (0 pending). Nothing left for Ahmad |
| 10 | Two warm LinkedIn leads due a follow-up | two contacts | not recorded | person-waiting | \`leads.md\` | none — his send | Cowork · 2026-10-09 | open |
| 15 | Portals: log into CanadaBuys once (CDIC closes 2026-10-29) | the bid hunters | none (CDIC 2099-10-29) | credential/portal | \`src.md\` | none | Cowork · 2026-10-09 | open · calendar \`y\` |
| 16 | Confirm the second digest address | the CEO channel | none | decision | this file | reply in any chat | Cowork · 2026-10-09 | open | CLOSED 2026-10-09 22:51 ET: answered "no" |

## Watch — enters the 14-day window on the date shown (not yet critical)
- 2026-10-15 → CDIC RFSA closes **2026-10-29**; Ottawa RFSO closes **2026-10-31** — same source.
- "CSA cybersecurity — Oct 15" appears in the audit with no detail; verify before it becomes a row.

## Channel log
- 2026-10-09 12:50 EDT · email sent.

## Parked
(none)

## Closed
| 16 | Confirm the second digest address | the CEO channel | none | decision | this file | reply in any chat | Cowork · 2026-10-09 | open | CLOSED 2026-10-09 22:51 ET |
`;
const rows = L.parseCeoLedger(LEDGER);
{
  const open = rows.filter((r) => r.section === 'open');
  const watch = rows.filter((r) => r.section === 'watch');
  assert.equal(open.length, 7, 'every Open row parsed (row 16 in Open parses; its Closed twin is skipped by section)');
  assert.equal(watch.length, 2, 'both Watch bullets parsed');
  const r1 = open.find((r) => r.n === 1);
  assert.equal(r1.deadline, '2026-10-09T16:00:00.000Z', 'a bold ISO deadline with offset is kept exactly');
  assert.equal(r1.overdue, true, 'the ledger\'s own OVERDUE stamp is read');
  assert.equal(r1.one_click, null, '"none" is no one-click');
  assert.match(r1.status, /OVERDUE/);
  const r2 = open.find((r) => r.n === 2);
  assert.equal(r2.deadline, null, '"none (…)" is no hard deadline');
  assert.equal(r2.soft_date, null, 'a past date inside "none (…)" is not a soft date');
  assert.match(r2.one_click, /AHMAD-MERGE-RUN-CU\.cmd/, 'backticked one-click survives the pipe split');
  const r9 = open.find((r) => r.n === 9);
  assert.equal(r9.cleared, true, '"cleared … Nothing left for Ahmad" is read as cleared');
  assert.equal(r9.deadline, '2026-10-23T03:59:00.000Z', 'a bare date means end of that day, Toronto');
  const r10 = open.find((r) => r.n === 10);
  assert.equal(r10.one_click, null, '"none — his send" is still none');
  assert.equal(r10.deadline, null, '"not recorded" is no deadline');
  const r15 = open.find((r) => r.n === 15);
  assert.equal(r15.soft_date, '2099-10-29', 'a future date inside "none (…)" is a soft date');
  const r16 = open.find((r) => r.n === 16);
  assert.equal(r16.closed, true, 'a tenth cell saying CLOSED closes the row');
  assert.equal(watch[0].deadline, '2026-10-30T03:59:00.000Z', 'the first bold date on a Watch bullet is its close');
  assert.equal(watch[0].soft_date, '2026-10-15', 'the leading date is when it enters the window');
  assert.equal(watch[1].deadline, null, 'a Watch bullet without a date has none');
  // readCeoLedger on a machine without the ledger → [] and never throws
  assert.deepEqual(L.readCeoLedger(path.join(ROOT, 'tests')), []);
  const blk = L.ceoLedgerBlock(rows);
  assert.match(blk, /^CEO-CRITICAL LEDGER \(Ahmad's own list, 5 open\):/, 'block counts open minus cleared minus closed');
  assert.match(blk, /#1 .*OVERDUE/);
  assert.ok(!/#9 /.test(blk), 'cleared rows stay out of the block');
  ok();
}

// ---- 3. The situation ranks his ledger first, reports sources honestly, speaks the local date ----
const FIX = {
  now: NOW,
  source: 'live',
  snapshots: {
    overview: { data: { kpis: { pipeline_value: 68000, mrr: 1200 }, needs_you_now: [], ceo_critical: rows } },
    followups: { data: { overdue: [{ company: 'Lead-041', due_at: '2026-10-11T13:00:00Z' }], due_today: [{ company: 'Lead-042', due_at: '2026-10-13T20:00:00Z' }], upcoming: [] } },
    inbox: { data: { rows: [{ subject: 'Re: network audit quote', from: 'client', classification: 'reply_to_outreach', received_at: '2026-10-12T15:00:00Z' }] } },
    approvals: { data: { rows: [{ status: 'pending', subject: 'Follow-up to Lead-007' }] } },
    waiting_reply: { data: { needs_delegation: 2 } },
    documents: { data: { rows: [{ title: 'Proposal — 141 Bay', status: 'draft', due_at: '2026-10-16T12:00:00Z' }] } },
    pipeline: { data: { cards: [{}, {}, {}] } },
  },
  exec: {
    todos: [{ title: 'Sign the Whereby cancel', needsYou: true, priority: 'high', done: false }, { title: 'Draft Q4 newsletter', needsYou: false, done: false }],
    tasks: [{ title: 'Nightly backup check', status: 'active', every_minutes: 1440, runs: 12, last_result: { summary: 'ok' } }, { title: 'Apollo refresh', status: 'active', every_minutes: 60, last_result: { error: 'card declined' } }],
    approvals: [{ title: 'Buy domain', kind: 'spend', costUsd: 12, status: 'pending', detail: 'iisupport.ca' }],
    attention: [],
  },
  queue: { online: true, jobs: [{ id: 'q1', kind: 'research.web', arg: 'grant scan', t: 1, state: 'working' }, { id: 'q2', kind: 'code.build', arg: 'fix tests', t: 2, state: 'failed', error: 'exit 1' }] },
  state: { agents: [{ name: 'Sentry', status: 'ok' }, { name: 'Scout', status: 'failed', note: 'no token' }] },
  status: { ok: true },
};
const sit = S.buildSituation(FIX);
{
  assert.equal(sit.ok, true);
  assert.equal(sit.local.date, '2026-10-13', 'the situation carries the Toronto date');
  assert.match(sit.text, /^Local time: Tuesday 2026-10-13 21:50 \(America\/Toronto\)\./, 'the first line is the local clock');
  // sources: honest flags
  assert.equal(sit.sources.board, 'live');
  assert.equal(sit.sources.ceo_ledger, true);
  assert.equal(sit.sources.exec, true);
  assert.equal(sit.sources.worker_online, true);
  assert.equal(sit.sources.calendar, false, 'calendar is NOT connected and says so');
  assert.equal(sit.sources.mailboxes, false, 'mailboxes are NOT connected and say so');
  assert.match(sit.text, /calendar NOT connected · mailboxes NOT connected \(one-click: Google sign-in/);
  // ranking: his overdue ledger row first; cleared + closed ledger rows absent; watch rows present but low
  assert.match(sit.needsAhmad[0].title, /^#1 Answer the HEC/, 'the OVERDUE CEO-ledger row ranks first');
  assert.equal(sit.needsAhmad[0].source, 'CEO ledger');
  assert.equal(sit.needsAhmad[0].dueLabel, 'OVERDUE 4d');
  assert.ok(!sit.needsAhmad.some((i) => /^#9 /.test(i.title)), 'a cleared ledger row does not need him');
  assert.ok(!sit.needsAhmad.some((i) => /^#16 /.test(i.title)), 'a closed ledger row does not need him');
  const titles = sit.needsAhmad.map((i) => i.title);
  assert.ok(titles.some((t) => /Follow-up: Lead-041/.test(t)), 'overdue follow-up present');
  assert.ok(titles.some((t) => /Client: Re: network audit quote/.test(t)), 'client reply present');
  assert.ok(titles.some((t) => /Approve: Follow-up to Lead-007/.test(t)), 'board approval present');
  assert.ok(titles.some((t) => /Sign the Whereby cancel/.test(t)), 'needs-you to-do present');
  assert.ok(titles.some((t) => /Approve: Buy domain/.test(t)), 'spend approval present');
  assert.ok(titles.some((t) => /Automation failed: Apollo refresh/.test(t)), 'failed automation present');
  assert.ok(titles.some((t) => /Claude job failed: fix tests/.test(t)), 'failed worker job present');
  assert.ok(titles.some((t) => /Agent Scout: failed/.test(t)), 'failed agent present');
  assert.ok(titles.some((t) => /CDIC RFSA closes/.test(t)), 'watch row present');
  const watchIdx = titles.findIndex((t) => /CDIC RFSA/.test(t));
  const apolloIdx = titles.findIndex((t) => /^#5 Fix the Apollo/.test(t));
  assert.ok(apolloIdx < watchIdx, 'an open undated ledger row outranks a watch row');
  // the undated to-do must rank below any dated item that is due within the week
  const lead042 = titles.findIndex((t) => /Lead-042/.test(t));
  assert.ok(lead042 >= 0 && lead042 < titles.findIndex((t) => /Buy domain/.test(t)), 'due-today outranks undated');
  // what AXIS carries
  assert.ok(sit.axisCanDo.some((x) => /Nightly backup check/.test(x.title)), 'healthy automation is AXIS work');
  assert.ok(sit.axisCanDo.some((x) => /Draft Q4 newsletter/.test(x.title)), 'non-needsYou to-do is AXIS work');
  assert.ok(sit.axisCanDo.some((x) => /grant scan/.test(x.title)), 'a working worker job is AXIS work');
  assert.ok(!sit.axisCanDo.some((x) => /Apollo refresh/.test(x.title)), 'a failed automation is not "handled"');
  // revenue line
  assert.deepEqual(sit.revenue, { pipeline_value: 68000, mrr: 1200, open_deals: 3 });
  assert.match(sit.text, /pipeline \$68,000 · MRR \$1,200 · 3 open deals/);
  // counts
  assert.equal(sit.counts.needsAhmad, sit.needsAhmad.length);
  assert.ok(sit.counts.overdue >= 2, 'ledger #1 and Lead-041 are overdue');
  // the one-click rides in the text
  assert.match(sit.text, /one-click: Apollo billing page/);
  // never the wrong sentence
  assert.ok(!/don't have access|do not have access/i.test(sit.text));
  // deadlines list
  assert.ok(sit.deadlines.length >= 3);
  ok();
}

// ---- 4. Empty inputs: honest, never a fabricated row ----
{
  const e = S.buildSituation({ now: NOW, snapshots: {}, source: 'missing', exec: null, queue: { online: false, jobs: [] }, state: null, status: null });
  assert.equal(e.needsAhmad.length, 0);
  assert.equal(e.sources.board, 'missing');
  assert.equal(e.sources.exec, false);
  assert.match(e.text, /assistant store unavailable/, 'a store that did not answer is said to be unavailable, not ✓');
  assert.match(e.text, /NEEDS AHMAD: nothing on the board right now/);
  ok();
}

// ---- 5. The instruction every brain gets ----
{
  const ins = S.situationInstruction(sit);
  assert.match(ins, /^LIVE SITUATION \(read this before answering/);
  assert.match(ins, /generated 2026-10-13 21:50 America\/Toronto/);
  assert.match(ins, /Never say you lack access to his tasks, board, approvals or to-dos/);
  assert.match(ins, /calendar and the three mailboxes/);
  assert.match(ins, /Use the local date above; never guess the date/);
  assert.match(ins, /SMARTER PATH/);
  assert.match(ins, /HOW HE DECIDES/);
  assert.match(ins, /revenue first; shortest path first; free before paid; recurring contracts over one-time jobs/);
  const board = S.situationBoard(sit, 'Priority board on screen (top 2 of 2):\n1. x');
  assert.match(board, /^LIVE SITUATION \(Tuesday 2026-10-13 21:50 America\/Toronto;/);
  assert.match(board, /Priority board on screen/, 'the client\'s own board rides after the situation');
  assert.equal(S.situationBoard(null, 'just the board'), 'just the board', 'no situation → the client board alone');
  ok();
}

// ---- 6. The loader is bounded and never throws, even with no Blobs and a bogus dir ----
{
  const t0 = Date.now();
  const got = await S.loadSituationSafe({ now: NOW, fnDir: path.join(ROOT, 'does-not-exist'), timeoutMs: 3000 });
  assert.ok(Date.now() - t0 < 3500, 'returns inside the timeout');
  assert.ok(got === null || (got.ok === true && got.sources.state === false), 'null or a situation with the missing files reported missing');
  const seeded = await S.loadSituationSafe({ now: NOW, fnDir: path.join(ROOT, 'netlify/functions'), timeoutMs: 4000 });
  if (seeded) {
    assert.equal(seeded.local.date, '2026-10-13');
    assert.ok(['seed', 'live', 'missing'].includes(seeded.sources.board));
  }
  ok();
}

// ---- 7. Every brain is wired — static guards on the functions ----
{
  const director = read('netlify/functions/axis-director.js');
  assert.match(director, /require\('\.\/lib\/axis-situation\.cjs'\)/, 'director loads the situation module');
  assert.match(director, /const situation = await loadSituationSafe\(\{ fnDir: __dirname \}\)/, 'director builds it once per chat');
  assert.match(director, /const board = situationBoard\(situation, clientBoard\)/, 'the cascade (Claude worker) board carries it');
  assert.match(director, /bridgeChat\(\{ system: SYSTEM_WITH_SITUATION/, 'the XO bridge gets it in the system prompt');
  assert.match(director, /system: SYSTEM_WITH_SITUATION, messages: cleanMsgs/, 'the metered API gets it in the system prompt');
  assert.ok(!/system: SYSTEM_PROMPT, messages: cleanMsgs/.test(director), 'no model call is left on the bare prompt');

  const exec = read('netlify/functions/axis-exec.mjs');
  assert.match(exec, /import \{ loadSituationSafe, situationInstruction \} from '\.\/lib\/axis-situation\.cjs'/);
  assert.match(exec, /YOU HAVE THE LIVE SITUATION/, 'the Workspace brain is told it has the picture');
  assert.match(exec, /Never write that you lack access to his tasks, board, approvals or to-dos/);
  assert.match(exec, /Never guess the date/);
  assert.match(exec, /system: withSituation\(WORKSPACE_SYSTEM, sit\)/, 'workspace.open/edit call carries it');
  assert.match(exec, /system: withSituation\(PERSONA, sit\)/, 'the brief carries it');
  assert.match(exec, /const dateLine = sit \? `Today is \$\{sit\.local\.weekday\}/, 'the brief states the local date');

  const fn = read('netlify/functions/axis-situation.mjs');
  assert.match(fn, /export const config = \{ path: '\/api\/axis\/situation' \}/);
  assert.match(fn, /if \(!verifyAperture\(req\)\) return jr\(401/, 'the endpoint is behind the Aperture login');
  assert.match(fn, /if \(req\.method !== 'GET'\) return jr\(405/, 'read-only');

  // the worker-bound board slots grew with the situation
  assert.match(read('netlify/functions/lib/axis-brain.cjs'), /board: String\(board \|\| ''\)\.slice\(0, 6000\)/);
  assert.equal((read('netlify/functions/axis-brain-queue.mjs').match(/slice\(0, 6000\)/g) || []).length, 2, 'enqueue + task both carry the full board');

  assert.match(read('netlify.toml'), /"netlify\/functions\/_axis-status-full\.json"\]/, 'status file is bundled with the functions');
  // Rule-16 sweep: every module axis-app.js imports without a ?v= must revalidate, or a browser keeps
  // its first copy for seven days (/assets/* is max-age=604800) and a fix never reaches Ahmad.
  const toml = read('netlify.toml');
  const bare = [...read('assets/axis-app.js').matchAll(/^import [^;]* from '\.\/(axis-[a-z-]+\.js)'/gm)].map((m) => m[1]);
  assert.ok(bare.length >= 10, 'the import graph was read');
  for (const f of bare) assert.ok(new RegExp(`for = "/assets/${f.replace('.', '\\.')}"\\s*\\n\\s*\\[headers\\.values\\]\\s*\\n\\s*Cache-Control = "public, max-age=0, must-revalidate"`).test(toml), `${f} has a must-revalidate rule`);
  ok();
}

// ---- 8. The worker side: ledger → overview.ceo_critical; model jobs on his machine read the ledger ----
{
  const snaps = read('scripts/lib/axis-snapshots.mjs');
  assert.match(snaps, /import \{ readCeoLedger \} from '\.\/axis-ceo-ledger\.mjs'/);
  assert.match(snaps, /export function computeSnapshots\(db, opts = \{\}\)/);
  assert.match(snaps, /ceo_critical: Array\.isArray\(opts\.ceoLedger\) \? opts\.ceoLedger : readCeoLedger\(opts\.repoRoot \|\| REPO_ROOT\)/);
  assert.ok(!/ceo_ledger_read_at/.test(snaps), 'no per-tick stamp (it would bump overview every tick)');
  // the push allow-list is untouched — a field, not a module
  const push = read('netlify/functions/axis-snapshot-push.mjs');
  assert.ok(!/ceo_critical/.test(push), 'no new module in the push allow-list');
  const worker = read('scripts/axis-brain-worker.mjs');
  assert.match(worker, /import \{ readCeoLedger, ceoLedgerBlock \} from '\.\/lib\/axis-ceo-ledger\.mjs'/);
  assert.match(worker, /if \(!\/CEO-CRITICAL LEDGER\|LIVE SITUATION\/\.test\(boardText\)\)/, 'the ledger is attached only when the board lacks it');
  ok();
}

// ---- 9. The client: Overview card + Talk rail + board block carry the ledger ----
{
  const app = read('assets/axis-app.js');
  assert.match(app, /async function fetchSituation\(\)/);
  assert.match(app, /fetch\('\/api\/axis\/situation', \{ headers: authHeaders\(\), cache: 'no-store' \}\)/);
  assert.match(app, /function situationSection\(\)/);
  assert.match(app, /c\.append\(situationSection\(\)\);/, 'Overview renders the card');
  assert.match(app, /head\('Today — needs you'/);
  assert.match(app, /head\('Needs You Now', 'top by revenue impact'/, 'the original card survives (Rule 15)');
  assert.match(app, /The situation did not answer/, 'a failed fetch is said, never shown as all-clear');
  assert.match(app, /'calendar — not connected'/);
  assert.match(app, /'mailboxes — not connected'/);
  assert.match(app, /window\.__axisSitPoll = setInterval/, 'the card re-ranks on a timer');
  assert.match(app, /'Work it'/, 'each row can be handed to AXIS');
  // the priorities module lifts the ledger rows (Talk rail, Priorities screen, board text)
  const snap = { overview: { data: { ceo_critical: rows } } };
  const items = P.collectPriorities(snap, NOW);
  assert.equal(items.filter((i) => i.source === 'CEO ledger').length, 5, 'open, not cleared, not closed, not watch');
  assert.match(items[0].title, /^#1 Answer the HEC/, 'his overdue row leads the rail');
  assert.ok(items.every((i) => i.source !== 'CEO ledger' || i.screen === 'overview'));
  const undated = items.filter((i) => !i.dueAt && i.source === 'CEO ledger');
  assert.ok(undated.length >= 1);
  const mixed = P.collectPriorities({ ...snap, approvals: { data: { rows: [{ status: 'pending', subject: 'agent approval', created_at: '2026-10-12T00:00:00Z' }] } } }, NOW);
  const firstUndatedIdx = mixed.findIndex((i) => !i.dueAt);
  assert.equal(mixed[firstUndatedIdx].source, 'CEO ledger', 'among the undated, his list comes before the agents\' approvals');
  ok();
}

console.log(`[axis-situation] ${n} groups passed`);
