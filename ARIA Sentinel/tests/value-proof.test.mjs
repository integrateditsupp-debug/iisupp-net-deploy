// RUN-B B2 — real ROI ($/hours) + the real deflection % (B1) on EVERY surface, real-or-empty. Rule 14: no
// surface may invent a number. Proves (1) the pure value-proof math (ROI only from real fixes; deflection only
// from real outcomes; empty-state until real data), (2) each surface builder renders the real figure and the
// honest empty-state, and (3) the wiring: shared module -> main (valueProofNow + dashboard metrics + report
// kpis + IPC) -> preload bridge -> renderer About panel -> registered in run-all.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  valueProof, valueProofKpis, valueProofSummary, valueProofLine, VALUE_PROOF_EMPTY
} from "../src/shared/value-proof.mjs";
import { computeRoi } from "../src/shared/roi.mjs";
import { emailBody } from "../src/shared/quarterly-email.mjs";
import { executiveSummary, buildQuarterlyReport } from "../src/main/report-generator.mjs";
import { renderDigestHtml } from "../src/shared/weekly-digest.mjs";

// ── Real-or-empty: NO fixes and NO outcomes => everything null, honest empty-state (never $0-as-a-win) ──
const empty = valueProof({ fixes: 0, outcomeEvents: [] });
assert.equal(empty.hasData, false);
assert.equal(empty.hoursSaved, null, "no real fix => hoursSaved is null (empty-state), never 0");
assert.equal(empty.dollarsSaved, null, "no real fix => dollarsSaved is null, never $0");
assert.equal(empty.deflectionPct, null, "no real outcome => deflection null");
assert.equal(valueProofSummary(empty), VALUE_PROOF_EMPTY);
assert.equal(valueProofLine(empty), "--");

// ── ROI moves ONLY on real fixes and matches the audited roi.mjs math exactly ───────────────────────
const roiOnly = valueProof({ fixes: 12, outcomeEvents: [] });
const audited = computeRoi({ fixes: 12 });
assert.equal(roiOnly.hoursSaved, audited.hoursSaved, "hours trace to the audited ROI model");
assert.equal(roiOnly.dollarsSaved, audited.dollarsSaved, "dollars trace to the audited ROI model");
assert.equal(roiOnly.hoursSaved, 4.0);
assert.equal(roiOnly.dollarsSaved, 300);
assert.equal(roiOnly.deflectionPct, null, "ROI present but no outcomes => deflection still empty (real-or-empty)");
assert.equal(roiOnly.hasData, true);

// ── Deflection moves ONLY on real outcomes; an unresolved-only week is a real measured 0%, not fabricated ─
const events = [
  { outcome: "resolved", session_id: "a" },
  { outcome: "resolved", session_id: "b" },
  { outcome: "not-yet", session_id: "c" }
];
const full = valueProof({ fixes: 3, outcomeEvents: events });
assert.equal(full.deflectionPct, 67, "2 resolved of 3 conversations => real 67%");
assert.equal(full.resolved, 2);
assert.equal(full.conversations, 3);
assert.equal(full.dollarsSaved, 75, "3 fixes => real $75");
const notYet = valueProof({ fixes: 0, outcomeEvents: [{ outcome: "not-yet", session_id: "x" }] });
assert.equal(notYet.deflectionPct, 0, "a real 'not-yet' => a real measured 0% (never a flattering default)");
assert.equal(notYet.dollarsSaved, null, "0 fixes => no ROI $ even though a real outcome exists");
assert.equal(notYet.hasData, true);

// ── Summary + kpi bag are real when real, empty otherwise ───────────────────────────────────────────
const sum = valueProofSummary(full);
assert.match(sum, /\$75/, "summary carries the real $");
assert.match(sum, /67% resolved first-touch \(2\/3\)/, "summary carries the real deflection");
const kpis = valueProofKpis(full);
assert.equal(kpis.dollarsSaved, 75);
assert.equal(kpis.deflectionPct, 67);
assert.equal(valueProofKpis(empty).dollarsSaved, null, "kpi bag is real-or-null");

// ── SURFACE 1 — quarterly email: renders the real $ + deflection; empty kpis => -- (never $0 / 0% / 100%) ─
const emailReal = emailBody({ company: "Acme", quarter: "2026-Q3", kpis: { incidents: 42, uptime7d: 99.9, hoursSaved: 4, dollarsSaved: 300, deflectionPct: 67, resolved: 2, conversations: 3, version: "0.1.0" } });
assert.match(emailReal, /Value saved/, "email has the ROI $ tile");
assert.match(emailReal, /\$300/, "email renders the real $");
assert.match(emailReal, /Resolved first-touch/, "email has the deflection tile");
assert.match(emailReal, /67%/, "email renders the real deflection %");
assert.match(emailReal, /Value proof:/, "email carries the value-proof sentence when real");
const emailEmpty = emailBody({ kpis: {} });
assert.ok(emailEmpty.includes("--"), "empty kpis => -- (empty-state)");
assert.ok(!emailEmpty.includes("$0"), "never $0 for empty ROI");
assert.ok(!emailEmpty.includes("Value proof:"), "no value-proof sentence until a real $ or deflection exists");
assert.ok(!emailEmpty.includes("100%"), "never fabricates 100%");

// ── SURFACE 2 — report generator: exec summary (still 3 lines) + roi section carry real $ + deflection ─
const summaryReal = executiveSummary({ kpis: { incidents: 42, autoPct: 88, hoursSaved: 4, dollarsSaved: 300, deflectionPct: 67 } });
assert.equal(summaryReal.length, 3, "exec summary stays exactly 3 lines");
assert.match(summaryReal[0], /42 incidents/);
assert.match(summaryReal[0], /67% of issues were resolved first-touch/, "real deflection folded into the summary");
assert.match(summaryReal[0], /\$300/, "real $ folded into the summary");
const summaryEmpty = executiveSummary({});
assert.equal(summaryEmpty.length, 3);
assert.ok(!summaryEmpty[0].includes("first-touch"), "no deflection clause when empty (real-or-empty)");
assert.ok(!summaryEmpty[0].includes("saving ~0 hours"), "never claims saving ~0 hours");
const rep = buildQuarterlyReport({ quarter: "2026-Q3", kpis: { incidents: 42, hoursSaved: 4, dollarsSaved: 300, deflectionPct: 67 } });
assert.equal(rep.sections.length, 9, "report still has all 9 sections");
const roiSection = rep.sections.find((s) => s.id === "roi");
assert.match(roiSection.value, /\$300/, "roi section carries the real $");
assert.match(roiSection.value, /67% resolved first-touch/, "roi section carries the real deflection");

// ── SURFACE 3 — weekly digest: real $ row when real fixes; empty week => em-dash, never $0 ───────────
const aggReal = { fixes: 4, uptimeMinutes: 61, endpoints: 3, escalations: 1, top3: [{ recipeId: "dns-fail-v1", count: 2 }] };
const digestReal = renderDigestHtml(aggReal, { tenant: "acme", weekOf: "2026-06-15" });
assert.match(digestReal, /Value saved/, "digest has a value-saved row");
assert.match(digestReal, /\$76/, "digest renders real $ (61min ≈ 1.0h × $75 ≈ $76)");
const digestEmpty = renderDigestHtml({ fixes: 0, uptimeMinutes: 0, endpoints: 0, escalations: 0, top3: [] }, {});
assert.ok(!digestEmpty.includes("$0"), "empty week never shows $0");
assert.ok(digestEmpty.includes("&mdash;"), "empty week shows an em-dash placeholder");

// ── WIRING PROOF: shared -> main (valueProofNow + metrics + report kpis + IPC) -> preload -> renderer -> run-all ─
const root = path.resolve(import.meta.dirname, "..");
const main = fs.readFileSync(path.join(root, "src", "main", "main.mjs"), "utf8");
const preload = fs.readFileSync(path.join(root, "src", "main", "preload.cjs"), "utf8");
const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
const runAll = fs.readFileSync(path.join(root, "tests", "run-all.mjs"), "utf8");

assert.match(main, /from "\.\.\/shared\/value-proof\.mjs"/, "main imports the value-proof module");
assert.match(main, /function valueProofNow\(/, "main defines valueProofNow");
assert.match(main, /const fixes = log\.filter\(\(e\) => e\.tag === "RUN"\)\.length;\n  return valueProof\(/, "valueProofNow uses the SAME real audit-log RUN fix count");
assert.match(main, /hoursSaved: vp\.hoursSaved, dollarsSaved: vp\.dollarsSaved/, "dashboard metrics fed real-or-empty ROI");
assert.match(main, /hoursSaved: vp\.hoursSaved, dollarsSaved: vp\.dollarsSaved, deflectionPct: vp\.deflectionPct/, "report/email kpis fed real ROI + deflection");
assert.match(main, /deflection: resolutionStatsNow\(\)\.deflectionPct/, "B1 dashboard deflection wiring preserved (not regressed)");
assert.match(main, /sentinel:value-proof/, "main exposes the value-proof IPC");
assert.match(preload, /valueProof:/, "preload bridges valueProof");
assert.match(preload, /sentinel:value-proof/, "preload wires the value-proof channel");
assert.match(renderer, /from "\.\.\/shared\/value-proof\.mjs"|import\("\.\.\/shared\/value-proof\.mjs"\)/, "renderer imports the value-proof module");
assert.match(renderer, /resolved first-touch/, "renderer surfaces the real deflection alongside ROI");
assert.match(renderer, /VALUE_PROOF_EMPTY/, "renderer shows the honest empty-state");
assert.match(runAll, /value-proof\.test\.mjs/, "run-all registers this test");

console.log("value-proof (RUN-B B2) test passed (real ROI $/hours only from real fixes · real deflection only from real outcomes · empty-state until real data · email/report/digest render real-or-empty · main IPC + dashboard metrics + report kpis + preload + renderer wired).");
