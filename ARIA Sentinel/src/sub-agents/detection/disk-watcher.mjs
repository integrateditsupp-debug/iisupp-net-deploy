// disk-watcher — fires DISK.LOW_SPACE at < 5% free on a fixed (local) disk.
// Source: Get-CimInstance Win32_LogicalDisk · cadence 5 min.
// Content-blind: drive letters / volume names are read locally and DROPPED.
// Only the symbolic code + an enum hint cross detectIssue().
import { runPowerShellJson, toArray } from "./ps.mjs";

const LOW_SPACE_RATIO = 0.05; // < 5% free
const QUERY =
  "Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | " +
  "Select-Object Size,FreeSpace | ConvertTo-Json -Compress";

/**
 * Pure mapper. Input: raw Win32_LogicalDisk rows (objects). Output: deduped signals.
 * Returns at most one DISK.LOW_SPACE signal regardless of how many volumes are low —
 * the user sees one calm signal, not one per partition.
 */
export function mapDiskSignals(raw) {
  for (const row of toArray(raw)) {
    const size = Number(row?.Size || 0);
    const free = Number(row?.FreeSpace || 0);
    if (size > 0 && free >= 0 && free / size < LOW_SPACE_RATIO) {
      return [{ signal: "DISK.LOW_SPACE", hint: "disk-low-space" }];
    }
  }
  return [];
}

export function createDiskWatcher({ emit, isBlocked }) {
  return {
    name: "disk",
    cadenceMs: 5 * 60 * 1000,
    async tick() {
      if (isBlocked()) return;
      const raw = await runPowerShellJson(QUERY);
      if (raw == null) return;
      for (const s of mapDiskSignals(raw)) emit(s.signal, s.hint);
    }
  };
}
