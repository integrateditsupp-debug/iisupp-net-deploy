// B1 exit-criteria: real deflection metric.
// Rule 14: deflectionPct is ONLY ever derived from real user feedback events, never seeded.
// Tests: metric increments on "resolved", not on "unresolved"; empty-state when no events; IPC store contract.

import assert from "node:assert/strict";
import {
  readStore, writeStore, logResolutionEvent, computeDeflectionStats
} from "../src/shared/deflection-store.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}: ${e.message}`); failed++; }
}

// Temp store path per test run
const TMP = path.join(os.tmpdir(), `deflection-test-${Date.now()}.json`);
process.env.DEFLECTION_STORE_PATH = os.tmpdir();

console.log("\nB1 deflection metric tests");
console.log("==========================");

// ── Store contract ────────────────────────────────────────────────────────────
test("S1: fresh store has 0 events", () => {
  const s = readStore(TMP + ".missing");
  assert.equal(s.events.length, 0);
});

test("S2: logResolutionEvent rejects invalid outcome", () => {
  const s = { events: [], version: 1 };
  assert.throws(() => logResolutionEvent(s, { outcome: "maybe" }), /outcome must be/);
});

test("S3: logResolutionEvent adds event with correct outcome", () => {
  const s = { events: [], version: 1 };
  const updated = logResolutionEvent(s, { question: "wifi broken", outcome: "resolved", score: 0.8 });
  assert.equal(updated.events.length, 1);
  assert.equal(updated.events[0].outcome, "resolved");
  assert.equal(updated.events[0].score, 0.8);
  assert.ok(updated.events[0].ts, "event must have timestamp");
});

test("S4: logResolutionEvent trims question to 200 chars", () => {
  const s = { events: [], version: 1 };
  const long = "x".repeat(300);
  const updated = logResolutionEvent(s, { question: long, outcome: "unresolved" });
  assert.ok(updated.events[0].question.length <= 200);
});

// ── Deflection % computation ───────────────────────────────────────────────────
test("D1: empty store → deflectionPct is null (Rule 14: no empty-to-zero inflation)", () => {
  const stats = computeDeflectionStats({ events: [] });
  assert.equal(stats.deflectionPct, null, "deflectionPct must be null with no events");
  assert.equal(stats.total, 0);
});

test("D2: 1 resolved / 1 total → deflectionPct = 100", () => {
  const s = { events: [], version: 1 };
  const s1 = logResolutionEvent(s, { outcome: "resolved", question: "q1" });
  assert.equal(computeDeflectionStats(s1).deflectionPct, 100);
});

test("D3: 1 resolved / 2 total → deflectionPct = 50", () => {
  let s = { events: [], version: 1 };
  s = logResolutionEvent(s, { outcome: "resolved", question: "q1" });
  s = logResolutionEvent(s, { outcome: "unresolved", question: "q2" });
  assert.equal(computeDeflectionStats(s).deflectionPct, 50);
});

test("D4: unresolved-only → deflectionPct = 0 (not null — there IS data)", () => {
  let s = { events: [], version: 1 };
  s = logResolutionEvent(s, { outcome: "unresolved", question: "q1" });
  assert.equal(computeDeflectionStats(s).deflectionPct, 0);
  assert.equal(computeDeflectionStats(s).total, 1);
});

test("D5: resolved count is accurate (3/5)", () => {
  let s = { events: [], version: 1 };
  for (let i = 0; i < 3; i++) s = logResolutionEvent(s, { outcome: "resolved", question: `q${i}` });
  for (let i = 0; i < 2; i++) s = logResolutionEvent(s, { outcome: "unresolved", question: `u${i}` });
  const stats = computeDeflectionStats(s);
  assert.equal(stats.resolved, 3);
  assert.equal(stats.unresolved, 2);
  assert.equal(stats.deflectionPct, 60);
});

// ── Persistence ───────────────────────────────────────────────────────────────
test("P1: write + read round-trip preserves events", () => {
  let s = { events: [], version: 1 };
  s = logResolutionEvent(s, { outcome: "resolved", question: "printer" });
  writeStore(s, TMP);
  const loaded = readStore(TMP);
  assert.equal(loaded.events.length, 1);
  assert.equal(loaded.events[0].outcome, "resolved");
  fs.unlinkSync(TMP);
});

test("P2: missing file → default empty store (no crash)", () => {
  const s = readStore("/nonexistent/path/nope.json");
  assert.equal(s.events.length, 0);
});

// ── Rule 14 guard ─────────────────────────────────────────────────────────────
test("R1: deflectionPct never inflated from 0 events", () => {
  // Simulate the dashboard query with no real events
  const stats = computeDeflectionStats({ events: [] });
  assert.equal(stats.deflectionPct, null,
    "Rule 14: with no real feedback, deflectionPct must be null (empty-state), not 0 or any number");
});

test("R2: adding only unresolved events does NOT set deflectionPct to null", () => {
  // Even with 0 resolved, we have real data — deflectionPct should be 0 (not null)
  let s = { events: [], version: 1 };
  s = logResolutionEvent(s, { outcome: "unresolved", question: "test" });
  const stats = computeDeflectionStats(s);
  assert.equal(stats.deflectionPct, 0, "0% is the honest answer when all events are unresolved");
  assert.notEqual(stats.deflectionPct, null, "null means no data; 0 means real data with 0% resolution");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
