// feed-freshness.test.mjs — RUN-AL / AL1 + AL2.
//
// RUN-AK closed the CLAIM: a figure inside the operator-internal payload carries its evidence or it
// is not published, and a figure older than its class allows renders a stale label.
//
// This suite closes the CARRIER. The public feed has exactly one field that says how old the whole
// answer is — `generatedAt` — and it had no gate. Three properties are defended:
//
//   AL1  A generatedAt that can never be honest (absent / malformed / in the future) is refused AT
//        WRITE TIME, and nothing reaches disk when it is refused. A half-written refusal is not a
//        refusal — that lesson is inherited from AK1 and is re-proven here rather than assumed.
//   AL2  A feed on disk that is older than one cycle FAILS THE CHECK. This is the case that matters
//        most and is the hardest to notice: if a cycle never runs, the previous feed just sits
//        there being read as current state. The gate has to fire when nobody is there to run
//        anything, so it lives on the read path, not the write path.
//   AL2b Two served mirrors that disagree about generatedAt fail, independently of either one's
//        age. `publish = "."` serves both directories; a half-completed write means which answer a
//        reader gets is a routing accident, and neither mirror can be challenged by the other.
//
// The distinction between write-time and read-time enforcement is the whole design. "Stale at write
// time" is a category error — the emitter is running now. "Stale on disk" is the actual failure.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  FEED_FRESHNESS_SCHEMA, CLASSES, MAX_FEED_AGE_HOURS, FUTURE_TOLERANCE_MS,
  feedAgeHours, auditGeneratedAt, auditFeedObject, checkFeedFreshness, requireFreshGeneratedAt,
} from "../scripts/lib/feed-freshness.mjs";
import { emitAxisStatus, checkPublicFiles, PUBLIC_STATUS_FILES } from "../scripts/lib/axis-status-emit.mjs";

const NOW = new Date();
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
const hoursAhead = (h) => new Date(NOW.getTime() + h * 3_600_000).toISOString();

const headline = (extra = {}) => ({
  status: "active build",
  milestone: "built and tested; delivery waits on deliberate operator action",
  readiness: "publishing is a deliberate manual step",
  revenueToDate: "none",
  headline: "status headline",
  ...extra,
});

const tmpRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), "feed-freshness-"));
const readMirror = (root, rel) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
const writeMirror = (root, rel, obj) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 1) + "\n");
};

// ── the module declares itself ───────────────────────────────────────────────────────────────────

test("the module is pure and says so", () => {
  assert.equal(FEED_FRESHNESS_SCHEMA, "feed-freshness.v1");
  assert.equal(MAX_FEED_AGE_HOURS, 24, "one cycle — the feed is regenerated every run");
});

// ── AL1 · a stamp that can never be honest is refused at write time ──────────────────────────────

test("AL1 — an absent generatedAt is refused by name", () => {
  const v = auditGeneratedAt(undefined);
  assert.equal(v.ok, false);
  assert.equal(v.class, CLASSES.MISSING);
});

test("AL1 — a malformed generatedAt is refused by name, not silently coerced", () => {
  for (const bad of ["yesterday", "2026-08-05", 1754400000000, "2026-13-99T99:99:99Z", {}]) {
    const v = auditGeneratedAt(bad);
    assert.equal(v.ok, false, `expected refusal for ${JSON.stringify(bad)}`);
    assert.equal(v.class, CLASSES.NOT_AN_INSTANT, `wrong class for ${JSON.stringify(bad)}`);
  }
});

test("AL1 — a generatedAt in the future is refused: it defeats every age check downstream", () => {
  const v = auditGeneratedAt(hoursAhead(6));
  assert.equal(v.ok, false);
  assert.equal(v.class, CLASSES.IN_THE_FUTURE);
  assert.match(v.detail, /future/);
});

test("AL1 — a clock a few seconds ahead is not called a liar", () => {
  const v = auditGeneratedAt(new Date(NOW.getTime() + FUTURE_TOLERANCE_MS / 2).toISOString());
  assert.equal(v.ok, true, "sub-tolerance skew is skew, not dishonesty");
});

test("AL1 — a stamp measured moments ago passes and reports its age", () => {
  const v = auditGeneratedAt(hoursAgo(0.25));
  assert.equal(v.ok, true);
  assert.equal(v.class, CLASSES.OK);
  assert.ok(v.ageHours > 0.2 && v.ageHours < 0.3, `age should be ~0.25h, got ${v.ageHours}`);
});

test("AL1 — age is not judged at write time: a day-old stamp is writable, just not readable-as-fresh", () => {
  assert.equal(auditGeneratedAt(hoursAgo(48)).ok, true, "write-time audit judges possibility, not age");
  assert.equal(auditFeedObject({ generatedAt: hoursAgo(48) }).ok, false, "read-time audit judges age");
});

test("AL1 — the throwing form names the class so a red test reads as an accusation", () => {
  assert.throws(() => requireFreshGeneratedAt(hoursAhead(2)), new RegExp(CLASSES.IN_THE_FUTURE));
  assert.throws(() => requireFreshGeneratedAt(undefined), new RegExp(CLASSES.MISSING));
});

// ── AL1 · wired into the real emitter, and the refusal writes nothing ────────────────────────────

test("AL1 — the same payload emits cleanly, and emits NOTHING once the stamp is impossible", () => {
  const root = tmpRoot();

  // green: the real writer, the real clock
  const { publicStatus } = emitAxisStatus({ root, publicFields: headline() });
  assert.ok(publicStatus.generatedAt, "emitter stamps generatedAt");
  for (const rel of PUBLIC_STATUS_FILES) {
    assert.ok(fs.existsSync(path.join(root, rel)), `${rel} written on the green path`);
  }

  // red: one field changed to something that can never be honest
  const clean = tmpRoot();
  assert.throws(
    () => emitAxisStatus({ root: clean, publicFields: headline({ generatedAt: hoursAhead(24) }) }),
    new RegExp(CLASSES.IN_THE_FUTURE),
  );
  for (const rel of PUBLIC_STATUS_FILES) {
    assert.equal(
      fs.existsSync(path.join(clean, rel)), false,
      `${rel} must NOT exist — a half-written refusal is not a refusal`,
    );
  }
});

test("AL1 — the refusal does not overwrite a previously good feed with a bad one", () => {
  const root = tmpRoot();
  emitAxisStatus({ root, publicFields: headline({ headline: "the good answer" }) });
  const before = readMirror(root, PUBLIC_STATUS_FILES[0]);

  assert.throws(() => emitAxisStatus({ root, publicFields: headline({ headline: "the bad answer", generatedAt: "not-a-time" }) }));

  const after = readMirror(root, PUBLIC_STATUS_FILES[0]);
  assert.deepEqual(after, before, "the good feed survives the refused write untouched");
});

// ── AL2 · the cycle that never ran ───────────────────────────────────────────────────────────────

test("AL2 — a feed older than one cycle FAILS the check, which is the case nobody is present for", () => {
  const root = tmpRoot();
  const stale = hoursAgo(MAX_FEED_AGE_HOURS + 12);
  for (const rel of PUBLIC_STATUS_FILES) writeMirror(root, rel, { schema: "axis-status/1", generatedAt: stale, public: true, headline: "h" });

  const problems = checkPublicFiles(root);
  assert.ok(problems.length > 0, "a 36h-old served feed must not pass as current state");
  assert.ok(problems.some((p) => p.reason === CLASSES.STALE), `expected ${CLASSES.STALE}, got ${JSON.stringify(problems)}`);
  assert.match(problems.find((p) => p.reason === CLASSES.STALE).match, /no run has refreshed it/);
});

test("AL2 — a freshly emitted feed passes the same check it would fail a day later", () => {
  const root = tmpRoot();
  emitAxisStatus({ root, publicFields: headline() });

  assert.deepEqual(checkPublicFiles(root), [], "fresh feed is clean");

  const tomorrow = new Date(NOW.getTime() + (MAX_FEED_AGE_HOURS + 1) * 3_600_000);
  const later = checkPublicFiles(root, { now: tomorrow });
  assert.ok(later.some((p) => p.reason === CLASSES.STALE), "the identical bytes go stale as the clock advances, untouched by anyone");
});

test("AL2 — staleness is reported, never repaired: the gate does not rewrite the feed", () => {
  const root = tmpRoot();
  const stale = hoursAgo(MAX_FEED_AGE_HOURS + 5);
  writeMirror(root, PUBLIC_STATUS_FILES[0], { schema: "axis-status/1", generatedAt: stale, public: true });
  writeMirror(root, PUBLIC_STATUS_FILES[1], { schema: "axis-status/1", generatedAt: stale, public: true });

  checkPublicFiles(root);

  assert.equal(readMirror(root, PUBLIC_STATUS_FILES[0]).generatedAt, stale,
    "a gate that silently repaired the feed would restore the ambiguity it exists to remove");
});

test("AL2 — an unreadable served feed is a failure, not a skip", () => {
  const root = tmpRoot();
  const p = path.join(root, PUBLIC_STATUS_FILES[0]);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, "{ this is not json");

  const res = checkFeedFreshness({ root, files: PUBLIC_STATUS_FILES, fs, path });
  assert.equal(res.ok, false);
  assert.equal(res.problems[0].class, CLASSES.UNREADABLE);
});

test("AL2 — a mirror that does not exist is skipped, because which mirrors exist is a publishing decision", () => {
  const root = tmpRoot();
  writeMirror(root, PUBLIC_STATUS_FILES[0], { schema: "axis-status/1", generatedAt: hoursAgo(0.1), public: true });

  const res = checkFeedFreshness({ root, files: PUBLIC_STATUS_FILES, fs, path });
  assert.equal(res.ok, true, "one present fresh mirror is not a failure");
  assert.deepEqual(res.checked, [PUBLIC_STATUS_FILES[0]]);
});

// ── AL2b · two served answers to the same question ───────────────────────────────────────────────

test("AL2b — mirrors that disagree fail even when BOTH are fresh", () => {
  const root = tmpRoot();
  writeMirror(root, PUBLIC_STATUS_FILES[0], { schema: "axis-status/1", generatedAt: hoursAgo(0.1), public: true });
  writeMirror(root, PUBLIC_STATUS_FILES[1], { schema: "axis-status/1", generatedAt: hoursAgo(2), public: true });

  const res = checkFeedFreshness({ root, files: PUBLIC_STATUS_FILES, fs, path });
  assert.equal(res.ok, false, "two fresh-but-different answers is its own failure class");
  assert.equal(res.problems[0].class, CLASSES.MIRRORS_DISAGREE);
  assert.match(res.problems[0].detail, /routing accident/);
});

test("AL2b — the real emitter writes mirrors that agree, so the disagreement gate stays quiet", () => {
  const root = tmpRoot();
  emitAxisStatus({ root, publicFields: headline() });
  const stamps = PUBLIC_STATUS_FILES.map((rel) => readMirror(root, rel).generatedAt);
  assert.equal(new Set(stamps).size, 1, "one write, one answer");
  assert.deepEqual(checkPublicFiles(root), []);
});

// ── the freshness gate does not weaken the leak gate it now shares a check with ──────────────────

test("a fresh feed that leaks internal state still fails — freshness never excuses a leak", () => {
  const root = tmpRoot();
  writeMirror(root, PUBLIC_STATUS_FILES[0], {
    schema: "axis-status/1", generatedAt: hoursAgo(0.1), public: true,
    headline: "merged cc/run-al-2026-08-05 this cycle",
  });
  writeMirror(root, PUBLIC_STATUS_FILES[1], {
    schema: "axis-status/1", generatedAt: hoursAgo(0.1), public: true,
    headline: "merged cc/run-al-2026-08-05 this cycle",
  });

  const problems = checkPublicFiles(root);
  assert.ok(problems.some((p) => /branch name/.test(p.reason)), "the leak class is still caught");
});

test("feedAgeHours is signed, so a future stamp is distinguishable from a fresh one", () => {
  assert.ok(feedAgeHours(hoursAhead(3), NOW) < 0);
  assert.ok(feedAgeHours(hoursAgo(3), NOW) > 0);
  assert.equal(feedAgeHours("not-a-time", NOW), null);
});
