/* ============================================================================
   Live wiring — unchanged data contract:
   - aperture-auth (login)              token key: aperture_jwt
   - aria-learning-status (Bearer)      real ARIA telemetry
   - aria-escalation?action=tickets|chatlog|ticket|chatpost
   - aperture-email-report (POST)
   ============================================================================ */
function readApertureToken(){
  let raw = '';
  try { raw = localStorage.getItem('aperture_jwt') || localStorage.getItem('aperture_token_v1') || ''; } catch {}
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.token) return parsed.token;
  } catch {}
  return raw;
}
let TOKEN = readApertureToken();
let POLL = null;
const HEALTH_HIST = [];

const AGENT_LABELS = {
  l1:'L1 Helpdesk', l2:'L2 Support', l3:'L3 Engineer', security:'Security', networking:'Network',
  hardware:'Hardware', software:'Software', saas:'SaaS', m365:'M365', automation:'Automation',
  ai_eng:'AI Eng', prompt_eng:'Prompt Eng', business_ops:'Business Ops', audit:'Audit',
  revenue_opp:'Revenue', ux:'UX', kb:'Knowledge', memory:'Memory', rca:'RCA', escalation:'Escalation',
  R1:'Research #1', R2:'Research #2', R3:'Research #3', ARIA:'ARIA', 'research-pool':'Research Pool',
  user:'User', 'support-team':'Support', operator:'Operator', system:'System', 'all-agents':'All agents'
};
const KIND_META = {
  escalation:{label:'Escalation raised', dot:'crit'},
  'no-solution':{label:'Awaiting human review', dot:'high'},
  resolved:{label:'Ticket resolved', dot:'ok'},
  solution:{label:'Solution found', dot:'norm'},
  spawn:{label:'Agent spawned', dot:'norm'},
  nudge:{label:'Operator nudge', dot:'low'},
  msg:{label:'Agent message', dot:'low'}
};
const OFFICE_AGENTS = [
  { id:'R1', name:'Research Agent #1', role:'Research', cls:'oa-research', base:'checking live scenario gaps', talks:'Research Pool', seed:2 },
  { id:'security', name:'Security Agent', role:'Security', cls:'oa-security', base:'reviewing risk signals', talks:'Human Review', seed:7 },
  { id:'report', name:'Report Agent', role:'Reporting', cls:'oa-report', base:'building operator summary', talks:'Ahmad', seed:11 },
  { id:'l1', name:'Support Agent', role:'L1 Support', cls:'oa-support', base:'walking a user through first checks', talks:'User', seed:17 },
  { id:'audit', name:'Data Analyst', role:'Analytics', cls:'oa-data', base:'clustering repeated tickets', talks:'ARIA Router', seed:23 },
  { id:'ai_eng', name:'Code Auditor', role:'Code QA', cls:'oa-code', base:'checking a patch before promote', talks:'Claude Code', seed:31 }
];
const OFFICE_ACTIONS = [
  'checking Outlook crash patterns',
  'summarizing a Microsoft 365 ticket',
  'preparing human handoff notes',
  'comparing KB answer quality',
  'reviewing a security escalation',
  'indexing a newly resolved issue',
  'routing a user to safe first steps',
  'waiting on Ahmad approval gate'
];
let OFFICE_STATE = [];
let OFFICE_TIMER = null;
let OFFICE_CAPTION_INDEX = 0;

if (TOKEN) showApp();

/* ── auth ─────────────────────────────────────────────────────────── */
function doLogin(){
  const u = val('user'), p = val('pass');
  $('login-err').textContent = '';
  fetch('/.netlify/functions/aperture-auth', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ email:u, password:p })
  }).then(async r=>{
    const text = await r.text();
    let j = {};
    try { j = text ? JSON.parse(text) : {}; } catch { j = { error:text || 'non-JSON response' }; }
    if (r.ok && j.token){
      TOKEN=j.token;
      localStorage.setItem('aperture_jwt',TOKEN);
      localStorage.removeItem('aperture_token_v1');
      showApp();
    }
    else $('login-err').textContent = j.error || ('Authentication failed ('+r.status+')');
  }).catch(()=>{ $('login-err').textContent='Network error'; });
}
function logout(){
  TOKEN='';
  localStorage.removeItem('aperture_jwt');
  localStorage.removeItem('aperture_token_v1');
  if (POLL) clearInterval(POLL);
  $('app').style.display='none'; $('login').style.display='flex';
}
function authHeaders(extra){
  return Object.assign({ 'Authorization':'Bearer '+TOKEN }, extra || {});
}
function showApp(){
  $('login').style.display='none'; $('app').style.display='block';
  tickClock(); setInterval(tickClock,1000);
  try {
    renderAgentOffice([], [], {}, [], [], {});
    if (!OFFICE_TIMER) OFFICE_TIMER = setInterval(renderOfficeTimers,1000);
  } catch(e) {}
  loadAll(); POLL=setInterval(loadAll,4000);
}
function tickClock(){
  const d=new Date();
  $('clock').textContent = d.toLocaleDateString('en-US',{month:'short',day:'numeric'}).toUpperCase()
    +'  '+ d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
}

/* ── data load ───────────────────────────────────────────────────── */
async function loadAll(){
  const headers = authHeaders();
  let ok = true;
  try {
    const [sR,tR,cR,dR,mR] = await Promise.all([
      fetch('/.netlify/functions/aria-learning-status',{headers}),
      fetch('/.netlify/functions/aria-escalation?action=tickets',{headers}),
      fetch('/.netlify/functions/aria-escalation?action=chatlog',{headers}),
      fetch('/api/senior-director-agent',{headers}).catch((e)=>({ ok:false, status:0, error:e })),
      fetch('/api/mesh-events?limit=60',{headers}).catch((e)=>({ ok:false, status:0, error:e }))
    ]);
    if (sR.status === 401 || tR.status === 401 || cR.status === 401) ok = false;
    const status  = await sR.json().catch(()=>({}));
    const tickets = (await tR.json().catch(()=>({}))).tickets || [];
    const msgs    = (await cR.json().catch(()=>({}))).messages || [];
    const director = dR && dR.ok ? (await dR.json().catch(()=>({}))).digest : null;
    const mesh = mR && mR.ok ? (await mR.json().catch(()=>({}))) : {};
    renderStats(status, tickets);
    renderLearning(status);
    renderTickets(tickets);
    renderSLA(tickets);
    renderActive(msgs);
    renderComms(msgs);
    renderTimeline(msgs);
    renderHealth(tickets);
    renderDirector(director, dR);
    renderMeshActivity(mesh.events||[], status.agents, mesh.stats);
    try { renderAgentOffice(mesh.events||[], status.agents, mesh.stats, msgs, tickets, status); } catch(e) {}
  } catch(e){ ok=false; }
  setConn(ok);
}
function setConn(live){
  const p=$('conn'); p.className = 'pill '+(live?'live':'down');
  $('conn-txt').textContent = live ? 'Live · connected' : 'Reconnecting…';
}

/* ── render: hero stats ──────────────────────────────────────────── */
function renderStats(s, t){
  const logged   = t.length;
  const resolved = t.filter(x=>x && (x.status==='resolved'||x.status==='closed')).length;
  const escal    = t.filter(x=>x && (x.status==='escalated'||x.status==='awaiting-human'||x.status==='awaiting_human')).length;
  const open     = Math.max(0, logged - resolved);
  const autonomy = logged ? Math.round(resolved/logged*100) : null;

  countTo('auto-num', autonomy==null?0:autonomy, '%');
  $('auto-bar').style.width = (autonomy||0)+'%';
  $('auto-note').innerHTML = autonomy==null ? 'Awaiting first ticket'
    : '<b>'+resolved+'</b> of <b>'+logged+'</b> resolved without a human';

  countTo('tix-open', open);
  countTo('tix-res', resolved); countTo('tix-esc', escal); countTo('tix-logged', logged);

  const bits = num(s.totalBits), kb = num(s.kbLiveCount), q = num(s.queueDepth);
  countTo('bits-num', bits); countTo('kb-live', kb);
  $('queue-depth').textContent = q;

  const roster = Array.isArray(s.agents) ? s.agents.length : 0;
  countTo('agents-active', roster);
  $('agents-born').textContent = num(s.newAgentsBorn);
  const hasQueueDepth = Object.prototype.hasOwnProperty.call(s || {}, 'queueDepth');
  setText('dock-resolved', logged ? String(resolved) : '--');
  setText('dock-tasks', logged ? String(open) : (hasQueueDepth ? String(q) : '--'));
  setText('dock-agents', roster ? String(roster) : '--');
}

/* ---- render: Senior Director visibility ------------------------------------ */
function renderDirector(d, response){
  const statusChip = $('director-status');
  if (!d) {
    const code = response && typeof response.status !== 'undefined' ? response.status : 'offline';
    statusChip.textContent = code === 404 ? 'not deployed' : 'attention';
    statusChip.className = 'chip warn';
    $('director-updated').textContent = 'Director API unavailable on this deployment';
    $('director-agents').textContent = '-';
    $('director-queue').textContent = '-';
    $('director-hot').textContent = '-';
    $('director-scanned').textContent = '-';
    $('director-lead-chip').textContent = 'no feed';
    $('director-lead-chip').className = 'chip warn';
    $('director-leads').innerHTML = '<div class="empty">Director feed unavailable. Check deployment and Aperture auth.</div>';
    $('director-work').innerHTML = '<div class="empty">No Director queue visible from this page.</div>';
    $('director-approvals').innerHTML = '<div class="director-item"><div class="name">Hard stop remains active</div><div class="sub">No spend, outreach, final tenders, contracts, or irreversible actions without Ahmad.</div></div>';
    return;
  }

  statusChip.textContent = 'operational';
  statusChip.className = 'chip ok';
  $('director-updated').textContent = 'Updated ' + timeAgo(d.generatedAt || Date.now());
  $('director-agents').textContent = (d.agents?.active ?? 0) + '/' + (d.agents?.total ?? 0);
  $('director-queue').textContent = d.queue?.pending ?? 0;
  $('director-hot').textContent = d.leads?.hot ?? 0;
  $('director-scanned').textContent = d.leads?.scanned ?? 0;
  $('director-mission').textContent = (d.policy?.mission || [])[0] || 'Mission: grow IIS revenue and profit while protecting approval gates.';

  const leadCount = d.leads?.count ?? 0;
  const leadChip = $('director-lead-chip');
  leadChip.textContent = leadCount + ' lead' + (leadCount === 1 ? '' : 's');
  leadChip.className = 'chip ' + ((d.leads?.hot || 0) ? 'warn' : 'ok');
  const leads = Array.isArray(d.leads?.matches) ? d.leads.matches.slice(0, 5) : [];
  $('director-leads').innerHTML = leads.length ? leads.map((m)=>{
    const close = m.close ? 'closes ' + esc(m.close) : 'closing date pending';
    const org = m.org ? esc(m.org) : 'unknown buyer';
    const title = esc(m.title || 'Untitled opportunity');
    const url = m.url ? esc(m.url) : '';
    return '<div class="director-item"><div class="top"><div><div class="name">'
      + (url ? '<a href="'+url+'" target="_blank" rel="noopener">'+title+'</a>' : title)
      + '</div><div class="sub">'+org+' - '+close+'</div></div>'
      + (m.hot ? '<span class="chip warn">hot</span>' : '<span class="chip">review</span>')
      + '</div></div>';
  }).join('') : '<div class="empty">No current lead-radar matches. Director continues scanning.</div>';

  const pending = Array.isArray(d.queue?.newestPending) ? d.queue.newestPending.slice(-4).reverse() : [];
  const attention = Array.isArray(d.events?.attention) ? d.events.attention.slice(-3).reverse() : [];
  const attentionChip = $('director-attention-chip');
  attentionChip.textContent = attention.length ? attention.length + ' attention' : 'clear';
  attentionChip.className = 'chip ' + (attention.length ? 'warn' : 'ok');
  const workRows = [];
  pending.forEach((t)=>{
    workRows.push('<div class="director-item"><div class="name">'+esc(t.target || 'agent')+'</div><div class="sub">'
      + esc((t.payload?.instruction || '').slice(0, 180) || 'Pending task') + '</div></div>');
  });
  attention.forEach((e)=>{
    workRows.push('<div class="director-item"><div class="name">'+esc(e.kind || 'attention')+'</div><div class="sub">'
      + esc(e.error || e.agentId || 'Review required') + '</div></div>');
  });
  $('director-work').innerHTML = workRows.length ? workRows.join('') : '<div class="empty">No pending dispatches or attention events.</div>';

  const approvals = Array.isArray(d.policy?.requiresApproval) ? d.policy.requiresApproval.slice(0, 4) : [];
  $('director-approvals').innerHTML = approvals.length ? approvals.map((a)=>
    '<div class="director-item"><div class="name">Requires approval</div><div class="sub">'+esc(a)+'</div></div>'
  ).join('') : '<div class="director-item"><div class="name">Default approval gate</div><div class="sub">Ahmad approval required before spend, outreach, public commitments, credentials, or final paperwork.</div></div>';
}

/* ── render: learning loop ───────────────────────────────────────── */
function renderLearning(s){
  countTo('loop-bits', num(s.totalBits));
  countTo('loop-kb', num(s.kbLiveCount));
  countTo('loop-queue', num(s.queueDepth));
  const recentBits = Array.isArray(s.recentBits) ? s.recentBits : [];
  const roster = Array.isArray(s.agents)?s.agents:[];
  const hasLearningData = !!(num(s.totalBits) || num(s.kbLiveCount) || num(s.queueDepth) || s.lastTopic || s.lastAgent || recentBits.length || roster.length);
  const loopChip = $('loop-chip');
  if (loopChip){ loopChip.textContent = hasLearningData ? 'running' : 'awaiting data'; loopChip.className = 'chip ' + (hasLearningData ? 'ok' : ''); }

  const now = $('loop-now');
  if (s.lastTopic || s.lastAgent){
    now.innerHTML = '<div class="row"><div class="dot ok"></div><div class="body">'
      + '<div class="t"><b>'+esc(s.lastTopic||'—')+'</b></div>'
      + '<div class="sub">'+esc(label(s.lastAgent)||'learning agent')
      + (s.sessionStarted?' · since '+timeAgo(s.sessionStarted):'')+'</div></div></div>';
    // recent bits underneath
    const bits = recentBits.slice(-5).reverse();
    if (bits.length){
      now.innerHTML += bits.map(b=>{
        const topic = b.topic || b.title || b.text || b.insight || (typeof b==='string'?b:'bit recorded');
        const who = label(b.agent || b.from || b.by);
        const ts = b.ts || b.at || b.time;
        return '<div class="row"><div class="dot norm"></div><div class="body"><div class="t">'+esc(String(topic).slice(0,90))
          +'</div><div class="sub">'+esc(who||'agent')+(ts?' · '+timeAgo(ts):'')+'</div></div></div>';
      }).join('');
    }
  } else now.innerHTML = '<div class="empty">Idle · awaiting topics</div>';

  $('roster').innerHTML = roster.length
    ? roster.slice(0,24).map(a=>'<span class="r-chip'+(a.born?' born':'')+'"><span class="led"></span>'
        +esc(label(a.name)||a.name||'agent')+'</span>').join('')
    : '<div class="empty">Roster initialising…</div>';
}

/* ── render: live agent activity (mesh) ──────────────────────────── */
function renderMeshActivity(events, roster, stats){
  const list = $('mesh-list'), chip = $('mesh-chip');
  const nowTs = Date.now();
  // latest event per agent
  const byAgent = {};
  (events||[]).forEach(e=>{
    if (!e || !e.agentId) return;
    const cur = byAgent[e.agentId];
    if (!cur || (e.ts||0) > (cur.ts||0)) byAgent[e.agentId] = e;
  });
  // fold in roster agents that have no recent mesh event (so the full fleet shows)
  (Array.isArray(roster)?roster:[]).forEach(a=>{
    const id = a && (a.name || a.id);
    if (id && !byAgent[id]) byAgent[id] = { agentId:id, ts:0, kind:'idle', success:true, role:a.role };
  });
  const counts = (stats && stats.agentCounts) || {};
  const rows = Object.values(byAgent).sort((a,b)=>(b.ts||0)-(a.ts||0));
  const activeCount = rows.filter(r=>r.ts && (nowTs - r.ts) < 180000).length;
  chip.textContent = activeCount + ' active · ' + rows.length + ' agents';
  chip.className = 'chip ' + (activeCount ? 'accent' : '');
  if (!rows.length){ list.innerHTML = '<div class="empty">No agent activity yet · mesh idle</div>'; return; }
  list.innerHTML = rows.slice(0,24).map(r=>{
    const age = r.ts ? (nowTs - r.ts) : Infinity;
    const dot = !r.ts ? 'low' : age<120000 ? 'ok' : age<300000 ? 'high' : 'norm';
    const name = esc(label(r.agentId) || r.agentId);
    const n = counts[r.agentId] ? (' · '+counts[r.agentId]+' events/24h') : '';
    const action = (r.kind==='idle')
      ? 'idle · standing by'
      : esc(String(r.kind||'event')) + (r.hop?(' · hop '+r.hop):'') + (r.success===false?' · retry':'');
    const when = r.ts ? timeAgo(r.ts) : 'no run in 24h';
    return '<div class="row"><div class="dot '+dot+'"></div><div class="body">'
      + '<div class="t"><b>'+name+'</b></div>'
      + '<div class="sub">'+action+' · '+when+n+'</div></div></div>';
  }).join('');
}

/* ── render: tickets ─────────────────────────────────────────────── */
/* ---- render: live office scene ------------------------------------------- */
function renderAgentOffice(events, roster, stats, msgs, tickets, status){
  const host = $('office-agents');
  if (!host) return;
  const now = Date.now();
  const eventByAgent = {};
  (events||[]).forEach(e=>{
    if (!e || !e.agentId) return;
    const ts = typeof e.ts === 'string' ? new Date(e.ts).getTime() : Number(e.ts || 0);
    if (!eventByAgent[e.agentId] || ts > eventByAgent[e.agentId]._ts) eventByAgent[e.agentId] = Object.assign({}, e, {_ts:ts});
  });
  const msgByAgent = {};
  (msgs||[]).forEach(m=>{
    if (!m) return;
    const from = m.from || m.agent || m.a;
    if (!from) return;
    const ts = typeof (m.ts||m.timestamp) === 'string' ? new Date(m.ts||m.timestamp).getTime() : Number(m.ts||m.timestamp||0);
    if (!msgByAgent[from] || ts > msgByAgent[from]._ts) msgByAgent[from] = Object.assign({}, m, {_ts:ts});
  });
  const openTickets = (tickets||[]).filter(t=>t && t.status !== 'resolved' && t.status !== 'closed');
  const hasTelemetry = Object.keys(eventByAgent).length > 0
    || Object.keys(msgByAgent).length > 0
    || openTickets.length > 0
    || (Array.isArray(status?.agents) && status.agents.length > 0);
  OFFICE_STATE = OFFICE_AGENTS.map((agent, i)=>{
    const event = eventByAgent[agent.id] || eventByAgent[agent.name] || eventByAgent[agent.role];
    const msg = msgByAgent[agent.id] || msgByAgent[agent.name] || msgByAgent[agent.role];
    const startedAt = event && event._ts ? event._ts : (msg && msg._ts ? msg._ts : now);
    const ticket = openTickets[(i + Math.floor(now / 15000)) % Math.max(1, openTickets.length)];
    let doing = agent.base;
    if (event && event.kind) doing = String(event.kind).replace(/[-_]/g,' ') + (event.success === false ? ' - retrying safely' : '');
    else if (msg && msg.text) doing = String(msg.text).slice(0, 74);
    else if (ticket && (agent.id === 'l1' || agent.id === 'security')) doing = 'triaging ' + String(ticket.issue || ticket.summary || ticket.id || 'open ticket').slice(0, 54);
    else if (!hasTelemetry) doing = 'standing by for authenticated telemetry';
    else doing = 'visible in roster; no current event';
    const talks = msg && msg.to ? label(msg.to) : (event && event.to ? label(event.to) : (hasTelemetry ? agent.talks : 'Aperture gate'));
    const active = (event && event._ts && now - event._ts < 180000) || (msg && msg._ts && now - msg._ts < 180000);
    return {
      id:agent.id,
      name:agent.name,
      role:agent.role,
      cls:agent.cls,
      doing,
      talks,
      active,
      startedAt,
      count:(stats && stats.agentCounts && (stats.agentCounts[agent.id] || stats.agentCounts[agent.name])) || 0
    };
  });
  host.innerHTML = OFFICE_STATE.map(agent=>renderOfficeAgent(agent)).join('');
  renderOfficeTimers();
}

function renderOfficeAgent(agent){
  const stateClass = agent.active ? 'is-live' : 'is-standby';
  const talkLabel = agent.active ? 'talking to ' : 'linked to ';
  return '<div class="office-agent '+esc(agent.cls)+' '+stateClass+'" data-office-agent="'+esc(agent.id)+'">'
    + '<div class="agent-status"><div class="name"><i style="background:'+ (agent.active ? 'var(--ok)' : 'var(--txt-3)') +'"></i><span>'+esc(agent.name)+'</span></div>'
    + '<div class="doing">'+esc(agent.doing)+'</div><div class="talk">'+talkLabel+esc(agent.talks||'ARIA Router')+'</div></div>'
    + '<div class="agent-pulse"></div><div class="agent-screen"></div><div class="agent-person"><span class="agent-head"></span><span class="agent-body"></span><span class="agent-arm"></span></div>'
    + '<div class="agent-desk"></div><div class="agent-time" data-office-time="'+esc(agent.id)+'">00:00</div></div>';
}

function renderOfficeTimers(){
  const now = Date.now();
  if (!$('office-agents') || !OFFICE_STATE.length) return;
  OFFICE_STATE.forEach(agent=>{
    const el = document.querySelector('[data-office-time="'+agent.id.replace(/"/g,'')+'"]');
    if (el) el.textContent = fmtDuration(Math.max(0, now - agent.startedAt));
  });
  const active = OFFICE_STATE.filter(a=>a.active).length;
  if (!active){
    setText('office-shift', 'standby - waiting for authenticated telemetry');
    setText('office-caption-line', 'No current agent activity is being claimed. Authenticated mesh events light this room.');
    setText('office-caption-time', '--:--');
    return;
  }
  const caption = OFFICE_STATE[Math.floor(now / 4000) % OFFICE_STATE.length];
  setText('office-shift', active + ' active agents - ' + OFFICE_STATE.length + ' on shift');
  if (caption) {
    setText('office-caption-line', caption.name + ' is ' + caption.doing + ' while talking to ' + (caption.talks || 'ARIA Router') + '.');
    setText('office-caption-time', fmtDuration(now - caption.startedAt));
  }
}

function fmtDuration(ms){
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return h + 'h ' + String(m).padStart(2,'0') + 'm';
  return String(m).padStart(2,'0') + ':' + String(r).padStart(2,'0');
}

function renderTickets(t){
  const open = t.filter(x=>x && x.status!=='resolved' && x.status!=='closed');
  $('tkt-chip').textContent = open.length+' open';
  $('tkt-chip').className = 'chip '+(open.length?'warn':'ok');
  const list = (t.length? t.slice().reverse().slice(0,8) : []);
  if (!list.length){ $('tkt-list').innerHTML='<div class="empty">No tickets logged</div>'; return; }
  $('tkt-list').innerHTML = list.map(x=>{
    const pri = (x.priority||'normal').toLowerCase();
    const dot = pri==='critical'?'crit':pri==='high'?'high':pri==='low'?'low':'norm';
    const issue = x.issue || x.summary || x.title || x.id || 'untitled';
    return '<div class="row tappable" onclick="viewTicket(\''+esc(String(x.id)).replace(/'/g,"\\'")+'\')">'
      +'<div class="dot '+dot+'"></div><div class="body"><div class="t">'+esc(String(issue).slice(0,72))+'</div>'
      +'<div class="sub">'+esc(String(x.id||''))+(x.userEmail?' · '+esc(x.userEmail):'')+'</div></div>'
      +'<span class="pri '+pri+'">'+esc(pri)+'</span></div>';
  }).join('');
}

/* ── render: SLA ─────────────────────────────────────────────────── */
function renderSLA(t){
  const logged = t.length;
  const resolved = t.filter(x=>x && (x.status==='resolved'||x.status==='closed'));
  const escal = t.filter(x=>x && (x.status==='escalated'||x.status==='awaiting-human'||x.status==='awaiting_human')).length;
  if (!logged){
    setKV('sla-fcr','--','');
    setKV('sla-resp','--','');
    setKV('sla-rest','--','');
    setKV('sla-state','Awaiting data','');
    const chip=$('sla-chip'); chip.textContent='Awaiting data'; chip.className='chip';
    return;
  }
  const fcr = logged ? Math.round(resolved.length/logged*100) : 100;
  setKV('sla-fcr', fcr+'%', fcr>=90?'ok':fcr>=70?'warn':'bad');

  const timed = resolved.filter(x=>x.createdAt && x.updatedAt);
  if (timed.length){
    const m = timed.reduce((a,x)=>a+(new Date(x.updatedAt)-new Date(x.createdAt)),0)/timed.length/60000;
    setKV('sla-resp', Math.max(1,Math.round(m))+' min', m<=60?'ok':m<=120?'warn':'bad');
  } else setKV('sla-resp','—','');

  const escDone = resolved.filter(x=>x.escalatedAt || x.priority==='critical' || x.priority==='high');
  if (escDone.length){
    const h = escDone.reduce((a,x)=>a+(new Date(x.updatedAt||Date.now())-new Date(x.createdAt)),0)/escDone.length/3600000;
    setKV('sla-rest', h.toFixed(1)+' h', h<=16?'ok':h<=48?'warn':'bad');
  } else setKV('sla-rest','—','');

  let state, cls;
  if (escal===0 && logged>0){ state='Excellent'; cls='ok'; }
  else if (fcr>=80){ state='On track'; cls='ok'; }
  else if (fcr>=60){ state='At risk'; cls='warn'; }
  else { state='Breached'; cls='bad'; }
  setKV('sla-state', state, cls);
  const chip=$('sla-chip'); chip.textContent=state; chip.className='chip '+(cls==='bad'?'crit':cls);
}

/* ── render: active agents (chatlog, last 3 min) ─────────────────── */
function renderActive(msgs){
  const now=Date.now(), active={};
  msgs.forEach(m=>{
    if(!m) return;
    const tsRaw=m.ts||m.timestamp||m.t, ts=typeof tsRaw==='string'?new Date(tsRaw).getTime():Number(tsRaw);
    const agent=m.from||m.agent||m.a;
    if(!agent||!ts) return;
    const age=now-ts;
    if(age<180000 && (!active[agent]||age<active[agent])) active[agent]=age;
  });
  const list=Object.entries(active).sort((a,b)=>a[1]-b[1]);
  $('active-chip').textContent=list.length+' active';
  if(!list.length){ $('active-list').innerHTML='<div class="empty">No agent activity in last 3 min</div>'; return; }
  $('active-list').innerHTML=list.map(([a,age])=>
    '<div class="agent-row"><span class="led"></span><span class="nm">'+esc(label(a)||a)+'</span>'
    +'<span class="age">'+Math.round(age/1000)+'s</span>'
    +'<button class="mini-btn" onclick="nudge(\''+esc(a).replace(/'/g,"\\'")+'\',this)">Nudge</button></div>').join('');
}

/* ── render: comms BIT stream ────────────────────────────────────── */
function renderComms(msgs){
  if(!msgs.length){ $('comms').innerHTML='<div class="empty">Awaiting agent activity…</div>'; return; }
  const box=$('comms'); const atTop=box.scrollTop<40;
  box.innerHTML = msgs.slice(-18).reverse().map(m=>{
    const ts=fmtTime(m.ts||m.timestamp||Date.now());
    const from=label(m.from)||m.from||'?', to=label(m.to)||m.to||'?';
    const text=(m.text||m.message||'').toString();
    const alert=(m.kind==='escalation'||m.kind==='no-solution')?' alert':'';
    return '<div class="bit'+alert+'"><div class="h"><span class="route">@'+esc(from)+' <span style="color:var(--txt-3)">→</span> <span class="to">@'+esc(to)+'</span></span><span class="ts">'+ts+'</span></div>'
      +'<div class="hash">'+bitHash(text)+'</div>'
      +'<div class="msg">'+esc(text.slice(0,160))+'</div></div>';
  }).join('');
  if(atTop) box.scrollTop=0;
}

/* ── render: activity timeline ───────────────────────────────────── */
function renderTimeline(msgs){
  const items=msgs.filter(m=>m && KIND_META[m.kind] && m.kind!=='msg').slice(-8).reverse();
  if(!items.length){ $('timeline').innerHTML='<div class="empty">No events yet</div>'; return; }
  $('timeline').innerHTML=items.map(m=>{
    const meta=KIND_META[m.kind]||KIND_META.msg;
    return '<div class="row"><div class="dot '+meta.dot+'"></div><div class="body"><div class="t">'+esc(meta.label)
      +(m.ticketId?' <span class="sub" style="display:inline">#'+esc(m.ticketId)+'</span>':'')+'</div></div>'
      +'<span class="ts">'+fmtTime(m.ts||m.timestamp||Date.now())+'</span></div>';
  }).join('');
}

/* ── render: system health ───────────────────────────────────────── */
function renderHealth(t){
  const logged=t.length;
  const resolved=t.filter(x=>x && (x.status==='resolved'||x.status==='closed')).length;
  const escal=t.filter(x=>x && (x.status==='escalated'||x.status==='awaiting-human'||x.status==='awaiting_human')).length;
  if (!logged){
    const numEl = $('health-num');
    if (numEl) numEl.innerHTML = '--<span class="unit" style="font-size:18px;color:var(--txt-2)">%</span>';
    setText('dock-health', '--');
    const chip=$('health-chip');
    chip.textContent='Awaiting data'; chip.className='chip';
    const spark=$('spark'); if (spark) spark.setAttribute('points','');
    return;
  }
  // concern-free proxy: high when resolved share high & few escalations open
  let h = logged ? Math.round((resolved/logged)*100) : 100;
  h = Math.max(0, h - escal*4);
  countTo('health-num', h, '%');
  setText('dock-health', h + '%');
  const chip=$('health-chip');
  const tier = h>=95?['Optimal','ok']:h>=80?['Nominal','ok']:h>=60?['Watch','warn']:['Degraded','crit'];
  chip.textContent=tier[0]; chip.className='chip '+tier[1];
  HEALTH_HIST.push(h); if(HEALTH_HIST.length>24) HEALTH_HIST.shift();
  if(HEALTH_HIST.length>1){
    const pts=HEALTH_HIST.map((v,i)=>{
      const x=(i/(HEALTH_HIST.length-1))*280;
      const y=52-(Math.max(0,Math.min(100,v))/100)*48;
      return x.toFixed(1)+','+y.toFixed(1);
    }).join(' ');
    $('spark').setAttribute('points',pts);
  }
}

/* ── actions ─────────────────────────────────────────────────────── */
function viewTicket(id){
  openModal('Ticket '+id, '<div class="empty">Loading…</div>');
  fetch('/.netlify/functions/aria-escalation?action=ticket&id='+encodeURIComponent(id), { headers: authHeaders() })
    .then(r=>r.json()).then(j=>{
      const tk=j.ticket||j;
      $('modal-body').innerHTML='<pre>'+esc(JSON.stringify(tk,null,2))+'</pre>';
    }).catch(()=>{ $('modal-body').innerHTML='<div class="empty">Could not load ticket.</div>'; });
}
function nudge(agent, btn){
  if(btn){ btn.disabled=true; btn.textContent='Sent'; }
  fetch('/.netlify/functions/aria-escalation?action=chatpost',{
    method:'POST', headers:authHeaders({'Content-Type':'application/json'}),
    body:JSON.stringify({ kind:'nudge', from:'operator', to:agent,
      text:'OPERATOR NUDGE — status check, please proceed or report blocker', ts:Date.now() })
  }).then(()=>setTimeout(loadAll,600)).catch(()=>{});
}
function postBit(){
  const v=val('composer-in'); if(!v) return;
  const m=v.match(/^@(\S+)\s+(.+)/);
  const to=m?m[1]:'all-agents', text=m?m[2]:v;
  fetch('/.netlify/functions/aria-escalation?action=chatpost',{
    method:'POST', headers:authHeaders({'Content-Type':'application/json'}),
    body:JSON.stringify({ from:'operator', to, kind:'msg', text })
  }).then(()=>{ $('composer-in').value=''; loadAll(); }).catch(()=>{});
}
function sendReportNow(){
  fetch('/.netlify/functions/aperture-email-report',{
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ to:'integrateditsupp@gmail.com', name:'Ahmad',
      sessionId:'manual-report-'+Date.now(), summary:'Manual report triggered from ARIA Command Center.',
      endedBy:'user', subjectOverride:'ARIA · Operations Report · '+new Date().toISOString().slice(0,10) })
  }).catch(()=>{});
  openModal('Report queued','<div style="color:var(--txt-2);font-size:13px;line-height:1.6">An operations report has been queued and will arrive at your registered email shortly.</div>');
}
function directorBrief(){
  openModal('Senior Director brief','<div class="empty">Generating Director brief...</div>');
  fetch('/api/senior-director-agent',{
    method:'POST',
    headers:authHeaders({'Content-Type':'application/json'}),
    body:JSON.stringify({ action:'brief', notifyTelegram:false })
  }).then(async r=>{
    const j = await r.json().catch(()=>({}));
    if(!r.ok || !j.digest){
      $('modal-body').innerHTML = '<div class="empty">Director brief unavailable. Check deployment, Aperture auth, or Senior Director function.</div>';
      return;
    }
    const d = j.digest;
    const briefLeads = (d.leads?.matches || []).slice(0,5).map((m,i)=>(i+1)+'. '+(m.hot?'HOT ':'')+(m.title||'Untitled')+(m.org?' - '+m.org:'')+(m.close?' - closes '+m.close:''));
    const briefTasks = (d.queue?.newestPending || []).slice(-5).map(t=>'- '+(t.target||'agent')+': '+((t.payload?.instruction||'').slice(0,140)));
    const lines = [
      'Generated: '+(d.generatedAt || 'now'),
      '',
      'Agents: '+(d.agents?.active ?? 0)+'/'+(d.agents?.total ?? 0)+' active',
      'Queue: '+(d.queue?.pending ?? 0)+' pending, '+(d.queue?.failed ?? 0)+' failed in recent tasks',
      'Lead Radar: '+(d.leads?.count ?? 0)+' matches, '+(d.leads?.hot ?? 0)+' hot, '+(d.leads?.scanned ?? 0)+' scanned',
      '',
      'Top leads:',
      ...(briefLeads.length ? briefLeads : ['none']),
      '',
      'Pending work:',
      ...(briefTasks.length ? briefTasks : ['none']),
      '',
      'Approval gates stay active: no spend, outreach, final paperwork, credentials, or irreversible commitments without Ahmad.'
    ];
    $('modal-body').innerHTML = '<pre>'+esc(lines.join('\n'))+'</pre>';
  }).catch(()=>{
    $('modal-body').innerHTML = '<div class="empty">Director brief unavailable.</div>';
  });
}
function openModal(title, html){ $('modal-title').textContent=title; $('modal-body').innerHTML=html; $('modal-bg').classList.add('show'); }
function closeModal(){ $('modal-bg').classList.remove('show'); }
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeModal(); });

/* ── helpers ─────────────────────────────────────────────────────── */
function $(id){ return document.getElementById(id); }
function val(id){ return ($(id).value||'').trim(); }
function setText(id,text){ const e=$(id); if(e) e.textContent=text; }
function num(v){ return Number(v)||0; }
function label(k){ return AGENT_LABELS[k] || (k? String(k).replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase()):''); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function setKV(id,text,cls){ const e=$(id); if(!e) return; e.textContent=text; e.className='v'+(cls?' '+cls:''); }
function fmtTime(ts){ return new Date(typeof ts==='string'?ts:Number(ts)).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}); }
function timeAgo(ts){
  const d=Date.now()-(typeof ts==='string'?new Date(ts).getTime():Number(ts));
  if(d<60000) return Math.round(d/1000)+'s ago';
  if(d<3600000) return Math.round(d/60000)+'m ago';
  if(d<86400000) return Math.round(d/3600000)+'h ago';
  return Math.round(d/86400000)+'d ago';
}
function bitHash(t){ // compact, on-brand bit-stream chip (not literal binary)
  let h=0; for(let i=0;i<t.length;i++){ h=((h<<5)-h)+t.charCodeAt(i); h|=0; }
  let r=h>>>0, s='';
  for(let i=0;i<6;i++){ r=(r*1103515245+12345)>>>0; s+=('0000'+(r&0xffff).toString(16)).slice(-4)+' '; }
  return s.trim();
}
const REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const COUNT_STATE = {};
function countTo(id, target, suffix){
  const e=$(id); if(!e) return;
  suffix = suffix || '';
  const from = COUNT_STATE[id]||0;
  COUNT_STATE[id]=target;
  if(REDUCE || from===target){ render(target); return; }
  const t0=performance.now(), dur=600;
  (function step(now){
    const k=Math.min(1,(now-t0)/dur), e2=1-Math.pow(1-k,3);
    render(Math.round(from+(target-from)*e2));
    if(k<1) requestAnimationFrame(step);
  })(t0);
  function render(v){ e.innerHTML = v + (suffix?'<span class="unit">'+suffix+'</span>':''); }
}
