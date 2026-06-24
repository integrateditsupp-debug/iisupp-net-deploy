// wer-watcher — maps Windows Error Reporting archives to known app signals.
// Source: C:\ProgramData\Microsoft\Windows\WER\ReportArchive\*\*.wer · cadence 60s.
// Content-blind: a .wer report contains the faulting app name plus paths/module data.
// We read ONLY the AppName key, normalise it against a fixed table, and DROP everything
// else. Unknown apps are dropped entirely (no generic crash signal, to avoid noise).
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

// Reads the AppName line out of recent .wer files without exposing their contents up the stack.
const QUERY =
  "Get-ChildItem 'C:\\ProgramData\\Microsoft\\Windows\\WER\\ReportArchive\\*\\*.wer' -ErrorAction SilentlyContinue | " +
  "Sort-Object LastWriteTime -Descending | Select-Object -First 20 | " +
  "ForEach-Object { $n=(Select-String -Path $_.FullName -Pattern '^AppName=' -ErrorAction SilentlyContinue | " +
  "Select-Object -First 1).Line; if($n){ ($n -replace '^AppName=','') } } | ConvertTo-Json -Compress";

let seenApps = new Set(); // de-dupe so a lingering report doesn't re-fire every minute

/** Pure mapper. Input: array of AppName strings. Output: known-app signals only. */
export function mapWerSignals(raw) {
  const out = [];
  const seen = new Set();
  for (const value of toArray(raw)) {
    const app = String(value || "").trim().toLowerCase();
    const mapped = APP_MAP[app];
    if (mapped && !seen.has(mapped.signal)) {
      seen.add(mapped.signal);
      out.push({ signal: mapped.signal, hint: mapped.hint });
    }
  }
  return out;
}

export function createWerWatcher({ emit, isBlocked }) {
  return {
    name: "wer",
    cadenceMs: 60 * 1000,
    async tick() {
      if (isBlocked()) return;
      const raw = await runPowerShellJson(QUERY);
      if (raw == null) return;
      for (const s of mapWerSignals(raw)) {
        if (seenApps.has(s.signal)) continue;
        seenApps.add(s.signal);
        emit(s.signal, s.hint);
      }
    }
  };
}

export function __resetSeen() {
  seenApps = new Set();
}
