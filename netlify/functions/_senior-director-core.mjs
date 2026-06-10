import { getStore } from '@netlify/blobs';
import registryRaw from '../../mesh-registry.json' with { type: 'json' };

const QUEUE_STORE = 'aria-mesh-queue';
const QUEUE_KEY = 'queue.json';
const EVENT_STORE = 'aria-mesh-events';
const EVENT_KEY = 'events.json';
const MAX_TASKS = 2000;
const MAX_EVENTS = 5000;
const TASK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EVENT_TTL_MS = 24 * 60 * 60 * 1000;

export const SENIOR_DIRECTOR_ID = 'senior-director-agent';

export function json(status, obj, extraHeaders = {}) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders
    }
  });
}

export function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization, x-senior-director-secret, x-telegram-bot-api-secret-token'
  };
}

export function getBaseUrl(req) {
  const url = new URL(req.url);
  const host = req.headers.get('host') || url.host;
  const proto = host.includes('localhost') || host.startsWith('127.') ? 'http' : 'https';
  return `${proto}://${host}`;
}

async function loadStore(storeName, key, fallback) {
  const store = getStore(storeName);
  const raw = await store.get(key, { type: 'json' });
  return raw || fallback;
}

async function saveStore(storeName, key, data) {
  const store = getStore(storeName);
  await store.setJSON(key, data);
}

function pruneTasks(tasks) {
  const cutoff = Date.now() - TASK_TTL_MS;
  const fresh = tasks.filter((t) => (t.createdAt || 0) >= cutoff);
  return fresh.length <= MAX_TASKS ? fresh : fresh.slice(-MAX_TASKS);
}

function pruneEvents(events) {
  const cutoff = Date.now() - EVENT_TTL_MS;
  const fresh = events.filter((e) => (e.ts || 0) >= cutoff);
  return fresh.length <= MAX_EVENTS ? fresh : fresh.slice(-MAX_EVENTS);
}

export function listAgents() {
  return registryRaw.agents || [];
}

export function findAgent(id) {
  return listAgents().find((a) => a.id === id) || null;
}

export function seniorDirectorPolicy() {
  return {
    mission: [
      'Grow revenue and profit through remote L1-L3 support contracts, AI implementation, website work, corporate overflow projects, tenders, and offshore support.',
      'Protect company reputation by avoiding unsafe outreach, false claims, or secret exposure.',
      'Coordinate Codex, Claude Code, ARIA mesh agents, lead radar, site updates, growth portal, workbook, and monitoring.'
    ],
    allowedWithoutApproval: [
      'Read public data and internal non-secret status already available to the site.',
      'Queue tasks to existing agents.',
      'Draft website, outreach, SEO, lead-review, tender-review, offshore-support, AI-implementation, and support-improvement work.',
      'Draft workspace cleanup, agent learning handoff, rename, retirement, compaction, and care recommendations.',
      'Notify Ahmad via Telegram about important findings.',
      'Prepare handoff notes for Codex and Claude Code.'
    ],
    requiresApproval: [
      'Any paid API, subscription, cloud resource, ad spend, or purchase.',
      'Sending external sales messages, legal claims, quotes, contracts, or public announcements.',
      'Changing credentials, DNS, payments, production secrets, or security policy.',
      'Deleting data, force-pushing code, changing customer-facing promises, retiring agents, renaming production agent IDs, or clearing high-token logs.'
    ],
    hardLimits: [
      'No autonomous spending.',
      'No impersonation.',
      'No secret disclosure.',
      'No prospect chasing without an approved message and approved target list.'
    ]
  };
}

export async function readQueue() {
  const data = await loadStore(QUEUE_STORE, QUEUE_KEY, { tasks: [] });
  return Array.isArray(data.tasks) ? data.tasks : [];
}

export async function readEvents() {
  const data = await loadStore(EVENT_STORE, EVENT_KEY, { events: [] });
  return Array.isArray(data.events) ? data.events : [];
}

export async function appendMeshEvent(event) {
  const data = await loadStore(EVENT_STORE, EVENT_KEY, { events: [] });
  data.events = pruneEvents([...(data.events || []), {
    kind: event.kind || 'senior-director-event',
    agentId: event.agentId || SENIOR_DIRECTOR_ID,
    ts: event.ts || Date.now(),
    ...event
  }]);
  await saveStore(EVENT_STORE, EVENT_KEY, data);
}

export async function enqueueTask({ target, instruction, requestedBy = 'senior-director', priority = 'normal', source = SENIOR_DIRECTOR_ID, metadata = {} }) {
  const agent = findAgent(target);
  if (!agent) {
    throw new Error(`Unknown agent: ${target}`);
  }
  const task = {
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    target,
    source,
    requestedBy,
    payload: {
      instruction,
      priority,
      governance: seniorDirectorPolicy(),
      ...metadata
    },
    status: 'pending',
    createdAt: Date.now(),
    claimedAt: null,
    completedAt: null,
    result: null,
    error: null
  };
  const data = await loadStore(QUEUE_STORE, QUEUE_KEY, { tasks: [] });
  data.tasks = pruneTasks([...(data.tasks || []), task]);
  await saveStore(QUEUE_STORE, QUEUE_KEY, data);
  await appendMeshEvent({
    kind: 'senior-director-dispatch',
    taskId: task.id,
    target,
    requestedBy,
    priority
  });
  return task;
}

export async function fetchLeadRadar(baseUrl) {
  try {
    const r = await fetch(`${baseUrl}/.netlify/functions/aria-lead-radar`, {
      headers: { 'user-agent': 'IIS-SeniorDirector/1.0' }
    });
    const data = await r.json().catch(() => ({}));
    return {
      ok: r.ok,
      status: r.status,
      count: data.count || 0,
      hot: data.hot || 0,
      scanned: data.scanned || 0,
      matches: Array.isArray(data.matches) ? data.matches.slice(0, 8) : [],
      error: data.error || null
    };
  } catch (e) {
    return { ok: false, status: 0, count: 0, hot: 0, scanned: 0, matches: [], error: e?.message || String(e) };
  }
}

export async function buildStatusDigest(baseUrl) {
  const [tasks, events, leads] = await Promise.all([
    readQueue().catch(() => []),
    readEvents().catch(() => []),
    fetchLeadRadar(baseUrl)
  ]);

  const recentTasks = tasks.slice(-50);
  const pending = recentTasks.filter((t) => t.status === 'pending');
  const failed = recentTasks.filter((t) => t.status === 'failed');
  const recentEvents = events.slice(-80);
  const failures = recentEvents.filter((e) => /fail|error|breach|unauthorized/i.test(`${e.kind || ''} ${e.error || ''}`));
  const agents = listAgents();

  return {
    generatedAt: new Date().toISOString(),
    service: SENIOR_DIRECTOR_ID,
    agents: {
      total: agents.length,
      active: agents.filter((a) => a.status === 'active').length,
      planned: agents.filter((a) => a.status !== 'active').length
    },
    queue: {
      recent: recentTasks.length,
      pending: pending.length,
      failed: failed.length,
      newestPending: pending.slice(-5)
    },
    events: {
      recent: recentEvents.length,
      attention: failures.slice(-5)
    },
    leads,
    policy: seniorDirectorPolicy()
  };
}

export function formatTelegramDigest(digest) {
  const leadLines = (digest.leads.matches || []).slice(0, 5).map((m, i) => {
    const hot = m.hot ? 'HOT ' : '';
    return `${i + 1}. ${hot}${m.title || 'Untitled'}${m.org ? ` - ${m.org}` : ''}${m.close ? ` (closes ${m.close})` : ''}`;
  });
  const pendingLines = (digest.queue.newestPending || []).slice(-5).map((t) => `- ${t.target}: ${(t.payload?.instruction || '').slice(0, 120)}`);
  const attentionLines = (digest.events.attention || []).slice(-5).map((e) => `- ${e.kind || 'event'} ${e.agentId || ''} ${e.error || ''}`.trim());

  return [
    'Senior Director Agent brief',
    `Generated: ${digest.generatedAt}`,
    '',
    `Agents: ${digest.agents.active}/${digest.agents.total} active`,
    `Queue: ${digest.queue.pending} pending, ${digest.queue.failed} failed in recent tasks`,
    `Lead Radar: ${digest.leads.count} matches, ${digest.leads.hot} hot, ${digest.leads.scanned} scanned${digest.leads.error ? `, error: ${digest.leads.error}` : ''}`,
    '',
    leadLines.length ? `Top leads:\n${leadLines.join('\n')}` : 'Top leads: none in latest scan',
    '',
    pendingLines.length ? `Pending work:\n${pendingLines.join('\n')}` : 'Pending work: none',
    '',
    attentionLines.length ? `Needs attention:\n${attentionLines.join('\n')}` : 'Needs attention: none',
    '',
    'Commands: /status, /leads, /agents, /assign <agent> | <task>'
  ].join('\n');
}

export async function sendTelegramMessage(text, chatId = process.env.TELEGRAM_OWNER_CHAT_ID) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) {
    return { ok: false, skipped: true, reason: 'telegram env not configured' };
  }
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: String(text).slice(0, 3900),
      disable_web_page_preview: true
    })
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok && data.ok !== false, status: r.status, data };
}

export function parseAssignment(text) {
  const raw = String(text || '').trim();
  const slash = raw.match(/^\/assign\s+([a-z0-9_.:-]+)\s*\|\s*([\s\S]+)$/i);
  if (slash) return { target: slash[1], instruction: slash[2].trim() };

  const tell = raw.match(/^(?:tell|ask|assign)\s+([a-z0-9_.:-]+)\s+(?:to\s+)?([\s\S]+)$/i);
  if (tell) return { target: tell[1], instruction: tell[2].trim() };

  return null;
}
