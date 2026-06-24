// RUN 16 §H (unit) — direct unit test of the tamper-evident audit hash chain in audit-integrity.mjs,
// independent of the export-format battery: chain determinism, genesis anchoring, and that every
// class of tamper (modify · truncate · extend · reorder) is detected with the right disposition.
import assert from "node:assert/strict";
import { entryHash, sealAudit, verifyAudit, assertIsoTimestamps, entriesInWindow } from "../src/shared/audit-integrity.mjs";

const E = (i) => ({ ts: `2026-06-1${i}T08:00:00.000Z`, tag: "LOG", recipeId: "", text: `event ${i}` });
const log = [E(1), E(2), E(3), E(4)];

// Deterministic + chained (each hash depends on the prior).
const s1 = sealAudit(log);
const s2 = sealAudit(log);
assert.equal(s1.seal, s2.seal, "seal is deterministic");
assert.equal(s1.count, 4);
assert.equal(s1.chain.length, 4);
assert.notEqual(s1.chain[0], s1.chain[1], "chain advances per entry");
// The chain is genesis-anchored: a different first entry changes the whole seal.
assert.notEqual(sealAudit([E(9), E(2), E(3), E(4)]).seal, s1.seal, "first-entry change cascades");

// Intact.
assert.deepEqual({ ok: verifyAudit(log, s1).ok, t: verifyAudit(log, s1).tampered }, { ok: true, t: false });

// Modify entry 2.
const mod = log.map((e, i) => (i === 1 ? { ...e, text: "tampered" } : e));
let v = verifyAudit(mod, s1);
assert.equal(v.ok, false); assert.equal(v.brokenAt, 1); assert.equal(v.reason, "entry-modified"); assert.equal(v.alertAdmin, true);

// Truncate (drop last).
v = verifyAudit(log.slice(0, 3), s1);
assert.equal(v.ok, false); assert.equal(v.reason, "row-count-changed");

// Extend (append a forged row).
v = verifyAudit([...log, E(5)], s1);
assert.equal(v.ok, false); assert.equal(v.reason, "row-count-changed");

// Reorder.
const ro = [log[0], log[2], log[1], log[3]];
v = verifyAudit(ro, s1);
assert.equal(v.ok, false); assert.equal(v.brokenAt, 1);

// entryHash sensitivity to each hashed field.
for (const field of ["ts", "tag", "recipeId", "text"]) {
  const a = E(1); const b = { ...a, [field]: a[field] + "x" };
  assert.notEqual(entryHash("p", a), entryHash("p", b), `hash sensitive to ${field}`);
}

// Helpers.
assert.equal(assertIsoTimestamps(log), true);
assert.equal(entriesInWindow(log, "2026-06-12T00:00:00Z", "2026-06-13T23:59:59Z").length, 2);

console.log("Audit-integrity unit test passed (deterministic genesis-anchored chain · modify/truncate/extend/reorder all detected · field-sensitive hashing).");
