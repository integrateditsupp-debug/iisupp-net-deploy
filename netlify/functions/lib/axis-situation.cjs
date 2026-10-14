// axis-situation.cjs — the one picture AXIS looks at before it answers (RUN-AX2, 2026-10-13).
//
// Ahmad: "AXIS is the director autonomous agent … should have all the business operations and tasks
// being worked on and what's needing action and be able to work with me to action them all … if there
// is anything in the company that needs my attention AXIS would be aware of it, bring it up."
//
// Until now each brain saw a different slice: the director got the conversation (+ a priorities line
// from the page), the Workspace brain got Ahmad's sentence and nothing else, the brief got three exec
// lists. Asked "let's work on top urgent items", the Workspace brain truthfully answered that it had
// no access to tasks, calendar or messages — and guessed the date from UTC. This module builds ONE
// situation from everything AXIS can actually reach, ranks it, and renders a compact text block that
// is injected into every brain call (director chat, Workspace, brief) and shown on the Overview.
//
// Sources, in one place, each reported as present / missing (Rule 14 — never claim a source it lacks):
//   board      Netlify Blobs 'axis-snapshots' (the worker's board: overview, inbox, approvals, followups,
//              waiting_reply, pipeline, documents, fleet) — or the bundled seed when the worker has not pushed
//   ceo_ledger overview.ceo_critical — the CEO-CRITICAL-ITEMS.md rows the worker reads off Ahmad's machine
//   exec       Blobs 'axis-exec' (to-dos, automations, exec approvals, attention log)
//   queue      Blobs 'axis-brain-jobs' (Claude worker heartbeat + jobs)
//   state      _axis-state-full.json (agents, program approvals, health) · status _axis-status-full.json
//   calendar / mailboxes — NOT connected on this side until the Google sign-in one-click; said plainly.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const TZ = 'America/Toronto';
const DAY = 86400000;

function localClock(now = new Date(), tz = TZ) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'long',
  }).formatToParts(now).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, weekday: parts.weekday, tz };
}

function toDate(v) { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }
// Whole Toronto calendar days, not elapsed 24-hour blocks: a deadline at noon is "today" all day
// and "OVERDUE 1d" tomorrow — the same rule assets/axis-priorities.js uses on the screen.
function dayNumber(d, tz) { const c = localClock(d, tz); const [y, m, dd] = c.date.split('-').map(Number); return Date.UTC(y, m - 1, dd) / DAY; }
function daysUntil(dueAt, now, tz = TZ) { const d = toDate(dueAt); return d ? dayNumber(d, tz) - dayNumber(now, tz) : null; }
function dueText(dueAt, now) {
  const n = daysUntil(dueAt, now);
  if (n === null) return '';
  if (n < 0) return `OVERDUE ${-n}d`;
  if (n === 0) return 'due today';
  if (n === 1) return 'due tomorrow';
  return `due in ${n}d`;
}
const money = (n) => (Number(n) ? '$' + Math.round(Number(n)).toLocaleString('en-CA') : '');
const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

/**
 * Build the situation from already-loaded inputs. Pure — the tests feed fixtures here.
 * @param {object} inp  { snapshots, exec:{todos,tasks,approvals,attention}, queue:{online,jobs}, state, status, now, tz, source }
 */
function buildSituation(inp = {}) {
  const now = inp.now instanceof Date ? inp.now : new Date();
  const local = localClock(now, inp.tz || TZ);
  const snaps = inp.snapshots || {};
  const mod = (m) => (snaps[m] && snaps[m].data) || {};
  const exec = inp.exec || {};
  const queue = inp.queue || {};
  const state = inp.state || null;
  const status = inp.status || null;

  const items = [];   // everything that needs Ahmad, ranked below
  const axisCanDo = []; // what AXIS can take off his plate right now
  const add = (it) => items.push(it);

  // ── 1. CEO-critical ledger (his own list, highest authority) ──
  const ledger = Array.isArray(mod('overview').ceo_critical) ? mod('overview').ceo_critical : [];
  for (const r of ledger) {
    if (r.closed || r.cleared || (r.status && /^(closed|parked)/i.test(String(r.status)))) continue;
    const due = r.deadline || null;
    const watch = r.section === 'watch';
    add({
      title: `${r.ref && r.ref !== 'watch' ? r.ref + ' ' : ''}${clip(r.what, 160)}`,
      why: clip(watch ? `watch${r.soft_date ? ' — enters the 14-day window ' + r.soft_date : ''}` : (r.who || '') + (r.soft_date ? ` · ${r.soft_date}` : ''), 140),
      due, source: watch ? 'CEO ledger · watch' : 'CEO ledger', kind: r.category || 'decision',
      action: r.one_click ? { type: 'text', target: clip(r.one_click, 120) } : null,
      score: watch ? 45 + (due ? 5 : 0) : 70 + (due ? 10 : 0), ref: r.ref || null, overdue: !!r.overdue,
    });
  }

  // ── 2. The worker's board ──
  const fu = mod('followups');
  for (const f of fu.overdue || []) add({ title: `Follow-up: ${f.company || 'prospect'}`, why: 'overdue follow-up (queued → Approvals)', due: f.due_at || null, source: 'Follow-ups', action: { type: 'screen', target: 'followups' }, score: 60 });
  for (const f of fu.due_today || []) add({ title: `Follow-up: ${f.company || 'prospect'}`, why: 'due today (queued → Approvals)', due: f.due_at || null, source: 'Follow-ups', action: { type: 'screen', target: 'followups' }, score: 55 });
  for (const m of mod('inbox').rows || [])
    if (['reply_to_outreach', 'new_inbound_request'].includes(m.classification) && !m.actioned && !m.snoozed_until)
      add({ title: `Client: ${m.subject || '(no subject)'}`, why: `${m.from || 'client'} waiting${m.received_at ? ' since ' + String(m.received_at).slice(0, 10) : ''}`, due: null, source: 'Action Inbox', action: { type: 'screen', target: 'inbox' }, score: 62 });
  for (const r of mod('approvals').rows || [])
    if (r.status === 'pending') add({ title: `Approve: ${r.subject || '(no subject)'}`, why: 'drafted by an agent — nothing sends until you approve', due: null, source: 'Approvals', action: { type: 'screen', target: 'approvals' }, score: 58 });
  const wr = mod('waiting_reply');
  if (Number(wr.needs_delegation) > 0) add({ title: `${wr.needs_delegation} waiting-reply threads need a follow-up decision`, why: 'delegate to the follow-up agent or close', due: null, source: 'Waiting Reply', action: { type: 'screen', target: 'waiting_reply' }, score: 48 });
  for (const d of mod('documents').rows || [])
    if ((d.status || '').toLowerCase() === 'draft' && d.due_at) add({ title: `Document: ${d.title || d.type}`, why: 'draft — not sent', due: d.due_at, source: 'Documents', action: { type: 'screen', target: 'documents' }, score: 50 });

  // ── 3. Executive-assistant store ──
  for (const t of exec.todos || []) if (!t.done && t.needsYou) add({ title: t.title, why: clip(t.note || 'on your to-do list — needs you', 120), due: t.due || null, source: 'To-do', action: { type: 'console', target: 'todo' }, score: t.priority === 'high' ? 57 : t.priority === 'low' ? 40 : 50 });
  for (const a of exec.approvals || []) if (a.status === 'pending') add({ title: `Approve: ${a.title}`, why: clip(`${a.kind}${a.costUsd ? ' · $' + a.costUsd : ''} — ${a.detail || ''}`, 140), due: null, source: 'Assistant approvals', action: { type: 'console', target: 'apr' }, score: a.kind === 'spend' ? 56 : 54 });
  for (const t of exec.tasks || []) {
    if (t.status === 'active' && t.last_result && t.last_result.error) add({ title: `Automation failed: ${t.title}`, why: clip(t.last_result.error, 120), due: null, source: 'Automations', action: { type: 'console', target: 'auto' }, score: 42 });
    if (t.status === 'active' && !(t.last_result && t.last_result.error)) axisCanDo.push({ title: t.title, how: `runs every ${t.every_minutes} min · ${t.runs || 0} runs`, source: 'Automations' });
  }
  for (const t of exec.todos || []) if (!t.done && !t.needsYou) axisCanDo.push({ title: t.title, how: 'on the list — AXIS can draft or prepare it', source: 'To-do' });

  // ── 4. Claude worker queue ──
  const jobs = Array.isArray(queue.jobs) ? queue.jobs : [];
  for (const j of jobs) if (j.state === 'failed') add({ title: `Claude job failed: ${clip(j.arg, 70)}`, why: clip(j.error || 'see the Claude tab', 120), due: null, source: 'Claude worker', action: { type: 'console', target: 'claude' }, score: 41 });
  const working = jobs.filter((j) => j.state === 'working' || j.state === 'queued');
  for (const j of working) axisCanDo.push({ title: clip(j.arg, 80), how: `${j.state} on the Claude worker${queue.online ? '' : ' (worker offline — starts when it is back)'}`, source: 'Claude worker' });

  // ── 5. Program state (agents, health) ──
  const agents = state && Array.isArray(state.agents) ? state.agents : [];
  const failedAgents = agents.filter((a) => /fail|error|stale|down/i.test(String(a.status || a.health || '')));
  for (const a of failedAgents.slice(0, 5)) add({ title: `Agent ${a.name || a.id}: ${a.status || a.health}`, why: clip(a.note || a.last || 'needs a look on the Fleet screen', 120), due: null, source: 'Fleet', action: { type: 'screen', target: 'fleet' }, score: 38 });

  // ── Rank: overdue → due soon → score ──
  const scored = items.map((it) => {
    const n = daysUntil(it.due, now);
    let s = it.score || 40;
    if (n !== null) s += n < 0 ? 40 : n === 0 ? 30 : n <= 3 ? 20 : n <= 7 ? 10 : 0;
    else if (it.overdue) s += 40; // the ledger says OVERDUE even where no date parsed
    return { ...it, dueLabel: dueText(it.due, now) || (it.overdue ? 'OVERDUE' : ''), rank: s };
  }).sort((a, b) => b.rank - a.rank || (toDate(a.due)?.getTime() || Infinity) - (toDate(b.due)?.getTime() || Infinity));

  const deadlines = scored.filter((it) => it.due).map((it) => ({ title: it.title, due: String(it.due).slice(0, 10), label: it.dueLabel, source: it.source }));
  const k = mod('overview').kpis || {};
  const pipeline = mod('pipeline');
  const revenue = { pipeline_value: Number(k.pipeline_value) || 0, mrr: Number(k.mrr) || 0, open_deals: Array.isArray(pipeline.cards) ? pipeline.cards.length : null };

  const sources = {
    board: inp.source || (Object.keys(snaps).length ? 'live' : 'missing'),
    ceo_ledger: ledger.length > 0,
    exec: !!inp.exec,
    worker_online: !!queue.online,
    state: !!state,
    status: !!status,
    calendar: false,
    mailboxes: false,
  };

  // ── The block the brains read ──
  const lines = [];
  lines.push(`Local time: ${local.weekday} ${local.date} ${local.time} (${local.tz}).`);
  lines.push(`Sources: board ${sources.board}${sources.ceo_ledger ? ' · CEO ledger ✓' : ' · CEO ledger not pushed yet'} · assistant store ${sources.exec ? '✓' : 'unavailable'} · Claude worker ${sources.worker_online ? 'online' : 'offline'}${sources.state ? ' · fleet state ✓' : ''} · calendar NOT connected · mailboxes NOT connected (one-click: Google sign-in via scripts/gmail-auth.mjs, then AXIS_GMAIL_* in Netlify).`);
  lines.push(`Revenue on the board: pipeline ${money(revenue.pipeline_value) || '$0'} · MRR ${money(revenue.mrr) || '$0'}${revenue.open_deals != null ? ` · ${revenue.open_deals} open deals` : ''}.`);
  if (scored.length) {
    lines.push(`NEEDS AHMAD (${scored.length}, ranked):`);
    scored.slice(0, 12).forEach((it, i) => lines.push(`${i + 1}. ${it.title}${it.dueLabel ? ' — ' + it.dueLabel : ''} [${it.source}]${it.why ? ' — ' + it.why : ''}${it.action && it.action.type === 'text' ? ' — one-click: ' + it.action.target : ''}`));
    if (scored.length > 12) lines.push(`…and ${scored.length - 12} more.`);
  } else lines.push('NEEDS AHMAD: nothing on the board right now (sources above say what is and is not connected).');
  if (axisCanDo.length) { lines.push(`AXIS IS HANDLING / CAN HANDLE (${axisCanDo.length}):`); axisCanDo.slice(0, 8).forEach((it) => lines.push(`- ${it.title} — ${it.how} [${it.source}]`)); }
  const text = lines.join('\n');

  return { ok: true, generatedAt: now.toISOString(), local, sources, revenue, needsAhmad: scored.slice(0, 40), axisCanDo: axisCanDo.slice(0, 20), deadlines: deadlines.slice(0, 20), counts: { needsAhmad: scored.length, overdue: scored.filter((i) => daysUntil(i.due, now) !== null && daysUntil(i.due, now) < 0).length, today: scored.filter((i) => daysUntil(i.due, now) === 0).length }, text };
}

// ── Loader: gather the inputs from Blobs + bundled files. Every source is optional and reported. ──
// `fnDir` = the functions directory at runtime. Callers pass it (CJS: __dirname; ESM: dirname of
// import.meta.url) because esbuild shims __dirname differently per entry format — the state/status
// functions learned this the hard way ("NOT __dirname — esbuild injects its own shim").
async function loadSituation({ now = new Date(), fnDir = null } = {}) {
  let getStore = null;
  try { ({ getStore } = require('@netlify/blobs')); } catch { getStore = null; }
  const safe = async (fn, fallback) => { try { return await fn(); } catch { return fallback; } };
  let FN_DIR = fnDir;
  if (!FN_DIR) { try { FN_DIR = __dirname.replace(/[\\/]lib$/, ''); } catch { FN_DIR = null; } }
  const readFile = (name) => { if (!FN_DIR) return null; try { return JSON.parse(fs.readFileSync(path.join(FN_DIR, name), 'utf8')); } catch { return null; } };

  // board
  let snapshots = {}, source = 'missing';
  const seed = readFile('_axis-snapshots-seed.json');
  if (getStore) {
    const store = await safe(() => getStore('axis-snapshots'), null);
    if (store) {
      const MODS = ['overview', 'inbox', 'approvals', 'pipeline', 'waiting_reply', 'followups', 'documents', 'fleet'];
      const got = await Promise.all(MODS.map((m) => safe(() => store.get(m, { type: 'json' }), null)));
      MODS.forEach((m, i) => { if (got[i]) snapshots[m] = got[i]; });
      if (Object.keys(snapshots).length) source = 'live';
    }
  }
  if (source === 'missing' && seed && seed.snapshots) { snapshots = seed.snapshots; source = 'seed'; }

  // exec store
  let exec = null; // null = the store did not answer; reported as such, never as "✓" (Rule 14)
  if (getStore) {
    const es = await safe(() => getStore({ name: 'axis-exec', consistency: 'strong' }), null);
    if (es) exec = {
      todos: (await safe(() => es.get('todos', { type: 'json' }), null)) || [],
      tasks: (await safe(() => es.get('tasks', { type: 'json' }), null)) || [],
      approvals: (await safe(() => es.get('approvals', { type: 'json' }), null)) || [],
      attention: (await safe(() => es.get('attention-log', { type: 'json' }), null)) || [],
    };
  }

  // Claude worker queue
  let queue = { online: false, jobs: [] };
  if (getStore) {
    const qs = await safe(() => getStore({ name: 'axis-brain-jobs', consistency: 'strong' }), null);
    if (qs) {
      const hb = await safe(() => qs.get('worker-heartbeat', { type: 'json' }), null);
      queue.online = !!(hb && hb.t && Date.now() - hb.t < 120000);
      const read = async (prefix) => { const list = await safe(() => qs.list({ prefix }), { blobs: [] }); const out = []; for (const b of (list.blobs || []).slice(-30)) { const v = await safe(() => qs.get(b.key, { type: 'json' }), null); if (v) out.push({ ...v, id: v.id || b.key.slice(prefix.length) }); } return out; };
      const [queued, done] = await Promise.all([read('task/'), read('done/')]);
      const doneIds = new Set(done.map((d) => d.id));
      queue.jobs = [
        ...queued.filter((t) => !doneIds.has(t.id)).map((t) => ({ id: t.id, kind: t.kind, arg: t.arg, t: t.t, state: t.picked ? 'working' : 'queued' })),
        ...done.map((d) => ({ id: d.id, kind: d.kind || 'task', arg: d.arg || '', t: d.t || 0, state: d.error ? 'failed' : 'done', error: d.error || null })),
      ].sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, 30);
    }
  }

  const state = readFile('_axis-state-full.json');
  const status = readFile('_axis-status-full.json');
  return buildSituation({ snapshots, source, exec, queue, state, status, now });
}

// The instruction every brain gets with the block — one voice, one rule set.
function situationInstruction(sit) {
  return `LIVE SITUATION (read this before answering; it is the board, the ledger, the assistant store and the worker, generated ${sit.local.date} ${sit.local.time} ${sit.local.tz}):\n${sit.text}\n\n` +
    `RULES FOR USING IT: when Ahmad asks what is urgent, what needs him, what to work on, or says "let's work on the top items", answer FROM THIS LIST — ranked, with the next concrete step for each and who does it (AXIS or Ahmad). ` +
    `Never say you lack access to his tasks, board, approvals or to-dos: you have them above. The two sources that are NOT connected are the calendar and the three mailboxes — if they matter for the answer, say so in ONE line and name the one-click (Google sign-in). ` +
    `Use the local date above; never guess the date. Prefer revenue-first ordering: money at stake, then deadlines, then everything else. ` +
    `SMARTER PATH: when Ahmad asks for X and a faster, cheaper or lower-effort route exists, say it in one line first ("Faster: …"), then do X unless he picks the other. ` +
    `HOW HE DECIDES (apply it): revenue first; shortest path first; free before paid; recurring contracts over one-time jobs; enterprise and government contracts; no busywork; talk in short bullets, lead with what he must do or decide.`;
}

// Bounded + never throws: a brain call must not stall or die because one store was slow. On timeout
// or error the brain answers without the block, and the sources line is simply absent (Rule 14: it
// will not invent one). 2.5 s leaves the director well inside its 10 s budget.
async function loadSituationSafe({ now = new Date(), fnDir = null, timeoutMs = 2500 } = {}) {
  let timer = null;
  try {
    const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); });
    const sit = await Promise.race([loadSituation({ now, fnDir }).catch(() => null), timeout]);
    return sit && sit.ok ? sit : null;
  } catch { return null; } finally { if (timer) clearTimeout(timer); }
}

// The situation rendered for the Claude worker's board slot (the subscription tier reads `board`
// as plain text). Same facts as the brains' system block, same rules, one voice.
function situationBoard(sit, clientBoard = '') {
  const parts = [];
  if (sit && sit.text) parts.push(`LIVE SITUATION (${sit.local.weekday} ${sit.local.date} ${sit.local.time} ${sit.local.tz}; answer FROM this when asked what is urgent or what needs Ahmad; never say you lack access to his tasks, board or to-dos; calendar + mailboxes are NOT connected — say so in one line if it matters):\n${sit.text}`);
  if (clientBoard) parts.push(String(clientBoard).trim());
  return parts.join('\n\n');
}

module.exports = { buildSituation, loadSituation, loadSituationSafe, situationInstruction, situationBoard, localClock };
