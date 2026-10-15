// tests/lib/axis-memory-store.mjs — an in-memory stand-in for @netlify/blobs getStore() (RUN-AX3).
//
// Not a suite (no .test.mjs): the AXIS task suites import it. Shape-compatible with what the functions call:
//   getStore('name') · getStore({ name, consistency }) → { get(key, {type:'json'}), set, setJSON, delete, list({prefix}) }
// Values are stored as JSON text, so a test can never pass because it shared an object with the code under test.
// `down(name)` makes a store throw on every call — the "store did not answer" path (Rule 14: unavailable, not empty).
// `writes` records every write in order, for asserting that a refused action wrote NOTHING.
export function createMemoryBlobs(seed = {}) {
  const maps = new Map();
  const downed = new Set();
  const writes = [];
  const mapOf = (name) => { if (!maps.has(name)) maps.set(name, new Map()); return maps.get(name); };
  const guard = (name) => { if (downed.has(name)) { const e = new Error(`store ${name} is down (test)`); e.name = 'BlobsInternalError'; throw e; } };
  function getStore(arg) {
    const name = typeof arg === 'string' ? arg : arg && arg.name;
    if (!name) throw new Error('getStore: name required');
    const m = mapOf(name);
    return {
      name,
      async get(key, opts) { guard(name); const v = m.get(key); if (v === undefined) return null; return opts && opts.type === 'json' ? JSON.parse(v) : v; },
      async set(key, value) { guard(name); m.set(key, String(value)); writes.push({ store: name, key }); return { modified: true }; },
      async setJSON(key, value) { guard(name); m.set(key, JSON.stringify(value)); writes.push({ store: name, key }); return { modified: true }; },
      async delete(key) { guard(name); m.delete(key); writes.push({ store: name, key, deleted: true }); },
      async list(opts = {}) { guard(name); const p = opts.prefix || ''; return { blobs: [...m.keys()].filter((k) => k.startsWith(p)).sort().map((key) => ({ key })) }; },
    };
  }
  const api = {
    getStore,
    writes,
    /** Seed a JSON value without recording a write. */
    put(name, key, value) { mapOf(name).set(key, JSON.stringify(value)); return api; },
    /** Read a JSON value directly (null when absent). */
    read(name, key) { const v = mapOf(name).get(key); return v === undefined ? null : JSON.parse(v); },
    keys(name, prefix = '') { return [...mapOf(name).keys()].filter((k) => k.startsWith(prefix)).sort(); },
    down(name) { downed.add(name); return api; },
    up(name) { downed.delete(name); return api; },
    reset() { maps.clear(); downed.clear(); writes.length = 0; return api; },
  };
  for (const [name, kv] of Object.entries(seed)) for (const [k, v] of Object.entries(kv)) api.put(name, k, v);
  return api;
}

/** A board snapshot envelope the way the worker pushes it ({ module, version, generatedAt, data }). */
export const envelope = (module, data, generatedAt = '2026-10-15T12:00:00.000Z') => ({ module, version: 1, generatedAt, data });
