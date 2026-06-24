// RUN 14 — device registration is idempotent (re-register updates last_seen/version in place).
import assert from "node:assert/strict";
import { registerDevice } from "../src/shared/license-registry.mjs";

// First registration seeds a record from the device payload.
let rec = registerDevice(null, {
  license_key: "AAA", email: "john@acme.com", company: "Acme", device_id: "dev-1", os: "win32-x64", version: "0.1.0", last_seen: "2026-06-19T22:00:00.000Z"
});
assert.equal(rec.license_key, "AAA");
assert.equal(rec.devices.length, 1);
assert.equal(rec.devices[0].version, "0.1.0");

// Re-register the SAME device → updates in place (no duplicate), new last_seen + version.
rec = registerDevice(rec, { device_id: "dev-1", os: "win32-x64", version: "0.1.1", last_seen: "2026-06-20T02:00:00.000Z" });
assert.equal(rec.devices.length, 1, "same device_id updates in place");
assert.equal(rec.devices[0].version, "0.1.1");
assert.equal(rec.devices[0].last_seen, "2026-06-20T02:00:00.000Z");

// A different device appends.
rec = registerDevice(rec, { device_id: "dev-2", os: "win32-x64", version: "0.1.1", last_seen: "2026-06-20T03:00:00.000Z" });
assert.equal(rec.devices.length, 2);

// version_pin is preserved across re-registration (rollback survives check-in).
rec = { ...rec, version_pin: "0.1.0" };
rec = registerDevice(rec, { device_id: "dev-1", version: "0.1.2", last_seen: "2026-06-20T04:00:00.000Z" });
assert.equal(rec.version_pin, "0.1.0", "pin survives device check-in");

console.log("License-register test passed (seed · idempotent upsert · append · pin preserved).");
