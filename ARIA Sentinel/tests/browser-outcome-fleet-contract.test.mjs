// browser-outcome-fleet-contract — CLIENT CONTRACT lock for buildBrowserOutcomeFleetPacket().
//
// Freezes the fleet-packet SHAPE so a future change that would leak content or drift the schema
// FAILS loudly. This is a contract test only: no network, no new endpoint, no wiring. If a field
// is added/removed/renamed here, that is a deliberate contract change and this test must be updated
// with intent — it is the tripwire, not a rubber stamp.
import assert from "node:assert/strict";
import {
  BROWSER_FLEET_PACKET_VERSION,
  buildBrowserOutcomeFleetPacket,
  isBrowserFleetPacketSafe
} from "../src/shared/browser-outcome.mjs";

// The complete set of keys allowed at each level of the packet. Anything outside these sets is drift.
const PACKET_KEYS = ["v", "source", "endpoint", "generatedAt", "window", "counts", "bySignal", "byOriginCategory", "recent"];
const WINDOW_KEYS = ["from", "to"];
const RECENT_KEYS = ["issueHandle", "signal", "action", "outcome", "originCategory", "severity", "ts"];
// counts + bySignal/byOriginCategory buckets carry an outcome enum plus a total.
const COUNT_KEYS = ["total", "resolved", "failed", "walkthrough", "live_help", "dismissed"];
const SIGNAL_BUCKET_KEYS = ["signal", ...COUNT_KEYS];
const ORIGIN_BUCKET_KEYS = ["originCategory", ...COUNT_KEYS];

function assertKeys(obj, allowed, where) {
  const actual = Object.keys(obj);
  for (const k of actual) assert.ok(allowed.includes(k), `DRIFT: unexpected key "${k}" at ${where}`);
}

// Dirty inputs: every field is a content-shaped landmine (URL, email, raw domain, long numeric id,
// epoch-ms ts, path). The contract requires NONE of it to survive into the packet.
const dirty = [
  {
    issueId: "https://user:secret@internal.acme.com/private?token=deadbeef",
    signal: "browser security malicious",
    action: "warn and escalate",
    outcome: "live_help",
    originCategory: "sso",
    severity: "danger",
    ts: 1783399951730, // epoch-ms landmine
    url: "https://phish.example.com/login",
    title: "owner@example.com mailbox"
  },
  {
    issueId: "4111111111111111", // card-length numeric id
    signal: "browser cache stale",
    action: "clear and reload",
    outcome: "resolved",
    originCategory: "raw.hostname.example.com",
    severity: "notice",
    ts: "2026-07-07T00:00:00.000Z",
    path: "C:\\Users\\ahmad\\secret.txt"
  },
  { outcome: "resolved" } // malformed (no issueId) — must be dropped, not counted
];

const packet = buildBrowserOutcomeFleetPacket(dirty, {
  now: Date.parse("2026-07-07T00:05:00.000Z"),
  endpointSeed: "do-not-leak-real-machine-name",
  maxRecent: 5
});

// ---- shape lock: only the allowed keys appear, nothing more ----------------------------------
assertKeys(packet, PACKET_KEYS, "packet");
assert.equal(packet.v, BROWSER_FLEET_PACKET_VERSION, "version tag is pinned");
assert.equal(packet.source, "browser-extension");
assert.equal(typeof packet.endpoint, "string");
assert.equal(packet.endpoint.startsWith("ep-"), true, "endpoint is an opaque handle");
assert.equal(packet.generatedAt.includes("T"), true, "generatedAt is an ISO string");
assertKeys(packet.window, WINDOW_KEYS, "packet.window");
assertKeys(packet.counts, COUNT_KEYS, "packet.counts");
for (const bucket of packet.bySignal) assertKeys(bucket, SIGNAL_BUCKET_KEYS, "packet.bySignal[]");
for (const bucket of packet.byOriginCategory) assertKeys(bucket, ORIGIN_BUCKET_KEYS, "packet.byOriginCategory[]");
assert.ok(Array.isArray(packet.recent), "recent is an array");
for (const item of packet.recent) {
  assertKeys(item, RECENT_KEYS, "packet.recent[]");
  assert.equal(item.issueHandle.startsWith("ep-"), true, "recent uses issue handles, not raw ids");
  assert.equal(item.ts.includes("T"), true, "recent ts is an ISO string, never epoch-ms");
}

// malformed record dropped -> only the two valid dirty rows are counted
assert.equal(packet.counts.total, 2, "malformed (no issueId) record is dropped from the packet");

// ---- privacy lock: NONE of the content-shaped landmines survive ------------------------------
const text = JSON.stringify(packet);
assert.equal(text.includes("https://"), false, "CONTRACT: packet must never contain a URL");
assert.equal(text.includes("owner@example.com"), false, "CONTRACT: packet must never contain an email");
assert.equal(text.includes("internal.acme.com"), false, "CONTRACT: packet must never contain a raw domain");
assert.equal(text.includes("phish.example.com"), false, "CONTRACT: packet must never contain a raw domain");
assert.equal(text.includes("4111111111111111"), false, "CONTRACT: packet must never contain a raw long numeric id");
assert.equal(text.toLowerCase().includes("secret.txt"), false, "CONTRACT: packet must never contain a file path");
assert.equal(text.includes("ahmad"), false, "CONTRACT: packet must never contain a path username");
assert.equal(/\b\d{13,19}\b/.test(text), false, "CONTRACT: packet must never emit epoch-ms or card-length digit runs");
assert.equal(/\b[a-z]:\\/i.test(text), false, "CONTRACT: packet must never contain a Windows path");
assert.equal(isBrowserFleetPacketSafe(packet), true, "packet passes the content-safe boundary guard");

// ---- empty-safe: an empty ledger still yields a well-formed, content-blind packet ------------
const empty = buildBrowserOutcomeFleetPacket([], { now: Date.parse("2026-07-07T00:05:00.000Z") });
assertKeys(empty, PACKET_KEYS, "empty packet");
assert.equal(empty.counts.total, 0);
assert.equal(empty.recent.length, 0);
assert.equal(empty.window.from, "", "empty window has no timestamps");
assert.equal(isBrowserFleetPacketSafe(empty), true, "empty packet is still content-safe");

console.log("browser-outcome fleet-contract test passed (shape pinned: 9 packet keys · window/counts/bucket/recent key sets locked · handles+ISO only · malformed dropped · URL/email/domain/path/epoch-ms/raw-id all rejected · empty-safe).");
