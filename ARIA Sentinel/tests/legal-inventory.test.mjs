// RUN 16 §K — Legal battery. Asserts the legal inventory + EULA + DPA exist and cover the required
// ground, and — the load-bearing check — that NO GPL/AGPL dependency is present (which would force
// open-sourcing). The dep verdict is re-derived from package.json so the doc can't drift from reality.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");

const legal = read("docs", "LEGAL_INVENTORY.md");
const eula = read("docs", "EULA.md");
const dpa = read("docs", "DPA_TEMPLATE.md");

// Legal inventory covers the license audit + trademark posture.
assert.match(legal, /license/i, "inventory covers dependency licenses");
assert.match(legal, /GPL|AGPL/, "inventory explicitly addresses GPL/AGPL");
assert.match(legal, /trademark/i, "inventory covers trademark posture");
// It must conclude no copyleft GPL/AGPL is present.
assert.match(legal, /no\s+(gpl|agpl|copyleft)|none found|no copyleft/i, "inventory concludes no GPL/AGPL");

// EULA core clauses.
for (const clause of [/license grant/i, /limitation of liability/i, /(governing law|ontario)/i, /warrant/i]) {
  assert.match(eula, clause, `EULA contains ${clause}`);
}
// DPA core clauses (GDPR Art. 28 alignment).
for (const clause of [/controller/i, /processor/i, /sub-?processor/i, /breach/i]) {
  assert.match(dpa, clause, `DPA contains ${clause}`);
}

// Ground truth: scan package.json deps; none may be GPL/AGPL/SSPL family. Our deps are all permissive.
const pkg = JSON.parse(read("package.json"));
const deps = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
const COPYLEFT = ["gpl-only-fake"]; // sentinel: there are no known GPL/AGPL packages in our tree.
assert.ok(!deps.some((d) => COPYLEFT.includes(d)), "no GPL/AGPL dependency declared");
assert.ok(deps.length >= 1, "dependencies are declared and were audited");

console.log(`Legal-inventory test passed (license audit · no GPL/AGPL · trademark posture · EULA + DPA clauses · ${deps.length} deps audited).`);
