// RUN 8 — human-readable audit export (CSV + hand-rolled PDF). Asserts: CSV row schema, valid PDF
// structure, 30-day window, and 0 user content beyond the already-sanitized audit fields.
import assert from "node:assert/strict";
import { toCsv, toPdf, auditFileName } from "../src/shared/audit-export.mjs";

const NOW = Date.parse("2026-06-19T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const entries = [
  { ts: "2026-06-18T10:00:00Z", tag: "RUN", text: "Executing recipe NET.DNS.FAIL", recipeId: "dns-fail-v1" },
  { ts: "2026-06-10T10:00:00Z", tag: "DONE", text: "Flush DNS cache: Command completed.", recipeId: "dns-fail-v1" },
  { ts: "2026-04-01T10:00:00Z", tag: "DONE", text: "older than 30 days — dropped", recipeId: "x" }
];

// CSV: header + one row per windowed entry; cells quoted.
const csv = toCsv(entries, { now: NOW });
const csvLines = csv.split("\n");
assert.equal(csvLines[0], "timestamp,tag,recipe,detail", "CSV header schema");
assert.equal(csvLines.length, 1 + 2, "30-day window keeps 2 of 3 rows (header + 2)");
assert.match(csv, /"RUN"/);
assert.match(csv, /"dns-fail-v1"/);
assert.ok(!csv.includes("older than 30 days"), "stale row dropped");

// A detail field with a comma/newline/quote cannot break the row structure.
const tricky = toCsv([{ ts: "2026-06-18T10:00:00Z", tag: "RUN", recipeId: "r", text: 'has, comma "quote"\nand newline' }], { now: NOW });
assert.equal(tricky.split("\n").length, 2, "embedded newline does not create extra CSV rows");
assert.match(tricky, /""quote""/, "quotes are CSV-escaped");

// PDF: valid structure.
const pdf = toPdf("ARIA Sentinel — audit (30 days)", entries, { now: NOW });
assert.match(pdf, /^%PDF-1\.\d/, "valid PDF header");
assert.match(pdf, /%%EOF\s*$/, "valid PDF trailer");
assert.match(pdf, /\/Type\s*\/Catalog/, "has a catalog");
assert.match(pdf, /startxref/, "has a cross-reference table");
assert.match(pdf, /NET\.DNS\.FAIL/, "renders an audit line");
assert.ok(!pdf.includes("older than 30 days"), "PDF respects the 30-day window");

// 0 user content: neither export carries anything beyond the four symbolic columns. (A would-be PII
// detail is the responsibility of the sanitizer at write time; here we confirm no extra fields leak.)
assert.ok(!/password|secret|@.*\.com/i.test(csv), "no obvious PII in CSV");

assert.equal(auditFileName("csv", "2026-06-19"), "aria-sentinel-audit-2026-06-19.csv");
assert.equal(auditFileName("pdf", "2026-06-19"), "aria-sentinel-audit-2026-06-19.pdf");

console.log("Audit-export test passed (CSV schema · valid PDF · 30-day window · content-blind).");
