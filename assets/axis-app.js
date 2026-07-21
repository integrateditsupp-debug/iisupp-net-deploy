// axis-app.js — AXIS Command Center v2 shell. Vanilla ESM, no framework/bundler.
// Auth gate → poll /api/axis/snapshot → render modules. The page holds NO prospect data; everything comes
// from the authed endpoint. Writes go through /api/axis/intent (optimistic UI; the worker executes behind
// rails — the client NEVER sends/approves/pays). Laws enforced here: Badge Law (2) + side-effects (4).
import { SNAPSHOT_MODULES } from './axis-constants.js';

const TOKEN_KEY = 'aperture_jwt';
const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v; else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v != null && v !== false) n.setAttribute(k, v);
  }
  (Array.isArray(kids) ? kids : [kids]).forEach(c => c != null && c !== false && n.append(c.nodeType ? c : document.createTextNode(String(c))));
  return n;
};
const fmtMoney = (n) => n == null ? '—' : '$' + Number(n).toLocaleString();
const ago = (ts) => { if (!ts) return ''; const s = (Date.now() - ts) / 1000; if (s < 3600) return Math.floor(s / 60) + 'm'; if (s < 86400) return Math.floor(s / 3600) + 'h'; return Math.floor(s / 86400) + 'd'; };

const ACTIONABLE = ['reply_to_outreach', 'new_inbound_request'];
const state = { token: localStorage.getItem(TOKEN_KEY) || '', snap: {}, version: null, module: 'overview',
  ui: { inboxFilter: 'all', thread: null, apTab: 'pending', apOpen: null, apSel: new Set(), apCursor: 0, crmTab: 'contact', crmFilter: '', crmDrawer: null } };
const authHeaders = (extra = {}) => ({ Authorization: 'Bearer ' + state.token, ...extra });
const data = (mod) => (state.snap[mod] && state.snap[mod].data) || {};

// ── Toast + intent ──
let toastTimer;
function toast(msg) {
  let t = $('toast'); if (t) t.remove();
  t = el('div', { class: 'toast', id: 'toast' }, msg); document.body.append(t);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 2800);
}
async function postIntent(type, payload = {}) {
  try {
    const r = await fetch('/api/axis/intent', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ type, payload }) });
    if (r.status === 401) return logout();
    const j = await r.json();
    return j && j.ok;
  } catch { return false; }
}

// ── Nav ──
const NAV = [
  { group: 'Sales', items: [
    { id: 'overview', label: 'Overview', glyph: 'OV' }, { id: 'inbox', label: 'Action Inbox', glyph: 'IN' },
    { id: 'pipeline', label: 'Pipeline', glyph: 'PL' }, { id: 'crm', label: 'CRM', glyph: 'CR' },
    { id: 'prospects', label: 'Prospects', glyph: 'PR' }, { id: 'outreach', label: 'Outreach Studio', glyph: 'OS' },
    { id: 'approvals', label: 'Approvals', glyph: 'AP' }, { id: 'followups', label: 'Follow-ups', glyph: 'FU' },
  ] },
  { group: 'Workspace', items: [
    { id: 'documents', label: 'Documents', glyph: 'DO' }, { id: 'analytics', label: 'Analytics', glyph: 'AN' },
    { id: 'products', label: 'Product Discovery', glyph: 'PD' },
  ] },
  { group: 'System', items: [
    { id: 'fleet', label: 'Fleet', glyph: 'FL' }, { id: 'reports', label: 'Reports', glyph: 'RE' }, { id: 'settings', label: 'Settings', glyph: 'SE' },
  ] },
];
const navItem = (id) => NAV.flatMap(g => g.items).find(i => i.id === id);

// Badge Law (2): red inbox badge ONLY when open actionable > 0; approvals neutral when pending > 0. No others.
function inboxBadgeCount() { const rows = (data('inbox').rows) || []; return rows.filter(m => ACTIONABLE.includes(m.classification) && !m.actioned && !m.snoozed_until).length; }
function approvalsPending() { const rows = (data('approvals').rows) || []; return rows.filter(r => r.status === 'pending').length; }

function renderNav() {
  const nav = $('nav'); nav.innerHTML = '';
  const ib = inboxBadgeCount(), ap = approvalsPending();
  for (const grp of NAV) {
    nav.append(el('div', { class: 'nav-group' }, grp.group));
    for (const it of grp.items) {
      const kids = [el('span', { class: 'nav-glyph' }, it.glyph), el('span', { class: 'nav-label' }, it.label)];
      if (it.id === 'inbox' && ib > 0) kids.push(el('span', { class: 'badge badge-red' }, ib));
      if (it.id === 'approvals' && ap > 0) kids.push(el('span', { class: 'badge badge-neutral' }, ap));
      nav.append(el('button', { class: 'nav-item', 'aria-current': state.module === it.id ? 'true' : 'false',
        onclick: () => go(it.id) }, kids));
    }
  }
}
function go(mod) { state.module = mod; state.ui.thread = null; state.ui.crmDrawer = null; renderNav(); renderModule(); }

// ── Screens ──
const SCREENS = {};

SCREENS.overview = (c) => {
  const d = data('overview'); const k = d.kpis || {};
  c.append(head('Overview', 'command deck'));
  const kpis = [['Pipeline value', fmtMoney(k.pipeline_value)], ['Awaiting approval', k.awaiting_approval ?? 0],
    ['Client messages waiting', k.messages_waiting ?? 0], ['Follow-ups due', k.followups_due ?? 0],
    ['Meetings this week', k.meetings_week ?? 0], ['MRR', fmtMoney(k.mrr)]];
  c.append(el('div', { class: 'kpi-grid' }, kpis.map(([l, v]) => el('div', { class: 'kpi' }, [el('div', { class: 'label' }, l), el('div', { class: 'value' }, v)]))));
  c.append(head('Needs You Now', 'top by revenue impact', 'margin-top:22px'));
  const needs = d.needs_you_now || [];
  const card = el('div', { class: 'card', style: 'padding:0' });
  if (!needs.length) card.append(el('div', { class: 'empty' }, 'Nothing waiting. AXIS is watching.'));
  else needs.forEach(n => card.append(el('div', { class: 'row' }, [
    el('span', { class: 'stage-tag' }, n.kind || 'item'), el('div', { style: 'flex:1' }, n.subject || '(no subject)'),
    el('button', { class: 'chip', onclick: () => go('approvals') }, 'Review')])));
  c.append(card);
  // Fleet strip
  const fleet = (data('fleet').agents) || [];
  if (fleet.length) {
    c.append(head('Fleet', 'agents reporting', 'margin-top:22px'));
    c.append(el('div', { class: 'card', style: 'display:flex;gap:16px;flex-wrap:wrap' }, fleet.slice(0, 8).map(a =>
      el('div', { style: 'display:flex;align-items:center;gap:7px' }, [el('span', { class: 'dot ' + (a.status === 'ok' ? 'dot-ok' : 'dot-warn') }), el('span', { class: 'mono', style: 'font-size:11px' }, a.agent)]))));
  }
};

// ── S2 Action Inbox ──
SCREENS.inbox = (c) => {
  if (state.ui.thread) return renderThread(c, state.ui.thread);
  const d = data('inbox'); const rows = d.rows || []; const co = d.counts || {};
  c.append(head('Action Inbox', 'client replies + new requests only'));
  const filters = [['all', 'All', rows.length], ['replies', 'Replies', co.replies], ['new_requests', 'New Requests', co.new_requests], ['snoozed', 'Snoozed', co.snoozed], ['handled', 'Handled', co.handled]];
  c.append(el('div', { class: 'thread-bar' }, filters.map(([id, lbl, n]) => el('button', { class: 'chip', 'aria-selected': state.ui.inboxFilter === id, onclick: () => { state.ui.inboxFilter = id; renderModule(); } }, [lbl, el('span', { class: 'count' }, n || 0)]))));
  const shown = rows.filter(m => {
    const actionable = ACTIONABLE.includes(m.classification);
    if (state.ui.inboxFilter === 'all') return actionable && !m.actioned;
    if (state.ui.inboxFilter === 'replies') return m.classification === 'reply_to_outreach';
    if (state.ui.inboxFilter === 'new_requests') return m.classification === 'new_inbound_request';
    if (state.ui.inboxFilter === 'snoozed') return m.snoozed_until;
    if (state.ui.inboxFilter === 'handled') return m.actioned;
    return actionable;
  });
  const list = el('div', { class: 'card', style: 'padding:0' });
  if (!shown.length) list.append(el('div', { class: 'empty' }, 'Inbox clear. AXIS is watching — you’ll see a number the moment a client writes.'));
  else shown.forEach(m => list.append(el('div', { class: 'row', style: 'cursor:pointer', onclick: () => { openThread(m); } }, [
    el('span', { class: 'dot ' + (m.unread ? 'dot-ok' : ''), style: m.unread ? '' : 'background:var(--line-2)' }),
    el('span', { class: 'stage-tag' }, m.classification === 'reply_to_outreach' ? 'Reply' : 'New Request'),
    el('div', { style: 'flex:1;min-width:0' }, [el('div', { style: 'font-weight:600' }, m.subject || '(no subject)'), el('div', { style: 'color:var(--txt-3);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, m.snippet || '')]),
    el('span', { class: 'mono', style: 'font-size:10px;color:var(--txt-3)' }, ago(m.received_at))])));
  c.append(list);
  // Filtered drawer (audit)
  const filtered = rows.filter(m => !ACTIONABLE.includes(m.classification));
  const dr = el('details', { class: 'filtered-drawer' });
  dr.append(el('summary', {}, `▸ Filtered (${filtered.length}) — never counted`));
  filtered.forEach(m => dr.append(el('div', { class: 'row' }, [el('span', { class: 'stage-tag' }, m.classification), el('div', { style: 'flex:1' }, m.subject)])));
  c.append(dr);
};
function openThread(m) { m.unread = false; state.ui.thread = m; renderNav(); renderModule(); }
function renderThread(c, m) {
  c.append(el('div', { class: 'thread-bar' }, [el('button', { class: 'chip', onclick: () => { state.ui.thread = null; renderModule(); } }, '← Inbox'),
    el('div', { style: 'flex:1' }), el('span', { class: 'stage-tag' }, m.classification === 'reply_to_outreach' ? 'Reply' : 'New Request')]));
  const actions = [['draft_reply', 'Draft AI Reply'], ['open_gmail', 'Open in Gmail'], ['schedule_followup', 'Schedule Follow-up'], ['book_meeting', 'Book Meeting'], ['advance_stage', 'Advance Stage'], ['mark_handled', 'Mark Handled'], ['snooze', 'Snooze'], ['suppress', 'Suppress']];
  const bar = el('div', { class: 'thread-bar' }, actions.map(([t, lbl]) => el('button', { class: 'chip', onclick: () => inboxAction(t, m) }, lbl)));
  const left = el('div', {}, [
    el('div', { class: 'thread-msg' }, [el('div', { class: 'eyebrow' }, m.classification === 'reply_to_outreach' ? 'client reply' : 'new inbound'), el('div', { style: 'font-weight:600;margin:6px 0' }, m.subject), el('div', { style: 'color:var(--txt-2)' }, m.snippet)]),
    m.actioned ? el('div', { class: 'sysnote' }, 'Handled — this contact’s pending follow-ups auto-cancelled; pipeline card moved to Replied.') : null,
    bar,
  ]);
  const b = businessName(m.business_id);
  const rail = el('aside', { class: 'rail' }, [el('div', { class: 'eyebrow' }, 'company'), el('div', { style: 'font-weight:600;margin:4px 0 10px' }, b || 'Unlinked'),
    el('div', { class: 'footnote' }, ['handle', ' — ', el('span', { class: 'src' }, b ? 'Lead record ✓' : 'Not found — never guessed')])]);
  c.append(el('div', { class: 'thread-wrap' }, [left, rail]));
}
function businessName(id) { const p = (data('prospects').rows) || []; const f = p.find(x => x.id === id); return f ? f.handle : null; }
async function inboxAction(type, m) {
  const irreversibleUI = ['mark_handled', 'snooze', 'suppress'];
  if (irreversibleUI.includes(type)) { // optimistic side-effect (Law 4): decrement badge same tick
    if (type === 'snooze') m.snoozed_until = Date.now() + 864e5; else m.actioned = true;
    renderNav(); renderModule();
  }
  toast(labelFor(type) + ' → queued');
  postIntent(type, { message_id: m.id, thread_id: m.thread_id });
}
const labelFor = (t) => ({ draft_reply: 'Draft reply (→ Approvals)', open_gmail: 'Opening Gmail', schedule_followup: 'Follow-up scheduled', book_meeting: 'Meeting request', advance_stage: 'Stage advanced', mark_handled: 'Marked handled', snooze: 'Snoozed', suppress: 'Sender suppressed' }[t] || t);

// ── S3 Approval Center ──
SCREENS.approvals = (c) => {
  const d = data('approvals'); const rows = d.rows || [];
  c.append(head('Approval Center', 'nothing sends without you'));
  const tabs = [['pending', 'Pending'], ['outbound', 'Outbound'], ['rejected', 'Rejected'], ['skipped', 'Skipped']];
  const tabRows = (t) => rows.filter(r => t === 'outbound' ? (r.status === 'approved' || r.status === 'outbound') : r.status === t);
  c.append(el('div', { class: 'thread-bar' }, tabs.map(([id, lbl]) => el('button', { class: 'chip', 'aria-selected': state.ui.apTab === id, onclick: () => { state.ui.apTab = id; state.ui.apCursor = 0; renderModule(); } }, [lbl, el('span', { class: 'count' }, tabRows(id).length)]))));
  const list = tabRows(state.ui.apTab);
  if (state.ui.apTab === 'pending' && list.length) {
    c.append(el('div', { class: 'bulkbar' }, [
      el('span', { class: 'eyebrow' }, state.ui.apSel.size ? state.ui.apSel.size + ' selected' : 'J/K move · A approve · X reject · S skip'),
      el('div', { style: 'flex:1' }),
      el('button', { class: 'chip', onclick: () => { list.forEach(r => bulkApprove(r)); } }, 'Approve all'),
      el('button', { class: 'chip', onclick: () => { state.ui.apSel.clear(); renderModule(); } }, 'Clear')]));
  }
  if (!list.length) { c.append(el('div', { class: 'empty' }, 'Nothing here.')); return; }
  list.forEach((r, i) => {
    const open = state.ui.apOpen === r.id;
    const card = el('div', { class: 'appr', 'aria-selected': (state.ui.apTab === 'pending' && i === state.ui.apCursor) });
    const cb = el('span', { class: 'checkbox', 'aria-checked': state.ui.apSel.has(r.id), onclick: (e) => { e.stopPropagation(); state.ui.apSel.has(r.id) ? state.ui.apSel.delete(r.id) : state.ui.apSel.add(r.id); renderModule(); } }, state.ui.apSel.has(r.id) ? '✓' : '');
    card.append(el('div', { class: 'appr-head', onclick: () => { state.ui.apOpen = open ? null : r.id; renderModule(); } }, [
      state.ui.apTab === 'pending' ? cb : el('span', { class: 'stage-tag' }, (r.channel || 'email').toUpperCase()),
      el('div', { style: 'flex:1' }, [el('div', { style: 'font-weight:600' }, r.subject), el('div', { style: 'font-size:12px;color:var(--txt-3)' }, [businessName(r.business_id) || 'prospect', ' · ', el('span', { style: 'color:var(--gold)' }, 'Pitch')])]),
      el('span', { class: 'mono', style: 'font-size:10px;color:var(--txt-3)' }, ago(r.created_at))]));
    if (open) {
      const facts = (r.facts || []).map(f => el('span', { class: 'footnote', style: 'margin-right:6px' }, [f.c, ' — ', el('span', { class: 'src' }, (f.s || 'source') + ' ✓')]));
      const acts = state.ui.apTab === 'pending' ? [
        el('button', { class: 'chip', onclick: () => act('approve', r) }, 'Approve'), el('button', { class: 'chip', onclick: () => toast('Inline editor — opens in Outreach Studio') }, 'Edit'),
        el('button', { class: 'chip', onclick: () => { const ins = prompt('Rewrite instruction for AXIS:'); if (ins) { toast('Rewrite → AXIS'); postIntent('rewrite', { item_id: r.id, instruction: ins }); } } }, 'Rewrite'),
        el('button', { class: 'chip', onclick: () => act('reject', r) }, 'Reject'), el('button', { class: 'chip', onclick: () => act('skip', r) }, 'Skip'),
        el('button', { class: 'chip', onclick: () => { const nt = prompt('Note:'); if (nt) { toast('Note added'); postIntent('note', { item_id: r.id, note: nt }); } } }, 'Note')] : [];
      card.append(el('div', { class: 'appr-body' }, [
        el('div', { style: 'padding:12px 0;color:var(--txt-2);white-space:pre-line' }, '(draft preview — full body renders from the outreach record)'),
        facts.length ? el('div', { style: 'margin:8px 0' }, facts) : el('div', { class: 'unknown' }, 'No sourced facts — never guessed'),
        acts.length ? el('div', { class: 'appr-actions' }, acts) : null]));
    }
    c.append(card);
  });
};
function setStatus(r, status) { r.status = status; }
function act(kind, r) {
  const map = { approve: 'approved', reject: 'rejected', skip: 'skipped' };
  if (kind === 'reject') { const reason = prompt('Reason (off-target / bad timing / tone / factual error / compliance / duplicate / other):', 'bad timing'); postIntent('reject', { item_id: r.id, reason }); }
  else postIntent(kind, { item_id: r.id });
  setStatus(r, map[kind]); state.ui.apSel.delete(r.id); toast('Approval ' + map[kind]); renderNav(); renderModule();
}
function bulkApprove(r) { postIntent('approve', { item_id: r.id }); setStatus(r, 'approved'); state.ui.apSel.delete(r.id); renderNav(); renderModule(); toast('Bulk approved'); }

// ── S14 CRM ──
SCREENS.crm = (c) => {
  if (state.ui.crmDrawer) renderCrmDrawer();
  const d = data('crm'); const recs = d.records || []; const co = d.counts || {};
  c.append(head('CRM', 'single source of truth'));
  const tabs = [['contact', 'Contacts', co.contacts], ['company', 'Companies', co.companies], ['deal', 'Deals', co.deals], ['activity', 'Activities', co.activities]];
  c.append(el('div', { class: 'thread-bar' }, [
    ...tabs.map(([id, lbl, n]) => el('button', { class: 'chip', 'aria-selected': state.ui.crmTab === id, onclick: () => { state.ui.crmTab = id; renderModule(); } }, [lbl, el('span', { class: 'count' }, n || 0)])),
    el('div', { style: 'flex:1' }),
    el('input', { class: 'search', style: 'max-width:200px;color:var(--txt)', placeholder: 'filter…', value: state.ui.crmFilter, oninput: (e) => { state.ui.crmFilter = e.target.value; renderCrmList(); } }),
    el('button', { class: 'chip', onclick: () => toast('Add record — opens form (→ vault via Mesh, anonymized)') }, '+ Add'),
    el('button', { class: 'chip', onclick: () => { toast('CSV export queued'); postIntent('csv_export', { tab: state.ui.crmTab }); } }, 'Export')]));
  c.append(el('div', { class: 'card', id: 'crmList', style: 'padding:0' }));
  renderCrmList();
};
function renderCrmList() {
  const wrap = $('crmList'); if (!wrap) return; wrap.innerHTML = '';
  const recs = ((data('crm').records) || []).filter(r => r.type === state.ui.crmTab);
  const q = state.ui.crmFilter.toLowerCase();
  const shown = recs.filter(r => !q || JSON.stringify(r.fields).toLowerCase().includes(q));
  if (!shown.length) { wrap.append(el('div', { class: 'empty' }, 'No records.')); return; }
  shown.forEach(r => {
    const f = r.fields || {}; const cells = Object.values(f).slice(0, 4).map(v => el('div', {}, String(v)));
    const noDrawer = state.ui.crmTab === 'activity';
    wrap.append(el('div', { class: 'tbl-row', style: `grid-template-columns:repeat(${cells.length},1fr);cursor:${noDrawer ? 'default' : 'pointer'}`, onclick: () => { if (!noDrawer) { state.ui.crmDrawer = r; renderModule(); } } }, cells));
  });
}
function renderCrmDrawer() {
  const r = state.ui.crmDrawer; if (!r) return;
  const close = () => { state.ui.crmDrawer = null; renderModule(); };
  document.body.append(el('div', { class: 'drawer-bg', onclick: close }));
  const f = r.fields || {};
  document.body.append(el('aside', { class: 'drawer' }, [
    el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:14px' }, [el('span', { class: 'eyebrow' }, r.type), el('button', { class: 'iconbtn', onclick: close }, '✕')]),
    ...Object.entries(f).map(([k, v]) => el('div', { style: 'padding:8px 0;border-bottom:1px solid var(--line)' }, [el('div', { class: 'eyebrow' }, k), el('div', {}, String(v))])),
    el('div', { class: 'appr-actions', style: 'margin-top:14px' }, [
      el('button', { class: 'chip', onclick: () => { toast('Draft email → Approvals'); postIntent('draft_email', { record_id: r.id }); } }, 'Draft email'),
      el('button', { class: 'chip', onclick: () => { const n = prompt('Note (anonymized to vault):'); if (n) { toast('Note → vault (Lead handle)'); postIntent('add_note', { record_id: r.id, note: n }); } } }, 'Add note')])]));
}

function placeholder(label) {
  return (c) => {
    c.append(head(label, 'live data bound · full UI in a later phase'));
    const d = state.snap[state.module] && state.snap[state.module].data;
    c.append(el('div', { class: 'card' }, [el('div', { class: 'eyebrow', style: 'margin-bottom:8px' }, 'snapshot payload (real, from /api/axis/snapshot)'),
      el('pre', { class: 'mono', style: 'font-size:11px;white-space:pre-wrap;color:var(--txt-2);margin:0;max-height:340px;overflow:auto' }, d ? JSON.stringify(d, null, 2) : '(empty)')]));
  };
}
function head(title, eyebrow, style) { return el('div', { class: 'screen-head', style }, [el('div', { class: 'screen-title' }, title), eyebrow ? el('span', { class: 'eyebrow' }, eyebrow) : null]); }
function renderModule() {
  clearOverlays();
  const c = $('content'); c.innerHTML = '';
  const screen = el('div', { class: 'screen' }); c.append(screen);
  (SCREENS[state.module] || placeholder(navItem(state.module)?.label || state.module))(screen);
}
function clearOverlays() { document.querySelectorAll('.drawer, .drawer-bg').forEach(n => n.remove()); }

// ── Snapshot loop ──
function renderTick() { $('tick').textContent = state.source === 'seed' ? 'seed data · worker idle' : (state.version && state.version.tick ? 'last worker tick ' + state.version.tick.slice(11, 16) : 'live'); }
async function fetchSnapshots() {
  const r = await fetch('/api/axis/snapshot?module=all', { headers: authHeaders(), cache: 'no-store' });
  if (r.status === 401) return logout();
  const j = await r.json();
  if (j && j.ok) { state.snap = j.snapshots || {}; state.version = j.version; state.source = j.source; renderTick(); renderNav(); renderModule(); }
}
async function pollVersion() {
  try { const r = await fetch('/api/axis/snapshot', { headers: authHeaders(), cache: 'no-store' }); if (r.status === 401) return logout();
    const j = await r.json(); if (j && j.ok && (!state.version || j.version.v !== state.version.v)) fetchSnapshots(); } catch {}
}

// ── AXIS dock ──
const dockLog = [];
function renderDock() {
  const log = $('axisLog'); log.innerHTML = '';
  if (!dockLog.length) log.append(el('div', { class: 'empty', style: 'padding:20px' }, 'Talk to AXIS. Blunt. Important-only.'));
  dockLog.forEach(m => {
    const node = el('div', { class: 'axis-msg ' + m.role }, m.text);
    if (m.chips) node.append(el('div', { class: 'chips' }, m.chips.map(ch => el('button', { class: 'chip', onclick: ch.onclick }, ch.label))));
    log.append(node);
  });
  log.scrollTop = log.scrollHeight;
}
async function axisSend() {
  const inp = $('axisInput'); const text = inp.value.trim(); if (!text) return; inp.value = '';
  dockLog.push({ role: 'user', text }); renderDock();
  dockLog.push({ role: 'axis', text: '…' }); renderDock();
  try {
    const r = await fetch('/.netlify/functions/axis-director', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ action: 'chat', messages: dockLog.filter(m => m.role === 'user').map(m => ({ role: 'user', content: m.text })) }) });
    const j = await r.json(); dockLog.pop();
    const reply = { role: 'axis', text: (j && j.text) || 'Heard you.' };
    if (j && j.routedAgent && j.intent) reply.chips = [{ label: 'Approve route', onclick: () => { postIntent('approve', { intent: j.intent, agent: j.routedAgent }); toast('Routed to ' + j.routedAgent); } }];
    dockLog.push(reply); renderDock();
  } catch { dockLog.pop(); dockLog.push({ role: 'axis', text: 'Brain unreachable.' }); renderDock(); }
}

// ── Command palette ──
let palSel = 0;
function paletteItems() {
  const nav = NAV.flatMap(g => g.items).map(i => ({ label: 'Go to ' + i.label, run: () => go(i.id) }));
  return nav.concat([
    { label: 'Approve all pending', run: () => { go('approvals'); (data('approvals').rows || []).filter(r => r.status === 'pending').forEach(bulkApprove); } },
    { label: 'Open Action Inbox', run: () => go('inbox') },
    { label: 'Talk to AXIS', run: () => openDock() },
  ]);
}
function openPalette() { $('palette').hidden = false; $('paletteInput').value = ''; palSel = 0; renderPalette(); $('paletteInput').focus(); }
function renderPalette() {
  const q = $('paletteInput').value.toLowerCase(); const items = paletteItems().filter(i => i.label.toLowerCase().includes(q));
  const list = $('paletteList'); list.innerHTML = ''; palSel = Math.min(palSel, items.length - 1);
  items.forEach((it, i) => list.append(el('div', { class: 'palette-item', 'aria-selected': i === palSel, onclick: () => { it.run(); $('palette').hidden = true; } }, it.label)));
  list._items = items;
}

// ── Auth ──
function showApp() { $('login').style.display = 'none'; $('app').style.display = 'grid'; renderNav(); renderModule(); fetchSnapshots();
  clearInterval(window.__axisPoll); window.__axisPoll = setInterval(() => { if (!document.hidden) pollVersion(); }, 15000); }
function logout() { localStorage.removeItem(TOKEN_KEY); state.token = ''; $('app').style.display = 'none'; $('login').style.display = 'grid'; clearInterval(window.__axisPoll); }
async function doLogin() {
  $('loginErr').textContent = '';
  try {
    const r = await fetch('/.netlify/functions/aperture-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: $('email').value.trim(), password: $('pass').value }) });
    const j = await r.json();
    if (j && j.ok && j.token) { state.token = j.token; localStorage.setItem(TOKEN_KEY, j.token); showApp(); } else $('loginErr').textContent = j.error || 'invalid credentials';
  } catch { $('loginErr').textContent = 'login failed — check connection'; }
}

// ── Theme + dock + wiring ──
function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); localStorage.setItem('axis_theme', t); }
function openDock() { $('axisDock').hidden = false; $('axisFab').hidden = true; renderDock(); $('axisInput').focus(); }
function closeDock() { $('axisDock').hidden = true; $('axisFab').hidden = false; }
$('themeBtn').addEventListener('click', () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
applyTheme(localStorage.getItem('axis_theme') || 'dark');
$('loginBtn').addEventListener('click', doLogin);
$('pass').addEventListener('keydown', (e) => e.key === 'Enter' && doLogin());
$('logoutBtn').addEventListener('click', logout);
$('axisFab').addEventListener('click', openDock);
$('axisClose').addEventListener('click', closeDock);
$('axisSend').addEventListener('click', axisSend);
$('axisInput').addEventListener('keydown', (e) => e.key === 'Enter' && axisSend());
$('search').addEventListener('click', openPalette);
$('paletteInput')?.addEventListener('input', renderPalette);

// Keyboard: ⌘K palette, Esc close, and Approvals J/K/A/X/S/E/R/N (ignored in inputs)
document.addEventListener('keydown', (e) => {
  const inField = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName);
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); return openPalette(); }
  if (e.key === 'Escape') { $('palette').hidden = true; if (!$('axisDock').hidden) closeDock(); if (state.ui.thread) { state.ui.thread = null; renderModule(); } if (state.ui.crmDrawer) { state.ui.crmDrawer = null; renderModule(); } return; }
  if (!$('palette').hidden) {
    const items = $('paletteList')._items || [];
    if (e.key === 'ArrowDown') { palSel = Math.min(palSel + 1, items.length - 1); renderPalette(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { palSel = Math.max(palSel - 1, 0); renderPalette(); e.preventDefault(); }
    if (e.key === 'Enter' && items[palSel]) { items[palSel].run(); $('palette').hidden = true; }
    return;
  }
  if (inField) return;
  if (state.module === 'approvals' && state.ui.apTab === 'pending') {
    const rows = (data('approvals').rows || []).filter(r => r.status === 'pending');
    const cur = rows[state.ui.apCursor];
    if (e.key === 'j' || e.key === 'ArrowDown') { state.ui.apCursor = Math.min(state.ui.apCursor + 1, rows.length - 1); renderModule(); }
    else if (e.key === 'k' || e.key === 'ArrowUp') { state.ui.apCursor = Math.max(state.ui.apCursor - 1, 0); renderModule(); }
    else if (e.key === 'a' && cur) act('approve', cur);
    else if (e.key === 'x' && cur) act('reject', cur);
    else if (e.key === 's' && cur) act('skip', cur);
    else if ((e.key === 'e' || e.key === 'r' || e.key === 'n') && cur) toast({ e: 'Edit', r: 'Rewrite', n: 'Note' }[e.key] + ' — open the card');
  }
});

if (state.token) showApp();
