// D6 (2026-07-03) — System → This Machine disk row must show REAL usage (was "usage not reported"). The
// hardware query now also reads the system-drive Win32_LogicalDisk volume (Size + FreeSpace); buildDiskSummary
// merges it into a { model, status, size, freeSpace, percentUsed } shape the renderer turns into "% used".
import assert from "node:assert/strict";
import { buildDiskSummary, buildSystemContext } from "../src/main/system-context.mjs";

let n = 0; const t = () => { n++; };

// 1 — with a system volume (256 GB, 64 GB free) → real percentUsed, model/status carried from the physical drive.
const d = buildDiskSummary({
  disks: [{ Model: "Samsung SSD 980", Size: 256060514304, Status: "OK" }],
  systemVolume: { DeviceID: "C:", Size: 255013380096, FreeSpace: 63753345024 }
});
assert.equal(d.percentUsed, 75, "256GB with 64GB free → 75% used");
assert.equal(d.model, "Samsung SSD 980");
assert.equal(d.status, "OK");
assert.equal(d.deviceId, "C:");
assert.ok(d.size > 0 && d.freeSpace > 0, "size + free carried for the free-GB label");
t();

// 2 — no system volume (only the physical drive, no free space) → falls back to the physical object (honest,
// no fabricated percentage). The renderer then shows the model rather than a made-up usage.
const d2 = buildDiskSummary({ disks: [{ Model: "WD Blue", Size: 500000000000, Status: "OK" }] });
assert.equal(d2.percentUsed, undefined, "no free space → no invented percentUsed");
assert.equal(d2.Model || d2.model, "WD Blue");
t();

// 3 — nothing at all → null (never throws).
assert.equal(buildDiskSummary({}), null, "no disk data → null");
t();

// 4 — full context wires disk through with real usage.
const ctx = buildSystemContext({
  cpu: { model: "x" }, ram: { percentUsed: 40 },
  disks: [{ Model: "NVMe", Size: 1000000000000, Status: "OK" }],
  systemVolume: { DeviceID: "C:", Size: 1000000000000, FreeSpace: 250000000000 }
}, "2026-07-03T00:00:00.000Z");
assert.equal(ctx.disk.percentUsed, 75, "context disk carries real usage");
t();

assert.equal(n, 4, "4 D6 disk-usage test groups");
console.log(`disk-usage test passed (${n} groups · real % used from system volume · honest fallback · null-safe · context wiring).`);
