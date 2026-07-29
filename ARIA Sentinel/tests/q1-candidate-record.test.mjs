// q1-candidate-record.test.mjs — RUN-Q Q1 exit criteria, test-locked.
// A candidate records end to end from real input; every unsourced or inferred field is refused by
// name; the empty state is honest; a static test proves no candidate data can be tracked or served.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  CANDIDATE_RECORD_SCHEMA, SENT, SIGNED, CHARGED, NOTHING_SENT,
  PERSISTS, HAS_TRANSPORT, TRACKED, SERVEABLE,
  EMPTY_STATEMENT, PRIVACY_NOTE, NO_AUTOMATION_NOTE,
  REQUIRED_FIELDS, REQUIRED_KEYS, INFERENCE_MARKERS,
  recordCandidate, buildCandidateList, candidateListMarkdown,
} from "../src/shared/candidate-record.mjs";

const NOW = Date.parse("2026-07-28T00:00:00Z");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// A candidate a human could actually have written down after a real morning out.
const REAL = {
  key: "cand-001",
  enteredBy: "Ahmad",
  name: { value: "Northline Logistics", source: "i met their ops manager at the Whitby chamber breakfast on 2026-07-14" },
  contact: { value: "ops@northline.example", source: "printed on the business card he handed me at that breakfast" },
  problemBasis: { value: "their two-person IT team is on call overnight", source: "he said it out loud at that breakfast, unprompted" },
};

test("Q1: belt-and-braces — nothing is sent, nothing persists, nothing is tracked or serveable", () => {
  assert.equal(SENT, false);
  assert.equal(SIGNED, false);
  assert.equal(CHARGED, false);
  assert.equal(NOTHING_SENT, true);
  assert.equal(PERSISTS, false);
  assert.equal(HAS_TRANSPORT, false);
  assert.equal(TRACKED, false);
  assert.equal(SERVEABLE, false);
});

test("Q1: a candidate records end to end from real input, value and provenance travelling together", () => {
  const r = recordCandidate(REAL, { now: NOW });
  assert.equal(r.schema, CANDIDATE_RECORD_SCHEMA);
  assert.equal(r.refused, false);
  assert.equal(r.recorded, true);
  assert.deepEqual(r.refusedFields, []);
  const c = r.candidate;
  assert.equal(c.key, "cand-001");
  assert.equal(c.enteredBy, "Ahmad");
  for (const k of REQUIRED_KEYS) {
    assert.ok(c[k].value.length > 0, `${k} keeps its value`);
    assert.ok(c[k].source.length >= 8, `${k} keeps its own provenance sentence`);
  }
  assert.equal(c.recordedAt, new Date(NOW).toISOString());
  // A candidate is never an account, never asked, never sent — by construction.
  assert.equal(c.realAccount, false);
  assert.equal(c.asked, false);
  assert.equal(c.sent, false);
});

test("Q1: a value with no stated provenance is refused BY NAME, never stored provisionally", () => {
  for (const k of REQUIRED_KEYS) {
    const input = { ...REAL, [k]: { value: REAL[k].value } }; // value present, source absent
    const r = recordCandidate(input, { now: NOW });
    assert.equal(r.refused, true, `${k} with no source must refuse the record`);
    assert.equal(r.candidate, null, "nothing is kept, not even the fields that passed");
    const label = REQUIRED_FIELDS.find((f) => f.key === k).label;
    assert.ok(r.refusedFields.some((x) => x.startsWith(`${label}:`)), `the refusal names ${label}`);
    assert.ok(r.refusedFields.some((x) => x.includes("provenance is not stated")));
  }
});

test("Q1: an INFERRED contact address is refused by name — the marker is quoted back", () => {
  const inferred = {
    ...REAL,
    contact: { value: "j.northline@northline.example", source: "same format as their other staff addresses" },
  };
  const r = recordCandidate(inferred, { now: NOW });
  assert.equal(r.refused, true);
  assert.equal(r.candidate, null);
  const line = r.refusedFields.find((x) => x.startsWith("Contact address:"));
  assert.ok(line, "the refusal names the field");
  assert.ok(line.includes('"same format"'), "the marker that gave it away is quoted back verbatim");
  assert.ok(line.includes("never stored"), "it is refused, not flagged and kept");
});

test("Q1: every inference marker is caught, on every required field", () => {
  assert.ok(INFERENCE_MARKERS.length >= 15, "the marker list is not a token gesture");
  for (const marker of INFERENCE_MARKERS) {
    for (const k of REQUIRED_KEYS) {
      const input = { ...REAL, [k]: { value: REAL[k].value, source: `this was ${marker} from what we know` } };
      const r = recordCandidate(input, { now: NOW });
      assert.equal(r.refused, true, `"${marker}" on ${k} must refuse`);
    }
  }
});

test("Q1: no field may be inferred from another — the laundered pair is named", () => {
  const crossed = {
    ...REAL,
    contact: { value: "ops@northline.example", source: "built from Northline Logistics, their company name" },
  };
  const r = recordCandidate(crossed, { now: NOW });
  assert.equal(r.refused, true);
  const line = r.refusedFields.find((x) => x.startsWith("Contact address:"));
  assert.ok(line.includes("Name"), "the refusal names BOTH fields, so the human sees the pair");
  assert.ok(line.includes("may not stand as the source of another"));
});

test("Q1: a scraped name is not a lead — an unnamed enterer refuses the record", () => {
  const r = recordCandidate({ ...REAL, enteredBy: "" }, { now: NOW });
  assert.equal(r.refused, true);
  assert.ok(r.refusedFields.some((x) => x.startsWith("Entered by:")));
  assert.ok(r.refusedFields.some((x) => x.includes(NO_AUTOMATION_NOTE)));

  const nokey = recordCandidate({ ...REAL, key: "" }, { now: NOW });
  assert.equal(nokey.refused, true);
  assert.ok(nokey.refusedFields.some((x) => x.startsWith("Local handle:")));
});

test("Q1: EVERY failing field is named at once — a human is never made to fix them one at a time", () => {
  const r = recordCandidate({ key: "", enteredBy: "" }, { now: NOW });
  assert.equal(r.refused, true);
  // handle + enteredBy + all three required fields
  assert.equal(r.refusedFields.length, 2 + REQUIRED_KEYS.length);
  assert.ok(r.refusal.includes(`${r.refusedFields.length} field(s)`));
});

test("Q1: zero candidates is an honest, non-apologetic empty state that says what a first entry needs", () => {
  const list = buildCandidateList([], { now: NOW });
  assert.equal(list.count, 0);
  assert.equal(list.empty, true);
  assert.equal(list.statement, EMPTY_STATEMENT);
  assert.ok(list.statement.startsWith("0 candidates recorded"), "zero reads as zero, first");
  assert.ok(/not a failure/.test(list.statement), "it states it is an accurate reading");
  const md = candidateListMarkdown(list);
  for (const f of REQUIRED_FIELDS) assert.ok(md.includes(f.label), `the empty state names ${f.label}`);
  assert.ok(md.includes(PRIVACY_NOTE));

  const one = buildCandidateList([recordCandidate(REAL, { now: NOW }).candidate], { now: NOW });
  assert.equal(one.count, 1);
  assert.equal(one.empty, false);
  assert.ok(one.statement.includes("not revenue"), "a recorded name is never phrased as revenue");
});

test("Q1: static-scan — no persistence, no transport, no env anywhere in the candidate chain", () => {
  const bad = [
    /\bfetch\s*\(/, /XMLHttpRequest/, /child_process/, /\bspawn\s*\(/, /\bexecSync\b/,
    /node:fs/, /node:net/, /node:http/, /require\(\s*["']fs["']\s*\)/,
    /writeFileSync/, /appendFileSync/, /mkdirSync/, /localStorage/, /process\.env/,
    /setInterval\s*\(/, /setTimeout\s*\(/,
  ];
  const src = readFileSync(path.join(__dirname, "../src/shared/candidate-record.mjs"), "utf8");
  for (const re of bad) assert.ok(!re.test(src), `candidate-record.mjs must not contain ${re}`);
});

test("Q1: static-scan — no candidate field can reach a tracked or serveable path (vault Rule 11)", () => {
  const src = readFileSync(path.join(__dirname, "../src/shared/candidate-record.mjs"), "utf8");
  // No path literal that would land inside the publish root or the vault.
  for (const re of [/public\//, /\.well-known/, /aria-vault/, /senior-director-state/, /netlify/i]) {
    assert.ok(!re.test(src), `candidate-record.mjs must not reference ${re}`);
  }
  assert.ok(/PERSISTS\s*=\s*false/.test(src));
  assert.ok(/TRACKED\s*=\s*false/.test(src));
  assert.ok(/SERVEABLE\s*=\s*false/.test(src));
  assert.ok(src.includes("Rule 11"), "the privacy rule is stated in the module, not just in a note");
  // And no path in the module can flip a candidate into an asked/sent/real state.
  assert.ok(!/\brealAccount\s*[:=]\s*true/.test(src));
  assert.ok(!/\basked\s*[:=]\s*true/.test(src));
  assert.ok(!/\bsent\s*[:=]\s*true/.test(src));
});
