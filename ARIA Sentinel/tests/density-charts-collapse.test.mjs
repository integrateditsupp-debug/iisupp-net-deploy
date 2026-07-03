// DENSITY REDESIGN (2026-07-02). Ahmad: "don't show so much data unless one-liner; SLA & KPIs as live charts;
// the rest minimized unless the user expands." This locks the progressive-disclosure contract:
//   • SLA + KPIs render as LIVE charts by default (chart host present; the raw number grids collapse below);
//   • data-heavy sections (System 421-app inventory, Compliance detail) collapse behind a one-line summary;
//   • the chart renderer is REAL-OR-EMPTY — a clean empty state when there's no real data, never a fake bar;
//   • Rule 15 — every prior id/section is still present (collapsing, not deleting).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const indexHtml = read("src", "renderer", "index.html");
const renderer = read("src", "renderer", "renderer.js");
const css = read("src", "renderer", "sentinel.css");

// ── 1 — SLA + KPIs have a live chart host, rendered by default (not inside the collapsed grid). ──
assert.match(indexHtml, /id="perfChart"/, "Performance KPI live-chart host present");
assert.match(indexHtml, /id="slaChart"/, "SLA live-chart host present");
assert.match(indexHtml, /class="kpi-chart-panel"/, "premium chart panel styling used");
assert.match(renderer, /function renderBarChart/, "renderer has the live bar-chart renderer");
assert.match(renderer, /renderBarChart\("perfChart"/, "Performance KPIs rendered as a chart");
assert.match(renderer, /renderBarChart\("slaChart"/, "SLA uptime rendered as a chart");

// ── 2 — the raw number grids collapse by default behind a one-line summary (Rule 15 keeps the ids). ──
for (const acc of ["perf-numbers", "sla-numbers", "system-apps", "compliance-detail"]) {
  assert.match(indexHtml, new RegExp(`<details class="accordion" id="${acc}"`), `${acc} collapses by default`);
}
// The heavy widgets still exist (collapsed, not deleted).
for (const id of ["perfOperational", "perfAI", "perfUsage", "slaUptime", "slaResponse", "slaBreaches", "systemContextApps", "compAudit", "compFrameworks"]) {
  assert.match(indexHtml, new RegExp(`id="${id}"`), `heavy widget #${id} preserved (collapsed, not removed)`);
}
// None of the collapsed accordions is force-open (they minimize by default).
for (const acc of ["perf-numbers", "sla-numbers", "system-apps", "compliance-detail"]) {
  assert.doesNotMatch(indexHtml, new RegExp(`<details class="accordion" id="${acc}" open`), `${acc} is collapsed (not open) by default`);
}

// ── 3 — accordion + chart styling exists (premium, consistent). ──
assert.match(css, /\.accordion\s*\{/, "accordion styling present");
assert.match(css, /\.accordion\[open\]\s*>\s*\.accordion-summary\s*>\s*\.accordion-caret/, "caret rotates on open");
assert.match(css, /\.kpi-chart-panel\s*\{/, "chart panel styling present");
assert.match(css, /\.chart-empty\s*\{/, "chart empty-state styling present");

// ── 4 — REAL-OR-EMPTY: the chart renderer draws bars only for finite values, else a clean empty state. ──
// Extract renderBarChart's body and assert it filters to finite values and emits a chart-empty fallback.
const fn = renderer.slice(renderer.indexOf("function renderBarChart"), renderer.indexOf("async function loadPerformance"));
assert.match(fn, /Number\.isFinite\(Number\(r\.value\)\)/, "chart only draws finite (real) values");
assert.match(fn, /chart-empty/, "chart shows an honest empty state when there is no real data");
assert.match(fn, /Math\.max\(0, Math\.min\(100/, "bar width is clamped 0–100% (no overflow / fabricated scale)");

// ── 5 — search auto-expands the collapsed app inventory so results are never hidden. ──
assert.match(renderer, /acc\s*=\s*qs\("#system-apps"\)[\s\S]{0,120}acc\.open\s*=\s*true/, "typing in Search auto-opens the collapsed app inventory");

console.log("density-charts-collapse test passed (SLA+KPIs as live charts · number grids + 421-app inventory + compliance detail collapse by default · real-or-empty · Rule 15 ids preserved).");
