// idempotency — execution-id de-duplication + transactional rollback.
//
// Every recipe run carries an execution_id. Re-running the SAME id (a retry, a double
// click, a replayed bridge call) must NOT apply the fix twice — it returns the cached
// outcome. And if an action fails mid-recipe, the actions that already applied are rolled
// back in reverse so the machine is left in its prior state. Pure + injectable so it can
// be tested without Electron; main.mjs backs the cache with electron-store.

export function createExecutionCache(initial = {}) {
  const map = new Map(Object.entries(initial || {}));
  return {
    has: (id) => map.has(id),
    get: (id) => map.get(id),
    set: (id, value) => {
      map.set(id, value);
      return value;
    },
    delete: (id) => map.delete(id),
    size: () => map.size,
    toJSON: () => Object.fromEntries(map)
  };
}

/**
 * Run `fn` exactly once per executionId. Subsequent calls with the same id return the
 * cached result tagged { cached:true } and never invoke `fn` again.
 */
export async function runIdempotent(cache, executionId, fn) {
  const id = String(executionId || "");
  if (!id) {
    // No id supplied → cannot dedupe; run normally.
    const result = await fn();
    return { ...result, cached: false };
  }
  if (cache.has(id)) {
    return { ...cache.get(id), cached: true };
  }
  const result = await fn();
  cache.set(id, { ...result });
  return { ...result, cached: false };
}

/**
 * Apply a list of actions transactionally. On any failure, roll back the applied actions
 * in reverse order and report state-restored.
 * @param {Array} actions
 * @param {(action, index)=>Promise<any>} applyFn  (may throw to signal failure)
 * @param {(action, index)=>Promise<any>} rollbackFn
 */
export async function runTransactional(actions, applyFn, rollbackFn) {
  const applied = [];
  try {
    for (let i = 0; i < actions.length; i++) {
      await applyFn(actions[i], i);
      applied.push({ action: actions[i], index: i });
    }
    return { ok: true, appliedCount: applied.length, rolledBack: false };
  } catch (err) {
    // Reverse-order rollback to restore the prior state.
    for (const entry of [...applied].reverse()) {
      try {
        await rollbackFn(entry.action, entry.index);
      } catch {
        // A rollback step failing must not stop the remaining rollbacks.
      }
    }
    return { ok: false, appliedCount: 0, rolledBack: true, failedAt: applied.length, error: String(err?.message || err) };
  }
}
