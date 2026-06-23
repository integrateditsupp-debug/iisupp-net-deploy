// aria-kb-stats — PUBLIC KB learning + pattern endpoint for ARIA Sentinel desktop.
// Surfaces what the brain has learned, what categories are growing, and what queries
// recently fell through (so Sentinel users see what's being added to their knowledge).
//
// No PII surfaced — only chunk-level metadata (slug, title, tier, vertical).
// Privacy guard: never echo recent USER queries — only aggregated category counts.

let CHUNKS_CACHE = null;
let CACHE_AT = 0;

async function loadChunks() {
  if (CHUNKS_CACHE && (Date.now() - CACHE_AT) < 3600 * 1000) return CHUNKS_CACHE;
  const r = await fetch("https://iisupp.net/assets/aria-kb-chunks.json", {
    headers: { "user-agent": "aria-kb-stats/1.0" },
    signal: AbortSignal.timeout(8000)
  });
  if (!r.ok) throw new Error(`KB fetch failed: ${r.status}`);
  CHUNKS_CACHE = await r.json();
  CACHE_AT = Date.now();
  return CHUNKS_CACHE;
}

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "cache-control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") return json(405, { error: "GET or POST" });

  try {
    const data = await loadChunks();
    const chunks = data.chunks || [];

    // Bucket by tier (l1/l2/l3) and vertical
    const tierCount = {};
    const verticalCount = {};
    const recent = [];

    for (const c of chunks) {
      const tier = (c.slug || "").split("-")[0] || "unknown";
      tierCount[tier] = (tierCount[tier] || 0) + 1;
      if (c.vertical) verticalCount[c.vertical] = (verticalCount[c.vertical] || 0) + 1;
      if (c.added_at) recent.push({ slug: c.slug, title: c.title, tier, vertical: c.vertical, added_at: c.added_at });
    }

    // Sort recent by added_at desc, take 20
    recent.sort((a, b) => (b.added_at || "").localeCompare(a.added_at || ""));
    const recentLearnings = recent.slice(0, 20);

    // Top growing categories (vertical with most chunks)
    const topVerticals = Object.entries(verticalCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const ageHours = data.generated_at
      ? Math.round((Date.now() - new Date(data.generated_at).getTime()) / 3600000)
      : null;

    return json(200, {
      version: "1.0",
      checked_at: new Date().toISOString(),
      kb: {
        generated_at: data.generated_at || null,
        age_hours: ageHours,
        total_chunks: chunks.length,
        cache_age_ms: Date.now() - CACHE_AT,
        source: data.source || "iisupp.net"
      },
      coverage: {
        by_tier: tierCount,
        by_vertical: verticalCount,
        top_verticals: topVerticals
      },
      recent_learnings: recentLearnings,
      notes: [
        "ARIA web learns continuously via aria-learning-cron — new chunks land in this bundle as they are vetted and promoted.",
        "Sentinel auto-syncs through aria-kb-query (1h cache + edge-served JSON), so any new chunk is searchable within 1 hour of publish.",
        "No raw user queries are exposed — only aggregated category counts."
      ]
    });
  } catch (err) {
    return json(500, { error: String(err.message || err).slice(0, 300) });
  }
}

export const config = { path: "/.netlify/functions/aria-kb-stats" };
