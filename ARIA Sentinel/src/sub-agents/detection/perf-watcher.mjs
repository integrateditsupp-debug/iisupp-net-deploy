// perf-watcher — fires SYSTEM.SLOW.HIGH_CPU / HIGH_RAM after 5 min SUSTAINED load.
// Source: Get-Counter \Processor(_Total)\% Processor Time + \Memory\% Committed Bytes In Use
// Cadence 5s. Content-blind: only two numeric percentages are read; nothing identifying.
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

export function createPerfWatcher({ emit, isBlocked, now = () => Date.now() }) {
  let state = {};
  return {
    name: "perf",
    cadenceMs: 5 * 1000,
    async tick() {
      if (isBlocked()) return;
      const sample = await runPowerShellJson(QUERY);
      if (sample == null) return;
      const result = evaluatePerf(state, sample, now());
      state = result.state;
      for (const s of result.signals) emit(s.signal, s.hint);
    }
  };
}
