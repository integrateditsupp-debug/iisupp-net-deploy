// macOS disk-watcher — fires DISK.LOW_SPACE at < 5% free on the boot volume.
// Source: `df -h /` · cadence 5 min. Content-blind: filesystem device + mount path are read
// locally and DROPPED. Only the Capacity percentage is evaluated; only the symbolic code crosses.
import { runShell } from "./sh.mjs";

const LOW_SPACE_CAPACITY = 95; // Capacity >= 95% means < 5% free

/**
 * Pure mapper. Input: raw `df -h /` text. Output: at most one DISK.LOW_SPACE signal.
 * df output:  Filesystem  Size  Used  Avail Capacity iused ifree %iused  Mounted on
 *             /dev/disk3s1s1 466Gi 450Gi 10Gi  98%    ...                /
 * We read ONLY the Capacity column (the first NN% token) — nothing identifying.
 */
export function mapDiskSignals(text) {
  for (const line of String(text || "").trim().split(/\r?\n/)) {
    if (/Capacity/i.test(line)) continue; // skip the header row
    const match = line.match(/(\d{1,3})%/); // first NN% token on a data line = Capacity
    if (!match) continue;
    const capacity = Number(match[1]);
    if (Number.isFinite(capacity) && capacity >= LOW_SPACE_CAPACITY) {
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
      const text = await runShell("df", ["-h", "/"]);
      if (text == null) return;
      for (const s of mapDiskSignals(text)) emit(s.signal, s.hint);
    }
  };
}
