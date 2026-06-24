// macOS event-log-watcher — maps known (subsystem, messageType) pairs to symbolic codes.
// Source: `log show --last 60s --predicate 'subsystem == "com.apple.system"' --style ndjson --info`
//   (the bounded, tick-friendly equivalent of the `log stream … --level warn` 60s window).
// Content-blind: the free-text `eventMessage` is NEVER read or emitted. We key ONLY on the
// subsystem identifier (a fixed reverse-DNS enum) plus messageType. Anything unmapped is dropped.
import { runShell, parseNdjson } from "./sh.mjs";

// subsystem (optionally :messageType) → symbolic code. Conservative on purpose.
const SUBSYSTEM_MAP = {
  "com.apple.shutdown": { signal: "SYSTEM.UNEXPECTED_SHUTDOWN", hint: "unexpected-shutdown" },
  "com.apple.powerd:Fault": { signal: "SYSTEM.UNEXPECTED_SHUTDOWN", hint: "power-fault" },
  "com.apple.xnu.kernel:Fault": { signal: "SYSTEM.KERNEL_PANIC", hint: "kernel-fault" },
  "com.apple.diskmanagement": { signal: "DISK.FS_CORRUPT", hint: "disk-management-fault" },
  "com.apple.fsck": { signal: "DISK.FS_CORRUPT", hint: "fsck-error" },
  "com.apple.SystemConfiguration": { signal: "NET.ADAPTER.DOWN", hint: "network-config-fault" }
};

/**
 * Pure mapper. Input: parsed log rows [{ subsystem, messageType, eventMessage? }].
 * Output: deduped symbolic signals. eventMessage is ignored entirely — only the subsystem
 * (and an optional messageType qualifier) is consulted, so no log text can ever escape.
 */
export function mapEventLogSignals(rows) {
  const seen = new Set();
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const subsystem = String(row?.subsystem || "").trim();
    const type = String(row?.messageType || "").trim();
    if (!subsystem) continue;
    const mapped = SUBSYSTEM_MAP[`${subsystem}:${type}`] || SUBSYSTEM_MAP[subsystem];
    if (mapped && !seen.has(mapped.signal)) {
      seen.add(mapped.signal);
      out.push({ signal: mapped.signal, hint: mapped.hint });
    }
  }
  return out;
}

export function createEventLogWatcher({ emit, isBlocked }) {
  return {
    name: "event-log",
    cadenceMs: 60 * 1000,
    async tick() {
      if (isBlocked()) return;
      const text = await runShell("log", [
        "show", "--last", "60s",
        "--predicate", 'subsystem == "com.apple.system"',
        "--style", "ndjson", "--info"
      ]);
      if (text == null) return;
      for (const s of mapEventLogSignals(parseNdjson(text))) emit(s.signal, s.hint);
    }
  };
}
