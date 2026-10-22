// axis-exec.mjs — AXIS executive-assistant API (Aperture login required).
// Workspace ("pull it up, let's work on it"), automations ("automate it"), approvals, Apollo leads,
// inbox overview, daily brief, integration status. Spending always waits for Ahmad's approval.
import { bearerFromEvent } from './_verify-bearer.cjs';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PERSONA, claude, pickTier, parseJSON, readJSON, writeJSON, id, now, requestApproval, apollo,
  integrationStatus, monthSpend, attention, esc, trail,
} from './lib/axis-exec-core.mjs';
import { autonomyMode, AUTONOMY_REV, trailSummary } from './lib/axis-autonomy-policy.mjs';
import { getStore as blobStore } from '@netlify/blobs';
import { loadSituationSafe, situationInstruction } from './lib/axis-situation.cjs';
import { listTasks, tasksBlock } from './lib/axis-tasks.cjs';

const FN_DIR = path.dirname(fileURLToPath(import.meta.url)); // NOT "__dirname" — esbuild injects its own shim

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

const WORKSPACE_SYSTEM = `${PERSONA}

You are working ON SCREEN with Ahmad. Produce or update a working document he can see and edit.
Return ONLY JSON: {"title": string, "kind": "leads"|"email"|"invoice"|"campaign"|"client"|"plan"|"tax"|"calendar"|"report"|"other", "content": markdown string (the actual working document — tables, drafts, checklists), "say": one or two short warm sentences Axis says aloud, "next": [up to 3 short next-step choices]}.
Never invent client data, prices or figures; mark unknowns as [needs info].

YOU HAVE THE LIVE SITUATION. The block below this system prompt is the company's board, the CEO-critical ledger, the to-dos, the automations, the approvals and the Claude worker queue, with the local Toronto date and time. When Ahmad asks for the urgent items, what needs him, or "let's work on the top items", build the document FROM that list: ranked rows, each with the next concrete step and who does it (AXIS or Ahmad). Never write that you lack access to his tasks, board, approvals or to-dos — you have them. Only two sources are not connected: the calendar and the three mailboxes; if they matter, say so in one line and name the one-click (Google sign-in). Never guess the date — use the local date in the block. If the block is absent, say the board did not answer in time and work from what Ahmad typed.
THE LIVE TASK LIST block (when present) is every open item across the to-dos, approvals, follow-ups, the CEO ledger, the board, automations and worker failures, each with its [id]. Build from it; name items by title. Acting on an item (done, snooze, follow up, approve, archive, assign) happens in AXIS chat or the Live task view — say which one-line ask does it. Nothing here sends; drafts stay drafts.`;

// RUN-AX2 (2026-10-13): the situation block for this request — bounded, never throws, null when a
// store is slow. The Workspace brain used to receive Ahmad's sentence and nothing else; asked "let's
// work on top urgent items" it truthfully answered that it had no access to tasks, calendar or
// messages, and dated the page from UTC. Now every Workspace and brief call reads the same picture
// the director reads (lib/axis-situation.cjs), with the Toronto clock.
// RUN-AX3 (2026-10-15): the live task list (every open row with its id and what it can do) rides with the
// situation, so a "let's work on …" that reaches this brain directly (the Work tab, the live call) builds its
// document from the same list the director's tool loop works — never "I don't have access to your tasks".
// Bounded and never throws: a slow store means the block is absent and the situation alone is used.
const tasksFor = async () => {
  let timer = null;
  try {
    const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(null), 2500); });
    return await Promise.race([listTasks({ getStore: blobStore, fnDir: FN_DIR }).catch(() => null), timeout]);
  } catch { return null; } finally { if (timer) clearTimeout(timer); }
};
const situationFor = async () => {
  const [sit, list] = await Promise.all([loadSituationSafe({ fnDir: FN_DIR, getStore: blobStore }), tasksFor()]);
  if (sit && list && list.ok) sit.tasksText = tasksBlock(list);
  return sit;
};
const withSituation = (system, sit) => (sit ? `${system}\n\n${situationInstruction(sit)}${sit.tasksText ? `\n\n${sit.tasksText}` : ''}` : system);

export default async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'POST required' });
  // Axis Local (the PC helper) authenticates with its paired device key, not a staff login.
  const deviceKey = request.headers.get('x-axis-device') || '';
  if (deviceKey) return localDevice(request, deviceKey);
  const auth = request.headers.get('authorization') || '';
  if (!bearerFromEvent({ headers: { authorization: auth } })) return json(401, { error: 'unauthorized' });
  let body;
  try { body = await request.json(); } catch { return json(400, { error: 'invalid JSON' }); }
  const action = String(body.action || '');

  try {
    if (action === 'status') {
      const [tasks, approvals, spend, log] = await Promise.all([readJSON('tasks', []), readJSON('approvals', []), monthSpend(), readJSON('attention-log', [])]);
      return json(200, { ok: true, integrations: integrationStatus(), spend, tasks, approvals: approvals.filter((a) => a.status === 'pending'), attention: log.slice(0, 10) });
    }

    // ── Workspace ────────────────────────────────────────────────────────
    if (action === 'workspace.open' || action === 'workspace.edit') {
      const request_ = String(body.request || '').slice(0, 3000);
      if (!request_) return json(400, { error: 'request required' });
      const docs = await readJSON('workspace', []);
      const current = action === 'workspace.edit' ? docs.find((d) => d.id === body.id) : null;
      let context = '';
      if (/\blead|prospect|client list|apollo\b/i.test(request_) && process.env.APOLLO_API_KEY && !current) {
        try { context = `Apollo results (real data):\n${JSON.stringify(await leadSearch(request_)).slice(0, 6000)}`; } catch (e) { context = `Apollo unavailable: ${e.message}`; }
      }
      const user = current
        ? `Current document "${current.title}":\n${current.content}\n\nAhmad's change: ${request_}`
        : `Ahmad: ${request_}${context ? `\n\n${context}` : ''}`;
      const sit = await situationFor();
      const out = await claude({ system: withSituation(WORKSPACE_SYSTEM, sit), messages: [{ role: 'user', content: user }], tier: pickTier(request_, body.tier), maxTokens: 2500 });
      const parsed = parseJSON(out.text, { title: 'Working draft', kind: 'other', content: out.text, say: 'Here it is.', next: [] });
      const doc = { ...(current || { id: id('ws'), created_at: now() }), title: parsed.title, kind: parsed.kind, content: parsed.content, updated_at: now(), model: out.model };
      await writeJSON('workspace', [doc, ...docs.filter((d) => d.id !== doc.id)].slice(0, 100));
      return json(200, { ok: true, doc, say: parsed.say, next: parsed.next || [], tier: out.tier });
    }
    if (action === 'workspace.list') return json(200, { ok: true, docs: (await readJSON('workspace', [])).map(({ content, ...d }) => d) });
    if (action === 'workspace.get') return json(200, { ok: true, doc: (await readJSON('workspace', [])).find((d) => d.id === body.id) || null });
    if (action === 'workspace.save') {
      const docs = await readJSON('workspace', []);
      const doc = docs.find((d) => d.id === body.id);
      if (!doc) return json(404, { error: 'not found' });
      doc.content = String(body.content || '').slice(0, 60000); doc.updated_at = now();
      await writeJSON('workspace', docs);
      return json(200, { ok: true, doc });
    }

    // ── Automations ──────────────────────────────────────────────────────
    if (action === 'tasks.create') {
      const instructions = String(body.instructions || '').slice(0, 3000);
      if (!instructions) return json(400, { error: 'instructions required' });
      const every = Math.max(15, Math.min(10080, Number(body.every_minutes) || 1440));
      const tasks = await readJSON('tasks', []);
      const task = { id: id('task'), title: String(body.title || instructions.slice(0, 80)), instructions, every_minutes: every, status: 'active', next_run: now(), runs: 0, created_at: now(), last_result: null };
      await writeJSON('tasks', [task, ...tasks].slice(0, 200));
      return json(200, { ok: true, task });
    }
    if (action === 'tasks.update') {
      const tasks = await readJSON('tasks', []);
      const t = tasks.find((x) => x.id === body.id);
      if (!t) return json(404, { error: 'not found' });
      if (['active', 'paused'].includes(body.status)) t.status = body.status;
      if (body.instructions) t.instructions = String(body.instructions).slice(0, 3000);
      await writeJSON('tasks', tasks);
      return json(200, { ok: true, task: t });
    }
    if (action === 'tasks.delete') {
      await writeJSON('tasks', (await readJSON('tasks', [])).filter((x) => x.id !== body.id));
      return json(200, { ok: true });
    }

    // ── Approvals ────────────────────────────────────────────────────────
    if (action === 'approvals.decide') {
      const list = await readJSON('approvals', []);
      const a = list.find((x) => x.id === body.id);
      if (!a || a.status !== 'pending') return json(404, { error: 'not pending' });
      a.status = body.decision === 'approve' ? 'approved' : 'declined';
      a.decided_at = now();
      if (body.edit && a.payload) a.payload.text = String(body.edit).slice(0, 8000);
      await writeJSON('approvals', list);
      // Approved sends are executed by the cron on its next tick (one place sends mail).
      return json(200, { ok: true, approval: a });
    }
    // 2026-10-21 trail: the full record of what AXIS did on its own (lib/axis-autonomy-policy.mjs).
    if (action === 'trail.list') {
      const list = await readJSON('trail', []);
      return json(200, { ok: true, mode: autonomyMode(), rev: AUTONOMY_REV, summary: trailSummary(list, body.since), trail: list.slice(0, Number(body.limit) || 50) });
    }
    if (action === 'trail.add') {
      const row = await trail({ action: String(body.kind || 'manual'), tier: 'act', summary: String(body.summary || ''), inputs: body.inputs || null, result: body.result || null, ref: body.ref || null, who: body.who || 'AXIS' });
      return json(200, { ok: true, row });
    }
    if (action === 'approvals.request') {
      const a = await requestApproval({ kind: 'spend', title: String(body.title || 'Expense'), detail: String(body.detail || ''), costUsd: Number(body.costUsd) || 0, payload: null });
      return json(200, { ok: true, approval: a });
    }

    // ── To-do list (prioritized, "needs you" flags) ─────────────────────
    if (action === 'todos.list') return json(200, { ok: true, todos: await readJSON('todos', []) });
    if (action === 'todos.add') {
      const title = String(body.title || '').slice(0, 200);
      if (!title) return json(400, { error: 'title required' });
      const todos = await readJSON('todos', []);
      const todo = { id: id('todo'), title, priority: ['high', 'normal', 'low'].includes(body.priority) ? body.priority : 'normal',
        needsYou: !!body.needsYou, note: String(body.note || '').slice(0, 500), done: false, created_at: now(), done_at: null };
      await writeJSON('todos', [todo, ...todos].slice(0, 300));
      return json(200, { ok: true, todo });
    }
    if (action === 'todos.update') {
      const todos = await readJSON('todos', []);
      const t = todos.find((x) => x.id === body.id);
      if (!t) return json(404, { error: 'not found' });
      if (typeof body.done === 'boolean') { t.done = body.done; t.done_at = body.done ? now() : null; }
      if (['high', 'normal', 'low'].includes(body.priority)) t.priority = body.priority;
      if (typeof body.needsYou === 'boolean') t.needsYou = body.needsYou;
      if (body.note !== undefined) t.note = String(body.note).slice(0, 500);
      await writeJSON('todos', todos);
      return json(200, { ok: true, todo: t });
    }
    if (action === 'todos.delete') {
      await writeJSON('todos', (await readJSON('todos', [])).filter((x) => x.id !== body.id));
      return json(200, { ok: true });
    }

    // ── Leads (Apollo) ───────────────────────────────────────────────────
    if (action === 'leads.search') return json(200, { ok: true, results: await leadSearch(String(body.query || '')) });

    // ── Daily brief ──────────────────────────────────────────────────────
    if (action === 'brief') {
      const [tasks, approvals, inbox, sit] = await Promise.all([readJSON('tasks', []), readJSON('approvals', []), readJSON('inbox-log', []), situationFor()]);
      const facts = `Automations: ${tasks.map((t) => `${t.title} [${t.status}] last: ${t.last_result?.summary || 'not run'}`).join('; ') || 'none'}\nPending approvals: ${approvals.filter((a) => a.status === 'pending').map((a) => a.title).join('; ') || 'none'}\nRecent inbox: ${inbox.slice(0, 10).map((m) => `${m.from}: ${m.subject} (${m.action})`).join('; ') || 'none'}`;
      // The brief is the situation, spoken: the ranked list above the assistant's own three lists.
      const dateLine = sit ? `Today is ${sit.local.weekday} ${sit.local.date}, ${sit.local.time} ${sit.local.tz}. ` : '';
      const out = await claude({ system: withSituation(PERSONA, sit), messages: [{ role: 'user', content: `${dateLine}Give Ahmad today's brief in 6 short lines max: the top three that need him (from the live situation, ranked, with the one next step each), what AXIS is handling, the next revenue move. Facts only — never say you lack access:\n${facts}` }], tier: 'fast', maxTokens: 500 });
      return json(200, { ok: true, text: out.text, situation: sit ? { counts: sit.counts, local: sit.local, sources: sit.sources } : null });
    }

    // ── Axis Local (PC helper) ───────────────────────────────────────────
    if (action === 'local.pair') {
      const key = 'axl_' + randomBytes(24).toString('base64url');
      const devices = await readJSON('local-devices', []);
      devices.unshift({ id: id('pc'), name: String(body.name || 'My PC').slice(0, 60), hash: sha(key), created_at: now(), last_seen: null });
      await writeJSON('local-devices', devices.slice(0, 10));
      return json(200, { ok: true, key });
    }
    if (action === 'local.enqueue') {
      const kind = ['claude', 'open', 'command'].includes(body.kind) ? body.kind : 'claude';
      const instructions = String(body.instructions || '').slice(0, 4000);
      if (!instructions) return json(400, { error: 'instructions required' });
      const jobs = await readJSON('local-jobs', []);
      const job = { id: id('job'), kind, title: String(body.title || instructions.slice(0, 80)), instructions,
        tier: pickTier(instructions, body.tier), status: kind === 'command' ? 'needs_approval' : 'queued', created_at: now(), output: null };
      await writeJSON('local-jobs', [job, ...jobs].slice(0, 200));
      return json(200, { ok: true, job });
    }
    if (action === 'local.list') {
      const [jobs, devices] = await Promise.all([readJSON('local-jobs', []), readJSON('local-devices', [])]);
      return json(200, { ok: true, jobs: jobs.slice(0, 40), devices: devices.map(({ hash, ...d }) => ({ ...d, online: !!d.last_seen && Date.now() - Date.parse(d.last_seen) < 90e3 })) });
    }
    if (action === 'local.decide') {
      const jobs = await readJSON('local-jobs', []);
      const j = jobs.find((x) => x.id === body.id);
      if (!j || !['needs_approval', 'queued'].includes(j.status)) return json(404, { error: 'not waiting' });
      j.status = body.decision === 'approve' ? 'queued' : 'declined'; j.decided_at = now();
      await writeJSON('local-jobs', jobs);
      return json(200, { ok: true, job: j });
    }
    if (action === 'local.unpair') {
      await writeJSON('local-devices', (await readJSON('local-devices', [])).filter((d) => d.id !== body.id));
      return json(200, { ok: true });
    }

    if (action === 'attention.test') {
      const ok = await attention('Test from AXIS', `<p>${esc('This is how Axis will reach you when something needs a decision.')}</p>`);
      return json(200, { ok });
    }
    return json(400, { error: 'unknown action' });
  } catch (e) {
    return json(200, { ok: false, error: e.message });
  }
};

const sha = (v) => createHash('sha256').update(String(v)).digest('hex');

// Axis Local polling: heartbeat + next approved job, and result reporting. Device-key only.
async function localDevice(request, key) {
  const devices = await readJSON('local-devices', []);
  const device = devices.find((d) => d.hash === sha(key));
  if (!device) return json(401, { error: 'device not paired' });
  let body = {};
  try { body = await request.json(); } catch {}
  device.last_seen = now(); device.platform = String(body.platform || device.platform || '').slice(0, 40);
  await writeJSON('local-devices', devices);
  const jobs = await readJSON('local-jobs', []);
  if (body.action === 'local.result') {
    const j = jobs.find((x) => x.id === body.id && x.status === 'running');
    if (!j) return json(404, { error: 'unknown job' });
    j.status = body.ok ? 'done' : 'failed'; j.output = String(body.output || '').slice(0, 20000); j.finished_at = now();
    await writeJSON('local-jobs', jobs);
    if (!body.ok) await attention(`Axis Local could not finish: ${j.title}`, `<p>${esc(j.output.slice(0, 800))}</p>`, `local-${j.id}`).catch(() => {});
    return json(200, { ok: true });
  }
  // A job stuck "running" for 20 minutes is handed back so it is never silently lost.
  for (const j of jobs) if (j.status === 'running' && Date.now() - Date.parse(j.started_at) > 20 * 60e3) j.status = 'queued';
  const next = jobs.slice().reverse().find((x) => x.status === 'queued');
  if (next) { next.status = 'running'; next.started_at = now(); next.device = device.id; }
  await writeJSON('local-jobs', jobs);
  return json(200, { ok: true, job: next ? { id: next.id, kind: next.kind, title: next.title, instructions: next.instructions, tier: next.tier } : null });
}

async function leadSearch(query) {
  const plan = parseJSON((await claude({
    messages: [{ role: 'user', content: `Turn this into Apollo people-search filters. Return ONLY JSON {"person_titles":[],"person_locations":[],"organization_num_employees_ranges":[],"q_keywords":""}. Ideal clients for an IT/cybersecurity/AI services firm: SMB owners, office managers, CTOs, IT managers. Request: ${query}` }],
    tier: 'fast', maxTokens: 300,
  })).text, {});
  const res = await apollo('/api/v1/mixed_people/api_search', { per_page: 25, page: 1, ...plan });
  return (res.people || []).map((p) => ({ id: p.id, name: [p.first_name, p.last_name_obfuscated || p.last_name].filter(Boolean).join(' '), title: p.title, company: p.organization?.name, location: [p.city, p.state, p.country].filter(Boolean).join(', ') }));
}

export const config = { path: '/api/axis/exec' };
