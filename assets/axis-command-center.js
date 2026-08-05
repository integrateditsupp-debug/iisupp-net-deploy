/* AXIS — Director Agent Communication · Command Center
 * Embeds into aperture-learning.html (mount: <section id="axis-cc">).
 * Dark-matter AXIS orb · talk-to-AXIS chat (director endpoint) · left function tabs with LIVE AGENT VIEW
 * (step-log + screenshot thumbs v1) · unified INSTANT-approve inbox · auto-approve policy + rails ·
 * always-listening barge-in voice (wake word "AXIS", speaker-locked) · live activity feed · named roster.
 * Data: /assets/axis-state.json (+ /assets/axis-roster.json), worker-emitted, secret-free. No auto-send here.
 */
(function () {
  'use strict';
  var MOUNT = document.getElementById('axis-cc');
  if (!MOUNT) return;

  var ENDPOINT = '/.netlify/functions/axis-director';
  var AUTHED_URL = '/api/axis-state';            // gated: named detail (approval titles, activity) — login only
  var STATUS_URL = '/api/axis-status';           // gated: program figures + their evidence stamps — login only
  var STATE_URL = '/assets/axis-state.json';     // public: counts only — NO names / titles / strategy
  var ROSTER_URL = '/assets/axis-roster.json';
  var state = null, roster = null, chat = [], activeFn = 'approvals', listening = false, rec = null, authed = false;
  var programStatus = null;                      // RUN-AM / AM2 — figures + age, rendered not hidden
  function apertureToken() { try { return localStorage.getItem('aperture_jwt') || ''; } catch (e) { return ''; } }

  // Left sidebar functions (packet order). `fns` = roster.fn values this tab shows in its live view.
  var FUNCTIONS = [
    { key: 'approvals',       label: 'Approvals',          icon: '✓', fns: [] },
    { key: 'Send Email',      label: 'Send email',         icon: '✉', fns: ['Send Email', 'Draft Emails'] },
    { key: 'Apply LinkedIn',  label: 'Apply jobs',         icon: '↗', fns: ['Apply LinkedIn'] },
    { key: 'Find Leads',      label: 'Find leads + draft', icon: '◎', fns: ['Find Leads', 'Draft Emails'] },
    { key: 'Work Report',     label: "Today's report",     icon: '▤', fns: ['Work Report'] },
    { key: 'Ops Health',      label: 'Ops health',         icon: '♥', fns: ['Ops Health'] },
    { key: 'Finance',         label: 'Finance',            icon: '$', fns: ['Finance'] },
    { key: 'Brain',           label: 'Brain (vault)',      icon: '❋', fns: ['Brain'] },
    { key: 'ARIA Quality',    label: 'ARIA quality',       icon: '◆', fns: ['ARIA Quality'] }
  ];

  injectStyles();
  MOUNT.innerHTML = shell();
  bind();
  load();
  setInterval(load, 10000);

  /* ---------- data ---------- */
  function load() {
    var tok = apertureToken();
    // Logged in → fetch the AUTHENTICATED state (named detail). No token / 401 → public counts-only file,
    // which deliberately carries NO names, approval titles, or strategy.
    if (tok) {
      fetch(AUTHED_URL, { cache: 'no-store', headers: { Authorization: 'Bearer ' + tok } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d && d.ok) { state = d; authed = true; render(); } else { loadPublic(); } })
        .catch(function () { loadPublic(); });
      // AM2 — the program figures and how old each read is. Authed-only; a 401 simply leaves the card empty.
      fetch(STATUS_URL, { cache: 'no-store', headers: { Authorization: 'Bearer ' + tok } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d && d.ok) { programStatus = d; renderFigures(); } })
        .catch(function () {});
    } else { loadPublic(); }
    if (!roster) fetch(ROSTER_URL, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d) { roster = d; render(); } }).catch(function () {});
  }
  function loadPublic() {
    fetch(STATE_URL, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d) { state = d; authed = false; render(); } }).catch(function () {});
  }

  /* ---------- render ---------- */
  function render() {
    var h = (state && state.health) || {};
    setHTML('axis-health', [
      pill('worker ' + (h.worker || '—'), h.worker === 'up' ? 'ok' : 'warn'),
      pill((h.agentsTotal || 0) + ' agents', 'a'),
      pill((h.approvalsPending || 0) + ' to approve', (h.approvalsPending ? 'hot' : 'ok')),
      pill((h.leadsQueued || 0) + ' leads queued', 'a'),
      pill('self-test ' + (h.classifierSelfTestPassPct != null ? h.classifierSelfTestPassPct + '%' : '—'), 'ok'),
      span('axis-upd', (state ? 'updated ' + rel(state.generatedAt) : '') + (authed ? '' : ' · public view')),
    ].join(''));

    var actCount = (state && state.activitySummary && state.activitySummary.recentCount) || 0;
    setHTML('axis-feed', (state && state.recentActivity && state.recentActivity.length
      ? state.recentActivity.map(function (e) {
        return '<div class="axis-feed-row"><span class="dot ' + dotc(e.status) + '"></span><div><div class="ft">' +
          esc(e.agent) + ' <span class="fs">' + rel(e.at) + '</span></div><div class="fb">' + esc(e.text) + '</div></div></div>';
      }).join('') : '<div class="axis-empty">' + (!authed && actCount ? actCount + ' recent events · <b>log in</b> for detail' : 'Awaiting agent activity…') + '</div>'));

    var ags = (state && state.agents) || (roster && roster.agents) || [];
    setHTML('axis-roster', ags.length ? ags.map(function (a) {
      return '<div class="axis-rcard"><div class="rn">' + esc(a.name) + '<span class="rfn">' + esc(a.fn || '') + '</span></div>' +
        '<div class="rd">' + esc(a.does || '') + '</div>' +
        '<div class="rs"><span class="dot ' + dotc(a.status) + '"></span>' + esc(a.status || 'scheduled') +
        (a.lastRunAt ? ' · ' + rel(a.lastRunAt) : '') + '</div></div>';
    }).join('') : '<div class="axis-empty">Loading roster…</div>');

    renderFigures();
    renderFn();
  }

  // AM2 — render every published figure with the age of the read behind it, and mark the stale ones.
  // Nothing is dropped for being stale: a figure that disappears is one nobody can challenge.
  function renderFigures() {
    var host = document.getElementById('axis-figures');
    if (!host) return;
    var cf = window.AxisClaimFigures;
    if (!cf) { host.innerHTML = '<div class="axis-empty">Figure renderer not loaded.</div>'; return; }
    if (!programStatus) {
      host.innerHTML = '<div class="axis-empty">' + (authed ? 'No program figures published yet.' : '<b>Log in</b> to see program figures and how old each reading is') + '</div>';
      return;
    }
    host.innerHTML = cf.renderFiguresHTML(programStatus.claims || {}, { now: new Date() });
  }

  function renderFn() {
    // function tabs active state
    FUNCTIONS.forEach(function (f) {
      var b = document.getElementById('fnb-' + slug(f.key));
      if (b) b.className = 'axis-fnbtn' + (activeFn === f.key ? ' on' : '');
    });
    var host = document.getElementById('axis-liveview');
    if (!host) return;
    if (activeFn === 'approvals') { host.innerHTML = approvalsView(); return; }
    var fn = FUNCTIONS.filter(function (f) { return f.key === activeFn; })[0] || FUNCTIONS[1];
    var ags = ((state && state.agents) || []).filter(function (a) { return fn.fns.indexOf(a.fn) !== -1; });
    host.innerHTML =
      '<div class="lv-head"><span class="live-tag"><span class="dot live"></span>LIVE VIEW</span>' +
      '<button class="axis-run" data-run="' + esc(fn.key) + '">Queue this work →</button></div>' +
      '<div class="lv-note">What these agents are doing — live step-log + view frames (v1). Sends stay approval-gated.</div>' +
      (ags.length ? ags.map(function (a) {
        return '<div class="lv-agent"><div class="lv-shot"><span>live view</span></div><div class="lv-body">' +
          '<div class="lv-n">' + esc(a.name) + ' <span class="dot ' + dotc(a.status) + '"></span><span class="lv-st">' + esc(a.status) + '</span></div>' +
          '<div class="lv-step">' + esc(a.summary || a.does || 'Scheduled — no step yet this cycle.') + '</div>' +
          '<div class="lv-when">' + (a.lastRunAt ? 'last run ' + rel(a.lastRunAt) : 'awaiting next run') + '</div></div></div>';
      }).join('') : '<div class="axis-empty">No agent mapped to this function yet.</div>');
  }

  function approvalsView() {
    var aps = (state && state.approvals) || [];
    var auto = (state && state.autoApprove) || {};
    var pending = aps.length || (state && state.approvalsSummary && state.approvalsSummary.pending) || 0;
    return '<div class="lv-head"><span class="live-tag"><span class="dot live"></span>APPROVALS · instant</span>' +
      '<span class="ap-count">' + pending + ' pending</span></div>' +
      '<div class="ap-auto"><div class="ap-auto-h"><b>Auto-approve</b><span class="ap-toggle ' + (auto.enabled ? 'on' : '') + '">' +
      (auto.enabled ? 'ON' : 'OFF') + '</span></div>' +
      '<div class="ap-rails">' + ((auto.rails || []).map(function (r) { return '<span class="rail">' + esc(r) + '</span>'; }).join('') || '') + '</div>' +
      '<div class="ap-note">' + esc(auto.note || 'Most sends auto-fire within the rails; irreversible/anomalous waits here. Daily auto-fire digest.') + '</div></div>' +
      (aps.length ? aps.map(function (a) {
        return '<div class="ap-row" data-apid="' + esc(a.id) + '"><div class="ap-t">' + esc(a.title) + '</div>' +
          '<div class="ap-btns"><button class="ap-ok" data-ap="approve" data-id="' + esc(a.id) + '">Approve</button>' +
          '<button class="ap-no" data-ap="reject" data-id="' + esc(a.id) + '">Reject</button></div></div>';
      }).join('') : '<div class="axis-empty">' + (!authed && pending ? pending + ' items pending review · <b>log in</b> to see &amp; approve them' : 'Nothing pending. All clear.') + '</div>');
  }

  /* ---------- chat ---------- */
  function pushMsg(role, text) {
    chat.push({ role: role, content: text });
    var log = document.getElementById('axis-log');
    var who = role === 'user' ? 'you' : 'AXIS';
    var div = document.createElement('div');
    div.className = 'axis-msg ' + (role === 'user' ? 'me' : 'ax');
    div.innerHTML = '<span class="axis-who">' + who + '</span><div class="axis-bub">' + esc(text) + '</div>';
    log.appendChild(div); log.scrollTop = log.scrollHeight;
    return div;
  }
  function say(text) {
    var t = (text || '').trim(); if (!t) return;
    pushMsg('user', t);
    var pend = pushMsg('axis', '…'); pend.querySelector('.axis-bub').classList.add('think');
    fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'chat', messages: chat.filter(function (m) { return m.role === 'user' || m.role === 'assistant'; }).slice(-12) }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var reply = (d && d.text) || 'Heard you.';
        pend.querySelector('.axis-bub').classList.remove('think');
        pend.querySelector('.axis-bub').textContent = reply;
        chat.push({ role: 'assistant', content: reply });
        if (d && d.routedAgent) {
          var tag = document.createElement('div'); tag.className = 'axis-route';
          tag.textContent = '→ routed to ' + d.routedAgent + (d.needsApproval ? ' · waits for your ok' : ' · behind rails');
          pend.appendChild(tag);
        }
        if (d && (d.routedAgent || d.queued)) setTimeout(load, 800);
        speak(reply);
      })
      .catch(function () { pend.querySelector('.axis-bub').classList.remove('think'); pend.querySelector('.axis-bub').textContent = 'Cant reach brain. Try again.'; });
  }

  function approve(id, decision) {
    var row = document.querySelector('.ap-row[data-apid="' + cssesc(id) + '"]');
    if (row) row.classList.add('ap-pending');
    fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approval', approvalId: id, decision: decision }) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (row) { row.classList.remove('ap-pending'); row.classList.add(decision === 'approve' ? 'ap-done' : 'ap-rej'); row.querySelector('.ap-btns').innerHTML = '<span class="ap-msg">' + (d && d.text ? esc(d.text) : (decision === 'approve' ? 'Approved' : 'Rejected')) + '</span>'; } })
      .catch(function () { if (row) row.classList.remove('ap-pending'); });
  }

  /* ---------- voice: always-listening wake word "AXIS", barge-in, speaker-locked ---------- */
  function voiceSupported() { return ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window); }
  function armVoice() {
    if (!voiceSupported()) { setVoiceUI('no-mic'); return; }
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US';
    var armed = '';
    rec.onresult = function (ev) {
      var txt = ''; for (var i = ev.resultIndex; i < ev.results.length; i++) txt += ev.results[i][0].transcript;
      txt = txt.trim(); var low = txt.toLowerCase();
      setHTML('axis-heard', esc(txt));
      if (/\baxis stop\b/.test(low)) { stopAction(); armed = ''; return; }
      var m = low.indexOf('axis');
      if (m !== -1) {                                  // wake word heard → barge-in: capture what follows
        armed = txt.slice(m + 4).replace(/^[,.\s]+/, '');
      }
      if (armed && ev.results[ev.results.length - 1].isFinal) {
        var cmd = armed.trim(); armed = '';
        if (cmd) { setHTML('axis-heard', ''); say(cmd); }
      }
    };
    rec.onend = function () { if (listening) { try { rec.start(); } catch (e) {} } };
    rec.onerror = function () {};
    listening = true; try { rec.start(); } catch (e) {}
    setVoiceUI('on');
  }
  function disarmVoice() { listening = false; if (rec) { try { rec.stop(); } catch (e) {} } setVoiceUI('off'); }
  function stopAction() { pushMsg('axis', 'Stopped.'); /* worker honors AXIS stop on its poll */ }
  function speak(text) {
    try { if (!('speechSynthesis' in window)) return; var u = new SpeechSynthesisUtterance(text.slice(0, 240)); u.rate = 1.02; u.pitch = .85; window.speechSynthesis.speak(u); } catch (e) {}
  }
  function setVoiceUI(s) {
    var b = document.getElementById('axis-mic'); if (!b) return;
    b.className = 'axis-mic ' + s;
    b.textContent = s === 'on' ? '● listening' : s === 'no-mic' ? 'no mic' : '○ voice off';
    var note = document.getElementById('axis-voice-note');
    if (note) note.textContent = s === 'on' ? 'Wake word "AXIS" armed · speaker-locked to Ahmad · say "AXIS stop" to halt'
      : s === 'no-mic' ? 'Voice not supported in this browser' : 'Tap to arm always-listening wake word';
  }

  /* ---------- events ---------- */
  function bind() {
    MOUNT.addEventListener('click', function (e) {
      var t = e.target;
      var fb = t.closest && t.closest('.axis-fnbtn'); if (fb) { activeFn = fb.getAttribute('data-fn'); renderFn(); return; }
      if (t.id === 'axis-send') { var inp = document.getElementById('axis-in'); say(inp.value); inp.value = ''; return; }
      if (t.id === 'axis-mic') { listening ? disarmVoice() : armVoice(); return; }
      var ap = t.getAttribute && t.getAttribute('data-ap'); if (ap) { approve(t.getAttribute('data-id'), ap); return; }
      var run = t.getAttribute && t.getAttribute('data-run');
      if (run) {
        t.disabled = true; t.textContent = 'Queued ✓';
        fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'command', intent: 'Run ' + run + ' now (no-send prep / behind rails)' }) }).catch(function () {});
        setTimeout(load, 800);
      }
    });
    MOUNT.addEventListener('keydown', function (e) { if (e.target.id === 'axis-in' && e.key === 'Enter') { say(e.target.value); e.target.value = ''; } });
  }

  /* ---------- shell + styles ---------- */
  function shell() {
    return '' +
      '<div class="axis-wrap">' +
        '<div class="axis-head"><div class="axis-orb-sm"><i></i></div><div><h2>AXIS — Director Agent Communication</h2>' +
        '<div class="axis-sub">You talk to AXIS. It dispatches the fleet. Forge builds the code.</div></div></div>' +
        '<div class="axis-health" id="axis-health"></div>' +
        '<div class="axis-grid">' +
          '<div class="axis-left">' +
            '<div class="axis-fns">' + FUNCTIONS.map(function (f) {
              return '<button class="axis-fnbtn' + (f.key === activeFn ? ' on' : '') + '" id="fnb-' + slug(f.key) + '" data-fn="' + esc(f.key) + '"><span class="fi">' + f.icon + '</span>' + esc(f.label) + '</button>';
            }).join('') + '</div>' +
            '<div class="axis-liveview" id="axis-liveview"></div>' +
          '</div>' +
          '<div class="axis-center">' +
            '<div class="axis-orb"><i></i><b></b></div>' +
            '<div class="axis-log" id="axis-log"><div class="axis-msg ax"><span class="axis-who">AXIS</span><div class="axis-bub">Director up. Name an agent or say the job. I route it. Nothing sends without the rails.</div></div></div>' +
            '<div class="axis-heard" id="axis-heard"></div>' +
            '<div class="axis-inrow"><button class="axis-mic off" id="axis-mic">○ voice off</button>' +
            '<input id="axis-in" placeholder="Tell AXIS… e.g. &quot;Pitch, redo the drafts&quot;"><button class="axis-go" id="axis-send">Send</button></div>' +
            '<div class="axis-voice-note" id="axis-voice-note">Tap to arm always-listening wake word</div>' +
          '</div>' +
          '<div class="axis-right">' +
            '<div class="axis-card"><div class="axis-ch">Program figures · age of each reading</div><div class="axis-figures" id="axis-figures"></div></div>' +
            '<div class="axis-card"><div class="axis-ch">Live agent activity</div><div class="axis-feed" id="axis-feed"></div></div>' +
            '<div class="axis-card"><div class="axis-ch">Named roster</div><div class="axis-roster" id="axis-roster"></div></div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function injectStyles() {
    if (document.getElementById('axis-cc-style')) return;
    var s = document.createElement('style'); s.id = 'axis-cc-style';
    s.textContent =
    '#axis-cc{--cy:#22e1ff;--cy2:#7af0ff;margin:22px 0}' +
    '.axis-wrap{background:linear-gradient(180deg,#fbfdff 0%,#f3f7fb 100%);border:1px solid #e3ecf4;border-radius:16px;padding:20px;color:#0c1722}' +
    '.axis-head{display:flex;gap:14px;align-items:center;margin-bottom:14px}' +
    '.axis-head h2{font-size:17px;margin:0;letter-spacing:-.01em}.axis-sub{font-size:12px;color:#5a6b7a;margin-top:2px}' +
    '.axis-orb-sm{width:38px;height:38px;border-radius:50%;position:relative;flex:0 0 auto;background:radial-gradient(circle at 38% 32%,#3b4a5a,#0a0f15 70%);box-shadow:0 0 0 1px rgba(34,225,255,.25),0 6px 20px rgba(10,20,30,.25)}' +
    '.axis-orb-sm i{position:absolute;inset:-5px;border-radius:50%;border:1px solid rgba(34,225,255,.45);animation:axisRing 6s linear infinite}' +
    '@keyframes axisRing{to{transform:rotate(360deg)}}' +
    '.axis-health{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin-bottom:14px}' +
    '.axis-pill{font-size:11px;font-weight:600;padding:4px 10px;border-radius:99px;background:#eef4f9;color:#33495c}' +
    '.axis-pill.ok{background:#e6f7ee;color:#137a45}.axis-pill.hot{background:#fdeceA;background:#fdecec;color:#b3261e}.axis-pill.warn{background:#fdf3e3;color:#9a6a12}' +
    '.axis-upd{font-size:10.5px;color:#8395a4;margin-left:auto}' +
    '.axis-grid{display:grid;grid-template-columns:300px 1fr 300px;gap:14px}' +
    '.axis-left,.axis-right{display:flex;flex-direction:column;gap:12px;min-width:0}' +
    '.axis-fns{display:grid;grid-template-columns:1fr 1fr;gap:6px}' +
    '.axis-fnbtn{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;text-align:left;padding:9px 10px;border:1px solid #e1eaf2;background:#fff;border-radius:9px;color:#33495c;cursor:pointer;transition:.15s}' +
    '.axis-fnbtn:hover{border-color:var(--cy);color:#0c1722}.axis-fnbtn.on{background:#0c1722;color:#fff;border-color:#0c1722}' +
    '.axis-fnbtn .fi{width:16px;text-align:center;color:var(--cy)}.axis-fnbtn.on .fi{color:var(--cy2)}' +
    '.axis-liveview{background:#fff;border:1px solid #e6eef5;border-radius:11px;padding:12px;min-height:230px;max-height:560px;overflow:auto}' +
    '.lv-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}' +
    '.live-tag{font-size:10px;font-weight:700;letter-spacing:.12em;color:#33495c;display:flex;align-items:center;gap:6px}' +
    '.lv-note{font-size:11px;color:#7488 97;color:#74889a;margin-bottom:10px}' +
    '.axis-run{font-size:11px;font-weight:700;border:0;background:var(--cy);color:#04222b;padding:6px 11px;border-radius:7px;cursor:pointer}' +
    '.axis-run:disabled{background:#cfe9f0;color:#3a6b76}' +
    '.lv-agent{display:flex;gap:10px;padding:9px 0;border-top:1px solid #f0f4f8}' +
    '.lv-shot{width:62px;height:44px;flex:0 0 auto;border-radius:6px;background:repeating-linear-gradient(45deg,#0c1722,#0c1722 6px,#13202c 6px,#13202c 12px);display:flex;align-items:center;justify-content:center}' +
    '.lv-shot span{font-size:8px;color:var(--cy);letter-spacing:.1em;text-transform:uppercase}' +
    '.lv-n{font-size:12.5px;font-weight:700;display:flex;align-items:center;gap:6px}.lv-st{font-size:10.5px;color:#74889a;font-weight:600}' +
    '.lv-step{font-size:11.5px;color:#41566a;margin-top:2px;line-height:1.45}.lv-when{font-size:10px;color:#8aa;color:#8a9bab;margin-top:3px}' +
    '.axis-center{display:flex;flex-direction:column;min-width:0;background:#fff;border:1px solid #e6eef5;border-radius:12px;padding:14px}' +
    '.axis-orb{width:96px;height:96px;border-radius:50%;margin:6px auto 12px;position:relative;background:radial-gradient(circle at 38% 30%,#42566a,#070b10 72%);box-shadow:0 0 50px rgba(34,225,255,.18),inset 0 0 26px rgba(0,0,0,.6)}' +
    '.axis-orb i{position:absolute;inset:-9px;border-radius:50%;border:1px solid rgba(34,225,255,.4);animation:axisRing 7s linear infinite}' +
    '.axis-orb b{position:absolute;inset:26% 0 0 30%;width:14px;height:14px;border-radius:50%;background:var(--cy2);filter:blur(5px);opacity:.7;animation:axisPulse 2.6s ease-in-out infinite}' +
    '@keyframes axisPulse{0%,100%{opacity:.35}50%{opacity:.9}}' +
    '.axis-log{flex:1;min-height:170px;max-height:300px;overflow:auto;display:flex;flex-direction:column;gap:9px;padding:4px 2px}' +
    '.axis-msg{display:flex;flex-direction:column;gap:3px}.axis-msg.me{align-items:flex-end}' +
    '.axis-who{font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:#9 aabba;color:#9aabba;font-weight:700}' +
    '.axis-bub{max-width:84%;font-size:13px;line-height:1.5;padding:9px 12px;border-radius:12px;background:#f1f6fa;color:#15242f}' +
    '.axis-msg.me .axis-bub{background:#0c1722;color:#eaf6fb}' +
    '.axis-bub.think{color:#9aabba}.axis-route{font-size:10.5px;color:#137a45;font-weight:600;margin-top:2px}' +
    '.axis-heard{font-size:11px;color:var(--cy);min-height:14px;text-align:center;font-style:italic}' +
    '.axis-inrow{display:flex;gap:7px;margin-top:8px;align-items:center}' +
    '.axis-in,#axis-in{flex:1;border:1px solid #d8e3ec;border-radius:9px;padding:10px 12px;font-size:13px;font-family:inherit;min-width:0}' +
    '.axis-mic{font-size:11px;font-weight:700;border:1px solid #d8e3ec;background:#fff;border-radius:9px;padding:9px 11px;cursor:pointer;white-space:nowrap;color:#33495c}' +
    '.axis-mic.on{background:#e6f7ee;color:#137a45;border-color:#9fdcb8}.axis-mic.no-mic{opacity:.55;cursor:not-allowed}' +
    '.axis-go{border:0;background:var(--cy);color:#04222b;font-weight:700;border-radius:9px;padding:10px 16px;cursor:pointer;font-size:13px}' +
    '.axis-voice-note{font-size:10.5px;color:#8a9bab;text-align:center;margin-top:6px}' +
    '.axis-card{background:#fff;border:1px solid #e6eef5;border-radius:11px;padding:12px}' +
    '.axis-ch{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#74889a;margin-bottom:9px}' +
    '.axis-feed{max-height:240px;overflow:auto;display:flex;flex-direction:column;gap:9px}' +
    '.axis-feed-row{display:flex;gap:8px}.axis-feed-row .ft{font-size:11.5px;font-weight:700;color:#1c2c39}.fs{font-weight:500;color:#9 aabba;color:#9aabba;font-size:10px}' +
    '.axis-feed-row .fb{font-size:11px;color:#52677a;line-height:1.4;margin-top:1px}' +
    '.axis-roster{max-height:320px;overflow:auto;display:flex;flex-direction:column;gap:7px}' +
    '.axis-rcard{border:1px solid #eef3f8;border-radius:8px;padding:8px 10px}' +
    '.rn{font-size:12.5px;font-weight:700;display:flex;justify-content:space-between;align-items:center}.rfn{font-size:9.5px;font-weight:600;color:var(--cy);background:#04222b;background:#eaf9fd;padding:2px 7px;border-radius:99px}' +
    '.rd{font-size:10.5px;color:#637789;margin-top:2px;line-height:1.4}.rs{font-size:10px;color:#74889a;margin-top:4px;display:flex;align-items:center;gap:5px}' +
    '.dot{width:7px;height:7px;border-radius:50%;background:#9 ab;background:#9aabba;flex:0 0 auto}.dot.ok{background:#27c06a}.dot.warn{background:#e0a020}.dot.err{background:#e0483a}.dot.live{background:var(--cy);box-shadow:0 0 7px var(--cy);animation:axisPulse 1.5s infinite}' +
    '.ap-count{font-size:11px;font-weight:700;color:#b3261e}' +
    '.ap-auto{background:#f7fbfd;border:1px solid #e3eef4;border-radius:9px;padding:10px;margin-bottom:10px}' +
    '.ap-auto-h{display:flex;justify-content:space-between;align-items:center;font-size:12.5px}.ap-toggle{font-size:10px;font-weight:800;letter-spacing:.1em;padding:3px 9px;border-radius:99px;background:#eceff2;color:#7b8a98}.ap-toggle.on{background:#e6f7ee;color:#137a45}' +
    '.ap-rails{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0}.rail{font-size:9.5px;font-weight:600;color:#33597a;background:#eaf3fb;padding:3px 8px;border-radius:99px}' +
    '.ap-note{font-size:10.5px;color:#6a7d8e;line-height:1.5}' +
    '.ap-row{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:9px 0;border-top:1px solid #f0f4f8}' +
    '.ap-t{font-size:11.5px;color:#28384a;line-height:1.4}.ap-btns{display:flex;gap:6px;flex:0 0 auto}' +
    '.ap-ok,.ap-no{font-size:11px;font-weight:700;border:0;border-radius:7px;padding:6px 11px;cursor:pointer}.ap-ok{background:#27c06a;color:#fff}.ap-no{background:#f0f3f6;color:#62748 5;color:#627485}' +
    '.ap-row.ap-done{opacity:.55}.ap-row.ap-rej{opacity:.45}.ap-row.ap-pending{opacity:.6}.ap-msg{font-size:11px;font-weight:700;color:#137a45}' +
    '.axis-empty{font-size:11.5px;color:#8a9bab;padding:14px 4px;text-align:center}' +
    (window.AxisClaimFigures ? window.AxisClaimFigures.STYLES : '') +
    '@media(max-width:1000px){.axis-grid{grid-template-columns:1fr}.axis-left,.axis-right{flex-direction:column}.axis-fns{grid-template-columns:repeat(3,1fr)}}' +
    '@media(max-width:560px){.axis-fns{grid-template-columns:1fr 1fr}.axis-wrap{padding:14px}.axis-orb{width:78px;height:78px}}';
    document.head.appendChild(s);
  }

  /* ---------- helpers ---------- */
  function pill(t, c) { return '<span class="axis-pill ' + (c || '') + '">' + esc(t) + '</span>'; }
  function span(cls, t) { return '<span class="' + cls + '">' + esc(t) + '</span>'; }
  function dotc(s) { s = String(s || '').toLowerCase(); return s === 'ready' || s === 'ok' || s === 'up' ? 'ok' : s === 'error' || s === 'fail' ? 'err' : s === 'scheduled' || s === 'idle' ? '' : 'warn'; }
  function setHTML(id, h) { var e = document.getElementById(id); if (e) e.innerHTML = h; }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function cssesc(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&'); }
  function rel(iso) { try { var d = new Date(iso), m = (Date.now() - d.getTime()) / 60000; if (isNaN(m)) return ''; if (m < 1) return 'just now'; if (m < 60) return Math.round(m) + 'm ago'; if (m < 1440) return Math.round(m / 60) + 'h ago'; return Math.round(m / 1440) + 'd ago'; } catch (e) { return ''; } }
})();
