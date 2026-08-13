#!/usr/bin/env node
// axis-brain-worker.mjs — answers AXIS questions on Ahmad's Claude Max plan instead of metered
// API credits, and banks each answer into the ARIA brain.
//
// THE POINT (2026-08-11): the Netlify function cannot reach the Max subscription. That plan
// authenticates over OAuth held locally in ~/.claude/.credentials.json (subscriptionType "max",
// scope user:inference), bound to Claude Code sessions — a cloud function has no access to it, and
// copying those tokens to a server would be a terms violation and a credential leak. This worker
// closes the gap from the *inside*: it runs on Ahmad's machine, where `claude` is already logged in
// on the plan he pays for, and pulls questions out rather than having secrets pushed in.
//
//   web console → tier 3 queues a question in Blobs → THIS worker answers with the local CLI
//                → answer returns to the console → the same answer is banked in the ARIA brain
//
// Every answer costs $0 in API credits. Anthropic API is only ever reached if this worker is
// offline AND the KB and research agents both came up empty.
//
// Run:  node scripts/axis-brain-worker.mjs
// Env:  NETLIFY_SITE_ID + NETLIFY_AUTH_TOKEN (Blobs access), CLAUDE_BIN (optional CLI path)

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStore } from '@netlify/blobs';
import * as vault from './lib/axis-vault-brain.mjs';
import { classify, escalate, answerUsable, recordUse, usageReport, TIER_BY_NAME,
         modelForRequest } from './lib/axis-model-router.mjs';
// The same conversation detector the cloud cascade uses (Node ESM imports the CJS lib directly).
// Measured 2026-08-12: "I don't see anything opened on the browser show me where" hit the vault's
// DIRECT tier and came back as a raw feedback note — wikilinks and all — because vault matching is
// word overlap and cannot know a correction from a question. One detector, both brains.
import { isConversational } from '../netlify/functions/lib/axis-brain.cjs';

const JOBS = 'axis-brain-jobs';
const KB_LIVE = 'aria-kb-live';
const HEARTBEAT_KEY = 'worker-heartbeat';
const HEARTBEAT_MS = 30000;     // the function treats >120s as offline
const POLL_MS = 1500;
const CLI_TIMEOUT_MS = 55000;
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';

// The system prompt lives in the Obsidian vault at 00_Index/AXIS-SYSTEM.md so Ahmad can edit AXIS's
// character in Obsidian without touching code. This fallback is used only when the vault is missing,
// and is deliberately a compressed version of the same instructions rather than a different persona
// — a worker that quietly becomes a different assistant when a folder is absent is worse than one
// that refuses to start.
const SYSTEM_FALLBACK = `You are AXIS, Ahmad Wasee's operating partner at Integrated IT Support Inc.
Address him as "Ahmad". Answer the question that was asked, directly, in plain language, leading with
the answer itself. If it is a technical problem, give concrete steps. No preamble, no sign-off, no
markdown headers, no closing offer or follow-up question. Keep it to the length the question needs.
Say plainly when you do not know rather than guessing. Deliver the scope asked for — do not widen it.`;

// Read once at boot, then re-read whenever the note changes, so editing the prompt in Obsidian takes
// effect on the next question instead of requiring a worker restart.
let _systemCache = { prompt: null, at: 0 };
function systemPrompt() {
  if (Date.now() - _systemCache.at > 15000) {
    _systemCache = { prompt: vault.loadSystemPrompt() || SYSTEM_FALLBACK, at: Date.now() };
  }
  return _systemCache.prompt;
}

// Blobs credentials. Fall back to the token the Netlify CLI already stored at login, so this runs
// with no setup on a machine where `netlify` is signed in — no personal access token to mint.
const SITE_ID_DEFAULT = '88265b1c-3380-4611-a1c0-28b4f688562a'; // iisupp
function cliToken() {
  const appData = process.env.APPDATA || path.join(os.homedir(), '.config');
  for (const p of [path.join(appData, 'netlify', 'Config', 'config.json'),
                   path.join(appData, 'netlify', 'config.json'),
                   path.join(os.homedir(), '.netlify', 'config.json')]) {
    try {
      const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
      const user = cfg.users ? Object.values(cfg.users)[0] : null;
      if (user && user.auth && user.auth.token) return user.auth.token;
    } catch { /* try the next location */ }
  }
  return null;
}
const siteID = process.env.NETLIFY_SITE_ID || SITE_ID_DEFAULT;
const token = process.env.NETLIFY_AUTH_TOKEN || cliToken();
if (!token) {
  console.error('[axis-brain-worker] No Netlify credentials found.');
  console.error('  Fix: run `netlify login`, or set NETLIFY_AUTH_TOKEN=<personal access token>.');
  process.exit(1);
}
const jobs = getStore({ name: JOBS, siteID, token, consistency: 'strong' });
const kbLive = getStore({ name: KB_LIVE, siteID, token, consistency: 'strong' });

// THE WHOLE REASON THE PLAN WENT UNUSED (measured 2026-08-11):
// Claude's credential precedence is ANTHROPIC_API_KEY → ANTHROPIC_AUTH_TOKEN → the claude.ai OAuth
// login. Ahmad has ANTHROPIC_API_KEY set as a *persistent User env var* on this machine, so every
// local `claude` call silently billed the metered API account instead of the Max plan he pays for
// — and kept doing so until that account ran dry. Proven both ways:
//   claude --print …                    → "connectors are disabled because ANTHROPIC_API_KEY … takes
//                                          precedence over your claude.ai login", no answer
//   env -u ANTHROPIC_API_KEY claude …   → answers normally, on the plan
// So the child env is scrubbed here. Do not "simplify" this away — it is the entire saving.
const PLAN_ENV = (() => {
  const e = { ...process.env };
  delete e.ANTHROPIC_API_KEY;
  delete e.ANTHROPIC_AUTH_TOKEN;   // same precedence trap, one rung down
  return e;
})();

// Run the local CLI on the Max plan.
//
// THE PROMPT GOES OVER STDIN, NOT AS AN ARGUMENT. On Windows `claude` is a .cmd shim, so spawn
// needs shell:true — and with shell:true Node CONCATENATES argv without escaping (it warns:
// "arguments are not escaped, only concatenated"). A question containing spaces, quotes or
// punctuation is therefore shredded by the shell: measured 2026-08-11, the model received the single
// word "brief" and replied "your message got cut off". Every Max-plan answer produced before this
// fix was generated from a mangled fragment. stdin has no quoting rules, so it cannot be mangled.
// The system prompt rides in the same stdin payload for the same reason.
// FLAGS, and why each one is here (measured 2026-08-12 on this machine, "reply OK" round trip):
//   bare `--print`                                    4355 ms
//   + --strict-mcp-config --no-session-persistence
//     --exclude-dynamic-system-prompt-sections        2609 ms   (~40% off every single answer)
// --strict-mcp-config with no --mcp-config means "no MCP servers at all": the connector handshake is
// pure startup cost here, since this call answers from the prompt, not from tools.
// NO FLAG MAY TAKE A PATH OR A QUOTED STRING. On Windows `claude` is a .cmd shim needing shell:true,
// and Node then concatenates argv unescaped — a path containing spaces (this repo lives under
// "ARIA — Real-Time AI Assistant") would be shredded exactly like the prompt was before it moved to
// stdin. Model ids and bare switches are safe because they contain neither spaces nor quotes.
const FAST_FLAGS = ['--strict-mcp-config', '--no-session-persistence', '--exclude-dynamic-system-prompt-sections'];

function askClaude(prompt, { model = null, system = null, timeoutMs = CLI_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    let out = '', err = '', settled = false;
    const args = ['--print', ...FAST_FLAGS];
    if (model) args.push('--model', model);            // safe: ids are [a-z0-9-] only
    const child = spawn(CLAUDE_BIN, args, { shell: process.platform === 'win32', env: PLAN_ENV });
    const timer = setTimeout(() => { if (!settled) { settled = true; try { child.kill(); } catch {} resolve({ error: 'timeout' }); } }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { if (!settled) { settled = true; clearTimeout(timer); resolve({ error: 'spawn: ' + e.message }); } });
    child.on('close', (code) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      const text = out.trim();
      if (code === 0 && text) resolve({ answer: text });
      else resolve({ error: err.trim().slice(0, 300) || `exit ${code}` });
    });
    try { child.stdin.write((system || systemPrompt()) + '\n\n' + prompt); child.stdin.end(); }
    catch (e) { if (!settled) { settled = true; clearTimeout(timer); resolve({ error: 'stdin: ' + e.message }); } }
  });
}

// ── The two brains, in order ─────────────────────────────────────────────────
// Ahmad, 2026-08-12: "Axis looks at both brains starting with obsidian."
//
//   1. Obsidian AXIS vault   ~5ms   $0, no model   ← brain #1, and the only one written to
//   2. Claude Max plan       ~2-17s $0 API credits ← brain #2 supplies context, the plan reasons
//
// The ARIA brain (Blobs KB, research agents) is already searched on the cloud side in
// axis-brain.cjs before a question is ever queued here, so by the time the worker sees a question,
// those tiers have declined. What the worker adds is the vault: first as an answer in its own right,
// and — when it cannot answer alone — as context that makes the plan's answer specific to Ahmad's
// operation rather than generic. Partial vault knowledge is still worth spending, and costs nothing.
// The recent conversation and the on-screen board, rendered for the model. The CLI runs with
// --no-session-persistence — every question is a fresh process — so continuity has to arrive IN the
// prompt. Before this, "remove it" reached the model as a two-word orphan and it rightly answered
// "this session starts fresh, I don't have the list you're pointing at" (2026-08-12) about rows
// AXIS itself had spoken thirty seconds earlier.
function conversationBlock(turns, board) {
  const parts = [];
  if (Array.isArray(turns) && turns.length > 1) {
    const lines = turns.slice(0, -1)             // the last turn IS the question; don't repeat it
      .map((m) => `${m.role === 'assistant' ? 'AXIS' : 'Ahmad'}: ${String(m.content || '').trim()}`)
      .filter((l) => l.length > 6);
    if (lines.length) parts.push('The conversation so far (AXIS is you):\n' + lines.join('\n'));
  }
  if (board) parts.push(String(board).trim());
  return parts.join('\n\n');
}

async function answerQuestion(query, { turns = [], board = '' } = {}) {
  const t0 = Date.now();

  // Brain #1, alone. A confident vault hit skips the model entirely: no tokens, no plan usage, and
  // an answer in single-digit milliseconds instead of seconds. But NEVER for a conversational turn
  // — a correction or an instruction answered by note-matching is how "show me where" became a
  // pasted feedback note. The vault still rides along as CONTEXT below either way.
  const direct = isConversational(query) ? null : vault.vaultTier(query);
  if (direct) {
    return { answer: direct.text, tier: 'vault', model: null, source: direct.source,
      ms: Date.now() - t0, learned: false };
  }

  // Brain #1 as context for brain #2.
  const context = vault.vaultContext(query);
  const convo = conversationBlock(turns, board);
  const route = classify(query, { contextChars: context.length + convo.length });

  const pieces = [];
  if (convo) pieces.push(convo);
  if (context) pieces.push(`Context from Ahmad's AXIS vault. Prefer it over general knowledge where they disagree, and say so if it is silent on the question.\n\n${context}`);
  const prompt = pieces.length
    ? `${pieces.join('\n\n---\n\n')}\n\n---\n\nAhmad asks: ${query}`
    : query;

  let tierName = route.tier;
  let escalatedFrom = null;
  let res = null;

  // Climb one rung at a time, and only on evidence — an empty, hedged, or clarifying reply. This is
  // what "no choice" means: the cheap model was tried and demonstrably could not answer.
  for (let hop = 0; hop < 3; hop++) {
    const tier = TIER_BY_NAME[tierName];
    const started = Date.now();
    // Each rung gets its own clock (see TIERS): the deep model being slower than 55s is expected,
    // not a failure — capping opus at haiku's budget made every escalated answer end in silence.
    res = await askClaude(prompt, { model: tier.model, timeoutMs: tier.timeoutMs || CLI_TIMEOUT_MS });
    const ms = Date.now() - started;
    recordUse(tierName, tier.model, { escalatedFrom, ms });

    if (res.error) {
      const up = escalate(tierName);
      if (!up) return { error: res.error };
      console.log(`[axis-brain-worker] ${tierName} errored (${String(res.error).slice(0, 60)}) → ${up.name}`);
      escalatedFrom = tierName; tierName = up.name; continue;
    }
    const usable = answerUsable(res.answer);
    if (usable.ok) break;
    const up = escalate(tierName);
    if (!up) break;                       // top of the ladder — ship what we have
    console.log(`[axis-brain-worker] ${tierName} ${usable.reason} → escalating to ${up.name}`);
    escalatedFrom = tierName; tierName = up.name;
  }

  if (!res || res.error || !res.answer) return { error: (res && res.error) || 'no answer' };

  // "Future info and learning will be saved in obsidian axis vault (brain)."
  // The vault write is what makes the next identical question free — brain #1 will answer it.
  // Confidence tracks the tier that produced the answer, not whether it escalated. The quality gate
  // upstream checks the *form* of an answer — long enough, not a hedge, not a question — and cannot
  // check whether it is true. Measured 2026-08-12: asked what MERX stands for, the fast tier
  // produced a confident, plausible, wrong expansion that passed every gate. Banking that as "high"
  // would put a hallucination into the brain with the same standing as RULES.md. So a fast-tier
  // answer is banked as low, and AXIS says so out loud when it leans on one (see 13_Learned).
  const CONFIDENCE = { fast: 'low', standard: 'medium', deep: 'high' };
  // Same gate as bank(): a clarifying question, hedge, or reply about the prompt is not knowledge.
  // Measured 2026-08-12: "Which list do you mean — …?" was written to 13_Learned as a fact because
  // this call had no gate while bank() did. The vault is the *durable* brain — it needs the gate more.
  const w = worthLearning(query, res.answer)
    ? vault.learn({
        question: query, answer: stripTrailingOffer(res.answer),
        source: 'claude-max', model: TIER_BY_NAME[tierName].model,
        confidence: CONFIDENCE[tierName] || 'medium',
      })
    : { written: false, reason: 'not-knowledge' };

  return { answer: res.answer, tier: tierName, model: TIER_BY_NAME[tierName].model,
    escalatedFrom, ms: Date.now() - t0, vaultContext: context.length, learned: w.written,
    learnedFile: w.rel || null, learnSkipped: w.written ? null : w.reason };
}

// Same as askClaude but with extra CLI flags — used by self.fix, which needs edit permission.
// The prompt still rides stdin: with shell:true on Windows, argv is concatenated unescaped and any
// real prompt is shredded before the model sees it.
// `model` is REQUIRED in practice even though it defaults to null: passing no --model meant every
// Claude Code run (self.fix, machine.run) and every Cowork question inherited whatever the CLI
// session defaulted to. Ahmad, 2026-08-12: "ensure claude code uses opus 5 to execute unless I
// specify to use fable 5 or any other model." Callers resolve it with modelForRequest().
//
// Deliberately does NOT take FAST_FLAGS. Those strip MCP servers and dynamic system-prompt sections,
// which is right for a prompt-only answer and wrong here: cowork.ask and self.fix are supposed to
// operate in the repo under CLAUDE.md. Only --model is added, because a model id is [a-z0-9-] and so
// survives the Windows shell:true argv concatenation that shreds anything with a space in it.
function askClaudeIn(prompt, extraArgs = [], timeoutMs = CLI_TIMEOUT_MS, model = null) {
  return new Promise((resolve) => {
    let out = '', err = '', done = false;
    const args = ['--print', ...(model ? ['--model', model] : []), ...extraArgs];
    const c = spawn(CLAUDE_BIN, args, { cwd: REPO, shell: process.platform === 'win32', env: PLAN_ENV });
    const t = setTimeout(() => { if (!done) { done = true; try { c.kill(); } catch {} resolve({ error: 'timeout' }); } }, timeoutMs);
    c.stdout.on('data', (d) => { out += d; });
    c.stderr.on('data', (d) => { err += d; });
    c.on('error', (e) => { if (!done) { done = true; clearTimeout(t); resolve({ error: e.message }); } });
    c.on('close', (code) => { if (!done) { done = true; clearTimeout(t);
      resolve(code === 0 && out.trim() ? { answer: out.trim() } : { error: (err || out).slice(-400) || ('exit ' + code) }); } });
    try { c.stdin.write(prompt); c.stdin.end(); } catch (e) { }
  });
}

// Same gate the cloud side uses — a greeting or a non-answer must never become "knowledge".
const SLOP = /^(hi|hello|hey|sure|ok|okay|got it|heard you|thanks|understood)\b/i;
const NON_ANSWER = /\b(i (don'?t|do not) know|i'?m not sure|cannot help|can'?t help|unable to|as an ai)\b/i;
// A long, useful answer often ends with a friendly offer ("Want me to draft the rate card?").
// That is conversational cruft, not knowledge — strip it rather than discard the whole answer.
// Measured 2026-08-11: a 1965-character Max-plan answer was thrown away by a bare /\?$/ test
// purely because of its closing sentence.
const OFFER = /(?:^|[.!?]\s+)((?:want me to|shall i|should i|would you like|do you want|need me to|let me know if)[^.!?]*\?)\s*$/i;
function stripTrailingOffer(text) {
  return String(text || '').trim().replace(OFFER, (m, q, off) => m.slice(0, m.length - q.length)).trim();
}

// A reply ABOUT the prompt (truncated, empty, unclear) is never knowledge — and it must be caught
// BEFORE stripTrailingOffer() shaves off its closing question and makes it look substantive.
// Measured 2026-08-11: mangled prompts produced "your message got cut off … all I received was
// 'are'", which sailed through the gate and was banked as a real answer five times.
const BROKEN_PROMPT = /\b(got cut off|all i received|all that came through|could you (share|clarify|resend)|what would you like me to|your message (is|was|got)|didn'?t (receive|get) )\b/i;

// A question about LIVE STATE is never knowledge — its answer is stale in minutes and recalls at
// 55%+ forever. Measured 2026-08-12: "tell me the most prioritized item" was banked promoted:true
// and would have answered every future asking of it with that afternoon's board. Deixis the same:
// "tell me more about that" was banked as the timeless answer "I don't have anything to point back
// to". Mirrors the gate in axis-brain-queue.mjs's learn action, because bank() writes to Blobs
// DIRECTLY and never passes through it. "status" is listed and "update" is not, deliberately —
// "give me status update" is state, "how do I fix a stuck windows update" is knowledge.
const STATE_QUERY = /\b(?:priorit\w*|queued?|board|overdue|status|working on|to.?dos?|follow.?ups?|due today|most (?:urgent|overdue|important)|in (?:the )?queue)\b/i;
const DEIXIS = /^\s*(?:tell me more|more about|go on|continue|what about (?:it|that|them)|about (?:it|that))\b|\b(?:you (?:already|just) said|said that|talking about|not what i)\b/i;

const worthLearning = (q, a) =>
  String(q).trim().length >= 12 && !SLOP.test(String(q).trim()) &&
  !STATE_QUERY.test(String(q)) && !DEIXIS.test(String(q)) &&
  stripTrailingOffer(a).length >= 60 && !SLOP.test(stripTrailingOffer(a)) &&
  !NON_ANSWER.test(String(a)) && !BROKEN_PROMPT.test(String(a)) && !/\?\s*$/.test(stripTrailingOffer(a));

// Banking requires TWO writes and both matter:
//   1. the learn-* blob (the body), and
//   2. an entry in kb-index.json — aria-kb-query discovers learned bits ONLY through that manifest
//      (loadLiveChunks reads kb-index.json → entries[] → store.get(e.key)).
// Writing only the blob banks an answer the brain can never find. Measured 2026-08-11: the first
// Max-plan answer stored fine and still missed on the re-ask for exactly this reason.
async function bank(query, answer) {
  if (!worthLearning(query, answer)) return false;
  const topic = String(query).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
  const key = 'learn-' + topic.replace(/\s+/g, '-').slice(0, 60) + '-' + Date.now().toString(36);
  const now = new Date().toISOString();
  try {
    await kbLive.setJSON(key, {
      topic, question: String(query).slice(0, 500), body: stripTrailingOffer(answer).slice(0, 3500),
      agent: 'axis-brain-worker', source: 'claude-max-plan', verified_answer: true,
      promoted: true, promoted_at: now, created_at: now,
    });
    let idx = null;
    try { idx = await kbLive.get('kb-index.json', { type: 'json' }); } catch { idx = null; }
    if (!idx || !Array.isArray(idx.entries)) idx = { entries: [] };
    idx.entries = idx.entries.filter((e) => e && e.key !== key);
    idx.entries.push({ key, topic, promoted: true, t: Date.now() });
    if (idx.entries.length > 5000) idx.entries = idx.entries.slice(-5000);
    await kbLive.setJSON('kb-index.json', idx);
    return true;
  } catch (e) { console.warn('[axis-brain-worker] bank failed:', e.message); return false; }
}

async function beat() {
  try { await jobs.setJSON(HEARTBEAT_KEY, { t: Date.now(), host: process.env.COMPUTERNAME || 'local' }); }
  catch (e) { console.warn('[axis-brain-worker] heartbeat failed:', e.message); }
}


// ── Tasks: the half that DOES things ─────────────────────────────────────────
// Ahmad, 2026-08-11: manage YouTube by voice, and "if I tell it to fix any issues… use claude code
// to fix itself and tell me once its done."
//
// Every task is a NAMED kind mapped to a fixed command below — never a shell string from the queue.
// That is the whole safety model: the cloud side can ask for "video.make", it cannot ask for
// "rm -rf". Anything with an external effect (video.upload publishes) requires confirmed:true,
// which AXIS only sets after Ahmad says yes out loud.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(cmd, cmdArgs, timeoutMs = 900000) {
  return new Promise((resolve) => {
    let out = '', err = '', done = false;
    const c = spawn(cmd, cmdArgs, { cwd: REPO, shell: process.platform === 'win32', env: PLAN_ENV });
    const t = setTimeout(() => { if (!done) { done = true; try { c.kill(); } catch {} resolve({ error: 'timeout' }); } }, timeoutMs);
    c.stdout.on('data', (d) => { out += d; });
    c.stderr.on('data', (d) => { err += d; });
    c.on('error', (e) => { if (!done) { done = true; clearTimeout(t); resolve({ error: e.message }); } });
    c.on('close', (code) => { if (!done) { done = true; clearTimeout(t); resolve(code === 0 ? { out } : { error: (err || out).slice(-600) }); } });
  });
}

async function progress(msg, kind = 'info') {
  try { await jobs.setJSON(`progress/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    { msg: String(msg).slice(0, 300), kind, t: Date.now() }); } catch {}
  console.log(`[axis-brain-worker] ${msg}`);
}

// ── Fleet management ─────────────────────────────────────────────────────────
// Ahmad, 2026-08-12: "have all the agents report to axis and give axis full access to manage them."
// The REPORTING half already exists — the watchdog and queue steward run in this process and write
// their digests into the vault hourly. This is the MANAGING half: run, pause, resume — against a
// FIXED roster mapping spoken names to the exact Windows scheduled-task names the watchdog observes
// (scripts/lib/job-registry.mjs). The roster is the safety model: the queue can name an agent, it
// can never name a command, and an unknown name gets the roster read back instead of a guess.
const FLEET_AGENTS = {
  'kb pull': 'ARIA KB Pull',
  'business development': 'IIS Business Development Agent Morning',
  'ceo digest': 'IIS CEO Action Digest Hourly',
  'interaction avoidance': 'IIS Interaction Avoidance Agent Hourly',
  'opportunity engine': 'IIS Opportunity Engine Hourly',
  'prep packets': 'IIS Opportunity Prep Packets Hourly',
  'quality gate': 'IIS Opportunity Quality Gate Hourly',
  'workspace cleanup': 'IIS Workspace Cleanup Agent Daily',
};
function resolveFleetAgent(text) {
  const t = String(text || '').toLowerCase();
  for (const [key, task] of Object.entries(FLEET_AGENTS))
    if (key.split(' ').every((w) => t.includes(w))) return task;
  return null;
}
// powershell.exe is a real executable, not a .cmd shim, so no shell:true — which matters because
// this repo's path has spaces and an em dash (same reasoning as job-watchdog.mjs). The task name is
// interpolated from OUR roster above, never from the queue, so it is letters and spaces by
// construction.
function psScheduledTask(verb, taskName) {
  return new Promise((resolve) => {
    let out = '', err = '', done = false;
    const c = spawn('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', `${verb} -TaskName "${taskName}"`],
      { windowsHide: true });
    const t = setTimeout(() => { if (!done) { done = true; try { c.kill(); } catch {} resolve({ error: 'timeout' }); } }, 60000);
    c.stdout.on('data', (d) => { out += d; });
    c.stderr.on('data', (d) => { err += d; });
    c.on('error', (e) => { if (!done) { done = true; clearTimeout(t); resolve({ error: e.message }); } });
    c.on('close', (code) => { if (!done) { done = true; clearTimeout(t);
      resolve(code === 0 ? { out: out.trim() } : { error: (err || out).trim().slice(-300) || ('exit ' + code) }); } });
  });
}

async function runTask(task) {
  const { kind, arg, confirmed } = task;
  // "Work with Claude Cowork to remove the three items you just mentioned" — the antecedent is in
  // the conversation, not the sentence. Every model-backed task gets the same block the Q&A path
  // gets, so a spoken follow-up lands as a follow-up instead of an orphan.
  const convo = conversationBlock(task.turns, task.board);
  const convoBlock = convo ? `\n\n${convo}\n` : '';
  await progress(`starting ${kind}${arg ? ': ' + arg.slice(0, 60) : ''}`, 'start');

  if (kind === 'video.make' || kind === 'video.short') {
    const a = ['scripts/yt-factory.mjs', '--count', '1'];
    if (kind === 'video.short') a.push('--short');
    if (arg) a.push('--topic', arg);
    const r = await run('node', a);
    if (r.error) return { error: 'video build failed: ' + r.error.slice(-200) };
    const line = (String(r.out).split(String.fromCharCode(10)).find((l) => l.includes('staged')) || '').trim();
    await progress(`built a ${kind === 'video.short' ? 'short' : 'video'}${arg ? ' on ' + arg : ''}`, 'done');
    return { answer: `Built. ${line || 'It is staged for your approval.'} Say "upload" when you want it live.` };
  }

  if (kind === 'video.status') {
    const r = await run('node', ['scripts/yt-upload.mjs', '--list'], 120000);
    if (r.error) return { error: r.error.slice(-200) };
    const staged = (r.out.match(/\[(awaiting|APPROVED)/g) || []).length;
    const pubd = (r.out.match(/published today: (\d+)/) || [])[1] || '0';
    return { answer: `${staged} staged, ${pubd} published today. Cap is six a day.` };
  }

  if (kind === 'video.upload') {
    // External send. No confirmation, no upload — this is the hard stop.
    if (!confirmed) return { answer: 'That publishes to the channel. Say confirm and I will do it.' };
    const dirs = fs.existsSync(path.join(REPO, 'content/youtube/staged'))
      ? fs.readdirSync(path.join(REPO, 'content/youtube/staged')) : [];
    for (const d of dirs) await run('node', ['scripts/yt-upload.mjs', '--approve', d], 60000);
    const r = await run('node', ['scripts/yt-upload.mjs', '--all'], 1800000);
    if (r.error) return { error: 'upload failed: ' + r.error.slice(-200) };
    const urls = (r.out.match(/https:\/\/youtu\.be\/\S+/g) || []);
    await progress(`uploaded ${urls.length} video(s)`, 'done');
    return { answer: urls.length ? `${urls.length} uploaded, private for your review. ${urls[0]}` : 'Nothing was ready to upload.' };
  }

  if (kind === 'fleet.status') {
    // "All the agents report to AXIS." The watchdog already gathers success evidence for every
    // registered job hourly; this makes it pullable on demand, spoken. Read-only. NOT run through
    // run(): the watchdog exits non-zero precisely when an agent is broken, and a broken agent is
    // the answer here, never an error.
    const r = await new Promise((resolve) => {
      let out = '', done = false;
      const c = spawn(process.execPath, [path.join(REPO, 'scripts', 'job-watchdog.mjs'), '--json'],
        { cwd: REPO, env: PLAN_ENV, windowsHide: true });
      const t = setTimeout(() => { if (!done) { done = true; try { c.kill(); } catch {} resolve(null); } }, 60000);
      c.stdout.on('data', (d) => { out += d; });
      c.on('error', () => { if (!done) { done = true; clearTimeout(t); resolve(null); } });
      c.on('close', () => { if (!done) { done = true; clearTimeout(t); resolve(out); } });
    });
    if (!r) return { error: 'watchdog did not run' };
    try {
      const rep = JSON.parse(String(r));
      // spokenSummary from the registry is already voice-shaped; the bad list adds the names.
      const names = (rep.bad || []).map((b) => b.label).join(', ');
      return { answer: String(rep.spoken || 'No report.') + (names ? ` Affected: ${names}.` : '') };
    } catch { return { error: 'watchdog output did not parse' }; }
  }

  if (kind === 'fleet.run' || kind === 'fleet.pause' || kind === 'fleet.resume') {
    // "Give AXIS full access to manage them" — within the same safety model as everything else:
    // a NAMED verb against a NAMED agent from the fixed roster below, never a shell string from the
    // queue, and always behind the spoken confirm the console already collected. Pausing stops an
    // agent producing; that is the backpressure lever the queue-steward rules call for.
    if (confirmed !== true) return { error: 'that needs confirming out loud first' };
    const agent = resolveFleetAgent(arg);
    if (!agent) return { answer: 'Which agent? I manage: ' + Object.keys(FLEET_AGENTS).join(', ') + '.' };
    const VERB = { 'fleet.run': 'Start-ScheduledTask', 'fleet.pause': 'Disable-ScheduledTask', 'fleet.resume': 'Enable-ScheduledTask' };
    const r = await psScheduledTask(VERB[kind], agent);
    if (r.error) return { error: `${kind} failed on "${agent}": ` + String(r.error).slice(-200) };
    const did = kind === 'fleet.run' ? 'is running now' : kind === 'fleet.pause' ? 'is paused — say resume when you want it back' : 'is back on its schedule';
    await progress(`${agent} ${did}`, 'done');
    return { answer: `${agent} ${did}.` };
  }

  if (kind === 'self.fix') {
    // AXIS repairing itself. Claude Code runs IN the repo with edit permission, scoped by the
    // prompt to the console/worker surface and told to verify with the existing suite.
    if (!arg) return { error: 'nothing to fix' };
    await progress('asking Claude Code to fix: ' + arg.slice(0, 80), 'start');
    const prompt = `You are fixing the AXIS command centre in this repo, reported by Ahmad:

"${arg}"

Rules: change the minimum that fixes it. Do not remove existing features. Touch only the AXIS
surface (assets/axis-*.js, assets/axis-tokens.css, axis.html, aperture-learning.html,
netlify/functions/axis-*, scripts/axis-*). axis.html and aperture-learning.html must stay identical.
When done run: for t in tests/axis-*.test.mjs; do node "$t"; done — they must all pass.
Reply with ONE short sentence saying what you changed, or why no change was needed.`;
    const pick = modelForRequest(arg, 'execute');
    await progress('Claude Code on ' + pick.model + ' (' + pick.why + ')', 'info');
    const r = await askClaudeIn(prompt, ['--permission-mode', 'acceptEdits'], 1500000, pick.model);
    if (r.error) return { error: 'self-fix failed: ' + String(r.error).slice(-200) };
    // "tell me once its done" — a self-fix finishing is exactly the kind of thing worth speaking up
    // about unprompted, so it goes out on the progress channel as well as answering the caller.
    const said = String(r.answer || '').trim().slice(-600);
    await progress('Fixed it: ' + said.slice(0, 160), 'done');
    return { answer: said };
  }

  if (kind === 'cowork.ask') {
    // "Give it access to speak with claude cowork." Claude Cowork is the Claude CLI operating in
    // this repo under CLAUDE.md. This is the READ side: ask it something, get an answer back. No
    // edit permission, so a question can never quietly become a change.
    if (!arg) return { error: 'nothing to ask' };
    // Cowork picks the model that fits the request, never below `standard` - a planning
    // conversation answered on the fast tier is exactly the quality loss to avoid.
    const coworkPick = modelForRequest(arg, 'cowork');
    await progress('asking Claude Cowork on ' + coworkPick.model + ' (' + coworkPick.why + ')', 'start');
    const r = await askClaudeIn(
      `You are Claude Cowork for IIS/ARIA, following CLAUDE.md in this repo. Ahmad asked, by voice:

"${arg}"
${convoBlock}
Answer from what is actually in the repo. If you do not know, say so plainly rather than guessing.
Reply in at most four sentences — this is going to be read aloud.`,
      [], 600000, coworkPick.model);
    if (r.error) return { error: 'cowork failed: ' + String(r.error).slice(-200) };
    await progress('Cowork answered', 'done');
    return { answer: String(r.answer || '').trim().slice(-900) };
  }

  if (kind === 'cowork.plan') {
    // Ahmad, 2026-08-12: "claude cowork to be use by axis for planning… I want Axis basically the
    // visual and verbal extension of claude code and cowork."
    //
    // Same engine as cowork.ask and the same read-only guarantee (no --permission-mode, so no edits),
    // but a different job: cowork.ask answers a question, this one PLANS WITH him. So the prompt asks
    // for a short plan and one open question rather than a four-sentence answer, and it is told to
    // ground the plan in the repo and the standing rules instead of proposing work that breaks them.
    //
    // Spoken-length discipline matters more here than anywhere: a plan read aloud end-to-end is
    // unusable, so it comes back as a few steps and stops. splitForTurns() on the console side holds
    // the remainder and releases it on "go on".
    if (!arg) return { error: 'nothing to plan' };
    const planPick = modelForRequest(arg, 'cowork');
    await progress('planning with Claude Cowork on ' + planPick.model + ' (' + planPick.why + ')', 'start');
    const r = await askClaudeIn(
      `You are Claude Cowork for IIS/ARIA, following CLAUDE.md in this repo. You are planning WITH
Ahmad, out loud, not writing him a document. He said, by voice:

"${arg}"
${convoBlock}
Ground the plan in what is actually in this repo and in the standing rules (spend cap, no fake proof,
preview-before-push, ARIA and Aperture never break). If the request conflicts with a rule, say so in
one line and plan the version that does not.

Give at most three concrete next steps, shortest-path first and revenue-first where that applies.
Then ask the ONE question you actually need answered to proceed. No preamble, no headers, no recap.
This is being read aloud, so keep it under about six short sentences.`,
      [], 900000, planPick.model);
    if (r.error) return { error: 'planning failed: ' + String(r.error).slice(-200) };
    await progress('Cowork planned it', 'done');
    return { answer: String(r.answer || '').trim().slice(-1200) };
  }

  if (kind === 'code.build') {
    // "claude code to execute any code." self.fix repairs what AXIS got wrong; this builds what
    // Ahmad asked for. Both run Claude Code in the repo with edit permission, and both run on the
    // execution floor (opus 5 unless he names a model) because a bad edit costs a debugging session
    // — execution deliberately does NOT ride the cost ladder.
    if (!arg) return { error: 'nothing to build' };
    const buildPick = modelForRequest(arg, 'execute');
    await progress('Claude Code building on ' + buildPick.model + ': ' + arg.slice(0, 70), 'start');
    const r = await askClaudeIn(
      `You are Claude Code working in the IIS/ARIA repo, following CLAUDE.md. Ahmad asked, by voice:

"${arg}"
${convoBlock}
Build the smallest thing that satisfies it. Follow the standing rules: do not publish or deploy, do
not send anything externally, do not spend money, do not touch credentials, and never break ARIA,
Aperture or Sentinel. Do not change look, theme or copy on iisupp.net without a preview.

Add or update a test that would fail without your change, then run the relevant suites and make them
pass. If the request is ambiguous enough that two readings give materially different code, stop and
say which two rather than guessing.

Reply with ONE short sentence saying what you built and which tests cover it.`,
      ['--permission-mode', 'acceptEdits'], 1500000, buildPick.model);
    if (r.error) return { error: 'build failed: ' + String(r.error).slice(-200) };
    const said = String(r.answer || '').trim().slice(-600);
    await progress('Built it: ' + said.slice(0, 160), 'done');
    return { answer: said };
  }

  if (kind === 'machine.run') {
    // "Take control of my machine as needed to perform any tasks required based on my request."
    //
    // Broad capability, but a spoken sentence is a weak gate for something that cannot be undone.
    // Anything irreversible or outward-facing stops here and comes back to Ahmad as an attention
    // event instead of being done on a voice command that a room full of noise could have produced.
    // Everything else runs through Claude Code in the repo with edit permission.
    if (!arg) return { error: 'nothing to run' };
    if (confirmed !== true) return { error: 'that needs confirming out loud first' };
    const IRREVERSIBLE = /\b(delete|rm\s+-rf|drop\s+(?:table|database)|wipe|format|uninstall|publish|deploy|go\s+live|push\s+to\s+prod|pay|purchase|buy|invoice|charge|refund|send\s+(?:the\s+)?(?:email|invoice|quote)|register|sign\s*up|create\s+(?:an\s+)?account|api\s*key|password|credential|secret|token)\b/i;
    const hit = arg.match(IRREVERSIBLE);
    if (hit) {
      await progress(`I stopped short of "${hit[0]}" — that one needs you to do it directly. Nothing was changed.`, 'attention');
      return { answer: `That involves ${hit[0]}, which I will not do off a voice command. Nothing was changed — tell me to do it in Claude Code and I will.` };
    }
    const runPick = modelForRequest(arg, 'execute');
    await progress('running on ' + runPick.model + ': ' + arg.slice(0, 60), 'start');
    const r = await askClaudeIn(
      `Ahmad asked, by voice, for this to be done on his machine:

"${arg}"
${convoBlock}
You are in the IIS/ARIA repo and must follow CLAUDE.md. Do the smallest thing that satisfies the
request. Do NOT delete anything, publish, deploy, send anything externally, spend money, or touch
credentials — if the request needs any of those, stop and say so instead of doing it.
Reply with ONE short sentence describing what you did, or why you did not.`,
      ['--permission-mode', 'acceptEdits'], 1500000, runPick.model);
    if (r.error) return { error: 'machine task failed: ' + String(r.error).slice(-200) };
    await progress('done: ' + arg.slice(0, 60), 'done');
    return { answer: String(r.answer || '').trim().slice(-600) };
  }

  return { error: 'unknown task kind: ' + kind };
}

async function drainTasks() {
  let list;
  try { list = await jobs.list({ prefix: 'task/' }); } catch { return; }
  for (const b of (list && list.blobs) || []) {
    let task; try { task = await jobs.get(b.key, { type: 'json' }); } catch { continue; }
    if (!task) { try { await jobs.delete(b.key); } catch {} continue; }
    try { await jobs.delete(b.key); } catch {}
    const res = await runTask(task);
    try { await jobs.setJSON(`done/${task.id}`, { ...res, t: Date.now() }); } catch {}
    if (res.error) await progress('failed: ' + String(res.error).slice(0, 120), 'error');
  }
}

async function drain() {
  let list;
  try { list = await jobs.list({ prefix: 'pending/' }); } catch { return; }
  for (const b of (list && list.blobs) || []) {
    let job;
    try { job = await jobs.get(b.key, { type: 'json' }); } catch { continue; }
    if (!job || !job.query) { try { await jobs.delete(b.key); } catch {} continue; }
    // The console now polls for ~180s (axisCollect), so a job is only stale past that. The old
    // 20s cutoff was the "One moment." dead-end, measured 2026-08-12 midnight: one slow answer
    // jammed this single-threaded loop, every question behind it aged past 20s, and each was
    // dropped IN SILENCE — five asks in a row answered by an ack that nothing ever replaced.
    // Stale is still dropped (no plan tokens for an answer nobody is waiting for), but a done/
    // record now says so, so a console still polling reports it instead of hanging forever.
    if (Date.now() - (job.t || 0) > 150000) {
      try { await jobs.setJSON(`done/${job.id}`, { error: 'stale: the worker was busy past the console wait — ask again', t: Date.now() }); } catch {}
      try { await jobs.delete(b.key); } catch {}
      continue;
    }

    console.log(`[axis-brain-worker] ${job.id} → ${String(job.query).slice(0, 70)}`);
    const res = await answerQuestion(job.query, { turns: job.turns, board: job.board });
    try { await jobs.setJSON(`done/${job.id}`, { answer: res.answer, error: res.error, t: Date.now() }); } catch {}
    try { await jobs.delete(b.key); } catch {}
    if (res.answer) {
      // A vault answer never touches the plan, so it is never re-banked into Blobs either — it is
      // already in the brain that produced it.
      const banked = res.tier === 'vault' ? false : await bank(job.query, res.answer);
      const how = res.tier === 'vault'
        ? `from the vault (${res.source.replace('axis-vault:', '')}) in ${res.ms}ms · no model`
        : `on the Max plan · ${res.model}${res.escalatedFrom ? ` (escalated from ${res.escalatedFrom})` : ''} · ${res.ms}ms`;
      const saved = [res.learned ? 'vault' : null, banked ? 'ARIA brain' : null].filter(Boolean).join(' + ');
      console.log(`[axis-brain-worker] answered ${how}${saved ? ` · saved to ${saved}` : ''}`);
    } else {
      console.warn('[axis-brain-worker] failed:', res.error);
    }
  }
}

// Old answers are only useful for the few seconds the console waits; sweep so the store can't grow.
async function sweep() {
  try {
    const list = await jobs.list({ prefix: 'done/' });
    for (const b of (list && list.blobs) || []) {
      const d = await jobs.get(b.key, { type: 'json' }).catch(() => null);
      if (!d || Date.now() - (d.t || 0) > 300000) { try { await jobs.delete(b.key); } catch {} }
    }
  } catch {}
}

console.log('[axis-brain-worker] online — answering AXIS on the Claude Max plan ($0 API credits).');
{
  const v = vault.vaultStats();
  console.log(v.available
    ? `[axis-brain-worker] brain #1: Obsidian vault, ${v.notes} notes at ${v.root}`
    : `[axis-brain-worker] brain #1: NO VAULT at ${v.root} — falling back to the plan for everything.`);
  console.log(`[axis-brain-worker] system prompt: ${vault.loadSystemPrompt() ? 'vault (00_Index/AXIS-SYSTEM.md)' : 'built-in fallback'}`);
}
// Usage by tier, so "the plan ran out again" is answerable with numbers rather than a guess.
setInterval(() => {
  const u = usageReport();
  if (u.total) console.log('[axis-brain-worker] model use today: '
    + u.rows.map(r => `${r.tier}×${r.calls}${r.escalations ? ` (${r.escalations} esc)` : ''} avg ${r.avgMs}ms`).join(' · '));
}, 600000);
await beat();
setInterval(beat, HEARTBEAT_MS);
setInterval(sweep, 120000);

// Queue steward. Runs here rather than as its own scheduled task because it is read-only, costs
// milliseconds, and needs to be in the same process that answers Ahmad's questions — the whole
// point is that "what is blocked?" is answerable from the vault instantly, with no model call.
// Hourly is plenty: an approval queue does not change in seconds, and the failure it watches for
// took two months to matter.
async function stewardTick() {
  try {
    const { steward, spokenSummary } = await import('./lib/axis-queue-steward.mjs');
    const p = path.join(REPO, 'senior-director-state', 'autonomy', 'approval-inbox.json');
    let items = [];
    try {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      items = Array.isArray(j) ? j : (j.items || j.approvals || []);
    } catch { return; }                       // no inbox yet is not a problem to report
    const logs = {};
    for (const [name, rel] of [['ARIA KB pull', 'aria_brain_pack/pull.log'],
                               ['AXIS brain worker', 'logs/axis-brain-worker.log']]) {
      try { logs[name] = fs.readFileSync(path.join(REPO, rel), 'utf8').slice(-60000); } catch {}
    }
    const rep = steward({ items, logs });
    // Into brain #1, so the answer is local and free the moment Ahmad asks.
    vault.learn({
      question: 'what is blocked, what is jammed, and what is failing quietly',
      answer: spokenSummary(rep) + '\n\n'
        + `${rep.collapsedFrom} open approvals are really ${rep.collapsedTo} decisions. `
        + `Oldest ${rep.oldestDays} days, median ${rep.medianDays}. `
        + `${rep.parkable} are 45+ days old.\n\n`
        + rep.jammed.map((j) => `JAMMED ${j.category}: ${j.advice}`).join('\n')
        + (rep.failures.length ? '\n\n' + rep.failures.map((f) =>
            `FAILING ${f.source}: ${f.streakDays} days running, ${f.distinctDays} failing days since ${f.earliest}.`).join('\n') : ''),
      source: 'axis-queue-steward', confidence: 'high',
    });
    if (rep.jammed.length || rep.failures.length) {
      console.log('[axis-brain-worker] steward: ' + spokenSummary(rep));
    }
  } catch (e) { console.warn('[axis-brain-worker] steward failed:', e.message); }
}
await stewardTick();
setInterval(stewardTick, 3600000);

// Job watchdog. Same cadence and same reasoning as the steward: read-only, milliseconds, and the
// answer belongs in the vault so "is anything broken?" is local and free. Spawned as a child rather
// than imported because it shells out to PowerShell for Windows task exit codes and exits non-zero
// on a real failure — neither of which belongs inside the worker's own process.
function watchdogTick() {
  try {
    const c = spawn(process.execPath, [path.join(REPO, 'scripts', 'job-watchdog.mjs'), '--quiet'],
      { cwd: REPO, env: PLAN_ENV });
    let out = '';
    c.stdout.on('data', (d) => { out += d; });
    c.on('error', () => {});
    c.on('close', () => {
      const line = out.trim();
      // Only speak up when something is wrong. A healthy fleet saying "all healthy" every hour is
      // how people learn to stop reading the log.
      if (line && !/healthy/i.test(line)) console.log('[axis-brain-worker] watchdog: ' + line);
    });
  } catch (e) { console.warn('[axis-brain-worker] watchdog failed:', e.message); }
}
watchdogTick();
setInterval(watchdogTick, 3600000);

for (;;) { await drain(); await drainTasks(); await new Promise((r) => setTimeout(r, POLL_MS)); }
