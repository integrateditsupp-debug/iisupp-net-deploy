/**
 * forums-admin — admin-token-gated console backend for the ARIA Forums concierge + moderator.
 *  POST { event:'list', admin_token }
 *    -> { ok, config, queue[], audit[], curation[], activity[] }  (moderation queue + concierge activity)
 *  POST { event:'set_config', admin_token, config:{conciergeEnabled?,tier1?,tier2?,tier3?} }
 *    -> persists the on/off toggles (concierge + each moderation tier)
 *  POST { event:'moderate', admin_token, action:'restore'|'remove'|'resolve', threadId?, postId?, queueAt? }
 *    -> reversible moderation actions (restore a soft-removed post, remove a post, resolve a flag)
 *  POST { event:'run_concierge', admin_token }
 *    -> runs one concierge+moderation sweep now (same core as the cron)
 *
 * Backs /forums-admin.html. Everything reversible + audited; NEVER hard-deletes. $0 (no paid API).
 * Cat 10 — Reporting / moderation. Auth mirrors aria-leads-inbox (APERTURE_ADMIN_PASSWORD).
 */
const STORE = 'forums-threads';
const INDEX_KEY = 'threads-index-v1';
const CONFIG_KEY = 'forums-config-v1';
const CURATION_KEY = 'forums-curation-v1';
const MOD_AUDIT_KEY = 'mod-audit-v1';
const MOD_QUEUE_KEY = 'mod-queue-v1';
const THREAD_KEY = (id) => `thread-${id}`;

let _blobs = null;
async function getStore() {
  if (_blobs !== null) return _blobs;
  try { const { getStore } = require('@netlify/blobs'); _blobs = getStore({ name: STORE, consistency: 'strong' }); }
  catch { _blobs = false; }
  return _blobs;
}
function isAdmin(token) {
  const expected = process.env.APERTURE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  return !!expected && token === expected;
}
const readJSON = async (s, k) => { try { return await s.get(k, { type: 'json' }); } catch { return null; } };
async function appendCapped(s, key, entry, cap) {
  try { const arr = (await s.get(key, { type: 'json' })) || []; arr.unshift(entry); await s.setJSON(key, arr.slice(0, cap)); } catch { /* best-effort */ }
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }
  if (!isAdmin(body.admin_token)) return { statusCode: 401, headers, body: JSON.stringify({ error: 'admin token required' }) };

  const s = await getStore();
  if (!s) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, config: {}, queue: [], audit: [], curation: [], activity: [], note: 'Netlify Blobs not available — nothing persisted yet' }) };
  const now = Date.now();
  const ev = String(body.event || 'list').trim();

  try {
    if (ev === 'list') {
      const config = (await readJSON(s, CONFIG_KEY)) || { conciergeEnabled: true, tier1: true, tier2: true, tier3: true };
      const queue = ((await readJSON(s, MOD_QUEUE_KEY)) || []).slice(0, 100);
      const audit = ((await readJSON(s, MOD_AUDIT_KEY)) || []).slice(0, 100);
      const curation = ((await readJSON(s, CURATION_KEY)) || []).slice(0, 100);
      // concierge activity — threads ARIA has answered (title + article + when)
      const index = (await readJSON(s, INDEX_KEY)) || { ids: [] };
      const activity = [];
      for (const id of (index.ids || []).slice(0, 200)) {
        const t = await readJSON(s, THREAD_KEY(id));
        if (t && t.ariaAnswered) activity.push({ threadId: t.id, title: t.title, articleSlug: t.ariaArticle || '', at: t.ariaAnsweredAt || 0 });
        if (activity.length >= 100) break;
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, config, queue, audit, curation, activity }) };
    }

    if (ev === 'set_config') {
      const cur = (await readJSON(s, CONFIG_KEY)) || {};
      const patch = body.config || {};
      const next = { ...cur };
      for (const k of ['conciergeEnabled', 'tier1', 'tier2', 'tier3']) if (k in patch) next[k] = !!patch[k];
      await s.setJSON(CONFIG_KEY, next);
      await appendCapped(s, MOD_AUDIT_KEY, { at: now, action: 'config', reason: `set_config ${JSON.stringify(next)}` }, 500);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, config: next }) };
    }

    if (ev === 'moderate') {
      const action = String(body.action || '');
      if (action === 'resolve') {
        const q = (await readJSON(s, MOD_QUEUE_KEY)) || [];
        const at = Number(body.queueAt || 0);
        let changed = false;
        for (const it of q) if (it.at === at && it.postId === body.postId) { it.resolved = true; changed = true; }
        if (changed) await s.setJSON(MOD_QUEUE_KEY, q);
        await appendCapped(s, MOD_AUDIT_KEY, { at: now, threadId: body.threadId || '', postId: body.postId || '', action: 'resolve', reason: 'flag resolved by admin' }, 500);
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, resolved: changed }) };
      }
      // restore | remove — mutate the stored post (reversible either way)
      const t = await readJSON(s, THREAD_KEY(String(body.threadId || '')));
      if (!t) return { statusCode: 404, headers, body: JSON.stringify({ ok: false, error: 'thread not found' }) };
      const p = (t.posts || []).find((x) => x.id === body.postId);
      if (!p) return { statusCode: 404, headers, body: JSON.stringify({ ok: false, error: 'post not found' }) };
      if (action === 'restore') { p.removed = false; p.removedReason = ''; p.flagged = false; p.moderation = { tier: 0, action: 'restore', at: now }; }
      else if (action === 'remove') { p.removed = true; p.removedReason = 'Removed by an IIS moderator.'; p.moderation = { tier: 1, action: 'soft_remove', at: now }; }
      else return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'unknown action' }) };
      await s.setJSON(THREAD_KEY(t.id), t);
      await appendCapped(s, MOD_AUDIT_KEY, { at: now, threadId: t.id, postId: p.id, action, reason: `admin ${action}` }, 500);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, action, postId: p.id }) };
    }

    if (ev === 'run_concierge') {
      const mod = await import('./forums-concierge-cron.mjs');
      const kb = await (async () => { try { const r = await fetch('https://iisupp.net/assets/aria-kb-chunks.json'); const d = await r.json(); return d.chunks || []; } catch { return []; } })();
      const summary = await mod.runConcierge(s, kb, {});
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, summary }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown event' }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'store error — retry' }) };
  }
};
