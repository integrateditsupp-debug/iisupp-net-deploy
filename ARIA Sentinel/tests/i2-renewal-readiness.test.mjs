// RUN-I I2 - renewal earned, not assumed. Locks: healthy / at-risk / not-enough-data are all reachable
// from fixtures, every verdict cites the records behind it, silence is reported as a churn signal,
// escalations print as plainly as wins, and no renewal is ever counted as booked revenue.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assessAccount, assessRenewals, renewalMarkdown, usableRecord, splitRecords,
  RENEWAL_SCHEMA, BOOKED_REVENUE_CAD, MIN_RESOLVED_FOR_HEALTHY, QUIET_DAYS, ESCALATION_RISK_RATIO,
  VERDICTS, NOT_ENOUGH_DATA_NOTE,
} from "../src/shared/renewal-readiness.mjs";

const NOW = Date.parse("2026-07-21T12:00:00.000Z");
const ago = (d) => new Date(NOW - d * 86400000).toISOString();

// -- 1. NOTHING IS EVER BOOKED -----------------------------------------------------------------------
assert.equal(BOOKED_REVENUE_CAD, 0, "renewal revenue is a zero constant");
const empty = assessRenewals([], { now: NOW });
assert.equal(empty.bookedRevenueCad, 0, "an empty portfolio books nothing");
assert.equal(empty.assumedRenewals, 0, "zero assumed renewals, structurally");
assert.deepEqual(empty.counts, { healthy: 0, "at-risk": 0, "not-enough-data": 0 }, "no verdict is invented from nothing");
assert.ok(renewalMarkdown(empty).includes("Honestly empty"), "an empty report says so");
assert.equal(renewalMarkdown(empty).includes("##"), false, "an empty report renders no account sections");

// -- 2. A RECORD COUNTS ONLY IF IT IS FULLY REAL ------------------------------------------------------
assert.equal(usableRecord({}), null, "no id, no timestamp => not evidence");
assert.equal(usableRecord({ id: "T-1" }), null, "an id with no timestamp is not evidence");
assert.equal(usableRecord({ id: "T-1", at: "sometime" }), null, "an unparseable timestamp is not evidence");
assert.equal(usableRecord({ id: "  ", at: ago(1) }), null, "a blank id is not evidence");
const split = splitRecords([{ id: "T-1", at: ago(1) }, { id: "T-2" }, "junk"]);
assert.equal(split.usable.length, 1, "only the verifiable record is used");
assert.equal(split.excluded.length, 2, "everything unverifiable is excluded and listed");
assert.ok(split.excluded.every((e) => /not verifiable|no verifiable/.test(e.reason)), "each exclusion says why");

// -- 3. NOT-ENOUGH-DATA IS REACHABLE AND HONEST ------------------------------------------------------
const unknown = assessAccount({ customer: "Quiet Co", records: [{ id: "T-x" }] }, { now: NOW });
assert.equal(unknown.verdict, "not-enough-data", "no usable record => unknown, never 'on track'");
assert.equal(unknown.reasons[0], NOT_ENOUGH_DATA_NOTE, "the unknown verdict states it is unknown, not assumed");
assert.deepEqual(unknown.citations, [], "an unknown verdict cites nothing because it has nothing");
assert.equal(unknown.signals, null, "no signals are fabricated for an account with no evidence");
const unnamed = assessAccount({ records: [{ id: "T-1", at: ago(1) }] }, { now: NOW });
assert.equal(unnamed.verdict, "not-enough-data", "an unnamed account is not assessed");

// -- 4. AT-RISK: SILENCE, ESCALATIONS, AND THIN DELIVERY ARE EACH NAMED -------------------------------
const quiet = assessAccount({
  customer: "Gone Quiet Ltd",
  records: [
    { id: "T-301", at: ago(80), kind: "resolved" },
    { id: "T-302", at: ago(75), kind: "resolved" },
    { id: "T-303", at: ago(70), kind: "resolved" },
  ],
}, { now: NOW });
assert.equal(quiet.verdict, "at-risk", "an account that went quiet is at risk, not healthy by default");
assert.ok(quiet.reasons.some((r) => /Gone quiet/.test(r)), "the quiet signal is named in those words");
assert.ok(quiet.signals.daysSinceLastRecord >= QUIET_DAYS, "the real day count drives it");
assert.ok(quiet.reasons.some((r) => r.includes("T-301") || r.includes("T-303")), "the last real record is cited");

const escalating = assessAccount({
  customer: "Escalation Corp",
  records: [
    { id: "T-401", at: ago(5), kind: "resolved" },
    { id: "T-402", at: ago(4), kind: "resolved" },
    { id: "T-403", at: ago(3), kind: "resolved" },
    { id: "T-404", at: ago(2), kind: "escalation" },
    { id: "T-405", at: ago(1), kind: "escalation" },
  ],
}, { now: NOW });
assert.equal(escalating.verdict, "at-risk", "a bad escalation rate is at risk");
assert.ok(escalating.signals.escalationRatio >= ESCALATION_RISK_RATIO, "the real ratio drives it");
assert.ok(escalating.reasons.some((r) => /flatters us or not/.test(r)), "the unflattering number is disclosed");

const thin = assessAccount({
  customer: "Thin Delivery Inc",
  records: [{ id: "T-501", at: ago(2), kind: "resolved" }],
}, { now: NOW });
assert.equal(thin.verdict, "at-risk", "thin delivery is not renewal evidence");
assert.ok(thin.reasons.some((r) => r.includes(String(MIN_RESOLVED_FOR_HEALTHY))), "the threshold it fell short of is stated");

// -- 5. HEALTHY IS REACHABLE, AND ONLY BECAUSE THE RECORDS SAY SO ------------------------------------
const healthy = assessAccount({
  customer: "Northline Logistics",
  records: [
    { id: "T-601", at: ago(9), kind: "resolved" },
    { id: "T-602", at: ago(6), kind: "resolved" },
    { id: "T-603", at: ago(3), kind: "resolved" },
    { id: "T-604", at: ago(1), kind: "resolved" },
  ],
}, { now: NOW });
assert.equal(healthy.verdict, "healthy", "real, recent, sufficient delivery => healthy");
assert.ok(healthy.reasons.some((r) => /not by default/.test(r)), "healthy is justified, never assumed");
assert.deepEqual(healthy.citations, ["T-601", "T-602", "T-603", "T-604"], "every record behind the verdict is cited");
assert.equal(healthy.bookedRevenueCad, 0, "a healthy renewal is still $0 until money lands");

// -- 6. PORTFOLIO COUNTS ARE THE REAL COUNTS ----------------------------------------------------------
const real = assessRenewals([
  { customer: "Northline Logistics", records: [{ id: "T-601", at: ago(9) }, { id: "T-602", at: ago(6) }, { id: "T-603", at: ago(3) }] },
  { customer: "Gone Quiet Ltd", records: [{ id: "T-301", at: ago(80) }, { id: "T-302", at: ago(75) }, { id: "T-303", at: ago(70) }] },
  { customer: "No Evidence Co", records: [] },
], { now: NOW });
assert.deepEqual(real.counts, { healthy: 1, "at-risk": 1, "not-enough-data": 1 }, "all three verdicts reachable from real fixtures");
assert.equal(real.counts.healthy + real.counts["at-risk"] + real.counts["not-enough-data"], real.accounts.length, "counts add up to reality");
assert.ok(VERDICTS.every((v) => typeof v === "string"), "the verdict vocabulary is closed");
const md = renewalMarkdown(real);
assert.ok(md.includes("AT-RISK"), "risk is on the face of the report");
assert.ok(md.includes("Assumed renewals: 0"), "zero assumed renewals is printed");
assert.ok(md.includes("Records: T-601"), "citations are printed for the reader to check");

// -- 7. STATIC SCAN - NOTHING EXECUTES, NOTHING IS BOOKED --------------------------------------------
const SRC = readFileSync(new URL("../src/shared/renewal-readiness.mjs", import.meta.url), "utf8");
for (const bad of ["fetch(", "node:http", "node:net", "node:fs", "child_process", "require(", "process.env", "Math.random"]) {
  assert.equal(SRC.includes(bad), false, "renewal-readiness has no " + bad);
}
assert.equal(/bookedRevenueCad\s*=\s*[1-9]/.test(SRC), false, "no code path books renewal revenue");
assert.equal(SRC.includes("assumedRenewals: 0"), true, "assumed renewals is a hard zero in the source");

console.log("i2-renewal-readiness: OK");
