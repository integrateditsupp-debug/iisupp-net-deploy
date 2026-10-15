// perf-watcher — fires SYSTEM.SLOW.HIGH_CPU / HIGH_RAM after 5 min SUSTAINED load.
// Cadence 5s. Content-blind: only two numeric percentages are read; nothing identifying.
//
// PROD 2026-10-14 (audit M8) — NATIVE SAMPLING, NO SPAWN. Every 5 s this watcher used to launch powershell.exe
// for Get-Counter (12 spawns/min on its own — most of the ≈21/min PowerShell storm that kept laptops warm and
// looked like an EDR alert pattern). CPU% now comes from os.cpus() time deltas and memory% from
// os.totalmem()/os.freemem() — zero processes. The Get-Counter query is kept ONLY as a fallback for a platform
// where the os facade yields nothing (never on Windows), so spawnsPerTick is 0 on the normal path.
//
// FAULT LAB 2026-10-14 (defect 6) — THE CLOCK-DRIFT CHECK. system-time-drift-v1 existed but nothing detected drift: the
// person had to notice it. This watcher's tick now also runs a slow sub-check (every 15 min — declared in `subChecks`
// so tests/spawn-budget.test.mjs counts it; the 5-s perf sampling itself stays native, spawnsPerTick 0):
//   · SOURCE — the offset Windows' OWN time service last computed against its NTP source: the "Windows Time Service ›
//     Computed Time Offset" performance counter (Windows 10 1607+ / Server 2016+; microseconds, absolute), read through
//     its WMI class Win32_PerfRawData_MicrosoftWindowsW32TimePerf_WindowsTimeService (property ComputedTimeOffset).
//   · READ-ONLY + NO NETWORK — a local WMI read in a child PowerShell (Restricted); nothing is resynced, nothing is
//     sent, and no NTP server is contacted by ARIA (W32Time's own sync is the OS's business, unchanged).
//   · CONTENT-BLIND — the child prints ONE number (the offset); the time source's name/IP is never read.
//   · LOCALE-PROOF + UNELEVATED — WMI class names are not localised; w32tm's text output is, and its status query may be
//     refused to a standard (unelevated) token, so w32tm was not used. (To confirm on a real machine: docs/FAULT-LAB.md.)
//   · SIGNAL — SYSTEM.TIME.DRIFT (hint "clock-offset-over-2-min") when |offset| > 120 s, edge-triggered (once per
//     excursion, re-armed when the clock is back within 2 min). No measurement (counter absent, time service stopped,
//     a non-Windows platform) is "unknown" — never "drift". Routed by the matcher to system-time-drift-v1 (a guide).
import os from "node:os";
import { runPowerShellJson, toArray } from "./ps.mjs";

export const CLOCK_DRIFT_THRESHOLD_SEC = 120; // |offset| > 2 min
export const CLOCK_CHECK_MS = 15 * 60 * 1000; // one read every 15 min
export const CLOCK_QUERY =
  "$t=Get-CimInstance -ClassName Win32_PerfRawData_MicrosoftWindowsW32TimePerf_WindowsTimeService -ErrorAction SilentlyContinue | Select-Object -First 1; " +
  "if($t){ [pscustomobject]@{offsetUs=[double]$t.ComputedTimeOffset} | ConvertTo-Json -Compress }";

/**
 * Pure, edge-triggered clock-drift evaluator. `sample` = { offsetUs } (microseconds, the OS's computed offset) or null.
 * Returns { state:{ drifting }, signals, offsetSec } — offsetSec is null when nothing was measured.
 */
export function evaluateClockDrift(state, sample) {
  const wasDrifting = Boolean(state && state.drifting);
  const row = toArray(sample)[0] || {};
  const us = Number(row && row.offsetUs);
  if (row.offsetUs == null || !Number.isFinite(us)) return { state: { drifting: wasDrifting }, signals: [], offsetSec: null }; // unknown ≠ drift
  const offsetSec = Math.abs(us) / 1e6;
  const drifting = offsetSec > CLOCK_DRIFT_THRESHOLD_SEC;
  const signals = drifting && !wasDrifting ? [{ signal: "SYSTEM.TIME.DRIFT", hint: "clock-offset-over-2-min" }] : [];
  return { state: { drifting }, signals, offsetSec: Math.round(offsetSec * 10) / 10 };
}

const CPU_THRESHOLD = 90; // %
const RAM_THRESHOLD = 92; // % committed
const SUSTAIN_MS = 5 * 60 * 1000; // must stay high for 5 minutes
const REARM_MS = 15 * 60 * 1000; // do not re-fire the same signal within 15 min

const QUERY =
  "$c=Get-Counter '\\Processor(_Total)\\% Processor Time','\\Memory\\% Committed Bytes In Use' " +
  "-ErrorAction SilentlyContinue; " +
  "[pscustomobject]@{cpu=[math]::Round(($c.CounterSamples|Where-Object Path -like '*processor*').CookedValue,1);" +
  "mem=[math]::Round(($c.CounterSamples|Where-Object Path -like '*committed*').CookedValue,1)} | ConvertTo-Json -Compress";

/**
 * Pure, stateful evaluator. Carries `state` between samples so the suite can drive it
 * deterministically. A signal only fires once a metric has been over threshold
 * continuously for SUSTAIN_MS, and won't re-fire until REARM_MS has passed.
 */
export function evaluatePerf(state, sample, now) {
  const next = {
    cpuHighSince: state?.cpuHighSince ?? null,
    ramHighSince: state?.ramHighSince ?? null,
    cpuFiredAt: state?.cpuFiredAt ?? -Infinity,
    ramFiredAt: state?.ramFiredAt ?? -Infinity
  };
  const signals = [];
  const cpu = Number(sample?.cpu);
  const mem = Number(sample?.mem);

  if (Number.isFinite(cpu) && cpu >= CPU_THRESHOLD) {
    next.cpuHighSince = next.cpuHighSince ?? now;
    if (now - next.cpuHighSince >= SUSTAIN_MS && now - next.cpuFiredAt >= REARM_MS) {
      signals.push({ signal: "SYSTEM.SLOW.HIGH_CPU", hint: "cpu-sustained-high" });
      next.cpuFiredAt = now;
    }
  } else {
    next.cpuHighSince = null;
  }

  if (Number.isFinite(mem) && mem >= RAM_THRESHOLD) {
    next.ramHighSince = next.ramHighSince ?? now;
    if (now - next.ramHighSince >= SUSTAIN_MS && now - next.ramFiredAt >= REARM_MS) {
      signals.push({ signal: "SYSTEM.SLOW.HIGH_RAM", hint: "ram-sustained-high" });
      next.ramFiredAt = now;
    }
  } else {
    next.ramHighSince = null;
  }

  return { state: next, signals };
}

/** Sum of per-core busy/total ticks from an os.cpus() snapshot. Pure. */
export function cpuTotals(cpus) {
  let busy = 0, total = 0;
  for (const c of Array.isArray(cpus) ? cpus : []) {
    const t = (c && c.times) || {};
    const idle = Number(t.idle) || 0;
    const all = (Number(t.user) || 0) + (Number(t.nice) || 0) + (Number(t.sys) || 0) + (Number(t.irq) || 0) + idle;
    busy += all - idle;
    total += all;
  }
  return { busy, total };
}

/**
 * Native perf sample from an injected `os` facade ({ cpus(), totalmem(), freemem() }). The first call has no
 * previous CPU snapshot, so it returns cpu:null (evaluatePerf treats a non-finite value as "not high"). Returns
 * { sample:{cpu,mem}|null, prev } — `prev` is carried into the next call. Never throws.
 */
export function samplePerfNative(facade = os, prev = null) {
  try {
    const cpus = facade.cpus();
    const totalMem = Number(facade.totalmem()) || 0;
    const freeMem = Number(facade.freemem()) || 0;
    const now = cpuTotals(cpus);
    const mem = totalMem > 0 ? Math.round(((totalMem - freeMem) / totalMem) * 1000) / 10 : null;
    let cpu = null;
    if (prev && Number.isFinite(prev.total) && now.total > prev.total) {
      cpu = Math.round(((now.busy - prev.busy) / (now.total - prev.total)) * 1000) / 10;
      cpu = Math.max(0, Math.min(100, cpu));
    }
    if (!Array.isArray(cpus) || !cpus.length || totalMem <= 0) return { sample: null, prev: now };
    return { sample: { cpu, mem }, prev: now };
  } catch {
    return { sample: null, prev };
  }
}

export function createPerfWatcher({ emit, isBlocked, now = () => Date.now(), osFacade = os, options = {}, runJson = runPowerShellJson }) {
  let state = {};
  let prevCpu = null;
  const allowSpawnFallback = options.allowSpawnFallback === true; // off by default: native only
  // (defect 6) the clock sub-check: due at the first tick, then every CLOCK_CHECK_MS; never two in flight.
  const clockEveryMs = Number(options.clockCheckMs) > 0 ? Number(options.clockCheckMs) : CLOCK_CHECK_MS;
  let clockState = {};
  let clockDueAt = -Infinity;
  let clockInFlight = false;
  async function clockTick() {
    const t = now();
    if (clockInFlight || t < clockDueAt) return;
    clockDueAt = t + clockEveryMs;
    clockInFlight = true;
    try {
      const raw = await runJson(CLOCK_QUERY);
      if (isBlocked()) return;
      const result = evaluateClockDrift(clockState, raw);
      clockState = result.state;
      for (const s of result.signals) emit(s.signal, s.hint);
    } catch { /* a failed read is "unknown", never drift */ } finally { clockInFlight = false; }
  }
  return {
    name: "perf",
    cadenceMs: 5 * 1000,
    spawnsPerTick: 0, // native os.cpus()/os.freemem() — no PowerShell
    // (defect 6) the ONE spawning sub-check, declared so the spawn budget counts it (spawnBudgetPerMinute).
    subChecks: [{ name: "clock", cadenceMs: clockEveryMs, spawnsPerTick: 1 }],
    async tick() {
      if (isBlocked()) return;
      let sample = null;
      const native = samplePerfNative(osFacade, prevCpu);
      prevCpu = native.prev;
      sample = native.sample;
      if (sample == null && allowSpawnFallback) sample = await runPowerShellJson(QUERY);
      if (sample != null) {
        const result = evaluatePerf(state, sample, now());
        state = result.state;
        for (const s of result.signals) emit(s.signal, s.hint);
      }
      await clockTick();
    }
  };
}
