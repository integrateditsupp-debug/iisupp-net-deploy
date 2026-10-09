#!/usr/bin/env node
// aria-voice-conversation.test.mjs — the ARIA web voice loop (assets/aria-voice-conversation.js) under node
// with a fake SpeechRecognition, a fake speechSynthesis, a fake fetch and a deterministic clock. Nothing
// here touches the network or a browser. Asserts the state machine (idle → listening → thinking → speaking
// → listening / ended), end phrases, the 12-turn history trim, barge-in cancel + echo guard, the 300 ms
// re-arm, the silence/empty-turn exit, mic-denied / degraded / unsupported honesty paths, and that a
// missing Web Speech API never produces a network call.
//   node tests/aria-voice-conversation.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const V = require_('../assets/aria-voice-conversation.js');

let pass = 0;
const ok = (label, cond) => { assert.ok(cond, label); pass++; console.log('  ✓ ' + label); };

// ---- deterministic clock + timers ------------------------------------------------------------
// drain(): let every pending promise chain (fake fetch → json → handleReply) settle before asserting.
const drain = () => new Promise((r) => setImmediate(r));
function makeClock() {
  let t = 1_000_000;
  const timers = new Map();
  let seq = 0;
  return {
    now: () => t,
    setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { due: t + Math.max(0, ms | 0), fn }); return id; },
    clearTimeout: (id) => { timers.delete(id); },
    async tick(ms) {
      const end = t + ms;
      for (;;) {
        let next = null;
        for (const [id, tm] of timers) if (tm.due <= end && (!next || tm.due < next.tm.due)) next = { id, tm };
        if (!next) break;
        t = Math.max(t, next.tm.due);
        timers.delete(next.id);
        next.tm.fn();
        await drain();
      }
      t = end;
      await drain();
    },
    pending: () => timers.size,
  };
}

// ---- fake Web Speech API -------------------------------------------------------------------
const srInstances = [];
class FakeSR {
  constructor() { this.started = 0; this.aborted = 0; this.stopped = 0; this.continuous = false; this.interimResults = false; this.lang = ''; srInstances.push(this); }
  start() { this.started++; this.live = true; if (this.onstart) this.onstart({}); }
  stop() { this.stopped++; this.live = false; }
  abort() { this.aborted++; this.live = false; }
  // helpers the test drives
  result(text, isFinal) {
    const r = [{ transcript: text }]; r.isFinal = !!isFinal;
    if (this.onresult) this.onresult({ resultIndex: 0, results: [r] });
  }
  error(code) { if (this.onerror) this.onerror({ error: code }); }
  end() { this.live = false; if (this.onend) this.onend({}); }
}
const lastSR = () => srInstances[srInstances.length - 1];

const utterances = [];
class FakeUtterance { constructor(text) { this.text = text; utterances.push(this); } }
const synth = {
  cancels: 0, spoken: [],
  speak(u) { this.spoken.push(u); },
  cancel() { this.cancels++; },
  getVoices() { return []; },
};
const lastUtt = () => utterances[utterances.length - 1];
async function finishUtterance(u) { u.onstart && u.onstart({}); u.onend && u.onend({}); await drain(); }
async function speakAll(clock) {
  // drive every utterance the engine queues until it stops queueing (chunked speech)
  for (let guard = 0; guard < 10; guard++) {
    const before = utterances.length;
    const u = lastUtt();
    if (!u || u._done) break;
    u._done = true;
    await finishUtterance(u);
    await clock.tick(0);
    if (utterances.length === before) break;
  }
}

// ---- fake server -----------------------------------------------------------------------------
const fetchCalls = [];
let reply = null;      // object | () => object
let replyStatus = 200;
let fetchThrows = false;
const fakeFetch = async (url, init) => {
  if (fetchThrows) throw new Error('fetch failed');
  const body = JSON.parse(init.body);
  fetchCalls.push({ url, init, body });
  const data = typeof reply === 'function' ? reply(body) : reply;
  return { ok: replyStatus === 200, status: replyStatus, json: async () => data };
};

function harness(extra = {}) {
  const clock = makeClock();
  const events = { states: [], user: [], assistant: [], actions: [], errors: [], ends: [], interim: [], empty: [], history: [] };
  const conv = V.createVoiceConversation({
    SpeechRecognition: extra.noSR ? null : FakeSR,
    speechSynthesis: extra.noSynth ? null : synth,
    SpeechSynthesisUtterance: extra.noSynth ? null : FakeUtterance,
    fetch: fakeFetch,
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, now: clock.now,
    navigator: { language: 'en-CA', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36', userAgentData: { platform: 'Windows', mobile: false, brands: [{ brand: 'Not/A)Brand' }, { brand: 'Chromium' }, { brand: 'Google Chrome' }] } },
    sessionId: () => 'web-9f3c1d2e-4b5a-4c6d-8e7f-0a1b2c3d4e5f',
    history: extra.history,
    onState: (s, p, m) => events.states.push({ s, p, m }),
    onInterim: (t) => events.interim.push(t),
    onUserTurn: (t, m) => events.user.push({ t, m }),
    onAssistantTurn: (d, m) => events.assistant.push({ d, m }),
    onAction: (a, d) => events.actions.push({ a, d }),
    onError: (c, d) => events.errors.push({ c, d }),
    onEnd: (r, m) => events.ends.push({ r, m }),
    onEmptyTurn: (n) => events.empty.push(n),
    onHistory: (h) => events.history.push(h),
    augmentSpeak: extra.augmentSpeak,
  });
  return { conv, clock, events };
}
const stateSeq = (ev) => ev.states.map((x) => x.s).join('>');
function resetFakes() { fetchCalls.length = 0; utterances.length = 0; synth.spoken.length = 0; synth.cancels = 0; srInstances.length = 0; reply = null; replyStatus = 200; fetchThrows = false; }

// =============================================================================================
console.log('[voice] pure helpers');
{
  ok('isEndPhrase: closers', ['that\'s all', 'Stop.', 'thanks, bye', 'Goodbye!', 'okay that\'s all thanks', 'bye bye', 'I\'m done, thanks'].every(V.isEndPhrase));
  ok('isEndPhrase: real turns are NOT closers', !['stop the printer from jamming', 'it says goodbye and then crashes', 'that\'s all it shows on screen but the app still fails', 'my wifi is down'].some(V.isEndPhrase));
  const fb = V.fallbackSpeak('**Frustrating, I get it.** Here is the fix:\n\n1. Open **Settings** → Network.\n2. Run `ipconfig /flushdns` — see https://support.example/x.\n3. Reboot and tell me.');
  ok('fallbackSpeak strips markdown/URLs and keeps two sentences', !/[*`#]|https?:/.test(fb) && /Frustrating, I get it/.test(fb) && fb.split(/(?<=[.!?])\s+/).length <= 2);
  ok('fallbackSpeak caps at 55 words', V.fallbackSpeak(Array.from({ length: 120 }, (_, i) => 'w' + i).join(' ') + '.').split(/\s+/).length <= 56);
  ok('chunkForSpeech splits long speech by sentence and keeps every sentence', V.chunkForSpeech('One two three. Four five six! Seven eight?').join(' ') === 'One two three. Four five six! Seven eight?' && V.chunkForSpeech(Array.from({ length: 12 }, (_, i) => `Sentence number ${i} is here and it is fairly long so chunks split.`).join(' ')).length > 1);
  ok('looksLikeEcho: ARIA\'s own words are echo, the user\'s words are not', V.looksLikeEcho('open the settings app and pick network', 'Open the Settings app, then pick Network and tell me what you see.') && !V.looksLikeEcho('wait actually it is the second printer upstairs', 'Open the Settings app, then pick Network and tell me what you see.'));
  ok('looksLikeEcho: one-word noise is ignored', V.looksLikeEcho('yes', 'anything'));
  const p = V.platformInfo({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', platform: 'MacIntel' });
  ok('platformInfo: macOS + Safari, one-line device hint', p.platform === 'macOS' && /Safari/.test(p.device.app) && /desktop/.test(p.device.app) && !/\n/.test(p.device.app));
  ok('normalizeAction mirrors the server contract', V.normalizeAction({ kind: 'sentinel-fix', recipeHint: 'flush-dns' }).recipeHint === 'flush-dns' && V.normalizeAction({ kind: 'nope' }).kind === 'none');
  ok('isSupported / supportsContinuous read the injected root', V.isSupported({ webkitSpeechRecognition: FakeSR }) && V.supportsContinuous({ SpeechRecognition: FakeSR }) && !V.isSupported({}));
}

console.log('[voice] no Web Speech API → honest exit, zero network');
{
  resetFakes();
  const { conv, events } = harness({ noSR: true });
  const started = conv.start('');
  ok('start() returns false and ends with reason unsupported', started === false && conv.getState() === 'ended' && events.ends[0].r === 'unsupported');
  ok('onError(unsupported) fired', events.errors.length === 1 && events.errors[0].c === 'unsupported');
  ok('no fetch when the API is missing', fetchCalls.length === 0);
  ok('typing into a dead loop is refused', conv.submitText('hello') === false);
}

console.log('[voice] happy path: listening → thinking → speaking → re-armed listening');
{
  resetFakes();
  const { conv, clock, events } = harness();
  reply = { text: 'Let us check the queue.\n\n1. Open **Settings**.\n2. Pick Printers.', speak: 'Got it. Open Settings and pick Printers, then tell me what you see.', needs_input: true, listen: true, action: { kind: 'guide', recipeHint: null } };
  ok('start() → listening with a continuous, interim, en-CA recognizer', conv.start('') === true && conv.getState() === 'listening' && lastSR().continuous === true && lastSR().interimResults === true && lastSR().lang === 'en-CA' && lastSR().started === 1);
  lastSR().result('my printer', false);
  ok('interim text is surfaced live', events.interim.at(-1) === 'my printer');
  lastSR().result('my printer is jammed', true);
  await clock.tick(1000);
  ok('a final result alone does not end the turn before 1.6 s of silence', conv.getState() === 'listening' && fetchCalls.length === 0);
  await clock.tick(700);
  ok('after the silence window the turn is committed → thinking', events.states.some((x) => x.s === 'thinking') && events.user.length === 1 && events.user[0].t === 'my printer is jammed' && events.user[0].m.source === 'voice');
  ok('recognition is stopped while thinking', srInstances[0].aborted === 1);
  await clock.tick(0);
  const call = fetchCalls[0];
  ok('POST aria-chat with voice:true, the trusted sessionId, platform + device hint', call && call.url === '/.netlify/functions/aria-chat' && call.body.voice === true && call.body.sessionId === 'web-9f3c1d2e-4b5a-4c6d-8e7f-0a1b2c3d4e5f' && call.body.platform === 'Windows' && /Google Chrome/.test(call.body.device.app) && call.body.messages.at(-1).content === 'my printer is jammed');
  ok('reply → speaking the server `speak`, assistant turn mirrored with a real clock stamp', conv.getState() === 'speaking' && events.assistant.length === 1 && events.assistant[0].m.speakText === reply.speak && events.assistant[0].m.elapsedMs === 1600 && lastUtt().text === reply.speak);
  ok('guide action is surfaced', events.actions[0].a.kind === 'guide');
  ok('barge-in watch: recognition is live while ARIA speaks', lastSR() !== srInstances[0] && lastSR().started === 1);
  await speakAll(clock);
  ok('after speech: 300 ms gap, then listening again (listen:true)', conv.getState() === 'speaking' || conv.getState() === 'listening');
  await clock.tick(300);
  ok('re-armed listening after the gap', conv.getState() === 'listening' && events.ends.length === 0);
  ok('state sequence', stateSeq(events) === 'listening>thinking>speaking>listening');
  // second turn, typed this time
  reply = { text: 'Done. Glad that worked.', speak: 'Great, that is sorted. Anything else?', needs_input: false, listen: false, action: { kind: 'none' } };
  ok('typed text during voice commits immediately (no silence wait)', conv.submitText('it printed, thanks') === true && conv.getState() === 'thinking');
  await clock.tick(0);
  ok('history carries both sides of the first exchange', fetchCalls[1].body.messages.map((m) => m.role).join(',') === 'user,assistant,user');
  await speakAll(clock);
  await clock.tick(400);
  ok('needs_input:false → ended with reason resolved, no re-arm', conv.getState() === 'ended' && events.ends[0].r === 'resolved' && clock.pending() === 0);
  ok('ending aborts recognition and cancels synthesis', lastSR().live === false && synth.cancels > 0);
}

console.log('[voice] end phrases end the loop without a server call');
{
  resetFakes();
  const { conv, clock, events } = harness();
  conv.start('');
  lastSR().result("okay that's all, thanks", true);
  await clock.tick(1600);
  ok('"that\'s all" → ended (end-phrase), user turn flagged end:true, zero fetch', conv.getState() === 'ended' && events.ends[0].r === 'end-phrase' && events.user[0].m.end === true && fetchCalls.length === 0);
  ok('start() is allowed again after an end', conv.start('') === true && conv.getState() === 'listening');
  conv.stop('escape');
  ok('stop(escape) ends and reports the reason', conv.getState() === 'ended' && events.ends.at(-1).r === 'escape');
}

console.log('[voice] history is trimmed to the last 12 turns');
{
  resetFakes();
  const seed = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'turn ' + i }));
  const { conv, clock } = harness({ history: seed });
  reply = { text: 'ok', speak: 'ok', needs_input: true, listen: true };
  conv.start('new question');
  await clock.tick(0);
  const msgs = fetchCalls[0].body.messages;
  ok('outbound history ≤ 12 and ends with the new user turn', msgs.length <= 12 && msgs.at(-1).content === 'new question' && msgs[0].content === 'turn 19');
  ok('initial text is the first user turn (source text) and goes straight to thinking', conv.getState() === 'speaking' || conv.getState() === 'thinking');
}

console.log('[voice] barge-in: real speech cancels ARIA, echo does not');
{
  resetFakes();
  const { conv, clock, events } = harness();
  reply = { text: 'Open the Settings app, then pick Network and tell me what you see.', speak: 'Open the Settings app, then pick Network and tell me what you see.', needs_input: true, listen: true };
  conv.start('wifi is down');
  await clock.tick(0);
  ok('speaking', conv.getState() === 'speaking');
  const cancelsBefore = synth.cancels;
  lastSR().result('open the settings app and pick network', false);
  ok('echo of ARIA\'s own sentence is ignored', conv.getState() === 'speaking' && synth.cancels === cancelsBefore);
  lastSR().result('wait', false);
  ok('short noise is ignored', conv.getState() === 'speaking');
  lastSR().result('wait actually it is the second router upstairs', false);
  ok('real speech → synthesis cancelled, state flips to listening', synth.cancels === cancelsBefore + 1 && conv.getState() === 'listening' && events.states.at(-1).m.bargeIn === true);
  lastSR().result('wait actually it is the second router upstairs', true);
  await clock.tick(1600);
  ok('the barged-in words become the next user turn', events.user.at(-1).t === 'wait actually it is the second router upstairs' && fetchCalls.length === 2 && fetchCalls[1].body.messages.at(-1).content === 'wait actually it is the second router upstairs');
  await clock.tick(0);
  ok('stale utterance callbacks never re-arm or advance the loop', (() => { const u = utterances[0]; u.onend && u.onend({}); return conv.getState() !== 'listening'; })());
  // echo that slipped past the interim guard must never be SENT as the user's words
  await speakAll(clock);
  await clock.tick(300);
  ok('listening again after the second reply', conv.getState() === 'listening');
  const callsBefore = fetchCalls.length;
  lastSR().result('wait actually something different happened here', false);   // real words → barge-in during speech? (we are listening, so plain interim)
  lastSR().result('open the settings app then pick network and tell me what you see', true);
  await clock.tick(1600);
  ok('a normal (non-barge-in) turn is sent even if it repeats ARIA', fetchCalls.length === callsBefore + 1);
  await clock.tick(0);
  ok('reply → speaking', conv.getState() === 'speaking');
  ok('speaking → interrupt with real words', (() => { lastSR().result('hold on wait a second there is more', false); return conv.getState() === 'listening'; })());
  const calls2 = fetchCalls.length, userTurns = events.user.length;
  lastSR().result('open the settings app then pick network and tell me what you see', true);   // the final turns out to be echo
  await clock.tick(1600);
  ok('…but a barge-in turn that resolves to ARIA\'s own words is dropped, not sent', fetchCalls.length === calls2 && conv.getState() === 'listening' && events.user.length === userTurns);
}

console.log('[voice] silence: two empty listening cycles end the loop; one re-arms');
{
  resetFakes();
  const { conv, events } = harness();
  conv.start('');
  const first = lastSR();
  first.error('no-speech'); first.end();
  ok('first empty cycle → re-armed with a fresh recognizer', conv.getState() === 'listening' && events.empty.length === 1 && lastSR() !== first && lastSR().started === 1);
  lastSR().end();
  ok('second empty cycle → ended (silence)', conv.getState() === 'ended' && events.ends[0].r === 'silence');
}

console.log('[voice] honest failure states');
{
  resetFakes();
  let h = harness();
  h.conv.start('');
  h.events.states.length = 0;
  lastSR().error('not-allowed');
  ok('mic permission denied → onError(mic-denied) + ended', h.events.errors[0].c === 'mic-denied' && h.events.ends[0].r === 'mic-denied' && fetchCalls.length === 0);

  resetFakes();
  h = harness();
  reply = { text: 'Hey — I am having a momentary issue reaching my reasoning brain.', speak: 'I am having trouble reaching my reasoning brain for a moment. Tell me what you see.', needs_input: true, listen: true, degraded: true };
  h.conv.start('help');
  await h.clock.tick(0);
  ok('degraded reply is spoken', h.conv.getState() === 'speaking' && lastUtt().text === reply.speak);
  await speakAll(h.clock);
  await h.clock.tick(400);
  ok('…and the loop ends (degraded) instead of re-arming', h.conv.getState() === 'ended' && h.events.ends[0].r === 'degraded');

  resetFakes();
  h = harness();
  replyStatus = 500;
  reply = { error: 'Service error' };
  h.conv.start('help');
  await h.clock.tick(0);
  ok('HTTP 500 → onError(server) + ended (server-error), nothing spoken', h.events.errors[0].c === 'server' && h.events.ends[0].r === 'server-error' && utterances.length === 0);

  resetFakes();
  h = harness();
  fetchThrows = true;
  h.conv.start('help');
  await h.clock.tick(0);
  ok('network failure → onError(server) + ended', h.events.errors[0].c === 'server' && h.conv.getState() === 'ended');

  resetFakes();
  h = harness();
  reply = { text: 'Restart Outlook.\n\nThen tell me.', needs_input: true, listen: true };
  h.conv.start('outlook will not open');
  await h.clock.tick(0);
  ok('no `speak` from the server → first two sentences of text are spoken', lastUtt().text === 'Restart Outlook. Then tell me.');

  resetFakes();
  h = harness();
  reply = { text: 'x', speak: 'This utterance will be swallowed by a TTS gate.', needs_input: true, listen: true };
  h.conv.start('q');
  await h.clock.tick(0);
  ok('speaking', h.conv.getState() === 'speaking');
  await h.clock.tick(2500);
  await h.clock.tick(300);
  ok('an utterance that never starts does not hang the loop (start watchdog → listening)', h.conv.getState() === 'listening');

  resetFakes();
  h = harness({ noSynth: true });
  reply = { text: 'x', speak: 'y', needs_input: true, listen: true };
  h.conv.start('q');
  await h.clock.tick(0);
  await h.clock.tick(300);
  ok('no speechSynthesis → skip straight to listening', h.conv.getState() === 'listening' && utterances.length === 0);
}

console.log('[voice] actions reach the page; augmentSpeak can add the honest Sentinel / handoff line');
{
  resetFakes();
  const h = harness({ augmentSpeak: (speak, ctx) => ctx.action.kind === 'sentinel-fix' ? speak + ' On a computer with ARIA Sentinel I can run that fix for you — want the download link?' : speak });
  reply = { text: 'Flush DNS.', speak: 'Let us flush the DNS cache.', needs_input: true, listen: true, action: { kind: 'sentinel-fix', recipeHint: 'flush-dns' } };
  h.conv.start('sites will not load');
  await h.clock.tick(0);
  ok('sentinel-fix action delivered with its recipe hint', h.events.actions[0].a.kind === 'sentinel-fix' && h.events.actions[0].a.recipeHint === 'flush-dns');
  ok('spoken text carries the appended offer, nothing is "run"', /want the download link/.test(lastUtt().text) && h.events.assistant[0].m.speakText.endsWith('download link?'));
  reply = { text: 'Paging a person.', speak: 'I am bringing a person in.', needs_input: false, listen: false, action: { kind: 'escalate' } };
  await speakAll(h.clock);
  await h.clock.tick(300);
  h.conv.submitText('still broken, I need a human');
  await h.clock.tick(0);
  ok('escalate action delivered', h.events.actions.at(-1).a.kind === 'escalate');
}

console.log(`\naria-voice-conversation: ${pass} checks passed`);
