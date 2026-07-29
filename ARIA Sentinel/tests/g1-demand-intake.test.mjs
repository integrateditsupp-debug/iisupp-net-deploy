// RUN-G G1 - demand intake. Locks: real-or-empty (no invented lead), evidence-or-excluded,
// evidence-preserving dedupe, deterministic + explainable qualification, and a module that
// structurally cannot send, fetch, spawn, or touch the filesystem.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildDemandIntake, demandIntakeMarkdown, identityKey, signalEvidenceOk, qualify,
  scoreIcpFit, scoreUrgency, scoreReachability, SIGNAL_KINDS, DEMAND_INTAKE_SCHEMA, DEMAND_INTAKE_EMPTY,
} from "../src/shared/demand-intake.mjs";

const NOW = Date.parse("2026-07-21T08:00:00.000Z");
const iso = (d) => new Date(NOW - d * 86400000).toISOString();

// -- 1. EMPTY IS HONEST ------------------------------------------------------------------------------
for (const input of [undefined, null, [], "nope", { signals: [] }]) {
  const q = buildDemandIntake(input, { now: NOW });
  assert.equal(q.schema, DEMAND_INTAKE_SCHEMA, "schema is explicit");
  assert.equal(q.empty, true, "no signals => empty queue");
  assert.equal(q.qualifiedCount, 0, "nothing invented");
  assert.deepEqual(q.queue, [], "queue is honestly empty");
}
const emptyMd = demandIntakeMarkdown(buildDemandIntake([], { now: NOW }));
assert.ok(emptyMd.includes(DEMAND_INTAKE_EMPTY), "empty markdown renders honest copy");
assert.ok(!emptyMd.includes("| Lead key |"), "empty queue never renders a lead table");

// -- 2. EVIDENCE OR EXCLUDED -------------------------------------------------------------------------
assert.equal(signalEvidenceOk({}), false, "no source/date => not evidence");
assert.equal(signalEvidenceOk({ source: "  ", firstSeenAt: iso(1) }), false, "blank source is not evidence");
assert.equal(signalEvidenceOk({ source: "site form", firstSeenAt: "not-a-date" }), false, "unparseable date is not evidence");
assert.equal(signalEvidenceOk({ source: "site form", firstSeenAt: iso(1) }), true, "source + date = evidence");

const junk = buildDemandIntake([
  null,
  { id: "j1" },                                                              // no kind
  { id: "j2", kind: "cold-scrape", source: "list", firstSeenAt: iso(1) },    // unknown kind
  { id: "j3", kind: "site-enquiry" },                                        // no evidence
  { id: "j4", kind: "referral", source: "note", firstSeenAt: iso(1) },       // no identity
], { now: NOW });
assert.equal(junk.qualifiedCount, 0, "junk never becomes a lead");
assert.equal(junk.excluded.length, 5, "every rejected signal is logged, never silently dropped");
assert.match(junk.excluded.find((x) => x.id === "j2").reason, /unknown signal kind/, "reason names the kind");
assert.match(junk.excluded.find((x) => x.id === "j3").reason, /no evidence/, "reason names missing evidence");
assert.match(junk.excluded.find((x) => x.id === "j4").reason, /no identity/, "reason names missing identity");
assert.deepEqual(SIGNAL_KINDS, ["site-enquiry", "tender-hit", "referral"], "accepted kinds are explicit");

// -- 3. IDENTITY + EVIDENCE-PRESERVING DEDUPE --------------------------------------------------------
assert.equal(identityKey({ email: " Ops@Acme.CA " }), "email:ops@acme.ca", "email normalizes");
assert.equal(identityKey({ domain: "https://WWW.Acme.ca/contact" }), "domain:acme.ca", "domain normalizes");
assert.equal(identityKey({ company: "  Acme   Dental  " }), "company:acme dental", "company collapses whitespace");
assert.equal(identityKey({}), null, "no identity => null, never a random key");

const dupes = buildDemandIntake([
  { id: "s1", kind: "site-enquiry", source: "iisupp.net form", firstSeenAt: iso(9),
    email: "ops@acme.ca", seats: 40, region: "Whitby ON", need: "managed support", inboundConsent: true },
  { id: "s2", kind: "referral", source: "referral note 2026-07", firstSeenAt: iso(12),
    email: "OPS@ACME.CA", phone: "905-555-0100" },
], { now: NOW });
assert.equal(dupes.accepted, 2, "both signals accepted");
assert.equal(dupes.unique, 1, "same email => one lead, not two");
assert.equal(dupes.deduped, 1, "the duplicate is counted, not hidden");
const row = dupes.rows[0];
assert.equal(row.sources.length, 2, "BOTH sources survive the merge - provenance preserved");
assert.equal(row.firstSeenAt, iso(12), "EARLIEST first-seen wins");
assert.deepEqual(row.kinds.sort(), ["referral", "site-enquiry"], "both kinds recorded");
assert.equal(row.qualified, true, "merged evidence qualifies the lead");

// -- 4. QUALIFICATION IS DETERMINISTIC + EXPLAINABLE, MISSING FIELDS SCORE 0 --------------------------
const blank = scoreIcpFit({});
assert.equal(blank.score, 0, "no ICP fields => 0, never estimated");
assert.match(blank.why, /unknown/, "the why says the field is unknown");
assert.equal(scoreIcpFit({ seats: 40, region: "Whitby", need: "managed support" }).score, 50, "full real ICP evidence = 50/50");
assert.equal(scoreUrgency({ firstSeenAt: iso(1) }, NOW).score, 10, "no deadline => only freshness credit");
assert.match(scoreUrgency({ firstSeenAt: iso(1) }, NOW).why, /never invented/, "absent deadline is stated honestly");
assert.ok(scoreUrgency({ firstSeenAt: iso(1), deadlineAt: iso(-3) }, NOW).score > scoreUrgency({ firstSeenAt: iso(1), deadlineAt: iso(-25) }, NOW).score, "tighter real deadline ranks higher");
assert.equal(scoreUrgency({ firstSeenAt: iso(1), deadlineAt: iso(5) }, NOW).score, 10, "a PASSED deadline earns no urgency credit");
assert.equal(scoreReachability({}).reachable, false, "no channel => not reachable");
assert.match(scoreReachability({}).why, /no reachable channel/, "why names the gap");
assert.match(scoreReachability({ email: "a@b.ca" }).why, /one-click/, "non-inbound contact is flagged as Ahmad's click");

const unreachable = qualify({ seats: 40, region: "Whitby", need: "managed support", firstSeenAt: iso(1) }, NOW);
assert.equal(unreachable.qualified, false, "perfect ICP with no channel does NOT qualify");
assert.match(unreachable.blockers.join(" "), /no reachable channel/, "blocker is named");
const thin = qualify({ email: "a@b.ca", firstSeenAt: iso(1) }, NOW);
assert.equal(thin.qualified, false, "a channel alone does NOT qualify - ICP evidence required");
assert.match(thin.blockers.join(" "), /ICP evidence/, "blocker is named");

// -- 5. RANKING IS DETERMINISTIC + ACTIONS ARE ALWAYS STAGED -----------------------------------------
const many = buildDemandIntake([
  { id: "a", kind: "site-enquiry", source: "form", firstSeenAt: iso(1), email: "a@a.ca", seats: 40, region: "Toronto", need: "managed support", inboundConsent: true },
  { id: "b", kind: "tender-hit", source: "bids portal", firstSeenAt: iso(1), email: "b@b.ca", seats: 60, region: "Ontario", need: "helpdesk", deadlineAt: iso(-5) },
  { id: "c", kind: "site-enquiry", source: "form", firstSeenAt: iso(30), email: "c@c.ca", seats: 5000, region: "Nunavut", need: "one-off laptop setup" },
], { now: NOW });
assert.equal(many.qualifiedCount, 2, "only leads with REAL ICP evidence qualify - the weak-fit row is honestly held back");
assert.equal(many.unique, 3, "all three are tracked - the unqualified one is kept, not deleted");
assert.equal(many.rows.find((r) => r.key === "email:c@c.ca").qualified, false, "5000 seats / out-of-region / one-off does not clear the ICP bar");
assert.equal(many.queue[0].key, "email:b@b.ca", "the live tender deadline ranks first");
for (const r of many.rows) {
  assert.equal(r.action.staged, true, "every action is staged");
  assert.equal(r.action.executed, false, "nothing is ever executed by this module");
  assert.equal(r.action.kind, "ahmad-one-click", "every action is Ahmad's click");
  assert.ok(r.why.icpFit && r.why.urgency && r.why.reachability, "every row explains itself in one line each");
}
assert.equal(many.nothingSent, true, "board asserts nothing was sent");
const md = demandIntakeMarkdown(many);
assert.ok(md.includes("Rule 14"), "markdown carries the honesty footer");
assert.ok(md.includes("| Lead key |"), "qualified queue renders a table");

// -- 6. STATIC SCAN: the module CANNOT send, fetch, spawn, or read the disk ---------------------------
const src = readFileSync(new URL("../src/shared/demand-intake.mjs", import.meta.url), "utf8");
for (const forbidden of ["fetch(", "XMLHttpRequest", "node:http", "node:https", "child_process", "node:fs", "require(", "exec(", "spawn(", "sendMail", "nodemailer"]) {
  assert.ok(!src.includes(forbidden), `demand-intake must not reference ${forbidden}`);
}
assert.ok(!/executed:\s*true/.test(src), "no code path can mark an action executed");

console.log("g1-demand-intake: 6 assertion groups PASSED");
