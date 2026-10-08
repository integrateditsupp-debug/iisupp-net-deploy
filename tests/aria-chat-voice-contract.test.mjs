#!/usr/bin/env node
// aria-chat-voice-contract.test.mjs — the response contract of netlify/functions/aria-chat.js after the
// 2026-10-08 run: VOICE MODE fields (speak / needs_input / listen / action) with safe defaults, the
// sessionId trust rule (no server context for short/constant ids), the platform line, the honest
// degraded branch (text + reply) and the internal token on the trace fan-out. api.anthropic.com is
// mocked — nothing leaves the process.
//   node tests/aria-chat-voice-contract.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
let pass = 0;
const ok = (label, cond) => { assert.ok(cond, label); pass++; console.log('  ✓ ' + label); };

process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
process.env.ARIA_MODEL = 'claude-test-model';
process.env.INTERNAL_WEBHOOK_SECRET = 'internal-secret-for-test-123';
process.env.URL = 'https://iisupp.net';

// ---- mocked network --------------------------------------------------------
const anthropicCalls = [];
const fanout = [];
let modelReply = null;      // object the "model" returns (JSON-serialised into content[0].text)
let modelMode = 'ok';       // 'ok' | 'throw'
const realFetch = global.fetch;
global.fetch = async (url, init) => {
  const u = String(url);
  if (u.startsWith('https://api.anthropic.com/v1/messages')) {
    if (modelMode === 'throw') throw new Error('fetch failed');
    const req = JSON.parse(init.body);
    anthropicCalls.push({ headers: init.headers, req });
    return new Response(JSON.stringify({ content: [{ text: typeof modelReply === 'string' ? modelReply : JSON.stringify(modelReply) }] }), { status: 200 });
  }
  if (u.includes('/.netlify/functions/aria-learn') || u.includes('/.netlify/functions/aria-trace')) {
    fanout.push({ url: u, headers: init.headers, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  throw new Error('unexpected network call in test: ' + u);
};

const chat = require_('../netlify/functions/aria-chat.js');
const context = require_('../netlify/functions/_conversation-context.js');

const call = async (body) => {
  const res = await chat.handler({ httpMethod: 'POST', headers: { host: 'iisupp.net', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.statusCode, json: JSON.parse(res.body) };
};
const settle = () => new Promise((r) => setTimeout(r, 20));

console.log('[aria-chat] pure voice helpers');
{
  const v = chat._voice;
  const spoken = v.defaultSpeak('**Frustrating, I get it.** Here is the fix:\n\n1. Open **Settings** → Network.\n2. Run `ipconfig /flushdns` — see https://support.example/x.\n3. Reboot.');
  ok('defaultSpeak strips markdown, lists, code and URLs', !/[*`#]|https?:/.test(spoken) && /Frustrating, I get it/.test(spoken));
  ok('defaultSpeak keeps at most two sentences', spoken.split(/(?<=[.!?])\s+/).length <= 2);
  const long = v.defaultSpeak(Array.from({ length: 120 }, (_, i) => 'word' + i).join(' ') + '.');
  ok('speak is capped at 55 words', long.split(/\s+/).length <= 56);
  ok('normalizeAction rejects unknown kinds and null-hints "none"', v.normalizeAction({ kind: 'reboot-the-moon', recipeHint: 'x' }).kind === 'none' && v.normalizeAction({ kind: 'none', recipeHint: 'x' }).recipeHint === null);
  ok('normalizeAction keeps sentinel-fix + hint', JSON.stringify(v.normalizeAction({ kind: 'sentinel-fix', recipeHint: 'flush-dns' })) === '{"kind":"sentinel-fix","recipeHint":"flush-dns"}');
  ok('SESSION_ID_RE: constant web id rejected, uuid accepted', !v.SESSION_ID_RE.test('web-2861') && !v.SESSION_ID_RE.test('2861') && v.SESSION_ID_RE.test('9f3c1d2e-4b5a-4c6d-8e7f-0a1b2c3d4e5f'));
}

console.log('[aria-chat] voice=true → full contract when the model answers it');
{
  modelReply = {
    text: 'Frustrating, I get it. Let\'s flush DNS.\n\n1. Open Terminal.\n2. Run the flush command.', emotion_detected: 'frustrated', tone_used: 'calming',
    takeNotes: null, resolved: false, escalate: false, escalation_reason: null, issue_category: 'network', suggestions: ['Did that help?'],
    speak: 'Totally get it, that is annoying. Let us flush your DNS cache first, then tell me what you see.',
    needs_input: true, listen: true, action: { kind: 'sentinel-fix', recipeHint: 'flush-dns' },
  };
  const r = await call({ voice: true, platform: 'Windows 11', device: { os: 'Windows 11', app: 'ARIA Sentinel' }, sessionId: '9f3c1d2e-4b5a-4c6d-8e7f-0a1b2c3d4e5f', messages: [{ role: 'user', content: 'my wifi keeps dropping' }] });
  ok('200 with legacy fields intact', r.status === 200 && r.json.text && r.json.emotion === 'frustrated' && r.json.tone === 'calming' && r.json.category === 'network' && Array.isArray(r.json.suggestions));
  ok('speak / needs_input / listen / action present', r.json.speak && r.json.needs_input === true && r.json.listen === true && r.json.action.kind === 'sentinel-fix' && r.json.action.recipeHint === 'flush-dns');
  ok('escalation_reason now surfaced (null here)', 'escalation_reason' in r.json);
  const sys = anthropicCalls.at(-1).req.system;
  ok('system prompt carries the VOICE MODE block', /# VOICE MODE/.test(sys) && /"speak"/.test(sys) && /sentinel-fix/.test(sys));
  ok('system prompt carries the platform line (deduped)', /User platform: Windows 11 · app: ARIA Sentinel/.test(sys) && (sys.match(/Windows 11/g) || []).length >= 1);
  await settle();
  const trace = fanout.find((f) => f.url.includes('aria-trace'));
  ok('trace fan-out targets process.env.URL and carries X-Internal-Token', trace && trace.url.startsWith('https://iisupp.net/') && trace.headers['x-internal-token'] === 'internal-secret-for-test-123');
}

console.log('[aria-chat] voice=true → safe defaults when the model omits the fields');
{
  modelReply = { text: 'Got it — that sounds like a cache issue. Open **Outlook** and press Ctrl+Shift+F. Then restart.', emotion_detected: 'calm', tone_used: 'warm', takeNotes: null, resolved: false, escalate: false, issue_category: 'email', suggestions: [] };
  const r = await call({ voice: true, sessionId: 'session-abcdefghijklmnop', messages: [{ role: 'user', content: 'outlook is slow' }] });
  ok('speak defaults to the first two sentences of text, markdown stripped', r.json.speak === 'Got it — that sounds like a cache issue. Open Outlook and press Ctrl+Shift+F.');
  ok('needs_input defaults to !resolved; listen mirrors needs_input', r.json.needs_input === true && r.json.listen === true);
  ok('action defaults to none', r.json.action.kind === 'none' && r.json.action.recipeHint === null);
  modelReply = { text: 'Great, glad that fixed it. Anything else?', emotion_detected: 'calm', tone_used: 'warm', takeNotes: null, resolved: true, escalate: false, issue_category: 'email', suggestions: [] };
  const r2 = await call({ voice: true, sessionId: 'session-abcdefghijklmnop', messages: [{ role: 'user', content: 'yes it works now' }] });
  ok('resolved → needs_input false and listen false by default', r2.json.needs_input === false && r2.json.listen === false);
}

console.log('[aria-chat] voice absent → fields still present (non-breaking for text clients)');
{
  modelReply = { text: 'Try restarting the router. Wait sixty seconds.', emotion_detected: 'neutral', tone_used: 'warm', takeNotes: null, resolved: false, escalate: false, issue_category: 'network', suggestions: [] };
  const r = await call({ sessionId: 'session-abcdefghijklmnop', messages: [{ role: 'user', content: 'no internet' }] });
  ok('no VOICE MODE block when voice is not true', !/# VOICE MODE/.test(anthropicCalls.at(-1).req.system));
  ok('speak/needs_input/listen/action still present with defaults', typeof r.json.speak === 'string' && r.json.needs_input === true && r.json.listen === true && r.json.action.kind === 'none');
}

console.log('[aria-chat] sessionId trust rule');
{
  // Constant/short id (what aria.html sent for every visitor) → fresh id, NO server context, client history only.
  modelReply = { text: 'A reply for visitor A.', emotion_detected: 'neutral', tone_used: 'warm', takeNotes: null, resolved: false, escalate: false, issue_category: 'other', suggestions: [] };
  const a = await call({ sessionId: 'web-2861', messages: [{ role: 'user', content: 'visitor A secret question' }] });
  ok('short/constant id is replaced with a fresh random id', a.json.sessionId !== 'web-2861' && /^anon-[0-9a-f]{24}$/.test(a.json.sessionId));
  ok('no server session is created for the untrusted id', !Object.prototype.hasOwnProperty.call(context, 'getSession') || context.getSession('web-2861').turns.length === 0);
  const b = await call({ sessionId: 'web-2861', messages: [{ role: 'user', content: 'visitor B question' }] });
  const outboundB = anthropicCalls.at(-1).req.messages.map((m) => m.content).join(' | ');
  ok('visitor B\'s prompt never contains visitor A\'s turn', !/visitor A secret question/.test(outboundB) && /visitor B question/.test(outboundB));
  ok('each untrusted request gets a different fresh id', a.json.sessionId !== b.json.sessionId);

  // Trusted id → server context keeps turns and feeds them to the next call.
  const sid = 'trusted-session-0123456789abcdef';
  await call({ sessionId: sid, messages: [{ role: 'user', content: 'first turn for trusted session' }] });
  await call({ sessionId: sid, messages: [{ role: 'user', content: 'second turn' }] });
  const outboundT = anthropicCalls.at(-1).req.messages.map((m) => m.content).join(' | ');
  ok('trusted id: prior server turn is included in the next prompt', /first turn for trusted session/.test(outboundT) && context.getSession(sid).turns.length >= 2);
  ok('trusted id is echoed back unchanged', (await call({ sessionId: sid, messages: [{ role: 'user', content: 'third' }] })).json.sessionId === sid);
}

console.log('[aria-chat] degraded branch is honest and readable by the UI');
{
  modelMode = 'throw';
  const r = await call({ voice: true, sessionId: 'session-abcdefghijklmnop', messages: [{ role: 'user', content: 'help' }] });
  ok('provider outage → 200 degraded with BOTH reply and text', r.status === 200 && r.json.degraded === true && r.json.text && r.json.reply === r.json.text);
  ok('degraded carries resolved/escalate/category/suggestions', r.json.resolved === false && r.json.escalate === false && r.json.category === 'other' && Array.isArray(r.json.suggestions));
  ok('degraded carries the voice contract', typeof r.json.speak === 'string' && r.json.needs_input === true && r.json.listen === true && r.json.action.kind === 'none');
  ok('degraded never leaks err.message', !('detail' in r.json));
  modelMode = 'ok';
}

global.fetch = realFetch;
console.log(`\naria-chat-voice-contract: ${pass} checks passed`);
