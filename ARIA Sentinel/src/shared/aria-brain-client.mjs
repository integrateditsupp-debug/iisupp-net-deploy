// aria-brain-client — RUN 15 §4. The desktop wraps the LIVE iisupp.net/aria brain: chat goes to the
// same /aria-chat function, with a 4-tier escalation ladder (KB → screen/event → research → ticket).
// fetch is injectable so it's unit-testable; offline degrades gracefully to local KB.
export const CHAT_ENDPOINT = "https://iisupp.net/.netlify/functions/aria-chat";
export const RESEARCH_ENDPOINT = "https://iisupp.net/.netlify/functions/aria-research";
// RUN 31 — KB-FIRST per Ahmad's rule ("do not use Anthropic unless needed"). Same retrieval engine as
// iisupp.net/aria (pure JS, 203 KB chunks, $0, no LLM). askAria hits THIS first; only a no-match/low-confidence
// result falls through to aria-chat (Anthropic). Threshold 8: live test showed 25+ for routed hits, 7–15 for
// partials — 8 accepts a decent KB match without forcing the LLM. Raise to 12 if bad matches slip through.
export const KB_QUERY_ENDPOINT = "https://iisupp.net/.netlify/functions/aria-kb-query";
export const KB_CONFIDENCE_MIN = 8;

// D1 relevance floor (2026-07-07) — a confident retrieval score alone is NOT proof the article fits the ask.
// The live sweep found "how do I fix a stuck Windows update?" returning a confident match to the AUDIO article
// (they merely shared the generic tokens "windows"/"update"). This gate keeps only the query's DISTINCTIVE
// tokens (dropping stopwords + generic platform words like "windows"/"computer") and requires at least one to
// appear in the returned article's own label (slug + title). It is CONTENT-BLIND — it reads only the query the
// user already sent and the public article label the KB returned; no article/query body, no new data leaves the
// device. Fail-open: no distinctive token, or no slug/title to judge → accept (never block a match with no basis
// to reject). When it DOES reject, askAria falls through honestly (→ aria-chat if reachable, else the local KB).
const KB_GENERIC_TOKENS = new Set([
  "the","and","for","with","that","this","have","has","are","was","were","not","cant","cannot","wont","you",
  "your","our","will","would","should","could","please","help","need","when","then","from","into","just","how",
  "why","who","get","got","now","its","did","does","done","fix","fixing","issue","issues","problem","problems",
  "error","errors","work","working","broken","some","any","all","what",
  // generic platform / device words — too coarse to establish topical relevance on their own
  "windows","window","win","win10","win11","microsoft","pc","computer","laptop","desktop","machine","system",
  "mac","macos","device","phone","tablet"
]);

function kbTokens(text) {
  return String(text == null ? "" : text).toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

/** True unless the returned KB article is clearly off-topic for the query (content-blind — slug/title only). */
export function isRelevantKbMatch(query, article = {}) {
  const distinctive = kbTokens(query).filter((t) => !KB_GENERIC_TOKENS.has(t));
  if (!distinctive.length) return true;                          // nothing distinctive to match on → can't reject
  const label = `${article.slug || ""} ${article.title || ""}`
    .replace(/\bl[0-9]\b/gi, " ")                                // drop id scaffolding (l1/l2/l3)
    .replace(/\b\d{2,}\b/g, " ");                                // …and the numeric slug index (005)
  const labelTokens = new Set(kbTokens(label));
  if (!labelTokens.size) return true;                           // no label to judge → accept on confidence alone
  return distinctive.some((t) => labelTokens.has(t));
}

// The escalation ladder Ahmad specified.
export const ESCALATION_TIERS = ["kb", "screen-and-event", "research", "ticket"];
export function nextEscalationTier(current) {
  const i = ESCALATION_TIERS.indexOf(current);
  return i === -1 ? ESCALATION_TIERS[0] : (ESCALATION_TIERS[i + 1] || null);
}

// RUN 30-A — the EXACT request aria-chat.js expects: a `messages` array (chat-style, server keeps session
// context by sessionId) — NOT a `prompt` string. platform/tier/source/version are carried so the brain can
// answer for the user's real OS (Windows/macOS/iOS/iPadOS/Android/Linux), not Windows-only. Headers keep
// device/license. Sending the wrong shape here is what made every desktop Ask-ARIA call 400 → canned string.
export function buildChatRequest(prompt, ctx = {}) {
  const platform = ctx.platform || (typeof process !== "undefined" && process.platform) || "";
  return {
    url: CHAT_ENDPOINT,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sentinel-Device": String(ctx.deviceId || ""),
      "X-Sentinel-License": String(ctx.licenseKey || "")
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: String(prompt || "") }],
      sessionId: ctx.sessionId || null,
      source: "sentinel-desktop",
      platform,
      tier: String(ctx.tier || ""),
      version: String(ctx.version || "")
    })
  };
}

/**
 * Ask the live ARIA brain. Returns { reply, session_id, action, offline }.
 * aria-chat.js replies with { text, sessionId, escalate, resolved, … } — we map `text`→reply. A non-OK
 * response (400/500/502) OR an empty reply degrades to offline so the caller serves the local KB instead.
 * Never throws — any network/parse failure → graceful offline fallback.
 */
export async function askAria(prompt, ctx = {}) {
  const fetchImpl = ctx.fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
  if (!fetchImpl) return offline();
  const platform = ctx.platform || (typeof process !== "undefined" && process.platform) || "";

  // RUN 31 — KB-FIRST: try the $0 pure-retrieval endpoint before any LLM call. A confident match returns
  // here (action "kb-match"); anything else (no match / low confidence / network error / 5s timeout) falls
  // through to the UNCHANGED aria-chat path below. 🔒 R11 — the KB reply is path-scrubbed before it returns.
  try {
    const kbRes = await fetchImpl(KB_QUERY_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: String(prompt || "").slice(0, 2000), platform }),
      signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined
    });
    if (kbRes && kbRes.ok) {
      const kb = (typeof kbRes.json === "function" ? await kbRes.json() : kbRes) || {};
      const art = kb.article || {};
      // D1 — a confident score must ALSO be topically relevant; otherwise fall through (never fabricate a match).
      if (kb.match && Number(kb.confidence) >= KB_CONFIDENCE_MIN && kb.content_excerpt && isRelevantKbMatch(prompt, art)) {
        return {
          reply: scrubR11(`${kb.content_excerpt}${art.url ? `\n\n→ Full article: ${art.url}` : ""}`),
          session_id: null,
          action: "kb-match",
          offline: false,
          kb_match: { slug: art.slug || null, title: art.title || null, tier: art.tier || null, confidence: Number(kb.confidence) },
          kb_meta: normalizeKbMeta(kb.meta) // RUN 33-A — KB freshness (generated_at, total_chunks) for the top bar
        };
      }
    }
  } catch { /* network/timeout/error → fall through to aria-chat (Anthropic) below, unchanged */ }

  const req = buildChatRequest(prompt, ctx);
  try {
    const res = await fetchImpl(req.url, { method: req.method, headers: req.headers, body: req.body });
    if (res && res.ok === false) return offline();           // HTTP error → fall back to local KB
    const data = (res && typeof res.json === "function" ? await res.json() : res) || {};
    const reply = String(data.text || data.reply || "");      // aria-chat returns `text`
    if (!reply) return offline();                             // empty brain reply → local KB
    const action = data.escalate ? "escalate" : (data.resolved ? "resolved" : (data.action || null));
    return { reply, session_id: data.sessionId || data.session_id || ctx.sessionId || null, action, offline: false };
  } catch {
    return offline();
  }
}

// 🔒 R11 — strip the private folder + any absolute path from a KB reply before it reaches the desktop UI.
function scrubR11(text) {
  return String(text == null ? "" : text)
    .replace(/([a-z]:\\)?[^\r\n"<>|]*?private\s+pics\s+and\s+vids[^\r\n"<>|]*/gi, "<private-folder>")
    .replace(/[A-Za-z]:\\[^\s"'()]+/g, "[path]")
    .replace(/\/(?:Users|home|mnt|var|tmp|opt)\/[^\s"'()]+/gi, "[path]");
}

// Offline copy is intentionally PLATFORM-NEUTRAL — ARIA is full cross-platform support, never "Windows-only".
function offline() {
  return { reply: "I can't reach the ARIA brain right now — I'll answer from the local knowledge base instead.", session_id: null, action: "local-kb-only", offline: true };
}

// RUN 33-A — KB freshness from the aria-kb-query `meta` block. Pure: keeps only the two numbers/timestamp we
// surface, never anything content-bearing.
export function normalizeKbMeta(meta) {
  if (!meta || typeof meta !== "object") return null;
  const total = Number(meta.total_chunks);
  return {
    kb_generated_at: meta.kb_generated_at || null,
    total_chunks: Number.isFinite(total) ? total : null
  };
}

/** "KB v203 · synced 3h ago" — the top-bar freshness chip. now is injectable for tests. */
export function formatKbFreshness(meta, nowMs = Date.now()) {
  const m = normalizeKbMeta(meta);
  if (!m || (!m.total_chunks && !m.kb_generated_at)) return "";
  const v = m.total_chunks != null ? `KB v${m.total_chunks}` : "KB";
  const gen = m.kb_generated_at ? Date.parse(m.kb_generated_at) : NaN;
  if (!Number.isFinite(gen)) return v;
  const ageMs = Math.max(0, nowMs - gen);
  const mins = Math.floor(ageMs / 60000), hrs = Math.floor(mins / 60), days = Math.floor(hrs / 24);
  const ago = days >= 1 ? `${days}d ago` : hrs >= 1 ? `${hrs}h ago` : mins >= 1 ? `${mins}m ago` : "just now";
  return `${v} · synced ${ago}`;
}

// The unsolved-issue escalation copy (ticket tier).
export function escalationCta() {
  return "I've opened a ticket. For faster help, call 647-581-3182 or email ahmad.wasee@iisupp.net.";
}
