// perf-watcher — fires SYSTEM.SLOW.HIGH_CPU / HIGH_RAM after 5 min SUSTAINED load.
// Cadence 5s. Content-blind: only two numeric percentages are read; nothing identifying.
//
// PROD 2026-10-14 (audit M8) — NATIVE SAMPLING, NO SPAWN. Every 5 s this watcher used to launch powershell.exe
// for Get-Counter (12 spawns/min on its own — most of the ≈21/min PowerShell storm that kept laptops warm and
// looked like an EDR alert pattern). CPU% now comes from os.cpus() time deltas and memory% from
// os.totalmem()/os.freemem() — zero processes. The Get-Counter query is kept ONLY as a fallback for a platform
// where the os facade yields nothing (never on Windows), so spawnsPerTick is 0 on the normal path.
import os from "node:os";
import { runPowerShellJson } from "./ps.mjs";

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

export function createPerfWatcher({ emit, isBlocked, now = () => Date.now(), osFacade = os, options = {} }) {
  let state = {};
  let prevCpu = null;
  const allowSpawnFallback = options.allowSpawnFallback === true; // off by default: native only
  return {
    name: "perf",
    cadenceMs: 5 * 1000,
    spawnsPerTick: 0, // native os.cpus()/os.freemem() — no PowerShell
    async tick() {
      if (isBlocked()) return;
      let sample = null;
      const native = samplePerfNative(osFacade, prevCpu);
      prevCpu = native.prev;
      sample = native.sample;
      if (sample == null && allowSpawnFallback) sample = await runPowerShellJson(QUERY);
      if (sample == null) return;
      const result = evaluatePerf(state, sample, now());
      state = result.state;
      for (const s of result.signals) emit(s.signal, s.hint);
    }
  };
}
