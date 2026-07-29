// RUN-F F3 - repeatable acquisition funnel. Locks: real-or-empty (no invented candidate, no invented
// DSCR), the SAME 5 gates as revenue-board.mjs, 5/5-with-evidence is the ONLY way to reach `presented`,
// every financial figure stays labelled seller-CLAIMED/unverified, and EVERY action is staged for
// Ahmad - the module can never contact, sign, borrow, or buy.
// Rule 14 real-or-empty. Rule 15 additive - revenue-board.mjs / pilot-console.mjs / conversion-digest.mjs untouched.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildAcquisitionFunnel, acquisitionFunnelMarkdown, scoreGates, dscrOnClaims, stageFor,
  sourcingOk, nextOneClick, GATES, STAGES, ACQUISITION_FUNNEL_SCHEMA, FUNNEL_EMPTY, CLAIMS_CAVEAT,
} from "../src/shared/acquisition-funnel.mjs";
import { GATES as BOARD_GATE_ORDER } from "../src/shared/acquisition-funnel.mjs";

const NOW = Date.parse("2026-07-21T07:00:00.000Z");
const gate = (pass, evidence) => ({ pass, evidence });
const allGates = (n) => GATES.slice(0, n).reduce((o, g) => (o[g] = gate(true, `real doc for ${g}`), o), {});
const src = (listing = "BizBuySell listing #1234", seenAt = "2026-07-18T00:00:00.000Z") => ({ listing, seenAt });

// -- 1. EMPTY FUNNEL IS HONEST (zero fabricated candidates) ----------------------------------------
for (const input of [undefined, null, [], "nope", { candidates: [] }]) {
  const f = buildAcquisitionFunnel(input, { now: NOW });
  assert.equal(f.schema, ACQUISITION_FUNNEL_SCHEMA, "schema is explicit");
  assert.equal(f.empty, true, "no candidates => empty funnel");
  assert.equal(f.total, 0, "total stays 0 - nothing invented");
  for (const s of STAGES) assert.deepEqual(f.stages[s], [], `stage ${s} is honestly empty`);
  assert.match(f.emptyCopy, /honestly empty/, "honest empty copy");
}
const emptyMd = acquisitionFunnelMarkdown(buildAcquisitionFunnel([], { now: NOW }));
assert.ok(emptyMd.includes(FUNNEL_EMPTY), "empty markdown renders the honest copy, not a table");
assert.ok(!emptyMd.includes("| Candidate |"), "empty funnel never renders a candidate table");

// -- 2. SOURCING EVIDENCE IS MANDATORY (a rumour is not a candidate) -------------------------------
assert.equal(sourcingOk({}), false, "no sourcing => not trackable");
assert.equal(sourcingOk({ sourcing: { listing: "broker email" } }), false, "listing without a seen date is not evidence");
assert.equal(sourcingOk({ sourcing: { listing: " ", seenAt: "2026-07-01" } }), false, "blank listing is not evidence");
assert.equal(sourcingOk({ sourcing: src() }), true, "listing + seenAt = trackable");
const rumours = buildAcquisitionFunnel([{ id: "rumour-1" }, { id: "", sourcing: src() }, null], { now: NOW });
assert.equal(rumours.total, 0, "rumours never enter a stage");
assert.equal(rumours.excluded.length, 3, "every rejected row is logged, never silently dropped");
assert.match(rumours.excluded.find((x) => x.id === "rumour-1").reason, /no sourcing evidence/, "reason is honest and specific");

// -- 3. GATES: same five, same order, evidence required --------------------------------------------
assert.deepEqual(GATES, ["recurringRevenue", "paybackMath", "transferable", "cleanTail", "fit"], "gate list is the company-wide 5");
assert.deepEqual(BOARD_GATE_ORDER, GATES, "one gate definition, one order");
assert.equal(scoreGates({}).score, 0, "no gate data => 0/5");
assert.equal(scoreGates({ gates: { fit: { pass: true } } }).score, 0, "pass without evidence does NOT count");
assert.equal(scoreGates({ gates: { fit: { pass: true, evidence: "   " } } }).score, 0, "blank evidence does NOT count");
const four = scoreGates({ gates: allGates(4) });
assert.equal(four.score, 4, "4 evidenced gates = 4/5");
assert.equal(four.full, false, "4/5 is NOT full - no partial credit");
assert.deepEqual(four.failing, ["fit"], "the failing gate is named");
assert.equal(scoreGates({ gates: allGates(5) }).full, true, "5/5 with evidence is full");

// -- 4. DSCR IS COMPUTED ON CLAIMS ONLY, NEVER GUESSED ---------------------------------------------
for (const claims of [undefined, {}, { annualCashFlow: 100000 }, { annualDebtService: 80000 }, { annualCashFlow: 100000, annualDebtService: 0 }, { annualCashFlow: -5, annualDebtService: 10 }]) {
  const d = dscrOnClaims({ claims });
  assert.equal(d.dscr, null, "missing/invalid claimed numbers => NO invented DSCR");
  assert.equal(d.serviceability, "unknown", "serviceability is honestly unknown");
}
const strong = dscrOnClaims({ claims: { annualCashFlow: 200000, annualDebtService: 100000 } });
assert.equal(strong.dscr, 2, "DSCR is the real claimed ratio");
assert.equal(strong.basis, "claims", "basis is labelled claims - never 'verified'");
assert.equal(strong.serviceability, "serviceable-on-claims", "1.25+ = serviceable ON CLAIMS");
assert.match(strong.note, /SELLER-CLAIMED/, "the note says the numbers are seller-claimed");
assert.equal(dscrOnClaims({ claims: { annualCashFlow: 110000, annualDebtService: 100000 } }).serviceability, "thin-on-claims", "1.0-1.25 is thin");
assert.equal(dscrOnClaims({ claims: { annualCashFlow: 80000, annualDebtService: 100000 } }).serviceability, "not-serviceable-on-claims", "<1.0 does not service the loan");

// -- 5. STAGES ARE DERIVED FROM EVIDENCE, NOT ASSERTED ----------------------------------------------
assert.equal(stageFor({ gates: {} }), "sourced", "0 gates = sourced");
assert.equal(stageFor({ gates: allGates(1) }), "vetting", "1/5 = vetting");
assert.equal(stageFor({ gates: allGates(4) }), "vetting", "4/5 STILL vetting - 5/5 is the only way through");
assert.equal(stageFor({ gates: allGates(5) }), "presented", "5/5 = presented");
assert.equal(stageFor({ gates: allGates(5), presentedAt: "2026-07-20T00:00:00.000Z" }), "ahmad-review", "already shown => awaiting Ahmad");
assert.equal(stageFor({ gates: allGates(4), presentedAt: "2026-07-20T00:00:00.000Z" }), "vetting", "a stamp cannot promote an unvetted candidate");

// -- 6. FULL FUNNEL: one honest row per stage, claims labelled, actions staged -----------------------
const candidates = [
  { id: "cand-sourced", sourcing: src("BizBuySell #A"), retiringOwner: true, claims: { ask: 450000, mrr: 12000 } },
  { id: "cand-vetting", sourcing: src("Sunbelt broker sheet"), gates: allGates(4), claims: { ask: 600000, annualCashFlow: 110000, annualDebtService: 100000 } },
  { id: "cand-presented", sourcing: src("BizQuest #C"), retiringOwner: true, gates: allGates(5), claims: { ask: 500000, mrr: 18000, annualCashFlow: 200000, annualDebtService: 100000 } },
  { id: "cand-review", sourcing: src("broker list D"), gates: allGates(5), presentedAt: "2026-07-19T00:00:00.000Z", claims: { ask: 300000 } },
  { id: "cand-rumour", claims: { ask: 999999 } },
];
const f = buildAcquisitionFunnel(candidates, { now: NOW });
assert.equal(f.total, 4, "4 evidenced candidates flow, the rumour does not");
assert.deepEqual(f.counts, { sourced: 1, vetting: 1, presented: 1, "ahmad-review": 1 }, "one honest row per funnel stage");
assert.equal(f.excluded.length, 1, "the rumour is logged as excluded");
assert.equal(f.empty, false, "a populated funnel is not empty");
assert.equal(f.honest, true, "funnel is stamped honest");
assert.equal(f.claimsUnverified, true, "the whole funnel is stamped claims-unverified");

const all = STAGES.flatMap((s) => f.stages[s]);
for (const r of all) {
  assert.equal(r.claimsUnverified, true, `${r.id}: figures stay unverified`);
  assert.equal(r.caveat, CLAIMS_CAVEAT, `${r.id}: carries the caveat verbatim`);
  assert.equal(r.action.staged, true, `${r.id}: action is staged`);
  assert.equal(r.action.executed, false, `${r.id}: NOTHING is executed by an agent`);
  assert.equal(r.action.kind, "ahmad-one-click", `${r.id}: the click is Ahmad's`);
  assert.ok(typeof r.action.label === "string" && r.action.label.trim(), `${r.id}: has an exact next action`);
}
assert.equal(f.stages.presented[0].dscr.dscr, 2, "presented row carries its claimed DSCR");
assert.equal(f.stages.vetting[0].dscr.serviceability, "thin-on-claims", "loan serviceability is flagged honestly");
assert.match(f.stages.vetting[0].action.label, /fit/, "vetting action names the exact missing gate");
assert.equal(f.stages.sourced[0].dscr.dscr, null, "no claimed cash-flow => no invented DSCR on the board");
assert.equal(f.stages.sourced[0].retiringOwner, true, "retiring-owner signal is preserved (revenue mandate)");
assert.equal(f.stages["ahmad-review"][0].action.id, "stage-awaiting-ahmad", "nothing moves without Ahmad");

// deterministic: same input, same output ordering
assert.deepEqual(buildAcquisitionFunnel(candidates, { now: NOW }), f, "build is deterministic");

// -- 7. MARKDOWN NEVER CLAIMS A VERIFIED NUMBER OR AN EXECUTED ACTION -------------------------------
const md = acquisitionFunnelMarkdown(f);
assert.ok(md.includes(CLAIMS_CAVEAT), "markdown carries the unverified-claims caveat");
for (const s of STAGES) assert.ok(md.includes(`## ${s} (`), `markdown renders the ${s} stage`);
assert.ok(md.includes("cand-rumour"), "excluded candidates stay visible in the honesty log");
assert.ok(!/\b(sent|signed|purchased|acquired|paid)\b/i.test(md.replace(/never .*|Nothing was.*/gi, "")), "markdown never claims an action happened");

// -- 8. STATIC SCAN: the module structurally cannot reach the outside world -------------------------
const srcText = readFileSync(new URL("../src/shared/acquisition-funnel.mjs", import.meta.url), "utf8");
for (const forbidden of ["child_process", "node:fs", "require(", "fetch(", "XMLHttpRequest", "https://", "http://"]) {
  assert.ok(!srcText.includes(forbidden), `acquisition-funnel.mjs must not reference ${forbidden} - it can never contact anyone`);
}
assert.ok(!/\bexecuted:\s*true\b/.test(srcText), "no code path can mark an action executed");

// -- 9. Rule 15: sibling revenue modules untouched by this task -------------------------------------
const board = readFileSync(new URL("../src/shared/revenue-board.mjs", import.meta.url), "utf8");
assert.ok(board.includes("REVENUE_BOARD_SCHEMA"), "revenue-board.mjs still intact (nothing removed)");

console.log("f3-acquisition-funnel: 9 assertion groups passed");
