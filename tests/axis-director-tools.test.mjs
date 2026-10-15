// tests/axis-director-tools.test.mjs — RUN-AX3 (2026-10-15): the director ACTS on the live list.
//
// Drives the REAL netlify/functions/axis-director.js handler with a fake Anthropic model that emits tool_use
// blocks; every tool runs through the REAL /api/axis/tasks handler (in this process, in-memory Blobs, a real
// Aperture token) exactly as it would over HTTP in production. Fails the moment:
//   * a task ask ("let's work on top urgent items") is answered without the list, or by the Workspace brain;
//   * the loop is not bounded at 8 tool calls;
//   * a receipt Ahmad sees does not match an audit entry, or the model's own claim of an action that did not
//     run reaches him;
//   * an ambiguous target is guessed instead of asked;
//   * a send / pay / publish tool exists, or a sending approval is executed from chat;
//   * "I don't have access to your tasks" reaches him from this path (the RUN-AX2 transcript, pinned forbidden).
// No network: fetch is stubbed; anything unexpected throws. Run: node tests/axis-director-tools.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createMemoryBlobs, envelope } from './lib/axis-memory-store.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const T = require(path.join(ROOT, 'netlify/functions/lib/axis-tasks.cjs'));
const LOOP = require(path.join(ROOT, 'netlify/functions/lib/axis-task-loop.cjs'));
const { workspaceIntent } = require(path.join(ROOT, 'netlify/functions/lib/axis-workspace-intent.cjs'));
const { isTaskAsk } = await import(pathToFileURL(path.join(ROOT, 'assets/axis-tasks.js')).href);
let groups = 0; const ok = () => { groups++; };
const FORBIDDEN = /\b(?:don'?t|do not) have access\b/i;
const VERBOSE = process.argv.includes('--transcript');

// ── environment (restored in finally — this suite also runs inside the one-process desktop registry) ──
const saved = { secret: process.env.APERTURE_JWT_SECRET, key: process.env.ANTHROPIC_API_KEY, model: process.env.AXIS_MODEL_TASKS, skip: process.env.AXIS_BRAIN_SKIP, fetch: globalThis.fetch };
process.env.APERTURE_JWT_SECRET = 'axis-director-tools-secret';
process.env.ANTHROPIC_API_KEY = 'sk-test-not-a-real-key';
delete process.env.AXIS_MODEL_TASKS;
const b64u = (b) => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const hd = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), pl = b64u(JSON.stringify({ sub: 'ahmad', role: 'admin', exp: Math.floor(Date.now() / 1000) + 900 }));
const TOKEN = `${hd}.${pl}.${b64u(crypto.createHmac('sha256', process.env.APERTURE_JWT_SECRET).update(`${hd}.${pl}`).digest())}`;
const day = (n) => new Date(Date.now() + n * 86400000).toISOString();

const mem = createMemoryBlobs();
function seed() {
  mem.reset();
  mem.put('axis-exec', 'todos', [
    { id: 'todo-a', title: 'Sign the Whereby cancel', priority: 'high', needsYou: true, note: 'your signature', done: false, created_at: day(-3) },
    { id: 'todo-b', title: 'Draft Q4 newsletter', priority: 'normal', needsYou: false, done: false, created_at: day(-2) },
    { id: 'todo-c', title: 'Renew the Apollo seat', priority: 'normal', needsYou: true, done: false, created_at: day(-2) },
  ]);
  mem.put('axis-exec', 'approvals', [{ id: 'apr-reply', kind: 'reply', title: 'Reply to Acme: quote', detail: 'pricing', payload: { to: 'ceo@acme.example', text: 'hi' }, status: 'pending', created_at: day(-1) }]);
  for (const k of ['tasks', 'followups', 'workspace', 'local-jobs']) mem.put('axis-exec', k, []);
  mem.put('axis-snapshots', 'overview', envelope('overview', { kpis: { pipeline_value: 68000 }, ceo_critical: [
    { ref: '#1', n: 1, section: 'open', what: 'Answer the HEC IT-RFP question', who: "the agency's desk", deadline: day(-2), category: 'deadline-14d', one_click: null, overdue: true, closed: false, cleared: false },
    { ref: '#5', n: 5, section: 'open', what: 'Fix the Apollo payment method', who: 'enrichment', deadline: null, category: 'payment', one_click: 'Apollo billing page', overdue: false, closed: false, cleared: false },
  ] }));
  mem.put('axis-snapshots', 'inbox', envelope('inbox', { rows: [{ id: 41, thread_id: 't41', classification: 'reply_to_outreach', subject: 'Re: network audit quote', from_email: 'it@bay.example', received_at: day(-1), actioned: false }] }));
}
seed();
T._setGetStore(mem.getStore);
const endpoint = (await import(pathToFileURL(path.join(ROOT, 'netlify/functions/axis-tasks.mjs')).href)).default;

// ── the fake model + the in-process endpoint behind a stubbed fetch ──
const script = [];          // functions (requestBody) → Messages API response
const modelCalls = [];      // every request body the "model" received
const taskHttp = [];        // every request the director made to /api/axis/tasks
let tasksDown = false;
let modelStatus = 200;
let modelBody = null; // the error body the fake API returns for a non-200 (null → a generic api_error)
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u === 'https://api.anthropic.com/v1/messages') {
    const body = JSON.parse(opts.body);
    modelCalls.push(body);
    assert.equal(opts.headers['x-api-key'], 'sk-test-not-a-real-key');
    if (modelStatus !== 200) return new Response(modelBody || JSON.stringify({ type: 'error', error: { type: 'api_error' } }), { status: modelStatus });
    const next = script.shift();
    if (!next) throw new Error('fake model: no scripted reply left');
    return new Response(JSON.stringify(next(body)), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (u.startsWith('https://iisupp.test/api/axis/tasks')) {
    taskHttp.push({ method: opts.method || 'GET', url: u, body: opts.body ? JSON.parse(opts.body) : null });
    if (tasksDown) return new Response(JSON.stringify({ ok: false, error: 'down' }), { status: 503 });
    return endpoint(new Request(u, { method: opts.method || 'GET', headers: opts.headers, body: opts.body }));
  }
  throw new Error('unexpected network call in a test: ' + u);
};
const director = require(path.join(ROOT, 'netlify/functions/axis-director.js'));
const turn = async (text, extra = {}, history = []) => {
  const r = await director.handler({ httpMethod: 'POST', headers: { host: 'iisupp.test', authorization: 'Bearer ' + TOKEN }, body: JSON.stringify({ action: 'chat', messages: [...history, { role: 'user', content: text }], ...extra }) });
  assert.equal(r.statusCode, 200);
  const j = JSON.parse(r.body);
  assert.ok(!FORBIDDEN.test(j.text || ''), `the forbidden sentence never reaches Ahmad: ${j.text}`);
  return j;
};
const toolUse = (id, name, input) => ({ type: 'tool_use', id, name, input });
const textBlock = (text) => ({ type: 'text', text });
const transcriptLines = [];
const log = (s) => { transcriptLines.push(s); if (VERBOSE) console.log(s); };

try {
  // ---- 1. The tools: the full set, one schema each, and nothing that sends, pays or publishes ----
  {
    const names = T.TOOLS.map((t) => t.name);
    assert.deepEqual(names, ['list_tasks', 'update_task', 'complete_task', 'reopen_task', 'archive_task', 'snooze_task', 'follow_up', 'approve', 'reject', 'acknowledge', 'cancel', 'assign_to_agent', 'draft_reply', 'create_task']);
    for (const t of T.TOOLS) {
      assert.ok(t.description && t.input_schema && t.input_schema.type === 'object', `${t.name} is a complete tool definition`);
      assert.ok(!/\b(send|pay|publish|post|submit|purchase|transfer|wire|charge|email|tweet|upload)\w*\b/i.test(t.name), `${t.name} is not a send / pay / publish tool`);
      if (t.name !== 'list_tasks') assert.ok(T.TOOL_ACTION[t.name], `${t.name} maps to a mutation`);
    }
    assert.match(T.TOOLS.find((t) => t.name === 'draft_reply').description, /NOT sent/);
    assert.match(T.TOOLS.find((t) => t.name === 'approve').description, /staged for Ahmad's click/);
    // the agent enum is the director's roster (no drift)
    const dsrc = read('netlify/functions/axis-director.js');
    const block = dsrc.slice(dsrc.indexOf('const ROSTER = ['), dsrc.indexOf('];', dsrc.indexOf('const ROSTER = [')));
    const roster = [...block.matchAll(/\['([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(T.TOOLS.find((t) => t.name === 'assign_to_agent').input_schema.properties.agent.enum, roster, 'assign_to_agent offers exactly the director\'s roster');
    assert.deepEqual(T.AGENTS, roster);
    // the rules ride next to the situation instruction
    assert.match(LOOP.TASK_RULES, /Never say you lack access to his tasks/);
    assert.match(LOOP.TASK_RULES, /archive_task, cancel and reject run immediately when he named the item — his instruction IS the approval/);
    assert.match(LOOP.TASK_RULES, /Nothing you can do sends, pays or publishes/);
    assert.match(LOOP.TASK_RULES, /ask ONE short question naming the top 3 candidates/);
    assert.equal(LOOP.MAX_TOOL_CALLS, 8);
    ok();
  }

  // ---- 2. "let's work on top urgent items" → list_tasks → a ranked answer (never the Workspace, never "no access") ----
  {
    assert.ok(workspaceIntent("let's work on top urgent items"), 'the Workspace route WOULD have claimed it…');
    script.push((body) => ({ id: 'msg_1', type: 'message', role: 'assistant', stop_reason: 'tool_use', content: [textBlock('Pulling the live list.'), toolUse('toolu_01', 'list_tasks', { filter: 'needs-me' })] }));
    script.push((body) => {
      const res = JSON.parse(body.messages.at(-1).content[0].content);
      const top = res.items.slice(0, 3);
      return { id: 'msg_2', type: 'message', role: 'assistant', stop_reason: 'end_turn', content: [textBlock(
        `Top three, ranked:\n1. ${top[0].title} — ${top[0].dueLabel || 'no date'} — you: ${top[0].next}\n2. ${top[1].title} — you: ${top[1].next}\n3. ${top[2].title} — you: ${top[2].next}\nAXIS can take the Q4 newsletter draft. Want me to start with #1?`)] };
    });
    modelCalls.length = 0; taskHttp.length = 0;
    const j = await turn("let's work on top urgent items");
    assert.equal(j.workspace, null, '…but the task loop answers it, not the Workspace brain');
    assert.notEqual(j.text, 'Opening your workspace.');
    assert.equal(j.brainTier, 'anthropic-tools');
    assert.deepEqual(j.receipts, [], 'reading is not an action — no receipts');
    assert.equal(j.toolCalls, 1);
    assert.equal(modelCalls.length, 2);
    const sys = modelCalls[0].system;
    assert.match(sys, /LIVE SITUATION \(read this before answering/, 'the situation instruction is in the system prompt');
    assert.match(sys, /WORKING THE LIVE LIST WITH AHMAD/, 'the task rules sit next to it');
    assert.match(sys, /LIVE TASK LIST \(\d+ open · \d+ need Ahmad/, 'and the live list with ids');
    assert.match(sys, /\[ledger:#1\] #1 Answer the HEC IT-RFP question — OVERDUE 2d/);
    assert.ok(!/Respond with ONLY JSON/.test(sys), 'the chat-JSON contract is not imposed on a tool turn');
    assert.deepEqual(modelCalls[0].tools.map((t) => t.name), T.TOOLS.map((t) => t.name), 'the model is offered the task tools');
    assert.equal(modelCalls[0].model, 'claude-haiku-4-5', 'the fast tier by default (the whole turn must fit the function budget)');
    const tr = JSON.parse(modelCalls[1].messages.at(-1).content[0].content);
    assert.equal(tr.ok, true); assert.equal(tr.items[0].id, 'ledger:#1', 'list_tasks returned the ranked rows with ids');
    assert.match(j.text, /^Top three, ranked:\n1\. #1 Answer the HEC IT-RFP question — OVERDUE 2d — you:/);
    assert.equal(taskHttp.filter((h) => h.method === 'GET').length, 1, 'the list is read ONCE per turn (list_tasks filters that read)');
    log('— "let\'s work on top urgent items" —');
    log(`  model → ${JSON.stringify(modelCalls[0].messages.at(-1).content)}`);
    log(`  model → tool_use list_tasks ${JSON.stringify({ filter: 'needs-me' })}`);
    log(`  tool_result → ${tr.items.length} rows: ${tr.items.map((i) => i.id).join(', ')}`);
    log(`  AXIS → ${j.text.replace(/\n/g, '\n         ')}`);
    ok();
  }

  // ---- 3. Actions: two tools in one turn, by voice — receipts are the audit, the model's own claims are not ----
  {
    script.push(() => ({ stop_reason: 'tool_use', content: [toolUse('toolu_11', 'complete_task', { id: 'todo:todo-a' }), toolUse('toolu_12', 'snooze_task', { id: 'ledger:#5', until: 'friday' })] }));
    script.push(() => ({ stop_reason: 'end_turn', content: [textBlock('✔ Done: a receipt line the model wrote itself\nBoth handled. I also archived the newsletter.\nNext up is the HEC answer.')] }));
    const j = await turn('mark the whereby one done and snooze the apollo card to friday', { via: 'voice' });
    const audit = mem.read('axis-task-audit', 'log');
    assert.equal(audit.length, 2, 'two mutations, two audit entries');
    assert.deepEqual(audit.map((e) => [e.action, e.id, e.via, e.actor]).reverse(), [['complete', 'todo:todo-a', 'voice', 'ahmad'], ['snooze', 'ledger:#5', 'voice', 'ahmad']], 'run through axis-tasks with actor ahmad, via voice');
    assert.deepEqual(j.receipts, ['✔ Done: Sign the Whereby cancel', `⏰ Snoozed #5 Fix the Apollo payment method to ${require(path.join(ROOT, 'netlify/functions/lib/axis-task-ids.cjs')).fmtWhen(audit[0].after.until)}`]);
    assert.deepEqual(j.actions.map((a) => [a.action, a.id, a.ok]), audit.map((e) => [e.action, e.id, true]).reverse(), 'every receipt matches an audit entry, in order');
    assert.equal(j.text.split('\n')[0], j.receipts[0]); assert.equal(j.text.split('\n')[1], j.receipts[1]);
    assert.ok(!/a receipt line the model wrote itself/.test(j.text), 'a glyph line from the model is not a receipt — stripped');
    assert.ok(!/archived the newsletter/.test(j.text), 'a claimed action that did not run is dropped');
    assert.match(j.text, /Next up is the HEC answer\./, 'the rest of the answer stays');
    assert.equal(j.tasksChanged, true, 'the console is told to refresh the list');
    assert.equal(mem.read('axis-exec', 'todos').find((t) => t.id === 'todo-a').done, true);
    // the executor decides the channel and the actor — the model cannot
    script.push(() => ({ stop_reason: 'tool_use', content: [toolUse('toolu_13', 'approve', { id: 'approval:apr-reply', via: 'console', actor: 'axis', action: 'complete' })] }));
    script.push(() => ({ stop_reason: 'end_turn', content: [textBlock('It sends to the client, so the final click is yours.')] }));
    const s = await turn('approve the acme reply');
    assert.equal(mem.read('axis-exec', 'approvals')[0].status, 'pending', 'a model claiming via:"console" still only stages a sending approval');
    assert.match(s.receipts[0], /^🖐 Your click: approve Reply to Acme: quote — it sends/);
    assert.deepEqual(s.staged, ['approval:apr-reply']);
    assert.equal(mem.read('axis-task-audit', 'log')[0].action, 'approve.staged');
    assert.equal(mem.read('axis-task-audit', 'log')[0].actor, 'ahmad');
    log('— "mark the whereby one done and snooze the apollo card to friday" (voice) —');
    log(`  model → tool_use complete_task {"id":"todo:todo-a"} · snooze_task {"id":"ledger:#5","until":"friday"}`);
    log(`  AXIS → ${j.text.replace(/\n/g, '\n         ')}`);
    log('— "approve the acme reply" —');
    log(`  AXIS → ${s.text.replace(/\n/g, '\n         ')}`);
    ok();
  }

  // ---- 4. The loop is bounded: at most 8 tool calls, then it must answer ----
  {
    seed();
    let rounds = 0;
    const forcedNone = [];
    for (let i = 0; i < 6; i++) script.push((body) => {
      forcedNone.push(body.tool_choice && body.tool_choice.type);
      if (body.tool_choice && body.tool_choice.type === 'none') return { stop_reason: 'end_turn', content: [textBlock('That is as far as I go in one turn — the rest next.')] };
      rounds++;
      return { stop_reason: 'tool_use', content: [0, 1, 2].map((k) => toolUse(`toolu_b${rounds}${k}`, 'list_tasks', { filter: 'open', query: String(k) })) };
    });
    const j = await turn("let's go through every item on my list");
    assert.equal(j.toolCalls, 8, 'eight tool calls, not nine');
    assert.equal(forcedNone.filter((x) => x === 'none').length, 1, 'then one forced answer (tool_choice none)');
    assert.match(j.text, /as far as I go in one turn/);
    script.length = 0;
    // and the pure loop: extra tool_use blocks past the budget are answered with an error, never executed
    let executed = 0;
    const r = await LOOP.runToolLoop({
      messages: [{ role: 'user', content: 'go' }], maxToolCalls: 8,
      callModel: async ({ toolChoice }) => (toolChoice.type === 'none' ? { content: [textBlock('done')], stop_reason: 'end_turn' } : { content: Array.from({ length: 5 }, (_, k) => toolUse('t' + k + Math.random(), 'complete_task', { id: 'x' })), stop_reason: 'tool_use' }),
      execTool: async () => { executed++; return { ok: false, error: 'nope' }; },
    });
    assert.equal(executed, 8); assert.equal(r.toolCalls, 8); assert.equal(r.budgetHit, true);
    const lastResults = r.transcript.at(-1).content;
    assert.ok(lastResults.some((b) => b.is_error && /tool budget used \(8 calls\)/.test(b.content)), 'the 9th call is refused to the model in words');
    ok();
  }

  // ---- 5. An ambiguous target is asked about — top 3 — and nothing changes ----
  {
    seed();
    const auditBefore = (mem.read('axis-task-audit', 'log') || []).length;
    script.push(() => ({ stop_reason: 'tool_use', content: [toolUse('toolu_21', 'snooze_task', { match: 'apollo', until: 'friday' })] }));
    script.push((body) => {
      const res = JSON.parse(body.messages.at(-1).content[0].content);
      assert.equal(res.ok, false); assert.equal(res.code, 'ambiguous');
      assert.ok(res.candidates.length >= 2 && res.candidates.length <= 3, 'the model is handed the candidates');
      return { stop_reason: 'end_turn', content: [textBlock('Two items match Apollo.')] };
    });
    const j = await turn('snooze the apollo thing to friday');
    assert.deepEqual(j.receipts, []);
    assert.match(j.text, /Which one did you mean — 1\) .+ 2\) .+\?/, 'one short question with the candidates');
    assert.ok(/Fix the Apollo payment method/.test(j.text) && /Renew the Apollo seat/.test(j.text));
    assert.equal((mem.read('axis-task-audit', 'log') || []).length, auditBefore, 'nothing was changed or audited');
    // the model's own question is kept as is
    script.push(() => ({ stop_reason: 'tool_use', content: [toolUse('toolu_22', 'archive_task', { match: 'apollo' })] }));
    script.push(() => ({ stop_reason: 'end_turn', content: [textBlock('Which one — 1) #5 Fix the Apollo payment method 2) Renew the Apollo seat?')] }));
    const k = await turn('archive the apollo one');
    assert.equal(k.text, 'Which one — 1) #5 Fix the Apollo payment method 2) Renew the Apollo seat?');
    // archive / cancel / reject run immediately once named — no "are you sure"
    script.push(() => ({ stop_reason: 'tool_use', content: [toolUse('toolu_23', 'archive_task', { id: 'todo:todo-c' })] }));
    script.push(() => ({ stop_reason: 'end_turn', content: [textBlock('')] }));
    const a = await turn('archive the apollo seat renewal');
    assert.deepEqual(a.receipts, ['🗄 Archived: Renew the Apollo seat']);
    assert.equal(a.text, '🗄 Archived: Renew the Apollo seat', 'the receipt alone is the reply when the model adds nothing');
    assert.equal(mem.read('axis-exec', 'todos').find((t) => t.id === 'todo-c').archived, true);
    ok();
  }

  // ---- 6. "I don't have access" can never reach him from this path ----
  {
    script.push(() => ({ stop_reason: 'end_turn', content: [textBlock("I don't have access to your tasks, calendar, or work messages here, so I can't verify the top three yet.")] }));
    const j = await turn("what's on my list");
    assert.ok(!FORBIDDEN.test(j.text));
    assert.match(j.text, /^Live list: \d+ open · \d+ need you · \d+ AXIS handling\.\n1\. #1 Answer the HEC IT-RFP question/, 'replaced by the live list itself');
    for (const v of ["I do not have access to your to-do list.", "Unfortunately I can't access your tasks.", "I don't currently have visibility into your approvals.", "I'm unable to see your list from here.", 'I have no access to that board.'])
      assert.ok(LOOP.NO_ACCESS.test(v), `caught: ${v}`);
    assert.ok(!LOOP.NO_ACCESS.test("You don't have access to CanadaBuys yet — that one-click is yours."), 'a fact about a portal is not the failure');
    ok();
  }

  // ---- 7. Honest fallbacks: no key, the task service down, the model down ----
  {
    process.env.ANTHROPIC_API_KEY = '';
    const calls0 = modelCalls.length;
    const a = await turn('what needs me');
    assert.equal(modelCalls.length, calls0, 'no key → no model call');
    assert.match(a.text, /^Live list: \d+ open · \d+ need you/, 'a list ask is answered from the list for $0');
    assert.equal(a.degraded, undefined);
    const b = await turn('mark the whereby one done');
    assert.equal(b.degraded, true); assert.equal(b.reason, 'no_key');
    assert.match(b.text, /^My reasoning brain is not connected right now, so I did not change anything\./, 'an action is never guessed at');
    process.env.ANTHROPIC_API_KEY = 'sk-test-not-a-real-key';
    tasksDown = true;
    const c = await turn('what is on my list');
    assert.equal(c.degraded, true); assert.equal(c.reason, 'tasks_unavailable');
    assert.match(c.text, /could not read the live task list just now — the task service did not answer, so nothing was changed and I am not going to call the list empty/);
    tasksDown = false;
    modelStatus = 529;
    const d = await turn('snooze the HEC row to monday');
    assert.equal(d.degraded, true); assert.equal(d.reason, 'overloaded');
    assert.match(d.text, /I could not reach my reasoning brain \(529\), so I did not change anything\./);
    // Found live 2026-10-15: the metered account answered 400 "credit balance is too low" and the loop said only
    // "(400)". The body is classified like axis-director's classifyBrainError — same codes, one honest sentence,
    // nothing changed — and a LIST ask still answers from the list while carrying the reason.
    modelStatus = 400; modelBody = JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.' } });
    const e = await turn('snooze the HEC row to monday');
    assert.equal(e.degraded, true); assert.equal(e.reason, 'no_credit'); assert.equal(e.tasksChanged, false); assert.deepEqual(e.receipts, []);
    assert.match(e.text, /^My metered reasoning brain is out of credit \(the Anthropic account says the balance is too low\), so I did not change anything\./);
    assert.doesNotMatch(e.text, /Plans & Billing|invalid_request_error/, 'the API body is classified, never pasted');
    const f = await turn('what needs me');
    assert.match(f.text, /^Live list: \d+ open · \d+ need you/, 'a list ask still answers from the list for $0…');
    assert.equal(f.degraded, true); assert.equal(f.reason, 'no_credit'); assert.equal(f.brainTier, 'tasks-local');
    modelStatus = 401; modelBody = JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
    const g = await turn('mark the whereby one done');
    assert.equal(g.reason, 'auth'); assert.match(g.text, /^My API key is being rejected \(check ANTHROPIC_API_KEY in Netlify\), so I did not change anything\./);
    modelStatus = 404; modelBody = JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'model: nope' } });
    const h = await turn('mark the whereby one done');
    assert.equal(h.reason, 'bad_model'); assert.match(h.text, /^The task model is not found \(check AXIS_MODEL_TASKS in Netlify\)/);
    modelStatus = 400; modelBody = JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'tools.3.input_schema: extra fields not permitted' } });
    const i = await turn('mark the whereby one done');
    assert.equal(i.reason, 'error_400'); assert.match(i.text, /^My reasoning brain refused the request \(400: tools\.3\.input_schema: extra fields not permitted\), so I did not change anything\./);
    // pure: the classifier itself
    assert.equal(LOOP.classifyModelError(429, '').reason, 'rate_limit'); assert.equal(LOOP.classifyModelError(0, '').reason, 'unreachable'); assert.equal(LOOP.classifyModelError(503, '').reason, 'overloaded');
    assert.equal(LOOP.classifyModelError(403, '{"error":{"type":"permission_error"}}').reason, 'permission');
    modelStatus = 200; modelBody = null;
    ok();
  }

  // ---- 8. Routing: task asks go to the loop; everything else keeps its old route. Browser and server agree ----
  {
    const TASK = ["what's on my list", 'what is on my to-do list', 'what needs me today', 'what needs my attention', "let's work on top urgent items", 'lets work on the top 3 items',
      "Let's work on: #5 Fix the Apollo payment method [ledger:#5]", 'show me my tasks', 'go through my list', 'top five priorities', 'mark that one done', 'mark the whereby item as done',
      'snooze this for a week', 'snooze the apollo card to friday', 'approve the first one', 'reject the domain spend', 'archive the newsletter task', 'remove Acme Dental from my to-do list',
      'cancel the apollo refresh', 'acknowledge the HEC row', 'follow up on the Bay Street quote next week', 'assign the newsletter to Pitch', 'draft a reply to the network audit email',
      'reply to Bay Street', 'reopen the Whereby task', 'add call the CDIC desk to my list', "I've finished the Whereby signature", 'push it to monday', 'change the due date of the proposal'];
    const NOT = ['hello Axis', 'how do I fix a printer that is offline', "let's work on the marketing campaign", 'pull up my client follow-ups', 'what is the weather', 'draft a LinkedIn post about cybersecurity',
      'what did we decide about pricing', 'remind me what we agreed with 123 Dental', 'okay hold on', 'is outlook running right now'];
    for (const t of TASK) { assert.ok(T.taskIntent(t), `server: task ask — ${t}`); assert.equal(isTaskAsk(t), T.taskIntent(t), `browser and server agree — ${t}`); }
    for (const t of NOT) { assert.equal(T.taskIntent(t), null, `server: not a task ask — ${t}`); assert.equal(isTaskAsk(t), null, `browser: not a task ask — ${t}`); }
    // the Workspace route still owns real work
    assert.ok(workspaceIntent("let's work on the marketing campaign"));
    const w = await director.handler({ httpMethod: 'POST', headers: { host: 'iisupp.test', authorization: 'Bearer ' + TOKEN }, body: JSON.stringify({ action: 'chat', messages: [{ role: 'user', content: "let's work on the marketing campaign" }] }) });
    assert.equal(JSON.parse(w.body).text, 'Opening your workspace.');
    // static: order in the director and in the console
    const d = read('netlify/functions/axis-director.js');
    assert.ok(d.indexOf('taskLoop.taskIntent(askText)') > 0 && d.indexOf('taskLoop.taskIntent(askText)') < d.indexOf('const workspace = workspaceIntent(askText)'), 'task asks are checked before the Workspace route');
    assert.ok(d.indexOf('taskLoop.runTaskTurn(') < d.indexOf('askBrain'), '…and before the cascade, whose tiers cannot act');
    assert.match(d, /via: body\.via === 'voice' \? 'voice' : 'chat'/, 'voice and chat are told apart');
    assert.ok(!/api\.anthropic\.com/.test(d.slice(0, d.indexOf('askBrain'))), 'no metered call before the cascade in the director itself');
    const app = read('assets/axis-app.js');
    assert.match(app, /task: kind, via: spoken \? 'voice' : 'chat'/, 'the console sends the task kind and the channel');
    assert.match(app, /window\.dispatchEvent\(new CustomEvent\('axis:tasks-changed'/, 'a chat receipt refreshes the Live task view at once');
    assert.match(read('netlify/functions/axis-exec.mjs'), /sit\.tasksText = tasksBlock\(list\)/, 'the Workspace brain gets the live list too');
    // receipts are spoken as words: every receipt glyph is stripped by the console's speech humanizer
    const { TASK_GLYPHS } = await import(pathToFileURL(path.join(ROOT, 'assets/axis-tasks.js')).href);
    assert.deepEqual(TASK_GLYPHS, T.RECEIPT_GLYPHS, 'the console knows the same receipt glyphs the server writes');
    const m = app.match(/function axisHumanizeForSpeech\([\s\S]*?\n}/);
    const humanize = new Function('return ' + m[0])();
    for (const g of T.RECEIPT_GLYPHS) assert.ok(!humanize(`${g} Done: Sign the Whereby cancel`).includes(g), `the voice does not read "${g}" aloud`);
    assert.equal(humanize('✔ Done: Sign the Whereby cancel\n⏰ Snoozed #5 Fix the Apollo card to Fri Oct 16'), 'Done: Sign the Whereby cancel. Snoozed 5 Fix the Apollo card to Fri Oct 16');
    ok();
  }
} finally {
  globalThis.fetch = saved.fetch;
  T._setGetStore(null);
  for (const [k, env] of [['secret', 'APERTURE_JWT_SECRET'], ['key', 'ANTHROPIC_API_KEY'], ['model', 'AXIS_MODEL_TASKS'], ['skip', 'AXIS_BRAIN_SKIP']])
    if (saved[k] === undefined) delete process.env[env]; else process.env[env] = saved[k];
}
if (!VERBOSE) console.log(transcriptLines.slice(0, 6).join('\n'));
console.log(`[axis-director-tools] ${groups} groups passed`);
