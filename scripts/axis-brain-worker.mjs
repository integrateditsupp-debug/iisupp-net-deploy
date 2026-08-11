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
import { getStore } from '@netlify/blobs';

const JOBS = 'axis-brain-jobs';
const KB_LIVE = 'aria-kb-live';
const HEARTBEAT_KEY = 'worker-heartbeat';
const HEARTBEAT_MS = 30000;     // the function treats >120s as offline
const POLL_MS = 1500;
const CLI_TIMEOUT_MS = 55000;
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';

const SYSTEM = `You are AXIS, the operations director for Integrated IT Support Inc.
Answer the question directly and practically, in plain language. If it is a technical
problem, give concrete steps. Be concise: no preamble, no sign-off, no markdown headers.
If you genuinely do not know, say so in one line rather than guessing.`;

const siteID = process.env.NETLIFY_SITE_ID;
const token = process.env.NETLIFY_AUTH_TOKEN;
if (!siteID || !token) {
  console.error('[axis-brain-worker] NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN are required.');
  console.error('  NETLIFY_SITE_ID=88265b1c-3380-4611-a1c0-28b4f688562a');
  console.error('  NETLIFY_AUTH_TOKEN=<personal access token from Netlify user settings>');
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

// Run the local CLI on the Max plan. --print gives a single non-interactive answer.
function askClaude(prompt) {
  return new Promise((resolve) => {
    let out = '', err = '', settled = false;
    const child = spawn(CLAUDE_BIN, ['--print', '--append-system-prompt', SYSTEM, prompt],
      { shell: process.platform === 'win32', env: PLAN_ENV });
    const timer = setTimeout(() => { if (!settled) { settled = true; try { child.kill(); } catch {} resolve({ error: 'timeout' }); } }, CLI_TIMEOUT_MS);
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
  });
}

// Same gate the cloud side uses — a greeting or a non-answer must never become "knowledge".
const SLOP = /^(hi|hello|hey|sure|ok|okay|got it|heard you|thanks|understood)\b/i;
const NON_ANSWER = /\b(i (don'?t|do not) know|i'?m not sure|cannot help|can'?t help|unable to|as an ai)\b/i;
const worthLearning = (q, a) =>
  String(q).trim().length >= 12 && !SLOP.test(String(q).trim()) &&
  String(a).trim().length >= 60 && !SLOP.test(String(a).trim()) &&
  !NON_ANSWER.test(String(a)) && !/\?\s*$/.test(String(a).trim());

async function bank(query, answer) {
  if (!worthLearning(query, answer)) return false;
  const topic = String(query).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
  const key = 'learn-' + topic.replace(/\s+/g, '-').slice(0, 60) + '-' + Date.now().toString(36);
  try {
    await kbLive.setJSON(key, {
      topic, question: String(query).slice(0, 500), body: String(answer).slice(0, 3500),
      agent: 'axis-brain-worker', source: 'claude-max-plan', verified_answer: true,
      promoted: true, promoted_at: new Date().toISOString(), created_at: new Date().toISOString(),
    });
    return true;
  } catch (e) { console.warn('[axis-brain-worker] bank failed:', e.message); return false; }
}

async function beat() {
  try { await jobs.setJSON(HEARTBEAT_KEY, { t: Date.now(), host: process.env.COMPUTERNAME || 'local' }); }
  catch (e) { console.warn('[axis-brain-worker] heartbeat failed:', e.message); }
}

async function drain() {
  let list;
  try { list = await jobs.list({ prefix: 'pending/' }); } catch { return; }
  for (const b of (list && list.blobs) || []) {
    let job;
    try { job = await jobs.get(b.key, { type: 'json' }); } catch { continue; }
    if (!job || !job.query) { try { await jobs.delete(b.key); } catch {} continue; }
    // The console gives up after ~6.5s; anything older has already escalated. Drop it rather than
    // spend plan tokens on an answer nobody is waiting for.
    if (Date.now() - (job.t || 0) > 20000) { try { await jobs.delete(b.key); } catch {} continue; }

    console.log(`[axis-brain-worker] ${job.id} → ${String(job.query).slice(0, 70)}`);
    const res = await askClaude(job.query);
    try { await jobs.setJSON(`done/${job.id}`, { ...res, t: Date.now() }); } catch {}
    try { await jobs.delete(b.key); } catch {}
    if (res.answer) {
      const learned = await bank(job.query, res.answer);
      console.log(`[axis-brain-worker] answered on the Max plan${learned ? ' · banked to ARIA brain' : ''}`);
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
await beat();
setInterval(beat, HEARTBEAT_MS);
setInterval(sweep, 120000);
for (;;) { await drain(); await new Promise((r) => setTimeout(r, POLL_MS)); }
