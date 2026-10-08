// pending-delivery-age.test.mjs — RUN-BU / BU1.
//
// The defect this guards is not a crash. For fifty-six days every cycle reported, truthfully,
// "verified - one click waiting", and not one of them reported that the wait was now measured in
// weeks. The number existed in no file and no test, so nothing could go red about it.
//
// These assertions hold the shape of the honest answer: landing is claimed only on evidence, an
// unreadable shelf is never reported as an empty one, "I cannot tell" is never folded into either
// count, and a pending age of zero never appears where "nothing pending" is meant.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ageDays, ageMs, isHeldByRemote, classifyDelivery, auditDeliveries,
  speakablePendingLine, DELIVERY_STATES, DEFAULT_MAX_AGE_DAYS, PENDING_DELIVERY_SCHEMA, SENDS,
} from "../scripts/lib/pending-delivery.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = new Date("2026-10-08T20:00:00.000Z");
const SHA_A = "a".repeat(39) + "1";
const SHA_B = "b".repeat(39) + "2";
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();

test("this module reaches nothing and sends nothing", () => {
  assert.equal(SENDS, false);
  assert.equal(PENDING_DELIVERY_SCHEMA, "pending-delivery.v1");
});

test("age is computed, and an uncomputable age is null rather than a number", () => {
  assert.equal(ageDays(daysAgo(56), NOW), 56);
  assert.equal(ageDays(daysAgo(0.5), NOW), 0);
  assert.equal(ageDays(undefined, NOW), null, "a missing stamp is not age 0");
  assert.equal(ageDays("not a date", NOW), null);
  assert.equal(ageDays(new Date(NOW.getTime() + 86400000).toISOString(), NOW), null,
    "a stamp in the future is a broken stamp, not a negative age");
  assert.equal(ageMs(daysAgo(1), NOW), 86400000);
});

test("landing is claimed only on positive evidence, and a short id must be long enough to mean it", () => {
  assert.equal(isHeldByRemote(SHA_A, new Set([SHA_A, SHA_B])), true);
  assert.equal(isHeldByRemote(SHA_A.slice(0, 10), new Set([SHA_A])), true, "a 10-char prefix of a held commit is held");
  assert.equal(isHeldByRemote(SHA_A.slice(0, 4), new Set([SHA_A])), false, "a 4-char prefix is noise, not a match");
  assert.equal(isHeldByRemote(SHA_A, new Set()), false, "an empty remote holds nothing - absence is never landing");
  assert.equal(isHeldByRemote("", new Set([SHA_A])), false);
  assert.equal(isHeldByRemote(null, new Set([SHA_A])), false);
});

test("a manifest the shared line holds is landed; one it does not is pending with a real age", () => {
  const landed = classifyDelivery({ name: "x", tip: SHA_A, generatedAt: daysAgo(3), commits: 5 },
    { remoteShas: new Set([SHA_A]), now: NOW });
  assert.equal(landed.state, DELIVERY_STATES.LANDED);
  assert.equal(landed.reason, null);

  const pending = classifyDelivery({ name: "y", tip: SHA_B, generatedAt: daysAgo(56), commits: 11 },
    { remoteShas: new Set([SHA_A]), now: NOW });
  assert.equal(pending.state, DELIVERY_STATES.PENDING);
  assert.equal(pending.ageDays, 56);
  assert.equal(pending.commits, 11);
});

test("what cannot be judged is unverifiable, with a reason, and is neither landed nor pending", () => {
  const noTip = classifyDelivery({ name: "no-tip", generatedAt: daysAgo(9) }, { remoteShas: new Set([SHA_A]), now: NOW });
  assert.equal(noTip.state, DELIVERY_STATES.UNVERIFIABLE);
  assert.match(noTip.reason, /tip/i);

  const noStamp = classifyDelivery({ name: "no-stamp", tip: SHA_B }, { remoteShas: new Set([SHA_A]), now: NOW });
  assert.equal(noStamp.state, DELIVERY_STATES.UNVERIFIABLE);
  assert.match(noStamp.reason, /unknown length of time/i);

  const garbage = classifyDelivery("not an object", { remoteShas: new Set(), now: NOW });
  assert.equal(garbage.state, DELIVERY_STATES.UNVERIFIABLE);
  assert.ok(garbage.reason);
});

test("an unreadable shelf is reported as not taken - never as zero pending", () => {
  const a = auditDeliveries({ deliveries: null, remoteShas: new Set([SHA_A]), now: NOW });
  assert.equal(a.state, "not-taken");
  assert.equal(a.source, "absent");
  assert.equal(a.pendingCount, null, "a reading that was not taken is never published as 0");
  assert.equal(a.landedCount, null);
  assert.equal(a.oldestPendingDays, null);
  assert.equal(a.overdue, false);
  assert.match(a.statement, /not taken/i);
  assert.match(speakablePendingLine(a), /will not claim that nothing is waiting/i);
});

test("the counts are kept apart, the oldest wait is real, and overdue fires on it", () => {
  const a = auditDeliveries({
    deliveries: [
      { name: "landed-one", tip: SHA_A, generatedAt: daysAgo(30), commits: 2 },
      { name: "old-one", tip: SHA_B, generatedAt: daysAgo(56), commits: 11 },
      { name: "new-one", tip: "c".repeat(40), generatedAt: daysAgo(1), commits: 3 },
      { name: "cannot-tell", generatedAt: daysAgo(4) },
    ],
    remoteShas: new Set([SHA_A]), now: NOW, maxAgeDays: 2,
  });
  assert.equal(a.state, "taken");
  assert.equal(a.landedCount, 1);
  assert.equal(a.pendingCount, 2);
  assert.equal(a.unverifiableCount, 1);
  assert.equal(a.landedCount + a.pendingCount + a.unverifiableCount, 4, "nothing is dropped and nothing is double-counted");
  assert.equal(a.oldestPendingDays, 56, "the oldest wait is the one that matters, so it is the one reported");
  assert.equal(a.pending[0].name, "old-one", "pending is ordered oldest-first");
  assert.equal(a.overdue, true);
  assert.match(a.statement, /56 days/);
  assert.match(a.statement, /stall, not a staging/i);
  assert.match(speakablePendingLine(a), /oldest for 56 days/);
});

test("nothing pending reads as nothing pending - not as a delivery zero days old", () => {
  const a = auditDeliveries({
    deliveries: [{ name: "landed", tip: SHA_A, generatedAt: daysAgo(3), commits: 1 }],
    remoteShas: new Set([SHA_A]), now: NOW,
  });
  assert.equal(a.pendingCount, 0);
  assert.equal(a.oldestPendingDays, null, "0 would read as 'delivered moments ago'");
  assert.equal(a.overdue, false);
  assert.match(speakablePendingLine(a), /Nothing is waiting on your approval/i);
});

test("a wait inside the threshold is not yet a stall", () => {
  const a = auditDeliveries({
    deliveries: [{ name: "today", tip: SHA_B, generatedAt: daysAgo(1), commits: 4 }],
    remoteShas: new Set([SHA_A]), now: NOW, maxAgeDays: DEFAULT_MAX_AGE_DAYS,
  });
  assert.equal(a.pendingCount, 1);
  assert.equal(a.oldestPendingDays, 1);
  assert.equal(a.overdue, false);
});

test("the spoken line carries no commit id, branch name or script path", () => {
  const a = auditDeliveries({
    deliveries: [{ name: "cc/run-bu-2026-10-08", tip: SHA_B, generatedAt: daysAgo(58), commits: 14 }],
    remoteShas: new Set([SHA_A]), now: NOW,
  });
  const line = speakablePendingLine(a);
  assert.doesNotMatch(line, /\b[0-9a-f]{7,40}\b/i, "no commit id may reach a spoken answer");
  assert.doesNotMatch(line, /cc\//, "no branch name may reach a spoken answer");
  assert.doesNotMatch(line, /\.(cmd|ps1|bat|sh)\b/, "no operator script name may reach a spoken answer");
});

test("a non-array shelf is a programming error, not a quiet zero", () => {
  assert.throws(() => auditDeliveries({ deliveries: 7, remoteShas: new Set(), now: NOW }), /must be an array/);
});

test("the audit tool exists, and this suite is registered in the runner that counts", () => {
  // RUN-AW's finding, carried: a suite running green outside the count is the same lie in a nicer
  // shirt. The runner's manifest does not auto-discover, so the registration is asserted here.
  assert.ok(fs.existsSync(path.join(root, "scripts/pending-delivery-audit.mjs")), "the I/O half must exist");
  const runner = fs.readFileSync(path.join(root, "ARIA Sentinel/tests/run-all.mjs"), "utf8");
  assert.ok(runner.includes("pending-delivery-age.test.mjs"), "this suite must be registered in run-all.mjs or it does not count");
});

test("the audit script performs no write to any network and no send", () => {
  const src = fs.readFileSync(path.join(root, "scripts/pending-delivery-audit.mjs"), "utf8");
  assert.doesNotMatch(src, /\bgit\s+push\b/, "the auditor never pushes");
  assert.doesNotMatch(src, /\bfetch\(|https?:\/\//, "the auditor opens no HTTP connection of its own");
  assert.match(src, /ls-remote/, "its one network read is a credential-free ref listing");
});

test("a pending delivery already carried inside a newer one is collapsed, not counted twice", async () => {
  const { markContainment } = await import("../scripts/lib/pending-delivery.mjs");
  const OLD = "1".repeat(40), MID = "2".repeat(40), NEW = "3".repeat(40);
  // OLD is an ancestor of MID and NEW; MID is an ancestor of NEW.
  const isAncestor = (a, b) => (a === OLD && (b === MID || b === NEW)) || (a === MID && b === NEW);
  const { rows, distinct, clicksNeeded } = markContainment([
    { name: "old", tip: OLD, ageDays: 58 }, { name: "mid", tip: MID, ageDays: 56 }, { name: "new", tip: NEW, ageDays: 0 },
  ], isAncestor);
  assert.equal(clicksNeeded, 1, "one push lands all three, so one decision is what gets reported");
  assert.equal(distinct[0].name, "new");
  assert.equal(rows.find((r) => r.name === "old").containedIn, "new");
  assert.equal(rows.find((r) => r.name === "new").containedIn, null);
  assert.equal(rows.length, 3, "nothing is dropped - a collapsed row is still listed, with what carries it");
});

test("containment that cannot be determined is never guessed", async () => {
  const { markContainment } = await import("../scripts/lib/pending-delivery.mjs");
  const A = "4".repeat(40), B = "5".repeat(40);
  const { rows, clicksNeeded } = markContainment(
    [{ name: "a", tip: A, ageDays: 9 }, { name: "b", tip: B, ageDays: 1 }],
    () => null, // the objects are not here; the answer is unknown
  );
  assert.equal(clicksNeeded, 2, "an unprovable containment stays standalone rather than collapsing work out of sight");
  assert.ok(rows.every((r) => r.containmentUnknown === true && r.containedIn === null));
});

test("a delivery provably NOT contained stays its own decision", async () => {
  const { markContainment } = await import("../scripts/lib/pending-delivery.mjs");
  const A = "6".repeat(40), B = "7".repeat(40);
  const { clicksNeeded, rows } = markContainment(
    [{ name: "a", tip: A, ageDays: 9 }, { name: "b", tip: B, ageDays: 1 }],
    () => false,
  );
  assert.equal(clicksNeeded, 2);
  assert.ok(rows.every((r) => r.containedIn === null && r.containmentUnknown === false));
});
