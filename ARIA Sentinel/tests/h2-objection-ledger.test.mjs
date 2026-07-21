// RUN-H H2 - objection ledger. Locks: an answer requires a real in-repo artifact, an unbacked
// objection is OPEN with the gap named (never confident copy), only really-raised objections are
// recorded, gaps print as plainly as wins, and the module cannot reach the network or the disk.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  buildObjectionLedger, objectionLedgerMarkdown, normalizeObjection, resolveObjection,
  ANSWER_MAP, OBJECTION_LEDGER_SCHEMA, LEDGER_EMPTY, OPEN_PREFIX,
} from "../src/shared/objection-ledger.mjs";

const NOW = Date.parse("2026-07-21T12:00:00.000Z");
const REPO = new URL("../", import.meta.url);
/** Existence is supplied by the caller so the module itself stays pure - here it is the REAL repo. */
const realArtifactExists = (p) => typeof p === "string" && p.trim().length > 0 && existsSync(new URL(p, REPO));

// -- 1. EMPTY IS HONEST -------------------------------------------------------------------------------
for (const input of [undefined, null, [], {}, "nope", { objections: [] }]) {
  const l = buildObjectionLedger(input, { now: NOW, artifactExists: realArtifactExists });
  assert.equal(l.schema, OBJECTION_LEDGER_SCHEMA, "schema is explicit");
  assert.equal(l.empty, true, "nothing recorded => honestly empty");
  assert.deepEqual(l.entries, [], "no pre-filled objections to look prepared");
}
assert.ok(objectionLedgerMarkdown(buildObjectionLedger([], { now: NOW })).includes(LEDGER_EMPTY), "empty markdown states it");

// -- 2. ONLY REALLY-RAISED OBJECTIONS ARE RECORDED ----------------------------------------------------
assert.equal(normalizeObjection({}).ok, false, "no kind => not answerable");
assert.match(normalizeObjection({ kind: "vibes", source: "call", raisedAt: "2026-07-01" }).reason, /unknown objection kind/, "an unknown kind is listed, never guessed at");
assert.match(normalizeObjection({ kind: "price" }).reason, /nobody actually raised/, "no source + date => not a real objection");
assert.match(normalizeObjection({ kind: "price", source: "call" }).reason, /nobody actually raised/, "a date is required too");
assert.equal(normalizeObjection({ kind: "PRICE ", source: "discovery call", raisedAt: "2026-07-01T10:00:00Z" }).value.kind, "price", "kinds normalize");

// -- 3. AN ANSWER REQUIRES AN ARTIFACT THAT REALLY EXISTS ---------------------------------------------
const noArtifact = resolveObjection({ kind: "price", source: "call", raisedAt: "2026-07-01T10:00:00Z", artifact: null }, realArtifactExists);
assert.equal(noArtifact.status, "open", "no artifact cited => OPEN");
assert.equal(noArtifact.answer, null, "no confident copy without backing");
assert.ok(noArtifact.gap.startsWith(OPEN_PREFIX), "the gap is named");
assert.ok(noArtifact.gap.includes(ANSWER_MAP.price.artifactKind), "the gap says what is needed");

const fakeArtifact = resolveObjection({ kind: "lock-in", source: "email", raisedAt: "2026-07-02T10:00:00Z", artifact: "src/shared/does-not-exist.mjs" }, realArtifactExists);
assert.equal(fakeArtifact.status, "open", "a cited artifact that does not exist does NOT answer the objection");
assert.equal(fakeArtifact.answer, null, "an unverifiable citation never produces an answer");
assert.match(fakeArtifact.gap, /does not exist in the repo/, "the missing file is named");

// -- 4. A REAL IN-REPO ARTIFACT DOES ANSWER IT --------------------------------------------------------
const REAL_FILES = {
  "already-have-someone": "src/shared/delivery-leverage.mjs",
  "security-compliance": "src/shared/audit-integrity.mjs",
  price: "src/shared/proof-pack.mjs",
};
for (const [kind, file] of Object.entries(REAL_FILES)) {
  assert.ok(realArtifactExists(file), `fixture artifact ${file} really exists in this repo`);
  const r = resolveObjection({ kind, source: "call", raisedAt: "2026-07-03T10:00:00Z", artifact: file }, realArtifactExists);
  assert.equal(r.status, "answered", `${kind} is answerable from a real artifact`);
  assert.equal(r.answer, ANSWER_MAP[kind].answer, "the answer is the deterministic mapped one, not improvised");
}

// -- 5. THE LEDGER MIXES ANSWERED AND OPEN WITHOUT SPIN -----------------------------------------------
const ledger = buildObjectionLedger({
  objections: [
    { kind: "price", source: "discovery call", raisedAt: "2026-07-03T10:00:00Z", artifact: "src/shared/proof-pack.mjs" },
    { kind: "already-have-someone", source: "email", raisedAt: "2026-07-05T10:00:00Z", artifact: "src/shared/delivery-leverage.mjs" },
    { kind: "switching-risk", source: "call", raisedAt: "2026-07-06T10:00:00Z", artifact: null },
    { kind: "lock-in", source: "email", raisedAt: "2026-07-07T10:00:00Z", artifact: "docs/nope-not-written-yet.md" },
    { kind: "vibes", source: "call", raisedAt: "2026-07-08T10:00:00Z" },
    { kind: "price", source: null, raisedAt: null },
  ],
}, { now: NOW, artifactExists: realArtifactExists });
assert.equal(ledger.answeredCount, 2, "exactly the two artifact-backed objections are answered");
assert.equal(ledger.openCount, 2, "both unbacked objections stay OPEN");
assert.equal(ledger.excluded.length, 2, "unknown kind + unrecorded objection are excluded with reasons");
assert.ok(ledger.entries.every((e) => e.status === "answered" ? Boolean(e.answer) : e.answer === null), "answers exist only where status says so");
assert.ok(ledger.entries[0].raisedAt < ledger.entries[1].raisedAt, "entries are ordered by when they were really raised");

// -- 6. WITH NO EXISTENCE CHECKER, NOTHING IS ANSWERED ------------------------------------------------
const unchecked = buildObjectionLedger({ objections: [{ kind: "price", source: "call", raisedAt: "2026-07-03T10:00:00Z", artifact: "src/shared/proof-pack.mjs" }] }, { now: NOW });
assert.equal(unchecked.answeredCount, 0, "unverified artifacts default to OPEN - we never assume the evidence exists");

// -- 7. MARKDOWN PRINTS GAPS AS PLAINLY AS WINS -------------------------------------------------------
const md = objectionLedgerMarkdown(ledger);
assert.ok(md.includes("Open (no backing artifact): 2"), "the open count is on the face of the report");
assert.ok(md.includes(OPEN_PREFIX), "the gap text is printed, not buried");
assert.ok(md.includes("Not recorded"), "excluded objections are stated, not silently dropped");
for (const banned of ["guarantee", "risk-free", "money-back"]) {
  assert.ok(!md.toLowerCase().includes(banned), `ledger must never contain "${banned}"`);
}

// -- 8. STATIC SCAN: no network, no spawn, no disk ----------------------------------------------------
const src = readFileSync(new URL("../src/shared/objection-ledger.mjs", import.meta.url), "utf8");
for (const forbidden of ["fetch(", "XMLHttpRequest", "node:http", "node:https", "child_process", "node:fs", "require(", "exec(", "spawn("]) {
  assert.ok(!src.includes(forbidden), `objection-ledger must not reference ${forbidden}`);
}
assert.ok(!/status:\s*"answered"\s*,\s*answer:\s*null/.test(src), "no path marks an objection answered without an answer");

console.log("h2-objection-ledger: 8 assertion groups PASSED");
