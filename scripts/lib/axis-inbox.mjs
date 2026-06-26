// AXIS approve-hop — the worker reads the axis-inbox each tick and acts on approved items BEHIND THE RAILS.
// The AXIS Command Center (axis-director.js) writes commands/approvals to the Netlify Blobs "axis-inbox"
// store; the local worker pulls them, executes the rail-safe ones (queues the agent work), and HOLDS anything
// irreversible/anomalous for Ahmad. Nothing fires outside the rails. (vision-flaw-audit-2026-06-26, fix #2.)

// Pure decision function — NO side effects, fully testable.
// item: { id, action:'command'|'approval', agent, intent, decision?, needsApproval? }
// Returns { execute, hold, consumed } — `execute` runs behind the rails NOW; `hold` waits for Ahmad.
export function processAxisInbox(items, opts = {}) {
  const execute = [], hold = [];
  for (const it of Array.isArray(items) ? items : []) {
    if (!it || !it.id) continue;
    // Rejections + anything explicitly flagged irreversible/needs-approval never auto-fire.
    const irreversible = it.needsApproval === true || it.decision === 'reject';
    // Rail check: an approval must be an explicit "approve"; a command must carry a concrete intent.
    const railSafe = !irreversible && (it.action === 'approval'
      ? it.decision === 'approve'
      : it.action === 'command' ? Boolean(it.intent) : false);
    (railSafe ? execute : hold).push(it);
  }
  return { execute, hold, consumed: execute.map((i) => i.id) };
}

// Open the Blobs store. On the LOCAL worker this needs NETLIFY_SITE_ID + a token; returns null when not
// configured so the worker degrades gracefully (no crash, just nothing to pull this tick).
export async function openAxisInbox(env = process.env) {
  try {
    const { getStore } = await import('@netlify/blobs');
    const siteID = env.NETLIFY_SITE_ID || env.SITE_ID;
    const token = env.NETLIFY_API_TOKEN || env.NETLIFY_AUTH_TOKEN || env.NETLIFY_BLOBS_TOKEN;
    if (siteID && token) return getStore({ name: 'axis-inbox', siteID, token, consistency: 'strong' });
    return getStore('axis-inbox'); // works when running inside Netlify; throws locally → caught below
  } catch {
    return null;
  }
}

// Read pending entries (keys under "pending/"). Graceful: [] when the store is unavailable.
export async function readAxisInbox(store) {
  if (!store) return [];
  try {
    const list = await store.list({ prefix: 'pending/' });
    const items = [];
    for (const b of (list.blobs || [])) {
      const v = await store.get(b.key, { type: 'json' }).catch(() => null);
      if (v) items.push(Object.assign({ _key: b.key }, v));
    }
    return items;
  } catch {
    return [];
  }
}

// Mark processed items consumed (move out of pending/). Best-effort.
export async function consumeAxisInbox(store, items) {
  if (!store) return 0;
  let n = 0;
  for (const it of items || []) {
    if (!it || !it._key) continue;
    try { await store.delete(it._key); n++; } catch {}
  }
  return n;
}
