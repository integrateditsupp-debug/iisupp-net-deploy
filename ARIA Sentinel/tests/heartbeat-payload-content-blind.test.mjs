// RUN 21 §5 — the heartbeat payload is content-blind: only the allowlisted meta fields, never a
// username, machine name, email, or file path.
import assert from "node:assert/strict";
import { buildHeartbeatPayload, isContentBlind, HEARTBEAT_FIELDS } from "../src/main/heartbeat.mjs";

const payload = buildHeartbeatPayload({
  licenseId: "LIC-ABC123",
  version: "0.2.0",
  lastUpdateState: "FRESH",
  startupEnabled: true,
  uptimeHours: 36,
  healthScore: 97,
  platform: "win32",
  osBuild: "10.0.26100",
  // junk that must be dropped — never transmitted:
  username: "jsmith",
  machineName: "DESK-07",
  installPath: "C:\\Users\\jsmith\\AppData\\Local\\Programs\\aria",
  secretToken: "abc"
}, "2026-07-05T10:00:00.000Z");

// Exactly the allowlisted keys — nothing else.
assert.deepEqual(Object.keys(payload).sort(), [...HEARTBEAT_FIELDS].sort());
assert.equal("username" in payload, false);
assert.equal("installPath" in payload, false);
assert.equal("secretToken" in payload, false);

// No PII anywhere in the serialized payload.
const blob = JSON.stringify(payload);
assert.doesNotMatch(blob, /jsmith/, "no username");
assert.doesNotMatch(blob, /DESK-07/, "no machine name");
assert.doesNotMatch(blob, /C:\\\\Users/i, "no file path");
assert.equal(isContentBlind(payload), true);

// Allowlisted values are preserved.
assert.equal(payload.licenseId, "LIC-ABC123");
assert.equal(payload.version, "0.2.0");
assert.equal(payload.healthScore, 97);

// 🔒 R11 — a value that references the private folder is dropped to null (never transmitted).
const hb = buildHeartbeatPayload({ licenseId: "x", version: "C:\\Users\\x\\Private pics and Vids\\v.mp4" });
assert.equal(hb.version, null, "private-folder value never leaves the device");
assert.doesNotMatch(JSON.stringify(hb), /private pics and vids/i);

console.log("Heartbeat-payload-content-blind test passed (allowlist only · no username/machine/path · R11-safe).");
