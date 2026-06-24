// event-log-watcher — maps known (provider, eventId) pairs to symbolic codes.
// Source: Get-WinEvent System log, Level 1 (Critical) + 2 (Error) · cadence 60s.
// Content-blind: event MESSAGE text is never read or emitted. We key ONLY on the
// provider name + numeric event id, both of which are fixed Windows enums.
// Anything not in EVENT_MAP is dropped.
import { runPowerShellJson, toArray } from "./ps.mjs";

const EVENT_MAP = {
  "Microsoft-Windows-Kernel-Power|41": { signal: "SYSTEM.UNEXPECTED_SHUTDOWN", hint: "kernel-power-loss" },
  "Microsoft-Windows-WER-SystemErrorReporting|1001": { signal: "BSOD.UNKNOWN", hint: "bugcheck-reported" },
  "Microsoft-Windows-Disk|7": { signal: "DISK.IO_ERROR", hint: "disk-io-error" },
  "Disk|7": { signal: "DISK.IO_ERROR", hint: "disk-io-error" },
  "Microsoft-Windows-Ntfs|55": { signal: "DISK.FS_CORRUPT", hint: "ntfs-corruption" },
  "Ntfs|55": { signal: "DISK.FS_CORRUPT", hint: "ntfs-corruption" },
  "Service Control Manager|7034": { signal: "SYSTEM.SERVICE.CRASHED", hint: "service-crashed" },
  "Service Control Manager|7031": { signal: "SYSTEM.SERVICE.CRASHED", hint: "service-crashed" },
  "Microsoft-Windows-DNS-Client|1014": { signal: "NET.DNS.FAIL", hint: "dns-timeout" },
  "Microsoft-Windows-WindowsUpdateClient|20": { signal: "UPDATE.WINDOWS.STUCK", hint: "update-failed" }
};

// Last cursor (highest RecordId seen) so we only act on NEW events between ticks.
let lastRecordId = 0;

const QUERY =
  "Get-WinEvent -FilterHashtable @{LogName='System';Level=1,2} -MaxEvents 40 -ErrorAction SilentlyContinue | " +
  "Select-Object RecordId,ProviderName,Id | ConvertTo-Json -Compress";

/** Pure mapper. Input: raw event rows. Output: deduped symbolic signals. */
export function mapEventLogSignals(raw) {
  const seen = new Set();
  const out = [];
  for (const row of toArray(raw)) {
    const provider = String(row?.ProviderName || "").trim();
    const id = Number(row?.Id);
    if (!provider || !Number.isFinite(id)) continue;
    const mapped = EVENT_MAP[`${provider}|${id}`];
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
      const raw = await runPowerShellJson(QUERY);
      if (raw == null) return;
      const rows = toArray(raw);
      // Only consider events newer than the last cursor.
      const fresh = rows.filter((r) => Number(r?.RecordId || 0) > lastRecordId);
      const maxId = rows.reduce((m, r) => Math.max(m, Number(r?.RecordId || 0)), lastRecordId);
      lastRecordId = maxId;
      if (!fresh.length) return;
      for (const s of mapEventLogSignals(fresh)) emit(s.signal, s.hint);
    }
  };
}

// Test seam — lets the suite reset the cursor between fuzz runs.
export function __resetCursor() {
  lastRecordId = 0;
}
