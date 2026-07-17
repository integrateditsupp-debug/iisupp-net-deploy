// ARIA Forums — CONCIERGE + MODERATION sweep (scheduled).
// -----------------------------------------------------------------------------------------------
// Runs on a timer: (1) CONCIERGE — answers genuine unanswered help posts from the real KB ($0, honest
// abstain, clearly-labelled "ARIA · auto-answer", marks the thread "Answered by ARIA", queues strong
// Q&A for human curation — never auto-publishes to the KB); (2) MODERATION re-sweep — catches any post
// the post-create hook missed and applies the reversible tier action. All decisions are local + $0
// (no paid LLM). Registered via `export const config = { schedule }` (the ONLY thing that registers a
// Netlify timer — see netlify-cron-registration-fix). Fail-safe: any per-thread error is swallowed so
// one bad thread never stops the sweep.
import { getStore } from '@netlify/blobs';
import { assessThread, botPost, BOT_LABEL } from '../../assets/forums-concierge.mjs';
import { moderate, applyVerdict, auditReason } from '../../assets/forums-moderation.mjs';

const STORE = 'forums-threads';
const INDEX_KEY = 'threads-index-v1';
const CONFIG_KEY = 'forums-config-v1';
const CURATION_KEY = 'forums-curation-v1';
const MOD_AUDIT_KEY = 'mod-audit-v1';
const MOD_QUEUE_KEY = 'mod-queue-v1';
const THREAD_KEY = (id) => `thread-${id}`;
const KB_URL = 'https://iisupp.net/assets/aria-kb-chunks.json';

const readJSON = async (s, k) => { try { return await s.get(k, { type: 'json' }); } catch { return null; } };
async function appendCapped(s, key, entry, cap) {
  try { const arr = (await s.get(key, { type: 'json' })) || []; arr.unshift(entry); await s.setJSON(key, arr.slice(0, cap)); } catch { /* best-effort */ }
}

/**
 * Core sweep — pure of network (store + chunks injected) so tests can drive it with an in-memory store.
 * @param {object} store  a Blobs-like store ({ get, setJSON })
 * @param {Array}  chunks raw KB chunks
 * @param {object} [opts] { now, cfg, communityDocs, max }
 * @returns {Promise<{scanned,answered,abstained,skipped,moderated,flagged,curationQueued}>}
 */
export async function runConcierge(store, chunks, opts = {}) {
  const now = opts.now || Date.now();
  const cfg = opts.cfg || (await readJSON(store, CONFIG_KEY)) || {};
  const conciergeEnabled = cfg.conciergeEnabled !== false; // default ON (honest + abstains)
  const communityDocs = opts.communityDocs || [];
  const index = (await readJSON(store, INDEX_KEY)) || { ids: [] };
  const summary = { scanned: 0, answered: 0, abstained: 0, skipped: 0, moderated: 0, flagged: 0, curationQueued: 0 };

  for (const id of (index.ids || []).slice(0, opts.max || 200)) {
    try {
      const t = await readJSON(store, THREAD_KEY(id));
      if (!t || !Array.isArray(t.posts)) continue;
      summary.scanned++;
      let mutated = false;

      // (1) Moderation re-sweep — only posts not already moderated and not the bot's own answers.
      for (const p of t.posts) {
        if (p.moderation || p.bot) continue;
        const verdict = moderate(p.body, {});
        const applied = applyVerdict(p, verdict, cfg);
        if (applied !== 'allow') {
          mutated = true; summary.moderated++;
          await appendCapped(store, MOD_AUDIT_KEY, { at: now, threadId: t.id, postId: p.id, tier: verdict.tier, action: applied, reason: auditReason(verdict) }, 500);
          if (applied === 'flag') { summary.flagged++; await appendCapped(store, MOD_QUEUE_KEY, { at: now, threadId: t.id, postId: p.id, reason: auditReason(verdict), resolved: false }, 300); }
        }
      }

      // (2) Concierge — answer a genuine, unanswered, above-floor help post.
      if (conciergeEnabled) {
        const a = assessThread(t, chunks, { communityDocs });
        if (a.eligible && !a.abstain && a.answer) {
          t.posts.push(botPost(a.answer, now));
          t.ariaAnswered = true; t.ariaAnsweredAt = now; t.ariaArticle = a.articleSlug;
          mutated = true; summary.answered++;
          if (a.curationCandidate) {
            summary.curationQueued++;
            await appendCapped(store, CURATION_KEY, { at: now, threadId: t.id, title: t.title, articleSlug: a.articleSlug, confidence: a.confidence, reviewed: false }, 300);
          }
        } else if (a.abstain) summary.abstained++;
        else summary.skipped++;
      }

      if (mutated) await store.setJSON(THREAD_KEY(id), t);
    } catch { /* one bad thread never stops the sweep */ }
  }
  return summary;
}

async function loadChunks() {
  try {
    const r = await fetch(KB_URL, { headers: { 'user-agent': 'forums-concierge/1.0' } });
    if (!r.ok) return [];
    const d = await r.json();
    return d.chunks || (Array.isArray(d) ? d : []);
  } catch { return []; }
}

export default async () => {
  let store;
  try { store = getStore({ name: STORE, consistency: 'strong' }); }
  catch { return new Response(JSON.stringify({ ok: false, error: 'store unavailable' }), { status: 503, headers: { 'content-type': 'application/json' } }); }
  const chunks = await loadChunks();
  const summary = await runConcierge(store, chunks, {});
  return new Response(JSON.stringify({ ok: true, bot: BOT_LABEL, summary }), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
};

// The ONLY thing that registers a Netlify timer. Every 30 min — cheap ($0), well under any rate limit.
export const config = { schedule: '*/30 * * * *' };
