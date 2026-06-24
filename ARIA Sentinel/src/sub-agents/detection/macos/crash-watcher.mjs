// macOS crash-watcher — fires APP.CRASH.REPORTED on a NEW app crash report and SYSTEM.KERNEL_PANIC
// on a NEW panic. Source: ~/Library/Logs/DiagnosticReports/*.{crash,ips,panic} · startup + 5 min.
// Content-blind: report FILENAMES (which embed the app name + timestamp) are NEVER read or emitted —
// we count files only and surface a generic symbolic code. The reports themselves are never opened.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPORT_DIR = path.join(os.homedir(), "Library", "Logs", "DiagnosticReports");

/**
 * Pure mapper. Input: { crashCount, panicCount } now + prev { crash, panic } counts.
 * Output: { signals, state } — edge-triggered so a steady state emits nothing. A count that
 * decreased (reports rotated/cleared) just re-baselines without firing.
 */
export function mapCrashSignals(counts, prev = {}) {
  const crash = Number(counts?.crashCount || 0);
  const panic = Number(counts?.panicCount || 0);
  const prevCrash = Number.isFinite(prev.crash) ? prev.crash : -1;
  const prevPanic = Number.isFinite(prev.panic) ? prev.panic : -1;
  const signals = [];
  if (prevCrash >= 0 && crash > prevCrash) signals.push({ signal: "APP.CRASH.REPORTED", hint: "crash-report-created" });
  if (prevPanic >= 0 && panic > prevPanic) signals.push({ signal: "SYSTEM.KERNEL_PANIC", hint: "panic-report-created" });
  return { signals, state: { crash, panic } };
}

// Count reports by extension WITHOUT reading any filename into a signal.
function countReports() {
  try {
    let crashCount = 0;
    let panicCount = 0;
    for (const name of fs.readdirSync(REPORT_DIR)) {
      if (name.endsWith(".panic")) panicCount += 1;
      else if (name.endsWith(".crash") || name.endsWith(".ips")) crashCount += 1;
    }
    return { crashCount, panicCount };
  } catch {
    return null; // directory missing / no permission yet → safe no-op
  }
}

export function createCrashWatcher({ emit, isBlocked }) {
  let state = {};
  return {
    name: "crash",
    cadenceMs: 5 * 60 * 1000,
    runAtStartup: true,
    async tick() {
      if (isBlocked()) return;
      if (process.platform !== "darwin") return;
      const counts = countReports();
      if (counts == null) return;
      const result = mapCrashSignals(counts, state);
      state = result.state;
      for (const s of result.signals) emit(s.signal, s.hint);
    }
  };
}
