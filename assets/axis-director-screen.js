// axis-director-screen.js — S12 "AXIS Agent Director" (CC-BRIEF §2E). The director's own room:
// hero presence · voice/text command channel · CRITICAL-ONLY approvals · sub-agent command board ·
// platform self-heal. The voice machinery is NOT reimplemented here — axis-app.js owns it and hands
// it in as ctx.voice (send/micToggle/voiceToggle/mountOrbs/setState/renderLog/voiceOn), including the
// one orb SVG. Every number on this screen comes from the snapshot; nothing is computed or padded.
import { el, ago, fmtMoney, toast, head } from './axis-dom.js';
import { renderFiguresHTML, claimRows, staleCount, ensureFigureStyles } from './axis-claim-figures.js';

// Element ids axis-app.js already knows about: renderDock() fills #axisDirectorLog, axisSyncVoiceBtn()
// styles #axisDirectorVoice, and axisSend()/axisMicToggle() read #axisDirectorInput. Keep them exact.
const LOG_ID = 'axisDirectorLog', INPUT_ID = 'axisDirectorInput', MIC_ID = 'axisDirectorMic', VOICE_ID = 'axisDirectorVoice';

// Which agent owns which surface. Names are the real roster (assets/axis-roster.json) — an issue with
// no owner is a complaint, not a work item, so every check below names one of these.
const OWNER = {
  inbox: 'Sentry',        // axis-sentry-inbox-monitor — polls Gmail, classifies
  approvals: 'Herald',    // golive-pending-reminder — watches the queued/approval surface
  fleet: 'Dispatch',      // axis-247-dispatcher — assigns idle agents work
  runs: 'Scout',          // bay-monitor-autopilot — cross-agent status
  worker: 'Ops',          // ops-agent-morning-prep — health check
  research: 'Cartographer',
};

const REQUIRED_MODULES = ['overview', 'approvals', 'fleet', 'settings', 'inbox', 'analytics'];
const ACTIONABLE = ['reply_to_outreach', 'new_inbound_request'];
const DAY = 86400000;

// Timestamps arrive as epoch-ms (SQLite integer) or ISO strings depending on the table. Normalize once.
const ms = (t) => (typeof t === 'number' ? t : t ? Date.parse(t) : NaN);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// The snapshot is produced by the worker and can arrive partial or malformed (a module published as an
// object where the UI expects a list, a poll that raced a schema change). `|| []` does not protect
// against that — `{}.filter` throws and takes the whole screen down mid-paint. Every list read below
// goes through this instead, so detectIssues stays total over junk input.
const arr = (v) => (Array.isArray(v) ? v : []);

// ─────────────────────────────────────────────────────────────────────────────
// detectIssues — PURE. No DOM, no fetch, no other tab's markup: it reads the same snapshot the
// screens render and reports only contradictions it can actually prove. Healthy input → [].
// `now` is injectable so this is deterministic under test.
// ─────────────────────────────────────────────────────────────────────────────
export function detectIssues(data, now = Date.now()) {
  const d = data || {};
  const out = [];
  const push = (area, severity, detail, agent) => out.push({ area, severity, detail, agent });

  // 1) A module the worker promises but did not publish. An empty object is the same failure as absent.
  for (const m of REQUIRED_MODULES) {
    const mod = d[m];
    if (!mod || typeof mod !== 'object' || !Object.keys(mod).length) {
      push('Snapshot', 'error', `Snapshot module "${m}" arrived missing or empty — the worker did not publish it, so that tab renders nothing.`, OWNER.worker);
    }
  }

  // 2) Worker tick staleness. Only checked when a tick is actually supplied — a caller that omits it
  // must not be reported as a dead worker.
  const tickMs = ms(d.tick || (d.version && d.version.tick));
  if (Number.isFinite(tickMs)) {
    const mins = Math.floor((now - tickMs) / 60000);
    if (mins > 30) push('Snapshot', mins > 180 ? 'error' : 'warn', `Last worker tick was ${mins} minutes ago. Snapshots are not refreshing, so every number on screen is at least that old.`, OWNER.worker);
  }

  // 3) Gmail. Sentry cannot read a mailbox it is not connected to; the Action Inbox silently freezes.
  const integrations = arr(d.settings && d.settings.integrations);
  const gmail = integrations.find((i) => i && i.name === 'Gmail');
  if (gmail && gmail.status !== 'ok') {
    push('Integrations', gmail.status === 'error' ? 'error' : 'warn', `Gmail integration reports "${gmail.status}"${gmail.detail ? ' — ' + gmail.detail : ''}. Inbox classification and every send stay frozen until it is ok.`, OWNER.inbox);
  }

  // 4) Approvals rotting in the queue.
  const aRows = arr(d.approvals && d.approvals.rows);
  const pendingRows = aRows.filter((r) => r && r.status === 'pending');
  const stale = pendingRows.filter((r) => { const t = ms(r.created_at); return Number.isFinite(t) && now - t > 7 * DAY; });
  if (stale.length) {
    // reduce, not Math.max(...spread): the spread blows the call stack past ~125k rows and would take
    // the whole director screen with it. A worker bug that floods the table must not brick the console.
    const oldest = stale.reduce((mx, r) => Math.max(mx, Math.floor((now - ms(r.created_at)) / DAY)), 0);
    push('Approvals', 'warn', `${plural(stale.length, 'approval has', 'approvals have')} been pending more than 7 days (oldest ${oldest} days). Outreach that stale is no longer timely.`, OWNER.approvals);
  }

  // 5) Criticality stamping. The UI filters on `criticality`; if the worker never stamped it, the
  // director's queue is empty for the wrong reason and everything quietly sits in Approvals instead.
  if (aRows.length && aRows.every((r) => r && r.criticality == null)) {
    push('Approvals', 'warn', `None of the ${aRows.length} approval rows carry a criticality stamp, so nothing can reach the director's queue. axis-criticality.mjs is not running over this table.`, OWNER.approvals);
  }

  // 6) Inbox counts vs the rows they claim to summarize.
  const inbox = d.inbox || {};
  const iRows = arr(inbox.rows);
  const counts = inbox.counts || {};
  const realReplies = iRows.filter((m) => m && m.classification === 'reply_to_outreach').length;
  if (iRows.length && counts.replies != null && counts.replies !== realReplies) {
    push('Action Inbox', 'error', `Inbox counts report ${counts.replies} replies but ${realReplies} row(s) actually carry classification "reply_to_outreach". The badge and the list disagree.`, OWNER.inbox);
  }
  // Known classifier defect (B1): a subject that opens "RE:" is a reply to something we sent.
  const misfiled = iRows.filter((m) => m && /^\s*re\s*:/i.test(m.subject || '') && m.classification && m.classification !== 'reply_to_outreach');
  if (misfiled.length) {
    push('Action Inbox', 'warn', `${plural(misfiled.length, 'message opens', 'messages open')} with "RE:" but ${misfiled.length === 1 ? 'is' : 'are'} not classified as a reply to outreach. Real replies are being filed as something else.`, OWNER.inbox);
  }

  // 7) Overview KPIs are a rollup of the other modules — if they disagree, the deck is lying.
  const kpis = (d.overview && d.overview.kpis) || {};
  const pending = d.approvals && d.approvals.pending;
  if (aRows.length && pending != null && pending !== pendingRows.length) {
    push('Approvals', 'error', `Approvals snapshot says ${pending} pending but ${pendingRows.length} row(s) have status "pending".`, OWNER.approvals);
  }
  if (pending != null && kpis.awaiting_approval != null && kpis.awaiting_approval !== pending) {
    push('Overview', 'error', `Overview shows ${kpis.awaiting_approval} awaiting approval; the approvals module says ${pending}.`, OWNER.worker);
  }
  const openActionable = iRows.filter((m) => m && ACTIONABLE.includes(m.classification) && !m.actioned && !m.snoozed_until).length;
  if (iRows.length && kpis.messages_waiting != null && kpis.messages_waiting !== openActionable) {
    push('Overview', 'warn', `Overview shows ${kpis.messages_waiting} client messages waiting; the inbox holds ${openActionable} open actionable row(s).`, OWNER.worker);
  }
  const salesReplies = ((d.analytics && d.analytics.sales) || {}).replies;
  if (iRows.length && salesReplies != null && salesReplies !== realReplies) {
    push('Analytics', 'warn', `Analytics counts ${salesReplies} replies; the inbox holds ${realReplies}. The two dashboards will not reconcile.`, OWNER.worker);
  }

  // 8) The floor itself.
  const fleet = d.fleet || {};
  const agents = arr(fleet.agents);
  if (Object.keys(fleet).length && !agents.length) {
    push('Fleet', 'warn', 'No agent has written a run record, so there is no evidence any of them ran. The floor cannot be verified as working.', OWNER.fleet);
  }
  agents.filter((a) => a && (a.status === 'fail' || a.status === 'error')).forEach((a) => {
    push('Fleet', 'error', `Agent ${a.agent} last finished with status "${a.status}"${a.error ? ' — ' + a.error : a.summary ? ' — ' + a.summary : ''}.`, a.agent);
  });
  const fail24 = (fleet.counts || {}).fail_24h;
  if (fail24 > 0) push('Fleet', 'warn', `${plural(fail24, 'agent run', 'agent runs')} failed in the last 24 hours.`, OWNER.runs);

  // 9) Sending rails. An empty suppression list with live outbound means declines and hard bounces
  // are contactable again — that is the expensive kind of quiet failure.
  const settings = d.settings || {};
  if (Object.keys(settings).length && settings.suppression_count === 0 && pendingRows.length > 0) {
    push('Safety rails', 'warn', `${plural(pendingRows.length, 'item is', 'items are')} queued to send while the suppression list holds 0 entries. Declines and hard bounces would be contacted again.`, OWNER.approvals);
  }

  // Errors first — the director should read the worst thing on the platform in the first line.
  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

// Survives repaints: the 15s snapshot tick re-renders the screen and a half-typed command or
// instruction must not evaporate mid-sentence (same defect the Overview strip fixed).
const ui = { cmd: '', instruct: {}, showBelow: false };

const REASON = {
  cost: 'Spends money, or commits to spending it.',
  reputation: 'Leaves the building under the company name, or names a third party.',
};

// Shared head(), just with this screen's rhythm as the default spacing.
const sectionHead = (title, eyebrow, style) => head(title, eyebrow, style || 'margin:26px 0 12px');

// One line of honest situation report, assembled only from KPIs that are actually present.
function situationLine(data, criticalCount) {
  const k = (data.overview && data.overview.kpis) || {};
  const bits = [];
  if (criticalCount) bits.push(plural(criticalCount, 'decision needs', 'decisions need') + ' your judgement');
  if (k.messages_waiting) bits.push(plural(k.messages_waiting, 'client reply', 'client replies') + ' waiting');
  if (k.followups_due) bits.push(plural(k.followups_due, 'follow-up', 'follow-ups') + ' due');
  if (k.meetings_week) bits.push(plural(k.meetings_week, 'meeting', 'meetings') + ' this week');
  if (!bits.length) return 'All quiet. Nothing waiting.';
  return bits.join(' · ') + '.';
}

function heroSection(data, criticalCount) {
  const k = (data.overview && data.overview.kpis) || {};
  const stateWord = document.documentElement.dataset.axisState || 'idle';
  const orb = el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:9px;flex:none' }, [
    el('span', { class: 'axis-orb axis-orb-director', 'data-orb': '' }),
    el('span', { class: 'axis-state-word', 'data-axis-state-word': '' }, stateWord),
  ]);
  const copy = el('div', { style: 'flex:1;min-width:220px' }, [
    el('div', { class: 'eyebrow', style: 'color:var(--gold)' }, 'AXIS · Director'),
    el('h1', { style: 'margin:6px 0 0;font-size:30px;line-height:1.1;font-weight:650;letter-spacing:-.01em' }, 'Agent Director'),
    el('div', { style: 'margin-top:10px;color:var(--txt-2);font-size:14px' }, situationLine(data, criticalCount)),
  ]);
  // Every tile is a snapshot KPI verbatim. Zero renders as zero — and *absent* renders as an em dash,
  // not as zero: substituting 0 for a KPI the worker never published would assert a fact we do not have
  // (fmtMoney already does this — null → '—', 0 → '$0'). Same rule statusBand() uses for the tick.
  const tiles = [
    ['Needs your judgement', criticalCount],
    ['Client replies waiting', k.messages_waiting ?? '—'],
    ['Follow-ups due', k.followups_due ?? '—'],
    ['Meetings this week', k.meetings_week ?? '—'],
    ['Pipeline value', fmtMoney(k.pipeline_value)],
  ];
  const rail = el('div', { class: 'kpi-grid', style: 'margin-top:18px' }, tiles.map(([label, v]) =>
    el('div', { class: 'kpi' }, [el('div', { class: 'label' }, label), el('div', { class: 'value' }, v)])));
  // assessed_value is a pre-contact research estimate, NOT pipeline. It only ever renders with its basis.
  // CONTRACTS §2 lists it under overview.kpis, but computeSnapshots() (scripts/lib/axis-snapshots.mjs:237)
  // only ever writes it to analytics.insights — reading kpis alone made this tile permanently dead.
  const insights = (data.analytics && data.analytics.insights) || {};
  const basis = insights.assessed_basis;
  const assessed = k.assessed_value ?? insights.assessed_value;
  if (assessed != null) {
    rail.append(el('div', { class: 'kpi' }, [
      el('div', { class: 'label' }, 'Assessed value (estimate)'),
      el('div', { class: 'value' }, fmtMoney(assessed)),
      el('div', { class: 'delta' }, basis || 'pre-contact research estimate — not pipeline'),
    ]));
  }
  return el('section', { 'aria-label': 'AXIS status', style: 'border:1px solid var(--line-2);border-radius:14px;padding:26px 28px;background:color-mix(in srgb, var(--surface) 88%, transparent);box-shadow:0 24px 70px -46px #000' }, [
    el('div', { style: 'display:flex;align-items:center;gap:24px;flex-wrap:wrap' }, [orb, copy]),
    rail,
    statusBand(data, criticalCount),
  ]);
}

// The three facts the director asks for before anything else. Preserved from the v1 director screen;
// each reads straight from the snapshot and says so plainly when the snapshot does not carry it.
function statusBand(data, criticalCount) {
  const k = (data.overview && data.overview.kpis) || {};
  const gmail = arr(data.settings && data.settings.integrations).find((i) => i && i.name === 'Gmail');
  const tickMs = ms(data.tick || (data.version && data.version.tick));
  const items = [
    ['Mailbox sync', gmail ? (gmail.status === 'ok' ? gmail.detail || 'ok' : `${gmail.status} — ${gmail.detail || 'no detail'}`) : 'Not listed in integrations'],
    ['Approval queue', `${k.awaiting_approval == null ? 'count not reported' : plural(k.awaiting_approval, 'item', 'items') + ' waiting'} · ${criticalCount} critical`],
    ['Worker tick', Number.isFinite(tickMs) ? `${new Date(tickMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${ago(tickMs)} ago` : 'Not reported to this screen'],
  ];
  return el('div', { class: 'axis-director-status', style: 'margin:20px -28px -26px;border-top:1px solid var(--line);border-bottom:0' },
    items.map(([label, value]) => el('div', { class: 'axis-director-status-item' }, [el('span', {}, label), el('strong', {}, value)])));
}

function channelSection(voice) {
  const input = el('input', {
    id: INPUT_ID, placeholder: 'Tell AXIS…', autocomplete: 'off', 'aria-label': 'Command AXIS',
    onkeydown: (e) => { if (e.key === 'Enter') submit(); },
    oninput: (e) => { ui.cmd = e.target.value; },
  });
  input.value = ui.cmd;
  const submit = () => { if (!input.value.trim()) return; ui.cmd = ''; voice.send && voice.send(INPUT_ID); };
  const ask = (prompt) => { input.value = prompt; ui.cmd = ''; voice.send && voice.send(INPUT_ID); };

  const compose = el('div', { class: 'axis-director-compose', style: 'width:100%;margin:0' }, [
    input,
    el('button', { class: 'iconbtn axis-director-control', id: MIC_ID, title: 'Push to talk', 'aria-label': 'Push to talk',
      onclick: () => voice.micToggle && voice.micToggle(MIC_ID, INPUT_ID, () => voice.send && voice.send(INPUT_ID)) }, '🎙'),
    el('button', { class: 'iconbtn axis-director-control', id: VOICE_ID, title: 'Toggle spoken replies', 'aria-label': 'Toggle spoken replies',
      'aria-pressed': voice.voiceOn ? 'true' : 'false', onclick: () => voice.voiceToggle && voice.voiceToggle() }, '🔊'),
    el('button', { class: 'axis-director-send', title: 'Send to AXIS', 'aria-label': 'Send to AXIS', onclick: submit }, 'Send'),
  ]);
  const chips = [
    ['Status', 'Give me the current operational status.'],
    ['Needs me', 'What needs my judgement right now?'],
    ['Approvals', 'Summarize what is awaiting approval.'],
    ['Fleet', 'How is the agent fleet doing?'],
    ['Health', 'What is broken across the platform?'],
  ].map(([label, prompt]) => el('button', { class: 'chip', onclick: () => ask(prompt) }, label));

  return el('section', { class: 'card', 'aria-label': 'AXIS command channel', style: 'padding:0;overflow:hidden' }, [
    el('div', { class: 'axis-log', id: LOG_ID, 'aria-live': 'polite', style: 'max-height:34vh;min-height:150px' }),
    el('div', { style: 'padding:10px 12px;border-top:1px solid var(--line)' }, [compose]),
    el('div', { style: 'display:flex;gap:7px;flex-wrap:wrap;padding:0 12px 12px' }, chips),
  ]);
}

// ── Critical approvals ──────────────────────────────────────────────────────
// The rail read-out the composer footer shows. It is DISPLAY plumbing only — every value is copied
// verbatim out of the settings snapshot, nothing here is computed, defaulted or guessed. When the
// worker has not published rail_state we hand over null so the composer says "not published" rather
// than implying rails it cannot see are green.
function railsFrom(data) {
  const s = data.settings || {};
  const rs = s.rail_state;
  if (!rs || typeof rs !== 'object') return null;
  const out = { ...rs };
  if (Array.isArray(rs.suppressed)) out.suppression = rs.suppressed; // snapshot key → composer key
  if (s.suppression_count != null) out.suppression_count = s.suppression_count;
  return out;
}

function approvalCard(r, paint, onIntent, openComposer, rails) {
  const reason = REASON[r.critical_reason] || (r.critical_reason ? `Flagged: ${r.critical_reason}` : 'Flagged critical — no reason recorded.');
  // Optimistic write + rollback (contract §3): mutate, repaint, then confirm with the worker.
  const decide = async (kind) => {
    const before = r.status;
    r.status = kind === 'approve' ? 'approved' : 'rejected';
    paint();
    toast(kind === 'approve' ? 'Approved' : 'Rejected');
    const ok = await onIntent(kind, { item_id: r.id });
    if (!ok) { r.status = before; paint(); toast('Worker did not confirm — restored to ' + before); }
  };
  const body = (r.body || '').trim();
  // "Open in composer" is a UI action, not a worker write. It opens assets/axis-composer.js OVER this
  // screen (ctx.openComposer, handed in by axis-app.js) — no go(), no state.module, zero navigation.
  // It is NOT an intent: there is no `open_composer` type in CONTRACTS §3 or in axis-intent.mjs
  // KNOWN_TYPES, so posting one would queue an unexecutable record (and ship the recipient + full
  // message body to the queue) while opening nothing. The composer posts compose_send/compose_draft.
  const compose = openComposer && (() => openComposer({
    mode: 'outreach',                 // an approvals row is outbound under the company name
    to: r.to_email,
    subject: r.subject,
    body: r.body,                     // the worker's bytes, verbatim — the browser never writes copy
    businessId: r.business_id,
    messageId: r.id,
    templateId: r.template_id,
    consentBasis: r.consent_basis,
    consentEvidence: r.consent_evidence,
    rails,
    onSent: () => { r.status = 'sent'; paint(); }, // fires only after the worker confirmed the intent
  }));
  return el('div', { class: 'appr', style: 'border-color:color-mix(in srgb, var(--gold) 34%, var(--line))' }, [
    el('div', { class: 'appr-head', style: 'cursor:default;align-items:flex-start' }, [
      el('span', { class: 'stage-tag', style: 'color:var(--gold);border-color:var(--gold);flex:none;margin-top:2px' }, (r.critical_reason || 'critical').toUpperCase()),
      el('div', { style: 'flex:1;min-width:0' }, [
        el('div', { style: 'font-weight:600' }, r.subject || '(no subject)'),
        el('div', { style: 'font-size:12px;color:var(--txt-3);margin-top:3px' }, [(r.channel || 'email'), ' · ', r.to_email || 'no recipient on file']),
        el('div', { style: 'font-size:12px;color:var(--txt-2);margin-top:7px' }, reason),
      ]),
      el('span', { class: 'mono', style: 'font-size:10px;color:var(--txt-3);flex:none' }, ago(ms(r.created_at)) || ''),
    ]),
    el('div', { class: 'appr-body' }, [
      body
        ? el('div', { style: 'padding:12px 0;color:var(--txt-2);font-size:12.5px;white-space:pre-line;max-height:120px;overflow:hidden' }, body.slice(0, 420))
        : el('div', { class: 'unknown', style: 'padding:12px 0' }, 'No body on the record — open the composer to read the exact bytes.'),
      el('div', { class: 'appr-actions' }, [
        el('button', { class: 'chip', style: 'border-color:var(--ok);color:var(--ok)', onclick: () => decide('approve') }, 'Approve'),
        el('button', { class: 'chip', style: 'border-color:var(--crit);color:var(--crit)', onclick: () => decide('reject') }, 'Reject'),
        compose ? el('button', { class: 'chip', onclick: compose }, 'Open in composer') : null,
      ]),
    ]),
  ]);
}

function approvalsSection(data, paint, onIntent, openComposer) {
  const rails = railsFrom(data);
  const rows = arr(data.approvals && data.approvals.rows);
  const critical = rows.filter((r) => r && r.criticality === 'critical');
  const open = critical.filter((r) => !r.status || r.status === 'pending');
  const decided = critical.length - open.length;
  const below = rows.filter((r) => r && r.criticality && r.criticality !== 'critical');
  const unstamped = rows.filter((r) => r && r.criticality == null);

  const wrap = el('section', { 'aria-label': 'Critical approvals' }, [
    sectionHead('Critical approvals', 'cost or reputation only'),
    el('div', { class: 'card', style: 'border-color:var(--gold);background:var(--gold-dim);padding:11px 14px;font-size:12.5px;margin-bottom:12px' },
      ['The bar: only items that ', el('b', {}, 'spend money'), ' or ', el('b', {}, 'leave the building under the company name'),
        ' reach you here. Everything below that bar auto-proceeds and is logged.']),
  ]);

  if (open.length) open.forEach((r) => wrap.append(approvalCard(r, paint, onIntent, openComposer, rails)));
  else {
    wrap.append(el('div', { class: 'card', style: 'text-align:center;padding:34px 20px;border-color:color-mix(in srgb, var(--ok) 30%, var(--line))' }, [
      el('div', { style: 'font-size:15px;font-weight:600;color:var(--ok)' }, 'Nothing needs your judgement right now'),
      el('div', { style: 'margin-top:7px;color:var(--txt-2);font-size:12.5px' }, 'No cost or reputation decision is waiting. This is the state the system is supposed to be in.'),
    ]));
  }
  if (decided) wrap.append(el('div', { class: 'eyebrow', style: 'margin-top:10px' }, `${plural(decided, 'critical item', 'critical items')} already decided`));

  // Never hide the remainder — report the count and let it be opened.
  const belowLine = el('details', { class: 'filtered-drawer', style: 'margin-top:14px' });
  belowLine.append(el('summary', {}, `▸ Below the bar (${below.length}) — auto-proceeds, logged, not routed to you`));
  if (!below.length) belowLine.append(el('div', { class: 'empty', style: 'padding:18px' }, 'Nothing has been classified below the bar.'));
  else below.forEach((r) => belowLine.append(el('div', { class: 'row' }, [
    el('span', { class: 'stage-tag' }, r.status || 'pending'),
    el('div', { style: 'flex:1;min-width:0' }, r.subject || '(no subject)'),
    el('span', { class: 'mono', style: 'font-size:10px;color:var(--txt-3)' }, ago(ms(r.created_at)) || ''),
  ])));
  wrap.append(belowLine);

  if (unstamped.length) {
    wrap.append(el('div', { class: 'sysnote', style: 'margin-top:12px' },
      `${plural(unstamped.length, 'approval row carries', 'approval rows carry')} no criticality stamp yet, so ${unstamped.length === 1 ? 'it is' : 'they are'} neither shown here nor counted as auto-proceeded. They are still in the Approvals tab.`));
  }
  return wrap;
}

// ── Sub-agent command board ─────────────────────────────────────────────────
function agentRow(a, onIntent) {
  const name = a.agent || 'unnamed';
  const last = ms(a.last_run_at || a.finished_at || a.started_at);
  const dot = a.status === 'ok' ? 'dot-ok' : a.status === 'fail' || a.status === 'error' ? 'dot-crit' : 'dot-warn';
  const input = el('input', {
    class: 'search', style: 'flex:1;min-width:150px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:6px 10px;color:var(--txt);font:inherit;font-size:12px',
    placeholder: `Tell ${name} to…`, 'aria-label': `Instruct ${name}`,
    oninput: (e) => { ui.instruct[name] = e.target.value; },
    onkeydown: (e) => { if (e.key === 'Enter') send(); },
  });
  input.value = ui.instruct[name] || '';
  const send = async () => {
    const instruction = input.value.trim();
    if (!instruction) return;
    input.value = ''; delete ui.instruct[name];
    toast(`Instruction queued for ${name}`);
    const ok = await onIntent('instruct', { agent: name, instruction });
    if (!ok) { ui.instruct[name] = instruction; input.value = instruction; toast('Worker did not accept the instruction — text restored'); }
  };
  return el('div', { class: 'row', style: 'flex-wrap:wrap' }, [
    el('span', { class: 'dot ' + dot, title: a.status || 'unknown' }),
    el('div', { style: 'width:150px;min-width:110px' }, [
      el('div', { style: 'font-weight:600' }, name),
      el('div', { style: 'font-size:11px;color:var(--txt-3)' }, a.role || a.current_task || '—'),
    ]),
    el('div', { style: 'flex:1;min-width:140px;font-size:12px;color:var(--txt-2);overflow:hidden;text-overflow:ellipsis' },
      a.summary || a.current_task || el('span', { class: 'unknown' }, 'No run summary on file')),
    el('span', { class: 'mono', style: 'font-size:10px;color:var(--txt-3);width:52px;text-align:right' }, Number.isFinite(last) ? ago(last) : '—'),
    input,
    el('button', { class: 'chip', style: 'border-color:var(--gold);color:var(--gold)', onclick: send }, 'Send'),
  ]);
}

function fleetSection(data, onIntent) {
  const fleet = data.fleet || {};
  const agents = arr(fleet.agents);
  const counts = fleet.counts || {};
  const sub = agents.length
    ? `${agents.length} reporting${counts.ok_24h != null ? ` · ${counts.ok_24h} ok / ${counts.fail_24h ?? 0} failed in 24h` : ''}`
    : 'no agent has reported';
  const card = el('div', { class: 'card', style: 'padding:0' });
  if (!agents.length) {
    card.append(el('div', { class: 'empty' }, 'No agent has written a run record yet, so there is no roster to command. The board fills the moment the fleet logs its first run.'));
  } else {
    agents.forEach((a) => card.append(agentRow(a, onIntent)));
  }
  return el('section', { 'aria-label': 'Sub-agent command board' }, [sectionHead('Sub-agent command board', sub), card]);
}

// Contract §6: everything below the criticality bar auto-proceeds and is "reported after the fact in
// the activity log". This is that report — the worker's own fleet log, newest first, nothing added.
function activitySection(data) {
  const log = arr((data.fleet || {}).log).slice();
  log.sort((a, b) => (ms(b && b.ts) || 0) - (ms(a && a.ts) || 0));
  const shown = log.slice(0, 12);
  const card = el('div', { class: 'card', style: 'padding:0' });
  if (!shown.length) {
    card.append(el('div', { class: 'empty' }, 'Nothing logged yet. Work that proceeds without asking you is reported here after the fact.'));
  } else {
    shown.forEach((e) => {
      const level = String(e.level || 'info').toLowerCase();
      const colour = level === 'error' ? 'var(--crit)' : level === 'warn' ? 'var(--warn)' : 'var(--txt-3)';
      card.append(el('div', { class: 'row' }, [
        el('span', { class: 'mono', style: 'font-size:10px;color:var(--txt-3);width:44px;flex:none;text-align:right' }, ago(ms(e.ts)) || '—'),
        el('span', { class: 'stage-tag', style: `color:${colour}` }, e.agent || level),
        el('div', { style: 'flex:1;min-width:0;font-size:12.5px;color:var(--txt-2)' }, e.msg || '—'),
      ]));
    });
  }
  const more = log.length - shown.length;
  return el('section', { 'aria-label': 'Activity log' }, [
    sectionHead('Auto-proceeded activity', more > 0 ? `latest ${shown.length} of ${log.length}` : `${plural(log.length, 'entry', 'entries')} on record`),
    card,
  ]);
}

// ── Platform health / self-heal ─────────────────────────────────────────────
function healthSection(data, onIntent) {
  const issues = detectIssues(data);
  const card = el('div', { class: 'card', style: 'padding:0' });
  if (!issues.length) {
    card.append(el('div', { class: 'empty', style: 'color:var(--txt-2)' }, [
      el('div', { style: 'color:var(--ok);font-weight:600;font-size:14px' }, 'Nothing detected'),
      el('div', { style: 'margin-top:6px;font-size:12.5px' }, 'Every module AXIS can see reported, and the counts reconcile.'),
    ]));
  } else {
    issues.forEach((iss) => {
      const colour = iss.severity === 'error' ? 'var(--crit)' : 'var(--warn)';
      const file = async (btn) => {
        btn.disabled = true; btn.textContent = 'Filed';
        toast(`Filed to ${iss.agent}`);
        const ok = await onIntent('issue_file', { area: iss.area, severity: iss.severity, detail: iss.detail, agent: iss.agent });
        if (!ok) { btn.disabled = false; btn.textContent = `File to ${iss.agent}`; toast('Worker did not accept the filing'); }
      };
      const btn = el('button', { class: 'chip', onclick: (e) => file(e.currentTarget) }, `File to ${iss.agent}`);
      card.append(el('div', { class: 'row', style: 'align-items:flex-start;flex-wrap:wrap' }, [
        el('span', { class: 'dot', style: `background:${colour};margin-top:5px` }),
        el('div', { style: 'width:110px;min-width:90px' }, [
          el('div', { style: 'font-weight:600;font-size:12.5px' }, iss.area),
          el('div', { class: 'mono', style: `font-size:9.5px;text-transform:uppercase;letter-spacing:.14em;color:${colour}` }, iss.severity),
        ]),
        el('div', { style: 'flex:1;min-width:200px;font-size:12.5px;color:var(--txt-2)' }, iss.detail),
        btn,
      ]));
    });
  }
  const n = issues.length;
  return el('section', { 'aria-label': 'Platform health' }, [
    sectionHead('Platform health', n ? `${plural(n, 'issue', 'issues')} detected · self-heal by filing to the owner` : 'all clear'),
    card,
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN-AM / AM2 — the program figures, each one showing the age of the read behind it.
//
// This is the section that ends the split where staleness was enforced in a JSON file nobody opens
// while the operator read bare numbers on screen. `data.program_status` is the authed
// /api/axis-status payload; absent, the section says so instead of rendering an empty card that
// looks like "no figures" rather than "not loaded".
//
// Exported so a test can assert the row set directly without a DOM.
export function programFigures(data, now) {
  const status = (data && data.program_status) || null;
  const claims = status && status.claims ? status.claims : null;
  return claimRows(claims, { now: now || new Date() });
}

function figuresSection(data, now) {
  const status = (data && data.program_status) || null;
  const claims = status && status.claims ? status.claims : null;
  const rows = claimRows(claims, { now: now || new Date() });
  const n = staleCount(rows);
  ensureFigureStyles();
  const card = el('div', { class: 'card' });
  card.innerHTML = claims
    ? renderFiguresHTML(claims, { now: now || new Date() })
    : '<div class="empty">Program figures not loaded. Nothing is being shown as current that has not been read.</div>';
  return el('section', { 'aria-label': 'Program figures' }, [
    sectionHead(
      'Program figures',
      rows.length
        ? (n ? `${plural(n, 'figure', 'figures')} past their freshness window` : `${plural(rows.length, 'figure', 'figures')} · all read within window`)
        : 'age of every reading',
    ),
    card,
  ]);
}

export function renderDirector(container, ctx) {
  const c = ctx || {};
  const data = c.data || {};
  const voice = c.voice || {};
  // onIntent may be sync or async; normalize so optimistic rollback always has something to await.
  const onIntent = (type, payload) => Promise.resolve(c.onIntent ? c.onIntent(type, payload) : false);
  // The ONE composer (CONTRACTS §4), handed in by axis-app.js. Absent ⇒ the button is not rendered at
  // all rather than rendered dead: a control that looks live and does nothing is the defect this build
  // exists to remove.
  const openComposer = typeof c.openComposer === 'function' ? c.openComposer : null;

  const root = el('div', { style: 'display:flex;flex-direction:column;gap:4px;max-width:1040px;margin:0 auto' });
  container.append(root);

  const paint = () => {
    root.innerHTML = '';
    const criticalCount = arr(data.approvals && data.approvals.rows)
      .filter((r) => r && r.criticality === 'critical' && (!r.status || r.status === 'pending')).length;
    root.append(heroSection(data, criticalCount));
    root.append(sectionHead('Command channel', 'voice or text · AXIS dispatches the fleet'));
    root.append(channelSection(voice));
    root.append(approvalsSection(data, paint, onIntent, openComposer));
    root.append(fleetSection(data, onIntent));
    root.append(activitySection(data));
    root.append(figuresSection(data));
    root.append(healthSection(data, onIntent));
    // The orb SVG and the transcript both live in axis-app.js — re-attach them after every repaint.
    if (voice.mountOrbs) voice.mountOrbs(root);
    if (voice.renderLog) voice.renderLog();
  };
  paint();
  return root;
}
