// s1-quick-entry.test.mjs — RUN-S S1 exit criteria, test-locked.
// A real candidate records in one pass from the hour-plan surface; every Q1 refusal still fires with
// Q1's wording; a static test proves no tracked/serveable write path; the empty state stays honest.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildQuickEntry, submitQuickEntry, nextCandidateKey, quickEntryMarkdown,
  QUICK_ENTRY_SCHEMA, WRITE_TARGET, ENTRY_SURFACE,
  PERSISTS, HAS_TRANSPORT, HAS_SCHEDULER, WRITES_TRACKED, WRITES_SERVEABLE, SENT,
} from "../src/shared/candidate-quick-entry.mjs";
import {
  recordCandidate, buildCandidateList, REQUIRED_FIELDS, REQUIRED_KEYS, EMPTY_STATEMENT,
} from "../src/shared/candidate-record.mjs";
import { buildHourPlan } from "../src/shared/hour-plan.mjs";

const NOW = Date.parse("2026-07-28T12:00:00Z");
const SRC = "src/shared/candidate-quick-entry.mjs";

const GOOD = {
  name: "the owner of a two-server accounting practice in Whitby",
  nameSource: "he introduced himself at the Whitby chamber breakfast on 2026-07-20",
  contact: "the address printed on the card he handed over",
  contactSource: "he handed me a business card at that breakfast; I read the address off the card",
  problemBasis: "both servers are out of warranty and nobody has patched them since the bookkeeper left",
  problemBasisSource: "he said it in that conversation, unprompted, while complaining about his invoices",
};

test("S1: a real candidate records in ONE pass, from the hour-plan surface", () => {
  const plan = buildHourPlan({}, { now: NOW });
  const entry = buildQuickEntry({ plan, list: null, operator: "Ahmad" }, { now: NOW });

  assert.equal(entry.schema, QUICK_ENTRY_SCHEMA);
  assert.equal(entry.surface, ENTRY_SURFACE);
  assert.equal(entry.reachableFromPlan, true, "it hangs off the plan already on screen");
  assert.equal(entry.prefill.key, "cand-001", "the handle is allocated, not asked for");
  assert.equal(entry.prefill.enteredBy, "Ahmad", "the operator is carried, not re-typed");

  const out = submitQuickEntry(GOOD, { entry, now: NOW });
  assert.equal(out.recorded, true);
  assert.equal(out.refused, false);
  assert.equal(out.candidate.key, "cand-001");
  assert.equal(out.candidate.enteredBy, "Ahmad");
  assert.equal(out.candidate.realAccount, false, "a recorded name is not an account");
  assert.equal(out.candidate.asked, false, "and it is not an ask");
});

test("S1: it asks for exactly Q1's three fields, in Q1's own words — no fourth, no rewording", () => {
  const entry = buildQuickEntry({ plan: buildHourPlan({}, { now: NOW }) }, { now: NOW });
  assert.equal(entry.fieldCount, 3);
  assert.deepEqual(entry.fieldKeys, [...REQUIRED_KEYS]);
  assert.deepEqual(entry.fields, REQUIRED_FIELDS, "the prompts ARE Q1's fields, not a copy that can drift");
  // Six sentences: three facts, three provenances. Speed does not come from dropping a source.
  assert.equal(entry.sentencesAsked, 6);
  const md = quickEntryMarkdown(entry);
  for (const f of REQUIRED_FIELDS) assert.ok(md.includes(f.asks), `${f.key} asked in Q1's words`);
});

test("S1: EVERY refusal is Q1's refusal, verbatim — speed buys no softer gate", () => {
  const entry = buildQuickEntry({ plan: buildHourPlan({}, { now: NOW }), operator: "Ahmad" }, { now: NOW });

  const cases = [
    { label: "missing provenance", patch: { nameSource: "" } },
    { label: "confessed inference", patch: { contactSource: "guessed from the company domain" } },
    { label: "missing basis", patch: { problemBasis: "", problemBasisSource: "" } },
    { label: "feeling as basis", patch: { problemBasisSource: "they look like a typical fit" } },
  ];

  for (const c of cases) {
    const input = { ...GOOD, ...c.patch };
    const viaEntry = submitQuickEntry(input, { entry, now: NOW });
    const viaQ1 = recordCandidate(
      {
        key: "cand-001", enteredBy: "Ahmad",
        name: { value: input.name, source: input.nameSource },
        contact: { value: input.contact, source: input.contactSource },
        problemBasis: { value: input.problemBasis, source: input.problemBasisSource },
      },
      { now: NOW }
    );
    assert.equal(viaEntry.refused, true, `${c.label}: refused through the fast path`);
    assert.deepEqual(viaEntry.refusedFields, viaQ1.refusedFields,
      `${c.label}: the fast path's refusals are Q1's, word for word`);
    assert.equal(viaEntry.candidate, null, "nothing is kept, not even the parts that passed");
  }
});

test("S1: an inferred contact address cannot get in through the fast path", () => {
  const entry = buildQuickEntry({ plan: buildHourPlan({}, { now: NOW }), operator: "Ahmad" }, { now: NOW });
  const out = submitQuickEntry(
    { ...GOOD, contactSource: "constructed using the same format as their other addresses" },
    { entry, now: NOW }
  );
  assert.equal(out.refused, true);
  assert.ok(out.refusedFields.some((r) => /admits inference/.test(r)));
});

test("S1: nothing is written anywhere — no tracked path, no serveable path, no vault note", () => {
  assert.equal(PERSISTS, false);
  assert.equal(WRITES_TRACKED, false);
  assert.equal(WRITES_SERVEABLE, false);
  assert.equal(HAS_TRANSPORT, false);
  assert.equal(HAS_SCHEDULER, false);
  assert.equal(SENT, false);
  assert.equal(WRITE_TARGET.kind, "untracked-operator-state");
  assert.equal(WRITE_TARGET.tracked, false);
  assert.equal(WRITE_TARGET.serveable, false);
  assert.equal(WRITE_TARGET.vaultNote, false);

  const out = submitQuickEntry(GOOD, { entry: buildQuickEntry({ plan: buildHourPlan({}, { now: NOW }), operator: "Ahmad" }, { now: NOW }), now: NOW });
  assert.equal(out.persists, false);
  assert.equal(out.writesTracked, false);
  assert.equal(out.writesServeable, false);
});

test("S1: STATIC SCAN — the source contains no fs, no net, no spawn, no env, no persistence", () => {
  const src = readFileSync(new URL(`../${SRC}`, import.meta.url), "utf8");
  const body = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
  for (const bad of [
    "node:fs", "require(\"fs\")", "writeFile", "readFile", "appendFile",
    "node:http", "fetch(", "XMLHttpRequest", "node:child_process", "spawn(", "execSync", "execFile",
    "process.env", "localStorage", "sessionStorage", "indexedDB",
  ]) {
    assert.ok(!body.includes(bad), `no ${bad} in ${SRC}`);
  }
});

test("S1: the empty state is unchanged and still reads as an honest zero", () => {
  const list = buildCandidateList([], { now: NOW });
  assert.equal(list.count, 0);
  assert.equal(list.statement, EMPTY_STATEMENT);
  assert.ok(EMPTY_STATEMENT.startsWith("0 candidates recorded"));
  // And the fast path does not invent one to make itself look used.
  assert.equal(nextCandidateKey(list), "cand-001");
});

test("S1: handles are allocated from what already exists, gap-tolerant, and are never a person's name", () => {
  const entry0 = buildQuickEntry({ plan: buildHourPlan({}, { now: NOW }), operator: "Ahmad" }, { now: NOW });
  const first = submitQuickEntry(GOOD, { entry: entry0, now: NOW }).candidate;
  const list1 = buildCandidateList([first], { now: NOW });
  assert.equal(nextCandidateKey(list1), "cand-002");
  const list9 = buildCandidateList([{ ...first, key: "cand-009" }], { now: NOW });
  assert.equal(nextCandidateKey(list9), "cand-010", "gaps do not reuse a handle");
  assert.ok(/^cand-\d{3}$/.test(nextCandidateKey(list9)), "a handle, never a name (vault Rule 11)");
});

test("S1: with no plan supplied, it says it is not reachable rather than pretending it is", () => {
  const entry = buildQuickEntry({}, { now: NOW });
  assert.equal(entry.reachableFromPlan, false);
  assert.ok(/not reachable/.test(entry.reachabilityStatement));
});
