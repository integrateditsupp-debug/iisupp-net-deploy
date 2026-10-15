// axis-task-loop.cjs — the director ACTS on the live list (RUN-AX3, 2026-10-15).
//
// "what's on my list", "let's work on the top urgent items", "mark the Whereby one done", "snooze the Apollo
// card to Friday", "draft a reply to Bay Street" — the director gives its brain the live task list and a set of
// tools (lib/axis-tasks.cjs TOOLS) and runs a BOUNDED loop: at most 8 tool calls, then it must answer. Every
// tool runs through /api/axis/tasks (lib/axis-tasks.cjs), with actor "ahmad" and via chat|voice.
//
// Why over HTTP: axis-director.js is a Lambda-compatibility function. Netlify does not hand those a Blobs
// context (measured 2026-08-11, axis-brain.cjs; again 2026-10-14, lib/sentinel-store.cjs), and strong reads
// are impossible there even after connectLambda. The task endpoint is a v2 function with the full context —
// the same reason the brain queue lives in axis-brain-queue.mjs. One list read per turn (with the situation),
// one POST per action.
//
// Honest by construction:
//   * the receipts Ahmad sees are built from what the endpoint actually wrote (its audit), never from the
//     model's prose — a glyph-led line in the model's text is stripped, and a sentence claiming an action
//     that did not run this turn is dropped;
//   * "I don't have access to your tasks" can never reach him from this path — it is replaced by the list;
//   * an ambiguous target gets ONE short question with the top 3 candidates;
//   * when no model can be reached, the list question is answered from the list itself ($0) and an action
//     ask says plainly that nothing was changed.
'use strict';
const T = require('./axis-tasks.cjs');
const { situationInstruction } = require('./axis-situation.cjs');

const MAX_TOOL_CALLS = 8;
const DEFAULT_BUDGET_MS = 9000;         // the director must return inside Netlify's ~10 s
const API = 'https://api.anthropic.com/v1/messages';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const GLYPH_LINE = new RegExp(`^\\s*(?:${T.RECEIPT_GLYPHS.map(esc).join('|')})`);
// The failure mode this run exists to kill (RUN-AX2 transcript, 2026-10-13: "I don't have access to your
// tasks, calendar, or work messages here…"). Any variant of it on this path is replaced by the list.
// First person only: "you don't have access to CanadaBuys yet" is a fact about a portal, not this failure.
const NO_ACCESS = /\bi(?:'m| am)?\s+(?:currently\s+)?(?:don'?t|do not|can'?t|cannot|unable to|not able to)\s+(?:currently\s+)?(?:have\s+)?(?:any\s+)?(?:access|visibility|see|view|read)\b|\bi have no (?:access|visibility)\b|\bno access to (?:your|his|the) (?:tasks?|to-?dos?|list|approvals?|board|ledger|follow-?ups?)\b/i;

const TASK_RULES = `WORKING THE LIVE LIST WITH AHMAD — you have tools that read and change it. Use them.
- Answer FROM the live list below (or list_tasks). Never say you lack access to his tasks, to-dos, approvals, follow-ups, the CEO ledger or the board — you have them. Only the calendar and the three mailboxes are not connected.
- When Ahmad asks you to do something to an item — done, snooze, archive / delete / remove, follow up, approve, reject, cancel, acknowledge, assign to an agent, draft a reply, edit, reopen, add — DO it with the tool, using the item's [id]. Several items → several tool calls (8 at most per turn).
- If his words could mean more than one item, do NOT guess: ask ONE short question naming the top 3 candidates as "1) … 2) … 3) …".
- archive_task, cancel and reject run immediately when he named the item — his instruction IS the approval. Never ask "are you sure".
- Nothing you can do sends, pays or publishes. approve on an approval that would send an email, commit money or run a command on his PC is STAGED for his click — say the button is waiting in the Live task view. Replies are drafted with draft_reply, never sent.
- The system prints one receipt line for every action that actually ran. Do not write receipt lines yourself and never say something was done unless its tool result said ok.
- "what's on my list" / "what needs me" / "let's work on the top items" → list_tasks (or the live list), then a ranked answer: short bullets, each with the next step and who does it (Ahmad, AXIS, or an agent). Lead with what he must decide; offer to take the AXIS-able ones.
- Dates: use the local Toronto date in the situation; pass dates as YYYY-MM-DD or day words ("friday", "next week").
- Short: 1-6 lines, plain text, no headers, no emojis.`;

/** The model the loop runs on. Fast by default — the whole turn must fit inside the function's budget. */
function taskModel(env = process.env) {
  return env.AXIS_MODEL_TASKS || env.AXIS_MODEL_FAST || 'claude-haiku-4-5';
}

/** The console's transcript → Messages API turns (alternating, user first and last, strings only). */
function shapeMessages(messages, askText) {
  const turns = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant') && m.content.trim())
    .slice(-10).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  const out = [];
  for (const m of turns) { const prev = out[out.length - 1]; if (prev && prev.role === m.role) prev.content += '\n' + m.content; else out.push({ ...m }); }
  while (out.length && out[0].role !== 'user') out.shift();
  if (!out.length || out[out.length - 1].role !== 'user') out.push({ role: 'user', content: String(askText || '').slice(0, 2000) });
  return out;
}

async function fetchJSON(fetchImpl, url, opts, timeoutMs) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), Math.max(300, timeoutMs));
  try {
    const r = await fetchImpl(url, { ...opts, signal: ctl.signal });
    let json = null;
    try { json = await r.json(); } catch { json = null; }
    return { status: r.status, ok: r.ok, json };
  } catch (e) { return { status: 0, ok: false, json: null, error: String((e && e.message) || e).slice(0, 120) }; } finally { clearTimeout(t); }
}

/** One Anthropic Messages call with the task tools. Throws {status} on a non-2xx. */
async function callAnthropic({ apiKey, model, system, messages, tools = T.TOOLS, toolChoice = null, maxTokens = 800, timeoutMs = 8000, fetchImpl = globalThis.fetch }) {
  const send = async (withChoice) => {
    const body = { model, max_tokens: maxTokens, system, messages, tools };
    if (withChoice && toolChoice) body.tool_choice = toolChoice;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), Math.max(800, timeoutMs));
    try {
      return await fetchImpl(API, { method: 'POST', signal: ctl.signal, headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(body) });
    } finally { clearTimeout(t); }
  };
  let r = await send(true);
  // A runtime that does not know tool_choice "none" answers 400 — ask again without it; any tool_use in that
  // answer is ignored by the loop (the budget is spent), so the turn still ends in words.
  if (!r.ok && r.status === 400 && toolChoice && toolChoice.type === 'none') r = await send(false);
  if (!r.ok) { const err = new Error(`anthropic ${r.status}`); err.status = r.status; try { err.body = (await r.text()).slice(0, 300); } catch { err.body = ''; } throw err; }
  return r.json();
}

/** What the model is shown of a tool result: short, ids first, no store internals. */
function modelView(name, r) {
  if (!r) return { ok: false, error: 'no result' };
  if (name === 'list_tasks') return r;
  if (r.ok === false) return { ok: false, error: r.error || 'failed', code: r.code || null, ...(r.candidates ? { candidates: r.candidates } : {}), ...(r.actions ? { availableActions: r.actions } : {}) };
  return { ok: true, receipt: r.receipt, item: r.item ? T.compactItem(r.item) : null, ...(r.staged ? { staged: true, needsClick: true } : {}), ...(r.created ? { created: T.compactItem(r.created) } : {}), ...(r.note ? { note: r.note } : {}) };
}

/**
 * The bounded loop. Pure orchestration — the model call and the tool executor are injected, so the tests
 * drive it with a fake model and an in-process endpoint.
 * → { text, actions:[{tool,input,result}], toolCalls, stop, budgetHit, transcript }
 */
async function runToolLoop({ callModel, execTool, messages, maxToolCalls = MAX_TOOL_CALLS, deadline = Infinity, clock = Date.now }) {
  const convo = messages.map((m) => ({ ...m }));
  const actions = [];
  let toolCalls = 0, text = '', stop = null, budgetHit = false, error = null;
  for (let round = 0; round < maxToolCalls + 3; round++) {
    const remaining = deadline - clock();
    if (remaining < 1500) { stop = 'deadline'; break; }
    const force = toolCalls >= maxToolCalls;
    let resp;
    try { resp = await callModel({ messages: convo, toolChoice: force ? { type: 'none' } : { type: 'auto' }, timeoutMs: Math.min(remaining - 500, 8000) }); }
    catch (e) { stop = 'model_error'; error = e; break; }
    const content = Array.isArray(resp && resp.content) ? resp.content : [];
    const said = content.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n').trim();
    const uses = content.filter((b) => b && b.type === 'tool_use');
    if (!uses.length || force) { text = said; stop = force && uses.length ? 'budget' : ((resp && resp.stop_reason) || 'end_turn'); break; }
    convo.push({ role: 'assistant', content });
    const results = [];
    for (const u of uses) {
      if (toolCalls >= maxToolCalls) {
        budgetHit = true;
        results.push({ type: 'tool_result', tool_use_id: u.id, is_error: true, content: JSON.stringify({ ok: false, error: `tool budget used (${maxToolCalls} calls) — answer Ahmad now with what you have` }) });
        continue;
      }
      toolCalls++;
      let r;
      try { r = await execTool(u.name, u.input && typeof u.input === 'object' ? u.input : {}); } catch (e) { r = { ok: false, error: String((e && e.message) || e).slice(0, 200) }; }
      actions.push({ tool: u.name, input: u.input || {}, result: r });
      const view = modelView(u.name, r);
      results.push({ type: 'tool_result', tool_use_id: u.id, ...(view.ok === false ? { is_error: true } : {}), content: JSON.stringify(view) });
    }
    convo.push({ role: 'user', content: results });
  }
  if (!stop) stop = 'rounds';
  return { text, actions, toolCalls, stop, budgetHit, error, transcript: convo };
}

/** Run the tools against /api/axis/tasks. list_tasks reads the list fetched once for this turn. */
function httpExecutor({ origin, auth, via, prefetched, fetchImpl = globalThis.fetch, timeoutMs = 3500 }) {
  const cache = prefetched ? { ...prefetched, items: (prefetched.items || []).slice() } : null;
  return async (name, input) => {
    if (name === 'list_tasks') {
      if (!cache) return { ok: false, error: 'the live list did not answer this turn' };
      const limit = Math.max(1, Math.min(40, Number(input.limit) || 15));
      const items = T.filterItems(cache.items, input.filter || 'open', input.query || null);
      return { ok: true, counts: cache.counts, total: items.length, items: items.slice(0, limit).map(T.compactItem) };
    }
    const action = T.TOOL_ACTION[name];
    if (!action) return { ok: false, error: `unknown tool ${String(name).slice(0, 40)}` };
    // The model chooses the target and the fields — never the action, the channel or the actor.
    const { id = null, match = null, ...rest } = input || {};
    delete rest.action; delete rest.via; delete rest.actor;
    const body = { ...rest, id, match, action, via, actor: 'ahmad' };
    const r = await fetchJSON(fetchImpl, `${origin}/api/axis/tasks`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: auth }, body: JSON.stringify(body) }, timeoutMs);
    if (r.json && r.json.ok) {
      if (cache && r.json.item) { const i = cache.items.findIndex((x) => x.id === r.json.item.id); if (i >= 0) cache.items[i] = r.json.item; }
      if (cache && r.json.created) cache.items.unshift(r.json.created);
      return r.json;
    }
    return { ok: false, status: r.status, ...(r.json && typeof r.json === 'object' ? r.json : { error: r.error ? `the task service did not answer (${r.error})` : 'the task service did not answer' }) };
  };
}

// Sentences that CLAIM an action. Dropped when that kind of action did not actually run this turn.
const CLAIM_VERBS = { marked: 'complete', completed: 'complete', finished: 'complete', archived: 'archive', deleted: 'archive', removed: 'archive', snoozed: 'snooze',
  approved: 'approve', rejected: 'reject', declined: 'reject', cancelled: 'cancel', canceled: 'cancel', acknowledged: 'acknowledge', assigned: 'assign', handed: 'assign',
  drafted: 'draft_reply', added: 'create', created: 'create', updated: 'update', rescheduled: 'update', moved: 'update', reopened: 'reopen', scheduled: 'follow_up' };
const VERB_ALT = Object.keys(CLAIM_VERBS).join('|');
const ADVERBS = '(?:(?:also|already|just|now|then|went ahead and)\\s+)*';
const CLAIM_LEAD = new RegExp(`^(?:(?:ok(?:ay)?|done|all set|sure|got it)[,.!:\\s—–-]*)?(?:(?:and|also|then|plus)[,\\s]+)?(?:i(?:'ve| have)?\\s+|axis\\s+(?:has\\s+)?)?${ADVERBS}(${VERB_ALT})\\b`, 'i');
const CLAIM_I = new RegExp(`\\b(?:i(?:'ve| have)?|axis(?: has)?)\\s+${ADVERBS}(${VERB_ALT})\\b`, 'i');
const CLAIM_STATE = new RegExp(`\\b(?:it|that|this|they|those|both|all (?:three|two|of them))(?:'s|'re| is| are| has been| have been)\\s+(?:now\\s+|already\\s+)?(${VERB_ALT})\\b`, 'i');
function guardClaims(text, ranActions) {
  const ran = new Set(ranActions);
  const lines = String(text || '').split('\n');
  const kept = [];
  for (const line of lines) {
    const parts = line.match(/[^.!?]+[.!?]*\s*/g) || [line];
    const ok = parts.filter((s) => {
      const m = s.trim().match(CLAIM_LEAD) || s.match(CLAIM_I) || s.match(CLAIM_STATE);
      if (!m) return true;
      const act = CLAIM_VERBS[m[1].toLowerCase()];
      return ran.has(act) || (act === 'approve' && ran.has('approve'));
    });
    const joined = ok.join('').trim();
    if (joined) kept.push(joined);
  }
  return kept.join('\n').trim();
}
const stripReceiptLines = (text) => String(text || '').split('\n').filter((l) => !GLYPH_LINE.test(l)).join('\n').trim();
const askWhich = (cands) => `Which one did you mean — ${(cands || []).slice(0, 3).map((c, i) => `${i + 1}) ${c.title}`).join(' ')}?`;

/** Receipts (from the audit) + the guarded answer → the reply Ahmad sees and hears. */
function composeReply({ loop, pre, kind }) {
  const ran = loop.actions.filter((a) => a.tool !== 'list_tasks' && a.result && a.result.ok);
  const receipts = ran.map((a) => a.result.receipt).filter(Boolean);
  const executed = ran.filter((a) => !a.result.staged).map((a) => a.result.action || T.TOOL_ACTION[a.tool]);
  let text = stripReceiptLines(loop.text);
  if (NO_ACCESS.test(text)) text = T.renderListAnswer(pre);
  text = guardClaims(text, executed);
  const amb = loop.actions.find((a) => a.result && a.result.code === 'ambiguous');
  if (amb && !/\?/.test(text)) text = [text, askWhich(amb.result.candidates)].filter(Boolean).join('\n');
  const failed = loop.actions.filter((a) => a.tool !== 'list_tasks' && a.result && a.result.ok === false && a.result.code !== 'ambiguous');
  if (failed.length && !text) text = failed.map((a) => `Could not ${T.TOOL_ACTION[a.tool] || a.tool} that: ${a.result.error || 'it failed'}. Nothing was changed for it.`).join('\n');
  if (!text) {
    if (receipts.length) text = '';
    else if (kind === 'list' || !loop.actions.length) text = T.renderListAnswer(pre);
    else text = 'Nothing was changed.';
  }
  if ((loop.stop === 'deadline' || loop.stop === 'model_error') && !ran.length && kind !== 'list' && !amb) {
    text = 'I ran out of time before I could act — nothing was changed. Say it again, or use the Live task view.';
  }
  const reply = [...receipts, text].filter(Boolean).join('\n');
  return { text: reply, receipts, staged: ran.filter((a) => a.result.staged).map((a) => a.result.item && a.result.item.id).filter(Boolean),
    actions: loop.actions.map((a) => ({ tool: a.tool, ok: !!(a.result && a.result.ok), id: a.result && a.result.item ? a.result.item.id : (a.input && a.input.id) || null, action: a.result && a.result.action ? a.result.action : T.TOOL_ACTION[a.tool] || a.tool, receipt: a.result && a.result.receipt ? a.result.receipt : null, error: a.result && a.result.ok === false ? (a.result.error || 'failed') : null })),
    toolCalls: loop.toolCalls, tasksChanged: ran.length > 0, stop: loop.stop };
}

/** The system prompt for a task turn: persona + the rules + the situation + the live list with ids. */
function taskSystem({ persona = '', situation = null, list }) {
  return [persona.trim(), TASK_RULES, situation && situation.text && situation.local ? situationInstruction(situation) : 'LIVE SITUATION: did not answer this turn — say so in one line if it matters.', T.tasksBlock(list)].filter(Boolean).join('\n\n');
}

/**
 * One task turn, end to end. Never throws. → { text, receipts, actions, toolCalls, tasksChanged, brainTier,
 * degraded?, reason?, stop }
 */
async function runTaskTurn({ askText, messages = [], via = 'chat', origin = '', auth = '', apiKey = '', model = taskModel(), persona = '', startedAt = Date.now(), budgetMs = DEFAULT_BUDGET_MS, fetchImpl = globalThis.fetch, kind = null } = {}) {
  const deadline = startedAt + budgetMs;
  const k = kind || T.taskIntent(askText) || 'action';
  const channel = via === 'voice' ? 'voice' : 'chat';
  // 1. The live list + the situation, once, through the v2 endpoint.
  const got = origin ? await fetchJSON(fetchImpl, `${origin}/api/axis/tasks?situation=1`, { headers: { authorization: auth } }, Math.min(3500, Math.max(800, deadline - Date.now() - 4000))) : { ok: false };
  const pre = got.ok && got.json && got.json.ok ? got.json : null;
  if (!pre) {
    return { text: 'I could not read the live task list just now — the task service did not answer, so nothing was changed and I am not going to call the list empty.', receipts: [], actions: [], toolCalls: 0, tasksChanged: false, brainTier: 'tasks', degraded: true, reason: 'tasks_unavailable', stop: 'no_list' };
  }
  // 2. No reasoning brain → the list answers a list question for $0; an action is not guessed at.
  if (!apiKey) {
    const text = k === 'list' ? T.renderListAnswer(pre) : `My reasoning brain is not connected right now, so I did not change anything.\n${T.renderListAnswer(pre, { limit: 3 })}`;
    return { text, receipts: [], actions: [], toolCalls: 0, tasksChanged: false, brainTier: 'tasks-local', degraded: k !== 'list', reason: k !== 'list' ? 'no_key' : undefined, stop: 'no_model' };
  }
  // 3. The bounded tool loop.
  const system = taskSystem({ persona, situation: pre.situation, list: pre });
  const loop = await runToolLoop({
    callModel: (o) => callAnthropic({ apiKey, model, system, fetchImpl, ...o }),
    execTool: httpExecutor({ origin, auth, via: channel, prefetched: pre, fetchImpl }),
    messages: shapeMessages(messages, askText),
    deadline,
  });
  const out = composeReply({ loop, pre, kind: k });
  if (loop.stop === 'model_error' && !out.tasksChanged) {
    const status = loop.error && loop.error.status;
    return { ...out, text: k === 'list' ? T.renderListAnswer(pre) : `I could not reach my reasoning brain${status ? ' (' + status + ')' : ''}, so I did not change anything.\n${T.renderListAnswer(pre, { limit: 3 })}`, brainTier: 'tasks-local', degraded: k !== 'list', reason: status === 401 ? 'auth' : 'unreachable' };
  }
  return { ...out, brainTier: 'anthropic-tools', model };
}

module.exports = { MAX_TOOL_CALLS, TASK_RULES, NO_ACCESS, taskModel, taskIntent: T.taskIntent, shapeMessages, callAnthropic, runToolLoop, httpExecutor, guardClaims, stripReceiptLines, composeReply, taskSystem, runTaskTurn };
