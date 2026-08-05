// claim-evidence.test.mjs — RUN-AK / AK1 + AK2.
//
// The two properties this suite defends:
//   AK1  A published figure carries its evidence, or it is not published at all. Proven by taking a
//        payload that emits cleanly, REMOVING one stamp field, and watching the emitter refuse.
//   AK2  A figure older than its class allows is visibly stale, and is still there. Proven by
//        artificially ageing a payload and asserting both the label AND the survival of the claim.
//
// The distinction matters more than it looks: a program that DELETES stale claims looks healthier
// the longer it neglects them. A program that labels them gets uglier, which is the honest direction.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  CLAIM_EVIDENCE_SCHEMA, CLASSES, MAX_AGE_HOURS, DEFAULT_KIND,
  stamp, auditClaim, auditClaims, requireStampedClaims,
  ageHours, maxAgeHoursFor, annotateStaleness, staleClaims, auditAndAnnotate,
} from "../scripts/lib/claim-evidence.mjs";
import { emitAxisStatus } from "../scripts/lib/axis-status-emit.mjs";

// Anchored to real time on purpose: the emitter tests below go through the real writer, which uses
// the real clock. A frozen fixture would make every stamp look like it was measured in the future.
const NOW = new Date();
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

const goodClaims = () => ({
  suitesGreen: stamp(332, { measuredAt: hoursAgo(0.2), source: "exit code of the full registry run", kind: "test" }),
  testsPassed: stamp(532, { measuredAt: hoursAgo(0.2), source: "exit code of the full registry run", kind: "test" }),
  pushBlocked: stamp(true, { measuredAt: hoursAgo(1), source: "remote credential probe, prompts disabled", kind: "blocker" }),
});

const headline = () => ({
  status: "active build",
  milestone: "m",
  readiness: "r",
  revenueToDate: "none",
  headline: "h",
});

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "claim-evidence-"));
}

test("claim-evidence — AK1: a well-formed claim passes and declares its schema", () => {
  assert.equal(CLAIM_EVIDENCE_SCHEMA, "claim-evidence.v1");
  const r = auditClaims(goodClaims(), { now: NOW });
  assert.equal(r.ok, true, JSON.stringify(r.failures));
  assert.equal(r.failures.length, 0);
  assert.equal(r.audited.length, 3);
  for (const a of r.audited) assert.equal(a.class, CLASSES.OK);
});

test("claim-evidence — AK1: each missing field is refused BY NAME, never as a generic 'invalid'", () => {
  const cases = [
    [{ measuredAt: hoursAgo(1), source: "s" }, CLASSES.NO_VALUE],
    [{ value: 1, source: "s" }, CLASSES.NO_MEASURED_AT],
    [{ value: 1, measuredAt: "yesterday", source: "s" }, CLASSES.BAD_MEASURED_AT],
    [{ value: 1, measuredAt: hoursAgo(-5), source: "s" }, CLASSES.FUTURE_MEASURED_AT],
    [{ value: 1, measuredAt: hoursAgo(1) }, CLASSES.NO_SOURCE],
    [{ value: 1, measuredAt: hoursAgo(1), source: "  " }, CLASSES.NO_SOURCE],
    [{ value: 1, measuredAt: hoursAgo(1), source: "s", kind: "vibes" }, CLASSES.UNKNOWN_KIND],
    [532, CLASSES.NOT_AN_OBJECT],
    ["532", CLASSES.NOT_AN_OBJECT],
    [[532], CLASSES.NOT_AN_OBJECT],
  ];
  for (const [claim, expected] of cases) {
    const a = auditClaim("testsPassed", claim, { now: NOW });
    assert.equal(a.ok, false, `expected refusal for ${JSON.stringify(claim)}`);
    assert.equal(a.class, expected, `wrong class for ${JSON.stringify(claim)}`);
    assert.match(a.detail, /testsPassed/, "the refusal must name the claim it refused");
  }
});

test("claim-evidence — AK1: a bare number is the RUN-AI shape and is refused", () => {
  // This is the whole point. `testsPassed: 532` is exactly how an unbacked figure used to travel.
  assert.throws(
    () => requireStampedClaims({ testsPassed: 532 }, { now: NOW }),
    /claim evidence REFUSED[\s\S]*testsPassed[\s\S]*claim-is-not-a-stamp-object/
  );
  assert.equal(requireStampedClaims(goodClaims(), { now: NOW }), true);
});

test("claim-evidence — AK2: age is computed and a fresh claim is not labelled", () => {
  const c = stamp(1, { measuredAt: hoursAgo(2), source: "s", kind: "test" });
  assert.equal(Math.round(ageHours(c, NOW)), 2);
  assert.equal(maxAgeHoursFor(c), MAX_AGE_HOURS.test);
  assert.equal(maxAgeHoursFor({ value: 1 }), MAX_AGE_HOURS[DEFAULT_KIND]);

  const annotated = annotateStaleness({ c }, { now: NOW });
  assert.equal(annotated.c.stale, false);
  assert.equal(annotated.c.ageHours, 2);
  assert.equal("staleLabel" in annotated.c, false, "a fresh claim must not be accused of being old");
});

test("claim-evidence — AK2: ageing a payload makes the label appear and DROPS NOTHING", () => {
  const claims = {
    testsPassed: stamp(532, { measuredAt: hoursAgo(50), source: "a run two cycles ago", kind: "test" }),
    pushBlocked: stamp(true, { measuredAt: hoursAgo(50), source: "a credential probe two cycles ago", kind: "blocker" }),
    founded: stamp("2026", { measuredAt: hoursAgo(50), source: "the record", kind: "fact" }),
  };
  const annotated = annotateStaleness(claims, { now: NOW });

  // A test count goes stale after one cycle; a blocker state survives three; a fact does not decay.
  assert.equal(annotated.testsPassed.stale, true, "a 50h-old test count is stale");
  assert.equal(annotated.pushBlocked.stale, false, "a 50h-old blocker state is still inside its policy");
  assert.equal(annotated.founded.stale, false, "a fact does not decay");

  assert.match(annotated.testsPassed.staleLabel, /STALE/);
  assert.match(annotated.testsPassed.staleLabel, /50h ago/);
  assert.match(annotated.testsPassed.staleLabel, /not re-measured this cycle/);

  // Nothing dropped, and the value itself is untouched — staleness annotates, it never edits.
  assert.deepEqual(Object.keys(annotated).sort(), ["founded", "pushBlocked", "testsPassed"]);
  assert.equal(annotated.testsPassed.value, 532);
  assert.equal(annotated.testsPassed.source, "a run two cycles ago");

  const stale = staleClaims(annotated);
  assert.equal(stale.length, 1);
  assert.equal(stale[0].name, "testsPassed");
});

test("claim-evidence — AK2: staleness is a function of the CLOCK, not of neglect being invisible", () => {
  const claims = { testsPassed: stamp(532, { measuredAt: hoursAgo(1), source: "this cycle", kind: "test" }) };
  assert.equal(annotateStaleness(claims, { now: NOW }).testsPassed.stale, false);
  const laterNow = new Date(NOW.getTime() + 48 * 3_600_000);
  const later = annotateStaleness(claims, { now: laterNow });
  assert.equal(later.testsPassed.stale, true, "the same untouched claim must go stale as time passes");
  assert.equal(later.testsPassed.value, 532, "and must still be there to be challenged");
});

test("claim-evidence — auditAndAnnotate refuses first, then labels", () => {
  assert.throws(() => auditAndAnnotate({ testsPassed: 532 }, { now: NOW }), /REFUSED/);
  const { claims, stale } = auditAndAnnotate(goodClaims(), { now: NOW });
  assert.equal(stale.length, 0);
  assert.equal(claims.suitesGreen.value, 332);
  assert.equal(claims.suitesGreen.stale, false);
});

// ── The emitter contract: the proof AK1 asks for, run against the real writer. ──

test("emitter — AK1: RED when one stamp is removed, GREEN with it restored", () => {
  const root = tmpRoot();
  const full = { schema: "axis-status-full/1", claims: goodClaims() };

  // GREEN first, so the red below is provably caused by the removal and nothing else.
  const ok = emitAxisStatus({ root, publicFields: headline(), fullDetail: full });
  assert.equal(ok.written.public.length, 2);
  const writtenGreen = JSON.parse(fs.readFileSync(path.join(root, ok.written.internal), "utf8"));
  assert.equal(writtenGreen.claims.testsPassed.value, 532);
  assert.equal(writtenGreen.claims.testsPassed.stale, false);
  assert.deepEqual(writtenGreen.staleClaims, []);

  // Now remove exactly one field — the `source` — and nothing else.
  const maimed = { schema: "axis-status-full/1", claims: goodClaims() };
  delete maimed.claims.testsPassed.source;
  assert.throws(
    () => emitAxisStatus({ root, publicFields: headline(), fullDetail: maimed }),
    /claim evidence REFUSED[\s\S]*testsPassed[\s\S]*does-not-name-its-source|claim-does-not-name-its-source/
  );

  fs.rmSync(root, { recursive: true, force: true });
});

test("emitter — AK1: the refusal happens BEFORE anything is written", () => {
  const root = tmpRoot();
  const bad = { schema: "axis-status-full/1", claims: { testsPassed: 532 } };
  assert.throws(() => emitAxisStatus({ root, publicFields: headline(), fullDetail: bad }), /REFUSED/);
  assert.equal(fs.existsSync(path.join(root, "netlify/functions/_axis-status-full.json")), false,
    "an unbacked figure must not reach disk at all — a refused write that half-wrote is not a refusal");
  assert.equal(fs.existsSync(path.join(root, "public/.well-known/axis/status.json")), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test("emitter — AK2: a stale claim reaches the internal file labelled, and is listed", () => {
  const root = tmpRoot();
  const full = {
    schema: "axis-status-full/1",
    claims: {
      testsPassed: stamp(532, { measuredAt: new Date(Date.now() - 60 * 3_600_000).toISOString(), source: "a run two cycles ago", kind: "test" }),
      pushBlocked: stamp(true, { measuredAt: new Date(Date.now() - 1 * 3_600_000).toISOString(), source: "this cycle's credential probe", kind: "blocker" }),
    },
  };
  const { written } = emitAxisStatus({ root, publicFields: headline(), fullDetail: full });
  const disk = JSON.parse(fs.readFileSync(path.join(root, written.internal), "utf8"));

  assert.equal(disk.claims.testsPassed.stale, true);
  assert.match(disk.claims.testsPassed.staleLabel, /STALE/);
  assert.equal(disk.claims.testsPassed.value, 532, "labelled, not deleted");
  assert.equal(disk.claims.pushBlocked.stale, false);
  assert.equal(disk.staleClaims.length, 1);
  assert.equal(disk.staleClaims[0].name, "testsPassed");

  fs.rmSync(root, { recursive: true, force: true });
});

test("emitter — AK1/AK2: none of the machinery reaches the PUBLIC headline", () => {
  const root = tmpRoot();
  const full = { schema: "axis-status-full/1", claims: goodClaims() };
  const { written, publicStatus } = emitAxisStatus({ root, publicFields: headline(), fullDetail: full });
  for (const rel of written.public) {
    const pub = JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
    assert.equal("claims" in pub, false, "the public feed is a headline, not an evidence ledger");
    assert.equal("staleClaims" in pub, false);
    assert.deepEqual(Object.keys(pub).sort(), Object.keys(publicStatus).sort());
  }
  fs.rmSync(root, { recursive: true, force: true });
});

test("emitter — a payload with no claims section is untouched (back-compatible by design)", () => {
  const root = tmpRoot();
  const { written } = emitAxisStatus({ root, publicFields: headline(), fullDetail: { schema: "axis-status-full/1", program: { pct: 100 } } });
  const disk = JSON.parse(fs.readFileSync(path.join(root, written.internal), "utf8"));
  assert.equal("claims" in disk, false);
  assert.equal("staleClaims" in disk, false);
  assert.equal(disk.program.pct, 100);
  fs.rmSync(root, { recursive: true, force: true });
});

console.log("claim-evidence test passed (AK1 evidence stamps refused by name incl. the bare-number RUN-AI shape · emitter red-then-green on one removed stamp · refusal writes nothing · AK2 ageing produces a label and drops nothing · public headline free of the machinery).");
