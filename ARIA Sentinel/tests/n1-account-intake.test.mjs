// n1-account-intake.test.mjs — RUN-N N1 exit criteria, test-locked.
// a real account records end to end from fixtures; missing fields are named in M1's OWN gate
// vocabulary; nothing is defaulted, inferred or backdated; an empty intake is a valid state.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  ACCOUNT_INTAKE_SCHEMA, SENT, SIGNED, CHARGED, NOTHING_SENT, EMPTY_STATEMENT,
  GATES, GATE_KEYS, buildAccountIntake, intakeRecord, missingForAskReady, accountIntakeMarkdown,
} from "../src/shared/account-intake.mjs";
import { GATES as M1_GATES, GATE_KEYS as M1_GATE_KEYS } from "../src/shared/ask-ready-queue.mjs";

const NOW = Date.parse("2026-07-28T00:00:00Z");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const completeAccount = {
  key: "northline-logistics",
  demandSignal: {
    id: "sig-1", kind: "site-enquiry", source: "iisupp.net contact form",
    firstSeenAt: "2026-06-02T09:00:00Z", email: "cio@northline.example", company: "Northline Logistics",
  },
  engagements: [
    { id: "eng-1", at: "2026-06-10T13:00:00Z", durationMinutes: 300, source: "ticket log" },
    { id: "eng-2", at: "2026-06-24T13:00:00Z", durationMinutes: 300, source: "ticket log" },
    { id: "eng-3", at: "2026-07-08T13:00:00Z", durationMinutes: 200, source: "ticket log" },
  ],
  costBasis: { sourceId: "cost-basis-2026-07", monthlyOperatorCostCad: 4000, monthlyAvailableMinutes: 8000 },
  quoteCad: 1200,
  quoteSource: "quote-2026-07-20 (operator)",
};

test("N1: an empty intake is a valid state and says so plainly", () => {
  const out = buildAccountIntake({}, { now: NOW });
  assert.equal(out.schema, ACCOUNT_INTAKE_SCHEMA);
  assert.equal(out.empty, true);
  assert.equal(out.statement, EMPTY_STATEMENT);
  assert.deepEqual(out.records, []);
  assert.equal(out.counts.recorded, 0);
  // no momentum language anywhere in an empty state
  assert.ok(!/warm|nearly|almost|in motion|pipeline/i.test(out.statement));
});

test("N1: belt-and-braces flags — nothing is sent, signed or charged", () => {
  assert.equal(SENT, false);
  assert.equal(SIGNED, false);
  assert.equal(CHARGED, false);
  assert.equal(NOTHING_SENT, true);
  const out = buildAccountIntake({ account: completeAccount }, { now: NOW });
  assert.equal(out.sent, false);
  assert.equal(out.nothingSent, true);
});

test("N1: the gate vocabulary IS M1's — imported, never re-declared, so it cannot drift", () => {
  assert.deepEqual(GATE_KEYS, M1_GATE_KEYS);
  assert.equal(GATES, M1_GATES);
  const src = readFileSync(path.join(__dirname, "../src/shared/account-intake.mjs"), "utf8");
  assert.ok(/import \{ GATES, GATE_KEYS \} from "\.\/ask-ready-queue\.mjs"/.test(src),
    "N1 must import the gates from M1 rather than restate them");
});

test("N1: a real account records end to end from fixtures", () => {
  const out = buildAccountIntake({ account: completeAccount }, { now: NOW });
  assert.equal(out.empty, false);
  const rec = intakeRecord(out, "northline-logistics");
  assert.ok(rec);
  assert.equal(rec.complete, true);
  assert.deepEqual(rec.missing, []);
  assert.equal(rec.engagements.length, 3);
  assert.equal(rec.engagementMinutes, 800);
  assert.equal(rec.quoteCad, 1200);
  assert.equal(rec.costBasis.monthlyOperatorCostCad, 4000);
  assert.deepEqual(missingForAskReady(out, "northline-logistics"), []);
});

test("N1: missing fields are named with M1's gate vocabulary, in M1's order", () => {
  const bare = { key: "bare-co", demandSignal: completeAccount.demandSignal };
  const out = buildAccountIntake({ account: bare }, { now: NOW });
  const rec = intakeRecord(out, "bare-co");
  assert.equal(rec.complete, false);
  assert.deepEqual(rec.missing, ["engagement", "evidence", "priced"]);
  // every text comes from M1's own GATES table
  for (const [i, g] of rec.missing.entries()) {
    assert.equal(rec.missingText[i], M1_GATES.find((x) => x.key === g).missing);
  }
});

test("N1: an unsourced fact is refused and named — never accepted just this once", () => {
  const unsourced = {
    ...completeAccount,
    engagements: [{ id: "eng-x", at: "2026-06-10T13:00:00Z", durationMinutes: 300 }],
  };
  const rec = intakeRecord(buildAccountIntake({ account: unsourced }, { now: NOW }), "northline-logistics");
  assert.equal(rec.engagements.length, 0);
  assert.ok(rec.problems.some((p) => /source/.test(p.field) && /excluded/.test(p.why)));
  assert.ok(rec.missing.includes("engagement"));
});

test("N1: an unsourced cost basis cannot produce a floor", () => {
  const noSource = { ...completeAccount, costBasis: { monthlyOperatorCostCad: 4000, monthlyAvailableMinutes: 8000 } };
  const rec = intakeRecord(buildAccountIntake({ account: noSource }, { now: NOW }), "northline-logistics");
  assert.ok(rec.missing.includes("priced"));
  assert.ok(rec.problems.some((p) => p.field === "costBasis.sourceId"));
  assert.equal(rec.costBasis, null);
});

test("N1: an unsourced quote is refused — an unsourced price cannot be defended", () => {
  const noQuoteSource = { ...completeAccount, quoteSource: undefined };
  const rec = intakeRecord(buildAccountIntake({ account: noQuoteSource }, { now: NOW }), "northline-logistics");
  assert.equal(rec.quoteCad, null);
  assert.ok(rec.missing.includes("priced"));
  assert.ok(rec.problems.some((p) => p.field === "quoteSource"));
});

test("N1: nothing is backdated or inferred — a future or unparseable timestamp is refused", () => {
  const future = {
    ...completeAccount,
    engagements: [
      { id: "eng-future", at: "2027-01-01T00:00:00Z", durationMinutes: 100, source: "ticket log" },
      { id: "eng-bad", at: "sometime in June", durationMinutes: 100, source: "ticket log" },
    ],
  };
  const rec = intakeRecord(buildAccountIntake({ account: future }, { now: NOW }), "northline-logistics");
  assert.equal(rec.engagements.length, 0);
  assert.ok(rec.problems.some((p) => /future/.test(p.why)));
  assert.ok(rec.problems.some((p) => /unparseable/.test(p.why)));
});

test("N1: minutes are never estimated — a missing or zero duration excludes the event", () => {
  const noMins = {
    ...completeAccount,
    engagements: [
      { id: "eng-1", at: "2026-06-10T13:00:00Z", source: "ticket log" },
      { id: "eng-2", at: "2026-06-11T13:00:00Z", durationMinutes: 0, source: "ticket log" },
      { id: "eng-3", at: "2026-06-12T13:00:00Z", durationMinutes: 45, source: "ticket log" },
    ],
  };
  const rec = intakeRecord(buildAccountIntake({ account: noMins }, { now: NOW }), "northline-logistics");
  assert.equal(rec.engagements.length, 1);
  assert.equal(rec.engagementMinutes, 45);
  assert.equal(rec.problems.filter((p) => /durationMinutes/.test(p.field)).length, 2);
});

test("N1: a signal with no identity cannot be recorded honestly", () => {
  const noIdentity = {
    ...completeAccount,
    demandSignal: { id: "sig-2", kind: "referral", source: "phone note", firstSeenAt: "2026-06-02T09:00:00Z" },
  };
  const rec = intakeRecord(buildAccountIntake({ account: noIdentity }, { now: NOW }), "northline-logistics");
  assert.equal(rec.demandSignal, null);
  assert.ok(rec.missing.includes("demand"));
});

test("N1: an account with no key is excluded, never given one", () => {
  const out = buildAccountIntake({ accounts: [{ demandSignal: completeAccount.demandSignal }] }, { now: NOW });
  assert.equal(out.records.length, 0);
  assert.equal(out.excluded.length, 1);
  assert.match(out.excluded[0].why, /no account key/);
});

test("N1: an unknown key reports no record rather than a nearest match", () => {
  const out = buildAccountIntake({ account: completeAccount }, { now: NOW });
  assert.equal(intakeRecord(out, "some-other-co"), null);
  const missing = missingForAskReady(out, "some-other-co");
  assert.equal(missing.length, 1);
  assert.match(missing[0].note, /no intake record/);
});

test("N1: deterministic — same input, same output", () => {
  const a = buildAccountIntake({ account: completeAccount }, { now: NOW });
  const b = buildAccountIntake({ account: completeAccount }, { now: NOW });
  assert.deepEqual(a, b);
});

test("N1: markdown carries the privacy + no-backdate notes and never invents a row", () => {
  const md = accountIntakeMarkdown(buildAccountIntake({}, { now: NOW }));
  assert.match(md, /LOCAL ONLY/);
  assert.ok(!/northline/i.test(md));
});

test("N1: static-scan — no send, transport, spawn or filesystem reach", () => {
  const src = readFileSync(path.join(__dirname, "../src/shared/account-intake.mjs"), "utf8");
  for (const bad of [/\bfetch\s*\(/, /XMLHttpRequest/, /nodemailer/, /child_process/, /\bspawn\s*\(/, /\bexec\s*\(/, /node:fs/, /require\(['"]fs['"]\)/, /sendMail/, /smtp/i]) {
    assert.ok(!bad.test(src), `N1 must not contain ${bad}`);
  }
});
