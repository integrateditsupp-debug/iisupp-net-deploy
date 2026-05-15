// aria-escalation.mjs v0.1 — ticket+research+resolution unified backend
// Endpoints (all POST, JSON body, action in querystring or body.action):
//   action=escalate    → create ticket, send ESCALATION email, return ticket+ETA+ariaScript
//   action=research    → race 3 research agents (R1 strict, R2 fuzzy, R3 vendor), return solution+wins
//   action=resolve     → mark ticket resolved, send RESOLVED email
//   action=tickets     → list (default sort: critical first, newest first), max 200
//   action=ticket      → get one by ?id=
//   action=update      → patch a ticket (used internally by research result writer)
//   action=chatlog     → list recent agent-to-agent chat messages for dashboard
//   action=chatpost    → append agent chat message (internal)
//
// Storage: Netlify Blobs. Two stores: 'aria-tickets', 'aria-agent-chat'.
// Bit format for solutions: { a, q, r, n, s, c, t } (agent, question, result, notes, source, confidence, ts)

import { getStore } from '@netlify/blobs';

const PRIORITY_RANK = { critical: 4, high: 3, normal: 2, low: 1 };
const ETA_BY_PRIORITY = { critical: 180, high: 360, normal: 600, low: 1200 }; // seconds

export default async (req, ctx) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || (await safeBody(req)).action || 'tickets';
  const body = req.method === 'POST' ? await safeBody(req) : {};

  try {
    if (action === 'escalate') return await actEscalate(body);
    if (action === 'research') return await actResearch(body);
    if (action === 'resolve')  return await actResolve(body);
    if (action === 'tickets')  return await actListTickets();
    if (action === 'ticket')   return await actGetTicket(url.searchParams.get('id'));
    if (action === 'update')   return await actUpdateTicket(body);
    if (action === 'chatlog')  return await actChatLog();
    if (action === 'chatpost') return await actChatPost(body);
    return json({ error: 'unknown action', got: action }, 400);
  } catch (e) {
    console.error('[aria-escalation] error', e);
    return json({ error: e.message || String(e) }, 500);
  }
};

// ============== ACTIONS ==============

async function actEscalate(b) {
  const issue       = (b.issue || '').slice(0, 240) || 'Unspecified issue';
  const userEmail   = b.userEmail || null;
  const userName    = b.userName || 'there';
  const sessionId   = b.sessionId || `s_${Date.now()}`;
  const conversation= Array.isArray(b.conversation) ? b.conversation.slice(0, 30) : [];
  const ariaFindings= b.ariaFindings || null;
  const priority    = ['critical','high','normal','low'].includes(b.priority) ? b.priority : 'normal';
  const eta         = b.etaSeconds || ETA_BY_PRIORITY[priority];

  const id = nextTicketId();
  const ticket = {
    id, issue, userEmail, userName, sessionId, conversation, ariaFindings,
    priority, status: 'escalated', etaSeconds: eta,
    createdAt: new Date().toISOString(),
    researchAgents: [], solution: null, resolvedAt: null,
    relatedOldTicket: b.relatedOldTicket || null
  };
  const store = getStore({ name: 'aria-tickets', consistency: 'strong' });
  await store.set(`tkt/${id}`, JSON.stringify(ticket));
  const idx = (await store.get('index', { type: 'json' })) || [];
  idx.unshift({ id, issue: ticket.issue, priority, status: ticket.status, createdAt: ticket.createdAt });
  if (idx.length > 1000) idx.length = 1000;
  await store.set('index', JSON.stringify(idx));

  // Log: ARIA → Research Pool
  await appendChat({ from: 'ARIA', to: 'research-pool', kind: 'escalation',
    text: `New ticket ${id} [${priority}]: ${issue}`, ticketId: id });

  // Send ESCALATION email (best effort, do not block)
  sendEmail({
    to: userEmail,
    subject: `ESCALATION - NO SOLUTION (CONTACT USER) - ${id}`,
    name: userName, sessionId,
    summary: `Your issue "${issue}" has been escalated to our research team. Estimated time to solution: ${humanEta(eta)}. We'll email you the moment it's solved.`,
    conversation, endedBy: 'aria',
    metrics: { layers: [['Priority', mapPriorityPct(priority)], ['ETA', Math.min(99, Math.round(eta/12))]] }
  }, 'escalation').catch(e => console.warn('escalation email failed', e?.message));

  // Internal copy
  if (process.env.SUPPORT_INTERNAL_EMAIL) {
    sendEmail({
      to: process.env.SUPPORT_INTERNAL_EMAIL,
      subject: `INTERNAL: ESCALATION ${id} - ${issue}`,
      name: 'Support', sessionId,
      summary: `User: ${userName} <${userEmail||'no email'}>\nIssue: ${issue}\nPriority: ${priority}\nETA: ${humanEta(eta)}\nFindings: ${ariaFindings||'(none)'}`,
      conversation, endedBy: 'aria'
    }, 'internal').catch(e => console.warn('internal email failed', e?.message));
  }

  const ariaScript = {
    speak:   `Your issue's been escalated to our research team. Estimated time: ${humanEta(eta)}. I'll email you the moment we solve it.`,
    apology: `Sorry I couldn't fix this directly — appreciate your patience.`,
    waitFor: 'user-end-or-ack',
    goodbye: `Thanks ${userName}. Your ticket is ${id}. You'll get an email at ${userEmail||'your inbox'} when we're done. Take care.`
  };

  return json({ ok: true, ticket, ariaScript });
}

async function actResearch(b) {
  const id = b.ticketId;
  if (!id) return json({ error: 'ticketId required' }, 400);
  const store = getStore({ name: 'aria-tickets', consistency: 'strong' });
  const t = await store.get(`tkt/${id}`, { type: 'json' });
  if (!t) return json({ error: 'ticket not found' }, 404);

  const issue = t.issue;
  // Spawn 3 strategies in parallel, race
  const r1 = strategyStrict(issue);
  const r2 = strategyFuzzy(issue);
  const r3 = strategyVendor(issue);
  await appendChat({ from: 'R1', to: 'research-pool', kind: 'start', text: `Strict scan: "${issue}"`, ticketId: id });
  await appendChat({ from: 'R2', to: 'research-pool', kind: 'start', text: `Fuzzy scan: "${issue}"`, ticketId: id });
  await appendChat({ from: 'R3', to: 'research-pool', kind: 'start', text: `Vendor live-fetch: "${issue}"`, ticketId: id });

  const winner = await Promise.any([r1, r2, r3].map(p => p.then(x => x?.solution ? x : Promise.reject('no-solution'))))
    .catch(() => null);

  if (!winner) {
    await appendChat({ from: 'research-pool', to: 'ARIA', kind: 'no-solution',
      text: `No confident solution for ${id}. Holding for human review.`, ticketId: id });
    t.status = 'awaiting-human';
    t.researchAgents = ['R1','R2','R3'];
    await store.set(`tkt/${id}`, JSON.stringify(t));
    return json({ ok: true, found: false, ticket: t });
  }

  // Bit format payload
  const bit = { a: winner.agent, q: issue, r: winner.solution, n: winner.notes||null, s: winner.source||null, c: winner.confidence||0.7, t: Date.now() };
  t.solution = bit;
  t.researchAgents = ['R1','R2','R3'];
  t.foundBy = winner.agent;
  t.status = 'solved';
  await store.set(`tkt/${id}`, JSON.stringify(t));
  await appendChat({ from: winner.agent, to: 'ARIA', kind: 'solution',
    text: `Solution found for ${id}. Bit: ${JSON.stringify(bit).slice(0,200)}`, ticketId: id });
  await appendChat({ from: 'research-pool', to: 'R1,R2,R3', kind: 'halt',
    text: `Halt: ${winner.agent} won.`, ticketId: id });

  return json({ ok: true, found: true, ticket: t, bit });
}

async function actResolve(b) {
  const id = b.ticketId;
  if (!id) return json({ error: 'ticketId required' }, 400);
  const store = getStore({ name: 'aria-tickets', consistency: 'strong' });
  const t = await store.get(`tkt/${id}`, { type: 'json' });
  if (!t) return json({ error: 'ticket not found' }, 404);

  const newId = b.newTicketId || null;
  const subject = newId
    ? `RESOLVED - SOLUTION FOUND - ${id} - ${newId}`
    : `RESOLVED - ${t.issue.slice(0,80)} - ${id}`;

  const summary = (t.solution?.r || b.solutionText || 'Solution applied.') +
    `\n\nIf you'd like to discuss further, reach out via ARIA: https://iisupp.net/aria` +
    `\n\nFuture interactions about this same issue will resolve faster — ARIA has learned the fix.`;

  if (t.userEmail) {
    sendEmail({
      to: t.userEmail, subject, name: t.userName, sessionId: t.sessionId,
      summary, conversation: t.conversation, endedBy: 'aria'
    }, 'resolved').catch(e => console.warn('resolved email failed', e?.message));
  }

  t.status = 'resolved';
  t.resolvedAt = new Date().toISOString();
  if (newId) t.followUpTicket = newId;
  await store.set(`tkt/${id}`, JSON.stringify(t));
  const idx = (await store.get('index', { type: 'json' })) || [];
  const i = idx.findIndex(x => x.id === id);
  if (i >= 0) idx[i].status = 'resolved';
  await store.set('index', JSON.stringify(idx));

  await appendChat({ from: 'ARIA', to: 'user', kind: 'resolved',
    text: `Resolved ${id}. Email sent to ${t.userEmail}.`, ticketId: id });

  return json({ ok: true, ticket: t });
}

async function actListTickets() {
  const store = getStore({ name: 'aria-tickets', consistency: 'strong' });
  const idx = (await store.get('index', { type: 'json' })) || [];
  idx.sort((a,b) => (PRIORITY_RANK[b.priority]||0) - (PRIORITY_RANK[a.priority]||0)
    || (a.createdAt < b.createdAt ? 1 : -1));
  return json({ tickets: idx.slice(0, 200) });
}

async function actGetTicket(id) {
  if (!id) return json({ error: 'id required' }, 400);
  const store = getStore({ name: 'aria-tickets', consistency: 'strong' });
  const t = await store.get(`tkt/${id}`, { type: 'json' });
  if (!t) return json({ error: 'not found' }, 404);
  return json({ ticket: t });
}

async function actUpdateTicket(b) {
  if (!b.id) return json({ error: 'id required' }, 400);
  const store = getStore({ name: 'aria-tickets', consistency: 'strong' });
  const t = await store.get(`tkt/${b.id}`, { type: 'json' });
  if (!t) return json({ error: 'not found' }, 404);
  Object.assign(t, b.patch || {});
  await store.set(`tkt/${b.id}`, JSON.stringify(t));
  return json({ ok: true, ticket: t });
}

async function actChatLog() {
  const store = getStore({ name: 'aria-agent-chat', consistency: 'strong' });
  const log = (await store.get('log', { type: 'json' })) || [];
  return json({ messages: log.slice(-200) });
}

async function actChatPost(b) {
  await appendChat({ from: b.from, to: b.to, kind: b.kind || 'msg', text: b.text, ticketId: b.ticketId || null });
  return json({ ok: true });
}

async function appendChat(m) {
  const store = getStore({ name: 'aria-agent-chat', consistency: 'strong' });
  const log = (await store.get('log', { type: 'json' })) || [];
  log.push({ ...m, ts: Date.now() });
  if (log.length > 1000) log.splice(0, log.length - 1000);
  await store.set('log', JSON.stringify(log));
}

// ============== RESEARCH STRATEGIES ==============
// All return { agent, solution, source, confidence, notes } or null

async function strategyStrict(issue) {
  // Direct call to existing aria-research with strict mode
  try {
    const r = await fetch('https://iisupp.net/.netlify/functions/aria-research', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: issue, mode: 'strict' })
    });
    const j = await r.json();
    if (j?.match && j.confidence > 0.7) {
      return { agent: 'R1', solution: j.recipe || j.text, source: j.source, confidence: j.confidence, notes: 'strict-match' };
    }
  } catch(e) {}
  return null;
}
async function strategyFuzzy(issue) {
  await sleep(800); // small stagger so winners diversify
  try {
    const r = await fetch('https://iisupp.net/.netlify/functions/aria-research', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: issue, mode: 'fuzzy' })
    });
    const j = await r.json();
    if (j?.match && j.confidence > 0.5) {
      return { agent: 'R2', solution: j.recipe || j.text, source: j.source, confidence: j.confidence, notes: 'fuzzy-match' };
    }
  } catch(e) {}
  return null;
}
async function strategyVendor(issue) {
  await sleep(1500);
  try {
    const r = await fetch('https://iisupp.net/.netlify/functions/aria-research', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: issue, mode: 'vendor-fetch' })
    });
    const j = await r.json();
    if (j?.found && j.url) {
      return { agent: 'R3', solution: j.summary || j.recipe || `See: ${j.url}`, source: j.url, confidence: j.confidence || 0.6, notes: 'vendor-live-fetch' };
    }
  } catch(e) {}
  return null;
}

// ============== EMAIL ==============

async function sendEmail(payload, mode) {
  // Reuse existing aperture-email-report function
  const subjectOverride = payload.subject;
  const r = await fetch('https://iisupp.net/.netlify/functions/aperture-email-report', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: payload.to, name: payload.name, sessionId: payload.sessionId,
      summary: payload.summary, conversation: payload.conversation || [],
      metrics: payload.metrics || null, endedBy: payload.endedBy,
      subjectOverride
    })
  });
  return await r.json().catch(() => ({}));
}

// ============== HELPERS ==============

function nextTicketId() {
  const d = new Date();
  const ymd = d.toISOString().slice(0,10).replace(/-/g,'');
  return `TKT-${ymd}-${Math.floor(Math.random()*9000+1000)}`;
}
function humanEta(s) {
  if (s < 90) return `${s} seconds`;
  if (s < 3600) return `${Math.round(s/60)} minutes`;
  return `${Math.round(s/3600)} hours`;
}
function mapPriorityPct(p) {
  return { critical: 95, high: 75, normal: 50, low: 25 }[p] || 50;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function safeBody(req) {
  try { return await req.json(); } catch { return {}; }
}
function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: cors() });
}
