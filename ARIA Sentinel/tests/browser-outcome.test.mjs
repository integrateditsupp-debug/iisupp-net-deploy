import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  appendBrowserOutcome,
  buildBrowserOutcomeFleetPacket,
  browserOutcomeStats,
  browserOutcomeToResolutionPayload,
  isBrowserFleetPacketSafe,
  normalizeBrowserOutcome,
  browserIdHandle,
  BROWSER_SIGNAL_VOCABULARY,
  BROWSER_ACTION_VOCABULARY,
  BROWSER_FLEET_PACKET_VERSION
} from "../src/shared/browser-outcome.mjs";
import { RECIPES } from "../src/shared/recipes.mjs";

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
// 2026-10-14 (review P2-7) — EXPECTATION CHANGED ON PURPOSE: an id that is not a bare [a-z0-9-]{1,32} token (this one has
// capitals and dots) is kept only as sha256(id).slice(0,16) — a stable handle, never the caller's text.
assert.equal(normalized.record.issueId, browserIdHandle("BROWSER.SECURITY.SUSPICIOUS-abc123"));
assert.match(normalized.record.issueId, /^[0-9a-f]{16}$/);
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

// ── REVIEW P2-7 — the reviewer's inputs: a bank URL as the issue id AND the signal, a document path as the action ──────
{
  const evil = { issueId: "https://mybank.example.com/acct/123", signal: "https://mybank.example.com/acct?user=jane.doe", action: "C:\\Users\\jane.doe\\Documents\\payroll.xlsx", outcome: "resolved", severity: "jane_doe", originCategory: "mybank.example.com" };
  const r = normalizeBrowserOutcome(evil, { now: 5000 });
  assert.equal(r.ok, true);
  assert.equal(r.record.signal, "UNKNOWN.SIGNAL", "a URL is not a signal — it is dropped to UNKNOWN.SIGNAL");
  assert.equal(r.record.action, "other", "a path is not an action — it is dropped to 'other'");
  assert.equal(r.record.severity, "notice", "free text is not a severity");
  assert.match(r.record.issueId, /^[0-9a-f]{16}$/, "the URL id becomes a 16-hex handle");
  assert.equal(r.record.issueId, browserIdHandle(evil.issueId), "…stable for the same id");
  const txt = JSON.stringify(r.record).toLowerCase();
  for (const leak of ["mybank", "example.com", "jane", "doe", "payroll", "users", "documents", "acct", "xlsx", "https"]) assert.ok(!txt.includes(leak), `the record never carries "${leak}"`);
  const p = buildBrowserOutcomeFleetPacket([r.record], { now: 6000 });
  assert.equal(isBrowserFleetPacketSafe(p), true, "the packet built from the cleaned record is safe");
  assert.ok(!/mybank|jane|payroll/i.test(JSON.stringify(p)), "…and carries none of it");
  // the boundary check refuses a packet that carries the reviewer's strings (built by hand, past the normalizer)
  const forged = { v: BROWSER_FLEET_PACKET_VERSION, source: "browser-extension", endpoint: null, generatedAt: "2026-10-14T00:00:00.000Z", window: { from: "2026-10-14T00:00:00.000Z", to: "2026-10-14T00:00:00.000Z" }, counts: { total: 1 }, bySignal: [], byOriginCategory: [],
    recent: [{ issueHandle: "ep-0uyug7k", signal: "HTTPS.MYBANK.EXAMPLE.COM.ACCT.USER.JANE.DOE", action: "c-users-jane.doe-documents-payroll.xlsx", outcome: "resolved", originCategory: "unknown", severity: "notice", ts: "2026-10-15T00:08:51.555Z" }] };
  assert.equal(isBrowserFleetPacketSafe(forged), false, "a free-text signal + a path-shaped action are refused at the boundary");
  assert.equal(isBrowserFleetPacketSafe({ ...forged, recent: [{ ...forged.recent[0], signal: "BROWSER.CACHE.STALE" }] }), false, "the path-shaped action alone is refused");
  assert.equal(isBrowserFleetPacketSafe({ ...forged, recent: [{ ...forged.recent[0], action: "hard-reload" }] }), false, "the URL-shaped signal alone is refused");
  assert.equal(isBrowserFleetPacketSafe({ ...forged, recent: [{ ...forged.recent[0], signal: "BROWSER.CACHE.STALE", action: "hard-reload" }] }), true, "control: vocabulary values pass");
  assert.equal(isBrowserFleetPacketSafe({ ...forged, recent: [{ ...forged.recent[0], signal: "BROWSER.CACHE.STALE", action: "hard-reload", issueHandle: "jane.doe" }] }), false, "a raw id instead of a handle is refused");
  assert.equal(isBrowserFleetPacketSafe({ ...forged, bySignal: [{ signal: "JANE.DOE", total: 1 }], recent: [] }), false, "a free-text bucket is refused");
  // ids: a bare token stays; dots / slashes / '@' / capitals / long ones are hashed
  assert.equal(browserIdHandle("issue-42"), "issue-42");
  for (const bad of ["jane.doe", "a/b", "owner@example.com", "Issue42", "x".repeat(33), "c:\\users\\jane"]) assert.match(browserIdHandle(bad), /^[0-9a-f]{16}$/, `${bad} is hashed`);
  // the vocabularies stay in step with the recipe registry
  for (const r2 of RECIPES.filter((x) => /^BROWSER\./.test(x.signal))) {
    assert.ok(BROWSER_SIGNAL_VOCABULARY.includes(r2.signal), `${r2.signal} is in the browser signal vocabulary`);
    for (const a of r2.actions || []) assert.ok(BROWSER_ACTION_VOCABULARY.includes(a.id), `${r2.id}/${a.id} is in the browser action vocabulary`);
  }
}

const missingId = normalizeBrowserOutcome({ outcome: "resolved" });
assert.equal(missingId.ok, false);
assert.ok(missingId.errors.includes("issueId-required"));

// JULY PORT 2026-10-14 — resolved from this file, not the cwd, so the suite is green from any working directory.
const main = fs.readFileSync(path.resolve(import.meta.dirname, "..", "src", "main", "main.mjs"), "utf8");
assert.doesNotMatch(main, /evaluateMaliciousSite|deploymentPolicyToEvaluator|browserPolicyStateNow/, "the July decision-only browser policy evaluator is NOT ported (out of scope)");
assert.match(main, /browserOutcomeToResolutionPayload\(res\.record\)/, "resolved / failed / live-help feed the real deflection ledger");
assert.match(main, /logEvent\("BROWSER", `Browser issue \$\{res\.record\.signal\} marked \$\{res\.record\.outcome\}\.`/, "the audit row is symbolic (signal + outcome), never a URL or title");
assert.match(main, /"\/browser-outcome"/, "local bridge exposes browser-outcome endpoint");
assert.match(main, /"\/browser-outcomes\/fleet-packet"/, "local bridge exposes content-blind fleet packet endpoint");
assert.match(main, /recordBrowserOutcome/, "browser outcome endpoint writes through recordBrowserOutcome");
assert.match(main, /browserOutcomes/, "browser outcomes are stored separately from proof metrics");

console.log("Browser-outcome bridge test passed (content-blind normalization · dedupe · proof mapping · bridge wiring).");
