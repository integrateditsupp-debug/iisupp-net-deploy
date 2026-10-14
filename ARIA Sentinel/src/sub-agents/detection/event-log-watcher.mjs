// event-log-watcher — maps known (provider, eventId) pairs to symbolic codes.
// Source: Get-WinEvent System log, Level 1 (Critical) + 2 (Error) · cadence 60s.
// Content-blind: event MESSAGE text is never read or emitted. We key ONLY on the
// provider name + numeric event id, both of which are fixed Windows enums.
// Anything not in EVENT_MAP is dropped.
//
// PROD 2026-10-14 (audit M6) — NO FIRST-LAUNCH FALSE ALARMS. The cursor used to reset to 0 on every launch, so the
// last 40 System-log errors (a Kernel-Power 41 from last month, an old service crash) were re-emitted as NEW
// detections — fix cards, desktop/email notifications and approval requests — every time the app started. Now:
//   · the FIRST tick after a fresh install is a BASELINE: it records the highest RecordId and emits nothing;
//   · the cursor is PERSISTED through an injected `cursors` hook (main: electron-store "watcherCursors"), so a
//     relaunch continues from where the last session stopped and only genuinely new events are surfaced.
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

export const EVENT_LOG_CURSOR_KEY = "event-log.lastRecordId";

// Last cursor (highest RecordId seen) so we only act on NEW events between ticks. 0 = no baseline yet.
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

/**
 * Pure cursor step. Given the rows of one tick and the cursor before it, decide what to emit and the new cursor.
 *   cursor 0 (no baseline) → baseline only: nothing emitted, cursor = highest RecordId seen.
 *   otherwise             → emit the mapped signals of rows with RecordId > cursor; cursor advances.
 */
export function advanceEventLogCursor(raw, cursor) {
  const rows = toArray(raw);
  const prev = Number(cursor) || 0;
  const maxId = rows.reduce((m, r) => Math.max(m, Number(r?.RecordId || 0)), prev);
  if (prev <= 0) return { cursor: maxId, signals: [], baseline: true };
  const fresh = rows.filter((r) => Number(r?.RecordId || 0) > prev);
  return { cursor: maxId, signals: fresh.length ? mapEventLogSignals(fresh) : [], baseline: false };
}

function readCursor(cursors) {
  try { const v = Number(cursors && typeof cursors.get === "function" ? cursors.get(EVENT_LOG_CURSOR_KEY) : 0); return Number.isFinite(v) && v > 0 ? v : 0; } catch { return 0; }
}
function writeCursor(cursors, value) {
  try { if (cursors && typeof cursors.set === "function") cursors.set(EVENT_LOG_CURSOR_KEY, value); } catch { /* persistence is best-effort */ }
}

/**
 * @param {object} deps { emit, isBlocked, cursors? }
 *   cursors — optional { get(key), set(key, value) } persistence hook (main: the electron-store "watcherCursors").
 */
export function createEventLogWatcher({ emit, isBlocked, cursors }) {
  // A persisted cursor survives relaunch; the module-level cursor keeps the in-session state (and the test seam).
  const persisted = readCursor(cursors);
  if (persisted > lastRecordId) lastRecordId = persisted;
  return {
    name: "event-log",
    cadenceMs: 60 * 1000,
    spawnsPerTick: 1,
    async tick() {
      if (isBlocked()) return;
      const raw = await runPowerShellJson(QUERY);
      if (raw == null) return;
      const step = advanceEventLogCursor(raw, lastRecordId);
      if (step.cursor !== lastRecordId) { lastRecordId = step.cursor; writeCursor(cursors, lastRecordId); }
      for (const s of step.signals) emit(s.signal, s.hint);
    },
    /** The live cursor (for diagnostics / tests). */
    cursor() { return lastRecordId; }
  };
}

// Test seam — lets the suite reset the cursor between fuzz runs.
export function __resetCursor() {
  lastRecordId = 0;
}
