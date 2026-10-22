// axis-dashboard.js — AXIS Command Center · ELITE dashboard (2026-10-21 b).
//
// Ahmad: "make the dashboard better and all the functions and features … ultra defined and elite … with all
// the bells and whistles". PURELY ADDITIVE: every tile, row and control here calls something that already
// exists in axis-app.js through window.AXIS_DASH — the ⌘K palette, the module screens (go), the console tabs
// (openConsole), the voice controls, the situation, the snapshot, the trail. No second brain, no second
// voice, no new endpoint. Nothing renders until 'axis:signed-in'.
(() => {
  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs = {}, kids = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (k === 'onclick') n.onclick = v; else if (v != null && v !== false) n.setAttribute(k, v); }
    for (const k of [].concat(kids)) if (k != null && k !== false) n.append(k.nodeType ? k : document.createTextNode(String(k)));
    return n;
  };
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  const val = (n, suffix) => { const v = el('span'); v.append(n == null ? '—' : String(n)); if (suffix) v.append(el('small', {}, suffix)); return v; };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const lastSaid = [];            // "Review": the last things AXIS surfaced, newest first
  let lastDebrief = '', trailInfo = null;

  const card = (id, title, tone, value, body, actions) => {
    const c = el('div', { class: 'adash-card', id: 'adash-' + id, role: 'group', 'aria-label': title });
    c.append(el('div', { class: 'adash-head' }, [el('span', { class: 'adash-title' }, title), el('span', { class: 'adash-tone', 'data-tone': tone })]));
    if (value) c.append(el('div', { class: 'adash-value' }, value));
    for (const b of [].concat(body || [])) if (b) c.append(typeof b === 'string' ? el('div', { class: 'adash-sub' }, b) : b);
    if (actions && actions.length) c.append(el('div', { class: 'adash-actions' }, actions.map(([label, fn]) => el('button', { class: 'chip', onclick: fn }, label))));
    return c;
  };
  const row = (k, t, d, tone, fn) => el('button', { class: 'adash-row', onclick: fn, title: t }, [el('span', { class: 'k' }, k), el('span', { class: 't' }, t), d ? el('span', { class: 'd', 'data-tone': tone || null }, d) : null]);
  const dueTone = (label) => /overdue|late/i.test(label || '') ? 'crit' : /today|now/i.test(label || '') ? 'warn' : null;

  // ── HUD strip ───────────────────────────────────────────────────────────────
  function renderHud() {
    const D = window.AXIS_DASH; const h = $('axisHud'); if (!D || !h || !D.token()) return;
    const s = D.situation(); const src = (s && s.sources) || {}; const local = (s && s.local) || {};
    const v = D.version(); const brainDown = !!($('axisBrain') && !$('axisBrain').hidden);
    const tr = D.trail(); const mode = (tr && tr.mode) || 'full';
    const live = !!window.axisLiveActive;
    const items = [
      ['hud-clock', 'Local', (local.weekday ? local.weekday.slice(0, 3) + ' ' : '') + (local.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), null],
      ['', 'AXIS', D.state(), D.state() === 'idle' ? null : 'ok'],
      ['', 'Board', src.board ? String(src.board) : (v ? 'v' + v.v : 'connecting'), src.board === 'live' ? 'ok' : 'warn'],
      ['', 'Brain', brainDown ? 'board only' : 'reasoning', brainDown ? 'warn' : 'ok'],
      ['', 'Worker', src.worker_online ? 'online' : 'offline', src.worker_online ? 'ok' : 'warn'],
      ['', 'Autonomy', mode, mode === 'full' ? 'ok' : 'warn'],
      ['', 'Voice', live ? 'live call' : (D.voiceOn() ? 'Aria' : 'muted'), D.voiceOn() || live ? 'ok' : 'warn'],
      ['', 'Hands-free', D.handsFree() ? 'armed · say "AXIS"' : 'off', D.handsFree() ? 'ok' : null],
      ['', 'Mail', src.gmail || src.mail ? 'connected' : 'not connected', src.gmail || src.mail ? 'ok' : 'warn'],
    ];
    h.replaceChildren(...items.map(([cls, k, vv, tone]) => el('span', { class: 'hud ' + cls, 'data-tone': tone }, [k + ' ', el('b', {}, vv)])));
  }

  // ── Rails ───────────────────────────────────────────────────────────────────
  function render() {
    const D = window.AXIS_DASH; if (!D || !D.token()) return;
    const L = $('axisDashLeft'), R = $('axisDashRight'); if (!L || !R) return;
    const k = (D.data('overview').kpis) || {};
    const s = D.situation(); const sc = (s && s.counts) || {};
    const needsList = (s && s.needsAhmad) || []; const canDo = (s && s.axisCanDo) || []; const deadlines = (s && s.deadlines) || [];
    const inboxRows = (D.data('inbox').rows || []); const inboxOpen = D.inboxOpen(); const apr = D.approvalsPending(); const wr = D.waitingReply();
    const fu = D.data('followups'); const overdue = (fu.overdue || []), dueToday = (fu.due_today || []), upcoming = (fu.upcoming || []);
    const pipe = D.data('pipeline'); const pc = pipe.counts || {}; const phases = pipe.phases || [];
    const agents = D.data('fleet').agents || [];
    const failed = agents.filter(a => /fail|error|down|stale/i.test(String(a.status || a.state || '')));
    const needs = num(sc.needsAhmad) ?? needsList.length;
    const money = D.fmtMoney;

    // LEFT: what needs Ahmad · inbox · follow-ups · deadlines
    L.replaceChildren(
      card('needs', 'Needs me · ranked', needs ? (sc.overdue ? 'crit' : 'warn') : 'ok', val(needs, needs === 1 ? 'item' : 'items'), [
        needs ? [sc.overdue ? sc.overdue + ' overdue' : null, sc.today ? sc.today + ' today' : null, canDo.length ? 'AXIS handling ' + canDo.length : null].filter(Boolean).join(' · ') : (D.situationErr() ? 'Situation: ' + D.situationErr() : 'All quiet. AXIS is watching.'),
        needsList.length ? el('div', { class: 'adash-list' }, needsList.slice(0, 5).map((it, i) => row(String(i + 1), it.title, it.dueLabel || it.source, dueTone(it.dueLabel), () => D.go('priorities')))) : null,
      ], [['All priorities', () => D.go('priorities')], ['Live task view', () => D.go('tasks')], ['Approvals' + (apr ? ' · ' + apr : ''), () => D.go('approvals')]]),
      card('inbox', 'Action inbox', inboxOpen ? 'crit' : 'ok', val(inboxOpen, inboxOpen === 1 ? 'needs action' : 'need action'), [
        wr ? wr + ' waiting on a client reply' : 'Nothing waiting on you.',
        inboxRows.length ? el('div', { class: 'adash-list' }, inboxRows.filter(m => !m.actioned).slice(0, 4).map(m => row(String(m.classification || 'mail').slice(0, 6), (m.subject || m.from_email || '(no subject)'), m.received_at ? D.ago(m.received_at) : '', null, () => D.go('inbox')))) : null,
      ], [['Open inbox', () => D.go('inbox')], ['Mail tab', () => D.openConsole('inbox')], ['Waiting reply', () => D.go('waiting_reply')]]),
      card('followups', 'Follow-ups', overdue.length ? 'crit' : (dueToday.length ? 'warn' : 'ok'), val(overdue.length + dueToday.length, 'due'), [
        [overdue.length ? overdue.length + ' overdue' : null, dueToday.length ? dueToday.length + ' today' : null, upcoming.length ? upcoming.length + ' upcoming' : null].filter(Boolean).join(' · ') || 'Cadence ' + ((fu.cadence || [3, 7, 14]).join('/')) + ' days · clear.',
        (overdue.length || dueToday.length) ? el('div', { class: 'adash-list' }, overdue.concat(dueToday).slice(0, 4).map(f => row(overdue.includes(f) ? 'late' : 'today', f.subject || f.company || f.to || 'follow-up', f.due_at ? D.ago(f.due_at) : '', overdue.includes(f) ? 'crit' : 'warn', () => D.go('followups')))) : null,
      ], [['Follow-ups', () => D.go('followups')], ['Outreach', () => D.go('outreach')]]),
      deadlines.length ? card('deadlines', 'Deadlines', dueTone(deadlines[0].dueLabel) || 'ok', null, [
        el('div', { class: 'adash-list' }, deadlines.slice(0, 5).map(d => row('due', d.title, d.dueLabel || '', dueTone(d.dueLabel), () => D.go(d.screen || 'priorities')))),
      ], [['Grant radar', () => D.go('grants')]]) : null,
    );

    // RIGHT: money + funnel · agents · trail · review · voice controls
    const funnel = phases.length ? phases.map(p => [p.label, (p.stages || []).reduce((n, st) => n + (pc[st] || 0), 0)]) : [];
    const fmax = Math.max(1, ...funnel.map(f => f[1]));
    R.replaceChildren(
      card('money', 'Money', overdue.length ? 'crit' : 'ok', val(money(num(k.pipeline_value) ?? 0), 'pipeline'), [
        [num(k.mrr) != null ? money(k.mrr) + ' / month recurring' : null, num(k.meetings_week) ? plural(k.meetings_week, 'meeting this week', 'meetings this week') : null, apr ? apr + ' approvals pending' : null].filter(Boolean).join(' · ') || 'No recurring revenue on the board yet.',
        funnel.length ? el('div', { class: 'adash-bars' }, funnel.map(([l, n]) => el('div', { class: 'adash-bar' }, [el('span', {}, l), el('i', { style: '--w:' + Math.round(100 * n / fmax) + '%' }), el('b', {}, String(n))]))) : null,
      ], [['Pipeline', () => D.go('pipeline')], ['CRM', () => D.go('crm')], ['Analytics', () => D.go('analytics')], ['Reports', () => D.go('reports')]]),
      card('agents', 'Fleet', failed.length ? 'crit' : (agents.length ? 'ok' : 'warn'), val(agents.length, agents.length === 1 ? 'agent' : 'agents'), [
        failed.length ? 'Attention: ' + failed.slice(0, 3).map(a => a.agent || a.name || a.id).join(', ') : (agents.length ? 'All reporting.' : 'Fleet feed not loaded yet.'),
        agents.length ? el('div', { class: 'adash-list' }, agents.slice(0, 6).map(a => el('div', { class: 'adash-agent' }, [el('span', { class: 'dot ' + (/fail|error|down|stale/i.test(String(a.status || '')) ? 'dot-crit' : /running/i.test(String(a.status || '')) ? 'dot-warn' : 'dot-ok') }), el('span', {}, (a.agent || a.name || a.id) + (a.last_run_at ? ' · ' + D.ago(a.last_run_at) : ''))]))) : null,
      ], [['Fleet', () => D.go('fleet')], ['Director', () => D.go('axis-agent-director')], ['Claude', () => D.openConsole('claude')], ['My PC', () => D.openConsole('pc')]]),
      card('trail', 'Trail · autonomy ' + ((trailInfo && trailInfo.mode) || 'full'), trailInfo && trailInfo.mode === 'off' ? 'warn' : 'ok', val((trailInfo && trailInfo.trail || []).length, 'actions logged'), [
        trailInfo ? trailInfo.summary : 'Reading the trail…',
        trailInfo && trailInfo.trail && trailInfo.trail.length ? el('div', { class: 'adash-feed' }, trailInfo.trail.slice(0, 6).map(r => el('div', {}, [el('time', {}, D.ago(r.t)), el('span', { title: r.summary || r.action }, (r.action || '') + ' · ' + (r.summary || ''))]))) : null,
      ], [['Approvals', () => D.go('approvals')], ['Brief', () => D.openConsole('brief')], ['Automate', () => D.openConsole('auto')]]),
      card('debrief', 'Debrief', lastDebrief ? 'ok' : 'warn', null, [lastDebrief || 'AXIS debriefs you once the board lands.'],
        [['Replay', () => D.debrief()], ['Transcript', () => D.openConsole('talk')]]),
      lastSaid.length ? card('review', 'Review · last surfaced', 'ok', null, [el('div', { class: 'adash-feed' }, lastSaid.slice(0, 4).map(t => el('div', {}, [el('span', { title: t }, t)])))], [['Open transcript', () => D.openConsole('talk')]]) : null,
      card('controls', 'Voice & presence', D.handsFree() ? 'ok' : null, null, [
        el('div', { class: 'adash-controls' }, [
          el('button', { class: 'chip', 'aria-pressed': String(D.voiceOn()), onclick: () => { D.voiceToggle(); render(); }, title: 'Toggle spoken replies' }, [el('big', {}, '🔊'), 'Voice']),
          el('button', { class: 'chip', 'aria-pressed': String(D.handsFree()), onclick: () => { D.handsFreeToggle(); setTimeout(render, 300); }, title: 'Hands-free wake word "AXIS"' }, [el('big', {}, '⏣'), 'Wake']),
          el('button', { class: 'chip', 'aria-pressed': String(!!window.axisLiveActive), onclick: () => D.liveToggle(), title: 'Two-way live call, Aria\'s voice' }, [el('big', {}, '🎙'), 'Live call']),
          el('button', { class: 'chip', onclick: () => D.hologram(), title: 'Full-screen presence (Ctrl+Alt+A)' }, [el('big', {}, '⛶'), 'Presence']),
          el('button', { class: 'chip', onclick: () => D.openConsole('talk'), title: 'Open the console' }, [el('big', {}, '◯'), 'Console']),
          el('button', { class: 'chip', onclick: () => D.openConsole('setup'), title: 'Voice picker · live call · connections' }, [el('big', {}, '⚙'), 'Setup']),
          el('button', { class: 'chip', onclick: () => D.openPalette(), title: 'Everything you can do (⌘K)' }, [el('big', {}, '⌘'), 'Palette']),
          el('button', { class: 'chip', onclick: () => D.standDown(), title: 'Kill switch (Ctrl+Alt+K)' }, [el('big', {}, '■'), 'Stand down']),
        ]),
      ]),
    );
    renderHud();
  }

  // ── Command deck: the palette, the console tabs, the screens, the keys — laid out ───────────
  const TAB_LABEL = { talk: 'Talk', work: 'Work', todo: 'To-do', auto: 'Automate', apr: 'Approvals', pc: 'My PC', inbox: 'Inbox', brief: 'Brief', claude: 'Claude', setup: 'Setup', public: 'Public view' };
  const TAB_HINT = { talk: 'director transcript', work: 'working docs on screen', todo: 'prioritised to-dos', auto: 'automations that email you', apr: 'approve · reject · skip', pc: 'Axis Local jobs', inbox: 'mail overview', brief: 'done · waiting · next', claude: 'the worker on your PC', setup: 'voice · live call · connections', public: 'what a visitor sees' };
  const KEYS = [['⌘K / Ctrl+K', 'Command palette'], ['Ctrl+Alt+K', 'Kill switch — AXIS stands down'], ['Ctrl+Alt+A', 'Full-screen presence'], ['Esc', 'Close console / palette / drawer'], ['Enter (quick bar)', 'Send to AXIS'], ['J / K', 'Approvals: next / previous'], ['A / X / S', 'Approve / reject / skip'], ['E / R / N', 'Edit / rewrite / note'], ['⌘Enter', 'Composer: send'], ['"AXIS …"', 'Wake word (hands-free)'], ['"AXIS stop"', 'Spoken stand-down'], ['Double-click globe', 'Start the live call']];
  function renderDeck() {
    const D = window.AXIS_DASH; const deck = $('axisDeck'); if (!D || !deck || !D.token()) return;
    const items = D.palette(); const act = items.filter(i => !/^Go to /.test(i.label)); const nav = D.nav();
    const badges = { 'Review approvals': D.approvalsPending(), 'Approve all pending': D.approvalsPending(), 'Open Action Inbox': D.inboxOpen() };
    deck.replaceChildren(
      el('div', { class: 'deck-head' }, [el('div', { class: 'deck-title' }, ['Command deck', el('small', {}, act.length + ' actions · ' + Object.keys(TAB_LABEL).length + ' console tabs · ' + nav.flatMap(g => g.items).length + ' screens')]), el('span', { class: 'deck-hint' }, 'everything ⌘K knows, in the open')]),
      el('div', { class: 'deck-grid' }, act.map((it, i) => el('button', { class: 'deck-tile', 'data-badge': badges[it.label] != null ? String(badges[it.label]) : null, onclick: () => it.run() }, [el('span', { class: 'n' }, String(i + 1).padStart(2, '0')), el('span', { class: 'l' }, it.label), it.hint ? el('span', { class: 'h' }, it.hint) : null]))),
      el('div', { class: 'deck-head' }, [el('div', { class: 'deck-title' }, ['Console', el('small', {}, 'one globe · one voice · one console')]), el('span', { class: 'deck-hint' }, 'click the globe or any tab')]),
      el('div', { class: 'deck-tabs' }, D.tabs().map(t => el('button', { class: 'chip', onclick: () => D.openConsole(t), title: TAB_HINT[t] || '' }, [el('b', {}, TAB_LABEL[t] || t), TAB_HINT[t] || '']))),
      el('div', { class: 'deck-head' }, [el('div', { class: 'deck-title' }, ['Screens', el('small', {}, 'the sidebar, in full')]), el('span', { class: 'deck-hint' }, D.module())]),
      el('div', { class: 'deck-screens' }, nav.flatMap(g => [el('div', { class: 'deck-group' }, g.group), ...g.items.map(i => el('button', { class: 'deck-tile', 'aria-current': D.module() === i.id ? 'true' : null, onclick: () => D.go(i.id) }, [el('span', { class: 'n' }, i.glyph), el('span', { class: 'l' }, i.label)]))])),
      el('div', { class: 'deck-head' }, [el('div', { class: 'deck-title' }, ['Keys & voice', el('small', {}, 'every shortcut')]), null]),
      el('div', { class: 'deck-keys' }, KEYS.map(([k, d]) => el('div', {}, [el('span', {}, d), el('kbd', {}, k)]))),
    );
  }

  const all = () => { render(); renderDeck(); };
  window.addEventListener('axis:signed-in', all);
  window.addEventListener('axis:snapshot', all);
  window.addEventListener('axis:tasks-changed', render);
  window.addEventListener('axis:tasks-acted', render);
  window.addEventListener('axis:live-state', () => { render(); });
  window.addEventListener('axis:trail', (e) => { trailInfo = e.detail || null; render(); });
  window.addEventListener('axis:debrief', (e) => { lastDebrief = (e.detail && e.detail.text) || ''; render(); });
  window.addEventListener('axis:say', (e) => { const t = e.detail && e.detail.text; if (t) { lastSaid.unshift(String(t)); lastSaid.length = Math.min(lastSaid.length, 5); render(); } });
  window.addEventListener('axis:transcript', (e) => { const d = e.detail || {}; if (d.role !== 'user' && d.text) { lastSaid.unshift(String(d.text)); lastSaid.length = Math.min(lastSaid.length, 5); render(); } });
  // The globe state word, autonomy mode and clock on the HUD track the orb state machine + the clock.
  new MutationObserver(renderHud).observe(document.documentElement, { attributes: true, attributeFilter: ['data-axis-state', 'data-axis-tab'] });
  setInterval(() => { if (!document.hidden) renderHud(); }, 15000);
  setInterval(() => { if (!document.hidden) render(); }, 60000);
  if (window.AXIS_DASH && window.AXIS_DASH.token()) all();
})();
