// s2-honest-opening.test.mjs — RUN-S S2 exit criteria, test-locked.
// An opening renders from a real candidate's recorded basis and is refused where the basis is
// missing; every unsupportable-claim class is refused by name; a static test proves no transport.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildOpening, reviewOpening, unsupportableClaimsIn, mergeTokensIn, openingMarkdown,
  HONEST_OPENING_SCHEMA, UNSUPPORTABLE_CLAIMS, CLAIM_KEYS, NO_BASIS_REFUSAL,
  HAS_TRANSPORT, HAS_SCHEDULER, MACHINE_CONSUMABLE, HAS_MERGE_FIELDS, GENERATES, SENT,
} from "../src/shared/honest-opening.mjs";
import { recordCandidate } from "../src/shared/candidate-record.mjs";
import { recordOutcome, provenanceFor, factForCandidate } from "../src/shared/conversation-outcome.mjs";
import { momentumSafe } from "../src/shared/program-truth.mjs";

const NOW = Date.parse("2026-07-28T12:00:00Z");
const SRC = "src/shared/honest-opening.mjs";

function candidate(extra = {}) {
  const r = recordCandidate({
    key: "cand-001",
    enteredBy: "Ahmad",
    name: { value: "the owner of a two-server accounting practice", source: "he introduced himself at the chamber breakfast on 2026-07-20" },
    contact: { value: "the address on the card he handed over", source: "he handed me a card at that breakfast and I read it off the card" },
    problemBasis: {
      value: "both servers are out of warranty and nobody has patched them since the bookkeeper left",
      source: "he said it in that conversation, unprompted",
    },
    ...extra,
  }, { now: NOW });
  assert.equal(r.recorded, true);
  return r.candidate;
}

test("S2: the opening is built from the recorded basis and quotes it rather than paraphrasing", () => {
  const o = buildOpening(candidate(), { now: NOW });
  assert.equal(o.schema, HONEST_OPENING_SCHEMA);
  assert.equal(o.refused, false);
  assert.ok(o.opening.includes("both servers are out of warranty and nobody has patched them since the bookkeeper left"),
    "the basis appears verbatim - a paraphrase is where the drift starts");
  assert.ok(o.provenanceLine.includes("he said it in that conversation"), "and it says where that came from");
  assert.ok(o.sentenceCount <= 2, "two sentences at most - a monologue is how a conversation fails to start");
  assert.equal(o.forHumanToSay, true);
});

test("S2: with no recorded basis there is NO opening, and it says so plainly", () => {
  for (const bad of [null, {}, { key: "cand-001" }, { key: "cand-001", problemBasis: { value: "", source: "" } }]) {
    const o = buildOpening(bad, { now: NOW });
    assert.equal(o.refused, true);
    assert.equal(o.opening, null, "nothing plausible is generated in the gap");
    assert.equal(o.refusal, NO_BASIS_REFUSAL);
  }
  assert.ok(/a fabrication with a friendly tone/.test(NO_BASIS_REFUSAL));
  assert.ok(openingMarkdown(buildOpening(null, { now: NOW })).includes(NO_BASIS_REFUSAL));
});

test("S2: a basis with a value but no stated source cannot produce an opening either", () => {
  const o = buildOpening({ key: "cand-001", problemBasis: { value: "their servers are old", source: "" } }, { now: NOW });
  assert.equal(o.refused, true, "an unsourced basis is not a basis");
});

test("S2: EVERY unsupportable claim class is refused BY NAME and quoted back", () => {
  const samples = {
    "invented-savings": "We can save you 30% on your IT costs.",
    "invented-customers": "Companies like yours already work with us.",
    "invented-credential": "We are a certified partner for that platform.",
    "guarantee": "It is risk-free and we guarantee the result.",
    "inflated-experience": "I have 21+ years running these environments.",
    "manufactured-urgency": "This is a limited time offer, act now.",
  };
  assert.deepEqual(Object.keys(samples).sort(), [...CLAIM_KEYS].sort(), "every declared class is exercised");

  for (const [key, text] of Object.entries(samples)) {
    const hits = unsupportableClaimsIn(text);
    assert.ok(hits.some((h) => h.key === key), `${key} is caught`);
    const hit = hits.find((h) => h.key === key);
    assert.ok(text.toLowerCase().includes(hit.matched), "the matched phrase is quoted back verbatim");
    assert.ok(hit.refusal.includes(hit.matched), "and it appears in the refusal the human reads");
    const review = reviewOpening(text, { now: NOW });
    assert.equal(review.ok, false, `${key} cannot be said`);
  }
});

test("S2: the honest years figure is 15+, and 21+ is refused by name", () => {
  assert.equal(unsupportableClaimsIn("15+ years of IT operations").length, 0, "the true figure passes");
  const hit = unsupportableClaimsIn("21+ years of IT operations").find((h) => h.key === "inflated-experience");
  assert.ok(hit && /never rounded up/.test(hit.refusal));
});

test("S2: our OWN output is held to the same gate", () => {
  // A basis that itself smuggles a claim must not be laundered into an opening by us.
  const o = buildOpening({
    key: "cand-001",
    problemBasis: { value: "we guarantee they will save you 40%", source: "written down after the breakfast on 2026-07-20" },
  }, { now: NOW });
  assert.equal(o.refused, true, "the module refuses its own output rather than shipping it");
  assert.ok(o.claimsRefused.length > 0);
  assert.ok(o.refusal.includes("refused by its own guard"));
});

test("S2: it is a script for a human, not a template for a machine — no merge fields, no transport", () => {
  const o = buildOpening(candidate(), { now: NOW });
  assert.deepEqual(o.mergeTokens, [], "no merge token anywhere in the rendered opening");
  assert.equal(HAS_MERGE_FIELDS, false);
  assert.equal(HAS_TRANSPORT, false);
  assert.equal(HAS_SCHEDULER, false);
  assert.equal(MACHINE_CONSUMABLE, false);
  assert.equal(GENERATES, false);
  assert.equal(SENT, false);
  // And a human who pastes a merge token back in is refused.
  const r = reviewOpening("Hi {{first_name}}, quick question.", { now: NOW });
  assert.equal(r.ok, false);
  assert.deepEqual(r.mergeTokens, ["{{first_name}}"]);
  assert.ok(r.problems.some((p) => /seam a sender gets bolted onto/.test(p)));
});

test("S2: momentum language is refused in a human's rewrite too", () => {
  const r = reviewOpening("Things are really gaining momentum on our side.", { now: NOW });
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => /Momentum language/.test(p)));
  // And the module's own output survives the guard.
  assert.ok(momentumSafe(buildOpening(candidate(), { now: NOW }).opening));
});

test("S2: a basis heard in a real conversation is ATTRIBUTED, not softened into 'we believe'", () => {
  const outcome = recordOutcome({
    candidateKey: "cand-001",
    heldAt: "2026-07-20",
    who: "the practice owner",
    said: "both servers are out of warranty and nobody has patched them since the bookkeeper left",
    outcome: "interested-no-ask-made",
    enteredBy: "Ahmad",
  }, { now: NOW });
  assert.equal(outcome.recorded, true);

  // R2's provenance crosses into Q1 without a human retyping a word...
  const fact = factForCandidate(outcome, outcome.said);
  assert.ok(fact.source.includes("said it in a real conversation"));
  const c = candidate({ problemBasis: fact });

  // ...and S2 then speaks with the attribution rather than a hedge.
  const o = buildOpening(c, { heardFrom: "me", now: NOW });
  assert.equal(o.refused, false);
  assert.equal(o.attributed, true);
  assert.ok(o.opening.startsWith("You told me that"), "attributed, because a conversation is the strongest provenance we have");
  assert.ok(o.provenanceLine.includes(provenanceFor(outcome)));
});

test("S2: an empty review is not a pass", () => {
  const r = reviewOpening("", { now: NOW });
  assert.equal(r.ok, false);
  assert.equal(r.empty, true);
});

test("S2: STATIC SCAN — no fs, no net, no spawn, no scheduler, no env", () => {
  const src = readFileSync(new URL(`../${SRC}`, import.meta.url), "utf8");
  const body = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
  for (const bad of [
    "node:fs", "writeFile", "readFile", "node:http", "fetch(", "XMLHttpRequest",
    "node:child_process", "spawn(", "execSync", "execFile", "process.env",
    "setInterval", "setTimeout", "cron", "nodemailer", "sendMail", "smtp",
  ]) {
    assert.ok(!body.includes(bad), `no ${bad} in ${SRC}`);
  }
});
