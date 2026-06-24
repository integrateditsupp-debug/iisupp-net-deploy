// RUN 6 — idempotency under autonomous re-fire. When Autonomous re-detects the same signal and
// re-runs a recipe with the same execution_id (debounce miss / flapping watcher), the fix must NOT
// apply twice — the cached outcome is returned. Pairs the existing idempotency engine with the
// autonomous cap so a runaway loop is impossible.
import assert from "node:assert/strict";
import { createExecutionCache, runIdempotent } from "../src/shared/idempotency.mjs";
import { evaluateAutoFire, recordAutoFire } from "../src/shared/autonomous.mjs";

const NOW = Date.parse("2026-06-19T12:00:00.000Z");

// Same execution_id from a flapping autonomous detection applies once, then returns cached.
const cache = createExecutionCache();
let applied = 0;
const run = () => runIdempotent(cache, "auto-dns-2026-06-19-001", async () => { applied += 1; return { ok: true, recipe: "dns-fail-v1" }; });
const first = await run();
const second = await run();
const third = await run();
assert.equal(applied, 1, "autonomous re-fire with same id applies exactly once");
assert.equal(first.cached, false);
assert.equal(second.cached, true, "second autonomous fire is served from cache");
assert.equal(third.cached, true);

// Different execution ids (genuinely new incidents) each apply — but the per-recipe cap still bounds them.
let applied2 = 0;
let history = [];
let t = NOW;
let realApplies = 0;
for (let i = 0; i < 6; i++) {
  const gate = evaluateAutoFire({ recipeId: "dns-fail-v1", tier: "green", mode: "autonomous", now: t, history });
  if (gate.allow) {
    await runIdempotent(cache, `auto-dns-incident-${i}`, async () => { applied2 += 1; return { ok: true }; });
    history = recordAutoFire(history, { recipeId: "dns-fail-v1", ts: t }, t);
    realApplies += 1;
  }
  t += 31 * 60 * 1000; // past the 30-min cooldown each loop
}
assert.equal(realApplies, 3, "the cap stops a runaway autonomous loop at 3 in the window");
assert.equal(applied2, 3, "each capped fire applied exactly once");

console.log("Autonomous re-fire test passed (same id → once; new ids → bounded by the 3/24h cap).");
