// r2-conversation-outcome.test.mjs — RUN-R R2 exit criteria, test-locked.
// An outcome records end to end including every negative form; nothing softens or defers a "no";
// recorded outcomes flow into Q1/Q2/N1 without retyping; an empty log reads as zero conversations.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  CONVERSATION_OUTCOME_SCHEMA, SENT, SIGNED, CHARGED, NOTHING_SENT,
  PERSISTS, HAS_TRANSPORT, TRACKED, SERVEABLE, CAN_ASSERT_REAL_ACCOUNT,
  OUTCOMES, OUTCOME_KEYS, NEGATIVE_OUTCOME_KEYS, ENGAGEMENT_OUTCOME_KEYS,
  REQUIRED_FIELDS, REQUIRED_KEYS, SOFTENING_LABELS, EMPTY_STATEMENT,
  recordOutcome, buildOutcomeLog, conversationsHeldFrom, provenanceFor,
  factForCandidate, engagementFactForIntake, assertRealAccount,
  outcomeLogIsMomentumSafe, outcomeLogMarkdown, softeningIn,
} from "../src/shared/conversation-outcome.mjs";
import { recordCandidate } from "../src/shared/candidate-record.mjs";
import { scoreCandidate } from "../src/shared/candidate-fit.mjs";
import { GATE_KEYS } from "../src/shared/account-intake.mjs";

const NOW = Date.parse("2026-07-28T00:00:00Z");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE = {
  candidateKey: "cand-001",
  heldAt: "2026-07-28",
  who: "their ops manager",
  said: "he said the overnight on-call is the thing that makes people quit",
  enteredBy: "Ahmad",
};

function held(outcome, extra = {}) {
  const r = recordOutcome({ ...BASE, outcome, ...extra }, { now: NOW });
  assert.equal(r.refused, false, `fixture must record ${outcome}: ${r.reason || ""}`);
  return r;
}

test("R2: belt-and-braces — an outcome sends nothing, persists nothing, promotes nobody", () => {
  assert.equal(SENT, false);
  assert.equal(SIGNED, false);
  assert.equal(CHARGED, false);
  assert.equal(NOTHING_SENT, true);
  assert.equal(PERSISTS, false);
  assert.equal(HAS_TRANSPORT, false);
  assert.equal(TRACKED, false);
  assert.equal(SERVEABLE, false);
  assert.equal(CAN_ASSERT_REAL_ACCOUNT, false);
  assert.throws(() => assertRealAccount(), /cannot assert a real account/);
});

test("R2: an outcome records end to end from real input", () => {
  const r = held("engaged");
  assert.equal(r.schema, CONVERSATION_OUTCOME_SCHEMA);
  assert.equal(r.recorded, true);
  assert.equal(r.outcome, "engaged");
  assert.equal(r.engagement, true);
  assert.equal(r.negative, false);
  assert.equal(r.who, BASE.who);
  assert.equal(r.said, BASE.said);
  assert.equal(r.heldAt, "2026-07-28");
  assert.equal(r.countsAsConversationHeld, true);
});

test("R2: EVERY negative form is first-class and costs exactly what a positive costs", () => {
  for (const key of ["no", "no-reply", "wrong-person", "wrong-problem", "could-not-reach"]) {
    assert.ok(NEGATIVE_OUTCOME_KEYS.includes(key), `${key} is a recorded negative`);
    const r = held(key);
    assert.equal(r.recorded, true, `${key} records`);
    assert.equal(r.negative, true);
    assert.equal(r.engagement, false, `${key} is never an engagement`);
    // The asymmetry test: a negative needs the SAME fields as the positive, no more.
    const positive = held("engaged");
    assert.deepEqual(Object.keys(r).sort(), Object.keys(positive).sort(),
      `${key} produces the same record shape as a positive — no extra bureaucracy for bad news`);
  }
  assert.deepEqual(ENGAGEMENT_OUTCOME_KEYS, ["engaged"], "exactly one outcome is an engagement");
});

test("R2: nothing softens, defers, re-labels or expires a no", () => {
  const r = held("no");
  assert.equal(r.open, false);
  assert.equal(r.expiresAt, null, "there is no expiry a dead conversation can drift into");
  assert.equal(r.deferred, false);
  assert.equal(r.softened, false);
  assert.ok(/closed here/.test(r.statement));
  // No neutral, pending or maybe outcome exists to fall back on.
  for (const forbidden of ["pending", "maybe", "follow-up-later", "nurture", "warm", "tbd", "open"]) {
    assert.ok(!OUTCOME_KEYS.includes(forbidden), `there is no "${forbidden}" outcome`);
  }
});

test("R2: a softening label anywhere in the record is REFUSED and quoted back", () => {
  for (const phrase of ["nurture", "warm lead", "circle back", "not a no", "keep on the radar"]) {
    const r = recordOutcome({ ...BASE, outcome: "no", note: `will ${phrase} in the autumn` }, { now: NOW });
    assert.equal(r.refused, true, `"${phrase}" must be refused`);
    assert.ok(r.problems.some((p) => p.includes(`"${phrase}"`)), `the refusal quotes "${phrase}" back verbatim`);
  }
  const inSaid = recordOutcome({ ...BASE, outcome: "no", said: "he said it is a soft no for now" }, { now: NOW });
  assert.equal(inSaid.refused, true, "softening in the account of what was said is refused too");
  assert.equal(softeningIn("we will keep warm"), "keep warm");
  assert.equal(softeningIn("he said no"), null);
  // Longest match wins so the real phrase is reported, not a fragment of it.
  assert.equal(softeningIn("a warm lead, really"), "warm lead");
});

test("R2: every missing field is named AT ONCE, and there is no neutral fallback", () => {
  const r = recordOutcome({}, { now: NOW });
  assert.equal(r.refused, true);
  assert.equal(r.recorded, false);
  for (const f of REQUIRED_FIELDS) {
    assert.ok(r.problems.some((p) => p.startsWith(f.label + ":")), `names the missing ${f.key} by label`);
  }
  assert.equal(r.problems.length, REQUIRED_KEYS.length, "all of them, in one pass");
});

test("R2: an approximate date and an unknown outcome are both refused by name", () => {
  const bad = recordOutcome({ ...BASE, heldAt: "last week", outcome: "no" }, { now: NOW });
  assert.equal(bad.refused, true);
  assert.ok(bad.problems.some((p) => /not a real date/.test(p)));

  const madeUp = recordOutcome({ ...BASE, outcome: "kind-of-interested" }, { now: NOW });
  assert.equal(madeUp.refused, true);
  assert.ok(madeUp.problems.some((p) => p.includes('"kind-of-interested"') && p.includes("deliberate decision made in this file")));
});

test("R2: an account of what was said may not admit it was reconstructed", () => {
  const r = recordOutcome({ ...BASE, outcome: "no", said: "probably said the budget was the issue" }, { now: NOW });
  assert.equal(r.refused, true);
  assert.ok(r.problems.some((p) => /a remembered gist is not a quote/.test(p)));
});

test("R2: a conversation is the best provenance there is, and it crosses into Q1 without retyping", () => {
  const r = held("no");
  const prov = provenanceFor(r);
  assert.ok(prov.includes(BASE.who) && prov.includes("2026-07-28") && prov.includes("Ahmad"));

  const fact = factForCandidate(r, "they run 40 seats on one part-time admin");
  assert.equal(fact.value, "they run 40 seats on one part-time admin");
  assert.equal(fact.source, prov);

  // Q1 accepts it as a real, sourced field — no inference marker, no laundering.
  const rec = recordCandidate({
    key: "cand-001",
    enteredBy: "Ahmad",
    name: { value: "Northline Logistics", source: "i met their ops manager at the Whitby chamber breakfast on 2026-07-14" },
    contact: { value: "ops@northline.example", source: "printed on the business card he handed me at that breakfast" },
    problemBasis: fact,
  }, { now: NOW });
  assert.equal(rec.refused, false, `Q1 must accept a conversation-sourced fact: ${rec.reason || ""}`);
  // And Q2 can score it, so an hour spent talking moves the ranking without a human retyping a word.
  const scored = scoreCandidate(rec.candidate);
  assert.equal(scored.key, "cand-001");
  assert.equal(scored.guessing, false);
});

test("R2: only a genuine engagement reaches N1 — a no never becomes one", () => {
  const eng = engagementFactForIntake(held("engaged"));
  assert.equal(eng.gate, "engagement");
  assert.ok(GATE_KEYS.includes(eng.gate), "it is N1's own gate vocabulary");
  assert.ok(eng.source.includes("2026-07-28"));

  for (const key of ["no", "no-reply", "wrong-person", "wrong-problem", "could-not-reach", "interested-no-ask-made"]) {
    assert.equal(engagementFactForIntake(held(key)), null, `${key} may never reach N1's engagement gate`);
  }
  assert.equal(engagementFactForIntake(null), null);
  assert.equal(engagementFactForIntake({ schema: "forged", recorded: true, engagement: true }), null, "a forged shape reaches nothing");
});

test("R2: an empty log reads as ZERO conversations held, in plain words", () => {
  const log = buildOutcomeLog([], { now: NOW });
  assert.equal(log.empty, true);
  assert.equal(log.count, 0);
  assert.equal(log.conversationsHeld, 0);
  assert.equal(log.statement, EMPTY_STATEMENT);
  assert.ok(EMPTY_STATEMENT.startsWith("0 conversations held"), "zero reads as zero, first");
  assert.ok(/fact about us, not about the market/.test(EMPTY_STATEMENT));
  assert.equal(outcomeLogIsMomentumSafe(log), true);
  assert.ok(outcomeLogMarkdown(log).includes("0 conversations held"));

  assert.equal(conversationsHeldFrom(log), 0);
  assert.equal(conversationsHeldFrom(null), 0, "an absent log counts zero, never unknown-as-something");
  assert.equal(conversationsHeldFrom({ schema: "not-a-log", conversationsHeld: 99 }), 0, "a foreign shape counts zero");
});

test("R2: a real log counts held conversations, hours spent, and the ones that went nowhere", () => {
  const log = buildOutcomeLog([held("engaged"), held("no"), held("no-reply"), held("could-not-reach")], { now: NOW });
  assert.equal(log.count, 4);
  assert.equal(log.hoursSpent, 4, "every recorded hour counts as an hour");
  assert.equal(log.conversationsHeld, 3, "could-not-reach cost an hour but was not a conversation");
  assert.equal(log.negatives, 3);
  assert.equal(log.engagements, 1);
  assert.equal(conversationsHeldFrom(log), 3);
  assert.ok(/A conversation held is not an ask sent/.test(log.statement));
  assert.equal(outcomeLogIsMomentumSafe(log), true);
  // A refused record can never be counted.
  const withRefused = buildOutcomeLog([held("no"), recordOutcome({}, { now: NOW })], { now: NOW });
  assert.equal(withRefused.count, 1);
});

test("R2: static-scan — no fs, no net, no spawn, no persistence in the outcome chain", () => {
  const src = readFileSync(path.join(__dirname, "../src/shared/conversation-outcome.mjs"), "utf8");
  for (const forbidden of [
    "node:fs", "readFileSync", "writeFileSync", "appendFileSync", "node:child_process", "spawn(",
    "fetch(", "node:http", "node:https", "process.env", "sqlite", "Blobs", "markSent",
    "sendMail", "setInterval", "cron",
  ]) {
    assert.ok(!src.includes(forbidden), `conversation-outcome must not reference ${forbidden}`);
  }
  assert.ok(src.includes("PERSISTS = false"));
  assert.ok(src.includes("Rule 11"), "the privacy rule is stated where the names would be");
});

test("R2: static-scan — the softening list is data, and every entry is refused not merely flagged", () => {
  const src = readFileSync(path.join(__dirname, "../src/shared/conversation-outcome.mjs"), "utf8");
  assert.ok(SOFTENING_LABELS.length >= 15, "the list is real, not a token gesture");
  for (const phrase of ["nurture", "warm lead", "circle back", "not a no", "soft no"]) {
    assert.ok(SOFTENING_LABELS.includes(phrase), `${phrase} is on the refusal list`);
  }
  // Every outcome has a stated meaning, so no key can be added without saying what it means.
  for (const o of OUTCOMES) {
    assert.ok(o.means && o.means.length > 15, `${o.key} states what it means`);
    assert.equal(typeof o.negative, "boolean");
    assert.equal(typeof o.engagement, "boolean");
  }
  assert.ok(src.includes("NO_SOFTENING_NOTE"));
});
