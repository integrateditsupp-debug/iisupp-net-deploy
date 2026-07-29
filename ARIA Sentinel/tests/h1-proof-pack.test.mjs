// RUN-H H1 - verifiable proof pack. Locks: evidence-or-omit, a pilot that has not earned a pack says
// so and renders no claim table, every claim carries a real record id + timestamp, unverifiable
// records are excluded (never softened), and the module cannot reach the network or the disk.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildProofPack, proofPackMarkdown, evidenceOf, recordMinutes, collectEvidence, buildClaims,
  PROOF_PACK_SCHEMA, PACK_NOT_EARNED, VERIFY_NOTE, MIN_EVIDENCED_CLAIMS,
} from "../src/shared/proof-pack.mjs";

const NOW = Date.parse("2026-07-21T12:00:00.000Z");
const ago = (d) => new Date(NOW - d * 86400000).toISOString();

// -- 1. EMPTY / THIN IS HONEST, AND RENDERS NO CLAIMS -------------------------------------------------
for (const input of [undefined, null, {}, "nope", { pilotId: "pilot-a" }, { pilotId: "pilot-a", records: [] }]) {
  const p = buildProofPack(input, { now: NOW });
  assert.equal(p.schema, PROOF_PACK_SCHEMA, "schema is explicit");
  assert.equal(p.earned, false, "no evidence => the pack is honestly not earned");
  assert.deepEqual(p.claims, [], "not earned => zero claims, not weak claims");
  assert.equal(p.evidencedRecords, 0, "no invented record count");
  assert.ok(p.notEarnedReason, "the reason is stated, never hidden");
}
const notEarnedMd = proofPackMarkdown(buildProofPack({ pilotId: "pilot-a", records: [] }, { now: NOW }));
assert.ok(notEarnedMd.includes(PACK_NOT_EARNED), "markdown states it plainly");
assert.ok(!notEarnedMd.includes("| Claim |"), "an unearned pack renders no claim table at all");

// -- 2. AN UNNAMED CUSTOMER NEVER GETS A PACK ---------------------------------------------------------
const anon = buildProofPack({
  records: [1, 2, 3, 4].map((i) => ({ id: "r" + i, at: ago(i), durationMinutes: 20 })),
}, { now: NOW });
assert.equal(anon.earned, false, "records without a real pilot id do not make a pack");
assert.match(anon.notEarnedReason, /unnamed customer/, "the reason names the problem");

// -- 3. EVIDENCE MEANS A REAL ID AND A REAL TIMESTAMP -------------------------------------------------
assert.equal(evidenceOf(null), null, "malformed record is not evidence");
assert.equal(evidenceOf({ at: ago(1) }), null, "no id => a customer could not look it up");
assert.equal(evidenceOf({ id: "  " , at: ago(1) }), null, "a blank id is not an id");
assert.equal(evidenceOf({ id: "r1" }), null, "no timestamp => not verifiable");
assert.equal(evidenceOf({ id: "r1", at: "sometime" }), null, "an unparseable date is not a date");
assert.equal(evidenceOf({ id: "r1", resolvedAt: "2026-07-20T10:00:00Z" }).recordId, "r1", "a real record is evidence");
assert.equal(recordMinutes({}), null, "no time data => null, never a typical fix time");
assert.equal(recordMinutes({ durationMinutes: 0 }), null, "zero is not an observation");
assert.equal(recordMinutes({ startedAt: "2026-07-20T10:00:00Z", endedAt: "2026-07-20T10:30:00Z" }), 30, "real stamps => real minutes");

const col = collectEvidence([null, { at: ago(1) }, { id: "r0" }, { id: "r1", at: ago(2) }]);
assert.equal(col.usable.length, 1, "only the fully-verifiable record is usable");
assert.equal(col.excluded.length, 3, "every unusable record is logged");
assert.match(col.excluded[0].reason, /omitted \(never softened\)/, "exclusion states the discipline");

// -- 4. EVERY CLAIM CARRIES ITS OWN CITATION ----------------------------------------------------------
const records = [
  { id: "T-101", at: ago(9), durationMinutes: 25, summary: "vpn" },
  { id: "T-102", at: ago(7), durationMinutes: 15 },
  { id: "T-103", at: ago(5), startedAt: "2026-07-16T09:00:00Z", endedAt: "2026-07-16T09:40:00Z" },
  { id: "T-104", at: ago(3), kind: "escalation", escalated: true, durationMinutes: 60 },
  { id: "", at: ago(2) },
];
const pack = buildProofPack({ pilotId: "pilot-a", startedAt: ago(10), records }, { now: NOW });
assert.equal(pack.earned, true, "four evidenced claims clears the bar");
assert.ok(pack.claims.length >= MIN_EVIDENCED_CLAIMS, "at least the minimum evidenced claims");
for (const c of pack.claims) {
  assert.ok(Array.isArray(c.citations) && c.citations.length > 0, `claim "${c.label}" cites records`);
  for (const cite of c.citations) {
    assert.ok(records.some((r) => r.id === cite.recordId), "every citation points at a real supplied record");
    assert.ok(!Number.isNaN(Date.parse(cite.at)), "every citation carries a real timestamp");
  }
}
assert.equal(pack.excluded.length, 1, "the id-less record is excluded, not counted");

// -- 5. AN UNFLATTERING CLAIM IS REPORTED TOO ---------------------------------------------------------
const esc = pack.claims.find((c) => c.label.startsWith("Escalated"));
assert.ok(esc, "escalations are disclosed, not hidden");
assert.equal(esc.value, "1", "the real escalation count");
assert.match(esc.note, /whether it flatters us or not/, "the honesty is explicit");

// -- 6. OBSERVED TIME ONLY - UNTIMED RECORDS ADD NOTHING ----------------------------------------------
const timedClaim = pack.claims.find((c) => c.label === "Observed handling time");
assert.equal(timedClaim.value, "140 min across 4 records", "25+15+40+60 observed minutes, nothing estimated");
const untimed = buildClaims(collectEvidence([{ id: "u1", at: ago(2) }, { id: "u2", at: ago(1) }]).usable, {});
assert.ok(!untimed.some((c) => c.label === "Observed handling time"), "no real time => no handling-time claim at all");

// -- 7. TTFV IS MEASURED FROM THE REAL START, OR NOT CLAIMED ------------------------------------------
const ttfv = pack.claims.find((c) => c.label.startsWith("Time to first"));
assert.ok(ttfv, "a real start date + a real first record earns a TTFV claim");
assert.match(ttfv.note, /recorded pilot start/, "the baseline is the real recorded start");
const noStart = buildProofPack({ pilotId: "pilot-b", records }, { now: NOW });
assert.ok(!noStart.claims.some((c) => c.label.startsWith("Time to first")), "no real start date => no TTFV claim invented");

// -- 8. MARKDOWN SHOWS THE VERIFY PATH AND NO MARKETING PROOF -----------------------------------------
const md = proofPackMarkdown(pack);
assert.ok(md.includes(VERIFY_NOTE), "the customer is told how to verify");
assert.ok(md.includes("T-101"), "record ids are printed for lookup");
for (const banned of ["testimonial", "industry average", "typical customer", "logo", "award-winning"]) {
  assert.ok(!md.toLowerCase().includes(banned), `pack must never contain "${banned}"`);
}

// -- 9. STATIC SCAN: no network, no spawn, no disk ----------------------------------------------------
const src = readFileSync(new URL("../src/shared/proof-pack.mjs", import.meta.url), "utf8");
for (const forbidden of ["fetch(", "XMLHttpRequest", "node:http", "node:https", "child_process", "node:fs", "require(", "exec(", "spawn("]) {
  assert.ok(!src.includes(forbidden), `proof-pack must not reference ${forbidden}`);
}
assert.ok(!/earned:\s*true/.test(src), "no code path hardcodes a pack as earned");

console.log("h1-proof-pack: 9 assertion groups PASSED");
