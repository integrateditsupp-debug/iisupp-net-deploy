// H1 HONESTY DEFECT — Rule 14 (real-or-empty) for the admin console. IIS has NO customer fleet yet, so
// every fleet-implying number/customer/timestamp in admin-console/index.html + mock-data.json MUST be
// real-or-empty (honest empty state), never invented. This is a static-text guard: it fails if any known
// fabricated token comes back, if the seed arrays are re-populated with invented hosts, or if the frozen
// 2025 clock returns instead of a live JS clock.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");

const indexHtml = read("admin-console", "index.html");
const mockJson = read("admin-console", "mock-data.json");

// 1. No fabricated token may appear in EITHER file.
const FABRICATED = [
  "cust-7f3k2", "cust-19a8g", "cust-b22qd", "cust-mz04t",
  "1,248", "102,846", "38,912",
  "LAPTOP-7F3K2MJ", "DESKTOP-19A8GH",
  "2025-05-18",
  "jdoe", "asmith", "L. Carter", "S. Devi",
];
for (const tok of FABRICATED) {
  assert.ok(!indexHtml.includes(tok), `index.html must NOT contain fabricated token: ${tok}`);
  assert.ok(!mockJson.includes(tok), `mock-data.json must NOT contain fabricated token: ${tok}`);
}

// Extra invented hostnames/users that also imply a fake fleet — none may survive in either file.
const EXTRA_FAKE = [
  "WS-01F23", "LAPTOP-3H9J7P", "WS-44KK21", "LAPTOP-90ZX2", "DESKTOP-7711B", "WS-22QW88",
  "bnguyen", "rkhan", "mlopez", "Ops Bot", "acme.service-now.com",
];
for (const tok of EXTRA_FAKE) {
  assert.ok(!indexHtml.includes(tok), `index.html must NOT contain fabricated fleet token: ${tok}`);
  assert.ok(!mockJson.includes(tok), `mock-data.json must NOT contain fabricated fleet token: ${tok}`);
}

// 2. mock-data.json parses and its fleet arrays are empty (operators = the single real owner only).
const seed = JSON.parse(mockJson);
for (const key of ["release", "endpoints", "policies", "kbBundles", "integrations"]) {
  assert.ok(Array.isArray(seed[key]), `mock-data.${key} must be an array`);
  assert.equal(seed[key].length, 0, `mock-data.${key} must be empty (real-or-empty)`);
}
assert.ok(Array.isArray(seed.operators), "mock-data.operators must be an array");
assert.equal(seed.operators.length, 1, "mock-data.operators must contain only the single real owner");
assert.equal(seed.operators[0].role, "Owner", "the one operator must be the real Owner (A. Wasee)");

// 3. The inline admin data blob (what the page actually renders) parses, and its fleet arrays are empty
//    while the real product/recipe catalog + stop-code corpus are PRESERVED (Rule 15 — empty data only).
const m = indexHtml.match(/<script id="aria-admin-data"[^>]*>([\s\S]*?)<\/script>/);
assert.ok(m, "inline aria-admin-data script must exist");
const inline = JSON.parse(m[1]);
for (const key of ["release", "endpoints", "policies", "kbBundles", "integrations", "topRecipes", "topStopCodes", "audit"]) {
  assert.ok(Array.isArray(inline[key]), `inline data.${key} must be an array`);
  assert.equal(inline[key].length, 0, `inline data.${key} must be empty (real-or-empty)`);
}
assert.equal(inline.operators.length, 1, "inline operators must contain only the single real owner");
assert.ok(inline.recipes.length > 0, "real recipe catalog must be PRESERVED (not emptied)");
assert.ok(inline.stopCodes.length > 0, "real stop-code corpus must be PRESERVED (not emptied)");

// 4. Live clock present, frozen 2025 clock gone.
assert.ok(/toISOString/.test(indexHtml), "index.html must drive a live clock via toISOString()");
assert.ok(/setInterval\([\s\S]*?tick/.test(indexHtml) || /id="liveClock"/.test(indexHtml), "index.html must have a live-clock element/updater");
assert.ok(!indexHtml.includes("2025-05-18 14:32:11"), "the frozen hardcoded clock must be gone");

// 5. No hardcoded fake-customer fallback arrays remain (empty state instead).
assert.ok(!/handle:\s*'cust-/.test(indexHtml), "no hardcoded fallback fake-customer array may remain");

// 6. Honest empty-state copy is present (empty states are rendered, not left blank).
assert.ok(/No fleet connected yet|No endpoints reporting yet|No events yet/.test(indexHtml),
  "honest empty-state copy must be present");

console.log("admin-console-honesty test passed (Rule 14 real-or-empty: 0 fabricated tokens in either file, seed + inline fleet arrays empty, real recipe/stop-code catalog preserved, live clock, no fake-customer fallbacks).");
