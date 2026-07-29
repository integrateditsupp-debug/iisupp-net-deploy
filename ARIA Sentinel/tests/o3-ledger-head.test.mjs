// o3-ledger-head.test.mjs — RUN-O O3 exit criteria, test-locked.
// ONE TRUTH, THREE SURFACES: the AXIS status headline, the operator brief and the ledger head
// cannot disagree without this suite going red. Zero renders as zero everywhere. The ledger's
// history below the generated head stays byte-identical (Rule 15).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  LEDGER_HEAD_SCHEMA, SENT, SIGNED, CHARGED, NOTHING_SENT, BEGIN_MARKER, END_MARKER,
  buildLedgerHead, ledgerHeadFacts, ledgerHeadIsMomentumSafe, applyLedgerHead,
} from "../src/shared/ledger-head.mjs";
import { buildOperatorBrief, operatorBriefFacts } from "../src/shared/operator-brief.mjs";
import { normalizeProgramTruth, factsOf, momentumSafe, UNKNOWN } from "../src/shared/program-truth.mjs";
import { ZERO_SENT_STATEMENT, NO_REVENUE_STATEMENT } from "../src/shared/ask-ledger.mjs";

const NOW = Date.parse("2026-07-28T00:00:00Z");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const truthRaw = {
  program: { series: "CLIENT-READY", sequence: "RUN-O", tasksMerged: 3, tasksTotal: 3, exitCriteriaMet: true },
  tests: { green: 299, total: 302, effectiveGreen: 302, effectiveTotal: 302 },
  mainRef: { value: "abc1234", source: "last-known local tracking ref", liveConfirmed: false },
  unpushed: { commits: 36 },
  revenue: { receivedCad: 0, asksSent: 0 },
};

test("O3: belt-and-braces — nothing is sent, signed or charged", () => {
  assert.equal(SENT, false);
  assert.equal(SIGNED, false);
  assert.equal(CHARGED, false);
  assert.equal(NOTHING_SENT, true);
});

test("O3: the head answers all five questions in a handful of lines", () => {
  const h = buildLedgerHead(truthRaw, { now: NOW });
  assert.equal(h.schema, LEDGER_HEAD_SCHEMA);
  // RUN-Q Q3 added a fourth revenue number (candidates), RUN-R R3 added a fifth (conversations held,
  // stated FIRST because it is the constraint) and RUN-S S3 added a sixth (hours spent, stated
  // immediately beside it because a zero above with no hours beneath it is ambiguous), so the head is
  // TEN lines. The count is asserted explicitly rather than loosely, so an eleventh line has to be a
  // deliberate decision made in this file rather than something that drifts in unnoticed.
  assert.equal(h.lines.length, 11); // RUN-T T2 made it eleven: "how long since an hour was spent" is a DELIBERATE eleventh line, added here on purpose.
  assert.ok(h.lines[1].startsWith("- **Hours spent:**"), "hours spent has its own line, immediately beneath the number it qualifies");
  assert.ok(h.lines[2].startsWith("- **How long since an hour was spent:**"),
    "RUN-T T2: elapsed-since is the third line, beneath the two numbers it qualifies - a `never` here is not a zero above");
  assert.ok(h.lines.some((l) => l.includes("Candidates recorded")), "candidates has its own line");
  assert.ok(h.lines.some((l) => l.startsWith("- **Conversations held:**")), "conversations held has its own line");
  assert.ok(h.lines[0].startsWith("- **Conversations held:**"), "conversations held is stated FIRST - before the sequence and before the suite");
  assert.match(h.text, /Published line/);
  assert.match(h.text, /Verified but unpublished/);
  assert.match(h.text, /Tests/);
  assert.match(h.text, /Asks sent/);
  assert.match(h.text, /Revenue received/);
});

test("O3 — THE DRIFT LOCK: the three surfaces cannot disagree", () => {
  const truth = normalizeProgramTruth(truthRaw, { now: NOW });
  const head = buildLedgerHead(truth, { now: NOW });
  const brief = buildOperatorBrief({ truth }, { now: NOW });

  const axisFacts = factsOf(truth);          // surface 1 — what the AXIS feed is emitted from
  const briefFacts = operatorBriefFacts(brief); // surface 2 — the operator brief
  const headFacts = ledgerHeadFacts(head);      // surface 3 — the ledger head

  assert.deepEqual(briefFacts, axisFacts);
  assert.deepEqual(headFacts, axisFacts);
  assert.deepEqual(headFacts, briefFacts);
});

test("O3 — THE DRIFT LOCK bites: a surface built from a different truth fails", () => {
  const a = normalizeProgramTruth(truthRaw, { now: NOW });
  const b = normalizeProgramTruth({ ...truthRaw, revenue: { receivedCad: 900, asksSent: 4 } }, { now: NOW });
  const head = buildLedgerHead(a, { now: NOW });
  const brief = buildOperatorBrief({ truth: b }, { now: NOW });
  assert.notDeepEqual(ledgerHeadFacts(head), operatorBriefFacts(brief),
    "if two surfaces ever read different truths, this comparison must fail — that is the lock");
});

test("O3: zero renders as zero, in M3's own words, on every surface", () => {
  const truth = normalizeProgramTruth(truthRaw, { now: NOW });
  const head = buildLedgerHead(truth, { now: NOW });
  const brief = buildOperatorBrief({ truth }, { now: NOW });
  assert.equal(truth.revenue.revenueStatement, NO_REVENUE_STATEMENT);
  assert.equal(truth.revenue.asksStatement, ZERO_SENT_STATEMENT);
  assert.ok(head.text.includes(NO_REVENUE_STATEMENT));
  assert.ok(head.text.includes(ZERO_SENT_STATEMENT));
  assert.equal(brief.revenueStatement, NO_REVENUE_STATEMENT);
  assert.equal(brief.asksStatement, ZERO_SENT_STATEMENT);
});

test("O3: no trend language over a zero series", () => {
  const h = buildLedgerHead(truthRaw, { now: NOW });
  assert.ok(ledgerHeadIsMomentumSafe(h));
  assert.equal(momentumSafe("revenue is trending upward"), false, "the guard must actually bite");
});

test("O3: an unproven fact reads as unknown, never as a flattering default", () => {
  const t = normalizeProgramTruth({}, { now: NOW });
  assert.equal(t.program.sequence, UNKNOWN);
  assert.equal(t.tests.testsGreen, false, "unknown is never green");
  assert.equal(t.mainRef.liveConfirmed, false, "a ref is confirmed only on an explicit true");
  assert.equal(t.revenue.receivedCad, 0);
  const h = buildLedgerHead(t, { now: NOW });
  assert.match(h.text, /not established/);
});

test("O3: Rule 15 — the ledger history below the head is untouched", () => {
  const history = "## RUN 1\n\nsomething that happened\n\n## RUN 2\n\nsomething else\n";
  const h1 = buildLedgerHead(truthRaw, { now: NOW });

  const first = applyLedgerHead(history, h1);
  assert.equal(first.replaced, false);
  assert.ok(first.text.endsWith(history), "every byte of the original document survives, in order");

  const h2 = buildLedgerHead({ ...truthRaw, unpushed: { commits: 0 } }, { now: NOW });
  const second = applyLedgerHead(first.text, h2);
  assert.equal(second.replaced, true);
  assert.ok(second.text.includes(history), "regenerating the head leaves the history alone");
  assert.ok(second.text.includes("Nothing is verified-but-unpublished."));
  assert.equal(second.text.indexOf(BEGIN_MARKER) === second.text.lastIndexOf(BEGIN_MARKER), true, "exactly one head");
  assert.equal(second.text.indexOf(END_MARKER) === second.text.lastIndexOf(END_MARKER), true);
});

test("O3: the head is generated, not hand-written — change the truth, the head changes", () => {
  const a = buildLedgerHead(truthRaw, { now: NOW }).text;
  const b = buildLedgerHead({ ...truthRaw, tests: { effectiveGreen: 300, effectiveTotal: 302 } }, { now: NOW }).text;
  assert.notEqual(a, b);
  assert.match(b, /300\/302/);
});

test("O3: static-scan — the head builder is send-incapable and cannot reach the filesystem", () => {
  const bad = [/\bfetch\s*\(/, /XMLHttpRequest/, /nodemailer/, /child_process/, /\bspawn\s*\(/, /sendMail/, /smtp/i, /node:fs/, /node:net/, /node:http/];
  for (const mod of ["ledger-head.mjs", "program-truth.mjs", "operator-brief.mjs", "first-account-walk.mjs"]) {
    const src = readFileSync(path.join(__dirname, "../src/shared/", mod), "utf8");
    for (const re of bad) assert.ok(!re.test(src), `${mod} must not contain ${re}`);
  }
});
