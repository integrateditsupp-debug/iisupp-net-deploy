// crash-control-watcher — fires BSOD.<STOP_CODE> on a NEW minidump.
// Sources: HKLM\SYSTEM\CurrentControlSet\Control\CrashControl + C:\Windows\Minidump\*.dmp
//          + the most recent BugCheck stop-code string from the System log.
// Cadence: at startup + every 5 min.
// Content-blind: the .dmp file itself is NEVER read or uploaded. We surface only the
// symbolic stop code (resolved through the shared STOP_CODE_MAP) and the dump count.
import { runPowerShellJson, toArray } from "./ps.mjs";
import { sanitizeToSignature } from "../../shared/safety.mjs";

// Reads dump filenames (count + newest timestamp only) and the latest bugcheck code.
const QUERY =
  "$d=Get-ChildItem 'C:\\Windows\\Minidump\\*.dmp' -ErrorAction SilentlyContinue; " +
  "$b=Get-WinEvent -FilterHashtable @{LogName='System';ProviderName='Microsoft-Windows-WER-SystemErrorReporting';Id=1001} " +
  "-MaxEvents 1 -ErrorAction SilentlyContinue; " +
  "[pscustomobject]@{dumpCount=@($d).Count;newest=(@($d)|Sort-Object LastWriteTime -Descending|Select-Object -First 1).LastWriteTime;" +
  "stopCode=($b.Properties[1].Value)} | ConvertTo-Json -Compress";

let lastDumpCount = -1; // -1 = uninitialised, so the first real reading sets the baseline

/**
 * Pure mapper. Decides whether a NEW crash has appeared since the last reading and,
 * if so, resolves the symbolic BSOD code. `prevCount` carries state between ticks.
 * The stop-code string is run through sanitizeToSignature so only an allow-listed
 * symbolic code can ever come out — arbitrary text collapses to BSOD.UNKNOWN.
 */
export function mapCrashControl(raw, prevCount) {
  const row = toArray(raw)[0] || raw || {};
  const dumpCount = Number(row?.dumpCount || 0);
  const result = { count: dumpCount, signals: [] };
  // No baseline yet, or no new dump → nothing to report.
  if (prevCount < 0 || dumpCount <= prevCount) return result;

  const sig = sanitizeToSignature({ signal: row?.stopCode, issue: row?.stopCode });
  const code = sig.family === "BSOD" ? sig.code : "BSOD.UNKNOWN";
  result.signals.push({ signal: code, hint: "minidump-created" });
  return result;
}

export function createCrashControlWatcher({ emit, isBlocked }) {
  return {
    name: "crash-control",
    cadenceMs: 5 * 60 * 1000,
    runAtStartup: true,
    async tick() {
      if (isBlocked()) return;
      const raw = await runPowerShellJson(QUERY);
      if (raw == null) return;
      const { count, signals } = mapCrashControl(raw, lastDumpCount);
      lastDumpCount = count;
      for (const s of signals) emit(s.signal, s.hint);
    }
  };
}

export function __resetBaseline() {
  lastDumpCount = -1;
}
