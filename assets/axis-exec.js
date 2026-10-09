// axis-exec.js — AXIS executive workspace: on-screen work, automations, approvals, inbox, status.
// Listens to AXIS chat replies (axis-director) and opens the workspace / creates automations when
// Axis decides to. Talks only to /api/axis/exec with the existing Aperture login.
(() => {
  const TOKEN_KEY = 'aperture_jwt';
  const api = async (action, extra = {}) => {
    const r = await origFetch('/api/axis/exec', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem(TOKEN_KEY) || '') }, body: JSON.stringify({ action, ...extra }) });
    return r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const md = (s) => esc(s).replace(/^### (.*)$/gm, '<h4>$1</h4>').replace(/^## (.*)$/gm, '<h3>$1</h3>').replace(/^# (.*)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^- (.*)$/gm, '<li>$1</li>').replace(/\n/g, '<br>');

  const css = document.createElement('style');
  css.textContent = `
  .axx-launch{position:fixed;right:18px;bottom:84px;z-index:60;display:flex;gap:6px}
  .axx-launch button,.axx button.b{background:var(--surface-2);color:var(--txt);border:1px solid var(--line-2);border-radius:999px;padding:7px 12px;font:600 11px var(--sans);letter-spacing:.06em;cursor:pointer}
  .axx-launch button:hover,.axx button.b:hover{border-color:var(--gold);color:var(--gold-2)}
  .axx button.g{background:var(--gold);color:var(--gold-ink);border-color:var(--gold)}
  .axx{position:fixed;top:0;right:0;height:100dvh;width:min(560px,100vw);z-index:70;background:var(--surface);border-left:1px solid var(--line-2);box-shadow:-20px 0 60px rgba(0,0,0,.35);display:flex;flex-direction:column;transform:translateX(100%);transition:transform .25s ease}
  .axx.open{transform:none}
  .axx header{display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid var(--line)}
  .axx header .t{flex:1;font:650 14px var(--sans);color:var(--gold-2)}
  .axx nav{display:flex;gap:4px;padding:8px 12px;border-bottom:1px solid var(--line);overflow-x:auto}
  .axx nav button{background:none;border:0;color:var(--txt);opacity:.6;padding:6px 10px;font:600 11px var(--sans);letter-spacing:.08em;text-transform:uppercase;cursor:pointer;border-bottom:1px solid transparent}
  .axx nav button.on{opacity:1;color:var(--gold-2);border-color:var(--gold)}
  .axx main{flex:1;overflow:auto;padding:14px 16px}
  .axx .card{border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:10px;background:var(--surface-2)}
  .axx .k{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}
  .axx .doc{line-height:1.6}.axx .doc h3,.axx .doc h4{margin:.6em 0 .2em;color:var(--gold-2)}
  .axx textarea,.axx input{width:100%;background:var(--surface-3);color:var(--txt);border:1px solid var(--line-2);border-radius:8px;padding:8px;font:13px var(--sans)}
  .axx .row{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
  .axx .say{margin:0 0 10px;color:var(--gold-2);font-style:italic}
  .axx .dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px;background:var(--line-2)}.axx .dot.on{background:var(--gold)}`;
  document.head.appendChild(css);

  const launch = document.createElement('div');
  launch.className = 'axx-launch'; launch.hidden = true;
  launch.innerHTML = '<button data-tab="work">Workspace</button><button data-tab="auto">Automations</button><button data-tab="apr">Approvals</button>';
  const panel = document.createElement('aside');
  panel.className = 'axx'; panel.setAttribute('aria-label', 'AXIS workspace');
  panel.innerHTML = '<header><span class="t">AXIS · Working with you</span><button class="b" data-close>Close</button></header><nav>' +
    ['work:Workspace', 'auto:Automations', 'apr:Approvals', 'pc:My PC', 'inbox:Inbox', 'brief:Brief', 'setup:Connections'].map((x) => { const [k, l] = x.split(':'); return `<button data-tab="${k}">${l}</button>`; }).join('') +
    '</nav><main></main>';
  document.body.append(launch, panel);
  const main = panel.querySelector('main');
  let tab = 'work', current = null, lastSay = '';

  const open = (t) => { tab = t || tab; panel.classList.add('open'); render(); };
  panel.querySelector('[data-close]').onclick = () => panel.classList.remove('open');
  panel.querySelector('nav').onclick = (e) => { const t = e.target.closest('[data-tab]'); if (t) open(t.dataset.tab); };
  launch.onclick = (e) => { const t = e.target.closest('[data-tab]'); if (t) open(t.dataset.tab); };
  setInterval(() => { launch.hidden = !localStorage.getItem(TOKEN_KEY) || document.getElementById('login')?.offsetParent != null; }, 1500);

  async function render() {
    panel.querySelectorAll('nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    main.innerHTML = '<p class="k">Loading…</p>';
    if (tab === 'work') return renderWork();
    if (tab === 'pc') return renderPc();
    const s = await api('status');
    if (!s.ok) { main.innerHTML = `<p>${esc(s.error || 'Unavailable')}</p>`; return; }
    if (tab === 'auto') {
      main.innerHTML = `<div class="card"><p class="k">New automation</p><textarea id="axxI" rows="3" placeholder="e.g. Every weekday, find 10 Toronto dental clinics needing IT support and draft outreach"></textarea><div class="row"><input id="axxE" type="number" min="15" value="1440" style="width:120px"> <span>minutes between runs</span><button class="b g" id="axxC">Automate</button></div></div>` +
        (s.tasks.map((t) => `<div class="card"><p class="k">${esc(t.status)} · every ${t.every_minutes} min · ${t.runs} runs</p><b>${esc(t.title)}</b><p>${esc(t.last_result?.summary || 'Not run yet')}</p><div class="row"><button class="b" data-tt="${t.id}" data-s="${t.status === 'active' ? 'paused' : 'active'}">${t.status === 'active' ? 'Pause' : 'Resume'}</button>${t.last_result?.output ? `<button class="b" data-view="${t.id}">View work</button>` : ''}<button class="b" data-del="${t.id}">Delete</button></div></div>`).join('') || '<p>No automations yet. Tell Axis “automate …”.</p>');
      main.querySelector('#axxC').onclick = async () => { const v = main.querySelector('#axxI').value.trim(); if (!v) return; await api('tasks.create', { instructions: v, every_minutes: +main.querySelector('#axxE').value }); render(); };
      main.querySelectorAll('[data-tt]').forEach((b) => b.onclick = async () => { await api('tasks.update', { id: b.dataset.tt, status: b.dataset.s }); render(); });
      main.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => { if (confirm('Delete this automation?')) { await api('tasks.delete', { id: b.dataset.del }); render(); } });
      main.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => { const t = s.tasks.find((x) => x.id === b.dataset.view); main.innerHTML = `<button class="b" id="axxBack">Back</button><div class="card doc">${md(t.last_result.output)}</div>`; main.querySelector('#axxBack').onclick = render; });
    }
    if (tab === 'apr') {
      main.innerHTML = s.approvals.map((a) => `<div class="card"><p class="k">${esc(a.kind)}${a.costUsd ? ` · $${a.costUsd}` : ''}</p><b>${esc(a.title)}</b><p>${esc(a.detail)}</p>${a.payload?.text ? `<textarea rows="6" data-edit="${a.id}">${esc(a.payload.text)}</textarea>` : ''}<div class="row"><button class="b g" data-ok="${a.id}">Approve</button><button class="b" data-no="${a.id}">Decline</button></div></div>`).join('') || '<p>Nothing waiting on you.</p>';
      main.querySelectorAll('[data-ok],[data-no]').forEach((b) => b.onclick = async () => { const idv = b.dataset.ok || b.dataset.no; const ed = main.querySelector(`[data-edit="${idv}"]`); await api('approvals.decide', { id: idv, decision: b.dataset.ok ? 'approve' : 'decline', edit: ed?.value }); render(); });
    }
    if (tab === 'inbox') {
      main.innerHTML = '<p class="k">Recent inbox activity</p>' + ((await api('status')).attention || []).map((a) => `<div class="card">${esc(a.title)}<br><span class="k">${new Date(a.t).toLocaleString()}</span></div>`).join('') + '<p>Axis replies to routine mail on the main inbox and drafts anything sensitive into Approvals.</p>';
    }
    if (tab === 'brief') { const b = await api('brief'); main.innerHTML = `<div class="card doc">${md(b.text || b.error || '')}</div>`; }
    if (tab === 'setup') {
      const i = s.integrations;
      const line = (on, l) => `<div><span class="dot ${on ? 'on' : ''}"></span>${esc(l)}</div>`;
      main.innerHTML = `<div class="card">${line(i.claude, 'Claude')}${line(i.apollo, 'Apollo')}${line(i.email, 'Attention emails')}${i.mailboxes.map((m) => line(m.connected, m.address)).join('')}</div><div class="card"><p class="k">Claude models</p>Quick: ${esc(i.models.fast)}<br>Everyday: ${esc(i.models.balanced)}<br>Quality: ${esc(i.models.quality)}<br><span class="k">This month $${s.spend.usd.toFixed(2)} of $${i.monthlyCapUsd} cap · ${s.spend.calls} calls</span></div><button class="b" id="axxTest">Send test attention email</button>`;
      main.querySelector('#axxTest').onclick = async () => { const r = await api('attention.test'); alert(r.ok ? 'Sent.' : 'Not sent — check email setup.'); };
    }
  }

  async function renderPc() {
    const l = await api('local.list');
    if (!l.ok) { main.innerHTML = `<p>${esc(l.error || 'Unavailable')}</p>`; return; }
    const online = (l.devices || []).some((d) => d.online);
    const label = { queued: 'Waiting for PC', running: 'Working', done: 'Done', failed: 'Needs you', needs_approval: 'Needs your OK', declined: 'Declined' };
    main.innerHTML = `<div class="card"><p class="k"><span class="dot ${online ? 'on' : ''}"></span>Axis Local ${online ? 'is running on your PC' : 'is not running'}</p>` +
      (l.devices || []).map((d) => `<div>${esc(d.name)} · ${d.online ? 'online' : d.last_seen ? 'last seen ' + new Date(d.last_seen).toLocaleString() : 'never connected'} <button class="b" data-unpair="${d.id}">Remove</button></div>`).join('') +
      `<div class="row"><a class="b" href="/downloads/axis-local.zip" download style="text-decoration:none">Download Axis Local</a><button class="b g" id="axxPair">Pair this PC</button></div><div id="axxKey"></div></div>` +
      `<div class="card"><p class="k">Give your PC a task</p><textarea id="axxL" rows="3" placeholder="e.g. Build a one-page proposal for Smith Dental in Word format"></textarea><div class="row"><select id="axxLK" class="b"><option value="claude">Work on it (Claude)</option><option value="open">Open site / app / file</option><option value="command">Run a command (needs OK)</option></select><button class="b g" id="axxLGo">Send to PC</button></div></div>` +
      (l.jobs || []).map((j) => `<div class="card"><p class="k">${esc(label[j.status] || j.status)} · ${esc(j.kind)}</p><b>${esc(j.title)}</b>${j.status === 'needs_approval' ? `<pre style="white-space:pre-wrap">${esc(j.instructions)}</pre><div class="row"><button class="b g" data-lok="${j.id}">Approve</button><button class="b" data-lno="${j.id}">Decline</button></div>` : ''}${j.output ? `<div class="doc" style="margin-top:6px">${md(j.output.slice(0, 3000))}</div>` : ''}</div>`).join('');
    main.querySelector('#axxPair').onclick = async () => {
      const r = await api('local.pair', { name: navigator.platform || 'My PC' });
      main.querySelector('#axxKey').innerHTML = r.ok ? `<p>In Axis Local, run <b>pair</b> and paste this key (shown once):</p><input readonly value="${esc(r.key)}" onclick="this.select()">` : esc(r.error || 'Could not pair');
    };
    main.querySelector('#axxLGo').onclick = async () => { const v = main.querySelector('#axxL').value.trim(); if (!v) return; await api('local.enqueue', { kind: main.querySelector('#axxLK').value, instructions: v }); renderPc(); };
    main.querySelectorAll('[data-lok],[data-lno]').forEach((b) => b.onclick = async () => { await api('local.decide', { id: b.dataset.lok || b.dataset.lno, decision: b.dataset.lok ? 'approve' : 'decline' }); renderPc(); });
    main.querySelectorAll('[data-unpair]').forEach((b) => b.onclick = async () => { await api('local.unpair', { id: b.dataset.unpair }); renderPc(); });
    clearTimeout(renderPc.t); renderPc.t = setTimeout(() => { if (tab === 'pc' && panel.classList.contains('open')) renderPc(); }, 8000);
  }

  async function renderWork() {
    const list = await api('workspace.list');
    main.innerHTML = (lastSay ? `<p class="say">${esc(lastSay)}</p>` : '') +
      `<div class="card"><p class="k">${current ? esc(current.kind) + ' · working draft' : 'Pull something up'}</p>${current ? `<h3 style="margin:.2em 0">${esc(current.title)}</h3><div class="doc" id="axxDoc">${md(current.content)}</div>` : '<p>Ask Axis: “pull up my follow-ups for this week and let’s work on it.”</p>'}</div>` +
      `<div class="card"><input id="axxAsk" placeholder="${current ? 'Tell Axis what to change…' : 'What should Axis pull up?'}"><div class="row"><button class="b g" id="axxGo">${current ? 'Update' : 'Pull up'}</button>${current ? '<button class="b" id="axxEdit">Edit myself</button><button class="b" id="axxNew">New</button>' : ''}</div><div class="row" id="axxNext"></div></div>` +
      ((list.docs || []).length ? '<p class="k">Recent</p>' + list.docs.slice(0, 12).map((d) => `<div class="card" data-doc="${d.id}" style="cursor:pointer"><b>${esc(d.title)}</b><br><span class="k">${esc(d.kind)} · ${new Date(d.updated_at).toLocaleString()}</span></div>`).join('') : '');
    const go = async (text) => { if (!text) return; main.querySelector('#axxGo').textContent = 'Working…'; const r = await api(current ? 'workspace.edit' : 'workspace.open', { request: text, id: current?.id }); if (r.ok) { current = r.doc; lastSay = r.say || ''; renderWork().then(() => showNext(r.next)); } else { lastSay = r.error || 'Could not do that yet.'; renderWork(); } };
    main.querySelector('#axxGo').onclick = () => go(main.querySelector('#axxAsk').value.trim());
    main.querySelector('#axxAsk').onkeydown = (e) => { if (e.key === 'Enter') go(e.target.value.trim()); };
    main.querySelector('#axxNew')?.addEventListener('click', () => { current = null; lastSay = ''; renderWork(); });
    main.querySelector('#axxEdit')?.addEventListener('click', () => {
      const docEl = main.querySelector('#axxDoc');
      docEl.outerHTML = `<textarea id="axxRaw" rows="16">${esc(current.content)}</textarea><div class="row"><button class="b g" id="axxSave">Save</button></div>`;
      main.querySelector('#axxSave').onclick = async () => { const r = await api('workspace.save', { id: current.id, content: main.querySelector('#axxRaw').value }); if (r.ok) { current = r.doc; renderWork(); } };
    });
    main.querySelectorAll('[data-doc]').forEach((c) => c.onclick = async () => { const r = await api('workspace.get', { id: c.dataset.doc }); current = r.doc; lastSay = ''; renderWork(); });
    function showNext(next) { const n = main.querySelector('#axxNext'); (next || []).forEach((x) => { const b = document.createElement('button'); b.className = 'b'; b.textContent = x; b.onclick = () => go(x); n.appendChild(b); }); }
  }

  // Watch AXIS chat replies: open the workspace or create automations when Axis decides to.
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const res = await origFetch(input, init);
    try {
      const url = typeof input === 'string' ? input : input.url;
      if (/axis-director/.test(url) && res.ok) {
        res.clone().json().then(async (j) => {
          if (j?.automate?.instructions) { await api('tasks.create', j.automate); open('auto'); }
          if (j?.local?.instructions) { await api('local.enqueue', { ...j.local, tier: j.quality || undefined }); open('pc'); }
          if (j?.workspace) {
            current = null; lastSay = 'Pulling it up…'; open('work');
            const r = await api('workspace.open', { request: j.workspace, tier: j.quality || undefined });
            if (r.ok) { current = r.doc; lastSay = r.say || ''; } else lastSay = r.error || '';
            if (tab === 'work') renderWork();
          }
        }).catch(() => {});
      }
    } catch { /* never break AXIS chat */ }
    return res;
  };
})();
