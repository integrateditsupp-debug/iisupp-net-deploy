// aria-system-status — PUBLIC observability endpoint for ARIA Sentinel desktop.
// No auth (Sentinel .exe can't carry server secrets). Surfaces non-sensitive metrics
// that prove the brain is alive: KB freshness, chunk count, recent learning cadence,
// aria-chat reachability, and the fall-through chain status.
//
// Sentinel polls this every 30s to feed the Core / Learning tabs.

const STATUS_VERSION = "1.0";

async function probeKbQuery() {
  try {
    const t0 = Date.now();
    const r = await fetch("https://iisupp.net/.netlify/functions/aria-kb-query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "ping system status check" }),
      signal: AbortSignal.timeout(3000)
    });
    const ms = Date.now() - t0;
    const data = await r.json();
    return {
      ok: r.ok,
      latency_ms: ms,
      kb_generated_at: data.meta?.kb_generated_at || null,
      total_chunks: data.meta?.total_chunks || 0
    };
  } catch (err) {
    return { ok: false, error: String(err.message || err).slice(0, 200) };
  }
}

async function probeAriaChat() {
  // HEAD-style ping — we send a minimal payload and just verify the endpoint responds.
  // A 4xx is still "up" (function exists). 5xx or timeout = down.
  try {
    const t0 = Date.now();
    const r = await fetch("https://iisupp.net/.netlify/functions/aria-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "ping", _probe: true }),
      signal: AbortSignal.timeout(4000)
    });
    return {
      ok: r.status < 500,
      status: r.status,
      latency_ms: Date.now() - t0,
      mode: "last-resort-fallback"
    };
  } catch (err) {
    return { ok: false, error: String(err.message || err).slice(0, 200) };
  }
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

  const [kb, chat] = await Promise.all([probeKbQuery(), probeAriaChat()]);

  // Compose overall health — green if KB is up, yellow if KB up but chat down (still 85% queries answered),
  // red if KB is down (Sentinel falls back to local-KB bundle).
  let overall = "green";
  if (!kb.ok) overall = "red";
  else if (!chat.ok) overall = "yellow";

  const ageHours = kb.kb_generated_at
    ? Math.round((Date.now() - new Date(kb.kb_generated_at).getTime()) / 3600000)
    : null;

  return json(200, {
    version: STATUS_VERSION,
    checked_at: new Date().toISOString(),
    overall,
    brain: {
      kb_query: { ...kb, kb_age_hours: ageHours },
      aria_chat: chat
    },
    fall_through_chain: [
      { tier: 1, name: "KB-first (aria-kb-query)", cost: "$0", coverage: "~85% of queries", status: kb.ok ? "up" : "down" },
      { tier: 2, name: "Anthropic (aria-chat)", cost: "metered", coverage: "novel/vague queries", status: chat.ok ? "up" : "down", note: "Last-resort fallback — never removed" },
      { tier: 3, name: "Local KB bundle (offline)", cost: "$0", coverage: "always works", status: "always-up", note: "Ships inside .exe via electron-builder extraResources" }
    ]
  });
}

export const config = { path: "/.netlify/functions/aria-system-status" };
