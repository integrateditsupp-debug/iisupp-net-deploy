// axis-app-detect.mjs — AXIS Phase 1: the app/service detection layer that never existed.
//
// Phase 0 established the root cause of "Outlook is offline while Outlook is running": there was
// NO probe anywhere in the system. The words were generated — free-form model text or a KB excerpt
// whose body describes offline states — and "right on retry" was just a second generation wording
// it differently. So this module does not fix a probe; it IS the probe, and the two call sites in
// the worker make generated text answer to measurement.
//
// Contract (the spec, verbatim where it matters):
//   · Single module. No detection logic anywhere else.
//   · THREE states, never two: AVAILABLE / UNAVAILABLE / INDETERMINATE. A probe that could not
//     run is INDETERMINATE — "offline" is never the word for "I could not tell".
//   · Layered probes, cheapest first: process → window handle → COM/API attach. A pass at a
//     deeper layer overrides a fail at a shallower one.
//   · Retry with backoff: ≥3 attempts, escalating delays, before UNAVAILABLE is allowed.
//   · Short POSITIVE cache only (a few seconds). Failure is never cached — re-probe every time.
//   · Cold-start grace: the first probes after module load get more attempts and longer waits.
//   · Structured logging on every probe: app, layer, result, latency, attempt — JSON lines,
//     the first structured log in this repository (baseline §TEST COVERAGE + LOGGING).
//
// Windows-first by construction (this is Ahmad's machine); on any other platform every probe
// returns INDETERMINATE with a reason rather than pretending.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const AVAILABLE = 'AVAILABLE';
export const UNAVAILABLE = 'UNAVAILABLE';
export const INDETERMINATE = 'INDETERMINATE';

// ── Registry ─────────────────────────────────────────────────────────────────
// Per app: the names a spoken/typed sentence uses, the process names to look for, and (optionally)
// a COM ProgID that proves the app is not just a process but a responding automation server.
// GetActiveObject attaches to a RUNNING instance — it never launches one, so the probe is
// side-effect-free. COM can legitimately fail in session contexts where the app is fine, so a COM
// failure is non-decisive: it can UPGRADE confidence, never downgrade a process-level pass.
export const APP_REGISTRY = Object.freeze({
  outlook:  { aliases: /\boutlook\b/i, processes: ['OUTLOOK', 'olk'], com: 'Outlook.Application' },
  teams:    { aliases: /\b(?:ms |microsoft )?teams\b/i, processes: ['ms-teams', 'Teams'] },
  word:     { aliases: /\b(?:ms |microsoft )?word\b/i, processes: ['WINWORD'], com: 'Word.Application' },
  excel:    { aliases: /\b(?:ms |microsoft )?excel\b/i, processes: ['EXCEL'], com: 'Excel.Application' },
  obsidian: { aliases: /\bobsidian\b/i, processes: ['Obsidian'] },
  chrome:   { aliases: /\bchrome\b/i, processes: ['chrome'] },
  edge:     { aliases: /\b(?:ms |microsoft )?edge\b/i, processes: ['msedge'] },
});

// ── Tunables (exported so the suite can prove them, not guess at them) ───────
export const POSITIVE_CACHE_MS = 5000;      // success is fresh for 5s; failure is fresh for 0s
export const MIN_ATTEMPTS = 3;              // the floor before UNAVAILABLE may be spoken
export const BACKOFF_MS = [0, 700, 1500];   // escalating delays between attempts
export const COLD_START_MS = 90000;         // first 90s after load: more patience
export const COLD_ATTEMPTS = 4;
export const COLD_BACKOFF_MS = [0, 1000, 2000, 3500];
export const PROBE_TIMEOUT_MS = 6000;       // one PowerShell probe; cold start doubles it

const BOOTED_AT = Date.now();
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOG_FILE = process.env.AXIS_DETECT_LOG || path.join(REPO, 'logs', 'axis-app-detect.jsonl');

// ── Structured log: one JSON line per probe attempt, append-only ─────────────
function logProbe(entry) {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
  } catch { /* logging never breaks detection */ }
}

// ── One PowerShell round trip ────────────────────────────────────────────────
// Returns { out } on exit 0, { err } otherwise, { timeout: true } on the clock. The distinction
// matters: a probe that RAN and found nothing is evidence; a probe that could not run is not.
function psRun(command, timeoutMs) {
  return new Promise((resolve) => {
    let out = '', err = '', done = false;
    const c = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true });
    const t = setTimeout(() => { if (!done) { done = true; try { c.kill(); } catch {} resolve({ timeout: true }); } }, timeoutMs);
    c.stdout.on('data', (d) => { out += d; });
    c.stderr.on('data', (d) => { err += d; });
    c.on('error', (e) => { if (!done) { done = true; clearTimeout(t); resolve({ err: 'spawn: ' + e.message }); } });
    c.on('close', (code) => { if (!done) { done = true; clearTimeout(t); code === 0 ? resolve({ out: out.trim() }) : resolve({ err: (err || out).trim().slice(0, 300) || 'exit ' + code }); } });
  });
}

// ── The layered probe, one attempt ───────────────────────────────────────────
// Layer 1: process present?  Layer 2: does any of those processes own a window?  Layer 3: does a
// COM attach to the RUNNING instance succeed?  Deeper pass beats shallower fail; a layer that
// cannot run is skipped without penalty. Injectable for tests via opts.runner.
async function probeOnce(appId, app, timeoutMs, runner = psRun) {
  const names = app.processes.map((p) => `'${p}'`).join(',');
  // One round trip carries layers 1+2: name(s) found, and whether any has a MainWindowTitle.
  const r = await runner(
    `$p = Get-Process -Name ${names} -ErrorAction SilentlyContinue; ` +
    `if (-not $p) { 'NONE' } else { $w = @($p | Where-Object { $_.MainWindowTitle }); ` +
    `if ($w.Count -gt 0) { 'WINDOW' } else { 'PROCESS' } }`, timeoutMs);
  if (r.timeout) return { state: INDETERMINATE, layer: 'process', detail: 'probe timed out' };
  if (r.err) return { state: INDETERMINATE, layer: 'process', detail: r.detail || r.err };
  if (r.out === 'NONE') {
    // Definitive at this layer — but the spec says a deeper pass overrides a shallower fail, so
    // try COM before concluding: some hosts run windowless with a live automation server.
    if (app.com) {
      const c = await runner(
        `try { [Runtime.InteropServices.Marshal]::GetActiveObject('${app.com}') | Out-Null; 'COM' } catch { 'NOCOM' }`, timeoutMs);
      if (c.out === 'COM') return { state: AVAILABLE, layer: 'com', detail: 'no visible process, live COM server' };
    }
    return { state: UNAVAILABLE, layer: 'process', detail: 'no process by any registered name' };
  }
  const base = { state: AVAILABLE, layer: r.out === 'WINDOW' ? 'window' : 'process', detail: r.out.toLowerCase() + ' present' };
  if (app.com) {
    const c = await runner(
      `try { [Runtime.InteropServices.Marshal]::GetActiveObject('${app.com}') | Out-Null; 'COM' } catch { 'NOCOM' }`, timeoutMs);
    if (c && c.out === 'COM') return { state: AVAILABLE, layer: 'com', detail: base.detail + ', COM attach ok' };
    // COM said no while the process is visibly there: session isolation, elevation mismatch, or a
    // busy message pump. NON-DECISIVE — the shallower pass stands.
  }
  return base;
}

// ── The public probe: retries, backoff, cold-start grace, positive-only cache ─
const cache = new Map();   // appId → { result, at } — POSITIVE results only, ever

export async function detectApp(appId, opts = {}) {
  // opts.app lets the suite probe a synthetic definition (e.g. the node.exe running the tests)
  // through the REAL PowerShell path — acceptance proof without depending on Outlook's state.
  const app = opts.app || APP_REGISTRY[appId];
  if (!app) return { app: appId, state: INDETERMINATE, layer: 'registry', attempts: 0, latencyMs: 0, detail: 'unknown app — not in the registry' };
  if (process.platform !== 'win32' && !opts.runner) {
    return { app: appId, state: INDETERMINATE, layer: 'platform', attempts: 0, latencyMs: 0, detail: 'probes are Windows-only on this build' };
  }
  const hit = cache.get(appId);
  if (hit && Date.now() - hit.at < POSITIVE_CACHE_MS) return { ...hit.result, cached: true };

  const cold = Date.now() - BOOTED_AT < COLD_START_MS;
  const attempts = opts.attempts || (cold ? COLD_ATTEMPTS : MIN_ATTEMPTS);
  const backoff = opts.backoff || (cold ? COLD_BACKOFF_MS : BACKOFF_MS);
  const timeoutMs = opts.probeTimeoutMs || (cold ? PROBE_TIMEOUT_MS * 2 : PROBE_TIMEOUT_MS);
  const t0 = Date.now();
  let last = null, sawIndeterminate = false;

  for (let i = 0; i < attempts; i++) {
    if (backoff[i]) await new Promise((r) => setTimeout(r, backoff[i]));
    const a0 = Date.now();
    last = await probeOnce(appId, app, timeoutMs, opts.runner);
    logProbe({ app: appId, layer: last.layer, result: last.state, ms: Date.now() - a0, attempt: i + 1, cold, detail: last.detail });
    if (last.state === AVAILABLE) {
      const result = { app: appId, state: AVAILABLE, layer: last.layer, attempts: i + 1, latencyMs: Date.now() - t0, detail: last.detail, checkedAt: Date.now() };
      cache.set(appId, { result, at: Date.now() });          // success is the ONLY thing cached
      return result;
    }
    if (last.state === INDETERMINATE) sawIndeterminate = true;
  }
  // All attempts spent. UNAVAILABLE is only allowed when the probes actually RAN and said no —
  // a run that includes any could-not-tell stays could-not-tell.
  const state = sawIndeterminate && last.state !== UNAVAILABLE ? INDETERMINATE : last.state;
  return { app: appId, state, layer: last.layer, attempts, latencyMs: Date.now() - t0, detail: last.detail, checkedAt: Date.now() };
}

// ── Which registered apps does a sentence name? ──────────────────────────────
export function appsInText(text) {
  const t = String(text || '');
  return Object.entries(APP_REGISTRY).filter(([, a]) => a.aliases.test(t)).map(([id]) => id);
}

// Probe every app a task names (capped — a sentence naming four apps is a conversation, not a
// status request for all four). Returns [] when nothing is named: zero cost on the common path.
export async function detectAppsInText(text, opts = {}) {
  const ids = appsInText(text).slice(0, 2);
  const out = [];
  for (const id of ids) out.push(await detectApp(id, opts));
  return out;
}

// ── Honest words for each state ──────────────────────────────────────────────
// INDETERMINATE must never surface as "offline". These strings are the contract.
export function speakAppState(r) {
  const name = r.app.charAt(0).toUpperCase() + r.app.slice(1);
  if (r.state === AVAILABLE) return `${name} is running (verified ${r.layer === 'com' ? 'down to its automation interface' : 'by ' + r.layer} just now).`;
  if (r.state === UNAVAILABLE) return `${name} is not running — checked ${r.attempts} times over ${Math.round(r.latencyMs / 100) / 10}s before saying so.`;
  return `I can't confirm ${name} is responding — the check itself couldn't complete (${r.detail}). Retrying rather than guessing.`;
}

// The block the worker prepends to a model prompt when the task names an app. The model speaks
// AFTER measurement, so it has no gap to fill with a guess.
export function formatMeasuredBlock(probes) {
  if (!probes || !probes.length) return '';
  return 'MEASURED APP STATE (probed on this machine seconds ago — never contradict this, never '
    + 'claim an app is offline or unavailable unless it says UNAVAILABLE here):\n'
    + probes.map((p) => `- ${p.app}: ${p.state} (${p.detail}; layer ${p.layer}, ${p.attempts} attempt${p.attempts === 1 ? '' : 's'})`).join('\n');
}

// ── The belt: no generated sentence may out-claim the measurement ────────────
// If an answer asserts an app is offline/not running/closed while the probe measured AVAILABLE
// (or could not tell), the claim is corrected in place — measurement outranks prose.
const CLAIM_RE = {
  outlook: /\boutlook\b[^.?!]{0,60}\b(?:offline|not (?:running|open|available|responding)|closed|unavailable|isn'?t (?:running|open))/i,
  teams: /\bteams\b[^.?!]{0,60}\b(?:offline|not (?:running|open|available|responding)|closed|unavailable|isn'?t (?:running|open))/i,
  word: /\bword\b[^.?!]{0,60}\b(?:offline|not (?:running|open|available|responding)|closed|unavailable)/i,
  excel: /\bexcel\b[^.?!]{0,60}\b(?:offline|not (?:running|open|available|responding)|closed|unavailable)/i,
  obsidian: /\bobsidian\b[^.?!]{0,60}\b(?:offline|not (?:running|open|available|responding)|closed|unavailable)/i,
  chrome: /\bchrome\b[^.?!]{0,60}\b(?:offline|not (?:running|open|available|responding)|closed|unavailable)/i,
  edge: /\bedge\b[^.?!]{0,60}\b(?:offline|not (?:running|open|available|responding)|closed|unavailable)/i,
};
export function availabilityClaimGuard(answer, probes) {
  let a = String(answer || '');
  for (const p of probes || []) {
    if (p.state === UNAVAILABLE) continue;               // the claim would be true — leave it
    const re = CLAIM_RE[p.app];
    if (re && re.test(a)) {
      logProbe({ app: p.app, layer: 'claim-guard', result: 'corrected', ms: 0, attempt: 0, detail: 'generated text contradicted measurement' });
      a += `\n\nCorrection — measured on this machine just now: ${speakAppState(p)}`;
    }
  }
  return a;
}

export default { detectApp, detectAppsInText, appsInText, speakAppState, formatMeasuredBlock, availabilityClaimGuard, APP_REGISTRY, AVAILABLE, UNAVAILABLE, INDETERMINATE };
