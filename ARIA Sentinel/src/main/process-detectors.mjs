// RUN 23 §1 — live process-health polling. Every 30s a single content-blind `Get-Process` snapshot is taken
// (PowerShell via the existing ps.mjs spawn helper — NO new deps) and reduced to a small, sanitized health
// report. Detects: frozen (Responding=false), cpu-hog (>40% sustained across 2 samples = ~60s), ram-hog
// (WorkingSet >1GB), and odd (runs from a temp/download location). 🔒 R11 — the enumerator drops ANY process
// whose image path matches the off-limits "Private pics and Vids" glob, so it is never read, listed, or
// surfaced. Pure evaluate core (`evaluateProcessHealth`) is unit-tested; the poller is win32-only.
import os from "node:os";
import { isBlockedPath, redactPrivate } from "../shared/path-guard.mjs";
import { runPowerShellJson } from "../sub-agents/detection/ps.mjs";

export const POLL_MS = 30 * 1000;
export const CPU_HOG_PCT = 40;
export const CPU_SUSTAIN_SAMPLES = 2; // two consecutive >40% samples (~60s) before flagging
export const RAM_HOG_MB = 1024;       // WorkingSet > 1 GB
export const IPC = Object.freeze({
  get: "sentinel:processHealth:get",
  subscribe: "sentinel:processHealth:subscribe",
  push: "sentinel:processHealth"
});

// Image paths we consider "odd" for a normally-installed app to be running from (either separator).
const ODD_PATH = /[\\/](?:temp|tmp|downloads)[\\/]|[\\/]appdata[\\/]local[\\/]temp[\\/]/i;

const safeName = (n) => redactPrivate(String(n == null ? "" : n)).slice(0, 80);

export function osCores() {
  try { return Math.max(1, os.cpus().length); } catch { return 1; }
}

/** CPU% between two cumulative-CPU-seconds samples, normalized by elapsed time and core count. */
export function cpuPercent(prevCpuSec, curCpuSec, elapsedMs, cores) {
  const dCpu = Math.max(0, (Number(curCpuSec) || 0) - (Number(prevCpuSec) || 0));
  const dT = Math.max(0.001, (Number(elapsedMs) || 0) / 1000);
  const c = Math.max(1, Number(cores) || 1);
  return Math.min(100, (dCpu / dT / c) * 100);
}

function emptySnapshot(ts) {
  return { timestamp: ts, scanned: 0, frozen: [], cpuHogs: [], ramHogs: [], odd: [] };
}

/** ConvertTo-Json returns a bare object for a single row; always work with an array. */
export function normalizeSample(raw) {
  if (raw == null) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/**
 * Pure reducer: previous detector state + a fresh sample → {state, snapshot}. Tracks per-pid CPU history
 * (for the sustained-hog streak) and the first-frozen timestamp (for `since_ms`).
 */
export function evaluateProcessHealth(prevState = {}, sample = [], now = Date.now(), opts = {}) {
  const cores = opts.cores || 1;
  const prev = prevState.byPid || {};
  const lastNow = Number.isFinite(prevState.now) ? prevState.now : now; // 0 is a valid timestamp
  const elapsed = now - lastNow;
  const byPid = {};
  const frozen = [], cpuHogs = [], ramHogs = [], odd = [];
  let scanned = 0;

  for (const p of normalizeSample(sample)) {
    // 🔒 R11 — never enumerate / surface a process whose image path is under the off-limits folder.
    if (isBlockedPath(p.path) || isBlockedPath(p.name)) continue;
    const pid = Number(p.pid);
    if (!Number.isFinite(pid)) continue;
    scanned += 1;
    const name = safeName(p.name);
    const prevP = prev[pid] || {};
    const pct = elapsed > 0 ? cpuPercent(prevP.cpu, p.cpu, elapsed, cores) : 0;
    const hogStreak = pct >= CPU_HOG_PCT ? (prevP.hogStreak || 0) + 1 : 0;
    const firstFrozenMs = p.responding === false ? (prevP.firstFrozenMs || now) : 0;
    byPid[pid] = { cpu: Number(p.cpu) || 0, hogStreak, firstFrozenMs };

    if (p.responding === false) frozen.push({ name, pid, since_ms: Math.max(0, now - firstFrozenMs) });
    if (hogStreak >= CPU_SUSTAIN_SAMPLES) cpuHogs.push({ name, pid, cpu: Math.round(pct) });
    const wsMB = Number(p.wsMB) || 0;
    if (wsMB > RAM_HOG_MB) ramHogs.push({ name, pid, ramMB: Math.round(wsMB) });
    if (p.path && ODD_PATH.test(String(p.path))) odd.push({ name, pid, reason: "runs from a temp/download location" });
  }

  const top = (arr, key, n) => arr.slice().sort((a, b) => (b[key] || 0) - (a[key] || 0)).slice(0, n);
  const snapshot = {
    timestamp: now,
    scanned,
    frozen: top(frozen, "since_ms", 5),
    cpuHogs: top(cpuHogs, "cpu", 5),
    ramHogs: top(ramHogs, "ramMB", 5),
    odd: odd.slice(0, 3)
  };
  return { state: { byPid, now }, snapshot };
}

// Single content-blind enumeration. Names + ids + counters only — no command lines, no window titles.
const QUERY =
  "Get-Process -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{ " +
  "name=$_.ProcessName; pid=$_.Id; cpu=[math]::Round($_.CPU,2); " +
  "wsMB=[math]::Round($_.WorkingSet64/1MB,1); responding=$_.Responding; path=$_.Path } } | ConvertTo-Json -Compress";

/**
 * Build the 30s poller. `runJson` is injectable for tests; defaults to the shared PowerShell-JSON spawn.
 * `.tick()` resolves to the latest snapshot; off-win32 it is a no-op that returns the last (empty) snapshot.
 */
export function createProcessDetector({ runJson = runPowerShellJson, now = () => Date.now(), cores = osCores() } = {}) {
  let state = { byPid: {}, now: now() };
  let latest = emptySnapshot(state.now);
  return {
    name: "process-health",
    cadenceMs: POLL_MS,
    latest: () => latest,
    async tick() {
      if (process.platform !== "win32") return latest;
      const raw = await runJson(QUERY);
      if (raw == null) return latest;
      const res = evaluateProcessHealth(state, normalizeSample(raw), now(), { cores });
      state = res.state;
      latest = res.snapshot;
      return latest;
    }
  };
}
