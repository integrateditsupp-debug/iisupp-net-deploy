// RUN-F F2 — conversion-at-scale digest. Locks: only genuinely MATURED real pilots with REAL proof ever
// produce an ask; immature/maturing/zero-proof pilots are listed with an honest reason and NO ask;
// gone-quiet outranks money (re-engage, never pitch); the conversion moment is consent-gated, uses the
// Ahmad-locked outreach template byte-verbatim ([Name] only), and is ALWAYS staged — never sent.
// 🔒 Rule 14 real-or-empty. 🔒 Rule 15 additive — pilot-console.mjs / value-proof.mjs / revenue-board.mjs untouched.
import assert from "node:assert/strict";
import {
  buildConversionDigest, pilotProof, conversionMoment, conversionDigestMarkdown,
  CONVERSION_DIGEST_SCHEMA, CONVERSION_DIGEST_EMPTY, NOT_READY_REASONS, PLANS_URL
} from "../src/shared/conversion-digest.mjs";
import { OUTREACH_TEMPLATE } from "../src/shared/revenue-board.mjs";
import { VALUE_PROOF_EMPTY } from "../src/shared/value-proof.mjs";

const START = Date.parse("2026-07-01T00:00:00.000Z");
const iso = (t) => new Date(t).toISOString();
const MIN = 60000, HOUR = 3600000, DAY = 24 * HOUR;

const pilot = (org, startedAt, { ttfv = null, deviceId = "", consent, contact } = {}) => ({
  schema: "pilot.v1", started_at: iso(startedAt), org, size: "11-50", pains: ["printers"],
  device_id: deviceId || org,
  ...(consent === undefined ? {} : { consent_to_contact: consent }),
  ...(contact === undefined ? {} : { contact_name: contact }),
  ...(ttfv == null ? {} : { ttfv: { first_fix_at: iso(startedAt + ttfv * MIN), minutes: ttfv, stamped_at: iso(startedAt + ttfv * MIN) } })
});
const runs = (n, from) => Array.from({ length: n }, (_, i) => ({ ts: iso(from + (i + 1) * MIN), tag: "RUN" }));
const outcomes = (resolved, total) => [
  ...Array.from({ length: resolved }, () => ({ outcome: "resolved" })),
  ...Array.from({ length: Math.max(0, total - resolved) }, () => ({ outcome: "not-yet" }))
];
const NOW = START + 2 * HOUR;

// ── 1. EMPTY DIGEST IS HONEST (zero fabricated conversions) ────────────────────────────────────────
for (const input of [undefined, null, [], "nope", [null, {}, { org: "never started" }]]) {
  const d = buildConversionDigest(input, { now: NOW });
  assert.equal(d.schema, CONVERSION_DIGEST_SCHEMA, "schema is explicit");
  assert.equal(d.empty, true, "no real pilots => empty digest");
  assert.deepEqual(d.ready, [], "empty digest has ZERO asks — never a demo fill");
  assert.equal(d.counts.ready, 0, "ready count stays 0");
  assert.match(d.emptyCopy, /only from real matured pilots/, "honest empty copy");
}
assert.match(conversionDigestMarkdown(buildConversionDigest([], { now: NOW })), new RegExp(CONVERSION_DIGEST_EMPTY.slice(0, 30)), "empty markdown renders the honest copy, not a table");

// ── 2. PROOF IS REAL-OR-EMPTY (never "$0 saved" dressed as a win) ───────────────────────────────────
const noProof = pilotProof({ org: "A", fixCount: 0, ttfvLabel: "--" }, { outcomeEvents: [] });
assert.equal(noProof.hasProof, false, "zero real fixes => no proof");
assert.equal(noProof.dollarsSaved, null, "no invented dollars");
assert.equal(noProof.hoursSaved, null, "no invented hours");
assert.equal(noProof.deflectionPct, null, "no invented deflection");
assert.equal(noProof.summary, VALUE_PROOF_EMPTY, "honest empty summary verbatim");
assert.equal(noProof.line, "--", "narrow line is a dash, never a zero-win");

const realProof = pilotProof({ org: "A", fixCount: 4, ttfvLabel: "6 min" }, { outcomeEvents: outcomes(3, 4) });
assert.equal(realProof.hasProof, true, "real fixes => real proof");
assert.ok(realProof.dollarsSaved > 0 && realProof.hoursSaved > 0, "real hours + dollars derive from real fixes");
assert.equal(realProof.deflectionPct, 75, "deflection is the real 3/4 outcome, not a guess");
assert.match(realProof.summary, /fixed 4 issues/, "summary quotes the REAL fix count");

// ── 3. ONLY MATURED PILOTS GET AN ASK ──────────────────────────────────────────────────────────────
const records = [
  pilot("Matured", START, { ttfv: 6, consent: true, contact: "Dana" }),   // stamped + 4 fixes => ask
  pilot("Maturing", START, { consent: true, contact: "Rae" }),            // fixes, no TTFV stamp => no ask
  pilot("Immature", START, { ttfv: 6, consent: true, contact: "Sam" })    // stamped, zero fixes => no ask
];
const digest = buildConversionDigest(records, {
  now: NOW,
  auditByPilot: { Matured: runs(4, START), Maturing: runs(5, START), Immature: [] },
  outcomesByPilot: { Matured: outcomes(3, 4) }
});
assert.equal(digest.counts.pilots, 3, "all three real pilots are on the board");
assert.equal(digest.ready.length, 1, "exactly ONE genuinely ready pilot");
assert.equal(digest.ready[0].org, "Matured", "only the matured pilot is asked");
assert.equal(digest.counts.notReady, 2, "the other two are surfaced, not silently dropped");
const reasons = Object.fromEntries(digest.notReady.map((n) => [n.org, n.reason]));
assert.equal(reasons.Maturing, NOT_READY_REASONS.maturing, "maturing gets the honest maturing reason (fixes but no real TTFV)");
assert.equal(reasons.Immature, NOT_READY_REASONS.immature, "immature gets the honest immature reason");
for (const n of digest.notReady) assert.ok(!/ask/.test(n.action), `not-ready pilot ${n.org} is never given a conversion ask`);
assert.equal(digest.ready[0].proof.hasProof, true, "the ask carries a REAL proof");
assert.equal(digest.ready[0].proof.deflectionPct, 75, "the ask quotes the real first-touch %");

// A matured pilot with a stamped TTFV but no real ROI data can never be asked.
const noRoi = buildConversionDigest([pilot("Hollow", START, { ttfv: 6, consent: true, contact: "Kim" })], {
  now: NOW, auditByPilot: { Hollow: [] }
});
assert.equal(noRoi.ready.length, 0, "no real fixes => no ask, even with a TTFV stamp");
assert.equal(noRoi.notReady[0].reason, NOT_READY_REASONS.immature, "zero fixes never reads as matured");

// ── 4. GONE-QUIET OUTRANKS MONEY ───────────────────────────────────────────────────────────────────
const quiet = buildConversionDigest([pilot("Quiet", START, { ttfv: 6, consent: true, contact: "Lee" })], {
  now: START + 9 * DAY,
  auditByPilot: { Quiet: runs(5, START) },
  outcomesByPilot: { Quiet: outcomes(5, 5) }
});
assert.equal(quiet.ready.length, 0, "a silent pilot is NEVER pitched, however good its numbers");
assert.equal(quiet.notReady[0].reason, NOT_READY_REASONS.goneQuiet, "gone-quiet is the honest reason");
assert.equal(quiet.notReady[0].action, "stage-reengage-draft", "re-engage first — staged, not sent");

// ── 5. CONVERSION MOMENT: consent-gated, template verbatim, ALWAYS staged ───────────────────────────
const proofOk = { line: "$100 saved" };
const noConsent = conversionMoment({ contact_name: "Dana" }, proofOk);
assert.equal(noConsent.consent, false, "consent defaults to false — never assumed");
assert.equal(noConsent.draft, null, "no consent => NO draft into a real inbox");
assert.equal(noConsent.action, "stage-consent-request", "the staged step is asking for consent");
const noName = conversionMoment({ consent_to_contact: true }, proofOk);
assert.equal(noName.draft, null, "consent without a real name still drafts nothing");
assert.equal(noName.action, "stage-contact-capture", "capture the real contact first");
const full = conversionMoment({ consent_to_contact: true, contact_name: "Dana" }, proofOk);
assert.equal(full.action, "stage-conversion-ask", "consent + name => the ask is STAGED");
assert.equal(full.sent, false, "nothing is ever sent by this module");
assert.equal(full.plansUrl, PLANS_URL, "the conversion moment points at the real plans page");
assert.equal(full.draft, OUTREACH_TEMPLATE.split("[Name]").join("Dana"), "template byte-verbatim, [Name] the ONLY substitution");
assert.ok(!full.draft.includes("[Name]"), "no placeholder leaks into a draft");
for (const r of digest.ready) {
  assert.match(r.moment.action, /^stage-/, "every emitted action is staged");
  assert.equal(r.moment.sent, false, "a digest row can never be marked sent");
}

// ── 6. DETERMINISTIC ORDER + MARKDOWN CARRIES NO FAKE ASK ──────────────────────────────────────────
const two = buildConversionDigest([
  pilot("Small", START, { ttfv: 5, consent: true, contact: "A" }),
  pilot("Big", START + MIN, { ttfv: 5, consent: true, contact: "B" })
], {
  now: NOW,
  auditByPilot: { Small: runs(3, START), Big: runs(9, START + MIN) },
  outcomesByPilot: { Small: outcomes(3, 3), Big: outcomes(9, 9) }
});
assert.deepEqual(two.ready.map((r) => r.org), ["Big", "Small"], "biggest honest proof first — deterministic");
const md = conversionDigestMarkdown(two);
assert.ok(md.indexOf("## Big") < md.indexOf("## Small"), "markdown keeps the same honest order");
assert.match(md, /stage-conversion-ask/, "markdown names the staged action");
assert.ok(!/\bwas sent\b|\bemailed\b|\bcontacted\b/i.test(md), "markdown never claims anything was sent");
assert.match(md, /not sent/i, "markdown states plainly that the action is staged, not sent");
const mixedMd = conversionDigestMarkdown(digest);
assert.match(mixedMd, /Not asked \(honest reasons\)/, "not-ready pilots are shown with reasons, not hidden");

console.log("✓ f2-conversion-digest");
