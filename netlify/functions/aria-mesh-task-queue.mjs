// netlify/functions/aria-mesh-task-queue.mjs
// External-executor task queue. Lives between aria-mesh-router (cloud) and bridge-poller (local).
// Storage: Netlify Blob "aria-mesh-queue". $0.
//
// POST /api/mesh-task-queue          â enqueue {target, payload, source?, requestedBy?}
// GET  /api/mesh-task-queue?status=pending&target=local%3A%2F%2Fopencode â pull next batch (default 5)
// POST /api/mesh-task-queue/:id/claim â mark in_progress, returns updated record
// POST /api/mesh-task-queue/:id/done  â mark done, attach result {ok, output, durationMs, error?}
// POST /api/mesh-task-queue/:id/fail  â mark failed with error
//
// Auth: simple shared-token via header `x-bridge-token` (env BRIDGE_TOKEN). Required for claim/done/fail.

import { getStore } from '@netlify/blobs';

const STORE = 'aria-mesh-queue';
const KEY = 'queue.json';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_RETAIN = 2000;

async function load() {
  const store = getStore(STORE);
  const raw = await store.get(KEY, { type: 'json' });
  if (!raw || !Array.isArray(raw.tasks)) return { tasks: [] };
  return raw;
}

async function save(data) {
  const store = getStore(STORE);
  await store.setJSON(KEY, data);
}

function prune(tasks) {
  const cutoff = Date.now() - MAX_AGE_MS;
  const fresh = tasks.filter(t => (t.createdAt || 0) >= cutoff);
  if (fresh.length <= MAX_RETAIN) return fresh;
  return fresh.slice(-MAX_RETAIN);
}

function authOk(req) {
  const want = process.env.BRIDGE_TOKEN;
  if (!want) return true; // dev mode â no token required
  return req.headers.get('x-bridge-token') === want;
}

function uid() {
  return 't-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

async function logEvent(host, event) {
  try {
    await fetch(`https://${host}/api/mesh-events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event)
    });
  } catch (_) {}
}

export default async (req, _context) => {
  const url = new URL(req.url);
  const host = req.headers.get('host') || url.host;
  const segs = url.pathname.split('/').filter(Boolean);
  // segs: ['api','mesh-task-queue', maybe id, maybe action]

  const taskId = segs[2];
  const action = segs[3];

  if (req.method === 'POST' && taskId && action === 'claim') {
    if (!authOk(req)) return new Response('forbidden', { status: 403 });
    const data = await load();
    const task = data.tasks.find(t => t.id === taskId);
    if (!task) return new Response(JSON.stringify({ ok: false, reason: 'not-found' }), { status: 404 });
    task.status = 'in_progress';
    task.claimedAt = Date.now();
    await save(data);
    logEvent(host, { kind: 'bridge-claim', taskId, target: task.target, ts: Date.now() });
    return new Response(JSON.stringify({ ok: true, task }), { headers: { 'content-type': 'application/json' } });
  }

  if (req.method === 'POST' && taskId && (action === 'done' || action === 'fail')) {
    if (!authOk(req)) return new Response('forbidden', { status: 403 });
    let body = {};
    try { body = await req.json(); } catch (_) {}
    const data = await load();
    const task = data.tasks.find(t => t.id === taskId);
    if (!task) return new Response(JSON.stringify({ ok: false, reason: 'not-found' }), { status: 404 });
    task.status = action === 'done' ? 'done' : 'failed';
    task.completedAt = Date.now();
    task.durationMs = body.durationMs || (task.completedAt - (task.claimedAt || task.createdAt));
    task.result = body.result ?? null;
    task.error = body.error ?? null;
    task.output = body.output ?? null;
    await save(data);
    logEvent(host, { kind: 'bridge-' + action, taskId, target: task.target, durationMs: task.durationMs, ts: Date.now() });
    return new Response(JSON.stringify({ ok: true, task }), { headers: { 'content-type': 'application/json' } });
  }

  if (req.method === 'POST') {
    // enqueue
    let body = {};
    try { body = await req.json(); } catch (_) {}
    if (!body.target) {
      return new Response(JSON.stringify({ ok: false, reason: 'target-required' }), { status: 400 });
    }
    const task = {
      id: uid(),
      target: body.target,                 // e.g. "local://opencode"
      source: body.source || 'mesh-router',
      requestedBy: body.requestedBy || 'system',
      payload: body.payload || {},
      status: 'pending',
      createdAt: Date.now(),
      claimedAt: null,
      completedAt: null,
      result: null,
      error: null
    };
    const data = await load();
    data.tasks.push(task);
    data.tasks = prune(data.tasks);
    await save(data);
    logEvent(host, { kind: 'bridge-enqueue', taskId: task.id, target: task.target, ts: Date.now() });
    return new Response(JSON.stringify({ ok: true, id: task.id, task }), { headers: { 'content-type': 'application/json' } });
  }

  // GET â list with filters
  const status = url.searchParams.get('status');
  const target = url.searchParams.get('target');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '5', 10), 50);

  const data = await load();
  let tasks = data.tasks || [];
  if (status) tasks = tasks.filter(t => t.status === status);
  if (target) tasks = tasks.filter(t => t.target === target);
  tasks = tasks.slice(-limit);

  return new Response(JSON.stringify({ ok: true, count: tasks.length, tasks }), {
    headers: { 'content-type': 'application/json' }
  });
};

export const config = { path: '/api/mesh-task-queue*' };
