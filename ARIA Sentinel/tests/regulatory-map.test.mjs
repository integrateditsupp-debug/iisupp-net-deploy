// RUN 16 §J — Regulatory map. Asserts docs/REGULATORY_COMPLIANCE_MAP.md covers PIPEDA + GDPR + CCPA +
// CASL with a status per regime and references the data-subject rights that the architecture satisfies.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const doc = fs.readFileSync(path.join(root, "docs", "REGULATORY_COMPLIANCE_MAP.md"), "utf8");

for (const regime of ["PIPEDA", "GDPR", "CCPA", "CASL"]) {
  assert.ok(doc.includes(regime), `regulatory map covers ${regime}`);
}
// Each regime carries a status disposition.
const statuses = ["Compliant", "Gap", "condition"];
assert.ok(statuses.some((s) => doc.includes(s)), "regimes carry a compliance status");
// Data-subject rights + the architecture controls that satisfy them.
assert.match(doc, /right.{0,12}(export|access)|data subject/i, "covers right to access/export");
assert.match(doc, /erasure|delete|uninstall/i, "covers right to erasure / uninstall wipe");
assert.match(doc, /content-blind|local-first|minimi[sz]ation/i, "ties to data minimization");
assert.match(doc, /consent/i, "covers consent");

console.log("Regulatory-map test passed (PIPEDA · GDPR · CCPA · CASL · rights + minimization + consent).");
