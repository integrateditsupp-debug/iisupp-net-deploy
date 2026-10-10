// axis-collab.js — Axis's live view of Claude + agents, and screen share / record / capture.
// Claude work flows through the existing axis-brain-queue (worker on Ahmad's machine).
(() => {
  const TOKEN_KEY = 'aperture_jwt';
  const token = () => localStorage.getItem(TOKEN_KEY);
  if (!token()) return;
  const Q = '/.netlify/functions/axis-brain-queue';
  const call = (body) => fetch(Q, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null);
  const say = (text) => window.dispatchEvent(new CustomEvent('axis:say', { detail: { text } }));
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const css = document.createElement('style');
  css.textContent = `
  #axCollab{position:fixed;right:18px;bottom:18px;z-index:9998;width:360px;max-height:72vh;display:flex;flex-direction:column;
    background:rgba(8,12,22,.86);backdrop-filter:blur(18px);border:1px solid rgba(212,175,55,.35);border-radius:18px;
    box-shadow:0 0 40px rgba(212,175,55,.15);color:#e8e6df;font:13px/1.45 system-ui,sans-serif;overflow:hidden}
  #axCollab.min{max-height:46px}
  #axCollab header{display:flex;align-items:center;gap:8px;padding:12px 14px;cursor:pointer;border-bottom:1px solid rgba(212,175,55,.18)}
  #axCollab header b{flex:1;letter-spacing:.08em;font-size:12px;color:#d4af37}
  #axCollab .dot{width:8px;height:8px;border-radius:50%;background:#666}#axCollab .dot.on{background:#3ddc84;box-shadow:0 0 8px #3ddc84}
  #axCollab .tools{display:flex;gap:6px;padding:10px 14px}
  #axCollab button{background:transparent;color:#e8e6df;border:1px solid rgba(212,175,55,.45);border-radius:10px;padding:6px 9px;cursor:pointer;font-size:12px}
  #axCollab button:hover{background:rgba(212,175,55,.12)}#axCollab button.rec{border-color:#ff5a5a;color:#ff8a8a}
  #axCollab form{display:flex;gap:6px;padding:0 14px 10px}#axCollab input{flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:inherit;padding:7px 9px}
  #axCollab ul{list-style:none;margin:0;padding:0 14px 12px;overflow:auto;flex:1}
  #axCollab li{padding:8px 0;border-top:1px solid rgba(255,255,255,.06)}
  #axCollab .st{font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:2px 6px;border-radius:6px;margin-right:6px}
  .st.queued{background:#333}.st.working{background:#7a5c00;color:#ffe08a}.st.done{background:#0d4d2c;color:#9ff0c2}.st.failed{background:#5a1414;color:#ffb0b0}
  #axCollab .ans{color:#a9a69c;margin-top:4px;white-space:pre-wrap;max-height:90px;overflow:auto}
  #axCollab .act{margin-top:4px;display:flex;gap:6px}#axCollab .act button{padding:3px 7px;font-size:11px}
  #axShare{position:fixed;left:18px;bottom:18px;z-index:9997;width:420px;border:1px solid rgba(212,175,55,.45);border-radius:14px;overflow:hidden;background:#000;display:none}
  #axShare video{width:100%;display:block}#axShare span{position:absolute;top:6px;left:8px;font:11px system-ui;color:#d4af37}`;
  document.head.appendChild(css);

  const box = document.createElement('div');
  box.id = 'axCollab';
  box.innerHTML = `<header><span class="dot" id="axDot"></span><b>AXIS · CLAUDE &amp; AGENTS</b><small id="axCount"></small></header>
    <div class="tools"><button id="axShareBtn">Share screen</button><button id="axRecBtn">Record</button><button id="axCapBtn">Capture</button></div>
    <form id="axSend"><input id="axTask" placeholder="Send Claude a task…" autocomplete="off"><button>Send</button></form>
    <ul id="axJobs"><li>Loading jobs…</li></ul>`;
  document.body.appendChild(box);
  const share = document.createElement('div');
  share.id = 'axShare'; share.innerHTML = '<span>● Shared with Axis</span><video autoplay muted playsinline></video>';
  document.body.appendChild(share);
  box.querySelector('header').onclick = () => box.classList.toggle('min');

  // ── Claude jobs: send, track, change, cancel; announce when Claude takes it and when it's done.
  const known = new Map();
  let first = true;
  const render = (d) => {
    document.getElementById('axDot').className = 'dot' + (d.online ? ' on' : '');
    document.getElementById('axDot').title = d.online ? 'Claude worker online' : 'Claude worker offline — tasks wait in the queue';
    const active = d.jobs.filter((j) => j.state === 'queued' || j.state === 'working').length;
    document.getElementById('axCount').textContent = active ? `${active} active` : '';
    document.getElementById('axJobs').innerHTML = d.jobs.length ? d.jobs.map((j) => `<li data-id="${esc(j.id)}">
      <span class="st ${j.state}">${j.state}</span><b>${esc(j.kind)}</b> · ${esc(j.arg).slice(0, 120)}
      ${j.answer || j.error ? `<div class="ans">${esc(j.error || j.answer)}</div>` : ''}
      ${j.state === 'queued' ? '<div class="act"><button data-a="amend">Change</button><button data-a="cancel">Cancel</button></div>' : ''}
      ${j.state === 'done' || j.state === 'failed' ? '<div class="act"><button data-a="follow">Follow up</button></div>' : ''}</li>`).join('') : '<li>No Claude jobs yet.</li>';
    for (const j of d.jobs) {
      const prev = known.get(j.id);
      if (!first && prev !== j.state) {
        if (j.state === 'working') say(`Claude picked up "${j.arg.slice(0, 60)}" and is working on it.`);
        if (j.state === 'done') say(`Claude finished "${j.arg.slice(0, 60)}". ${String(j.answer || '').slice(0, 200)}`);
        if (j.state === 'failed') say(`Claude hit a problem on "${j.arg.slice(0, 60)}": ${j.error}`);
      }
      known.set(j.id, j.state);
    }
    first = false;
  };
  const refresh = async () => { const d = await call({ action: 'jobs' }); if (d?.ok) render(d); };
  window.axisClaude = {
    send: async (text, kind = 'code.build') => {
      const r = await call({ action: 'task', kind, arg: text, confirmed: true });
      say(r?.ok ? `Sent to Claude (${r.id}). I'll tell you when it's picked up and when it's done.` : `Couldn't queue it: ${r?.error || r?.detail || 'no response'}`);
      refresh(); return r;
    },
    jobs: () => call({ action: 'jobs' }),
    refresh,
  };
  document.getElementById('axSend').onsubmit = (e) => {
    e.preventDefault(); const i = document.getElementById('axTask'); const v = i.value.trim(); if (!v) return;
    i.value = ''; window.axisClaude.send(v);
  };
  document.getElementById('axJobs').onclick = async (e) => {
    const a = e.target.dataset?.a; if (!a) return;
    const li = e.target.closest('li'); const id = li.dataset.id;
    if (a === 'cancel' && confirm('Cancel this Claude job?')) { await call({ action: 'task.cancel', id }); say('Cancelled.'); }
    if (a === 'amend') { const v = prompt('New instructions for Claude:'); if (v) { const r = await call({ action: 'task.amend', id, arg: v }); say(r?.ok ? 'Updated the job.' : r?.detail); } }
    if (a === 'follow') { const v = prompt('Follow-up for Claude on this job:'); if (v) window.axisClaude.send(`Follow-up to job ${id}: ${v}`); }
    refresh();
  };
  refresh(); setInterval(refresh, 15000);

  // ── Screen share / record / capture (browser asks you which screen or window each time).
  let stream = null, rec = null, chunks = [];
  const video = share.querySelector('video');
  const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const getStream = async () => {
    if (stream?.active) return stream;
    stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
    video.srcObject = stream; share.style.display = 'block';
    stream.getVideoTracks()[0].onended = () => { share.style.display = 'none'; shareBtn.textContent = 'Share screen'; if (rec?.state === 'recording') rec.stop(); stream = null; };
    return stream;
  };
  const shareBtn = document.getElementById('axShareBtn');
  shareBtn.onclick = async () => {
    if (stream?.active) { stream.getTracks().forEach((t) => t.stop()); return; }
    try { await getStream(); shareBtn.textContent = 'Stop sharing'; say('I can see your screen now. Tell me what to work on.'); } catch { say('Screen sharing was cancelled.'); }
  };
  const recBtn = document.getElementById('axRecBtn');
  recBtn.onclick = async () => {
    if (rec?.state === 'recording') { rec.stop(); return; }
    try {
      const s = await getStream(); chunks = [];
      rec = new MediaRecorder(s, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm' });
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => { download(new Blob(chunks, { type: 'video/webm' }), `axis-recording-${stamp()}.webm`); recBtn.textContent = 'Record'; recBtn.classList.remove('rec'); say('Recording saved to your downloads.'); };
      rec.start(1000); recBtn.textContent = 'Stop recording'; recBtn.classList.add('rec'); say('Recording your screen.');
    } catch { say('Recording was cancelled.'); }
  };
  document.getElementById('axCapBtn').onclick = async () => {
    try {
      const wasLive = stream?.active; const s = await getStream();
      await new Promise((r) => setTimeout(r, wasLive ? 50 : 500));
      const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
      c.getContext('2d').drawImage(video, 0, 0);
      c.toBlob((b) => { download(b, `axis-capture-${stamp()}.png`); say('Screenshot captured and saved.'); });
      if (!wasLive) s.getTracks().forEach((t) => t.stop());
    } catch { say('Capture was cancelled.'); }
  };
})();
