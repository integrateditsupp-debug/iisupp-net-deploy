// axis-app-detect.test.mjs — Phase 1: the probe that replaces the guess.
//
// Phase 0's finding, now locked as a contract: "Outlook is offline" had NO probe behind it — it
// was generated text. This suite proves the layer that replaces it, against the spec's own
// acceptance criteria:
//   · three states, never two — and INDETERMINATE never speaks as "offline"
//   · ≥3 attempts with escalating backoff before UNAVAILABLE may be said
//   · failure is never cached (app opened mid-session is seen); success is cached briefly
//   · a probe that could not RUN is INDETERMINATE, not UNAVAILABLE (the network-drop criterion)
//   · a deeper-layer pass overrides a shallower fail
//   · 20 consecutive REAL detections of a genuinely-running process → 20/20, zero false offline
//   · generated text can never out-claim the measurement, and a contradicted answer is not banked
// Run: node tests/axis-app-detect.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeScratchDir } from '../scripts/lib/scratch-dir.mjs';

const scratch = makeScratchDir('app-detect-');
process.env.AXIS_DETECT_LOG = path.join(scratch, 'probes.jsonl');
const D = await import('../scripts/lib/axis-app-detect.mjs');

const ROOT = path.join(import.meta.dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const ok = (m) => console.log('  ok —', m);
const FAST = { attempts: 3, backoff: [0, 10, 20], probeTimeoutMs: 4000 };

// Deterministic runners for contract tests. Each returns what one PowerShell round trip would.
const says = (word) => async () => ({ out: word });
const errs = async () => ({ err: 'the pipe broke' });
const hangs = async () => ({ timeout: true });

// ---- 1. Three states, never two ----
{
  const r = await D.detectApp('nonsense-app', FAST);
  assert.equal(r.state, D.INDETERMINATE, 'an unregistered app is could-not-tell, never offline');
  const up = await D.detectApp('outlook', { ...FAST, runner: says('WINDOW') });
  assert.equal(up.state, D.AVAILABLE);
  assert.equal(up.layer, 'window');
  ok('AVAILABLE / UNAVAILABLE / INDETERMINATE are the only vocabulary');
}

// ---- 2. UNAVAILABLE must be EARNED: ≥3 attempts, escalating delays ----
{
  let calls = 0;
  const counting = async () => { calls++; return { out: 'NONE' }; };
  const t0 = Date.now();
  const r = await D.detectApp('obsidian', { attempts: 3, backoff: [0, 60, 120], runner: counting });
  assert.equal(r.state, D.UNAVAILABLE);
  assert.equal(r.attempts, 3, 'three full attempts before the word is allowed');
  assert.ok(calls >= 3, `runner invoked per attempt (${calls})`);
  assert.ok(Date.now() - t0 >= 170, 'the backoff delays actually elapsed');
  assert.ok(D.MIN_ATTEMPTS >= 3 && D.BACKOFF_MS.length >= D.MIN_ATTEMPTS, 'production floor matches the spec');
  ok('UNAVAILABLE costs three real attempts with real delays');
}

// ---- 3. No negative cache: opened mid-session is SEEN ----
{
  let phase = 'closed';
  const flipflop = async () => ({ out: phase === 'closed' ? 'NONE' : 'PROCESS' });
  const down = await D.detectApp('chrome', { ...FAST, runner: flipflop });
  assert.equal(down.state, D.UNAVAILABLE, 'genuinely closed reads closed');
  phase = 'open';                                   // the user launches the app mid-session
  const up = await D.detectApp('chrome', { ...FAST, runner: flipflop });
  assert.equal(up.state, D.AVAILABLE, 'the very next probe sees it — failure was never cached');
  assert.ok(!up.cached, 'and it was a fresh probe, not a cache hit');
  ok('failure is never cached — an app opened mid-session is detected on the next ask');
}

// ---- 4. Positive cache: short, real, and only for success ----
{
  let calls = 0;
  const counting = async () => { calls++; return { out: 'WINDOW' }; };
  const a = await D.detectApp('edge', { ...FAST, runner: counting });
  const b = await D.detectApp('edge', { ...FAST, runner: counting });
  assert.equal(a.state, D.AVAILABLE);
  assert.ok(b.cached, 'a success seconds old is reused');
  assert.equal(calls, 1, 'the second call cost zero probes');
  assert.ok(D.POSITIVE_CACHE_MS <= 10000, 'the cache is seconds, not minutes — staleness is the enemy');
  ok('success is cached briefly; the cache never holds a failure');
}

// ---- 5. The network-drop criterion: a probe that cannot RUN is INDETERMINATE ----
{
  const r1 = await D.detectApp('word', { ...FAST, runner: errs });
  assert.equal(r1.state, D.INDETERMINATE, 'probe error ≠ app offline');
  const r2 = await D.detectApp('word', { ...FAST, runner: hangs });
  assert.equal(r2.state, D.INDETERMINATE, 'probe timeout ≠ app offline');
  const line = D.speakAppState(r1);
  assert.ok(/can'?t confirm/i.test(line), 'INDETERMINATE speaks as could-not-confirm');
  assert.ok(!/offline/i.test(line), 'and NEVER as offline');
  assert.ok(/retry/i.test(line), 'and says it is retrying rather than concluding');
  ok('could-not-tell is said as could-not-tell — the exact words the spec demands');
}

// ---- 6. A deeper pass overrides a shallower fail ----
{
  let call = 0;
  const comOnly = async (cmd) => { call++; return /GetActiveObject/.test(cmd) ? { out: 'COM' } : { out: 'NONE' }; };
  // A synthetic id: 'outlook' itself was probed (and its success cached) in section 1, and the
  // positive cache is exactly the behaviour section 4 proves — so this section must not share it.
  const r = await D.detectApp('selftest-com', { attempts: 1, backoff: [0], runner: comOnly,
    app: { aliases: /x/, processes: ['no-such-process'], com: 'Fake.Application' } });
  assert.equal(r.state, D.AVAILABLE, 'no visible process but a live COM server = AVAILABLE');
  assert.equal(r.layer, 'com', 'credited to the deeper layer that proved it');
  ok('layer 3 pass beats layer 1 fail, exactly as specced');
}

// ---- 7. Twenty consecutive REAL detections, zero false offline ----
// The acceptance criterion, run against reality: the process probed is the node.exe executing
// this very suite, so "running" is true by construction, and the probes are real PowerShell.
if (process.platform === 'win32') {
  const app = { aliases: /\bnodeapp\b/i, processes: ['node'] };
  let wrong = 0;
  for (let i = 0; i < 20; i++) {
    const r = await D.detectApp('selftest-node', { app, attempts: 3, backoff: [0, 200, 400] });
    if (r.state !== D.AVAILABLE) wrong++;
  }
  assert.equal(wrong, 0, '20/20 correct detections of a genuinely-running process, zero false offline');
  // And the inverse, once: a process name that cannot exist reads UNAVAILABLE cleanly.
  const ghost = await D.detectApp('selftest-ghost', { app: { aliases: /x/, processes: ['no-such-process-bh99'] }, attempts: 3, backoff: [0, 100, 200] });
  assert.equal(ghost.state, D.UNAVAILABLE, 'a truly absent process reads UNAVAILABLE after the full ladder');
  ok('20/20 real probes correct with the app running; a truly absent app reads UNAVAILABLE');
} else {
  const r = await D.detectApp('outlook', {});
  assert.equal(r.state, D.INDETERMINATE, 'non-Windows says could-not-tell, never a guess');
  ok('non-Windows platforms refuse to guess');
}

// ---- 8. Structured logging: JSON lines with app, layer, result, latency, attempt ----
{
  const lines = fs.readFileSync(process.env.AXIS_DETECT_LOG, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.ok(lines.length >= 20, `every probe attempt logged (${lines.length})`);
  for (const e of lines.slice(0, 5)) {
    for (const k of ['ts', 'app', 'layer', 'result', 'ms', 'attempt']) assert.ok(k in e, `log entry carries ${k}`);
  }
  ok('every probe writes one parseable JSON line — the proof the spec asked for');
}

// ---- 9. Generated text can never out-claim the measurement ----
{
  const probeUp = { app: 'outlook', state: D.AVAILABLE, layer: 'window', attempts: 1, latencyMs: 300, detail: 'window present' };
  const lied = 'It looks like Outlook is offline right now, so I could not check your inbox.';
  const fixed = D.availabilityClaimGuard(lied, [probeUp]);
  assert.ok(/Correction — measured/i.test(fixed), 'a false offline claim is corrected in place');
  assert.ok(/is running/i.test(fixed), 'with the measured truth attached');
  const honest = 'Outlook is offline.';
  assert.equal(D.availabilityClaimGuard(honest, [{ ...probeUp, state: D.UNAVAILABLE }]), honest,
    'a TRUE unavailability claim is left alone — the guard enforces measurement, not optimism');
  assert.ok(/Correction — measured/i.test(D.availabilityClaimGuard(lied, [{ ...probeUp, state: D.INDETERMINATE }])),
    'could-not-tell also forbids a confident offline claim');
  ok('measurement outranks prose in both directions');
}

// ---- 10. The wiring: worker measures before generating, guards after, never banks a contradiction ----
{
  const worker = read('scripts/axis-brain-worker.mjs');
  assert.ok(/detectAppsInText\(query\)/.test(worker), 'the worker probes every question that names an app');
  assert.ok(/formatMeasuredBlock\(probes\)/.test(worker), 'the measurement rides in the prompt BEFORE generation');
  assert.ok(/availabilityClaimGuard\(direct\.text, probes\)/.test(worker), 'vault direct answers pass the guard too');
  assert.ok(/const guarded = availabilityClaimGuard\(res\.answer, probes\)/.test(worker), 'model answers pass the guard');
  assert.ok(/!contradicted && worthLearning/.test(worker), 'an answer the guard had to correct is never banked as knowledge');
  const brain = read('netlify/functions/lib/axis-brain.cjs');
  assert.ok(/isLocalStateQuery\(q\) && name !== 'subscription'/.test(brain),
    'a local-state question routes only to the machine that can measure — never to a document tier');
  const { isLocalStateQuery } = (await import('node:module')).createRequire(import.meta.url)('../netlify/functions/lib/axis-brain.cjs');
  assert.ok(isLocalStateQuery('is outlook running right now'), 'state question flagged');
  assert.ok(isLocalStateQuery('is outlook even open'), 'state question flagged');
  assert.ok(!isLocalStateQuery('outlook keeps asking for password'), 'a troubleshooting question still reaches the KB');
  ok('measure → generate → guard, wired end to end, with the cloud routing state questions home');
}

try { fs.rmSync(scratch, { recursive: true, force: true }); } catch { /* refused unlink is not a failure */ }
console.log('axis-app-detect test passed (tri-state earned honestly · no negative cache · deeper layer wins · 20/20 real probes · structured log · prose never out-claims measurement).');
