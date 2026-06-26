// G-METRICS — proof-metrics store + math. Locks the content-blind record shape, the counters, the
// deflection / KB-hit / avg-resolution math, honest zero (no divide-by-zero, no fabrication), the file
// round-trip, and the website metrics.json shape. 🔒 HARD RULE 14: zero in → zero out, never invented.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  sanitizeEvent, aggregate, toPublicJson, recordEvent, loadStore, writeStore,
  emptyStore, emitPublicJson, PROOF_SCHEMA, PROOF_SOURCES
} from "../src/shared/proof-metrics.mjs";

let tests = 0;
const ok = (label) => { tests++; console.log(`  ✓ ${label}`); };

// ── 1 — sanitizeEvent is strictly content-blind (only booleans / number / symbol / ts) ──
const ev = sanitizeEvent({
  source: "self-test", resolved: 1, escalated: 0, matchedKb: "yes", resolveMs: 1234.7,
  question: "my password leaked", answer: "secret text", path: "C:\\Users\\x" // must be dropped
}, 1000);
assert.deepEqual(Object.keys(ev).sort(), ["escalated", "matchedKb", "resolveMs", "resolved", "source", "ts"], "only the 6 blind fields are kept");
assert.equal(ev.resolved, true, "truthy coerces to boolean");
assert.equal(ev.matchedKb, true, "string coerces to boolean");
assert.equal(ev.resolveMs, 1235, "resolveMs rounded");
assert.equal(ev.ts, 1000, "ts honored");
assert.equal(sanitizeEvent({ source: "nope" }).source, "chat", "unknown source → chat");
assert.equal(sanitizeEvent({ resolveMs: -50 }).resolveMs, 0, "negative duration clamped to 0");
assert.ok(PROOF_SOURCES.includes("self-test") && PROOF_SCHEMA === 1, "schema + sources exported");
ok("sanitizeEvent keeps only content-blind fields, coerces + clamps");

// ── 2 — aggregate math on a known set: 5 events → deflection / kb-hit / avg resolution ──
const events = [
  { resolved: true, escalated: false, matchedKb: true, resolveMs: 100 },
  { resolved: true, escalated: false, matchedKb: true, resolveMs: 300 },
  { resolved: false, escalated: true, matchedKb: false, resolveMs: 0 },
  { resolved: true, escalated: false, matchedKb: true, resolveMs: 200 },
  { resolved: false, escalated: true, matchedKb: false, resolveMs: 0 }
].map((e) => sanitizeEvent(e));
const a = aggregate(events);
assert.equal(a.queriesHandled, 5, "5 handled");
assert.equal(a.autoResolved, 3, "3 auto-resolved (resolved && !escalated)");
assert.equal(a.escalated, 2, "2 escalated");
assert.equal(a.deflectionPct, 60, "deflection = 3/5 = 60%");
assert.equal(a.kbHitRatePct, 60, "kb-hit = 3/5 = 60%");
assert.equal(a.avgResolutionMs, 200, "avg of resolved durations (100,300,200) = 200ms");
assert.equal(a.sampleSize, 5, "sample size = 5");
ok("aggregate computes deflection / kb-hit / avg-resolution correctly");

// ── 3 — honest zero: empty store → all zeros, no NaN, no divide-by-zero ──
const z = aggregate([]);
for (const k of ["queriesHandled", "autoResolved", "escalated", "deflectionPct", "avgResolutionMs", "kbHitRatePct", "sampleSize"]) {
  assert.equal(z[k], 0, `${k} is exactly 0 for an empty store`);
  assert.ok(Number.isFinite(z[k]), `${k} is finite (no NaN/Infinity)`);
}
assert.deepEqual(emptyStore().events, [], "emptyStore has no events");
ok("honest zero — empty store aggregates to exact zeros (no fabrication, no NaN)");

// ── 4 — file round-trip: record → load → aggregate, content-blind on disk ──
const file = path.join(os.tmpdir(), `aria-proof-test-${process.pid}.json`);
try { fs.rmSync(file, { force: true }); } catch {}
recordEvent({ source: "self-test", matchedKb: true, resolved: true, escalated: false, resolveMs: 120, secret: "PII" }, { file, now: 1 });
recordEvent({ source: "self-test", matchedKb: false, resolved: false, escalated: true, resolveMs: 0 }, { file, now: 2 });
const store = loadStore(file);
assert.equal(store.events.length, 2, "two records persisted");
const raw = fs.readFileSync(file, "utf8");
assert.doesNotMatch(raw, /PII|secret/, "no dropped/PII field is ever written to disk");
const ra = aggregate(store);
assert.equal(ra.queriesHandled, 2, "round-trip count");
assert.equal(ra.deflectionPct, 50, "round-trip deflection 1/2 = 50%");
// corrupt/missing file → empty store, never throws
fs.writeFileSync(file, "{ not json");
assert.deepEqual(loadStore(file).events, [], "corrupt store → empty (honest), no throw");
try { fs.rmSync(file, { force: true }); } catch {}
ok("record → load → aggregate round-trip; disk is content-blind; corrupt → empty");

// ── 5 — public metrics.json shape (website-readable, content-blind, honest flag) ──
const pub = toPublicJson(events);
assert.equal(pub.measured, true, "marked measured");
assert.equal(pub.schema, PROOF_SCHEMA, "carries schema");
assert.match(pub.note, /fabricat/i, "states it is not fabricated");
for (const k of ["queriesHandled", "deflectionPct", "kbHitRatePct", "avgResolutionMs"]) {
  assert.ok(k in pub, `public json carries ${k}`);
}
const outFile = path.join(os.tmpdir(), `aria-metrics-public-${process.pid}.json`);
const srcFile = path.join(os.tmpdir(), `aria-proof-src-${process.pid}.json`);
writeStore({ events }, srcFile);
const emitted = emitPublicJson({ file: srcFile, out: outFile });
assert.equal(JSON.parse(fs.readFileSync(outFile, "utf8")).deflectionPct, emitted.deflectionPct, "emitted file matches returned json");
try { fs.rmSync(outFile, { force: true }); fs.rmSync(srcFile, { force: true }); } catch {}
ok("toPublicJson / emitPublicJson produce a content-blind, honest metrics.json");

assert.equal(tests, 5, "proof-metrics runs exactly 5 test cases");
console.log(`Proof-metrics test passed (${tests}/5 · content-blind records · deflection/kb-hit/avg math · honest zero · file round-trip · metrics.json).`);
