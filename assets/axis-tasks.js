// axis-tasks.js — the Live task view (RUN-AX3, 2026-10-15). Vanilla ESM, no framework.
//
// Ahmad: "AXIS cannot see the live task view, the to-do list of the company so we can work on it together and
// get things actioned." This module is the view half: ONE list from /api/axis/tasks (to-dos, approvals,
// follow-ups, the CEO ledger, the worker's board, automations, worker failures — every row with a stable id),
// a panel on the Overview ("Live task view — N open · M need you · K AXIS handling") and a full screen reached
// from Priorities, with the controls each row actually offers (Done · Snooze · Follow up · Approve/Reject ·
// Acknowledge · Archive · Edit · Draft reply · Assign · Work it). The SAME list is what the director's tool loop
// reads and changes when Ahmad talks — so the screen and AXIS can never disagree.
//
// Rules this module keeps:
//   * honest: a store that did not answer is said ("assistant store — did not answer"), never shown as clear;
//   * optimistic, then server truth: a click moves the row at once, the server's item + receipt replace it,
//     a refusal puts it back and says why;
//   * nothing here sends, pays or publishes. Approve is Ahmad's own click (via:"console") and asks him first
//     when approving would send an email, commit money or run a command on his PC. "Draft reply" asks AXIS
//     to write the draft; sending it stays his click in the composer.
//   * refresh every 30 s, and at once when a chat or voice turn changed the list (event 'axis:tasks-changed').
import { el, toast, ago, head } from './axis-dom.js';

const TOKEN_KEY = 'aperture_jwt';
const ENDPOINT = '/api/axis/tasks';
const REFRESH_MS = 30000;
// Receipt glyphs (lib/axis-tasks.cjs RECEIPT_GLYPHS) — stripped before a reply is spoken aloud.
export const TASK_GLYPHS = ['✔', '↩', '🗄', '⏰', '🔁', '🖐', '✖', '👁', '⊘', '👤', '📝', '✎', '➕'];
const AGENTS = ['Hunter', 'Forager', 'Prospector', 'Globe', 'Tender', 'Bidwatch', 'Pitch', 'Closer', 'Ops', 'Scout', 'Applicant', 'Tuner',
  'Renew', 'Ledger', 'Auditor', 'Compass', 'Observer', 'Dispatch', 'Mesh', 'Vault', 'Herald', 'Dawn', 'Dusk', 'Biller', 'Steward', 'Scholar', 'Grantwright'];
const CLOSED = new Set(['done', 'archived', 'approved', 'rejected', 'cancelled', 'acknowledged']);
// The same filters the endpoint defines (lib/axis-tasks.cjs FILTERS) — counts move the instant a row does.
const FILTERS = [
  ['needs-me', 'Needs me', (i) => i.status === 'open' && i.needsMe],
  ['axis', 'AXIS handling', (i) => i.status === 'open' && !i.needsMe && (i.axisHandling || /^(axis|agent:)/.test(i.owner || ''))],
  ['approvals', 'Approvals', (i) => i.status === 'open' && i.kind === 'approval'],
  ['follow-ups', 'Follow-ups', (i) => i.status === 'open' && i.kind === 'follow-up'],
  ['snoozed', 'Snoozed', (i) => i.status === 'snoozed'],
  ['done', 'Done / archived', (i) => CLOSED.has(i.status)],
  ['open', 'All open', (i) => i.status === 'open'],
];
const OPTIMISTIC = { complete: 'done', archive: 'archived', snooze: 'snoozed', acknowledge: 'acknowledged', cancel: 'cancelled', reject: 'rejected', approve: 'approved', reopen: 'open' };
const LABEL = { complete: 'Done', reopen: 'Reopen', archive: 'Archive', acknowledge: 'Acknowledge', cancel: 'Cancel', reject: 'Reject', approve: 'Approve', update: 'Edit', follow_up: 'Follow up', draft_reply: 'Draft reply' };

const S = { data: null, err: null, at: 0, filter: null, filterChosen: false, q: '', editing: null, open: new Set(), drafts: new Map() };
let ctx = { authHeaders: null, onChange: null, go: null, sendToAxis: null, openReply: null, onUnauthorized: null };

/** axis-app.js hands over how to sign a request and how to talk to AXIS. Optional — sensible defaults. */
export function initTasks(opts = {}) { ctx = { ...ctx, ...opts }; }
export const tasksData = () => S.data;
/** True while Ahmad is typing in the view — the shell must not repaint underneath him. */
export const tasksBusy = () => !!S.editing || !!(typeof document !== 'undefined' && document.activeElement && document.activeElement.id === 'tkSearch');

function headers(extra = {}) {
  if (ctx.authHeaders) return ctx.authHeaders(extra);
  let t = ''; try { t = localStorage.getItem(TOKEN_KEY) || ''; } catch { t = ''; }
  return t ? { Authorization: 'Bearer ' + t, ...extra } : null;
}

function recount() {
  if (!S.data) return;
  const items = S.data.items || [];
  const c = { ...(S.data.counts || {}), total: items.length };
  for (const [id, , fn] of FILTERS) c[id] = items.filter(fn).length;
  c.needsMe = c['needs-me']; c.followUps = c['follow-ups'];
  S.data.counts = c;
  S.data.filters = FILTERS.map(([id, label]) => ({ id, label, count: c[id] }));
}

/** GET the list. Never throws; a failure is kept as the reason and shown, never as "nothing open". */
export async function fetchTasks() {
  const h = headers();
  if (!h) return null;
  try {
    const r = await fetch(ENDPOINT, { headers: h, cache: 'no-store' });
    if (r.status === 401) { if (ctx.onUnauthorized) ctx.onUnauthorized(); return null; }
    const j = await r.json().catch(() => null);
    if (j && j.ok) { S.data = j; S.err = null; S.at = Date.now(); recount(); }
    else S.err = (j && j.error) || ('HTTP ' + r.status);
  } catch (e) { S.err = (e && e.message) || 'network'; }
  changed();
  return S.data;
}

let pollTimer = null;
export function startTasks() { clearInterval(pollTimer); pollTimer = setInterval(() => { if (!document.hidden) fetchTasks(); }, REFRESH_MS); return fetchTasks(); }
export function stopTasks() { clearInterval(pollTimer); pollTimer = null; S.data = null; S.err = null; }
// A chat or voice turn that changed the list (axis-app.js dispatches it with the receipts) refreshes at once.
// Guarded on the method, not just the global: the one-process test registry has suites that leave a bare `window`.
if (typeof window !== 'undefined' && window && typeof window.addEventListener === 'function') window.addEventListener('axis:tasks-changed', () => { fetchTasks(); });

const consequential = (it) => !!(it.sendsOnApprove || (it.effect && (it.effect.sends || it.effect.spends || it.effect.runsCommand)));
const shortTitle = (it) => String(it.title || '').replace(/^Approve:\s*/, '');

/** One mutation from the console: optimistic → POST → server truth + receipt (or revert + reason). */
export async function actOnTask(id, action, fields = {}) {
  const h = headers({ 'Content-Type': 'application/json' });
  if (!h) { toast('Sign in first — nothing was changed'); return { ok: false }; }
  const items = S.data ? S.data.items : [];
  const idx = items.findIndex((i) => i.id === id);
  const before = idx >= 0 ? { ...items[idx] } : null;
  if (idx >= 0 && OPTIMISTIC[action]) { items[idx] = { ...items[idx], status: OPTIMISTIC[action], _pending: true }; recount(); changed(); }
  try {
    const r = await fetch(ENDPOINT, { method: 'POST', headers: h, body: JSON.stringify({ ...fields, action, id, via: 'console' }) });
    if (r.status === 401) { if (ctx.onUnauthorized) ctx.onUnauthorized(); throw new Error('signed out'); }
    const j = await r.json().catch(() => null);
    if (!j || !j.ok) throw new Error((j && j.error) || ('HTTP ' + r.status));
    if (S.data) {
      const k = S.data.items.findIndex((i) => i.id === id);
      if (k >= 0 && j.item) S.data.items[k] = j.item;
      if (j.created) S.data.items.unshift(j.created);
      recount();
    }
    toast(j.receipt || 'Done');
    changed();
    fetchTasks(); // ranking + counts from the server
    try { window.dispatchEvent(new CustomEvent('axis:tasks-acted', { detail: { id, action, receipt: j.receipt || '' } })); } catch {}
    return j;
  } catch (e) {
    if (S.data && before) { const k = S.data.items.findIndex((i) => i.id === id); if (k >= 0) S.data.items[k] = before; recount(); }
    changed();
    toast('Not changed — ' + ((e && e.message) || 'failed'));
    return { ok: false, error: e && e.message };
  }
}

// ── Rendering ────────────────────────────────────────────────────────────────────────────────────────
const TONE = { over: 'var(--crit)', today: 'var(--gold)', soon: 'var(--txt-2)', none: 'var(--txt-3)' };
function dueBadge(it) {
  const l = it.dueLabel || '';
  if (!l) return null;
  const tone = /OVERDUE/.test(l) ? TONE.over : /today|tomorrow/.test(l) ? TONE.today : TONE.soon;
  return el('span', { class: 'mono tk-badge', style: `color:${tone}` }, /OVERDUE/.test(l) ? l : l.replace(/^due /, ''));
}
function statusBadge(it) {
  if (it.status === 'open') return null;
  const txt = it.status === 'snoozed' && it.snoozedUntil ? `snoozed · ${new Date(it.snoozedUntil).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}` : it.status;
  return el('span', { class: 'mono tk-badge tk-status' }, txt);
}
const ownerLabel = (o) => (!o || o === 'ahmad' ? 'you' : o === 'axis' ? 'AXIS' : String(o).replace(/^agent:/, ''));
function auditLine(e) {
  if (!e) return '';
  const who = e.actor === 'axis' ? 'AXIS' : 'you';
  return `last: ${String(e.action || '').replace('.staged', ' (staged for your click)')} by ${who} via ${e.via || 'console'}${ago(e.at) ? ' · ' + ago(e.at) + ' ago' : ''}`;
}

function snoozeSelect(it) {
  const s = el('select', { class: 'chip tk-select', 'aria-label': 'Snooze ' + shortTitle(it), onchange: (e) => {
    let v = e.target.value; e.target.value = '';
    if (!v) return;
    if (v === 'pick') { v = (window.prompt('Snooze until? (YYYY-MM-DD, "friday", "next week")', 'friday') || '').trim(); if (!v) return; }
    actOnTask(it.id, 'snooze', { until: v });
  } }, [el('option', { value: '' }, 'Snooze'), el('option', { value: 'tomorrow' }, 'Tomorrow 9:00'), el('option', { value: 'friday' }, 'Friday'), el('option', { value: 'next week' }, 'Next week'), el('option', { value: 'pick' }, 'Pick a date…')]);
  return s;
}
function assignSelect(it) {
  return el('select', { class: 'chip tk-select', 'aria-label': 'Assign ' + shortTitle(it), onchange: (e) => { const v = e.target.value; e.target.value = ''; if (v) actOnTask(it.id, 'assign', { agent: v }); } },
    [el('option', { value: '' }, 'Assign to…'), ...AGENTS.map((a) => el('option', { value: a }, a))]);
}
function btn(label, onclick, extra = {}) { return el('button', { class: 'chip', type: 'button', onclick, ...extra }, label); }

function controls(it, compact) {
  const a = new Set(it.actions || []);
  const out = [];
  if (a.has('approve')) out.push(btn(consequential(it) ? 'Approve — your click' : 'Approve', () => {
    if (consequential(it)) {
      const what = it.effect && it.effect.runsCommand ? 'runs the command on your PC' : it.effect && it.effect.spends ? `commits $${it.effect.costUsd}` : 'sends it';
      if (!window.confirm(`Approve "${shortTitle(it)}"? Approving ${what}.`)) return;
    }
    actOnTask(it.id, 'approve');
  }, { 'data-act': 'approve' }));
  if (a.has('reject')) out.push(btn('Reject', () => { const reason = compact ? '' : (window.prompt('Reason (optional)', '') || ''); actOnTask(it.id, 'reject', reason ? { reason } : {}); }, { 'data-act': 'reject' }));
  if (a.has('complete')) out.push(btn('Done', () => actOnTask(it.id, 'complete'), { 'data-act': 'complete' }));
  if (a.has('snooze')) out.push(snoozeSelect(it));
  if (a.has('reopen')) out.push(btn('Reopen', () => actOnTask(it.id, 'reopen'), { 'data-act': 'reopen' }));
  if (!compact) {
    if (a.has('follow_up')) out.push(btn('Follow up', () => {
      const when = (window.prompt('Follow up when? (YYYY-MM-DD, "friday", "next week")', 'next week') || '').trim(); if (!when) return;
      const note = (window.prompt('Note (optional)', '') || '').trim();
      actOnTask(it.id, 'follow_up', { when, ...(note ? { note } : {}) });
    }, { 'data-act': 'follow_up' }));
    if (a.has('acknowledge')) out.push(btn('Acknowledge', () => actOnTask(it.id, 'acknowledge'), { 'data-act': 'acknowledge' }));
    if (a.has('cancel')) out.push(btn('Cancel', () => actOnTask(it.id, 'cancel'), { 'data-act': 'cancel' }));
    if (a.has('update')) out.push(btn('Edit', () => { S.editing = it.id; changed(true); }, { 'data-act': 'update' }));
    if (a.has('assign')) out.push(assignSelect(it));
    if (a.has('archive')) out.push(btn('Archive', () => actOnTask(it.id, 'archive'), { 'data-act': 'archive' }));
  }
  if (it.draft) out.push(btn(S.open.has(it.id) ? 'Hide draft' : 'Open draft', () => toggleDraft(it), { 'data-act': 'open-draft' }));
  else if (a.has('draft_reply') && ctx.sendToAxis) out.push(btn('Draft reply', () => ctx.sendToAxis(`Draft a reply for ${shortTitle(it)} [${it.id}]`), { 'data-act': 'draft_reply' }));
  if (it.status === 'open' && ctx.sendToAxis) out.push(btn('Work it', () => ctx.sendToAxis(`Let's work on: ${shortTitle(it)} [${it.id}]`), { title: 'Hand this row to AXIS', 'data-act': 'work' }));
  if (it.link && it.link.type === 'screen' && ctx.go && !compact) out.push(btn('Open', () => ctx.go(it.link.target), { 'data-act': 'open' }));
  return out;
}

async function toggleDraft(it) {
  if (S.open.has(it.id)) { S.open.delete(it.id); changed(); return; }
  S.open.add(it.id);
  if (!S.drafts.has(it.draft.docId)) {
    S.drafts.set(it.draft.docId, null);
    changed();
    try {
      const r = await fetch('/api/axis/exec', { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }) || {}, body: JSON.stringify({ action: 'workspace.get', id: it.draft.docId }) });
      const j = await r.json().catch(() => null);
      S.drafts.set(it.draft.docId, j && j.doc ? String(j.doc.content || '') : '(the draft could not be read — open the Work tab)');
    } catch { S.drafts.set(it.draft.docId, '(the draft could not be read — open the Work tab)'); }
  }
  changed();
}

function editor(it) {
  const title = el('input', { class: 'tk-input', value: it.title, 'aria-label': 'Title' });
  const due = el('input', { class: 'tk-input tk-date', type: 'date', value: it.due ? String(it.due).slice(0, 10) : '', 'aria-label': 'Due date' });
  const save = () => {
    const f = {};
    if (!S.editing) return;
    if (title.value.trim() && title.value.trim() !== it.title) f.title = title.value.trim();
    const d = due.value || '';
    if (d !== (it.due ? String(it.due).slice(0, 10) : '')) f.due = d || '';
    S.editing = null;
    if (Object.keys(f).length) actOnTask(it.id, 'update', f); else changed(true);
  };
  return el('div', { class: 'tk-editor' }, [title, due, btn('Save', save, { 'data-act': 'save' }), btn('Cancel', () => { S.editing = null; changed(true); })]);
}

function taskRow(it, { compact = false } = {}) {
  const editing = !compact && S.editing === it.id;
  const draftText = it.draft && S.open.has(it.id) ? S.drafts.get(it.draft.docId) : undefined;
  const main = el('div', { class: 'tk-main' }, [
    editing ? editor(it) : el('div', { class: 'tk-title' }, [it.title, dueBadge(it), statusBadge(it),
      it.draft ? el('span', { class: 'mono tk-badge tk-draft' }, 'draft ready') : null,
      it.staged ? el('span', { class: 'mono tk-badge tk-staged' }, 'your click') : null]),
    it.detail && !compact ? el('div', { class: 'tk-why' }, it.detail) : null,
    el('div', { class: 'tk-next' }, `Next: ${it.next || '—'} · ${ownerLabel(it.owner)}`),
    !compact && it.audit && it.audit[0] ? el('div', { class: 'mono tk-audit' }, auditLine(it.audit[0])) : null,
    draftText !== undefined ? el('div', { class: 'tk-draft-body' }, [
      el('div', { class: 'tk-draft-text' }, draftText === null ? 'Reading the draft…' : draftText),
      draftText ? el('div', { class: 'tk-acts tk-draft-acts' }, [
        btn('Copy', () => { try { navigator.clipboard.writeText(draftText); toast('Draft copied'); } catch { toast('Copy failed — select the text'); } }),
        it.source === 'inbox' && ctx.openReply ? btn('Review & send', () => ctx.openReply(it, draftText), { title: 'Opens the composer — the send is your click' }) : null,
      ]) : null,
    ]) : null,
  ]);
  // Full rows carry their controls under the text (one aligned line); the Overview panel keeps them beside it.
  const acts = el('div', { class: 'tk-acts' }, controls(it, compact));
  if (!compact) main.append(acts);
  return el('div', { class: 'row tk-row' + (compact ? ' tk-compact' : ' tk-full') + (it._pending ? ' tk-pending' : '') + (it.status !== 'open' ? ' tk-closed' : ''), 'data-task-id': it.id, 'data-status': it.status }, [
    el('span', { class: 'stage-tag' }, it.label || it.source), main, compact ? acts : null,
  ]);
}

function sourcesLine(d) {
  const s = (d && d.sources) || {};
  const dot = (ok) => el('span', { class: 'dot ' + (ok ? 'dot-ok' : 'dot-warn'), style: ok ? '' : 'background:var(--crit)' });
  const item = (ok, label) => el('span', { class: 'tk-src' }, [dot(ok), label]);
  return el('div', { class: 'tk-sources' }, [
    item(s.exec === 'ok', s.exec === 'ok' ? 'assistant store' : `assistant store — ${s.exec === 'partial' ? 'partial (' + (s.execMissing || []).join(', ') + ' did not answer)' : 'did not answer'}`),
    item(s.board === 'live', s.board === 'live' ? 'board' : `board ${s.board || 'missing'}`),
    item(s.overlay === 'ok', s.overlay === 'ok' ? 'overlay' : 'overlay — did not answer'),
    item(s.queue === 'ok', s.queue === 'ok' ? `Claude worker ${s.worker_online ? 'online' : 'offline'}` : 'worker queue — did not answer'),
    S.at ? el('span', { class: 'mono tk-src' }, 'updated ' + (ago(S.at) || '0m') + ' ago') : null,
  ]);
}
function honestEmpty(d) {
  const s = (d && d.sources) || {};
  const gaps = [s.exec !== 'ok' ? 'the assistant store' : '', s.board !== 'live' ? 'the board' : ''].filter(Boolean);
  return gaps.length ? `Nothing open in what answered — ${gaps.join(' and ')} did not answer, so this is not an all-clear.` : 'Nothing open. Every list is clear.';
}

/** The Overview panel: the top of the live list with the quick controls, and the way into the full view. */
export function tasksPanel(opts = {}) {
  if (opts.go) ctx.go = ctx.go || opts.go;
  const wrap = el('div', { id: 'axisTasksPanel', class: 'tk-panel' });
  const d = S.data;
  const c = d ? d.counts || {} : null;
  wrap.append(head('Live task view', d ? `${c.open || 0} open · ${c.needsMe || 0} need you · ${c.axis || 0} AXIS handling` : S.err ? 'did not answer' : 'loading', 'margin-top:22px'));
  const card = el('div', { class: 'card', style: 'padding:0' });
  if (!d) card.append(el('div', { class: 'empty' }, S.err ? `The live task list did not answer (${S.err}). Nothing here is an all-clear — the cards below still work.` : 'Reading every list…'));
  else {
    const open = (d.items || []).filter((i) => i.status === 'open');
    const rows = [...open.filter((i) => i.needsMe), ...open.filter((i) => !i.needsMe)].slice(0, 6);
    if (!rows.length) card.append(el('div', { class: 'empty' }, honestEmpty(d)));
    rows.forEach((it) => card.append(taskRow(it, { compact: true })));
    card.append(el('div', { class: 'row tk-foot' }, [btn(`Open the live task view · ${c.total || 0} items →`, () => (ctx.go ? ctx.go('tasks') : null), { 'data-act': 'open-view' }), sourcesLine(d)]));
  }
  wrap.append(card);
  return wrap;
}

function renderKpis(box) {
  box.innerHTML = '';
  const c = (S.data && S.data.counts) || {};
  for (const [label, v, col] of [['Open', c.open, 'var(--txt)'], ['Need you', c.needsMe, 'var(--gold)'], ['AXIS handling', c.axis, 'var(--txt)'], ['Snoozed', c.snoozed, 'var(--txt-2)'], ['Done / archived', c.done, 'var(--txt-3)']])
    box.append(el('div', { class: 'kpi' }, [el('div', { class: 'label' }, label), el('div', { class: 'value', style: 'color:' + col }, S.data ? String(v || 0) : '—')]));
}
function renderFilters(box) {
  box.innerHTML = '';
  const c = (S.data && S.data.counts) || {};
  for (const [id, label] of FILTERS) box.append(el('button', { class: 'chip', type: 'button', 'aria-selected': S.filter === id ? 'true' : 'false', 'data-filter': id, onclick: () => { S.filter = id; S.filterChosen = true; changed(true); } }, [label, el('span', { class: 'count' }, String(c[id] || 0))]));
}
function renderList(box) {
  box.innerHTML = '';
  if (!S.data) { box.append(el('div', { class: 'empty' }, S.err ? `The live task list did not answer (${S.err}). Nothing is shown as clear.` : 'Reading every list…')); return; }
  const fn = (FILTERS.find((f) => f[0] === S.filter) || FILTERS[6])[2];
  const q = S.q.trim().toLowerCase();
  const rows = (S.data.items || []).filter(fn).filter((i) => !q || `${i.title} ${i.detail || ''} ${i.label || ''}`.toLowerCase().includes(q));
  if (!rows.length) box.append(el('div', { class: 'empty' }, S.filter === 'open' ? honestEmpty(S.data) : S.filter === 'needs-me' ? (honestEmpty(S.data).startsWith('Nothing open in') ? honestEmpty(S.data) : 'Nothing needs you right now.') : 'Nothing under this filter.'));
  rows.forEach((it) => box.append(taskRow(it)));
}

/** The full screen (SCREENS.tasks in axis-app.js), reached from Priorities and the Overview panel. */
export function renderTasksScreen(c, opts = {}) {
  if (opts.go) ctx.go = ctx.go || opts.go;
  pickDefaultFilter();
  const screen = el('div', { id: 'axisTasksScreen' });
  screen.append(head('Live task view', 'every list in one place — AXIS works it with you; nothing here sends'));
  const kpis = el('div', { class: 'kpi-grid', id: 'tkKpis' });
  const filters = el('div', { class: 'thread-bar tk-filters', id: 'tkFilters' });
  const search = el('input', { id: 'tkSearch', class: 'tk-input tk-search', type: 'search', placeholder: 'Search the list…', value: S.q, 'aria-label': 'Search the list', oninput: (e) => { S.q = e.target.value; renderList(list); } });
  const bar = el('div', { class: 'tk-bar' }, [search,
    ctx.sendToAxis ? btn('Ask AXIS about the list', () => ctx.sendToAxis("Let's work on the top items on my list"), { 'data-act': 'ask' }) : null,
    btn('Refresh', () => fetchTasks(), { 'data-act': 'refresh' })]);
  const list = el('div', { class: 'card', id: 'tkList', style: 'padding:0;margin-top:12px' });
  const src = el('div', { id: 'tkSources', style: 'margin-top:10px' });
  screen.append(kpis, el('div', { style: 'margin-top:14px' }, [filters, bar]), list, src);
  renderKpis(kpis); renderFilters(filters); renderList(list);
  if (S.data) src.append(el('div', { class: 'card', style: 'padding:10px 14px' }, sourcesLine(S.data)));
  c.append(screen);
  if (!S.data && !S.err) fetchTasks();
}

function pickDefaultFilter() {
  if (S.filterChosen && S.filter) return;
  S.filter = S.data && S.data.counts && S.data.counts.needsMe ? 'needs-me' : 'open';
}
/** Re-render what is mounted, in place — never underneath an open editor or the search box being typed in. */
function changed(force = false) {
  pickDefaultFilter();
  if (typeof document !== 'undefined') {
    const panel = document.getElementById('axisTasksPanel');
    if (panel) panel.replaceWith(tasksPanel());
    const screen = document.getElementById('axisTasksScreen');
    if (screen) {
      const kpis = document.getElementById('tkKpis'); if (kpis) renderKpis(kpis);
      const filters = document.getElementById('tkFilters'); if (filters) renderFilters(filters);
      const list = document.getElementById('tkList');
      if (list && (force || !(S.editing && list.contains(document.activeElement)))) renderList(list);
      const src = document.getElementById('tkSources');
      if (src && S.data) { src.innerHTML = ''; src.append(el('div', { class: 'card', style: 'padding:10px 14px' }, sourcesLine(S.data))); }
    }
  }
  try { if (ctx.onChange) ctx.onChange(S.data); } catch { /* the shell's hook must never break the view */ }
}

// ── "Is this a task ask?" — the browser twin of lib/axis-tasks.cjs taskIntent() ────────────────────────
// A list ask or a verb-on-an-item ask goes to the director's task tool loop (it can see AND act), before the
// board's local answerers. tests/axis-director-tools.test.mjs keeps the two detectors in step.
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
/** 'list' | 'action' | null */
export function isTaskAsk(text) {
  const t = String(text || '').trim();
  if (t.length < 4) return null;
  if (TASK_LIST_ASK.test(t)) return 'list';
  if (TASK_ACTION_ASK.test(t)) return 'action';
  return null;
}
