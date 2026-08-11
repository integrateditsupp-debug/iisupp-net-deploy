// AZ1 — what this company could notice, and what it cannot.
//
// The reds that matter here all defend the same thing: this module must never report an event as
// observable that nothing retains, and must never close a gap by inventing a metric.
//
// The dangerous failure is generosity. A check that treats "a function exists for this" as "we can
// see this" would report a company with no retained events as fully instrumented, and the first time
// anybody trusted that report would be the day a customer asked why nobody noticed.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import {
  auditChurnSignals,
  auditSignal,
  inspectReceiver,
  statementFor,
  CHURN_SIGNALS,
  SIGNAL,
  CHURN_SIGNAL_SCHEMA,
  OBSERVABILITY_REGISTER,
} from "../scripts/lib/churn-signals.mjs";

const root = path.resolve(import.meta.dirname, "..");

function repo(committed) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "churn-signals-repo-"));
  const git = (...a) => execFileSync("git", a, { cwd: dir, stdio: ["ignore", "pipe", "ignore"] });
  git("init", "-q");
  git("config", "user.email", "t@example.invalid");
  git("config", "user.name", "t");
  for (const [rel, text] of Object.entries(committed)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  git("add", "-A");
  git("commit", "-q", "-m", "c");
  return dir;
}

const RETAINS = `
import { getStore } from '@netlify/blobs';
export default async () => {
  const s = getStore({ name: 'aria-sessions', consistency: 'strong' });
  await s.setJSON('k', { at: Date.now() });
  return new Response('ok');
};
`;

const READS = `
import { getStore } from '@netlify/blobs';
export default async () => {
  const s = getStore({ name: 'aria-sessions', consistency: 'strong' });
  const listing = await s.list();
  return Response.json(listing);
};
`;

const TRANSIENT = `
export default async () => {
  await fetch('https://api.resend.com/emails', { method: 'POST' });
  console.log('sent');
  return new Response('ok');
};
`;

test("AZ1 — the real tree audits clean, and no score is computed", () => {
  const r = auditChurnSignals({ root });
  assert.equal(r.schema, CHURN_SIGNAL_SCHEMA);
  assert.equal(r.scoreComputed, false);
  assert.equal(r.engagementMetricInvented, false);
  assert.equal(r.sent, false);
  assert.equal(r.stored, false);
  assert.equal(r.summary.ok, true, statementFor(r));
});

test("AZ1 — no health score, churn risk or engagement percentage appears anywhere in the output", () => {
  const r = auditChurnSignals({ root });
  const flat = JSON.stringify(r);
  // A number derived from signals this module exists to prove we do not have is a fabricated metric
  // with a chart on it. It may not appear even as a field name.
  assert.doesNotMatch(flat, /healthScore|churnRisk|engagementScore|riskScore|"score"\s*:\s*\d/i);
});

test("AZ1 RED — an event that is received and retained by nothing is TRANSIENT, never observable", () => {
  const dir = repo({ "fn/notify.mjs": TRANSIENT });
  const a = auditSignal(
    { id: "s", question: "q", receivers: ["fn/notify.mjs"], commitments: [] },
    { root: dir },
  );
  assert.equal(a.state, SIGNAL.TRANSIENT);
  assert.match(a.why, /retains nothing/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("AZ1 RED — an event stored with nothing reading it back is RETAINED-UNREAD, its own class", () => {
  const dir = repo({ "fn/write.mjs": RETAINS });
  const a = auditSignal(
    { id: "s", question: "q", receivers: ["fn/write.mjs"], commitments: [] },
    { root: dir },
  );
  // Not rounded up to observable — the question cannot be asked — and not down to transient, because
  // the data is there and this is the cheapest class in the list to close.
  assert.equal(a.state, SIGNAL.RETAINED_UNREAD);
  assert.match(a.why, /nothing in the shared line reads it back/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("AZ1 GREEN — retained by one file and read by another is observable across the pair", () => {
  const dir = repo({ "fn/write.mjs": RETAINS, "fn/read.mjs": READS });
  const a = auditSignal(
    { id: "s", question: "q", receivers: ["fn/write.mjs", "fn/read.mjs"], commitments: [] },
    { root: dir },
  );
  assert.equal(a.state, SIGNAL.OBSERVABLE);
  assert.equal(a.why, null);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("AZ1 — a reader of a DIFFERENT store than the one written is not a read of this event", () => {
  const other = READS.replace("aria-sessions", "aria-bookings");
  const dir = repo({ "fn/write.mjs": RETAINS, "fn/read.mjs": other });
  const a = auditSignal(
    { id: "s", question: "q", receivers: ["fn/write.mjs", "fn/read.mjs"], commitments: [] },
    { root: dir },
  );
  assert.equal(a.state, SIGNAL.RETAINED_UNREAD);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("AZ1 — a `.set(` with no store handle is not persistence", () => {
  const dir = repo({
    "fn/mapish.mjs": "const seen = new Map();\nexport default () => { seen.set('k', 1); };\n",
  });
  const i = inspectReceiver("fn/mapish.mjs", { root: dir });
  // A Set or a Map forgets the moment the function returns. Matching it would report this
  // environment as observing things it cannot remember for one second, let alone three weeks.
  assert.equal(i.present, true);
  assert.equal(i.retains, false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("AZ1 — a named receiver absent from HEAD is UNSOURCED with the absent file named", () => {
  const dir = repo({ "fn/other.mjs": RETAINS });
  const a = auditSignal(
    { id: "s", question: "q", receivers: ["fn/missing.mjs"], commitments: [] },
    { root: dir },
  );
  assert.equal(a.state, SIGNAL.UNSOURCED);
  assert.match(a.why, /fn\/missing\.mjs/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("AZ1 — a working-copy-only receiver does not count: HEAD's tree is the source", () => {
  const dir = repo({ "fn/read.mjs": READS });
  fs.writeFileSync(path.join(dir, "fn/write.mjs"), RETAINS);
  const a = auditSignal(
    { id: "s", question: "q", receivers: ["fn/write.mjs", "fn/read.mjs"], commitments: [] },
    { root: dir },
  );
  // A clone receives nothing of it, so it cannot be part of what this company can observe.
  assert.notEqual(a.state, SIGNAL.OBSERVABLE);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("AZ1 RED — a support commitment no signal claims and nobody declared goes red BY NAME", () => {
  const r = auditChurnSignals({
    root,
    signals: [{ id: "only", question: "q", receivers: [], commitments: [] }],
    commitments: [{ id: "a-promise-nobody-watches" }],
    registerFile: "docs/DOES-NOT-EXIST.md",
  });
  assert.deepEqual(r.coverage.unclaimedCommitments, ["a-promise-nobody-watches"]);
  assert.equal(r.summary.ok, false);
});

test("AZ1 — a declared unobservable commitment is reported and does NOT hold the audit red", () => {
  const r = auditChurnSignals({ root });
  // The real register carries the promises kept by a person doing something a person should do.
  assert.ok(r.coverage.declaredUnobservable.length > 0);
  assert.deepEqual(r.coverage.unclaimedCommitments, []);
  assert.equal(r.summary.ok, true);
});

test("AZ1 RED — a declaration for a commitment a signal now covers is STALE and goes red", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "churn-reg-"));
  fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "docs/REG.md"),
    "| topic | state | reason | who decides |\n| --- | --- | --- | --- |\n" +
      "| covered | open | this promise is claimed by a signal already and the register has rotted around it | Ahmad |\n",
  );
  const r = auditChurnSignals({
    root: dir,
    signals: [{ id: "s", question: "q", receivers: [], commitments: ["covered"] }],
    commitments: [{ id: "covered" }],
    registerFile: "docs/REG.md",
  });
  assert.deepEqual(r.coverage.staleDeclarations, ["covered"]);
  assert.equal(r.summary.ok, false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("AZ1 RED — a rubber-stamp declaration is REFUSED and goes red", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "churn-reg2-"));
  fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "docs/REG.md"),
    "| topic | state | reason | who decides |\n| --- | --- | --- | --- |\n| uptime | open | later | Ahmad |\n",
  );
  const r = auditChurnSignals({
    root: dir,
    signals: [{ id: "s", question: "q", receivers: [], commitments: [] }],
    commitments: [{ id: "uptime" }],
    registerFile: "docs/REG.md",
  });
  assert.equal(r.coverage.refusedDeclarations.length, 1);
  assert.equal(r.summary.ok, false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("AZ1 RED — a signal claiming a commitment that no longer exists is a mapping that has rotted", () => {
  const r = auditChurnSignals({
    root,
    signals: [{ id: "s", question: "q", receivers: [], commitments: ["renamed-away"] }],
    commitments: [],
    registerFile: "docs/DOES-NOT-EXIST.md",
  });
  assert.deepEqual(r.coverage.danglingClaims, ["renamed-away"]);
  assert.equal(r.summary.ok, false);
});

test("AZ1 RED — two signals claiming one commitment is an unowned promise wearing two hats", () => {
  const r = auditChurnSignals({
    root,
    signals: [
      { id: "a", question: "q", receivers: [], commitments: ["shared"] },
      { id: "b", question: "q", receivers: [], commitments: ["shared"] },
    ],
    commitments: [{ id: "shared" }],
    registerFile: "docs/DOES-NOT-EXIST.md",
  });
  assert.deepEqual(r.coverage.doubleClaimed, ["shared"]);
  assert.equal(r.summary.ok, false);
});

test("AZ1 — the register named by the module is the one in the tree, and it is readable", () => {
  const abs = path.join(root, OBSERVABILITY_REGISTER);
  assert.ok(fs.existsSync(abs), `${OBSERVABILITY_REGISTER} must exist — a declared gap needs somewhere to be declared`);
  const r = auditChurnSignals({ root });
  assert.equal(r.coverage.registerPresent, true);
});

test("AZ1 — every signal carries who it costs and what it costs them", () => {
  for (const s of CHURN_SIGNALS) {
    assert.ok(s.who && s.who.length > 10, `${s.id} must name who is hurt`);
    assert.ok(s.costs && s.costs.length > 30, `${s.id} must state the cost in a sentence a person wrote`);
  }
});

test("AZ1 — an unreadable tree reports UNSOURCED rather than silently green", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "churn-nogit-"));
  const a = auditSignal({ id: "s", question: "q", receivers: ["fn/x.mjs"], commitments: [] }, { root: dir });
  assert.equal(a.state, SIGNAL.UNSOURCED);
  fs.rmSync(dir, { recursive: true, force: true });
});
