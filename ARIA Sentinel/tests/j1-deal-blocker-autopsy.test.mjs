// RUN-J J1 - deal-blocker autopsy. Locks: unknown / single-case / real-pattern are ALL reachable from
// fixtures, every stated blocker cites the artifact it was read from, and no reason is ever guessed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildAutopsy, autopsyMarkdown, blockerOf,
  AUTOPSY_SCHEMA, MIN_PATTERN_CASES, UNKNOWN_KIND, UNKNOWN_GAP_NOTE, SINGLE_CASE_NOTE,
  GUESS_FREE_NOTE, EMPTY_NOTE,
} from "../src/shared/deal-blocker-autopsy.mjs";
import { buildClosePacket } from "../src/shared/close-packet.mjs";
import { buildProofPack } from "../src/shared/proof-pack.mjs";

const NOW = Date.parse("2026-07-21T12:00:00.000Z");
const ago = (d) => new Date(NOW - d * 86400000).toISOString();

// A REAL refusal from the H3 close packet - no proof pack, so the packet refuses to render.
const REFUSAL = buildClosePacket({ customer: "Harbour Dental", plan: { name: "Managed IT - Core", priceCad: 1450, published: true } }, { now: NOW });
assert.equal(REFUSAL.rendered, false, "fixture refusal is a real refusal from the real module");

// -- 1. EMPTY IS EMPTY -------------------------------------------------------------------------------
const empty = buildAutopsy({}, { now: NOW });
assert.equal(empty.schema, AUTOPSY_SCHEMA, "schema is explicit");
assert.equal(empty.autopsied, 0, "nothing is invented");
assert.equal(empty.empty, true, "the empty state is flagged");
assert.deepEqual(empty.patterns, [], "no pattern is drawn from no data");
assert.ok(autopsyMarkdown(empty).includes(EMPTY_NOTE), "an empty report says so rather than rendering filler");

// -- 2. WON AND STILL-OPEN DEALS ARE NOT AUTOPSIED ----------------------------------------------------
assert.equal(blockerOf({ id: "O-1", customer: "A", converted: true, closed: true }, { now: NOW }), null, "a won deal has no blocker");
assert.equal(blockerOf({ id: "O-2", customer: "A", closed: false }, { now: NOW }), null, "a still-open deal is not autopsied - nothing has been lost yet");
assert.equal(blockerOf({ customer: "A", closed: true }, { now: NOW }), null, "an opportunity with no id is untraceable and is not counted");
assert.equal(blockerOf({ id: "O-3", closed: true }, { now: NOW }), null, "an opportunity with no customer is not counted");

// -- 3. A BLOCKER WITH NO ARTIFACT IS UNKNOWN, AND SAYS WHAT IS MISSING -------------------------------
const unknown = blockerOf({ id: "O-10", customer: "Quiet Co", closed: true, closedAt: ago(3) }, { now: NOW });
assert.equal(unknown.kind, UNKNOWN_KIND, "no evidence => unknown, NOT 'lost on price'");
assert.equal(unknown.known, false, "and it is explicitly not known");
assert.equal(unknown.source, null, "an unknown cites no source because it has none");
assert.equal(unknown.reason, UNKNOWN_GAP_NOTE, "the gap is named so it can be closed");

// -- 4. EACH EVIDENCED KIND IS READ OFF ITS REAL ARTIFACT ---------------------------------------------
const fromRefusal = blockerOf({ id: "O-11", customer: "Harbour Dental", closed: true, refusal: REFUSAL }, { now: NOW });
assert.equal(fromRefusal.kind, "refusal", "a real packet refusal is the strongest evidence and wins");
assert.ok(fromRefusal.known && fromRefusal.source, "and it carries its source");
assert.ok(fromRefusal.evidence.length > 0, "the missing inputs are carried through as evidence");

const fromArtifact = blockerOf({ id: "O-12", customer: "Northline", closed: true, missingArtifact: "SOC 2 report" }, { now: NOW });
assert.equal(fromArtifact.kind, "missing-artifact", "an artifact the buyer asked for and we did not have");
assert.ok(fromArtifact.reason.includes("SOC 2 report"), "the actual artifact is named, verbatim");

const fromObjection = blockerOf({ id: "O-13", customer: "Ridge Legal", closed: true, objection: { kind: "price", quote: "too expensive for us right now", schema: "objection-ledger.v1" } }, { now: NOW });
assert.equal(fromObjection.kind, "objection", "a RECORDED objection is usable - a guessed one is not");
assert.ok(fromObjection.evidence.includes("too expensive for us right now"), "the buyer's own words are the evidence");
assert.equal(fromObjection.source, "objection-ledger.v1", "and it cites the ledger it came from");

const fromQuiet = blockerOf({ id: "O-14", customer: "Fade Inc", closed: true, quietSince: ago(45) }, { now: NOW });
assert.equal(fromQuiet.kind, "gone-quiet", "a real gone-quiet date is a real blocker");
assert.equal(fromQuiet.quietDays, 45, "the day count is measured, not rounded to a story");

// -- 5. ONE CASE IS NOT A PATTERN ---------------------------------------------------------------------
const single = buildAutopsy({ opportunities: [
  { id: "O-13", customer: "Ridge Legal", closed: true, objection: { kind: "price" } },
] }, { now: NOW });
assert.equal(single.patterns.length, 1, "the single case is reported");
assert.equal(single.patterns[0].isPattern, false, "but it is NOT called a pattern");
assert.ok(single.patterns[0].claim.includes(SINGLE_CASE_NOTE), "and it says so in those words");

// -- 6. N REAL CASES ARE A PATTERN --------------------------------------------------------------------
const pattern = buildAutopsy({ opportunities: [
  { id: "O-21", customer: "A Co", closed: true, missingArtifact: "SOC 2 report" },
  { id: "O-22", customer: "B Co", closed: true, missingArtifact: "SOC 2 report" },
  { id: "O-23", customer: "C Co", closed: true, missingArtifact: "SOC 2 report" },
  { id: "O-24", customer: "D Co", closed: true },
  { id: "O-25", customer: "E Co", closed: true, converted: false, quietSince: ago(60) },
] }, { now: NOW });
assert.equal(pattern.autopsied, 5, "every recorded non-conversion is autopsied");
assert.equal(pattern.knownCount, 4, "four have real evidence");
assert.equal(pattern.unknownCount, 1, "and the one without evidence is counted as unknown, on the face of the report");
const missingArtifactPattern = pattern.patterns.find((p) => p.kind === "missing-artifact");
assert.equal(missingArtifactPattern.cases, MIN_PATTERN_CASES, "three real cases");
assert.equal(missingArtifactPattern.isPattern, true, "at N cases it IS a pattern");
assert.deepEqual(missingArtifactPattern.opportunityIds, ["O-21", "O-22", "O-23"], "and the pattern cites every deal behind it");
const quietPattern = pattern.patterns.find((p) => p.kind === "gone-quiet");
assert.equal(quietPattern.isPattern, false, "one gone-quiet case stays a single case");

// -- 7. THE RENDERED REPORT PUTS UNKNOWNS ON ITS FACE AND GUESSES NOTHING ------------------------------
const md = autopsyMarkdown(pattern);
assert.ok(md.includes("## Unknown - 1"), "unknowns are on the face of the report with a count");
assert.ok(md.includes("D Co"), "and the unknown opportunity is named so it can be fixed");
assert.ok(md.includes(GUESS_FREE_NOTE), "the no-guessing rule is printed with the report");
assert.equal(/lost on price/i.test(md), false, "the comfortable guess never appears");
for (const b of pattern.blockers) {
  if (b.known) assert.ok(b.source, "every KNOWN blocker cites a source - " + b.id);
}

// -- 8. NO GUESSED-REASON VOCABULARY IN THE MODULE ITSELF ---------------------------------------------
const source = readFileSync(new URL("../src/shared/deal-blocker-autopsy.mjs", import.meta.url), "utf8");
assert.equal(/lost on price|probably|likely lost|assume/i.test(source.replace(/^\/\/.*$/gm, "")), false,
  "the module contains no guessing vocabulary in code");

console.log("# J1: deal-blocker autopsy - 8 assertion groups green");
