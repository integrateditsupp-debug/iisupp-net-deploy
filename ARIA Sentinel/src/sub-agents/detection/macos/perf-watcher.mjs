// macOS perf-watcher — fires SYSTEM.SLOW.HIGH_CPU / HIGH_RAM after 5 min SUSTAINED load.
// Source: `top -l 1 -n 0` · cadence 5s. Content-blind: only two numeric percentages are read.
// Reuses the Windows perf-watcher's tested sustain/re-arm evaluator so thresholds match exactly.
import { runShell } from "./sh.mjs";
import { evaluatePerf } from "../perf-watcher.mjs";

/**
 * Pure parser. Input: raw `top -l 1 -n 0` text. Output: { cpu, mem } percentages (or null fields).
 * `top` prints lines like:
 *   CPU usage: 4.55% user, 6.81% sys, 88.63% idle
 *   PhysMem: 14G used (2400M wired), 1655M unused.
 * CPU% = 100 - idle. Mem% = used / (used + unused). Only digits are parsed — nothing identifying.
 */
export function parseTop(text) {
  const out = { cpu: null, mem: null };
  const src = String(text || "");
  const idle = src.match(/([\d.]+)%\s*idle/i);
  if (idle) out.cpu = Math.round((100 - Number(idle[1])) * 10) / 10;
  const mem = src.match(/PhysMem:\s*([\d.]+)\s*([KMGT])\s*used.*?([\d.]+)\s*([KMGT])\s*unused/i);
  if (mem) {
    const unit = { K: 1 / 1024, M: 1, G: 1024, T: 1024 * 1024 };
    const used = Number(mem[1]) * (unit[mem[2].toUpperCase()] || 1);
    const free = Number(mem[3]) * (unit[mem[4].toUpperCase()] || 1);
    const total = used + free;
    if (total > 0) out.mem = Math.round((used / total) * 1000) / 10;
  }
  return out;
}

export function createPerfWatcher({ emit, isBlocked, now = () => Date.now() }) {
  let state = {};
  return {
    name: "perf",
    cadenceMs: 5 * 1000,
    async tick() {
      if (isBlocked()) return;
      const text = await runShell("top", ["-l", "1", "-n", "0"]);
      if (text == null) return;
      const sample = parseTop(text);
      const result = evaluatePerf(state, sample, now());
      state = result.state;
      for (const s of result.signals) emit(s.signal, s.hint);
    }
  };
}
