// RUN 22 §5 — quarterly report: quarter detection + all sections populated.
import assert from "node:assert/strict";
import { quarterOf, isQuarterStart, buildQuarterlyReport, reportFilename, executiveSummary } from "../src/main/report-generator.mjs";

// Quarter detection.
assert.equal(quarterOf(Date.parse("2026-02-10T00:00:00Z")), "2026-Q1");
assert.equal(quarterOf(Date.parse("2026-07-10T00:00:00Z")), "2026-Q3");
assert.equal(isQuarterStart(Date.parse("2026-07-01T00:00:00Z")), true);
assert.equal(isQuarterStart(Date.parse("2026-04-01T00:00:00Z")), true);
assert.equal(isQuarterStart(Date.parse("2026-07-02T00:00:00Z")), false);

// Filename pattern.
assert.equal(reportFilename("LIC-9!!x", "2026-Q3"), "aria-sentinel-quarterly-LIC-9x-2026-Q3.pdf");

// Executive summary is 3 lines, no LLM, mentions the key numbers.
const data = {
  company: "Acme", quarter: "2026-Q3", license: "LIC1",
  kpis: { incidents: 42, autoPct: 88, hoursSaved: 33, accuracy: 91 },
  sla: { composite: 97.3, floor: 99.9, breaches: 1, categories: { uptime: "99.9%" } },
  compliance: { soc2: { score: 100, badge: "strong" }, gdpr: { score: 100, badge: "strong" } },
  topIncidents: [{ title: "Slow PC", outcome: "resolved" }],
  recurring: [{ issue: "DNS flaps", fix: "reset stack" }], upcoming: ["SLA review"]
};
const summary = executiveSummary(data);
assert.equal(summary.length, 3);
assert.match(summary[0], /42 incidents/);
assert.match(summary[2], /R11/);

// Full report: all 9 sections present + populated.
const rep = buildQuarterlyReport(data);
assert.equal(rep.quarter, "2026-Q3");
assert.equal(rep.sections.length, 9);
const ids = rep.sections.map((s) => s.id);
for (const id of ["summary", "kpis", "sla", "incidents", "roi", "compliance", "recurring", "upcoming", "trust"]) assert.ok(ids.includes(id), `section ${id}`);
assert.match(rep.html, /Executive summary/);
assert.match(rep.html, /Compliance posture/);
assert.match(rep.html, /SOC2/i);
assert.match(rep.html, /33 hours/);

console.log("Report-generator-quarterly test passed (quarter detection · 9 sections · 3-line exec summary).");
