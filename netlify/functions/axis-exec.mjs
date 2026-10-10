// axis-exec.mjs — AXIS executive-assistant API (Aperture login required).
// Workspace ("pull it up, let's work on it"), automations ("automate it"), approvals, Apollo leads,
// inbox overview, daily brief, integration status. Spending always waits for Ahmad's approval.
import { bearerFromEvent } from './_verify-bearer.cjs';
import { createHash, randomBytes } from 'node:crypto';
import {
  PERSONA, claude, pickTier, parseJSON, readJSON, writeJSON, id, now, requestApproval, apollo,
  integrationStatus, monthSpend, attention, esc,
} from './lib/axis-exec-core.mjs';

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

const WORKSPACE_SYSTEM = `${PERSONA}

You are working ON SCREEN with Ahmad. Produce or update a working document he can see and edit.
Return ONLY JSON: {"title": string, "kind": "leads"|"email"|"invoice"|"campaign"|"client"|"plan"|"tax"|"calendar"|"report"|"other", "content": markdown string (the actual working document — tables, drafts, checklists), "say": one or two short warm sentences Axis says aloud, "next": [up to 3 short next-step choices]}.
Never invent client data, prices or figures; mark unknowns as [needs info].`;

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
      const out = await claude({ system: WORKSPACE_SYSTEM, messages: [{ role: 'user', content: user }], tier: pickTier(request_, body.tier), maxTokens: 2500 });
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
      const [tasks, approvals, inbox] = await Promise.all([readJSON('tasks', []), readJSON('approvals', []), readJSON('inbox-log', [])]);
      const facts = `Automations: ${tasks.map((t) => `${t.title} [${t.status}] last: ${t.last_result?.summary || 'not run'}`).join('; ') || 'none'}\nPending approvals: ${approvals.filter((a) => a.status === 'pending').map((a) => a.title).join('; ') || 'none'}\nRecent inbox: ${inbox.slice(0, 10).map((m) => `${m.from}: ${m.subject} (${m.action})`).join('; ') || 'none'}`;
      const out = await claude({ messages: [{ role: 'user', content: `Give Ahmad today's brief in 5 short lines max: done, waiting on him, next revenue move. Facts only:\n${facts}` }], tier: 'fast', maxTokens: 400 });
      return json(200, { ok: true, text: out.text });
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
