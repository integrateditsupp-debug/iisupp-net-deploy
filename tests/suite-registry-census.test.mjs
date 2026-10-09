// suite-registry-census.test.mjs — RUN-BW / BW1.
//
// The defect this guards is not a crash and not a red test. It is a GREEN one.
//
// RUN-BV's runner reports a verdict over `TESTS.length` — "375 of 375 taken, all green". `TESTS` is
// a hand-maintained array. Counted for the first time to open this sequence: 443 suite files sit on
// disk. Sixty-eight of the difference had never been named anywhere, and 65 of them run and PASS
// when invoked by hand — live guards that have been running outside every count this programme ever
// published. Five do not pass. Nothing was red, because nothing was looking.
//
// Two halves, both asserted here:
//   1. the pure decider (`scripts/lib/suite-registry.mjs`) — every branch, no filesystem;
//   2. the live census (`scripts/suite-census.mjs`) — run against THIS tree, red on anything
//      unexplained, so the next suite file somebody adds without registering cannot be invisible.
//
// Deliberately NOT done here: bulk-registering the 70. Exit criterion 4 of the sequence forbids it,
// and it is right — a suite registered without being read is worse than one that never ran. They
// are recorded in the ledger with a verdict, a reason, and a 14-day clock, and the clock is what
// makes this honest rather than a nicer-looking parking lot.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  censusSuites, normaliseSpec, isRealReason, ageDays, statementFor,
  VERDICTS, SUITE_REGISTRY_SCHEMA, SENDS, DEFAULT_MAX_PENDING_DAYS,
} from "../scripts/lib/suite-registry.mjs";
import { parseRegisteredSpecs, listSuiteFiles, loadLedger, runCensus, LEDGER, RUNNER } from "../scripts/suite-census.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = new Date("2026-10-08T23:10:00.000Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();
const REASON = "read standalone and judged a live guard; registration staged for the next cycle";

test("this module reaches nothing and sends nothing", () => {
  assert.equal(SENDS, false);
  assert.equal(SUITE_REGISTRY_SCHEMA, "suite-registry.v1");
});

// ---------------------------------------------------------------- the decider: path normalisation

test("a TESTS entry becomes one repo-root path, whichever shape it was written in", () => {
  assert.equal(normaliseSpec("../../tests/deploy-safety-denylist.test.mjs"), "tests/deploy-safety-denylist.test.mjs");
  assert.equal(normaliseSpec("scenario-suite.mjs"), "ARIA Sentinel/tests/scenario-suite.mjs");
  assert.equal(normaliseSpec("./nested/x.test.mjs"), "ARIA Sentinel/tests/nested/x.test.mjs");
  assert.equal(normaliseSpec(""), null);
  assert.equal(normaliseSpec(42), null);
});

test("the same file registered in two shapes is ONE registration, not two", () => {
  const r = censusSuites({
    onDisk: ["tests/a.test.mjs"],
    registered: ["../../tests/a.test.mjs", "../../tests/./a.test.mjs"],
    verdicts: [], now: NOW,
  });
  assert.equal(r.suitesRegistered, 1, "a naive diff would count this twice and inflate the denominator");
  assert.ok(r.findings.some((f) => f.kind === "duplicate-registration"));
  assert.equal(r.ok, false);
});

// ---------------------------------------------------------------------- the decider: the two holes

test("an unregistered suite file with no verdict is RED — this is the whole point", () => {
  const r = censusSuites({ onDisk: ["tests/ghost.test.mjs"], registered: [], verdicts: [], now: NOW });
  assert.equal(r.ok, false);
  assert.equal(r.unregisteredCount, 1);
  assert.deepEqual(r.unexplained.map((u) => u.file), ["tests/ghost.test.mjs"]);
  assert.match(r.statement, /invisible, not green/);
});

test("an exemption with no reason FAILS — no silent allowlist", () => {
  for (const reason of [undefined, "", "   ", "we forgot", "TBD", "legacy", "exempt", "short"]) {
    const r = censusSuites({
      onDisk: ["tests/ghost.test.mjs"], registered: [],
      verdicts: [{ file: "tests/ghost.test.mjs", verdict: VERDICTS.EXEMPT, reason }], now: NOW,
    });
    assert.equal(r.ok, false, `reason ${JSON.stringify(reason)} should not excuse anything`);
    assert.equal(r.unexplained[0].why, "verdict carries no real reason");
  }
});

test("an exemption WITH a real reason is accounted for, and the census goes green", () => {
  const r = censusSuites({
    onDisk: ["tests/helper.test.mjs"], registered: [],
    verdicts: [{ file: "tests/helper.test.mjs", verdict: VERDICTS.EXEMPT, reason: "a fixture imported by scenario-suite.mjs, which the runner already registers" }],
    now: NOW,
  });
  assert.equal(r.ok, true);
  assert.equal(r.accounted.exempt.length, 1);
  assert.equal(r.unexplained.length, 0);
});

test("a verdict word nobody defined is not a verdict", () => {
  const r = censusSuites({
    onDisk: ["tests/x.test.mjs"], registered: [],
    verdicts: [{ file: "tests/x.test.mjs", verdict: "probably fine", reason: REASON }], now: NOW,
  });
  assert.equal(r.ok, false);
  assert.match(r.unexplained[0].why, /is not one of/);
});

// ----------------------------------------------------------------------- the decider: the clock

test("a deferred verdict is allowed, and expires — a parking lot with no clock is the same lie", () => {
  const green = censusSuites({
    onDisk: ["tests/x.test.mjs"], registered: [],
    verdicts: [{ file: "tests/x.test.mjs", verdict: VERDICTS.REGISTER_PENDING, reason: REASON, openedAt: daysAgo(3) }],
    now: NOW, maxPendingDays: 14,
  });
  assert.equal(green.ok, true);
  assert.equal(green.accounted.registerPending[0].ageDays, 3);

  const red = censusSuites({
    onDisk: ["tests/x.test.mjs"], registered: [],
    verdicts: [{ file: "tests/x.test.mjs", verdict: VERDICTS.REGISTER_PENDING, reason: REASON, openedAt: daysAgo(15) }],
    now: NOW, maxPendingDays: 14,
  });
  assert.equal(red.ok, false);
  assert.equal(red.expired[0].ageDays, 15);
  assert.match(red.statement, /past their clock/);
});

test("a deferred verdict with no readable openedAt is unexplained, never age zero", () => {
  for (const openedAt of [undefined, "", "not a date", new Date(NOW.getTime() + 86400000).toISOString()]) {
    const r = censusSuites({
      onDisk: ["tests/x.test.mjs"], registered: [],
      verdicts: [{ file: "tests/x.test.mjs", verdict: VERDICTS.REGISTER_PENDING, reason: REASON, openedAt }], now: NOW,
    });
    assert.equal(r.ok, false, `openedAt ${JSON.stringify(openedAt)} must not pass`);
    assert.match(r.unexplained[0].why, /cannot be aged/);
  }
  assert.equal(ageDays(daysAgo(0.4), NOW), 0);
  assert.equal(ageDays(undefined, NOW), null, "a missing stamp is not age 0");
});

// -------------------------------------------------------------- the decider: a ledger that rots

test("a verdict about a file that is now registered, or now gone, is STALE and red", () => {
  const nowRegistered = censusSuites({
    onDisk: ["tests/x.test.mjs"], registered: ["../../tests/x.test.mjs"],
    verdicts: [{ file: "tests/x.test.mjs", verdict: VERDICTS.EXEMPT, reason: "a fixture imported by scenario-suite.mjs, which the runner already registers" }],
    now: NOW,
  });
  assert.equal(nowRegistered.ok, false);
  assert.equal(nowRegistered.staleVerdicts[0].why, "now registered in TESTS");

  const gone = censusSuites({
    onDisk: [], registered: [],
    verdicts: [{ file: "tests/deleted.test.mjs", verdict: VERDICTS.DEAD, reason: "superseded by the consolidated guard in tests/x.test.mjs and deleted" }],
    now: NOW,
  });
  assert.equal(gone.ok, false);
  assert.equal(gone.staleVerdicts[0].why, "no longer on disk");
});

test("two rulings on one file is a broken ledger, not a tie", () => {
  const r = censusSuites({
    onDisk: ["tests/x.test.mjs"], registered: [],
    verdicts: [
      { file: "tests/x.test.mjs", verdict: VERDICTS.EXEMPT, reason: "a fixture imported by scenario-suite.mjs, which the runner already registers" },
      { file: "tests/x.test.mjs", verdict: VERDICTS.DEAD, reason: "superseded by the consolidated guard and kept only for its comment header" },
    ],
    now: NOW,
  });
  assert.equal(r.ok, false);
  assert.ok(r.findings.some((f) => f.kind === "duplicate-verdict"));
});

test("a registered spec pointing at nothing is its own class, named as a broken LIST", () => {
  const r = censusSuites({ onDisk: [], registered: ["../../tests/vanished.test.mjs"], verdicts: [], now: NOW });
  assert.equal(r.ok, false);
  assert.deepEqual(r.registeredMissing, ["tests/vanished.test.mjs"]);
  assert.match(r.statement, /point at nothing/);
});

test("a fully accounted tree is green, and says so in one readable line", () => {
  const r = censusSuites({
    onDisk: ["tests/a.test.mjs", "tests/b.test.mjs"], registered: ["../../tests/a.test.mjs"],
    verdicts: [{ file: "tests/b.test.mjs", verdict: VERDICTS.REGISTER_PENDING, reason: REASON, openedAt: daysAgo(1) }],
    now: NOW,
  });
  assert.equal(r.ok, true);
  assert.equal(r.findings.length, 0);
  assert.match(r.statement, /2 suite files on disk, 1 registered in TESTS/);
  assert.match(statementFor({ ok: true, diskCount: 2, registeredCount: 1, findings: [], unexplained: [], expired: [], registeredMissing: [], accounted: { exempt: [], registerPending: [], dead: [] } }), /every one of the 1 unregistered/);
});

test("isRealReason is the gate on prose, and it is not fooled by length alone", () => {
  assert.equal(isRealReason("imported as a fixture by scenario-suite.mjs"), true);
  assert.equal(isRealReason("exempt"), false);
  assert.equal(isRealReason("no reason"), false);
  assert.equal(isRealReason(null), false);
  assert.equal(DEFAULT_MAX_PENDING_DAYS, 14);
});

// --------------------------------------------------------------------------- the live reading

test("TESTS is read as text, never imported — importing the runner would RUN every suite", () => {
  const src = fs.readFileSync(path.join(ROOT, RUNNER), "utf8");
  const specs = parseRegisteredSpecs(src);
  assert.ok(specs.length > 300, `expected the real registry, got ${specs.length}`);
  assert.ok(specs.every((s) => s.endsWith(".mjs")));
  // A path mentioned in a comment is prose, not a registration.
  const withProse = `const TESTS = [\n  // see ../../tests/mentioned-only.test.mjs for why\n  "../../tests/real.test.mjs",\n];`;
  assert.deepEqual(parseRegisteredSpecs(withProse), ["../../tests/real.test.mjs"]);
});

test("a runner this parse can no longer read is a hard refusal, not a smaller denominator", () => {
  assert.throws(() => parseRegisteredSpecs("const SUITES = [];"), /Refusing to report a denominator/);
});

test("the disk listing finds the suite files and skips node_modules", () => {
  const files = listSuiteFiles(ROOT);
  assert.ok(files.length > 300, `expected a real census, got ${files.length}`);
  assert.ok(files.every((f) => f.endsWith(".test.mjs")));
  assert.ok(!files.some((f) => f.includes("node_modules")));
  assert.ok(files.includes("tests/suite-registry-census.test.mjs"), "this suite is itself on disk and must be seen");
});

test("the ledger exists, and every entry in it carries a verdict and a real reason", () => {
  const { entries, present } = loadLedger(ROOT);
  assert.equal(present, true, `${LEDGER} must exist — a missing ledger excuses nothing`);
  assert.ok(entries.length > 0);
  for (const e of entries) {
    assert.ok(typeof e.file === "string" && e.file, "every entry names a file");
    assert.ok(Object.values(VERDICTS).includes(e.verdict), `${e.file}: ${e.verdict} is not a verdict`);
    assert.equal(isRealReason(e.reason), true, `${e.file}: reason carries no information`);
  }
});

test("THE GATE — no suite file on this disk is unaccounted for", () => {
  const r = runCensus({ root: ROOT });
  assert.ok(r.suitesOnDisk >= r.registeredOnDisk);
  assert.deepEqual(r.unexplained, [], `unregistered and unexplained:\n${r.unexplained.map((u) => `  ${u.file} — ${u.why}`).join("\n")}`);
  assert.deepEqual(r.expired, [], `deferred past the clock:\n${r.expired.map((e) => `  ${e.file} — ${e.ageDays}d`).join("\n")}`);
  assert.deepEqual(r.staleVerdicts, [], `ledger entries that no longer describe the disk:\n${r.staleVerdicts.map((s) => `  ${s.file} — ${s.why}`).join("\n")}`);
  assert.deepEqual(r.registeredMissing, [], "a registered spec points at nothing");
  assert.equal(r.ok, true, r.statement);
});

test("the published counts come from the census, not from a hand-typed number", () => {
  const r = runCensus({ root: ROOT });
  assert.equal(r.sources.registered.from, RUNNER);
  assert.equal(r.sources.verdicts.from, LEDGER);
  assert.equal(r.suitesRegistered, new Set(parseRegisteredSpecs(fs.readFileSync(path.join(ROOT, RUNNER), "utf8")).map((s) => normaliseSpec(s))).size);
  // The universe is the glob PLUS any registered spec present under another name, so on-disk is
  // never smaller than the glob and never larger than the glob plus those.
  const globbed = listSuiteFiles(ROOT).length;
  assert.ok(r.suitesOnDisk >= globbed, "the census may not report fewer files than it globbed");
  assert.equal(r.suitesOnDisk, globbed + r.sources.onDisk.registeredPresentNotGlobbed);
  assert.equal(r.sources.onDisk.globbed, globbed);
});
