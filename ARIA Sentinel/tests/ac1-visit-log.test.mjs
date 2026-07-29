// ac1-visit-log.test.mjs — RUN-AC. Covers AC1 visit-log reader and AC2 the site's own writer.
//
// The point of this suite is to make RUN-AC's one refusal structurally impossible to remove:
// AN ABSENT OR NOT-YET-RUNNING LOG CAN NEVER BECOME A ZERO, and a zero can never be reported over a
// window that reaches back before the log started. That is the single way this module could turn into
// the fabricated metric RUN-AB was built to prevent.
import assert from "node:assert/strict";
import test from "node:test";

import {
  measureVisits, renderVisits, countOverWindow, reachableSignals, findForbiddenFields,
  UNOBSERVED, NOT_COLLECTING, FORBIDDEN_FIELDS, PATH_BUCKETS,
  SENDS, HAS_TRANSPORT, PERSISTS, READS_IDENTITY, FETCHES,
} from "../src/shared/visit-log.mjs";

import { bucketFor, isSelfTraffic, applyHit } from "../../netlify/functions/axis-visit-log.mjs";

import { assessPassiveSurface } from "../src/shared/passive-surface.mjs";

const NOW = "2026-07-29T12:00:00.000Z";

// ── 1. NO LOG IS NEVER A ZERO ──────────────────────────────────────────────────────────────────────
test("AC1.1 no record at all reports unobserved, never 0", () => {
  const m = measureVisits(null, { now: NOW });
  assert.equal(m.visits, UNOBSERVED);
  assert.equal(m.state, NOT_COLLECTING);
  assert.equal(m.collecting, false);
  assert.notEqual(m.visits, 0);
});

test("AC1.2 a record with no startedAt reports unobserved, never 0", () => {
  const m = measureVisits({ schema: "visit-log.v1", days: [] }, { now: NOW });
  assert.equal(m.visits, UNOBSERVED);
  assert.equal(m.collecting, false);
  assert.match(m.why, /startedAt/);
});

test("AC1.3 the refusal is the FIRST rendered line, not a footnote", () => {
  const out = renderVisits(measureVisits(null, { now: NOW }));
  const firstContent = out.split("\n").filter((l) => l.trim())[1];
  assert.match(firstContent, /not collecting yet/i);
});

// ── 2. A ZERO IS ONLY A ZERO INSIDE THE WINDOW ─────────────────────────────────────────────────────
test("AC1.4 an empty but running log reports a real 0 that names its window", () => {
  const m = measureVisits({ schema: "visit-log.v1", startedAt: "2026-07-29T00:00:00Z", days: [] }, { now: NOW });
  assert.equal(m.visits, 0);
  assert.equal(m.collecting, true);
  assert.match(m.headline, /since 2026-07-29/);
  assert.match(m.headline, /only for that window/i);
});

test("AC1.5 a count over a window that begins before startedAt is REFUSED, not answered", () => {
  const m = measureVisits(
    { schema: "visit-log.v1", startedAt: "2026-07-29T00:00:00Z", days: [{ day: "2026-07-29", buckets: { "/": 3 }, self: 0 }] },
    { now: NOW },
  );
  const r = countOverWindow(m, { from: "2026-07-01T00:00:00Z", to: NOW });
  assert.equal(r.ok, false);
  assert.equal(r.visits, UNOBSERVED);
  assert.match(r.why, /before the log started/i);
});

test("AC1.6 a count inside the window is answered", () => {
  const m = measureVisits(
    { schema: "visit-log.v1", startedAt: "2026-07-29T00:00:00Z", days: [{ day: "2026-07-29", buckets: { "/": 3, "/aria": 2 }, self: 9 }] },
    { now: NOW },
  );
  const r = countOverWindow(m, { from: "2026-07-29T00:00:00Z", to: "2026-07-30T00:00:00Z" });
  assert.equal(r.ok, true);
  assert.equal(r.visits, 5);
});

// ── 3. IDENTITY IS REJECTED WHOLE, NOT SANITISED ───────────────────────────────────────────────────
test("AC1.7 every forbidden field, on its own, rejects the entire record", () => {
  for (const field of FORBIDDEN_FIELDS) {
    const rec = { schema: "visit-log.v1", startedAt: "2026-07-29T00:00:00Z", days: [{ day: "2026-07-29", buckets: { "/": 5 }, self: 0, [field]: "x" }] };
    const m = measureVisits(rec, { now: NOW });
    assert.equal(m.state, "rejected", `field ${field} was not rejected`);
    assert.equal(m.visits, UNOBSERVED);
    assert.ok(m.forbiddenFieldsFound.includes(field));
  }
});

test("AC1.8 findForbiddenFields sees identity at any depth", () => {
  assert.deepEqual(findForbiddenFields({ a: { b: [{ ip: "1" }] } }), ["ip"]);
  assert.deepEqual(findForbiddenFields({ day: "2026-07-29", buckets: { "/": 1 } }), []);
});

// ── 4. SELF-TRAFFIC IS NOT A VISIT ─────────────────────────────────────────────────────────────────
test("AC1.9 self-traffic is excluded from the headline and reported separately", () => {
  const m = measureVisits(
    { schema: "visit-log.v1", startedAt: "2026-07-29T00:00:00Z", days: [{ day: "2026-07-29", buckets: { "/": 2 }, self: 40 }] },
    { now: NOW },
  );
  assert.equal(m.visits, 2);
  assert.equal(m.selfTraffic, 40);
  assert.match(renderVisits(m), /self-traffic excluded/i);
});

test("AC2.1 the writer classifies our own tooling as self-traffic and never stores the agent", () => {
  assert.equal(isSelfTraffic({ "user-agent": "Netlify Uptime Monitor" }), true);
  assert.equal(isSelfTraffic({ "user-agent": "curl/8.0" }), true);
  assert.equal(isSelfTraffic({ "x-axis-self": "1" }), true);
  assert.equal(isSelfTraffic({ "user-agent": "Mozilla/5.0 (Windows NT 10.0)" }), false);

  const rec = applyHit(null, { day: "2026-07-29", bucket: "/", self: true, now: NOW });
  assert.deepEqual(findForbiddenFields(rec), [], "the writer must never persist an identity-shaped field");
  assert.equal(rec.days[0].self, 1);
  assert.deepEqual(rec.days[0].buckets, {});
});

// ── 5. THE WRITER'S RECORD IS ALWAYS READABLE BY THE READER ────────────────────────────────────────
test("AC2.2 writer output round-trips through the reader with no leak", () => {
  let rec = null;
  for (const p of ["/", "/aria/trial", "/aperture-learning.html", "/nothing/here"]) {
    rec = applyHit(rec, { day: "2026-07-29", bucket: bucketFor(p), self: false, now: NOW });
  }
  assert.deepEqual(findForbiddenFields(rec), []);
  const m = measureVisits(rec, { now: NOW });
  assert.equal(m.state, "observed");
  assert.equal(m.visits, 4);
  for (const b of m.buckets) assert.ok(PATH_BUCKETS.includes(b.bucket), `bucket ${b.bucket} escaped the allowlist`);
});

test("AC2.3 startedAt is stamped once and never rewritten", () => {
  const first = applyHit(null, { day: "2026-07-29", bucket: "/", self: false, now: "2026-07-29T00:00:00.000Z" });
  const second = applyHit(first, { day: "2026-07-30", bucket: "/", self: false, now: "2026-07-30T00:00:00.000Z" });
  assert.equal(second.startedAt, "2026-07-29T00:00:00.000Z");
  assert.equal(second.updatedAt, "2026-07-30T00:00:00.000Z");
});

test("AC2.4 bucketFor collapses everything unknown to 'other' and never leaks a raw path", () => {
  assert.equal(bucketFor("/"), "/");
  assert.equal(bucketFor("/aria"), "/aria");
  assert.equal(bucketFor("/ARIA/Trial?x=1"), "/aria");
  assert.equal(bucketFor("/some/private/thing"), "other");
  assert.equal(bucketFor(undefined), "other");
});

// ── 6. THE SIGNAL ONLY FLIPS ON REAL OBSERVATION ───────────────────────────────────────────────────
test("AC3.1 passive-surface stays a refusal while the log is not collecting", () => {
  const m = measureVisits(null, { now: NOW });
  const s = assessPassiveSurface({ now: NOW, reachableRecords: reachableSignals(m) });
  assert.equal(s.isRefusal, true);
  assert.equal(s.measurableCount, 0);
});

test("AC3.2 a genuinely observed log flips site-visits to measurable, and nothing else", () => {
  const m = measureVisits(
    { schema: "visit-log.v1", startedAt: "2026-07-29T00:00:00Z", days: [{ day: "2026-07-29", buckets: { "/": 1 }, self: 0 }] },
    { now: NOW },
  );
  const s = assessPassiveSurface({ now: NOW, reachableRecords: reachableSignals(m) });
  assert.equal(s.isRefusal, false);
  assert.equal(s.measurableCount, 1);
  const visits = s.signals.find((x) => x.id === "site-visits");
  assert.equal(visits.state, "measurable");
  for (const other of s.signals.filter((x) => x.id !== "site-visits")) {
    assert.equal(other.state, "not measurable here", `${other.id} was promoted without evidence`);
  }
});

test("AC3.3 an empty running log does NOT flip anything else measurable", () => {
  const m = measureVisits({ schema: "visit-log.v1", startedAt: "2026-07-29T00:00:00Z", days: [] }, { now: NOW });
  const s = assessPassiveSurface({ now: NOW, reachableRecords: reachableSignals(m) });
  assert.equal(s.measurableCount, 1);
});

// ── 7. THE MODULE IS INERT ─────────────────────────────────────────────────────────────────────────
test("AC1.10 the reader sends nothing, fetches nothing, persists nothing, reads no identity", () => {
  assert.equal(SENDS, false);
  assert.equal(HAS_TRANSPORT, false);
  assert.equal(PERSISTS, false);
  assert.equal(READS_IDENTITY, false);
  assert.equal(FETCHES, false);
});
