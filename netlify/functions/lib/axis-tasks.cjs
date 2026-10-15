// axis-tasks.cjs — ONE live task list over everything AXIS can reach, and the mutations that work it
// (RUN-AX3, 2026-10-15).
//
// Ahmad: "AXIS cannot see the live task view, the to-do list of the company so we can work on it together and
// get things actioned. Fix this issue so it can view everything … and edit, adjust, modify, remove, delete,
// update, action, follow up, reject, approve, cancel, acknowledge, reply, etc."
//
// Sources (each read honestly — a store that did not answer is reported unavailable, never empty):
//   axis-exec        todos · tasks (automations) · approvals · followups (new, AXIS-created) · workspace ·
//                    local-jobs (Axis Local commands)                      ← the assistant store, written here
//   axis-snapshots   overview.ceo_critical (the CEO ledger) · followups · approvals · inbox · documents ·
//                    waiting_reply                                          ← the worker's board, READ ONLY here
//   axis-brain-jobs  Claude worker jobs (failed / queued / working)        ← read only
//   _axis-state-full.json  agents reporting a failure                       ← read only
//   axis-task-overlay      per-row overlay {status, until, sig, edits, draft, staged, followUps} — how a row
//                          this side cannot edit (the ledger on Ahmad's machine, the worker's SQLite rows) is
//                          acknowledged / snoozed / archived / done WITHOUT touching its own store
//   axis-task-audit        every mutation { at, actor, action, id, before, after, via }
//
// Rails (never relaxed here): nothing in this module SENDS, PAYS or PUBLISHES. An approval whose approval
// would send an email, commit money or run a command on Ahmad's PC is approved only from the console (his
// click); asked by chat or voice it is STAGED for that click. Board rows are changed on the worker only
// through the intents the console already queues (cancel_followup, approve/reject/skip, mark_handled,
// snooze, delegate_followup) — the worker applies them behind its own rails. "Delete" is archive: nothing
// is ever hard-deleted, and archived rows stay readable under the Done/archived filter (Rule 15).
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const IDS = require('./axis-task-ids.cjs');
const { buildSituation, situationInstruction } = require('./axis-situation.cjs');

const EXEC_STORE = 'axis-exec';
const SNAP_STORE = 'axis-snapshots';
const INBOX_STORE = 'axis-inbox';
const JOBS_STORE = 'axis-brain-jobs';
const BOARD_MODULES = ['overview', 'inbox', 'approvals', 'pipeline', 'waiting_reply', 'followups', 'documents', 'fleet'];
const AUDIT_CAP = 2000;
const OVERLAY_CAP = 3000;

const STATUSES = ['open', 'done', 'snoozed', 'archived', 'approved', 'rejected', 'cancelled', 'acknowledged'];
const CLOSED = new Set(['done', 'archived', 'approved', 'rejected', 'cancelled', 'acknowledged']);
const ACTIONS = ['update', 'complete', 'reopen', 'archive', 'snooze', 'follow_up', 'approve', 'reject', 'acknowledge', 'cancel', 'assign', 'draft_reply', 'create'];
const ALIASES = {
  followUp: 'follow_up', 'follow-up': 'follow_up', followup: 'follow_up', replyDraft: 'draft_reply', reply_draft: 'draft_reply', reply: 'draft_reply',
  create_task: 'create', add: 'create', delete: 'archive', remove: 'archive', done: 'complete', ack: 'acknowledge', decline: 'reject',
  assign_to_agent: 'assign', update_task: 'update', complete_task: 'complete', reopen_task: 'reopen', archive_task: 'archive', snooze_task: 'snooze',
};
// The director's roster (axis-director.js ROSTER). tests/axis-director-tools.test.mjs fails if they drift.
const AGENTS = ['Hunter', 'Forager', 'Prospector', 'Globe', 'Tender', 'Bidwatch', 'Pitch', 'Closer', 'Ops', 'Scout', 'Applicant', 'Tuner',
  'Renew', 'Ledger', 'Auditor', 'Compass', 'Observer', 'Dispatch', 'Mesh', 'Vault', 'Herald', 'Dawn', 'Dusk', 'Biller', 'Steward', 'Scholar', 'Grantwright'];

const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const iso = (v) => { if (v === null || v === undefined || v === '') return null; const d = new Date(typeof v === 'number' ? v : String(v)); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };
const nid = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const canonAction = (a) => { const s = String(a || '').trim(); return ACTIONS.includes(s) ? s : (ALIASES[s] || null); };
const sanitize = (text, max) => String(text || '').replace(/`[^`]*`/g, '…').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

// ── Store access ─────────────────────────────────────────────────────────────────────────────────────
let _testGetStore = null;
/** Test seam: route every store this module opens to an in-memory factory (tests/lib/axis-memory-store.mjs). */
function _setGetStore(fn) { _testGetStore = typeof fn === 'function' ? fn : null; }
async function resolveGetStore(injected) {
  if (_testGetStore) return _testGetStore;
  if (typeof injected === 'function') return injected;
  // A dynamic import survives both the CJS and the ESM bundle (the RUN-AX2 live finding: a require() of
  // @netlify/blobs inside an ESM bundle becomes a shim that throws).
  try { const m = await import('@netlify/blobs'); return m.getStore || (m.default && m.default.getStore) || null; } catch { return null; }
}
function open(getStore, name, strong = true) { if (!getStore) return null; try { return getStore(strong ? { name, consistency: 'strong' } : name); } catch { return null; } }
/** { ok, value } — ok:false means the store did not answer (never confused with "empty"). */
async function readKey(store, key) {
  if (!store) return { ok: false, value: null };
  try { const v = await store.get(key, { type: 'json' }); return { ok: true, value: v == null ? null : v }; } catch { return { ok: false, value: null }; }
}
async function writeKey(store, key, value) {
  if (!store) throw httpError(503, 'store_unavailable', `the ${key} store did not answer — nothing was changed`);
  await store.setJSON(key, value);
  return value;
}
function httpError(status, code, message, extra) { const e = new Error(message); e.status = status; e.code = code; e.extra = extra || null; return e; }

// ── Loading ──────────────────────────────────────────────────────────────────────────────────────────
async function readQueue(getStore) {
  const qs = open(getStore, JOBS_STORE);
  if (!qs) return { ok: false, online: false, jobs: [] };
  try {
    const hb = await qs.get('worker-heartbeat', { type: 'json' }).catch(() => null);
    const online = !!(hb && hb.t && Date.now() - hb.t < 120000);
    const read = async (prefix) => {
      const list = await qs.list({ prefix });
      const out = [];
      for (const b of (list.blobs || []).slice(-30)) { const v = await qs.get(b.key, { type: 'json' }).catch(() => null); if (v) out.push({ ...v, id: v.id || b.key.slice(prefix.length) }); }
      return out;
    };
    const [queued, done] = await Promise.all([read('task/'), read('done/')]);
    const doneIds = new Set(done.map((d) => d.id));
    const jobs = [
      ...queued.filter((t) => !doneIds.has(t.id)).map((t) => ({ id: t.id, kind: t.kind, arg: t.arg, t: t.t, state: t.picked ? 'working' : 'queued' })),
      ...done.map((d) => ({ id: d.id, kind: d.kind || 'task', arg: d.arg || '', t: d.t || 0, state: d.error ? 'failed' : 'done', error: d.error || null })),
    ].sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, 30);
    return { ok: true, online, jobs };
  } catch { return { ok: false, online: false, jobs: [] }; }
}

/**
 * Read every source once. Never throws. `health` says, per source, whether it answered — the list and the
 * director report "unavailable" for a store that did not, instead of showing its rows as "nothing open".
 */
async function loadTaskData({ getStore: injected = null, now = new Date(), fnDir = null } = {}) {
  const getStore = await resolveGetStore(injected);
  let FN_DIR = fnDir;
  if (!FN_DIR) { try { FN_DIR = __dirname.replace(/[\\/]lib$/, ''); } catch { FN_DIR = null; } }
  const readFile = (name) => { if (!FN_DIR) return null; try { return JSON.parse(fs.readFileSync(path.join(FN_DIR, name), 'utf8')); } catch { return null; } };
  const health = { exec: 'unavailable', execMissing: [], board: 'missing', overlay: 'unavailable', audit: 'unavailable', queue: 'unavailable', state: false, worker_online: false };

  const ex = open(getStore, EXEC_STORE);
  const EXEC_KEYS = ['todos', 'tasks', 'approvals', 'followups', 'workspace', 'local-jobs'];
  const execReads = await Promise.all(EXEC_KEYS.map((k) => readKey(ex, k)));
  const exec = {};
  EXEC_KEYS.forEach((k, i) => { exec[k === 'local-jobs' ? 'localJobs' : k] = execReads[i].ok && Array.isArray(execReads[i].value) ? execReads[i].value : (execReads[i].ok ? [] : null); if (!execReads[i].ok) health.execMissing.push(k); });
  health.exec = health.execMissing.length === 0 ? 'ok' : (health.execMissing.length === EXEC_KEYS.length ? 'unavailable' : 'partial');

  const snapStore = open(getStore, SNAP_STORE, false);
  let snapshots = {}, boardErr = !snapStore;
  if (snapStore) {
    const got = await Promise.all(BOARD_MODULES.map((m) => readKey(snapStore, m)));
    BOARD_MODULES.forEach((m, i) => { if (got[i].ok && got[i].value) snapshots[m] = got[i].value; if (!got[i].ok) boardErr = true; });
  }
  if (Object.keys(snapshots).length) health.board = 'live';
  else {
    const seed = readFile('_axis-snapshots-seed.json');
    if (seed && seed.snapshots) { snapshots = seed.snapshots; health.board = 'seed'; }
  }
  if (boardErr && health.board !== 'live') health.boardError = true;

  const [ov, au, queue] = await Promise.all([readKey(open(getStore, IDS.OVERLAY_STORE), IDS.OVERLAY_KEY), readKey(open(getStore, IDS.AUDIT_STORE), IDS.AUDIT_KEY), readQueue(getStore)]);
  const overlay = ov.ok ? (ov.value && typeof ov.value === 'object' && !Array.isArray(ov.value) ? ov.value : {}) : null;
  const audit = au.ok ? (Array.isArray(au.value) ? au.value : []) : null;
  health.overlay = ov.ok ? 'ok' : 'unavailable';
  health.audit = au.ok ? 'ok' : 'unavailable';
  health.queue = queue.ok ? 'ok' : 'unavailable';
  health.worker_online = !!queue.online;

  const state = readFile('_axis-state-full.json');
  const status = readFile('_axis-status-full.json');
  health.state = !!state;
  return { now, getStore, exec, snapshots, boardSource: health.board, overlay, audit, queue: { online: queue.online, jobs: queue.jobs }, state, status, health };
}

// ── Building the list ────────────────────────────────────────────────────────────────────────────────
const SENDING_KINDS = ['reply', 'outreach'];
function approvalEffect(a) {
  const sends = SENDING_KINDS.includes(a.kind) && !!(a.payload && a.payload.to);
  const spends = a.kind === 'spend' && Number(a.costUsd) > 0;
  return { sends, spends, to: sends ? String(a.payload.to).slice(0, 120) : null, costUsd: Number(a.costUsd) || 0 };
}

/** Every source → raw items {id, source, kind, title, …, _sig, _raw}. Pure. */
function collectRaw(data, now) {
  const out = [];
  const mod = (m) => (data.snapshots[m] && data.snapshots[m].data) || {};
  const push = (it) => { if (it && it.id) out.push(it); };
  const idOf = (source, rawId, parts) => IDS.makeId(source, IDS.keyOf(rawId, parts));
  const overlay = data.overlay || {};
  const known = (id) => !!overlay[id];

  // CEO ledger — Ahmad's own list (open + watch; closed rows never leave his machine).
  for (const r of Array.isArray(mod('overview').ceo_critical) ? mod('overview').ceo_critical : []) {
    if (!r || r.closed) continue;
    const watch = r.section === 'watch';
    push({ id: IDS.makeId('ledger', IDS.ledgerKey(r)), source: 'ledger', label: watch ? 'CEO ledger · watch' : 'CEO ledger', kind: watch ? 'watch' : 'ledger',
      title: `${r.ref && r.ref !== 'watch' ? r.ref + ' ' : ''}${clip(r.what, 200)}`,
      detail: clip([r.who ? `waiting: ${r.who}` : '', r.category && !watch ? r.category : '', !r.deadline && r.deadline_note ? r.deadline_note : '', watch && r.soft_date ? `enters the 14-day window ${r.soft_date}` : ''].filter(Boolean).join(' · '), 300),
      storeStatus: r.cleared ? 'cleared' : watch ? 'watch' : 'open', status: r.cleared ? 'done' : 'open', due: iso(r.deadline), overdueStamp: !!r.overdue,
      owner: 'ahmad', priority: null, next: r.one_click ? `One-click: ${clip(r.one_click, 120)}` : r.who ? `${clip(r.who, 80)} — waiting on you` : 'Your call',
      link: r.one_click ? { type: 'text', target: clip(r.one_click, 160) } : { type: 'screen', target: 'overview' }, _sig: IDS.SIG.ledger(r), _raw: r });
  }

  // Board follow-ups (the worker's follow_ups rows). Cancelled ones only when this side touched them.
  const fu = mod('followups');
  for (const [bucket, label] of [['overdue', 'overdue'], ['due_today', 'due today'], ['upcoming', 'upcoming'], ['auto_cancelled', 'cancelled']]) {
    for (const f of fu[bucket] || []) {
      const id = idOf('board-followup', f.id, [f.business_id, f.company, f.due_at]);
      if (bucket === 'auto_cancelled' && !known(id)) continue;
      push({ id, source: 'board-followup', label: 'Follow-ups', kind: 'follow-up', title: `Follow-up: ${clip(f.company || 'prospect', 120)}`,
        detail: `${label} · the chase draft goes to Approvals before anything sends`, storeStatus: f.status || (bucket === 'auto_cancelled' ? 'cancelled' : 'scheduled'),
        status: bucket === 'auto_cancelled' || f.status === 'cancelled' ? 'cancelled' : 'open', due: iso(f.due_at), owner: 'ahmad', priority: null,
        next: 'Approve the chase draft in Approvals (your click) — or cancel the chase', link: { type: 'screen', target: 'followups' }, _sig: IDS.SIG.boardFollowup(f), _raw: f });
    }
  }

  // Board approvals — pending outreach drafts (approving one SENDS, so it is Ahmad's click).
  for (const r of mod('approvals').rows || []) {
    const id = idOf('board-approval', r.id, [r.subject, r.created_at]);
    if (r.status !== 'pending' && !known(id)) continue;
    const st = r.status === 'pending' ? 'open' : r.status === 'rejected' ? 'rejected' : r.status === 'skipped' ? 'cancelled' : ['approved', 'outbound', 'sent'].includes(r.status) ? 'approved' : 'open';
    push({ id, source: 'board-approval', label: 'Approvals', kind: 'approval', title: `Approve: ${clip(r.subject || '(no subject)', 160)}`,
      detail: `${r.channel || 'email'} ${r.kind || ''} draft by an agent — nothing sends until you approve`.replace(/\s+/g, ' '), storeStatus: r.status || 'pending', status: st,
      due: null, createdAt: iso(r.created_at), owner: 'ahmad', priority: null, sendsOnApprove: true, effect: { sends: true, spends: false, to: null, costUsd: 0 },
      next: 'Approve (your click — it sends) or reject', link: { type: 'screen', target: 'approvals' }, _sig: IDS.SIG.boardApproval(r), _raw: r });
  }

  // Board inbox — client replies and new requests.
  for (const m of mod('inbox').rows || []) {
    if (!['reply_to_outreach', 'new_inbound_request'].includes(m.classification)) continue;
    const id = idOf('inbox', m.id, [m.subject, m.from || m.from_email, m.received_at]);
    if (m.actioned && !known(id)) continue;
    const snoozedUntil = m.snoozed_until ? iso(m.snoozed_until) : null;
    const boardSnoozed = !!(snoozedUntil && Date.parse(snoozedUntil) > now.getTime());
    push({ id, source: 'inbox', label: 'Action Inbox', kind: 'message', title: `Client: ${clip(m.subject || '(no subject)', 160)}`,
      detail: clip(`${m.from_email || m.from || 'client'} · ${m.classification === 'reply_to_outreach' ? 'reply to outreach' : 'new request'}${m.snippet ? ' — ' + m.snippet : ''}`, 260),
      storeStatus: m.actioned ? 'handled' : boardSnoozed ? 'snoozed' : 'open', status: m.actioned ? 'done' : boardSnoozed ? 'snoozed' : 'open', snoozedUntil: boardSnoozed ? snoozedUntil : null,
      due: null, createdAt: iso(m.received_at), owner: 'ahmad', priority: null, hasSuggestedReply: !!m.suggested_reply,
      next: 'Reply — AXIS drafts it, the send is your click', link: { type: 'screen', target: 'inbox' }, _sig: IDS.SIG.inbox(m), _raw: m });
  }

  // Board documents still in draft.
  for (const d of mod('documents').rows || []) {
    if ((d.status || '').toLowerCase() !== 'draft') continue;
    push({ id: idOf('document', d.id, [d.title, d.type]), source: 'document', label: 'Documents', kind: 'document', title: `Document: ${clip(d.title || d.type || 'draft', 160)}`,
      detail: 'draft — not sent', storeStatus: 'draft', status: 'open', due: iso(d.due_at), owner: 'ahmad', priority: null,
      next: 'Finish it and send (your click) — AXIS can draft the cover note', link: { type: 'screen', target: 'documents' }, _sig: IDS.SIG.document(d), _raw: d });
  }

  // Waiting Reply — silent threads whose follow-up cadence is spent (delegate decision).
  const wr = mod('waiting_reply');
  const wrRows = Array.isArray(wr.rows) ? wr.rows.filter((w) => w && w.delegate) : [];
  for (const w of wrRows) {
    push({ id: idOf('waiting', w.id, [w.business_id, w.subject]), source: 'waiting', label: 'Waiting Reply', kind: 'follow-up', title: `Waiting reply: ${clip(w.company || w.to_email || 'prospect', 120)}`,
      detail: clip(`${w.days_waiting != null ? w.days_waiting + 'd silent · ' : ''}${w.touches_done || 0} touches · ${w.next_action || 'delegate'}`, 200), storeStatus: 'delegate', status: 'open',
      due: null, createdAt: iso(w.sent_at), owner: 'ahmad', priority: null, next: 'Hand it to the follow-up agent (assign) or close it', link: { type: 'screen', target: 'waiting_reply' }, _sig: IDS.SIG.waiting(w), _raw: w });
  }
  if (!wrRows.length && Number(wr.needs_delegation) > 0) {
    push({ id: 'waiting:needs-delegation', source: 'waiting', label: 'Waiting Reply', kind: 'follow-up', title: `${wr.needs_delegation} waiting-reply threads need a follow-up decision`,
      detail: 'delegate to the follow-up agent or close', storeStatus: 'delegate', status: 'open', due: null, owner: 'ahmad', priority: null,
      next: 'Open Waiting Reply and delegate', link: { type: 'screen', target: 'waiting_reply' }, _sig: IDS.SIG.waitingAll(wr.needs_delegation), _raw: { aggregate: true, needs_delegation: wr.needs_delegation } });
  }

  // Assistant store: to-dos.
  for (const t of data.exec.todos || []) {
    if (!t) continue;
    const owner = t.owner || (t.needsYou ? 'ahmad' : 'axis');
    push({ id: idOf('todo', t.id, [t.title]), source: 'todo', label: 'To-do', kind: 'task', title: clip(t.title, 200), detail: clip(t.note, 500),
      storeStatus: t.archived ? 'archived' : t.done ? 'done' : 'open', status: t.archived ? 'archived' : t.done ? 'done' : 'open', due: iso(t.due), owner,
      priority: ['high', 'normal', 'low'].includes(t.priority) ? t.priority : null, createdAt: iso(t.created_at), updatedAt: iso(t.updated_at || t.archived_at || t.done_at || t.created_at),
      next: owner === 'ahmad' ? (clip(t.note, 120) || 'Needs you') : owner === 'axis' ? 'AXIS can draft or prepare it' : `${owner.replace(/^agent:/, '')} has it`,
      link: { type: 'console', target: 'todo' }, _sig: IDS.SIG.todo(t), _raw: t });
  }
  // Assistant store: follow-ups AXIS created with followUp().
  for (const f of data.exec.followups || []) {
    if (!f) continue;
    const owner = f.owner || 'ahmad';
    push({ id: idOf('followup', f.id, [f.title, f.due]), source: 'followup', label: 'Follow-up (AXIS)', kind: 'follow-up', title: clip(f.title, 200),
      detail: clip([f.note, f.parentTitle ? `on: ${f.parentTitle}` : ''].filter(Boolean).join(' · '), 400), storeStatus: f.status || 'open',
      status: STATUSES.includes(f.status) ? f.status : 'open', due: iso(f.due), owner, priority: ['high', 'normal', 'low'].includes(f.priority) ? f.priority : null,
      parent: f.parent || null, createdAt: iso(f.created_at), updatedAt: iso(f.updated_at || f.created_at),
      next: owner === 'ahmad' ? 'Your follow-up' : `${owner.replace(/^agent:/, '')} follows up`, link: { type: 'tasks', target: 'followup' }, _sig: IDS.SIG.followup(f), _raw: f });
  }
  // Assistant store: automations.
  for (const t of data.exec.tasks || []) {
    if (!t) continue;
    const err = t.last_result && t.last_result.error;
    const st = t.status === 'active' ? 'open' : t.archived ? 'archived' : 'cancelled';
    push({ id: idOf('automation', t.id, [t.title]), source: 'automation', label: 'Automations', kind: 'automation', title: clip(t.title, 200),
      detail: clip(err ? `failed: ${err}` : `every ${t.every_minutes || '?'} min · ${t.runs || 0} runs${t.last_result && t.last_result.summary ? ' · last: ' + t.last_result.summary : ''}`, 300),
      storeStatus: t.status || 'active', status: st, due: null, owner: err ? 'ahmad' : 'axis', priority: null, failing: !!err, createdAt: iso(t.created_at), updatedAt: iso((t.last_result && t.last_result.at) || t.created_at),
      next: st !== 'open' ? 'Paused — reopen to resume' : err ? 'Fix or pause it — AXIS can rewrite the instructions' : `AXIS runs it every ${t.every_minutes || '?'} min`,
      link: { type: 'console', target: 'auto' }, _sig: IDS.SIG.automation(t), _raw: t });
  }
  // Assistant store: approvals (pending, and decisions from the last 30 days).
  const monthAgo = now.getTime() - 30 * 86400000;
  for (const a of data.exec.approvals || []) {
    if (!a) continue;
    const decidedAt = Date.parse(a.decided_at || a.sent_at || a.created_at || '');
    if (a.status !== 'pending' && Number.isFinite(decidedAt) && decidedAt < monthAgo) continue;
    const eff = approvalEffect(a);
    const st = a.status === 'pending' ? 'open' : ['approved', 'sent'].includes(a.status) ? 'approved' : a.status === 'declined' ? 'rejected' : a.status === 'cancelled' ? 'cancelled' : 'open';
    push({ id: idOf('approval', a.id, [a.title, a.created_at]), source: 'approval', label: 'Assistant approvals', kind: 'approval', title: `Approve: ${clip(a.title, 160)}`,
      detail: clip(`${a.kind || 'decision'}${eff.costUsd ? ' · $' + eff.costUsd : ''}${eff.to ? ' · to ' + eff.to : ''} — ${a.detail || ''}`, 300), storeStatus: a.status || 'pending', status: st,
      due: null, owner: 'ahmad', priority: null, sendsOnApprove: eff.sends, spendsOnApprove: eff.spends, effect: eff, createdAt: iso(a.created_at), updatedAt: iso(a.decided_at || a.created_at),
      next: eff.sends ? `Approve to send to ${eff.to} (your click) or reject` : eff.spends ? `Approve the $${eff.costUsd} spend (your click) or reject` : 'Approve or reject',
      link: { type: 'console', target: 'apr' }, _sig: IDS.SIG.approval(a), _raw: a });
  }
  // Axis Local jobs: a command waiting for Ahmad's OK, in flight, or failed.
  for (const j of data.exec.localJobs || []) {
    if (!j || !['needs_approval', 'queued', 'running', 'failed'].includes(j.status)) continue;
    const waiting = j.status === 'needs_approval';
    push({ id: idOf('pc', j.id, [j.title, j.created_at]), source: 'pc', label: 'My PC', kind: waiting ? 'approval' : 'task', title: `PC: ${clip(j.title, 160)}`,
      detail: clip(`${j.kind || 'job'} · ${waiting ? 'waits for your OK — ' + (j.instructions || '') : j.status}`, 260), storeStatus: j.status, status: 'open', due: null,
      owner: j.status === 'failed' || waiting ? 'ahmad' : 'axis', priority: null, effect: waiting ? { sends: false, spends: false, runsCommand: true } : null,
      createdAt: iso(j.created_at), next: waiting ? 'Approve the command (your click) or decline' : j.status === 'failed' ? 'It failed on your PC — open My PC' : 'Running on Axis Local',
      link: { type: 'console', target: 'pc' }, _sig: IDS.SIG.pc(j), _raw: j });
  }

  // Claude worker jobs.
  for (const j of data.queue.jobs || []) {
    if (!j || !['failed', 'queued', 'working'].includes(j.state)) continue;
    const failed = j.state === 'failed';
    push({ id: idOf('job', j.id, [j.arg, j.t]), source: 'job', label: 'Claude worker', kind: failed ? 'failure' : 'task', title: `Claude job${failed ? ' failed' : ''}: ${clip(j.arg, 120)}`,
      detail: clip(failed ? (j.error || 'see the Claude tab') : `${j.state} on the Claude worker${data.queue.online ? '' : ' (worker offline — starts when it is back)'}`, 200),
      storeStatus: j.state, status: 'open', due: null, createdAt: iso(j.t), owner: failed ? 'ahmad' : 'axis', priority: null,
      next: failed ? 'Retry it from the Claude tab, or archive it' : 'AXIS is on it', link: { type: 'console', target: 'claude' }, _sig: IDS.SIG.job(j), _raw: j });
  }
  // Agents reporting a failure (program state file).
  const agents = data.state && Array.isArray(data.state.agents) ? data.state.agents : [];
  for (const a of agents.filter((x) => /fail|error|stale|down/i.test(String(x.status || x.health || ''))).slice(0, 10)) {
    push({ id: idOf('agent', a.name || a.id, [a.status]), source: 'agent', label: 'Fleet', kind: 'failure', title: `Agent ${clip(a.name || a.id, 60)}: ${clip(a.status || a.health, 40)}`,
      detail: clip(a.note || a.last || 'needs a look on the Fleet screen', 200), storeStatus: String(a.status || a.health || ''), status: 'open', due: null, owner: 'ahmad', priority: null,
      next: 'Look on the Fleet screen — or hand it to Compass', link: { type: 'screen', target: 'fleet' }, _sig: IDS.SIG.agent(a), _raw: a });
  }
  return out;
}

/** What each row can do, from its source and its current status. The console and the tools offer only these. */
function actionsFor(it) {
  const base = baseActions(it);
  // A snoozed or acknowledged row is parked, not finished: it can still be edited or archived.
  if (it.status === 'snoozed' || it.status === 'acknowledged') {
    const whenOpen = baseActions({ ...it, status: 'open' });
    for (const a of ['update', 'archive']) if (whenOpen.includes(a) && !base.includes(a)) base.push(a);
  }
  return base;
}
function baseActions(it) {
  const open = it.status === 'open';
  const viaOverlay = it.overlay && it.overlay.status && it.status === it.overlay.status; // closed by the overlay, not by its store
  switch (it.source) {
    case 'todo':
      return open ? ['complete', 'update', 'snooze', 'follow_up', 'assign', 'draft_reply', 'archive'] : it.status === 'done' ? ['reopen', 'archive'] : ['reopen'];
    case 'followup':
      return open ? ['complete', 'update', 'snooze', 'assign', 'draft_reply', 'cancel', 'archive'] : ['reopen'];
    case 'automation':
      if (open) return it.failing ? ['update', 'acknowledge', 'snooze', 'cancel', 'archive'] : ['update', 'cancel', 'archive'];
      return ['reopen'];
    case 'approval':
      if (open) return ['approve', 'reject', 'cancel', 'snooze', 'follow_up'];
      if (it.status === 'snoozed' || it.status === 'acknowledged') return ['reopen'];
      return it.status === 'archived' ? ['reopen'] : ['archive'];
    case 'pc':
      if (it.storeStatus === 'needs_approval') return open ? ['approve', 'reject', 'snooze'] : ['reopen'];
      if (it.storeStatus === 'queued') return open ? ['cancel'] : ['reopen'];
      return open ? (it.storeStatus === 'failed' ? ['acknowledge', 'archive'] : []) : ['reopen'];
    case 'ledger':
      return open ? ['complete', 'acknowledge', 'snooze', 'follow_up', 'assign', 'draft_reply', 'update', 'archive'] : viaOverlay ? ['reopen'] : [];
    case 'board-followup':
      return open ? ['cancel', 'snooze', 'acknowledge', 'follow_up', 'update', 'archive'] : viaOverlay ? ['reopen'] : [];
    case 'board-approval':
      return open ? ['approve', 'reject', 'cancel', 'snooze', 'acknowledge', 'follow_up'] : viaOverlay && ['snoozed', 'acknowledged'].includes(it.status) ? ['reopen'] : [];
    case 'inbox':
      return open ? ['complete', 'draft_reply', 'snooze', 'acknowledge', 'follow_up', 'assign', 'update', 'archive'] : viaOverlay ? ['reopen'] : [];
    case 'document':
      return open ? ['complete', 'draft_reply', 'snooze', 'acknowledge', 'follow_up', 'update', 'archive'] : viaOverlay ? ['reopen'] : [];
    case 'waiting':
      return open ? ['assign', 'acknowledge', 'snooze', 'follow_up', 'archive'] : viaOverlay ? ['reopen'] : [];
    case 'job':
      if (it.storeStatus !== 'failed') return [];
      return open ? ['acknowledge', 'snooze', 'follow_up', 'archive'] : viaOverlay ? ['reopen'] : [];
    case 'agent':
      return open ? ['acknowledge', 'snooze', 'follow_up', 'assign', 'archive'] : viaOverlay ? ['reopen'] : [];
    default: return [];
  }
}

const FILTERS = [
  ['open', 'All open', (i) => i.status === 'open'],
  ['needs-me', 'Needs me', (i) => i.status === 'open' && i.needsMe],
  ['axis', 'AXIS handling', (i) => i.status === 'open' && !i.needsMe && (i.axisHandling || /^(axis|agent:)/.test(i.owner || ''))],
  ['approvals', 'Approvals', (i) => i.status === 'open' && i.kind === 'approval'],
  ['follow-ups', 'Follow-ups', (i) => i.status === 'open' && i.kind === 'follow-up'],
  ['snoozed', 'Snoozed', (i) => i.status === 'snoozed'],
  ['done', 'Done / archived', (i) => CLOSED.has(i.status)],
];
const FILTER_IDS = FILTERS.map((f) => f[0]);

function matchesQuery(it, q) {
  const toks = String(q || '').toLowerCase().split(/[^a-z0-9#$@.-]+/).filter((w) => w.length >= 2);
  if (!toks.length) return true;
  const hay = `${it.title} ${it.detail || ''} ${it.label || ''} ${it.id}`.toLowerCase();
  return toks.every((w) => hay.includes(w));
}

/** Filter an already-built list (the director filters the list it read once per turn, without a re-read). */
function filterItems(items, filter = 'open', q = null) {
  let out = Array.isArray(items) ? items : [];
  if (filter && filter !== 'all') { const f = FILTERS.find((x) => x[0] === filter); if (f) out = out.filter(f[2]); }
  if (q) out = out.filter((i) => matchesQuery(i, q));
  return out;
}

/**
 * The list, from loaded data. Pure (no I/O). Returns { ok, generatedAt, local, items, counts, filters,
 * sources, overlay, situation } plus a non-enumerable `_raw` map (id → store record) for the mutations.
 */
function buildTaskList(data, { now = data.now || new Date(), filter = null, q = null } = {}) {
  const raw = collectRaw(data, now);
  const sit = buildSituation({
    snapshots: data.snapshots, source: data.boardSource,
    exec: data.health.exec === 'unavailable' ? null : { todos: data.exec.todos || [], tasks: data.exec.tasks || [], approvals: data.exec.approvals || [], followups: data.exec.followups || [], attention: [] },
    queue: data.queue, state: data.state, status: data.status, now, overlay: data.overlay, keepAll: true,
  });
  const ranked = new Map((sit.ranked || []).filter((r) => r.id).map((r, i) => [r.id, { rank: r.rank, pos: i, dueLabel: r.dueLabel }]));
  const canDo = new Set((sit.axisCanDoAll || []).map((x) => x.id).filter(Boolean));
  const overlay = data.overlay || {};
  const auditBy = new Map();
  for (const e of data.audit || []) { if (!e || !e.id) continue; const arr = auditBy.get(e.id) || []; if (arr.length < 5) arr.push(e); auditBy.set(e.id, arr); }

  const rawMap = new Map();
  const sigMap = new Map();
  const resolvedOverlay = {};
  const items = raw.map((r) => {
    const { _raw, _sig, ...it } = r;
    rawMap.set(it.id, _raw);
    sigMap.set(it.id, _sig);
    const rec = overlay[it.id];
    const ov = IDS.resolveOverlay(rec, { sig: _sig, now });
    if (ov.edits) {
      for (const k of ['title', 'detail', 'priority', 'owner']) if (ov.edits[k] != null && ov.edits[k] !== '') it[k] = ov.edits[k];
      if (ov.edits.due !== undefined) it.due = ov.edits.due ? iso(ov.edits.due) : null;
      it.edited = true;
    }
    it.draft = ov.draft || null;
    it.staged = ov.staged || null;
    it.followUps = ov.followUps || [];
    it.overlay = rec ? { status: ov.status, until: ov.until, lapsed: ov.lapsed, at: rec.at || null, by: rec.by || null, via: rec.via || null } : null;
    // The store's own closed status wins (a row the worker handled is handled) — except "archived", which is
    // Ahmad's "get it off my list" and applies to a decided row too.
    if ((it.status === 'open' && ov.status) || ov.status === 'archived') { it.status = ov.status; if (ov.status === 'snoozed') it.snoozedUntil = ov.until; }
    if (rec) resolvedOverlay[it.id] = { status: ov.status, until: ov.until };
    const rk = ranked.get(it.id);
    it.needsMe = it.status === 'open' && !!rk;
    it.rank = rk ? rk.rank : null;
    it.axisHandling = it.status === 'open' && !it.needsMe && (canDo.has(it.id) || /^(axis|agent:)/.test(it.owner || ''));
    it.dueLabel = IDS.dueLabel(it.due, now) || (it.overdueStamp ? 'OVERDUE' : '');
    it.updatedAt = it.updatedAt || (rec && rec.at) || it.createdAt || null;
    it.audit = auditBy.get(it.id) || [];
    it.actions = actionsFor(it);
    return it;
  });

  const group = (i) => (i.status === 'open' ? (i.needsMe ? 0 : i.axisHandling ? 2 : 1) : i.status === 'snoozed' ? 3 : 4);
  const dueT = (i) => { const t = Date.parse(i.due || ''); return Number.isFinite(t) ? t : Infinity; };
  items.sort((a, b) => group(a) - group(b)
    || (group(a) === 0 ? (ranked.get(a.id).pos - ranked.get(b.id).pos) : 0)
    || (group(a) < 4 ? dueT(a) - dueT(b) : 0)
    || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

  const counts = { total: items.length };
  for (const [fid, , fn] of FILTERS) counts[fid] = items.filter(fn).length;
  counts.needsMe = counts['needs-me']; counts.axis = counts.axis || 0; counts.approvals = counts.approvals || 0; counts.followUps = counts['follow-ups'];
  counts.archived = items.filter((i) => i.status === 'archived').length;
  const filters = FILTERS.map(([id, label]) => ({ id, label, count: counts[id] }));

  let shown = items;
  if (filter && FILTER_IDS.includes(filter)) shown = shown.filter(FILTERS.find((f) => f[0] === filter)[2]);
  else if (filter === 'all') shown = items;
  if (q) shown = shown.filter((i) => matchesQuery(i, q));

  const { ranked: _r, axisCanDoAll: _a, ...situation } = sit;
  const out = { ok: true, generatedAt: now.toISOString(), local: sit.local, items: shown, counts, filters, sources: { ...data.health }, overlay: resolvedOverlay, situation };
  Object.defineProperty(out, '_raw', { value: rawMap, enumerable: false });
  Object.defineProperty(out, '_sig', { value: sigMap, enumerable: false });
  Object.defineProperty(out, '_all', { value: items, enumerable: false });
  return out;
}

async function listTasks({ getStore = null, now = new Date(), fnDir = null, filter = null, q = null } = {}) {
  const data = await loadTaskData({ getStore, now, fnDir });
  return buildTaskList(data, { now, filter, q });
}

// ── Targeting ────────────────────────────────────────────────────────────────────────────────────────
const STOP = new Set(['the', 'a', 'an', 'my', 'our', 'to', 'for', 'of', 'on', 'in', 'and', 'it', 'that', 'this', 'one', 'item', 'task', 'todo', 'to-do', 'please', 'with', 'from', 'about', 'up']);
function tokens(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9#$@.\s-]/g, ' ').split(/\s+/).filter((w) => w.length >= 2 && !STOP.has(w)); }
/**
 * id (exact, or a bare store key) or free words → { item } | { ambiguous:true, candidates } | { none:true, candidates }.
 * Never picks between two equally good rows: "ask one short question with the top 3".
 */
function resolveTarget(items, { id = null, match = null } = {}) {
  if (id) {
    const s = String(id).trim();
    const hit = items.find((i) => i.id === s);
    if (hit) return { item: hit };
    const bySuffix = items.filter((i) => i.id.endsWith(':' + s));
    if (bySuffix.length === 1) return { item: bySuffix[0] };
    if (!match) return { unknown: true };
  }
  const phrase = String(match || '').toLowerCase().trim();
  const toks = tokens(phrase);
  if (!toks.length) return { none: true, candidates: [] };
  const scored = items.map((i) => {
    const title = String(i.title || '').toLowerCase();
    const detail = String(i.detail || '').toLowerCase();
    let s = 0;
    for (const w of toks) { if (title.includes(w)) s += 3; else if (detail.includes(w)) s += 1; }
    if (phrase.length >= 4 && title.includes(phrase)) s += 10;
    if (/^#\d+$/.test(toks[0]) && title.startsWith(toks[0] + ' ')) s += 20;
    if (s > 0 && i.status === 'open') s += 1;
    return { i, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  if (!scored.length) return { none: true, candidates: [] };
  const top = scored[0];
  const rivals = scored.filter((x) => x.s * 2 > top.s && x !== top);
  if (!rivals.length) return { item: top.i };
  return { ambiguous: true, candidates: [top, ...rivals].slice(0, 3).map((x) => ({ id: x.i.id, title: x.i.title, status: x.i.status, dueLabel: x.i.dueLabel || '' })) };
}

// ── Receipts ─────────────────────────────────────────────────────────────────────────────────────────
// One line per action, built from what was actually written — the director prints these, never the model's
// own claims. Glyph-led so a model line can never pass for one (axis-task-loop.cjs strips glyph lines).
const RECEIPT_GLYPHS = ['✔', '↩', '🗄', '⏰', '🔁', '🖐', '✖', '👁', '⊘', '👤', '📝', '✎', '➕'];
function receiptFor(action, item, extra = {}) {
  // "Approve: X" is how an approval row is titled on the list; in a receipt it would read "Approved: Approve: X".
  const t = String(item ? item.title : (extra.title || 'item')).replace(/^Approve:\s*/, '');
  switch (action) {
    case 'complete': return `✔ Done: ${t}`;
    case 'reopen': return `↩ Reopened: ${t}`;
    case 'archive': return `🗄 Archived: ${t}`;
    case 'snooze': return `⏰ Snoozed ${t} to ${IDS.fmtWhen(extra.until)}`;
    case 'follow_up': return `🔁 Follow-up set for ${t} — ${IDS.fmtWhen(extra.when)}${extra.owner && extra.owner !== 'ahmad' ? ' (' + String(extra.owner).replace(/^agent:/, '') + ')' : ''}`;
    case 'approve': return extra.staged
      ? `🖐 Your click: approve ${t} — it ${extra.effect && extra.effect.runsCommand ? 'runs a command on your PC' : extra.effect && extra.effect.spends ? 'commits $' + extra.effect.costUsd : 'sends'}; the button is waiting in the Live task view`
      : `✔ Approved: ${t}${extra.queued ? ' — queued for the worker' : extra.effect && extra.effect.sends ? ' — sends on the next run' : ''}`;
    case 'reject': return `✖ Rejected: ${t}`;
    case 'acknowledge': return `👁 Acknowledged: ${t}`;
    case 'cancel': return `⊘ Cancelled: ${t}`;
    case 'assign': return `👤 Assigned ${t} to ${extra.agent} — queued for its next run`;
    case 'draft_reply': return `📝 Reply drafted for ${t} — your send`;
    case 'update': return `✎ Updated ${t}${extra.changes ? ': ' + extra.changes : ''}`;
    case 'create': return `➕ Added: ${t}${extra.due ? ' — due ' + IDS.fmtWhen(extra.due) : ''}`;
    default: return `${action}: ${t}`;
  }
}

// ── Mutations ────────────────────────────────────────────────────────────────────────────────────────
const SNAP_FIELDS = ['status', 'title', 'due', 'priority', 'owner'];
const pick = (it) => (it ? Object.fromEntries(SNAP_FIELDS.map((k) => [k, it[k] === undefined ? null : it[k]])) : null);

/** Read-modify-write one assistant-store list right before writing (keeps the lost-update window short). */
async function rmwList(store, key, fn, cap) {
  const cur = await readKey(store, key);
  if (!cur.ok) throw httpError(503, 'store_unavailable', `the assistant store (${key}) did not answer — nothing was changed`);
  const list = Array.isArray(cur.value) ? cur.value : [];
  const next = fn(list) || list;
  await writeKey(store, key, cap ? next.slice(0, cap) : next);
  return next;
}
async function rmwOverlay(store, id, fn) {
  const cur = await readKey(store, IDS.OVERLAY_KEY);
  if (!cur.ok) throw httpError(503, 'store_unavailable', 'the task overlay did not answer — nothing was changed');
  const map = cur.value && typeof cur.value === 'object' && !Array.isArray(cur.value) ? cur.value : {};
  map[id] = fn(map[id] ? { ...map[id] } : {});
  const keys = Object.keys(map);
  if (keys.length > OVERLAY_CAP) keys.sort((a, b) => String(map[a].at || '').localeCompare(String(map[b].at || ''))).slice(0, keys.length - OVERLAY_CAP).forEach((k) => { delete map[k]; });
  await writeKey(store, IDS.OVERLAY_KEY, map);
  return map;
}
async function queueIntent(store, entry) {
  if (!store) return false;
  try { await store.setJSON(`pending/${entry.id}`, entry); return true; } catch { return false; }
}
const b36 = () => Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
/** The v2 shape axis-intent.mjs writes (schema axis-cc-v2): the worker applies the ones it knows. */
const v2Intent = (type, payload, actor) => ({ id: 'ccv2-' + b36(), ts: new Date().toISOString(), schema: 'axis-cc-v2', type, known: true, payload, actor: actor || 'ahmad', source: 'axis-tasks' });

function canonAgent(name, agents = AGENTS) {
  const s = String(name || '').replace(/^agent:/i, '').trim().toLowerCase();
  return agents.find((a) => a.toLowerCase() === s) || null;
}
function canonOwner(v, agents) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (/^(ahmad|me|ceo|you)$/i.test(s)) return 'ahmad';
  if (/^axis$/i.test(s)) return 'axis';
  const a = canonAgent(s, agents);
  return a ? `agent:${a}` : undefined; // undefined = present but not a known owner
}

/**
 * mutate({ action, id | match, fields, actor, via, … }) → { ok:true, action, item, audit, receipt, created?, staged?,
 * needsClick?, queued? } or throws httpError(status, code, message, extra) — 400 for an unknown action / id /
 * bad field, 409 for an action the row does not offer, 503 when a store did not answer (nothing changed).
 */
async function mutate({ getStore: injected = null, now = new Date(), fnDir = null, action, id = null, match = null, fields = {}, actor = 'ahmad', via = 'console', agents = AGENTS } = {}) {
  const act = canonAction(action);
  if (!act) throw httpError(400, 'unknown_action', `unknown action "${clip(action, 40)}" — one of ${ACTIONS.join(', ')}`);
  const who = actor === 'axis' ? 'axis' : 'ahmad';
  const channel = ['chat', 'voice', 'console'].includes(via) ? via : 'console';
  const f = fields && typeof fields === 'object' ? fields : {};
  const data = await loadTaskData({ getStore: injected, now, fnDir });
  const gs = data.getStore;
  const exec = open(gs, EXEC_STORE);
  const ovStore = open(gs, IDS.OVERLAY_STORE);
  const auditStore = open(gs, IDS.AUDIT_STORE);
  const at = now.toISOString();

  const record = async (entries) => {
    // The audit is part of the action: a mutation whose audit cannot be written still happened, so it is
    // reported (auditWritten:false) rather than silently claimed as audited.
    try {
      const cur = await readKey(auditStore, IDS.AUDIT_KEY);
      if (!cur.ok) return false;
      const list = Array.isArray(cur.value) ? cur.value : [];
      await writeKey(auditStore, IDS.AUDIT_KEY, [...entries.slice().reverse(), ...list].slice(0, AUDIT_CAP));
      return true;
    } catch { return false; }
  };
  const entry = (a, itemId, before, after) => ({ at, actor: who, action: a, id: itemId, before, after, via: channel });

  // ── create (no target) ──
  if (act === 'create') {
    const title = clip(f.title, 200);
    if (!title) throw httpError(400, 'bad_field', 'title required');
    let due = null;
    if (f.due) { const d = IDS.parseWhen(f.due, { now, defaultHour: 23, defaultMinute: 59 }); if (!d) throw httpError(400, 'bad_field', `could not read the due date "${clip(f.due, 40)}"`); due = d.toISOString(); }
    const owner = f.owner ? canonOwner(f.owner, agents) : 'ahmad';
    if (owner === undefined) throw httpError(400, 'bad_field', `unknown owner "${clip(f.owner, 40)}"`);
    const needsYou = typeof f.needsYou === 'boolean' ? f.needsYou : owner === 'ahmad';
    const todo = { id: nid('todo'), title, priority: ['high', 'normal', 'low'].includes(f.priority) ? f.priority : 'normal', needsYou, note: clip(f.detail || f.note, 500),
      done: false, created_at: at, done_at: null, due, owner, updated_at: at, created_by: who, via: channel };
    await rmwList(exec, 'todos', (l) => [todo, ...l], 300);
    data.exec.todos = [todo, ...(data.exec.todos || [])];
    const list = buildTaskList(data, { now });
    const item = list._all.find((i) => i.id === `todo:${todo.id}`);
    const e = entry('create', item.id, null, pick(item));
    const auditWritten = await record([e]);
    return { ok: true, action: act, item: { ...item, audit: [e] }, audit: e, auditWritten, receipt: receiptFor('create', item, { due }), created: item };
  }

  // ── resolve the target ──
  const list = buildTaskList(data, { now });
  const items = list._all;
  const target = resolveTarget(items, { id, match });
  if (target.unknown) throw httpError(400, 'unknown_id', `no item with id "${clip(id, 80)}"`);
  if (target.none) throw httpError(400, 'not_found', `nothing on the list matches "${clip(match, 80)}"`, { candidates: items.filter((i) => i.status === 'open').slice(0, 3).map((i) => ({ id: i.id, title: i.title })) });
  if (target.ambiguous) throw httpError(409, 'ambiguous', `"${clip(match, 80)}" matches more than one item — which one?`, { candidates: target.candidates });
  const item = target.item;
  if (!item.actions.includes(act)) throw httpError(409, 'not_allowed', `${act} is not available for "${item.title}" (${item.status})`, { actions: item.actions, id: item.id });
  const raw = list._raw.get(item.id);
  const before = pick(item);
  const src = item.source;
  const key = (raw && raw.id != null) ? String(raw.id) : null;
  const res = { ok: true, action: act };
  const extra = {};
  const overlayPatch = async (fn) => { const map = await rmwOverlay(ovStore, item.id, (r) => ({ ...fn(r), at, by: who, via: channel })); data.overlay = map; };
  // After the real action (an intent the worker applies) has been queued, a failed bookkeeping write must not
  // turn into "nothing was changed": the action stands and the reply says the list catches up on the next tick.
  const overlayAfterQueue = async (fn) => { try { await overlayPatch(fn); } catch { res.overlayWritten = false; res.note = 'queued for the worker — the list shows it once the worker applies it'; } };
  const execPatch = async (storeKey, dataKey, fn) => {
    if (key == null) throw httpError(409, 'no_store_id', `"${item.title}" has no id in its store — nothing was changed`);
    const next = await rmwList(exec, storeKey, (l) => {
      let found = false;
      const mapped = l.map((x) => { if (x && String(x.id) === key) { found = true; return fn({ ...x }); } return x; });
      // Thrown before the write: a row that vanished between the read and now is reported, never re-created.
      if (!found) throw httpError(409, 'gone', `"${item.title}" is no longer in the store — refresh the list`);
      return mapped;
    });
    data.exec[dataKey] = next;
  };
  const inbox = open(gs, INBOX_STORE, false);
  const entries = [];

  switch (act) {
    case 'complete': {
      if (src === 'todo') await execPatch('todos', 'todos', (t) => ({ ...t, done: true, done_at: at, updated_at: at }));
      else if (src === 'followup') await execPatch('followups', 'followups', (x) => ({ ...x, status: 'done', done_at: at, updated_at: at }));
      else {
        await overlayPatch((r) => ({ ...r, status: 'done' }));
        if (src === 'inbox' && raw) res.queued = await queueIntent(inbox, v2Intent('mark_handled', { message_id: raw.id, thread_id: raw.thread_id || null }, who));
      }
      break;
    }
    case 'reopen': {
      if (src === 'todo' && raw && (raw.done || raw.archived)) {
        await execPatch('todos', 'todos', (t) => ({ ...t, done: false, done_at: null, archived: false, archived_at: null, updated_at: at }));
      } else if (src === 'followup' && raw && raw.status !== 'open') {
        await execPatch('followups', 'followups', (x) => ({ ...x, status: 'open', updated_at: at }));
      } else if (src === 'automation' && raw && raw.status !== 'active') {
        await execPatch('tasks', 'tasks', (t) => ({ ...t, status: 'active', archived: false, archived_at: null, cancelled_at: null }));
      }
      if (data.overlay && data.overlay[item.id] && data.overlay[item.id].status && data.overlay[item.id].status !== 'open') await overlayPatch((r) => ({ ...r, status: 'open', until: null, sig: null }));
      break;
    }
    case 'archive': {
      if (src === 'todo') await execPatch('todos', 'todos', (t) => ({ ...t, archived: true, archived_at: at, updated_at: at }));
      else if (src === 'followup') await execPatch('followups', 'followups', (x) => ({ ...x, status: 'archived', updated_at: at }));
      else if (src === 'automation') await execPatch('tasks', 'tasks', (t) => ({ ...t, status: 'paused', archived: true, archived_at: at }));
      else await overlayPatch((r) => ({ ...r, status: 'archived', reason: clip(f.reason, 200) || null }));
      break;
    }
    case 'snooze': {
      const d = IDS.parseWhen(f.until, { now, defaultHour: 9, defaultMinute: 0 });
      if (!d) throw httpError(400, 'bad_field', `could not read the snooze date "${clip(f.until, 40)}"`);
      if (d.getTime() <= now.getTime()) throw httpError(400, 'bad_field', 'a snooze must end in the future');
      extra.until = d.toISOString();
      await overlayPatch((r) => ({ ...r, status: 'snoozed', until: extra.until }));
      if (src === 'inbox' && raw) res.queued = await queueIntent(inbox, v2Intent('snooze', { message_id: raw.id, thread_id: raw.thread_id || null, until: extra.until }, who));
      break;
    }
    case 'follow_up': {
      const d = IDS.parseWhen(f.when || f.due, { now, defaultHour: 9, defaultMinute: 0 });
      if (!d) throw httpError(400, 'bad_field', `could not read the follow-up date "${clip(f.when || f.due, 40)}"`);
      const owner = f.owner ? canonOwner(f.owner, agents) : 'ahmad';
      if (owner === undefined) throw httpError(400, 'bad_field', `unknown owner "${clip(f.owner, 40)}"`);
      extra.when = d.toISOString(); extra.owner = owner;
      const note = clip(f.note, 300);
      const fuRec = { id: nid('fu'), parent: item.id, parentTitle: clip(item.title, 200), title: clip(`Follow up: ${item.title.replace(/^Approve:\s*/, '')}${note ? ' — ' + note : ''}`, 200), note: note || '',
        due: extra.when, owner, status: 'open', priority: null, created_at: at, updated_at: at, created_by: who, via: channel };
      await rmwList(exec, 'followups', (l) => [fuRec, ...l], 500);
      data.exec.followups = [fuRec, ...(data.exec.followups || [])];
      await overlayPatch((r) => ({ ...r, followUps: [...(Array.isArray(r.followUps) ? r.followUps : []), `followup:${fuRec.id}`].slice(-20) }));
      res.createdId = `followup:${fuRec.id}`;
      break;
    }
    case 'approve': {
      const effect = item.effect || (src === 'approval' ? approvalEffect(raw || {}) : { sends: src === 'board-approval', spends: false });
      extra.effect = effect;
      const consequential = !!(effect.sends || effect.spends || effect.runsCommand);
      if (channel !== 'console' && consequential) {
        // Rule: anything that SENDS, PAYS or runs a command stays Ahmad's click. Asked by chat or voice it is
        // staged — recorded and highlighted — never executed.
        await overlayPatch((r) => ({ ...r, staged: { action: 'approve', at, via: channel } }));
        res.staged = true; res.needsClick = true; extra.staged = true;
        break;
      }
      if (src === 'approval') {
        await execPatch('approvals', 'approvals', (a) => (a.status === 'pending' ? { ...a, status: 'approved', decided_at: at } : a));
        if (data.overlay && data.overlay[item.id] && data.overlay[item.id].staged) await overlayPatch((r) => ({ ...r, staged: null }));
      } else if (src === 'board-approval') {
        res.queued = await queueIntent(inbox, v2Intent('approve', { item_id: raw && raw.id }, who));
        if (!res.queued) throw httpError(503, 'store_unavailable', 'the worker queue did not answer — nothing was approved');
        extra.queued = true;
        await overlayAfterQueue((r) => ({ ...r, status: 'approved', staged: null }));
      } else if (src === 'pc') {
        await execPatch('local-jobs', 'localJobs', (j) => (['needs_approval', 'queued'].includes(j.status) ? { ...j, status: 'queued', decided_at: at } : j));
        if (data.overlay && data.overlay[item.id] && data.overlay[item.id].staged) await overlayPatch((r) => ({ ...r, staged: null }));
      }
      break;
    }
    case 'reject': {
      const reason = clip(f.reason, 200) || null;
      if (src === 'approval') await execPatch('approvals', 'approvals', (a) => (a.status === 'pending' ? { ...a, status: 'declined', decided_at: at, reason } : a));
      else if (src === 'board-approval') {
        res.queued = await queueIntent(inbox, v2Intent('reject', { item_id: raw && raw.id, reason: reason || 'other' }, who));
        if (!res.queued) throw httpError(503, 'store_unavailable', 'the worker queue did not answer — nothing was rejected');
        await overlayAfterQueue((r) => ({ ...r, status: 'rejected', staged: null }));
      } else if (src === 'pc') await execPatch('local-jobs', 'localJobs', (j) => (['needs_approval', 'queued'].includes(j.status) ? { ...j, status: 'declined', decided_at: at } : j));
      break;
    }
    case 'acknowledge': {
      // The row's signature at this moment: if the row itself changes later, the acknowledgement lapses.
      await overlayPatch((r) => ({ ...r, status: 'acknowledged', sig: list._sig.get(item.id) || null }));
      break;
    }
    case 'cancel': {
      const reason = clip(f.reason, 200) || null;
      if (src === 'automation') await execPatch('tasks', 'tasks', (t) => ({ ...t, status: 'paused', cancelled_at: at }));
      else if (src === 'approval') await execPatch('approvals', 'approvals', (a) => (a.status === 'pending' ? { ...a, status: 'cancelled', decided_at: at, reason } : a));
      else if (src === 'followup') await execPatch('followups', 'followups', (x) => ({ ...x, status: 'cancelled', updated_at: at }));
      else if (src === 'pc') await execPatch('local-jobs', 'localJobs', (j) => (['needs_approval', 'queued'].includes(j.status) ? { ...j, status: 'declined', decided_at: at } : j));
      else if (src === 'board-followup') {
        res.queued = await queueIntent(inbox, v2Intent('cancel_followup', raw && raw.id != null ? { follow_up_id: raw.id } : { business_id: raw && raw.business_id }, who));
        if (!res.queued) throw httpError(503, 'store_unavailable', 'the worker queue did not answer — nothing was cancelled');
        await overlayAfterQueue((r) => ({ ...r, status: 'cancelled' }));
      } else if (src === 'board-approval') {
        res.queued = await queueIntent(inbox, v2Intent('skip', { item_id: raw && raw.id }, who));
        if (!res.queued) throw httpError(503, 'store_unavailable', 'the worker queue did not answer — nothing was cancelled');
        await overlayAfterQueue((r) => ({ ...r, status: 'cancelled', staged: null }));
      }
      break;
    }
    case 'assign': {
      const agent = canonAgent(f.agent, agents);
      if (!agent) throw httpError(400, 'bad_field', `unknown agent "${clip(f.agent, 40)}" — one of ${agents.join(', ')}`);
      extra.agent = agent;
      if (src === 'waiting' && raw && !raw.aggregate) {
        // The Waiting Reply "Delegate" button's own intent — the worker applies it (follow-up engine, still
        // approval-gated before anything sends).
        res.queued = await queueIntent(inbox, v2Intent('delegate_followup', { business_id: raw.business_id, outreach_item_id: raw.id }, who));
      } else {
        // The director's own routing shape: a command the worker runs behind its rails.
        res.queued = await queueIntent(inbox, { id: 'axis-' + b36(), ts: at, action: 'command', agent, intent: sanitize(`${item.title}${item.detail ? ' — ' + item.detail : ''}`, 140), needsApproval: false, source: 'axis-tasks', taskId: item.id });
      }
      if (!res.queued) throw httpError(503, 'store_unavailable', 'the agent queue did not answer — nothing was assigned');
      const owner = `agent:${agent}`;
      try {
        if (src === 'todo') await execPatch('todos', 'todos', (t) => ({ ...t, owner, needsYou: false, updated_at: at }));
        else if (src === 'followup') await execPatch('followups', 'followups', (x) => ({ ...x, owner, updated_at: at }));
        else await overlayPatch((r) => ({ ...r, edits: { ...(r.edits || {}), owner } }));
      } catch { res.overlayWritten = false; res.note = 'queued for the agent — the owner shows on the list once the store answers'; }
      break;
    }
    case 'draft_reply': {
      const text = String(f.text || '').trim().slice(0, 8000);
      if (!text) throw httpError(400, 'bad_field', 'text required — the draft itself');
      const doc = { id: nid('ws'), title: clip(`Reply draft: ${item.title}`, 200), kind: 'email', content: text, created_at: at, updated_at: at, model: 'axis-tasks', reply_for: item.id, status: 'draft' };
      await rmwList(exec, 'workspace', (l) => [doc, ...l], 100);
      data.exec.workspace = [doc, ...(data.exec.workspace || [])];
      await overlayPatch((r) => ({ ...r, draft: { docId: doc.id, at } }));
      res.docId = doc.id;
      break;
    }
    case 'update': {
      const patch = {};
      if (f.title !== undefined) { const v = clip(f.title, 200); if (!v) throw httpError(400, 'bad_field', 'title cannot be empty'); patch.title = v; }
      if (f.detail !== undefined) patch.detail = clip(f.detail, 500);
      if (f.due !== undefined) {
        if (f.due === null || f.due === '') patch.due = null;
        else { const d = IDS.parseWhen(f.due, { now, defaultHour: 23, defaultMinute: 59 }); if (!d) throw httpError(400, 'bad_field', `could not read the due date "${clip(f.due, 40)}"`); patch.due = d.toISOString(); }
      }
      if (f.priority !== undefined) { if (!['high', 'normal', 'low'].includes(f.priority)) throw httpError(400, 'bad_field', 'priority is high, normal or low'); patch.priority = f.priority; }
      if (f.owner !== undefined) { const o = canonOwner(f.owner, agents); if (!o) throw httpError(400, 'bad_field', `unknown owner "${clip(f.owner, 40)}"`); patch.owner = o; }
      if (!Object.keys(patch).length) throw httpError(400, 'bad_field', 'nothing to update — title, detail, due, priority or owner');
      extra.changes = Object.entries(patch).map(([k, v]) => `${k} ${k === 'due' ? (v ? IDS.fmtWhen(v) : 'cleared') : v}`).join(', ');
      if (src === 'todo') {
        await execPatch('todos', 'todos', (t) => ({ ...t, ...(patch.title ? { title: patch.title } : {}), ...(patch.detail !== undefined ? { note: patch.detail } : {}),
          ...(patch.due !== undefined ? { due: patch.due } : {}), ...(patch.priority ? { priority: patch.priority } : {}),
          ...(patch.owner ? { owner: patch.owner, needsYou: patch.owner === 'ahmad' } : {}), updated_at: at }));
      } else if (src === 'followup') {
        await execPatch('followups', 'followups', (x) => ({ ...x, ...(patch.title ? { title: patch.title } : {}), ...(patch.detail !== undefined ? { note: patch.detail } : {}),
          ...(patch.due !== undefined ? { due: patch.due } : {}), ...(patch.priority ? { priority: patch.priority } : {}), ...(patch.owner ? { owner: patch.owner } : {}), updated_at: at }));
      } else if (src === 'automation' && (patch.title || patch.detail)) {
        await execPatch('tasks', 'tasks', (t) => ({ ...t, ...(patch.title ? { title: patch.title } : {}), ...(patch.detail ? { instructions: String(f.detail).slice(0, 3000) } : {}) }));
        const rest = { ...patch }; delete rest.title; delete rest.detail;
        if (Object.keys(rest).length) await overlayPatch((r) => ({ ...r, edits: { ...(r.edits || {}), ...rest } }));
      } else {
        await overlayPatch((r) => ({ ...r, edits: { ...(r.edits || {}), ...patch } }));
      }
      break;
    }
    default: throw httpError(400, 'unknown_action', `unknown action "${act}"`);
  }

  // Rebuild from what was written (no second read) and audit it.
  const after = buildTaskList(data, { now });
  const updated = after._all.find((i) => i.id === item.id) || { ...item };
  const e = entry(res.staged ? 'approve.staged' : act, item.id, before, { ...pick(updated), ...(extra.until ? { until: extra.until } : {}), ...(extra.agent ? { agent: extra.agent } : {}), ...(res.createdId ? { followUp: res.createdId, when: extra.when } : {}), ...(res.docId ? { draft: res.docId } : {}), ...(res.queued !== undefined ? { queued: !!res.queued } : {}) });
  entries.push(e);
  let created = null;
  if (res.createdId) {
    created = after._all.find((i) => i.id === res.createdId) || null;
    if (created) entries.push(entry('create', created.id, null, { ...pick(created), parent: item.id }));
  }
  const auditWritten = await record(entries);
  updated.audit = [e, ...(updated.audit || [])].slice(0, 5);
  return { ...res, item: updated, audit: e, auditWritten, receipt: receiptFor(act, item, { ...extra, ...(res.staged ? { staged: true } : {}) }), ...(created ? { created } : {}) };
}

// ── The tools the director brain is given (Anthropic Messages `tools`) ──────────────────────────────
// Nothing here sends, pays or publishes: there is deliberately no send_email / pay / publish tool. The
// `approve` tool stages a sending/spending approval for Ahmad's click (see mutate → approve).
const TARGET = { id: { type: 'string', description: 'The item id from the live list, e.g. "todo:todo-abc12" or "ledger:#5". Prefer this.' }, match: { type: 'string', description: 'Only when you have no id: the words Ahmad used to name the item. Ambiguous words return candidates — then ask him which one.' } };
const TOOLS = [
  { name: 'list_tasks', description: 'Read the live task list (every source: to-dos, approvals, follow-ups, the CEO ledger, the board, automations, worker failures). Use a filter or a query to narrow it.', input_schema: { type: 'object', properties: { filter: { type: 'string', enum: [...FILTER_IDS, 'all'], description: 'open (default) · needs-me · axis · approvals · follow-ups · snoozed · done · all' }, query: { type: 'string', description: 'words to search titles and details' }, limit: { type: 'integer', minimum: 1, maximum: 40 } } } },
  { name: 'update_task', description: 'Edit an item: title, detail, due date, priority or owner.', input_schema: { type: 'object', properties: { ...TARGET, title: { type: 'string' }, detail: { type: 'string' }, due: { type: 'string', description: 'ISO date (YYYY-MM-DD) or a day word ("friday"); empty string clears it' }, priority: { type: 'string', enum: ['high', 'normal', 'low'] }, owner: { type: 'string', description: 'ahmad, axis, or an agent name' } } } },
  { name: 'complete_task', description: 'Mark an item done.', input_schema: { type: 'object', properties: { ...TARGET } } },
  { name: 'reopen_task', description: 'Reopen a done, archived, snoozed or acknowledged item.', input_schema: { type: 'object', properties: { ...TARGET } } },
  { name: 'archive_task', description: 'Remove / delete an item from the list. Nothing is destroyed: it stays readable under Done / archived.', input_schema: { type: 'object', properties: { ...TARGET, reason: { type: 'string' } } } },
  { name: 'snooze_task', description: 'Hide an item until a date; it comes back on its own.', input_schema: { type: 'object', properties: { ...TARGET, until: { type: 'string', description: 'ISO date or a day word ("friday", "next week", "tomorrow")' } }, required: ['until'] } },
  { name: 'follow_up', description: 'Create a dated follow-up linked to an item.', input_schema: { type: 'object', properties: { ...TARGET, when: { type: 'string', description: 'ISO date or a day word' }, note: { type: 'string' }, owner: { type: 'string', description: 'ahmad (default), axis, or an agent name' } }, required: ['when'] } },
  { name: 'approve', description: 'Approve a pending approval. One that would send an email, commit money or run a command on his PC is staged for Ahmad\'s click instead — say so.', input_schema: { type: 'object', properties: { ...TARGET } } },
  { name: 'reject', description: 'Reject / decline a pending approval.', input_schema: { type: 'object', properties: { ...TARGET, reason: { type: 'string' } } } },
  { name: 'acknowledge', description: 'Acknowledge a row (seen it) — it leaves the "needs you" ranking until it changes.', input_schema: { type: 'object', properties: { ...TARGET } } },
  { name: 'cancel', description: 'Cancel an automation, a pending approval, a follow-up or a queued PC command.', input_schema: { type: 'object', properties: { ...TARGET, reason: { type: 'string' } } } },
  { name: 'assign_to_agent', description: 'Hand an item to a named agent; it is queued for that agent\'s next run.', input_schema: { type: 'object', properties: { ...TARGET, agent: { type: 'string', enum: AGENTS } }, required: ['agent'] } },
  { name: 'draft_reply', description: 'Write a reply draft for an item into the Workspace. It is NOT sent — the send stays Ahmad\'s click.', input_schema: { type: 'object', properties: { ...TARGET, text: { type: 'string', description: 'the full draft' } }, required: ['text'] } },
  { name: 'create_task', description: 'Add a new item to Ahmad\'s list.', input_schema: { type: 'object', properties: { title: { type: 'string' }, detail: { type: 'string' }, due: { type: 'string' }, priority: { type: 'string', enum: ['high', 'normal', 'low'] }, owner: { type: 'string', description: 'ahmad (default), axis, or an agent name' } }, required: ['title'] } },
];
const TOOL_ACTION = { update_task: 'update', complete_task: 'complete', reopen_task: 'reopen', archive_task: 'archive', snooze_task: 'snooze', follow_up: 'follow_up', approve: 'approve', reject: 'reject', acknowledge: 'acknowledge', cancel: 'cancel', assign_to_agent: 'assign', draft_reply: 'draft_reply', create_task: 'create' };

/** A row as the model sees it — short, id first, what it can do. */
function compactItem(i) {
  return { id: i.id, title: i.title, source: i.label, status: i.status, due: i.due ? i.due.slice(0, 10) : null, dueLabel: i.dueLabel || null, owner: i.owner, needsMe: !!i.needsMe,
    next: i.next || null, actions: i.actions, ...(i.draft ? { draftReady: true } : {}), ...(i.staged ? { stagedForClick: i.staged.action } : {}), ...(i.sendsOnApprove || (i.effect && (i.effect.sends || i.effect.spends || i.effect.runsCommand)) ? { approvalIsHisClick: true } : {}) };
}
/** The live list as a compact text block for a system prompt (ids the model can act on). */
function tasksBlock(list, { limit = 25 } = {}) {
  if (!list || !list.ok) return 'LIVE TASK LIST: did not answer this turn — say so; do not claim the list is empty.';
  const open = (list._all || list.items).filter((i) => i.status === 'open');
  const c = list.counts || {};
  const src = list.sources || {};
  const gaps = [src.exec !== 'ok' ? `assistant store ${src.exec}` : '', src.board !== 'live' ? `board ${src.board}` : '', src.overlay !== 'ok' ? 'overlay unavailable' : ''].filter(Boolean);
  const lines = open.slice(0, limit).map((i, n) => `${n + 1}. [${i.id}] ${i.title}${i.dueLabel ? ' — ' + i.dueLabel : ''} · ${i.label} · owner ${i.owner}${i.needsMe ? ' · NEEDS AHMAD' : i.axisHandling ? ' · AXIS handling' : ''}${i.draft ? ' · draft ready' : ''}${i.staged ? ' · staged for his click' : ''} · next: ${i.next || '—'} · can: ${i.actions.join('/') || 'view only'}`);
  return `LIVE TASK LIST (${c.open || 0} open · ${c.needsMe || 0} need Ahmad · ${c.axis || 0} AXIS handling · ${c.snoozed || 0} snoozed · ${c.done || 0} done/archived${gaps.length ? ' · NOT ANSWERING: ' + gaps.join(', ') : ''}):\n${lines.join('\n') || '(nothing open)'}${open.length > limit ? `\n…and ${open.length - limit} more (list_tasks to page/search).` : ''}`;
}

/** Deterministic, $0 answer to "what's on my list / what needs me" — used when no model can be reached. */
function renderListAnswer(list, { limit = 5 } = {}) {
  if (!list || !list.ok) return 'I could not read the live task list just now — the store did not answer, so I am not going to call it empty.';
  const all = list._all || list.items;
  const needs = all.filter((i) => i.status === 'open' && i.needsMe);
  const axis = all.filter((i) => i.status === 'open' && i.axisHandling);
  const c = list.counts || {};
  const head = `Live list: ${c.open || 0} open · ${c.needsMe || 0} need you · ${c.axis || 0} AXIS handling.`;
  if (!needs.length) return `${head} Nothing needs you right now.${axis.length ? ` AXIS is carrying: ${axis.slice(0, 3).map((i) => i.title).join('; ')}.` : ''}`;
  const lines = needs.slice(0, limit).map((i, n) => `${n + 1}. ${i.title}${i.dueLabel ? ' — ' + i.dueLabel : ''} — ${i.owner === 'ahmad' ? 'you' : i.owner.replace(/^agent:/, '')}: ${i.next || 'your call'}`);
  return `${head}\n${lines.join('\n')}${needs.length > limit ? `\n…and ${needs.length - limit} more in the Live task view.` : ''}`;
}

// ── "Is this a task ask?" — the server half (assets/axis-tasks.js carries the browser twin; a parity test
// keeps them in step). List asks and verb-on-an-item asks go to the director's tool loop, never to a brain
// that cannot see or touch the list.
const TASK_LIST_ASK = new RegExp([
  "\\bwhat(?:'s|s| is| are)? (?:on|in) (?:my|the|our) (?:to-?do(?: list)?|list|task list|plate|agenda)\\b",
  '\\bwhat (?:needs|requires|is waiting on|\'s waiting on|is pending for) (?:me|my attention|ahmad|my (?:ok|okay|approval|sign-?off|decision))\\b',
  '\\b(?:anything|what) (?:else )?(?:that )?needs (?:me|my attention)\\b',
  '\\bwhat (?:do|should) i (?:need to )?(?:do|work on|tackle|handle|focus on)(?: (?:today|now|next|first|this week))?\\b',
  '\\b(?:show|pull up|bring up|read|give|walk|go through|run through|list)(?: me)?(?: through)? (?:my|the|our|all)? ?(?:open |live |current |whole )?(?:to-?dos?|to-?do list|task list|tasks|list|priorities|priority list|action items|open items)\\b',
  "\\b(?:let'?s|lets|let us|we should|can we|help me) (?:work (?:on|through)|tackle|go through|knock out|clear|start on|get through|action|work)\\b[^.?!]{0,40}\\b(?:items?|things|tasks?|list|to-?dos?|priorities|approvals|follow-?ups|urgent)\\b",
  "\\b(?:let'?s|lets) work on:",
  '\\btop (?:\\d+|one|two|three|five|ten) (?:urgent |priority |important )?(?:items|things|tasks|priorities)\\b',
  '\\b(?:most|top) (?:urgent|important|pressing) (?:items?|things?|tasks?)\\b',
  "\\bwhat(?:'s| is) (?:urgent|overdue|due (?:today|tomorrow|this week)|pending)\\b",
].join('|'), 'i');
const TASK_ACTION_ASK = new RegExp([
  '\\bmark (?:it|that|this|them|those|\\S.{0,60}?) (?:as )?(?:done|complete|completed|finished|handled)\\b',
  "\\bi(?:'ve| have)? (?:finished|completed|wrapped up|handled|dealt with|taken care of)\\b", "\\b(?:i'?m |we'?re )?done with (?:the |that |this |my )?\\S",
  '\\b(?:check|tick|cross) (?:it |that |this |them |\\S.{0,40}? )?off\\b', '\\bclose (?:out )?(?:the |that |this )?(?:item|task|to-?do|row|follow-?up)\\b',
  '\\bsnooze\\b', '\\b(?:defer|postpone)\\b', '\\bpush (?:it|that|this|\\S.{0,40}?) (?:to|until|till|back)\\b',
  '\\bfollow[- ]?up (?:on|with|about)\\b', '\\bset (?:a |up a )?follow[- ]?up\\b',
  '\\b(?:approve|reject|decline)\\b(?! of\\b)', '\\backnowledge\\b', '^\\s*ack\\b', '\\breopen\\b', '\\bun-?archive\\b',
  '\\b(?:archive|delete|remove|drop|clear|cancel)\\b[^.?!]{0,60}\\b(?:from|off|on) (?:my|the|our) (?:list|to-?do(?: list)?|tasks?|board|queue|priorities)\\b',
  '\\b(?:archive|cancel) (?:the |that |this |my )?\\S',
  '\\b(?:assign|hand|give|delegate)\\b[^.?!]{0,60}\\bto (?:' + AGENTS.join('|') + ')\\b',
  '\\bdraft (?:a |the )?(?:reply|response|answer) (?:to|for)\\b', '\\b(?:reply|respond|write back) to\\b',
  '\\b(?:rename|retitle)\\b', '\\bchange (?:the )?(?:title|due date|deadline|priority|owner)\\b', '\\bset (?:the )?(?:priority|due date|deadline)\\b',
  '\\b(?:add|put) [^.?!]{1,80}\\b(?:to|on) (?:my|the|our) (?:list|to-?do(?: list)?|tasks?)\\b',
].join('|'), 'i');
function taskIntent(text) {
  const t = String(text || '').trim();
  if (t.length < 4) return null;
  if (TASK_LIST_ASK.test(t)) return 'list';
  if (TASK_ACTION_ASK.test(t)) return 'action';
  return null;
}

module.exports = {
  EXEC_STORE, SNAP_STORE, INBOX_STORE, STATUSES, CLOSED, ACTIONS, AGENTS, FILTER_IDS, TOOLS, TOOL_ACTION, RECEIPT_GLYPHS,
  _setGetStore, loadTaskData, buildTaskList, listTasks, filterItems, mutate, resolveTarget, receiptFor, actionsFor, compactItem, tasksBlock,
  renderListAnswer, taskIntent, canonAction, canonAgent, situationInstruction, httpError,
};
