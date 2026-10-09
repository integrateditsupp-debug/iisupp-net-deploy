// axis-exec.mjs — AXIS executive-assistant API (Aperture login required).
// Workspace ("pull it up, let's work on it"), automations ("automate it"), approvals, Apollo leads,
// inbox overview, daily brief, integration status. Spending always waits for Ahmad's approval.
import { bearerFromEvent } from './_verify-bearer.cjs';
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

    // ── Leads (Apollo) ───────────────────────────────────────────────────
    if (action === 'leads.search') return json(200, { ok: true, results: await leadSearch(String(body.query || '')) });

    // ── Daily brief ──────────────────────────────────────────────────────
    if (action === 'brief') {
      const [tasks, approvals, inbox] = await Promise.all([readJSON('tasks', []), readJSON('approvals', []), readJSON('inbox-log', [])]);
      const facts = `Automations: ${tasks.map((t) => `${t.title} [${t.status}] last: ${t.last_result?.summary || 'not run'}`).join('; ') || 'none'}\nPending approvals: ${approvals.filter((a) => a.status === 'pending').map((a) => a.title).join('; ') || 'none'}\nRecent inbox: ${inbox.slice(0, 10).map((m) => `${m.from}: ${m.subject} (${m.action})`).join('; ') || 'none'}`;
      const out = await claude({ messages: [{ role: 'user', content: `Give Ahmad today's brief in 5 short lines max: done, waiting on him, next revenue move. Facts only:\n${facts}` }], tier: 'fast', maxTokens: 400 });
      return json(200, { ok: true, text: out.text });
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

async function leadSearch(query) {
  const plan = parseJSON((await claude({
    messages: [{ role: 'user', content: `Turn this into Apollo people-search filters. Return ONLY JSON {"person_titles":[],"person_locations":[],"organization_num_employees_ranges":[],"q_keywords":""}. Ideal clients for an IT/cybersecurity/AI services firm: SMB owners, office managers, CTOs, IT managers. Request: ${query}` }],
    tier: 'fast', maxTokens: 300,
  })).text, {});
  const res = await apollo('/api/v1/mixed_people/api_search', { per_page: 25, page: 1, ...plan });
  return (res.people || []).map((p) => ({ id: p.id, name: [p.first_name, p.last_name_obfuscated || p.last_name].filter(Boolean).join(' '), title: p.title, company: p.organization?.name, location: [p.city, p.state, p.country].filter(Boolean).join(', ') }));
}

export const config = { path: '/api/axis/exec' };
