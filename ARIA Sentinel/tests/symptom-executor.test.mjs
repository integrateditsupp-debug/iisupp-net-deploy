// F1 (2026-07-02) — "Resolve it for me" binding. Proves the matched-symptom → vetted-executor map actually
// resolves end-to-end: every mapped id (a) resolves to a live Tier-0 executor binding (resolveExecutorId),
// (b) is in the supervisor's SIGNED catalog (TIER0_RECIPES) so runSupervisedFix never vetoes it with
// "(none) is not in the signed catalog", and (c) has authored walk steps so "Walk me through it" works too.
// This is the exact guard against the catalog-id vs executor-alias gotcha that caused the printer resolve to hang.
import assert from "node:assert/strict";
import { SYMPTOM_EXECUTOR, executorForSymptom } from "../src/shared/symptom-executor.mjs";
import { resolveExecutorId } from "../src/main/tier-0-executor.mjs";
import { walkStepsFor } from "../src/shared/walkthrough-steps.mjs";
import { TIER0_RECIPES } from "../src/main/recipes/tier-0/index.mjs";

// 1 — the explicit printer case Ahmad named, plus the other safe first-line fixes.
assert.equal(executorForSymptom("printer-issues"), "restart-print-spooler", "printer → restart-print-spooler");
assert.equal(executorForSymptom("audio-issues"), "restart-audio-service", "audio → restart-audio-service");
assert.equal(executorForSymptom("no-internet"), "flush-dns", "no-internet → flush-dns");

// 2 — unknown / unbound symptoms return "" (caller degrades honestly to the walk-through, never a held resolve).
assert.equal(executorForSymptom("bluetooth-wifi"), "", "ambiguous bluetooth/wifi is intentionally UNBOUND");
assert.equal(executorForSymptom("display-issues"), "", "no safe one-click display fix → unbound");
assert.equal(executorForSymptom("slow-performance"), "", "slow-performance → unbound");
assert.equal(executorForSymptom("does-not-exist"), "", "unknown symptom → empty");
assert.equal(executorForSymptom(""), "", "empty input → empty");

// 3 — END-TO-END: every mapped executor id is actually runnable AND vetted AND guided (no dangling binding).
const signed = new Set(TIER0_RECIPES.map((r) => r.id));
for (const [symptom, id] of Object.entries(SYMPTOM_EXECUTOR)) {
  assert.ok(resolveExecutorId(id), `${symptom}: "${id}" resolves to a live Tier-0 executor binding`);
  assert.ok(signed.has(id), `${symptom}: "${id}" is in the supervisor's signed catalog (no UNVETTED veto)`);
  assert.ok(walkStepsFor(id).length > 0, `${symptom}: "${id}" has authored walk steps (Walk-me-through works)`);
}

console.log(`symptom-executor test passed (${Object.keys(SYMPTOM_EXECUTOR).length} bound symptoms · each resolves + signed + guided · unbound stays honest).`);
