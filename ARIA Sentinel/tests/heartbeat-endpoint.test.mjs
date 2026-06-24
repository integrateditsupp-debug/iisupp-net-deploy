// RUN 21 §6 — heartbeat endpoint logic: validates the license, returns the latest live version +
// mandatory flag, logs to the heartbeats store (handler wiring verified by source).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { heartbeatResponse, latestLiveVersion, sanitizeHeartbeatRecord, heartbeatStoreKey } from "../src/shared/heartbeat-server.mjs";
import { HEARTBEAT_FIELDS } from "../src/main/heartbeat.mjs";

const versions = [
  { version: "0.3.0", disabled: false, mandatory: true },
  { version: "0.2.0", disabled: false },
  { version: "0.4.0", disabled: true } // disabled → never "latest"
];
assert.equal(latestLiveVersion(versions).version, "0.3.0", "latest non-disabled version");

// Valid license → response carries the latest version + mandatory flag.
const ok = heartbeatResponse({ licenseRecord: { license_key: "LIC-1" }, versions, mandatory: true, now: Date.parse("2026-07-05T00:00:00Z") });
assert.equal(ok.ok, true);
assert.equal(ok.valid, true);
assert.equal(ok.latestVersion, "0.3.0");
assert.equal(ok.mandatoryUpdate, true);
assert.equal(ok.nextCheckIn, 24 * 60 * 60);

// Unknown license → still 200, valid:false, grace advisory.
const grace = heartbeatResponse({ licenseRecord: null, versions, mandatory: false });
assert.equal(grace.valid, false);
assert.match(grace.advisoryMessage, /trial|grace/i);

// The server only ever stores the allowlisted fields.
const rec = sanitizeHeartbeatRecord({ licenseId: "L", version: "0.2.0", username: "bob", junk: 1 });
assert.deepEqual(Object.keys(rec).sort(), [...HEARTBEAT_FIELDS].sort());
assert.equal("username" in rec, false);

// Storage key: per-license per-day (date prefix → natural 30d retention), sanitized id.
const key = heartbeatStoreKey("LIC-1!!", Date.parse("2026-07-05T10:00:00Z"));
assert.match(key, /^2026-07-05\/LIC-1$/, "date/license key");

// The Netlify handler wires getStore + the pure logic + logs to the heartbeats store.
const handler = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "netlify", "functions", "aria-sentinel-heartbeat.js"), "utf8");
assert.match(handler, /@netlify\/blobs/, "uses Netlify Blobs");
assert.match(handler, /heartbeatResponse\(/, "uses the pure response builder");
assert.match(handler, /getStore\("heartbeats"\)/, "logs to the heartbeats store");
assert.match(handler, /getStore\("licenses"\)/, "validates against the licenses store");
assert.match(handler, /sanitizeHeartbeatRecord\(/, "stores only the sanitized record");

console.log("Heartbeat-endpoint test passed (license validate · latest version · mandatory flag · content-blind log).");
