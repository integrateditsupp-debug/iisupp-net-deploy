// axis-app.js — AXIS Command Center v2 shell. Vanilla ESM, no framework/bundler.
// Auth gate → poll /api/axis/snapshot → render modules. The page holds NO prospect data; everything comes
// from the authed endpoint. Writes go through /api/axis/intent (optimistic UI; the worker executes behind
// rails — the client NEVER sends/approves/pays). Laws enforced here: Badge Law (2) + side-effects (4).
import { SNAPSHOT_MODULES } from './axis-constants.js';
// Shared primitives now live in axis-dom.js so the sibling screen modules (composer, charts, fleet,
// reports, director) use the SAME el()/toast()/postIntent() rather than each carrying a copy that
// could drift. initDom() below injects the auth/logout closures they cannot see from here.
import { $, el, fmtMoney, ago, toast, postIntent, head, downloadText, initDom } from './axis-dom.js';
import { barChart, funnelChart } from './axis-charts.js';
import { openComposer } from './axis-composer.js';
import { renderFleet } from './axis-fleet.js';
import { renderReports } from './axis-reports.js';
import { renderDirector } from './axis-director-screen.js';

const TOKEN_KEY = 'aperture_jwt';

const ACTIONABLE = ['reply_to_outreach', 'new_inbound_request'];
const state = { token: localStorage.getItem(TOKEN_KEY) || '', snap: {}, version: null, module: 'overview', programStatus: null,
  ui: { inboxFilter: 'all', thread: null, apTab: 'pending', apOpen: null, apSel: new Set(), apCursor: 0, crmTab: 'contact', crmFilter: '', crmDrawer: null,
    prospect: null, prospectFilter: '', realOnly: false, pipeView: 'kanban', fuView: 'due_today', doc: null, anTab: 'research' } };
const authHeaders = (extra = {}) => ({ Authorization: 'Bearer ' + state.token, ...extra });
const data = (mod) => (state.snap[mod] && state.snap[mod].data) || {};

// Hand axis-dom.js the two things it cannot reach from a module of its own: how to sign a request,
// and what to do when the session has expired. Everything downstream of here shares one write path.
initDom({ authHeaders, onUnauthorized: () => logout() });

// ── Nav ──
const NAV = [
  { group: 'Sales', items: [
    { id: 'overview', label: 'Overview', glyph: 'OV' }, { id: 'inbox', label: 'Action Inbox', glyph: 'IN' },
    { id: 'pipeline', label: 'Pipeline', glyph: 'PL' }, { id: 'crm', label: 'CRM', glyph: 'CR' },
    { id: 'prospects', label: 'Prospects', glyph: 'PR' }, { id: 'outreach', label: 'Outreach Studio', glyph: 'OS' },
    { id: 'approvals', label: 'Approvals', glyph: 'AP' }, { id: 'waiting_reply', label: 'Waiting Reply', glyph: 'WR' },
    { id: 'followups', label: 'Follow-ups', glyph: 'FU' },
  ] },
  { group: 'Workspace', items: [
    { id: 'documents', label: 'Documents', glyph: 'DO' }, { id: 'analytics', label: 'Analytics', glyph: 'AN' },
    { id: 'products', label: 'Product Discovery', glyph: 'PD' },
  ] },
  { group: 'System', items: [
    { id: 'fleet', label: 'Fleet', glyph: 'FL' }, { id: 'axis-agent-director', label: 'AXIS Agent Director', glyph: 'AX' },
    { id: 'reports', label: 'Reports', glyph: 'RE' }, { id: 'settings', label: 'Settings', glyph: 'SE' },
  ] },
];
const navItem = (id) => NAV.flatMap(g => g.items).find(i => i.id === id);

// Badge Law (2): red inbox badge ONLY when open actionable > 0; approvals neutral when pending > 0. No others.
function inboxBadgeCount() { const rows = (data('inbox').rows) || []; return rows.filter(m => ACTIONABLE.includes(m.classification) && !m.actioned && !m.snoozed_until).length; }
function approvalsPending() { const rows = (data('approvals').rows) || []; return rows.filter(r => r.status === 'pending').length; }
function waitingReplyCount() { return (data('waiting_reply').count) || 0; }

function renderNav() {
  const nav = $('nav'); nav.innerHTML = '';
  const ib = inboxBadgeCount(), ap = approvalsPending(), wr = waitingReplyCount(), wrd = (data('waiting_reply').needs_delegation) || 0;
  for (const grp of NAV) {
    nav.append(el('div', { class: 'nav-group' }, grp.group));
    for (const it of grp.items) {
      const kids = [el('span', { class: 'nav-glyph' }, it.glyph), el('span', { class: 'nav-label' }, it.label)];
      if (it.id === 'inbox' && ib > 0) kids.push(el('span', { class: 'badge badge-red' }, ib));
      if (it.id === 'approvals' && ap > 0) kids.push(el('span', { class: 'badge badge-neutral' }, ap));
      if (it.id === 'waiting_reply' && wr > 0) kids.push(el('span', { class: 'badge ' + (wrd > 0 ? 'badge-red' : 'badge-neutral') }, wr));
      nav.append(el('button', { class: 'nav-item', 'aria-current': state.module === it.id ? 'true' : 'false',
        onclick: () => go(it.id) }, kids));
    }
  }
}
function go(mod) { state.module = mod; state.ui.thread = null; state.ui.crmDrawer = null; renderNav(); renderModule(); }

// The Director tab IS the command channel — it carries its own orb, transcript, mic and input. Leaving
// the floating dock up there puts two AXIS inputs on one screen, and the dock physically covers the
// tab's own composer. Hide the dock (and its fab) on that tab only; restore whatever the operator had
// when they leave, so closing the dock elsewhere still sticks.
let dockHiddenForDirector = false;
function syncDockVisibility() {
  const onDirector = state.module === 'axis-agent-director';
  const dock = $('axisDock'), fab = $('axisFab');
  if (!dock || !fab) return;
  if (onDirector) {
    if (!dockHiddenForDirector) { dockHiddenForDirector = !dock.hidden; dock.hidden = true; }
    fab.hidden = true;
  } else if (dockHiddenForDirector) {
    dockHiddenForDirector = false; dock.hidden = false; fab.hidden = true; renderDock();
  } else if (dock.hidden) {
    fab.hidden = false;
  }
}

// ── Screens ──
const SCREENS = {};

SCREENS.overview = (c) => {
  const d = data('overview'); const k = d.kpis || {};
  c.append(axisStrip(k)); // AXIS front-and-center: command strip above everything (R3)
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

SCREENS['axis-agent-director'] = (c) => {
  // The Director screen lives in axis-director-screen.js. Voice is NOT reimplemented there — the v1
  // machinery restored in 642251ad is passed in, so the tab, the fab dock and the public panel all
  // drive one orb state machine and one transcript.
  renderDirector(c, {
    data: { overview: data('overview'), approvals: data('approvals'), fleet: data('fleet'),
            settings: data('settings'), inbox: data('inbox'), analytics: data('analytics'),
            // RUN-AM / AM2 — the published program figures WITH the age of each read. Authed-only
            // (/api/axis-status, same Aperture gate); null until it lands, which the section renders
            // as "not loaded" rather than as an empty set of figures.
            program_status: state.programStatus,
            version: state.version },
    voice: {
      send: () => axisSend('axisDirectorInput'),
      micToggle: () => axisMicToggle('axisDirectorMic', 'axisDirectorInput', () => axisSend('axisDirectorInput')),
      voiceToggle: axisVoiceToggle,
      mountOrbs, setState: setAxisState, renderLog: renderDock,
      get voiceOn() { return axisVoiceOn; },
    },
    onIntent: (type, payload) => postIntent(type, payload),
    openComposer,
  });
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
function prospectById(id) { return ((data('prospects').rows) || []).find(x => x.id === id); }
function businessName(id) { const p = prospectById(id); return p ? (p.name || p.handle) : null; }
function renderThread(c, m) {
  c.append(el('div', { class: 'thread-bar' }, [el('button', { class: 'chip', onclick: () => { state.ui.thread = null; renderModule(); } }, '← Inbox'),
    el('div', { style: 'flex:1' }), el('span', { class: 'stage-tag' }, m.classification === 'reply_to_outreach' ? 'Reply' : 'New Request')]));
  const actions = [['draft_reply', 'Draft AI Reply'], ['open_gmail', 'Open in Gmail'], ['schedule_followup', 'Schedule Follow-up'], ['book_meeting', 'Book Meeting'], ['advance_stage', 'Advance Stage'], ['mark_handled', 'Mark Handled'], ['snooze', 'Snooze'], ['suppress', 'Suppress']];
  const bar = el('div', { class: 'thread-bar', style: 'position:sticky;top:0;background:var(--bg);z-index:2' }, actions.map(([t, lbl]) => el('button', { class: 'chip', onclick: () => inboxAction(t, m) }, lbl)));
  const left = el('div', {}, [
    el('div', { class: 'thread-msg' }, [
      el('div', { class: 'eyebrow' }, `${m.classification === 'reply_to_outreach' ? 'client reply' : 'new inbound'} · from ${m.from_email || 'unknown'}`),
      el('div', { style: 'font-weight:600;margin:6px 0' }, m.subject),
      el('div', { style: 'color:var(--txt-2);white-space:pre-line' }, m.body || m.snippet)]),
    m.sysnote ? el('div', { class: 'sysnote' }, m.sysnote) : null,
    bar,
  ]);
  // Right rail: company · pipeline stage · outreach history · notes
  const p = prospectById(m.business_id);
  const history = ((data('outreach').drafts) || []).filter(d => d.business_id === m.business_id);
  const rail = el('aside', { class: 'rail' }, [
    el('div', { class: 'eyebrow' }, 'company'),
    el('div', { style: 'font-weight:600;margin:4px 0 6px' }, p ? p.name : (m.from_email || 'Unlinked')),
    p ? el('div', { style: 'margin-bottom:12px' }, [el('span', { class: 'stage-tag' }, p.stage), p.est_monthly_value ? el('span', { class: 'mono', style: 'font-size:10px;color:var(--txt-3);margin-left:8px' }, '$' + p.est_monthly_value.toLocaleString() + '/mo') : null]) : null,
    el('div', { class: 'eyebrow', style: 'margin-bottom:6px' }, 'outreach history'),
    history.length ? el('div', {}, history.map(hh => el('div', { style: 'font-size:11px;color:var(--txt-2);padding:3px 0;border-bottom:1px solid var(--line)' }, [el('span', { class: 'stage-tag', style: 'margin-right:6px' }, hh.kind), hh.status]))) : el('div', { class: 'unknown', style: 'font-size:11px' }, 'No prior outreach on file'),
    el('div', { class: 'eyebrow', style: 'margin:12px 0 6px' }, 'notes'),
    el('div', { style: 'font-size:11px;color:var(--txt-3)' }, m.classify_reason ? 'Classified: ' + m.classify_reason : '—'),
  ]);
  c.append(el('div', { class: 'thread-wrap' }, [left, rail]));
}
async function inboxAction(type, m) {
  if (type === 'open_gmail') { // real deep link to the exact Gmail thread
    window.open(`https://mail.google.com/mail/u/0/#all/${encodeURIComponent(m.thread_id || '')}`, '_blank');
    toast('Opening Gmail thread'); return;
  }
  if (type === 'draft_reply') {
    // CC-BRIEF §2A: this used to queue an intent and send the operator to Approvals to wait — two tab
    // changes and the task never actually completed. The reply text now rides the snapshot
    // (inbox.rows[].suggested_reply, produced by the worker), so the composer opens instantly, in
    // place, over this very thread. Nothing navigates.
    const draft = m.suggested_reply;
    openComposer({
      mode: 'reply',
      to: m.from_email,
      subject: draft ? draft.subject : (/^re:/i.test(m.subject || '') ? m.subject : 'Re: ' + (m.subject || '')),
      body: draft ? draft.body : '',
      templateId: draft && draft.template_id,
      messageId: m.id,
      businessId: m.business_id,
      contactName: m.from_email,
      companyName: businessName(m.business_id),
      rails: data('settings'),
      onSent: () => { m.actioned = true; state.ui.thread = null; renderNav(); renderModule(); },
    });
    return;
  }
  const irreversibleUI = ['mark_handled', 'snooze', 'suppress'];
  if (irreversibleUI.includes(type)) { // optimistic side-effect (Law 4): decrement badge same tick
    if (type === 'snooze') m.snoozed_until = Date.now() + 864e5; else m.actioned = true;
    toast(labelFor(type)); renderNav();
    // after handling, drop back to the list so the (now smaller) badge is visible
    if (type !== 'snooze') { state.ui.thread = null; }
    renderModule();
  } else { toast(labelFor(type) + ' → queued'); }
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

// ── S6 Prospect Database ──
SCREENS.prospects = (c) => {
  if (state.ui.prospect != null) return renderProspectProfile(c, state.ui.prospect);
  const d = data('prospects'); let rows = d.rows || [];
  c.append(head('Prospect Database', `${d.real_count || 0} researched · ${rows.length} total · Toronto → GTA → ON → CA`));
  c.append(el('div', { class: 'thread-bar' }, [
    el('button', { class: 'chip', 'aria-selected': state.ui.realOnly, onclick: () => { state.ui.realOnly = !state.ui.realOnly; renderModule(); } }, 'Researched only'),
    el('div', { style: 'flex:1' }),
    el('input', { class: 'search', style: 'max-width:220px;color:var(--txt)', placeholder: 'filter name / city / industry…', value: state.ui.prospectFilter, oninput: (e) => { state.ui.prospectFilter = e.target.value; renderProspectRows(); } }),
    el('button', { class: 'chip', onclick: () => { toast('CSV export queued'); postIntent('csv_export', { module: 'prospects' }); } }, 'Export'),
  ]));
  c.append(el('div', { class: 'card', id: 'prospectRows', style: 'padding:0' }));
  renderProspectRows();
};
function renderProspectRows() {
  const wrap = $('prospectRows'); if (!wrap) return; wrap.innerHTML = '';
  let rows = (data('prospects').rows) || [];
  if (state.ui.realOnly) rows = rows.filter(r => r.is_real);
  const q = state.ui.prospectFilter.toLowerCase();
  if (q) rows = rows.filter(r => `${r.name} ${r.handle} ${r.city} ${r.industry}`.toLowerCase().includes(q));
  wrap.append(el('div', { class: 'row', style: 'font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--txt-3)' }, [
    el('div', { style: 'width:70px' }, 'Handle'), el('div', { style: 'flex:1' }, 'Company'), el('div', { style: 'width:110px' }, 'Industry'),
    el('div', { style: 'width:70px' }, 'City'), el('div', { style: 'width:120px' }, 'Maturity IT/CY/CL/AI'), el('div', { style: 'width:80px;text-align:right' }, 'Est/mo')]));
  if (!rows.length) { wrap.append(el('div', { class: 'empty' }, 'No prospects.')); return; }
  rows.forEach(r => wrap.append(el('div', { class: 'row', style: 'cursor:pointer', onclick: () => { state.ui.prospect = r.id; renderModule(); } }, [
    el('div', { style: 'width:70px' }, [el('span', { class: 'stage-tag' }, r.handle)]),
    el('div', { style: 'flex:1;font-weight:600' }, [r.is_real ? el('span', { style: 'color:var(--ok);margin-right:6px', title: 'researched with provenance' }, '●') : el('span', { style: 'color:var(--txt-3);margin-right:6px', title: 'sample data' }, '○'), r.name || r.handle]),
    el('div', { style: 'width:110px;color:var(--txt-2);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, (r.industry || '—').split('(')[0]),
    el('div', { style: 'width:70px;color:var(--txt-2)' }, r.city ? r.city.split(' ')[0] : '—'),
    el('div', { style: 'width:120px' }, maturityMini(r.maturity)),
    el('div', { style: 'width:80px;text-align:right;font-variant-numeric:tabular-nums' }, r.est_monthly_value ? '$' + r.est_monthly_value.toLocaleString() : '—')])));
}
function maturityMini(m) {
  m = m || {}; const dims = [['IT', m.it], ['CY', m.cyber], ['CL', m.cloud], ['AI', m.ai]];
  return el('div', { style: 'display:flex;gap:6px' }, dims.map(([k, v]) =>
    el('span', { class: 'mono', style: 'font-size:9px;color:' + (v >= 4 ? 'var(--ok)' : v <= 2 ? 'var(--crit)' : 'var(--txt-2)') }, k + (v || '—'))));
}

// ── S5 Prospect Profile (provenance-first, Law 3) ──
function renderProspectProfile(c, id) {
  const p = ((data('prospects').rows) || []).find(x => x.id === id);
  if (!p) { c.append(el('div', { class: 'empty' }, 'Not found.')); return; }
  c.append(el('div', { class: 'thread-bar' }, [el('button', { class: 'chip', onclick: () => { state.ui.prospect = null; renderModule(); } }, '← Prospects'),
    el('div', { style: 'flex:1' }), p.is_real ? el('span', { class: 'footnote' }, [el('span', { class: 'src' }, '● researched'), ' · provenance below']) : el('span', { class: 'stage-tag' }, 'sample')]));
  // Header
  c.append(el('div', { style: 'display:flex;align-items:baseline;gap:12px;margin-bottom:4px' }, [
    el('div', { class: 'screen-title' }, p.name || p.handle), el('span', { class: 'stage-tag' }, p.handle), el('span', { class: 'stage-tag' }, p.stage)]));
  const links = [['Website', pv(p, 'website')], ['LinkedIn', pv(p, 'linkedin_url')]].filter(x => x[1]);
  c.append(el('div', { style: 'margin-bottom:14px' }, links.map(([l, u]) => el('a', { href: u, target: '_blank', style: 'margin-right:12px;font-size:12px' }, l + ' ↗'))));

  // Company details grid — every field with provenance footnote or the honest unknown
  c.append(el('div', { class: 'kpi-grid' }, [
    provField(p, 'industry', 'Industry'), provField(p, 'city', 'Location'), provField(p, 'size', 'Size'),
    provField(p, 'address', 'Address'), provField(p, 'phone', 'Phone'), provField(p, 'public_email', 'Public email'),
    provField(p, 'revenue', 'Revenue'), provField(p, 'founded', 'Founded'), provField(p, 'maps_url', 'Google Maps'),
  ]));

  // Maturity meters (1–5 + basis)
  c.append(head('IT / Cyber / Cloud / AI maturity', 'assessment — basis on hover', 'margin-top:20px'));
  const md = p.maturity_detail || {};
  c.append(el('div', { class: 'card', style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px' },
    [['IT', 'it'], ['Cyber', 'cyber'], ['Cloud', 'cloud'], ['AI', 'ai']].map(([lbl, k]) => meter(lbl, p.maturity?.[k], md[k]?.basis))));

  // Opportunity assessments
  c.append(head('Opportunities', `est. $${(p.est_monthly_value || 0).toLocaleString()}/mo total — assessment`, 'margin-top:20px'));
  const opps = p.opportunities || [];
  c.append(el('div', { class: 'card', style: 'display:flex;gap:8px;flex-wrap:wrap' }, opps.length ? opps.map(o =>
    el('span', { class: 'chip', title: o.basis + ' (confidence ' + Math.round((o.confidence || 0) * 100) + '%)' }, [o.service, el('span', { class: 'count', style: 'color:var(--gold)' }, '$' + (o.est_mrr || 0).toLocaleString() + '/mo')])) : [el('span', { class: 'unknown' }, 'No opportunities assessed')]));

  // Public decision makers
  c.append(head('Public decision makers', 'sourced — emails require enrichment', 'margin-top:20px'));
  const cts = p.contacts || [];
  const cc = el('div', { class: 'card', style: 'padding:0' });
  if (!cts.length) cc.append(el('div', { class: 'empty' }, 'Not found — never guessed'));
  else cts.forEach(ct => {
    // CC-BRIEF §2B: a decision maker used to be dead text. Now the address is exposed and the SAME
    // composer opens inline on this profile, pre-filled with the LOCKED template the worker generated
    // (p.outreach_draft) — the copy is never retyped here.
    const to = ct.public_email || p.public_email || null;
    const draft = p.outreach_draft;
    const act = to && draft
      ? el('div', { style: 'display:flex;gap:6px' }, [
        el('button', {
          class: 'chip', style: 'border-color:var(--gold);color:var(--gold)',
          onclick: () => openComposer({
            mode: 'outreach', to, subject: draft.subject, body: draft.body, templateId: draft.template_id,
            businessId: p.id, contactName: ct.name || to, companyName: p.name || p.handle,
            rails: data('settings'),
            onSent: () => toast('Queued for send behind the rails — logged to CRM on delivery'),
          }),
        }, 'Draft AI Email'),
        el('a', { class: 'chip', href: 'mailto:' + to, title: 'Open in your own mail client instead' }, 'Email'),
      ])
      : el('span', { class: 'unknown', style: 'font-size:11px' }, to ? 'No approved template for this prospect' : 'No address — cannot send');
    cc.append(el('div', { class: 'row' }, [
      el('div', { style: 'flex:1;min-width:0' }, [el('div', { style: 'font-weight:600' }, ct.name), el('div', { style: 'font-size:12px;color:var(--txt-3)' }, ct.title)]),
      el('div', { style: 'width:210px;overflow:hidden;text-overflow:ellipsis' }, to ? el('span', { class: 'mono', style: 'font-size:11.5px' }, to) : el('span', { class: 'unknown' }, 'email: Not found — never guessed')),
      act,
      ct.source_url ? el('span', { class: 'footnote' }, ['src', ' — ', el('span', { class: 'src' }, (ct.source_url || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0] + ' ✓')]) : el('span', { class: 'footnote' }, 'src — unrecorded'),
    ]));
  });
  c.append(cc);

  // Stage control (manual override always available; auto-transitions logged)
  c.append(head('Pipeline stage', 'manual override always available', 'margin-top:20px'));
  c.append(el('div', { class: 'card' }, [stagePicker(p)]));
}
const pv = (p, key) => p.provenance?.[key]?.value ?? null;
function provField(p, key, label) {
  const f = p.provenance?.[key];
  const box = el('div', { class: 'kpi' }, [el('div', { class: 'label' }, label)]);
  if (!f || f.value == null) { box.append(el('div', { class: 'unknown', style: 'margin-top:6px;font-size:12px' }, 'Not found — never guessed')); return box; }
  box.append(el('div', { style: 'margin-top:6px;font-size:13px;font-weight:500' }, String(f.value)));
  const src = (f.source_url || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || 'source';
  box.append(el('div', { class: 'footnote', style: 'margin-top:8px' }, [src, ' · ', el('span', { class: 'src' }, Math.round((f.confidence || 0) * 100) + '% ✓'), ' · ', f.last_verified || '—']));
  return box;
}
function meter(label, score, basis) {
  const wrap = el('div', { title: basis || '' });
  wrap.append(el('div', { style: 'display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px' }, [el('span', {}, label), el('span', { class: 'mono', style: 'color:var(--gold)' }, (score || '—') + '/5')]));
  const bar = el('div', { style: 'display:flex;gap:3px' });
  for (let i = 1; i <= 5; i++) bar.append(el('span', { style: `flex:1;height:6px;border-radius:3px;background:${i <= (score || 0) ? 'var(--gold)' : 'var(--surface-3)'}` }));
  wrap.append(bar);
  if (basis) wrap.append(el('div', { style: 'font-size:11px;color:var(--txt-3);margin-top:6px' }, basis));
  return wrap;
}
function stagePicker(p) {
  const sel = el('select', { class: 'chip', style: 'padding:6px 10px', onchange: (e) => { toast('Stage override → ' + e.target.value); postIntent('stage_override', { business_id: p.id, to_stage: e.target.value }); } });
  PIPE_STAGES.forEach(s => sel.append(el('option', { value: s, selected: s === p.stage }, s)));
  return el('div', { style: 'display:flex;align-items:center;gap:10px' }, [el('span', { class: 'eyebrow' }, 'current:'), el('span', { class: 'stage-tag' }, p.stage), sel]);
}

// ── S4 Sales Pipeline (kanban + table) ──
const PIPE_PHASES = [
  { label: 'Research', stages: ['Researching', 'Profile Completed'] },
  { label: 'Outreach', stages: ['Email Generated', 'Waiting Approval', 'Approved', 'Ready to Send', 'Sent', 'Delivered', 'Opened'] },
  { label: 'Engaged', stages: ['Replied', 'Follow-up Required', 'Meeting Scheduled'] },
  { label: 'Deal', stages: ['Proposal Sent', 'Negotiation'] },
  { label: 'Closed', stages: ['Won', 'Lost', 'Archived'] },
];
const PIPE_STAGES = PIPE_PHASES.flatMap(p => p.stages);
SCREENS.pipeline = (c) => {
  const d = data('pipeline'); const cards = d.cards || [];
  c.append(el('div', { class: 'screen-head' }, [el('div', { class: 'screen-title' }, 'Sales Pipeline'),
    el('div', { style: 'display:flex;gap:8px' }, [
      el('button', { class: 'chip', 'aria-selected': state.ui.pipeView === 'kanban', onclick: () => { state.ui.pipeView = 'kanban'; renderModule(); } }, 'Kanban'),
      el('button', { class: 'chip', 'aria-selected': state.ui.pipeView === 'table', onclick: () => { state.ui.pipeView = 'table'; renderModule(); } }, 'Table')])]));
  if (state.ui.pipeView === 'table') {
    const wrap = el('div', { class: 'card', style: 'padding:0' });
    cards.forEach(card => wrap.append(el('div', { class: 'row', style: 'cursor:pointer', onclick: () => { state.module = 'prospects'; state.ui.prospect = card.id; renderNav(); renderModule(); } }, [
      el('span', { class: 'stage-tag' }, card.handle), el('div', { style: 'flex:1;font-weight:600' }, card.name || card.handle),
      el('span', { class: 'stage-tag' }, card.stage), el('div', { style: 'width:90px;text-align:right' }, card.est_monthly_value ? '$' + card.est_monthly_value.toLocaleString() : '—')])));
    c.append(wrap); return;
  }
  // Kanban: columns per stage that has cards (dense) grouped by phase colour
  const board = el('div', { style: 'display:flex;gap:12px;overflow-x:auto;padding-bottom:8px' });
  PIPE_STAGES.forEach(stage => {
    const inStage = cards.filter(c2 => c2.stage === stage);
    if (!inStage.length) return; // dense: only show stages with cards
    const col = el('div', { style: 'min-width:220px;flex:0 0 220px' }, [
      el('div', { class: 'eyebrow', style: 'margin-bottom:8px' }, [stage, el('span', { style: 'color:var(--gold);margin-left:6px' }, inStage.length)])]);
    inStage.forEach(card => {
      const auto = card.auto ? el('span', { title: 'auto-moved', style: 'color:var(--gold);font-size:10px' }, '↻') : null;
      col.append(el('div', { class: 'card', style: 'margin-bottom:8px;padding:11px;cursor:pointer', draggable: 'true',
        ondragstart: (e) => { e.dataTransfer.setData('text/plain', card.id); },
        onclick: () => { state.module = 'prospects'; state.ui.prospect = card.id; renderNav(); renderModule(); } }, [
        el('div', { style: 'display:flex;justify-content:space-between' }, [el('span', { style: 'font-weight:600;font-size:12.5px' }, card.name || card.handle), auto]),
        el('div', { style: 'font-size:11px;color:var(--txt-3);margin-top:4px' }, [(card.city || '').split(' ')[0], ' · ', card.est_monthly_value ? '$' + card.est_monthly_value.toLocaleString() + '/mo' : '—'])]));
    });
    // drop target → stage_override
    col.addEventListener('dragover', (e) => e.preventDefault());
    col.addEventListener('drop', (e) => { e.preventDefault(); const id = +e.dataTransfer.getData('text/plain'); toast('Stage → ' + stage); postIntent('stage_override', { business_id: id, to_stage: stage }); const card = cards.find(x => x.id === id); if (card) { card.stage = stage; renderModule(); } });
    board.append(col);
  });
  c.append(board);
};

// ── S7 Outreach Studio (generation only — NO send button exists; every exit → Approvals) ──
SCREENS.outreach = (c) => {
  const d = data('outreach'); const drafts = d.drafts || [];
  c.append(head('Outreach Studio', `${d.identity?.from || 'ahmad.wasee@iisupp.net'} · drafts only`));
  c.append(el('div', { class: 'card', style: 'border-color:var(--gold);background:var(--gold-dim);margin-bottom:14px;padding:11px 14px;font-size:12.5px' },
    ['🔒 No send button exists here. Every draft routes through ', el('b', {}, 'Approvals'), ' — nothing leaves without your per-item approval and a passing rails check at send time.']));
  if (!drafts.length) { c.append(el('div', { class: 'empty' }, 'No drafts yet. Generate outreach from a prospect profile.')); return; }
  drafts.forEach(dr => {
    const b = ((data('prospects').rows) || []).find(x => x.id === dr.business_id);
    const lint = dr.lint || {};
    const noIssue = (re) => (lint.issues || []).every(i => !re.test(i));
    const checklist = [
      ['Personalized (no {name})', noIssue(/placeholder|personalized/)],
      ['Approved template intact', noIssue(/approved element|drift|greeting/)],
      ['No banned filler', noIssue(/filler/)],
      [`CASL footer + unsubscribe`, /unsubscribe/i.test(dr.body || '')],
    ];
    const card = el('div', { class: 'card', style: 'margin-bottom:12px' }, [
      el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px' }, [
        el('div', {}, [el('span', { style: 'font-weight:600' }, (b?.name || 'Prospect')), el('span', { class: 'stage-tag', style: 'margin-left:8px' }, dr.to_email)]),
        el('span', { class: 'stage-tag', style: dr.status === 'pending' ? 'color:var(--gold)' : '' }, dr.status)]),
      el('div', { class: 'eyebrow', style: 'margin-bottom:4px' }, 'subject'),
      el('div', { style: 'font-weight:500;margin-bottom:8px' }, dr.subject),
      el('div', { class: 'eyebrow', style: 'margin-bottom:4px' }, 'body (edit in place — saves to draft, still needs approval)'),
      el('textarea', { style: 'width:100%;min-height:150px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;color:var(--txt);font:inherit;font-size:12.5px;padding:10px;white-space:pre-wrap',
        onblur: (e) => { toast('Draft saved — still needs approval'); postIntent('edit_draft', { item_id: dr.id, body: e.target.value }); } }, dr.body),
      // human-sounding checklist
      el('div', { style: 'display:flex;gap:14px;flex-wrap:wrap;margin:10px 0' }, checklist.map(([lbl, ok]) =>
        el('span', { style: `font-size:12px;color:${ok ? 'var(--ok)' : 'var(--crit)'}` }, `${ok ? '✓' : '✗'} ${lbl}`))),
      el('div', { class: 'footnote', style: 'display:inline-block' }, ['CASL consent: ', el('span', { class: 'src' }, dr.consent_basis || '—'), ' · ', dr.consent_evidence || '']),
      // tone controls + route-to-approvals (NO send)
      el('div', { class: 'appr-actions', style: 'margin-top:12px' }, [
        ...['professional', 'friendly', 'brief'].map(t => el('button', { class: 'chip', onclick: () => { toast('Regenerate (' + t + ') → AXIS'); postIntent('regen', { item_id: dr.id, tone: t }); } }, t)),
        el('div', { style: 'flex:1' }),
        el('button', { class: 'chip', style: 'border-color:var(--gold);color:var(--gold)', onclick: () => go('approvals') }, 'Review in Approvals →')]),
    ]);
    c.append(card);
  });
};

// ── S8 Follow-ups ──
SCREENS.followups = (c) => {
  const d = data('followups');
  c.append(head('Follow-ups', `cadence day ${(d.cadence || [3, 7, 14]).join('/')} · max ${d.max_touches || 3} touches then stop · queued through Approvals`));
  const views = [['due_today', 'Due today'], ['overdue', 'Overdue'], ['upcoming', 'Upcoming'], ['auto_cancelled', 'Auto-cancelled']];
  c.append(el('div', { class: 'thread-bar' }, views.map(([id, lbl]) => el('button', { class: 'chip', 'aria-selected': state.ui.fuView === id, onclick: () => { state.ui.fuView = id; renderModule(); } }, [lbl, el('span', { class: 'count' }, (d[id] || []).length)]))));
  const rows = d[state.ui.fuView] || [];
  const card = el('div', { class: 'card', style: 'padding:0' });
  if (!rows.length) card.append(el('div', { class: 'empty' }, state.ui.fuView === 'auto_cancelled' ? 'None auto-cancelled.' : 'Nothing here.'));
  else rows.forEach(f => {
    const overdue = state.ui.fuView === 'overdue';
    card.append(el('div', { class: 'row' }, [
      el('div', { style: 'flex:1;font-weight:600' }, f.company || 'Prospect'),
      el('span', { class: 'mono', style: `font-size:11px;color:${overdue ? 'var(--crit)' : 'var(--txt-3)'}` }, new Date(f.due_at).toISOString().slice(0, 10)),
      state.ui.fuView === 'auto_cancelled'
        ? el('span', { class: 'stage-tag', style: 'color:var(--gold)' }, 'auto-cancelled (reply)')
        : el('span', { class: 'stage-tag' }, 'queued → Approvals'),
    ]));
  });
  c.append(card);
  c.append(el('div', { class: 'card', style: 'margin-top:12px;display:flex;gap:8px;align-items:center' }, [
    el('span', { class: 'eyebrow' }, 'cadence editor'),
    ...(d.cadence || [3, 7, 14]).map(day => el('span', { class: 'stage-tag' }, 'day ' + day)),
    el('button', { class: 'chip', onclick: () => { const v = prompt('Cadence days (comma-separated, max 3):', (d.cadence || [3, 7, 14]).join(',')); if (v) { toast('Cadence updated'); postIntent('cadence_edit', { days: v.split(',').map(x => +x.trim()).filter(Boolean).slice(0, 3) }); } } }, 'Edit'),
  ]));
};

SCREENS.waiting_reply = (c) => {
  const d = data('waiting_reply');
  const rows = d.rows || [];
  c.append(head('Waiting Reply', `${d.count || 0} sent · awaiting a human reply · a reply clears the row automatically · cadence day ${(d.cadence || [3, 7, 14]).join('/')}`));
  if ((d.needs_delegation || 0) > 0) {
    c.append(el('div', { class: 'card', style: 'border-left:3px solid var(--crit);margin-bottom:12px;display:flex;gap:10px;align-items:center' }, [
      el('span', { class: 'stage-tag', style: 'color:var(--crit)' }, `${d.needs_delegation} silent past cadence`),
      el('div', { style: 'flex:1;font-size:13px' }, 'These have gone cold with no reply and no scheduled touch left — hand to the Director to delegate follow-up.'),
      el('button', { class: 'chip', onclick: () => { rows.filter(r => r.delegate).forEach(r => postIntent('delegate_followup', { business_id: r.business_id, outreach_item_id: r.id })); toast('Handed to Director → follow-up agent'); } }, 'Delegate all'),
    ]));
  }
  const card = el('div', { class: 'card', style: 'padding:0' });
  if (!rows.length) card.append(el('div', { class: 'empty' }, 'Nothing waiting — no sent outreach is unanswered.'));
  else rows.forEach(r => {
    const hot = r.delegate || r.next_action === 'follow-up due';
    card.append(el('div', { class: 'row', style: 'gap:10px' }, [
      el('div', { style: 'flex:1;min-width:0' }, [
        el('div', { style: 'font-weight:600' }, r.company),
        el('div', { class: 'mono', style: 'font-size:11px;color:var(--txt-3)' }, r.to_email),
      ]),
      el('span', { class: 'mono', style: `font-size:11px;color:${r.days_waiting >= 7 ? 'var(--crit)' : 'var(--txt-3)'}` }, `${r.days_waiting}d silent`),
      el('span', { class: 'stage-tag', style: 'font-size:11px;color:var(--txt-3)' }, r.touches_done ? `${r.touches_done} touch${r.touches_done === 1 ? '' : 'es'}` : 'no touch yet'),
      el('span', { class: 'stage-tag', style: `color:${hot ? 'var(--crit)' : 'var(--gold)'}` }, r.next_action),
      r.delegate
        ? el('button', { class: 'chip', onclick: () => { postIntent('delegate_followup', { business_id: r.business_id, outreach_item_id: r.id }); toast('Handed to Director → follow-up agent'); } }, 'Delegate')
        : el('button', { class: 'chip', onclick: () => go('followups') }, 'Follow-ups'),
    ]));
  });
  c.append(card);
};

// ── S9 Documents & Contracts ──
SCREENS.documents = (c) => {
  if (state.ui.doc != null) return renderDoc(c, state.ui.doc);
  const d = data('documents'); const rows = d.rows || [];
  c.append(head('Documents & Contracts', `${rows.length} Ontario DRAFT templates · merge → Approvals · e-sign future-ready`));
  const grid = el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px' });
  rows.forEach(dc => grid.append(el('div', { class: 'card', style: 'cursor:pointer', onclick: () => { state.ui.doc = dc.id; renderModule(); } }, [
    el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline' }, [el('div', { style: 'font-weight:600;font-size:13px' }, dc.type), el('span', { class: 'stage-tag', style: dc.status === 'Ready' ? 'color:var(--ok)' : '' }, dc.status)]),
    el('div', { style: 'font-size:11px;color:var(--txt-3);margin-top:6px' }, `v${(dc.versions || []).length} · ${(dc.versions || []).length} version${(dc.versions || []).length === 1 ? '' : 's'}`),
    el('div', { style: 'font-size:11px;color:var(--txt-2);margin-top:8px;max-height:44px;overflow:hidden' }, (dc.body || '').split('\n').filter(Boolean)[2] || 'DRAFT template'),
  ])));
  c.append(grid);
};
function renderDoc(c, id) {
  const dc = ((data('documents').rows) || []).find(x => x.id === id);
  if (!dc) { c.append(el('div', { class: 'empty' }, 'Not found.')); return; }
  c.append(el('div', { class: 'thread-bar' }, [el('button', { class: 'chip', onclick: () => { state.ui.doc = null; renderModule(); } }, '← Documents'),
    el('div', { style: 'flex:1' }), el('span', { class: 'stage-tag' }, dc.status)]));
  c.append(el('div', { style: 'display:flex;align-items:baseline;gap:12px;margin-bottom:10px' }, [el('div', { class: 'screen-title' }, dc.type), el('span', { class: 'eyebrow' }, dc.title)]));
  // actions
  c.append(el('div', { class: 'appr-actions', style: 'margin-bottom:12px' }, [
    el('button', { class: 'chip', style: 'border-color:var(--gold);color:var(--gold)', onclick: () => {
      const list = ((data('prospects').rows) || []).filter(p => p.is_real);
      const name = prompt('Prepare for which prospect? (type part of the name)\n' + list.slice(0, 8).map(p => '· ' + p.name).join('\n'));
      if (!name) return; const m = list.find(p => p.name.toLowerCase().includes(name.toLowerCase()));
      if (!m) { toast('No match'); return; }
      toast(`Preparing ${dc.type} for ${m.name} → Approvals`); postIntent('prepare_for_client', { doc_id: dc.id, business_id: m.id });
    } }, 'Prepare for client'),
    el('button', { class: 'chip', onclick: () => { toast('Duplicated'); postIntent('duplicate', { doc_id: dc.id }); } }, 'Duplicate'),
    el('button', { class: 'chip', onclick: () => { toast('Downloaded (DRAFT)'); downloadText(dc.title + '.md', dc.body); } }, 'Download'),
  ]));
  // merge-fields hint
  const fields = (dc.body.match(/\{\{(\w+)\}\}/g) || []).filter((v, i, a) => a.indexOf(v) === i);
  if (fields.length) c.append(el('div', { class: 'card', style: 'margin-bottom:12px;padding:10px 14px' }, [el('span', { class: 'eyebrow' }, 'merge fields: '), el('span', { class: 'mono', style: 'font-size:11px;color:var(--gold)' }, fields.join('  '))]));
  // body (editable → new version)
  c.append(el('div', { class: 'thread-wrap' }, [
    el('textarea', { style: 'width:100%;min-height:420px;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;color:var(--txt);font:inherit;font-size:12px;padding:14px;white-space:pre-wrap',
      onblur: (e) => { if (e.target.value !== dc.body) { toast('Saved as new version (old retained)'); postIntent('new_version', { doc_id: dc.id, body: e.target.value }); } } }, dc.body),
    el('aside', { class: 'rail' }, [
      el('div', { class: 'eyebrow', style: 'margin-bottom:8px' }, 'version history (append-only)'),
      ...((dc.versions || []).slice().reverse().map(v => el('div', { style: 'font-size:12px;padding:6px 0;border-bottom:1px solid var(--line)' }, [el('span', { class: 'stage-tag', style: 'margin-right:8px' }, 'v' + v.version), new Date(v.created_at).toISOString().slice(0, 10)]))),
      el('div', { class: 'eyebrow', style: 'margin:12px 0 6px' }, 'e-signature'),
      el('div', { class: 'unknown', style: 'font-size:11px' }, 'Future-ready (status only — not enabled)'),
    ]),
  ]));
}
// downloadText + the local SVG chart helpers moved to axis-dom.js / axis-charts.js — the chart
// versions there keep the same visual language but add hover, keyboard focus and drill-down.

// ── S10 Analytics ──
SCREENS.analytics = (c) => {
  const a = data('analytics');
  c.append(head('Analytics', 'computed by the worker · reconciles to SQLite'));
  const tabs = [['research', 'Research progress'], ['sales', 'Sales activity'], ['insights', 'Business insights']];
  c.append(el('div', { class: 'thread-bar' }, tabs.map(([id, lbl]) => el('button', { class: 'chip', 'aria-selected': state.ui.anTab === id, onclick: () => { state.ui.anTab = id; renderModule(); } }, lbl))));
  if (state.ui.anTab === 'research') {
    const g = a.research || {}; const geo = g.geo_coverage || {};
    c.append(kpiRow([['Total', g.total], ['Researched', g.researched], ['Toronto', geo.Toronto], ['GTA', geo.GTA]]));
    c.append(head('Geo coverage · Toronto → GTA → Ontario → Canada', '', 'margin-top:18px'));
    c.append(el('div', { class: 'card' }, [barChart(Object.entries(geo).map(([k, v]) => ({ label: k, value: v })), { colorVar: '--c2' })]));
    c.append(head('By city', '', 'margin-top:16px'));
    c.append(el('div', { class: 'card' }, [barChart(Object.entries(g.by_city || {}).sort((x, y) => y[1] - x[1]).slice(0, 10).map(([k, v]) => ({ label: k, value: v })), { colorVar: '--c3' })]));
  } else if (state.ui.anTab === 'sales') {
    const s = a.sales || {};
    c.append(kpiRow([['Generated', s.generated], ['Sent', s.sent], ['Replies', s.replies], ['New req', s.new_requests], ['Meetings', s.meetings], ['Won', s.won]]));
    c.append(head('Funnel · Generated → Won', '', 'margin-top:18px'));
    c.append(el('div', { class: 'card' }, [funnelChart(s.funnel || [])]));
    c.append(head('Activity', '', 'margin-top:16px'));
    c.append(el('div', { class: 'card' }, [barChart([['Generated', s.generated], ['Follow-ups', s.followups], ['Approved', s.approved], ['Rejected', s.rejected], ['Opportunities', s.opportunities]].map(([label, value]) => ({ label, value: value || 0 })), { colorVar: '--c1' })]));
  } else {
    const ins = a.insights || {};
    c.append(kpiRow([['Pipeline $/mo', '$' + (ins.pipeline_value || 0).toLocaleString()], ['Opp MRR $/mo', '$' + (ins.opportunity_mrr || 0).toLocaleString()]]));
    c.append(head('Top prospects by est. value', '', 'margin-top:18px'));
    c.append(el('div', { class: 'card' }, [barChart((ins.top_value || []).map(t => ({ label: t.name, value: t.value })), { colorVar: '--c1', money: true })]));
    c.append(head('By industry', '', 'margin-top:16px'));
    c.append(el('div', { class: 'card' }, [barChart(Object.entries(ins.by_industry || {}).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => ({ label: k, value: v })), { colorVar: '--c5' })]));
  }
  c.append(el('div', { class: 'appr-actions', style: 'margin-top:16px' }, ['png', 'csv', 'pdf'].map(f => el('button', { class: 'chip', onclick: () => { toast('Export ' + f.toUpperCase() + ' queued'); postIntent('export', { format: f, module: 'analytics' }); } }, 'Export ' + f.toUpperCase()))));
};
function kpiRow(pairs) { return el('div', { class: 'kpi-grid' }, pairs.map(([l, v]) => el('div', { class: 'kpi' }, [el('div', { class: 'label' }, l), el('div', { class: 'value' }, v ?? 0)]))); }

// ── S13 Reports & Settings ──
SCREENS.reports = (c) => {
  const st = data('settings');
  // Reports half (S13) — charts, quarterly roll-up of daily agent work, summary→detail drill-down and
  // worker-side .xlsx export — lives in axis-reports.js. The Settings half below is unchanged, and
  // SCREENS.settings still aliases this whole screen so BOTH nav tabs keep working exactly as before.
  renderReports(c, {
    data: data('reports'), settings: st, analytics: data('analytics'),
    onIntent: (type, payload) => postIntent(type, payload),
  });
  // Settings — rails
  const rails = st.rails || {};
  c.append(head('Safety rails', '', 'margin-top:6px'));
  c.append(el('div', { class: 'card', style: 'display:flex;gap:20px;flex-wrap:wrap' }, [
    settingBox('Daily cap', rails.daily_cap), settingBox('Quiet hours', `${rails.quiet_hours?.start ?? 21}:00–${rails.quiet_hours?.end ?? 8}:00 ET`),
    settingBox('Follow-up cadence', (rails.followup_days || [3, 7, 14]).join('/') + ' d'), settingBox('Max touches', rails.max_followups ?? 3),
    settingBox('Suppression list', st.suppression_count ?? 0),
  ]));
  // Integrations
  c.append(head('Integrations', '', 'margin-top:16px'));
  const dot = (s) => s === 'ok' ? 'dot-ok' : s === 'error' ? 'dot-crit' : 'dot-warn';
  c.append(el('div', { class: 'card', style: 'padding:0' }, (st.integrations || []).map(ig => el('div', { class: 'row' }, [
    el('span', { class: 'dot ' + dot(ig.status) }), el('div', { style: 'width:120px;font-weight:600' }, ig.name),
    el('div', { style: 'flex:1;color:var(--txt-3);font-size:12px' }, ig.detail), el('span', { class: 'stage-tag' }, ig.status)]))));
  // Data & backups
  c.append(head('Data & backups', '', 'margin-top:16px'));
  c.append(el('div', { class: 'card' }, [el('div', { style: 'font-size:12px;color:var(--txt-2)' }, `System of record: ${st.data?.db || 'data/axis-sales.db'} (SQLite, local, gitignored). Last backup: ${st.data?.last_backup || '—'}.`)]));
};
function settingBox(label, value) { return el('div', {}, [el('div', { class: 'eyebrow' }, label), el('div', { style: 'font-size:16px;font-weight:600;margin-top:4px' }, value ?? '—')]); }
SCREENS.settings = SCREENS.reports; // Reports & Settings share the screen (spec S13)

// ── Fleet — the live agent floor. Was the only NAV entry with no SCREENS handler at all, so it fell
// through to placeholder() and rendered raw snapshot JSON. agent_runs is genuinely empty until the
// worker records runs, and the screen is built to look correct in that state rather than fake one.
SCREENS.fleet = (c) => {
  renderFleet(c, { data: data('fleet'), onIntent: (type, payload) => postIntent(type, payload) });
};

// ── S11 Product Discovery (Miner) ──
SCREENS.products = (c) => {
  const d = data('products'); const rows = d.rows || [];
  c.append(head('Product Discovery', `${rows.length} opportunities · scored 1–5 · weighted rank · → AXIS review`));
  if (!rows.length) { c.append(el('div', { class: 'empty' }, 'Miner has not run yet.')); return; }
  const axes = [['demand', 'Demand'], ['ease', 'Ease'], ['profitability', 'Profit'], ['scalability', 'Scale'], ['advantage', 'Edge']];
  rows.forEach((p, i) => {
    const card = el('div', { class: 'card', style: 'margin-bottom:12px' }, [
      el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline' }, [
        el('div', {}, [el('span', { class: 'mono', style: 'color:var(--gold);margin-right:8px' }, '#' + (i + 1)), el('span', { style: 'font-weight:600' }, p.name)]),
        el('div', { style: 'display:flex;gap:8px;align-items:center' }, [el('span', { class: 'mono', style: 'color:var(--gold);font-size:15px' }, (p.weighted_score ?? 0).toFixed(1)), el('span', { class: 'stage-tag', style: p.status === 'Recommended' ? 'color:var(--ok)' : '' }, p.status)])]),
      el('div', { style: 'font-size:11px;color:var(--txt-3);margin:4px 0 10px' }, p.category),
      // 5-axis mini-meters
      el('div', { style: 'display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px' }, axes.map(([k, lbl]) => el('div', { style: 'min-width:90px' }, [
        el('div', { style: 'display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px' }, [el('span', { style: 'color:var(--txt-3)' }, lbl), el('span', { class: 'mono', style: 'color:var(--gold)' }, (p.axes?.[k] ?? '—') + '/5')]),
        el('div', { style: 'display:flex;gap:2px' }, [1, 2, 3, 4, 5].map(n => el('span', { style: `width:12px;height:5px;border-radius:2px;background:${n <= (p.axes?.[k] || 0) ? 'var(--gold)' : 'var(--surface-3)'}` }))),
      ]))),
      // evidence + action
      el('div', { class: 'footnote', style: 'display:inline-block;margin-bottom:10px' }, ['evidence: ', el('span', { class: 'src' }, evidenceText(p.evidence))]),
      el('div', { class: 'appr-actions' }, [el('button', { class: 'chip', style: 'border-color:var(--gold);color:var(--gold)', onclick: () => { toast('Sent to AXIS review'); postIntent('send_to_axis_review', { product_id: p.id }); } }, 'Send to AXIS review')]),
    ]);
    c.append(card);
  });
};
function evidenceText(e) {
  if (!e) return '—';
  if (e.need_count != null) return `${e.need_count} of ${e.of_prospects} researched prospects need this${e.sample ? ' (e.g. ' + e.sample.slice(0, 2).join(', ') + ')' : ''}`;
  return e.market_signal || JSON.stringify(e).slice(0, 80);
}

function placeholder(label) {
  return (c) => {
    c.append(head(label, 'live data bound · full UI in a later phase'));
    const d = state.snap[state.module] && state.snap[state.module].data;
    c.append(el('div', { class: 'card' }, [el('div', { class: 'eyebrow', style: 'margin-bottom:8px' }, 'snapshot payload (real, from /api/axis/snapshot)'),
      el('pre', { class: 'mono', style: 'font-size:11px;white-space:pre-wrap;color:var(--txt-2);margin:0;max-height:340px;overflow:auto' }, d ? JSON.stringify(d, null, 2) : '(empty)')]));
  };
}
function renderModule() {
  clearOverlays();
  const c = $('content'); c.innerHTML = '';
  const screen = el('div', { class: 'screen' }); c.append(screen);
  (SCREENS[state.module] || placeholder(navItem(state.module)?.label || state.module))(screen);
  syncDockVisibility();
}
function clearOverlays() { document.querySelectorAll('.drawer, .drawer-bg').forEach(n => n.remove()); }

// ── Snapshot loop ──
function renderTick() { $('tick').textContent = state.source === 'seed' ? 'seed data · worker idle' : (state.version && state.version.tick ? 'last worker tick ' + state.version.tick.slice(11, 16) : 'live'); }
// An open composer holds text the operator is typing. renderModule() rebuilds the whole content area
// and clearOverlays() sweeps drawers, so re-rendering underneath a modal is how a half-written email
// gets destroyed by a background tick — the same class of bug already fixed once for the AXIS strip
// input. Take the fresh data, but defer the repaint until the overlay closes.
const overlayOpen = () => !!document.querySelector('.axis-overlay-bg');
document.addEventListener('axis:overlay-closed', () => {
  if (state.ui.repaintPending) { state.ui.repaintPending = false; renderModule(); }
});
// AM2 — the published program figures and their evidence stamps. Authed-only; a failure leaves
// state.programStatus null, and the Director section says "not loaded" rather than showing an empty
// figure set. Never fetched unauthenticated: this payload is operator-internal by design.
async function fetchProgramStatus() {
  try {
    const r = await fetch('/api/axis-status', { headers: authHeaders(), cache: 'no-store' });
    if (!r.ok) return;
    const j = await r.json();
    if (j && j.ok) { state.programStatus = j; if (state.module === 'axis-agent-director' && !overlayOpen()) renderModule(); }
  } catch {}
}
async function fetchSnapshots() {
  fetchProgramStatus();
  const r = await fetch('/api/axis/snapshot?module=all', { headers: authHeaders(), cache: 'no-store' });
  if (r.status === 401) return logout();
  const j = await r.json();
  if (j && j.ok) {
    state.snap = j.snapshots || {}; state.version = j.version; state.source = j.source;
    renderTick(); renderNav();
    if (overlayOpen()) { state.ui.repaintPending = true; return; }
    renderModule();
  }
}
async function pollVersion() {
  try { const r = await fetch('/api/axis/snapshot', { headers: authHeaders(), cache: 'no-store' }); if (r.status === 401) return logout();
    const j = await r.json(); if (j && j.ok && (!state.version || j.version.v !== state.version.v)) fetchSnapshots(); } catch {}
}

// ── AXIS dock ──
const dockLog = [];
function renderAxisLog(log) {
  log.innerHTML = '';
  if (!dockLog.length) log.append(el('div', { class: 'empty', style: 'padding:20px' }, 'Talk to AXIS. Blunt. Important-only.'));
  dockLog.forEach(m => {
    const node = (m.role === 'axis' && m.text === '…')
      ? el('div', { class: 'axis-msg axis axis-thinking', role: 'status', 'aria-label': 'AXIS is thinking' }, [el('span'), el('span'), el('span')])
      : el('div', { class: 'axis-msg ' + m.role }, m.text);
    if (m.chips) node.append(el('div', { class: 'chips' }, m.chips.map(ch => el('button', { class: 'chip', onclick: ch.onclick }, ch.label))));
    log.append(node);
  });
  log.scrollTop = log.scrollHeight;
}
function renderDock() {
  for (const id of ['axisLog', 'axisDirectorLog']) {
    const log = $(id);
    if (log) renderAxisLog(log);
  }
}
async function axisSend(inputId = 'axisInput') {
  const inp = $(inputId); const text = inp?.value.trim(); if (!text) return; inp.value = '';
  dockLog.push({ role: 'user', text }); renderDock();
  // Remove OUR placeholder by reference, never the array tail — concurrent sends must not eat
  // each other's replies or orphan a fake thinking row (gate-review finding, 2026-07-21).
  const pending = { role: 'axis', text: '…' };
  const dropPending = () => { const i = dockLog.indexOf(pending); if (i >= 0) dockLog.splice(i, 1); };
  dockLog.push(pending); renderDock();
  setAxisState('thinking'); // orb + state word: awaiting the director brain
  try {
    const r = await fetch('/.netlify/functions/axis-director', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ action: 'chat', messages: dockLog.filter(m => m.role === 'user').map(m => ({ role: 'user', content: m.text })) }) });
    const j = await r.json(); dropPending();
    const reply = { role: 'axis', text: (j && j.text) || 'Heard you.' };
    if (j && j.routedAgent && j.intent) reply.chips = [{ label: 'Approve route', onclick: () => { postIntent('approve', { intent: j.intent, agent: j.routedAgent }); toast('Routed to ' + j.routedAgent); } }];
    dockLog.push(reply); renderDock(); if (!axisSpeak(reply.text)) setAxisState('idle');
  } catch { dropPending(); dockLog.push({ role: 'axis', text: 'Brain unreachable.' }); renderDock(); if (!axisSpeak('Brain unreachable.')) setAxisState('idle'); }
}

// ── AXIS voice (restored from the v1 console, full behavior) — mic push-to-talk + spoken replies,
// free browser Web Speech API; no paid API, no LLM. Ported from assets/aperture-learning.js
// (4ee1b883 push-to-talk, 0e17c2ca humanized voice — Ahmad: "sounds robotic" fix). Voice defaults ON
// (Ahmad: "I want to talk, it's faster"); a manual voice override persists in localStorage and is the
// SAME key the v1 console used, so a voice picked there carries over here.
let axisVoiceOn = true, axisRec = null, axisListening = false;

// Rank the most HUMAN English voice the OS/browser offers: Neural/Natural (Edge online) > Google
// (Chrome online) > Premium/Enhanced (macOS) > male-leaning names (AXIS persona) > any en-US/CA.
function axisScoreVoice(v) {
  try {
    const n = (v.name || '') + ' ' + (v.voiceURI || '');
    let s = 0;
    if (/natural|neural/i.test(n)) s += 100;
    if (/google/i.test(n)) s += 60;
    if (/premium|enhanced|siri/i.test(n)) s += 50;
    if (/online/i.test(n)) s += 20;
    if (/(guy|davis|andrew|brian|christopher|eric|roger|steffan|ryan|thomas|daniel|alex|arthur|george|james|mark)/i.test(n)) s += 12;
    if (/^en(-|_)?(US|CA)/i.test(v.lang || '')) s += 8; else if (/^en/i.test(v.lang || '')) s += 4; else s -= 50;
    if (/david|zira|sam\b/i.test(n) && !/natural|neural|online/i.test(n)) s -= 15; // legacy SAPI = the robotic sound
    return s;
  } catch { return -1; }
}
function axisPickVoice() {
  try {
    const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    if (!vs.length) return null;
    let wanted = ''; try { wanted = localStorage.getItem('axis-voice-name') || ''; } catch {}
    if (wanted) { const hit = vs.find(v => v.name === wanted); if (hit) return hit; }
    return vs.slice().sort((a, b) => axisScoreVoice(b) - axisScoreVoice(a))[0] || null;
  } catch { return null; }
}
// Manual controls (DevTools or console): cycle voices / set a specific one. Persisted.
window.axisVoiceNext = function () {
  try {
    const vs = ((window.speechSynthesis && speechSynthesis.getVoices()) || []).filter(v => /^en/i.test(v.lang || ''));
    if (!vs.length) return null;
    const cur = axisPickVoice();
    const i = Math.max(0, vs.findIndex(v => cur && v.name === cur.name));
    const nxt = vs[(i + 1) % vs.length];
    try { localStorage.setItem('axis-voice-name', nxt.name); } catch {}
    axisSpeak('Now speaking with ' + nxt.name.replace(/microsoft|google|online|\(|\)/gi, ' ').replace(/\s+/g, ' ').trim() + '.');
    return nxt.name;
  } catch { return null; }
};
window.axisSetVoice = function (name) { try { localStorage.setItem('axis-voice-name', String(name || '')); } catch {} return name; };

// Make text sound like a person, not a screen reader: strip glyphs/markdown, speak symbols naturally.
function axisHumanizeForSpeech(text) {
  let t = String(text || '');
  t = t.replace(/[•·▪◦●⚠🔊🔇🎙✅❌→]/g, ' ')
       .replace(/[*_`#>\[\]]/g, ' ')
       .replace(/https?:\/\/([^\s\/]+)[^\s]*/gi, '$1')
       .replace(/\b24\s*\/\s*7\b/g, 'twenty-four seven')
       .replace(/\bw\//gi, 'with ')
       .replace(/\be\.g\.\s*/gi, 'for example, ')
       .replace(/\bi\.e\.\s*/gi, 'that is, ')
       .replace(/(\d+)\s*%/g, '$1 percent')
       .replace(/\s[-–—]\s/g, ', ')
       .replace(/\s*\n+\s*/g, '. ')
       .replace(/\.\s*\./g, '.')
       .replace(/\s+/g, ' ').trim();
  return t;
}
let __speakGen = 0; // generation guard: a stale utterance's onend must never clobber a newer state
function axisSpeak(text) {
  try {
    if (!axisVoiceOn || !window.speechSynthesis) return false;
    const clean = axisHumanizeForSpeech(text);
    if (!clean) return false;
    speechSynthesis.cancel(); // barge-in: a new reply always interrupts the old one
    const gen = ++__speakGen;
    const v = axisPickVoice();
    const natural = !!(v && /natural|neural|google|premium|enhanced/i.test(v.name || ''));
    // Sentence-chunk so delivery breathes between thoughts (also avoids Chrome's long-utterance cutoff).
    const chunks = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
    let buf = ''; const queue = [];
    for (const c of chunks) { if ((buf + c).length > 180 && buf) { queue.push(buf.trim()); buf = c; } else { buf += c; } }
    if (buf.trim()) queue.push(buf.trim());
    setAxisState('speaking');
    queue.forEach((part, qi) => {
      const u = new SpeechSynthesisUtterance(part);
      if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = natural ? 1.0 : 1.02; u.pitch = 1.0; u.volume = 1;
      // cancel() fires 'error' (interrupted/canceled), not 'end' — without onerror the machine
      // would stick on 'speaking' forever (gate-review finding). Every chunk resets, gen-guarded.
      const settle = () => { if (gen === __speakGen && document.documentElement.dataset.axisState === 'speaking') setAxisState('idle'); };
      if (qi === queue.length - 1) u.onend = settle;
      u.onerror = settle;
      speechSynthesis.speak(u);
    });
    const b = $('axisVoice'); if (b && v) b.title = 'Voice: ' + v.name + ' — cycle: axisVoiceNext()';
    return true;
  } catch { return false; }
}
function axisSyncVoiceBtn() {
  for (const id of ['axisVoice', 'axisPubVoice', 'axisDirectorVoice']) {
    const b = $(id);
    if (b) { b.setAttribute('aria-pressed', axisVoiceOn ? 'true' : 'false'); b.style.color = axisVoiceOn ? 'var(--gold)' : ''; b.style.borderColor = axisVoiceOn ? 'var(--gold)' : ''; b.title = axisVoiceOn ? 'Spoken replies ON' : 'Toggle spoken replies'; }
  }
}
function axisVoiceToggle() {
  axisVoiceOn = !axisVoiceOn;
  axisSyncVoiceBtn();
  if (axisVoiceOn) axisSpeak('Voice on. Ask me for a status update.');
  else if ('speechSynthesis' in window) { speechSynthesis.cancel(); if (document.documentElement.dataset.axisState === 'speaking') setAxisState('idle'); }
  toast('AXIS voice ' + (axisVoiceOn ? 'on' : 'off'));
}
// Push-to-talk, shared by the dock and the public panel (one mic at a time).
function axisMicToggle(micId = 'axisMic', inputId = 'axisInput', send = axisSend) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Mic needs Chrome or Edge'); return; }
  if (axisListening) { try { axisRec && axisRec.stop(); } catch {} return; }
  try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch {} // barge-in: talking over AXIS stops it
  const mic = $(micId);
  const restMic = () => { axisListening = false; if (mic) { mic.style.color = ''; mic.style.borderColor = ''; mic.textContent = '🎙'; } if (document.documentElement.dataset.axisState === 'listening') setAxisState('idle'); };
  axisRec = new SR(); axisRec.lang = 'en-CA'; axisRec.interimResults = false; axisRec.maxAlternatives = 1;
  axisRec.onstart = () => { axisListening = true; setAxisState('listening'); if (mic) { mic.style.color = 'var(--gold)'; mic.style.borderColor = 'var(--gold)'; mic.textContent = '⏺'; } };
  axisRec.onend = restMic;
  axisRec.onerror = () => { restMic(); toast('Mic error — check browser permission'); };
  axisRec.onresult = (ev) => { const t = ev.results && ev.results[0] && ev.results[0][0] && ev.results[0][0].transcript.trim(); if (t) { const i = $(inputId); if (i) i.value = t; send(); } };
  try { axisRec.start(); } catch { toast('Mic busy'); }
}
// Warm up the async voice list (Chrome loads voices lazily) + reflect the default-ON state on the button.
try { if (window.speechSynthesis) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); } } catch {}

// ── AXIS orb + state machine (R-series) ──────────────────────────────────────
// One SVG identity, mounted into every [data-orb] slot (fab, dock header, strip, public panel).
// Ported from the design-handoff AnimatedGlobe contract: hairline lat/long ellipses, stronger
// equator, radial gold core, glowing A. Motion lives in CSS, keyed off :root[data-axis-state].
let __orbN = 0;
const orbSVG = (uid) => '<svg viewBox="0 0 60 60" aria-hidden="true">'
  + '<defs><radialGradient id="' + uid + '" cx="0.5" cy="0.42" r="0.62">'
  + '<stop offset="0%" stop-color="var(--gold-2)" stop-opacity=".8"/>'
  + '<stop offset="55%" stop-color="var(--gold)" stop-opacity=".28"/>'
  + '<stop offset="100%" stop-color="var(--gold)" stop-opacity="0"/></radialGradient></defs>'
  + '<circle cx="30" cy="30" r="28" fill="none" stroke="var(--gold)" stroke-width=".5" stroke-dasharray="1.5 4" opacity=".5"/>'
  + '<g class="orb-spin">'
  + '<ellipse cx="30" cy="30" rx="26" ry="9" fill="none" stroke="var(--gold)" stroke-width=".55" opacity=".5"/>'
  + '<ellipse cx="30" cy="30" rx="26" ry="17" fill="none" stroke="var(--gold)" stroke-width=".35" opacity=".28"/>'
  + '</g><g class="orb-spin-rev">'
  + '<ellipse cx="30" cy="30" rx="9" ry="26" fill="none" stroke="var(--gold)" stroke-width=".4" opacity=".34"/>'
  + '<ellipse cx="30" cy="30" rx="17" ry="26" fill="none" stroke="var(--gold)" stroke-width=".3" opacity=".2"/>'
  + '</g>'
  + '<circle class="orb-pulse" cx="30" cy="30" r="20" fill="none" stroke="var(--gold)" stroke-width=".9"/>'
  + '<circle class="orb-core" cx="30" cy="30" r="17" fill="url(#' + uid + ')"/>'
  + '<text x="30" y="35.5" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="15" font-weight="650" fill="var(--gold)">A</text></svg>';
function mountOrbs(scope = document) {
  scope.querySelectorAll('[data-orb]:not([data-orb-live])').forEach(n => {
    n.setAttribute('data-orb-live', '1'); n.innerHTML = orbSVG('axisOrbFade' + (++__orbN)); // unique gradient id per mount
  });
}
// idle | listening | thinking | speaking — drives every orb + the aria-live state words.
function setAxisState(s) {
  document.documentElement.dataset.axisState = s;
  document.querySelectorAll('[data-axis-state-word]').forEach(w => { w.textContent = s; });
  const w = $('axisStateWord'); if (w) w.textContent = s;
  const p = $('axisPubState'); if (p) p.textContent = s;
}

// ── AXIS command strip (R3) — Overview, above everything ──
function askAxis(text) {
  if ($('axisDock').hidden) openDock();
  const inp = $('axisInput'); inp.value = text; axisSend();
}
function axisStrip(k) {
  // Honest counts only — straight from the snapshot KPIs the cards below already show.
  const n1 = k.awaiting_approval ?? 0, n2 = k.messages_waiting ?? 0, n3 = k.followups_due ?? 0;
  const bits = [];
  if (n1) bits.push(n1 + (n1 === 1 ? ' approval' : ' approvals') + ' waiting');
  if (n2) bits.push(n2 + (n2 === 1 ? ' client reply' : ' client replies') + ' waiting');
  if (n3) bits.push(n3 + (n3 === 1 ? ' follow-up' : ' follow-ups') + ' due');
  const line = bits.length ? bits.join(' · ') : 'All quiet. AXIS is watching.';
  const input = el('input', { placeholder: 'Tell AXIS…', 'aria-label': 'Tell AXIS', autocomplete: 'off' });
  // The 15s snapshot tick re-renders Overview; a draft mid-sentence must survive it (gate-review finding).
  input.value = state.ui.stripDraft || '';
  input.addEventListener('input', () => { state.ui.stripDraft = input.value; });
  input.addEventListener('focus', () => { state.ui.stripFocus = true; });
  input.addEventListener('blur', () => { state.ui.stripFocus = false; });
  if (state.ui.stripFocus) requestAnimationFrame(() => { input.focus(); const n = input.value.length; try { input.setSelectionRange(n, n); } catch {} });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.trim()) { const t = input.value.trim(); input.value = ''; state.ui.stripDraft = ''; askAxis(t); } });
  const chips = [['Status', 'status'], ['Needs me', 'what needs me now'], ['Next', 'what is next'], ['Approvals', 'approvals']]
    .map(([lbl, q]) => el('button', { class: 'chip', onclick: () => askAxis(q) }, lbl));
  const s = el('section', { class: 'axis-strip', 'aria-label': 'AXIS command strip' }, [
    el('span', { class: 'axis-orb', 'data-orb': '' }),
    el('div', {}, [el('div', { class: 'eyebrow', style: 'color:var(--gold)' }, 'AXIS · Director'),
      el('div', { class: 'axis-strip-status' }, line)]),
    input, ...chips]);
  mountOrbs(s);
  return s;
}

// ── Public AXIS (R4, pre-auth) ────────────────────────────────────────────────
// Deterministic + $0: answers come ONLY from the emitter-guaranteed HEADLINE-ONLY public feed
// (/.well-known/axis/status.json) plus canned strings. Never authed endpoints, never prospect
// data, never counts from private state. axis-director stays fully JWT-gated (P1a) — an unauthed
// LLM branch would let anonymous callers burn the API key, so public mode is served client-side.
let __pubFeed = null;
async function pubFeed() {
  if (__pubFeed) return __pubFeed;
  try { const r = await fetch('/.well-known/axis/status.json', { cache: 'no-store' }); if (r.ok) __pubFeed = await r.json(); } catch {}
  return __pubFeed;
}
const PUB_SIGNIN = ' Sign in for the director view.';
async function pubAnswer(q) {
  const s = String(q).toLowerCase();
  if (/help|what can|how do/.test(s)) return 'Public mode. I can share the general program status only — try "status" or "next". Approvals, pipeline, and the fleet are behind sign-in.';
  const f = await pubFeed();
  if (/next|milestone|plan|roadmap|coming|ready/.test(s))
    return f && (f.milestone || f.readiness) ? [f.milestone, f.readiness].filter(Boolean).join(' ') + PUB_SIGNIN
      : 'The build is moving. I cannot reach the public status feed right now.' + PUB_SIGNIN;
  if (/status|live|now|state|running|revenue|up\b/.test(s))
    return f && f.headline ? f.headline + PUB_SIGNIN
      : 'Hub is live. The worker runs on schedule. All sending stays approval-gated.' + PUB_SIGNIN;
  return 'Public mode — I only share the general status here, never client or pipeline detail. Ask "status" or "next".' + PUB_SIGNIN;
}
async function pubAsk(q) {
  q = String(q || '').trim(); if (!q) return;
  const log = $('axisPubLog'); if (!log) return;
  log.hidden = false;
  log.append(el('div', { class: 'axis-msg user' }, q));
  setAxisState('thinking');
  const a = await pubAnswer(q);
  log.append(el('div', { class: 'axis-msg axis' }, a));
  log.scrollTop = log.scrollHeight;
  if (!axisSpeak(a)) setAxisState('idle');
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
  clearInterval(window.__axisPoll); window.__axisPoll = setInterval(() => { if (!document.hidden) pollVersion(); }, 15000);
  // R2 auto-open: AXIS greets once per authed session; a close is respected for the whole session.
  if (sessionStorage.getItem('axisDockDismissed') !== '1')
    setTimeout(() => { try { if ($('app').style.display !== 'none' && $('axisDock').hidden) openDock(); } catch {} }, 600);
}
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
function openDock() {
  // On the Director tab the dock would cover that screen's own command channel — send there instead.
  if (state.module === 'axis-agent-director') { const i = $('axisDirectorInput'); if (i) i.focus(); return; }
  $('axisDock').hidden = false; $('axisFab').hidden = true; renderDock(); $('axisInput').focus();
}
function closeDock() { $('axisDock').hidden = true; $('axisFab').hidden = false; try { sessionStorage.setItem('axisDockDismissed', '1'); } catch {} }
$('themeBtn').addEventListener('click', () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
applyTheme(localStorage.getItem('axis_theme') || 'dark');
$('loginBtn').addEventListener('click', doLogin);
$('pass').addEventListener('keydown', (e) => e.key === 'Enter' && doLogin());
$('logoutBtn').addEventListener('click', logout);
$('axisFab').addEventListener('click', openDock);
$('axisClose').addEventListener('click', closeDock);
$('axisSend').addEventListener('click', axisSend);
$('axisMic')?.addEventListener('click', () => axisMicToggle());
$('axisVoice')?.addEventListener('click', axisVoiceToggle);
// Public panel (pre-auth): same voice machinery, canned public-safe answers only.
const pubSubmit = () => { const i = $('axisPubInput'); const q = i.value; i.value = ''; pubAsk(q); };
$('axisPubSend')?.addEventListener('click', pubSubmit);
$('axisPubInput')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') pubSubmit(); });
$('axisPubMic')?.addEventListener('click', () => axisMicToggle('axisPubMic', 'axisPubInput', pubSubmit));
$('axisPubVoice')?.addEventListener('click', axisVoiceToggle);
document.querySelectorAll('[data-pub-q]').forEach(b => b.addEventListener('click', () => pubAsk(b.dataset.pubQ)));
mountOrbs();          // fill every static [data-orb] slot (fab, dock header, public panel)
setAxisState('idle'); // orb state machine baseline
axisSyncVoiceBtn(); // voice defaults ON — show it
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
