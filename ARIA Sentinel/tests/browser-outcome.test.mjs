import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  appendBrowserOutcome,
  buildBrowserOutcomeFleetPacket,
  browserOutcomeStats,
  browserOutcomeToResolutionPayload,
  isBrowserFleetPacketSafe,
  normalizeBrowserOutcome
} from "../src/shared/browser-outcome.mjs";

let normalized = normalizeBrowserOutcome({
  issueId: "BROWSER.SECURITY.SUSPICIOUS-abc123",
  signal: "browser security suspicious",
  action: "live help",
  outcome: "live_help",
  originCategory: "saas",
  severity: "danger",
  url: "https://user:secret@example.com/private",
  title: "Private customer page"
}, { now: 1000 });

assert.equal(normalized.ok, true, "valid browser outcome normalizes");
assert.equal(normalized.record.issueId, "BROWSER.SECURITY.SUSPICIOUS-abc123");
assert.equal(normalized.record.signal, "BROWSER.SECURITY.SUSPICIOUS");
assert.equal(normalized.record.action, "live-help");
assert.equal(normalized.record.outcome, "live_help");
assert.equal(normalized.record.originCategory, "saas");
assert.equal(normalized.record.severity, "danger");
assert.equal(normalized.record.ts, 1000);
assert.equal("url" in normalized.record, false, "URL is never retained");
assert.equal("title" in normalized.record, false, "page title is never retained");

let appended = appendBrowserOutcome([], normalized.record, { now: 2000 });
assert.equal(appended.ok, true);
assert.equal(appended.events.length, 1);
let deduped = appendBrowserOutcome(appended.events, normalized.record, { now: 3000 });
assert.equal(deduped.deduped, true, "same issue/outcome/action is deduped");
assert.equal(deduped.events.length, 1);

const failed = normalizeBrowserOutcome({ issueId: "x", outcome: "totally fixed maybe", originCategory: "raw-hostname" });
assert.equal(failed.record.outcome, "failed", "unknown outcomes fail closed");
assert.equal(failed.record.originCategory, "unknown", "raw origin detail is not retained");

assert.deepEqual(browserOutcomeToResolutionPayload({ issueId: "r1", outcome: "resolved" }), {
  id: "browser:r1",
  outcome: "resolved",
  confidence: { level: "browser-extension" }
});
assert.deepEqual(browserOutcomeToResolutionPayload({ issueId: "r2", outcome: "failed" }), {
  id: "browser:r2:failed",
  outcome: "not_resolved",
  confidence: { level: "browser-extension" }
});
assert.deepEqual(browserOutcomeToResolutionPayload({ issueId: "r3", outcome: "live_help" }), {
  id: "browser:r3:live-help",
  outcome: "escalated",
  confidence: { level: "browser-extension" }
});
assert.equal(browserOutcomeToResolutionPayload({ issueId: "r4", outcome: "walkthrough" }), null, "walkthrough is logged but not counted as resolved proof");
assert.equal(browserOutcomeToResolutionPayload({ issueId: "r5", outcome: "dismissed" }), null, "dismiss is logged but not counted as resolved proof");

const fleetEvents = [
  normalized.record,
  {
    issueId: "https://secret.example.com/customer/acme?token=abc",
    signal: "browser cache stale",
    action: "clear and reload",
    outcome: "resolved",
    originCategory: "public",
    severity: "notice",
    ts: "2026-07-07T00:00:00.000Z",
    title: "Private customer page for owner@example.com"
  },
  {
    issueId: "4111111111111111",
    signal: "browser cache stale",
    action: "clear and reload",
    outcome: "failed",
    originCategory: "raw.hostname.example.com",
    severity: "warning",
    ts: 2000,
    url: "https://owner@example.com/private"
  },
  { outcome: "resolved" }
];
const stats = browserOutcomeStats(fleetEvents, { now: 3000 });
assert.equal(stats.counts.total, 3, "invalid browser outcomes are ignored in fleet stats");
assert.equal(stats.counts.resolved, 1);
assert.equal(stats.counts.failed, 1);
assert.equal(stats.counts.live_help, 1);
assert.equal(stats.bySignal[0].signal, "BROWSER.CACHE.STALE");
assert.equal(stats.bySignal[0].total, 2);
assert.equal(stats.byOriginCategory.find((row) => row.originCategory === "unknown").total, 1);
const statsText = JSON.stringify(stats);
assert.equal(stats.events[0].issueHandle.startsWith("ep-"), true, "stats expose issue handles, not raw issue IDs");
assert.equal(statsText.includes("https://"), false, "stats never leak URLs");
assert.equal(statsText.includes("owner@example.com"), false, "stats never leak emails");
assert.equal(statsText.includes("secret.example.com"), false, "stats never leak raw domains from issue IDs");
assert.equal(statsText.includes("4111111111111111"), false, "stats never leak raw long numeric IDs");

const packet = buildBrowserOutcomeFleetPacket(fleetEvents, {
  now: Date.parse("2026-07-07T00:03:00.000Z"),
  endpointSeed: "do-not-leak-real-machine-name",
  maxRecent: 2
});
const packetText = JSON.stringify(packet);
assert.equal(packet.v, "browser-outcome-fleet-v1");
assert.equal(packet.endpoint.startsWith("ep-"), true, "fleet packet uses an endpoint handle");
assert.equal(packet.counts.total, 3);
assert.equal(packet.recent.length, 2, "recent fleet proof is capped");
assert.equal(packet.recent[0].issueHandle.startsWith("ep-"), true, "issue IDs are converted to handles");
assert.equal(packet.recent[0].ts.includes("T"), true, "recent timestamps are ISO strings");
assert.equal(isBrowserFleetPacketSafe(packet), true, "fleet packet passes the content-safe boundary");
assert.equal(packetText.includes("https://"), false, "fleet packet never leaks URLs");
assert.equal(packetText.includes("owner@example.com"), false, "fleet packet never leaks emails");
assert.equal(packetText.includes("Private customer"), false, "fleet packet never leaks page titles");
assert.equal(packetText.includes("4111111111111111"), false, "fleet packet never leaks raw long numeric IDs");
assert.equal(/\b\d{13,19}\b/.test(packetText), false, "fleet packet never emits epoch-ms or card-length digit runs");

const missingId = normalizeBrowserOutcome({ outcome: "resolved" });
assert.equal(missingId.ok, false);
assert.ok(missingId.errors.includes("issueId-required"));

const main = fs.readFileSync(path.resolve("src/main/main.mjs"), "utf8");
assert.match(main, /"\/browser-outcome"/, "local bridge exposes browser-outcome endpoint");
assert.match(main, /"\/browser-outcomes\/fleet-packet"/, "local bridge exposes content-blind fleet packet endpoint");
assert.match(main, /recordBrowserOutcome/, "browser outcome endpoint writes through recordBrowserOutcome");
assert.match(main, /browserOutcomes/, "browser outcomes are stored separately from proof metrics");

console.log("Browser-outcome bridge test passed (content-blind normalization · dedupe · proof mapping · bridge wiring).");
