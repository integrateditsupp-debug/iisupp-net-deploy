// RUN 22 §5/§6 — an ad-hoc report (any date range / quarter label) uses the SAME template + sections.
import assert from "node:assert/strict";
import { buildQuarterlyReport } from "../src/main/report-generator.mjs";

const base = { company: "Acme", license: "LIC1", kpis: { incidents: 5, autoPct: 80, hoursSaved: 3 }, sla: { composite: 98, floor: 99, breaches: 0 }, compliance: { soc2: { score: 100, badge: "strong" } } };

// Ad-hoc with an explicit (custom) quarter/period label.
const adhoc = buildQuarterlyReport({ ...base, quarter: "2026-custom-Jun01-Jun15" });
assert.equal(adhoc.quarter, "2026-custom-Jun01-Jun15");
assert.match(adhoc.filename, /aria-sentinel-quarterly-LIC1-2026-custom-Jun01-Jun15\.pdf/);

// Same section structure as the quarterly report (template reuse — no second code path).
const quarterly = buildQuarterlyReport({ ...base, quarter: "2026-Q3" });
assert.deepEqual(adhoc.sections.map((s) => s.id), quarterly.sections.map((s) => s.id));
assert.equal(adhoc.sections.length, 9);
assert.match(adhoc.html, /Executive summary/);

// Reports tab exposes the ad-hoc generate button.
import fs from "node:fs";
import path from "node:path";
const indexHtml = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "src", "renderer", "index.html"), "utf8");
assert.match(indexHtml, /id="generateReport"/, "ad-hoc generate button present");
const renderer = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "src", "renderer", "renderer.js"), "utf8");
assert.match(renderer, /generateReport\?\.\(\{ adhoc: true \}\)/, "renderer requests an ad-hoc report");

console.log("Report-generator-adhoc test passed (custom range · identical template + sections · UI wired).");
