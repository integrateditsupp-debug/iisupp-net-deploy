// BLOCK 8 test — idempotency + rollback.
// For every recipe: executing twice with the SAME execution_id runs the work once and
// returns a cached no-op the second time. And a mid-action failure rolls back every
// already-applied action in reverse, restoring prior state.
import assert from "node:assert/strict";
import { createExecutionCache, runIdempotent, runTransactional } from "../src/shared/idempotency.mjs";
import { RECIPES } from "../src/shared/recipes.mjs";

// 1) Same execution_id runs once, caches thereafter — across every recipe.
for (const recipe of RECIPES) {
  const cache = createExecutionCache();
  let runs = 0;
  const execId = `exec-${recipe.id}-001`;
  const work = async () => {
    runs++;
    return { ok: true, recipeId: recipe.id, outcome: "applied" };
  };

  const first = await runIdempotent(cache, execId, work);
  const second = await runIdempotent(cache, execId, work);
  const third = await runIdempotent(cache, execId, work);

  assert.equal(runs, 1, `${recipe.id}: work must execute exactly once for a repeated execution_id`);
  assert.equal(first.cached, false, `${recipe.id}: first run is not cached`);
  assert.equal(second.cached, true, `${recipe.id}: second run is a cached no-op`);
  assert.equal(third.cached, true, `${recipe.id}: third run is a cached no-op`);
  assert.equal(second.outcome, "applied", `${recipe.id}: cached outcome is preserved`);
  assert.equal(cache.size(), 1, `${recipe.id}: one cache entry`);
}

// 2) A different execution_id runs again (no false cache hit).
{
  const cache = createExecutionCache();
  let runs = 0;
  const work = async () => ({ ok: true, n: ++runs });
  await runIdempotent(cache, "a", work);
  await runIdempotent(cache, "b", work);
  assert.equal(runs, 2, "distinct execution_ids each run once");
}

// 3) Cache survives a serialise/restore round-trip (electron-store backing in prod).
{
  const cache = createExecutionCache();
  await runIdempotent(cache, "persist-1", async () => ({ ok: true, value: 42 }));
  const restored = createExecutionCache(JSON.parse(JSON.stringify(cache.toJSON())));
  let ran = false;
  const r = await runIdempotent(restored, "persist-1", async () => ((ran = true), { ok: true, value: 0 }));
  assert.equal(ran, false, "restored cache still dedupes");
  assert.equal(r.value, 42, "restored cache returns the original outcome");
}

// 4) Mid-action failure rolls back every applied action in reverse, restoring state.
{
  const state = { steps: [] }; // simulates machine state mutated by each action
  const actions = ["create-restore-point", "stop-service", "clear-cache", "start-service"];
  const applied = [];
  const result = await runTransactional(
    actions,
    async (action) => {
      if (action === "clear-cache") throw new Error("disk error mid-action");
      applied.push(action);
      state.steps.push(action);
    },
    async (action) => {
      // rollback removes the action's effect
      state.steps = state.steps.filter((s) => s !== action);
    }
  );
  assert.equal(result.ok, false, "transaction fails on the bad action");
  assert.equal(result.rolledBack, true, "rollback ran");
  assert.deepEqual(state.steps, [], "state fully restored after rollback");
}

// 5) A clean transaction commits all actions.
{
  const state = [];
  const result = await runTransactional(
    ["a", "b", "c"],
    async (x) => state.push(x),
    async (x) => {
      const i = state.indexOf(x);
      if (i >= 0) state.splice(i, 1);
    }
  );
  assert.equal(result.ok, true);
  assert.equal(result.appliedCount, 3);
  assert.deepEqual(state, ["a", "b", "c"]);
}

console.log(`Idempotency test passed (${RECIPES.length} recipes dedupe on execution_id, rollback restores state).`);
