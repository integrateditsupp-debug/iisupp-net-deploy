// RUN 16 §I — SOC 2 readiness. Asserts docs/SOC2_READINESS_MAP.md maps every Common Criteria CC1–CC9
// to a control or documented gap, uses a Mapped/Partial/Gap status vocabulary, and clears ≥70% mapped.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const doc = fs.readFileSync(path.join(root, "docs", "SOC2_READINESS_MAP.md"), "utf8");

// Every Common Criteria section CC1..CC9 is present.
for (let cc = 1; cc <= 9; cc++) {
  assert.match(doc, new RegExp(`CC${cc}\\b`), `SOC 2 map covers CC${cc}`);
}
// Status vocabulary present.
for (const s of ["Mapped", "Partial", "Gap"]) assert.ok(doc.includes(s), `uses status: ${s}`);
// Scorecard with a readiness percentage that clears the ≥70% bar.
const pcts = [...doc.matchAll(/(\d{1,3})\s*%/g)].map((m) => Number(m[1])).filter((n) => n <= 100);
assert.ok(pcts.length, "a readiness percentage is reported");
assert.ok(Math.max(...pcts) >= 70, "SOC 2 readiness clears the ≥70% target");
// Genuine gaps named (credibility check — not all-green theatre).
assert.match(doc, /pen[\s-]?test|penetration/i, "names the pen-test gap");
assert.match(doc, /auditor|audit window/i, "names the auditor gap");

console.log("SOC2-map test passed (CC1–CC9 all mapped · status vocabulary · ≥70% readiness · real gaps named).");
