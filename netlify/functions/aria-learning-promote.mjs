// aria-learning-promote — daily KB hygiene + promotion job
//
// Runs every 24h. Three jobs:
//   1. Promote: learn-* bits with high recurrence (same topic asked 3+ times by different
//      agents) get a confidence bump and stay cached longer (30-day TTL instead of 7).
//   2. Dedupe: detect near-duplicate slugs (same agent, same topic, different timestamps)
//      and keep only the most recent.
//   3. Cap: if learn-* bit count exceeds MAX_BITS (5000), drop oldest by created_at.
//
// Per Ahmad ultrathink 2026-05-14: kb agent + memory agent rules — promote stable answers,
// deduplicate, cap footprint. Self-improvement layer for ARIA's brain.
//
// Cost: $0. No LLM. Pure blob ops.
// Schedule: every 24h at 03:00 UTC.

import { schedule } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

const KB_LIVE = 'aria-kb-live';
const SESSIONS = 'aria-learning-sessions';
const MAX_BITS = 5000;
const PROMOTION_THRESHOLD = 3;     // 3+ recurrences = promote
const STALE_AFTER_DAYS = 30;        // promoted bits stale after 30d
const STALE_AFTER_DAYS_DEFAULT = 7; // unpromoted stale after 7d

const handler = async () => {
  const start = Date.now();
  const kbLive = getStore({ name: KB_LIVE, consistency: 'strong' });
  const sessions = getStore({ name: SESSIONS, consistency: 'strong' });

  let promoted = 0;
  let deduped = 0;
  let dropped = 0;
  let scanned = 0;

  try {
    const list = await kbLive.list({ prefix: 'learn-' });
    const blobs = (list && list.blobs) || [];
    scanned = blobs.length;

    // Group by topic to find recurrences
    const byTopic = {};
    const fullBits = [];
    for (const b of blobs) {
      try {
        const data = await kbLive.get(b.key, { type: 'json' });
        if (!data) continue;
        const topic = (data.topic || '').toLowerCase();
        if (!topic) continue;
        if (!byTopic[topic]) byTopic[topic] = [];
        byTopic[topic].push({ key: b.key, data });
        fullBits.push({ key: b.key, data, createdAt: data.created_at });
      } catch (_) {}
    }

    // Job 1: Promote high-recurrence topics
    for (const [topic, group] of Object.entries(byTopic)) {
      if (group.length >= PROMOTION_THRESHOLD) {
        // Mark each blob as promoted
        for (const item of group) {
          if (item.data.promoted) continue;
          item.data.promoted = true;
          item.data.promoted_at = new Date().toISOString();
          item.data.promotion_count = group.length;
          try {
            await kbLive.set(item.key, JSON.stringify(item.data), { contentType: 'application/json' });
            promoted++;
          } catch (_) {}
        }
      }
    }

    // Job 2: Dedupe — same agent + topic, keep most recent only
    for (const [topic, group] of Object.entries(byTopic)) {
      if (group.length < 2) continue;
      const byAgent = {};
      for (const item of group) {
        const a = item.data.agent || 'unknown';
        if (!byAgent[a]) byAgent[a] = [];
        byAgent[a].push(item);
      }
      for (const items of Object.values(byAgent)) {
        if (items.length < 2) continue;
        items.sort((x, y) => new Date(y.data.created_at) - new Date(x.data.created_at));
        // Keep the first (most recent), delete the rest
        for (let i = 1; i < items.length; i++) {
          try {
            await kbLive.delete(items[i].key);
            deduped++;
          } catch (_) {}
        }
      }
    }

    // Job 3: Cap by oldest, respecting promoted-stays-longer rule
    const now = Date.now();
    const eligible = fullBits.filter(b => {
      if (!b.createdAt) return false;
      const age = now - new Date(b.createdAt).getTime();
      const ageDays = age / (1000 * 60 * 60 * 24);
      const limit = b.data.promoted ? STALE_AFTER_DAYS : STALE_AFTER_DAYS_DEFAULT;
      return ageDays > limit;
    });
    for (const b of eligible) {
      try {
        await kbLive.delete(b.key);
        dropped++;
      } catch (_) {}
    }

    // Hard cap: if we still have too many, drop oldest
    const remaining = scanned - dropped - deduped;
    if (remaining > MAX_BITS) {
      const survivors = fullBits
        .filter(b => !eligible.includes(b))
        .sort((x, y) => new Date(x.createdAt) - new Date(y.createdAt));
      const toCut = remaining - MAX_BITS;
      for (let i = 0; i < toCut && i < survivors.length; i++) {
        try {
          await kbLive.delete(survivors[i].key);
          dropped++;
        } catch (_) {}
      }
    }
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: String(e && e.message || e) })
    };
  }

  const elapsed = Date.now() - start;
  const summary = { ok: true, scanned, promoted, deduped, dropped, elapsedMs: elapsed, ranAt: new Date().toISOString() };

  // Log to sessions store so status endpoint can show it
  try {
    await sessions.set('promote-last.json', JSON.stringify(summary), { contentType: 'application/json' });
  } catch (_) {}

  console.log('[aria-learning-promote] daily run', JSON.stringify(summary));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(summary)
  };
};

// Daily at 03:00 UTC (low-traffic window)
export default schedule('0 3 * * *', handler);
