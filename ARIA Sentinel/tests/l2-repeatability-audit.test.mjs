// l2-repeatability-audit.test.mjs — RUN-L L2 exit criteria, test-locked.
// Two independent fixture accounts produce correct, DIFFERENT, honest outputs; the hand-entry list
// is real and complete; a deliberately broken second account fails honestly rather than inheriting
// the first account's data; nothing sends (static-scan locked).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  REPEATABILITY_SCHEMA, SENT, NOTHING_SENT, MIN_ACCOUNTS_FOR_VERDICT,
  auditRepeatability, repeatabilityMarkdown,
} from "../src/shared/repeatability-audit.mjs";
import { buildDemandIntake } from "../src/shared/demand-intake.mjs";

const NOW = Date.parse("2026-07-22T00:00:00Z");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function intakeFor(sig) {
  const intake = buildDemandIntake([sig], { now: NOW });
  assert.equal(intake.schema, "demand-intake.v1");
  assert.equal(intake.rows.length, 1);
  return intake;
}

// -- ACCOUNT ONE: real, mid-chain, fully traced (every artifact carries an upstream sourceId) -------
const sigOne = { id: "s-one", kind: "site-enquiry", source: "iisupp.net form", firstSeenAt: "2026-07-01T00:00:00Z",
  email: "it@harbor.example", company: "Harbor", seats: 30, message: "endpoint mess", contactName: "B" };
const intakeOne = intakeFor(sigOne);
const keyOne = intakeOne.rows[0].key;
const accountOne = {
  key: "harbor",
  conveyorInput: {
    intake: intakeOne,
    artifactsByKey: {
      [keyOne]: {
        records: [{ id: "one-eng-1", at: "2026-07-02T00:00:00Z" }],
        proofPack: { schema: "proof-pack.v1", earned: true, pilotId: "one-pilot", sourceId: "one-pp-src" },
      },
    },
  },
};

// -- ACCOUNT TWO: real, further along, its OWN artifact ids; one slot deliberately hand-entered ----
const sigTwo = { id: "s-two", kind: "referral", source: "partner intro", firstSeenAt: "2026-07-01T00:00:00Z",
  email: "cio@northline.example", company: "Northline Logistics", seats: 55, message: "pilot done, quote us", contactName: "C" };
const intakeTwo = intakeFor(sigTwo);
const keyTwo = intakeTwo.rows[0].key;
const accountTwo = {
  key: "northline",
  conveyorInput: {
    intake: intakeTwo,
    artifactsByKey: {
      [keyTwo]: {
        records: [{ id: "two-eng-1", at: "2026-07-03T00:00:00Z" }],
        proofPack: { schema: "proof-pack.v1", earned: true, pilotId: "two-pilot", sourceId: "two-pp-src" },
        // hand-entered: rendered, real shape, but NO upstream sourceId -> must be named as a gap
        closePacket: { schema: "close-packet.v1", rendered: true, customer: "Northline Logistics" },
      },
    },
  },
};

const rep = auditRepeatability({ accounts: [accountOne, accountTwo] }, { now: NOW });

test("same modules, two real accounts, honest output for both", () => {
  assert.equal(rep.schema, REPEATABILITY_SCHEMA);
  assert.equal(rep.accountsIn, 2);
  assert.equal(rep.accountsProduced, 2);
  assert.equal(rep.contamination.length, 0, "no artifact shared across accounts");
  assert.equal(rep.identicalOutputs.length, 0, "two different accounts must not produce identical placements");
  assert.equal(rep.verdict, "repeatable-with-hand-entry");
});

test("outputs are actually DIFFERENT and account-specific", () => {
  const one = rep.results.find((r) => r.key === "harbor");
  const two = rep.results.find((r) => r.key === "northline");
  assert.notDeepEqual(one.conveyor.rows, two.conveyor.rows);
  assert.ok(one.artifactIds.every((id) => !two.artifactIds.includes(id)), "no id crosses accounts");
  assert.ok(one.artifactIds.includes("one-eng-1"));
  assert.ok(two.artifactIds.includes("two-eng-1"));
  // account two is further along the chain than account one
  assert.equal(one.conveyor.rows[0].stage, "evidence");
  assert.equal(two.conveyor.rows[0].stage, "packet");
});

test("hand-entry list is real and complete — the untraced slot is named, the traced ones are not", () => {
  assert.equal(rep.handEntry.length, 1);
  const h = rep.handEntry[0];
  assert.equal(h.account, "northline");
  assert.equal(h.slot, "closePacket");
  assert.match(h.why, /no upstream sourceId/);
  // traced slots must NOT appear
  assert.ok(!rep.handEntry.some((x) => x.slot === "proofPack"));
  assert.ok(!rep.handEntry.some((x) => x.slot === "records"));
});

test("a deliberately broken second account fails honestly and inherits NOTHING", () => {
  const broken = { key: "broken-co", conveyorInput: { intake: null, artifactsByKey: {} } };
  const r = auditRepeatability({ accounts: [accountOne, broken] }, { now: NOW });
  const b = r.results.find((x) => x.key === "broken-co");
  assert.equal(b.ok, false);
  assert.equal(b.failedHonestly, true);
  assert.equal(b.artifactIds.length, 0, "carries no ids at all");
  assert.ok(!JSON.stringify(b).includes("one-eng-1"), "must not inherit account one's evidence");
  assert.ok(typeof b.refusal === "string" && b.refusal.length > 0);
  assert.ok(/invent|refus|never filled/i.test(b.refusal), "refusal states why, honestly");
  assert.equal(r.accountsProduced, 1);
  assert.equal(r.verdict, "not-enough-accounts");
  assert.match(r.statement, /Cannot be stated/);
});

test("contamination is reported, never absorbed", () => {
  const clone = JSON.parse(JSON.stringify(accountTwo));
  clone.key = "copycat";
  // deliberately reuse account one's real engagement id
  clone.conveyorInput.artifactsByKey[keyTwo].records = [{ id: "one-eng-1", at: "2026-07-03T00:00:00Z" }];
  const r = auditRepeatability({ accounts: [accountOne, clone] }, { now: NOW });
  assert.equal(r.verdict, "not-repeatable");
  assert.ok(r.contamination.some((c) => c.artifactId === "one-eng-1"));
  assert.match(r.statement, /NOT repeatable/);
});

test("one account alone can never claim repeatability", () => {
  const r = auditRepeatability({ accounts: [accountOne] }, { now: NOW });
  assert.equal(r.verdict, "not-enough-accounts");
  assert.ok(MIN_ACCOUNTS_FOR_VERDICT >= 2);
  const empty = auditRepeatability({}, { now: NOW });
  assert.equal(empty.accountsIn, 0);
  assert.equal(empty.verdict, "not-enough-accounts");
});

test("nothing sends: flags + markdown carries the staged-only law", () => {
  assert.equal(SENT, false);
  assert.equal(NOTHING_SENT, true);
  assert.equal(rep.sent, false);
  assert.equal(rep.nothingSent, true);
  const md = repeatabilityMarkdown(rep);
  assert.ok(/does not|Read-only audit/i.test(md));
  assert.ok(/Hand-entry still required/.test(md));
  assert.ok(/nothing here sends, signs, or charges/i.test(md));
  assert.equal(repeatabilityMarkdown(null), "_no repeatability audit_");
});

test("STATIC-SCAN LOCK: the source has no send/network/exec class at all", () => {
  const src = readFileSync(path.join(__dirname, "../src/shared/repeatability-audit.mjs"), "utf8");
  const forbidden = [
    /\bfetch\s*\(/, /XMLHttpRequest/, /\bhttps?:\/\//, /nodemailer/, /sendmail/i,
    /child_process/, /\bexec(Sync)?\s*\(/, /\bspawn\s*\(/, /net\.(connect|Socket)/, /\brequest\s*\(/,
    /readFileSync/, /writeFileSync/,
  ];
  for (const re of forbidden) {
    assert.ok(!re.test(src), `repeatability-audit.mjs must not contain ${re}`);
  }
});

test("NO PER-ACCOUNT SPECIAL CASE: the source names no fixture account", () => {
  const src = readFileSync(path.join(__dirname, "../src/shared/repeatability-audit.mjs"), "utf8");
  for (const name of ["harbor", "northline", "copycat", "broken-co"]) {
    assert.ok(!new RegExp(name, "i").test(src), `source must not special-case "${name}" — zero bespoke code`);
  }
});
