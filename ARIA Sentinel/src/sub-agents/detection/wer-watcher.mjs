// wer-watcher — maps Windows Error Reporting archives to known app signals.
// Source: C:\ProgramData\Microsoft\Windows\WER\ReportArchive\*\*.wer · cadence 60s.
// Content-blind: a .wer report contains the faulting app name plus paths/module data.
// We read ONLY the AppName key (plus the report file's write time, a number), normalise
// it against a fixed table, and DROP everything else. Unknown apps are dropped entirely
// (no generic crash signal, to avoid noise).
//
// PROD 2026-10-14 (audit M6) — NO FIRST-LAUNCH FALSE ALARMS. The watcher used to emit every known app found in
// the 20 newest archives at EVERY launch (an old chrome.exe crash → a fresh "Browser tab crash loop" card, a
// notification and an approval request, every start). Now:
//   · the FIRST tick after a fresh install is a BASELINE: it records the newest report time and emits nothing;
//   · later ticks emit only for reports NEWER than the cursor (one signal per app per tick), and the cursor is
//     PERSISTED through the injected `cursors` hook so a relaunch continues from the last session.
import { runPowerShellJson, toArray } from "./ps.mjs";

// Faulting executable (lowercased) -> existing recipe signal.
const APP_MAP = {
  "outlook.exe": { signal: "APP.OUTLOOK.OST_CORRUPT", hint: "outlook-faulted" },
  "teams.exe": { signal: "TEAMS.STUCK", hint: "teams-faulted" },
  "ms-teams.exe": { signal: "TEAMS.STUCK", hint: "teams-faulted" },
  "onedrive.exe": { signal: "APP.ONEDRIVE.SYNC_STUCK", hint: "onedrive-faulted" },
  "chrome.exe": { signal: "BROWSER.TAB_CRASH_LOOP", hint: "browser-faulted" },
  "msedge.exe": { signal: "BROWSER.TAB_CRASH_LOOP", hint: "browser-faulted" },
  "explorer.exe": { signal: "SYSTEM.SHELL.CRASHED", hint: "shell-faulted" }
};

export const WER_CURSOR_KEY = "wer.lastReportTicks";

// Reads the AppName line + the report's write time (UTC ticks, a number) out of recent .wer files without
// exposing their contents up the stack.
const QUERY =
  "Get-ChildItem 'C:\\ProgramData\\Microsoft\\Windows\\WER\\ReportArchive\\*\\*.wer' -ErrorAction SilentlyContinue | " +
  "Sort-Object LastWriteTime -Descending | Select-Object -First 20 | " +
  "ForEach-Object { $n=(Select-String -Path $_.FullName -Pattern '^AppName=' -ErrorAction SilentlyContinue | " +
  "Select-Object -First 1).Line; if($n){ [pscustomobject]@{app=($n -replace '^AppName=','');ts=[long]$_.LastWriteTimeUtc.Ticks} } } | ConvertTo-Json -Compress";

let seenApps = new Set(); // signals emitted this session (diagnostic; the ts cursor is the de-dupe now)
let lastTicks = 0;        // persisted cursor: newest report time seen (0 = no baseline yet)

/** Normalise one raw row (a bare AppName string, or { app, ts }) into { app, ts }. */
function rowOf(value) {
  if (value && typeof value === "object") return { app: String(value.app || value.AppName || "").trim().toLowerCase(), ts: Number(value.ts) || 0 };
  return { app: String(value || "").trim().toLowerCase(), ts: 0 };
}

/** Pure mapper. Input: array of AppName strings (or {app,ts} rows). Output: known-app signals only. */
export function mapWerSignals(raw) {
  const out = [];
  const seen = new Set();
  for (const value of toArray(raw)) {
    const { app } = rowOf(value);
    const mapped = APP_MAP[app];
    if (mapped && !seen.has(mapped.signal)) {
      seen.add(mapped.signal);
      out.push({ signal: mapped.signal, hint: mapped.hint });
    }
  }
  return out;
}

/**
 * Pure cursor step over timestamped rows.
 *   cursor 0 (no baseline) → baseline only: nothing emitted, cursor = newest ts seen.
 *   otherwise             → emit the mapped signals of rows with ts > cursor; cursor advances.
 * Rows without a timestamp (legacy string form) are treated as "new" only when there is no cursor logic to apply,
 * i.e. never on a baseline tick — a report with no time cannot be proven newer than the baseline.
 */
export function advanceWerCursor(raw, cursor) {
  const rows = toArray(raw).map(rowOf);
  const prev = Number(cursor) || 0;
  const maxTs = rows.reduce((m, r) => Math.max(m, r.ts), prev);
  if (prev <= 0) return { cursor: maxTs, signals: [], baseline: true };
  const fresh = rows.filter((r) => r.ts > prev);
  return { cursor: maxTs, signals: mapWerSignals(fresh), baseline: false };
}

function readCursor(cursors) {
  try { const v = Number(cursors && typeof cursors.get === "function" ? cursors.get(WER_CURSOR_KEY) : 0); return Number.isFinite(v) && v > 0 ? v : 0; } catch { return 0; }
}
function writeCursor(cursors, value) {
  try { if (cursors && typeof cursors.set === "function") cursors.set(WER_CURSOR_KEY, value); } catch { /* best-effort */ }
}

export function createWerWatcher({ emit, isBlocked, cursors }) {
  const persisted = readCursor(cursors);
  if (persisted > lastTicks) lastTicks = persisted;
  return {
    name: "wer",
    cadenceMs: 60 * 1000,
    spawnsPerTick: 1,
    async tick() {
      if (isBlocked()) return;
      const raw = await runPowerShellJson(QUERY);
      if (raw == null) return;
      const step = advanceWerCursor(raw, lastTicks);
      if (step.cursor !== lastTicks) { lastTicks = step.cursor; writeCursor(cursors, lastTicks); }
      // The timestamp cursor already guarantees a lingering report never re-fires; a NEW report of the same app
      // (ts above the cursor) is a real repeat crash and is emitted again (the orchestrator debounces per signal).
      for (const s of step.signals) { seenApps.add(s.signal); emit(s.signal, s.hint); }
    },
    cursor() { return lastTicks; }
  };
}

export function __resetSeen() {
  seenApps = new Set();
  lastTicks = 0;
}
