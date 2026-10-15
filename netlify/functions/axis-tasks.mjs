// axis-tasks.mjs — /api/axis/tasks (Aperture login required). RUN-AX3, 2026-10-15: "AXIS works the list with you".
//
// The ONE live task list (lib/axis-tasks.cjs) over every source AXIS can reach — to-dos, approvals, follow-ups,
// the CEO ledger, the worker's board, automations, worker failures — and the mutations that work it. The
// console's Live task view reads and writes here; the director's tool loop (lib/axis-task-loop.cjs) reaches
// it over HTTP because axis-director.js is a Lambda-compat function and has no Blobs context of its own
// (the same reason the brain queue lives in a v2 function).
//
//   GET  /api/axis/tasks[?filter=open|needs-me|axis|approvals|follow-ups|snoozed|done|all][&q=words][&situation=1]
//        → { ok, generatedAt, local, items[], counts, filters[], sources, overlay[, situation] }
//   POST /api/axis/tasks { action, id | match, …fields, via: chat|voice|console, actor? }
//        → { ok, action, item, audit, receipt, created?, staged?, needsClick?, queued? }
//        400 unknown action / unknown id / bad field · 409 ambiguous target or an action the row does not offer
//        (with candidates / actions) · 503 a store did not answer (nothing was changed) · 401 without Aperture.
//
// It NEVER sends, pays or publishes. An approval that would send, spend or run a command is executed only when
// the request says via:"console" (Ahmad's click); from chat or voice it is staged for that click.
import { verifyAperture } from './aperture-auth.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStore } from '@netlify/blobs';
import { listTasks, mutate, FILTER_IDS } from './lib/axis-tasks.cjs';

const FN_DIR = path.dirname(fileURLToPath(import.meta.url)); // NOT "__dirname" — esbuild injects its own shim

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Cache-Control': 'no-store',
};
const jr = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'GET' && req.method !== 'POST') return jr(405, { ok: false, error: 'GET or POST only' });
  if (!verifyAperture(req)) return jr(401, { ok: false, error: 'unauthorized — Aperture login required' });
  const now = new Date();

  if (req.method === 'GET') {
    const u = new URL(req.url);
    const filter = u.searchParams.get('filter') || null;
    if (filter && filter !== 'all' && !FILTER_IDS.includes(filter)) return jr(400, { ok: false, error: `unknown filter "${filter.slice(0, 40)}"`, filters: [...FILTER_IDS, 'all'] });
    const q = (u.searchParams.get('q') || '').slice(0, 120) || null;
    try {
      const list = await listTasks({ getStore, now, fnDir: FN_DIR, filter, q });
      const body = { ok: true, generatedAt: list.generatedAt, local: list.local, items: list.items, counts: list.counts, filters: list.filters, sources: list.sources, overlay: list.overlay };
      if (u.searchParams.get('situation') === '1') body.situation = list.situation;
      return jr(200, body);
    } catch (e) {
      console.error('[axis-tasks] list failed:', String((e && e.message) || e).slice(0, 200));
      return jr(503, { ok: false, error: 'the task list could not be built — a store did not answer; the board still works' });
    }
  }

  let body;
  try { body = await req.json(); } catch { return jr(400, { ok: false, error: 'invalid JSON' }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return jr(400, { ok: false, error: 'a JSON object is required' });
  const { action, id = null, match = null, via = 'console', actor = 'ahmad', ...fields } = body;
  try {
    const out = await mutate({ getStore, now, fnDir: FN_DIR, action, id: id == null ? null : String(id).slice(0, 200), match: match == null ? null : String(match).slice(0, 200), fields, actor, via });
    return jr(200, out);
  } catch (e) {
    if (e && e.status) return jr(e.status, { ok: false, error: e.message, code: e.code, ...(e.extra || {}) });
    console.error('[axis-tasks] mutation failed:', String((e && e.message) || e).slice(0, 200));
    return jr(500, { ok: false, error: 'the change did not complete — no receipt was issued; refresh the list before retrying', code: 'internal' });
  }
};

export const config = { path: '/api/axis/tasks' };
