// RUN 33 Phase 2 — pure parsers for the ARIA tab's data sub-sections. The renderer is sandboxed, so main.mjs
// fetches /aria-system-status + /aria-kb-stats and reads the local sessions/heartbeat files; THESE functions
// normalize the raw shapes into render-ready data (defensive — every field optional). 🔒 R11 — the Memory
// parser scrubs any filesystem path / off-limits-folder reference out of session content before it is shown.
import { redactPrivate, isBlockedPath } from "./path-guard.mjs";

// 🔒 LOCKED (RUN 33 hard-stop) — Health sub-section banner. Must never be removed or hidden.
export const ANTHROPIC_BANNER =
  "Anthropic is your last-resort safety net. ARIA tries the knowledge base first (free), then Anthropic only for novel questions, then the bundled local KB offline. This chain is locked.";

const STATUS = new Set(["green", "yellow", "red"]);
const norm = (s, fallback = "unknown") => { const v = String(s || "").toLowerCase(); return STATUS.has(v) ? v : fallback; };

/** /aria-system-status → { overall, tiers:[{name,status,cost,coverage}], lastProbe }. Always returns the 3
 *  fall-through tiers (KB-first / Anthropic / local KB), filling status from the API when present.
 *  D4 (2026-07-03) — `externalAiEnabled` reflects the DESKTOP's real posture: this MVP build ships with
 *  external AI calls disabled (state.externalAiCalls === false), so the Anthropic tier must show as OFF/disabled
 *  here rather than a green "metered · novel only" — otherwise Health contradicts the Control Center boundary
 *  and the D1 abstain behavior (no Anthropic fallback → KB abstains). */
export function parseSystemStatus(json, { externalAiEnabled = true } = {}) {
  const j = json && typeof json === "object" ? json : {};
  const byName = {};
  (Array.isArray(j.tiers) ? j.tiers : []).forEach((tr) => { if (tr && tr.name) byName[String(tr.name).toLowerCase()] = tr; });
  const tier = (key, name, cost, coverage) => {
    const t = byName[key] || byName[name.toLowerCase()] || {};
    return { name, status: norm(t.status, "unknown"), cost: t.cost != null ? String(t.cost) : cost, coverage: t.coverage != null ? String(t.coverage) : coverage };
  };
  const anthropic = externalAiEnabled
    ? tier("anthropic", "Anthropic", "metered", "novel only")
    : { name: "Anthropic", status: "off", cost: "disabled", coverage: "off in this build" }; // D4 — honest: not green
  return {
    overall: norm(j.overall, "unknown"),
    lastProbe: j.last_probe || j.lastProbe || null,
    externalAiEnabled,
    tiers: [
      tier("kb", "KB-first", "$0", "~85%"),
      anthropic,
      tier("local", "Local KB", "$0", "offline always")
    ]
  };
}

/** /aria-kb-stats → { totalChunks, generatedAt, recent:[{slug,title,tier,addedAt}], byTier, topCategories }. */
export function parseKbStats(json) {
  const j = json && typeof json === "object" ? json : {};
  const total = Number(j.total_chunks);
  const recent = (Array.isArray(j.recent_learnings) ? j.recent_learnings : []).slice(0, 20).map((r) => ({
    slug: String((r && r.slug) || ""), title: redactPrivate(String((r && r.title) || (r && r.slug) || "")),
    tier: String((r && r.tier) || "").toLowerCase(), addedAt: (r && (r.added_at || r.addedAt)) || null
  }));
  const bt = j.by_tier || {};
  return {
    totalChunks: Number.isFinite(total) ? total : null,
    generatedAt: j.kb_generated_at || null,
    recent,
    byTier: { l1: Number(bt.l1) || 0, l2: Number(bt.l2) || 0, l3: Number(bt.l3) || 0 },
    topCategories: (Array.isArray(j.top_categories) ? j.top_categories : []).slice(0, 10)
      .map((c) => ({ name: redactPrivate(String((c && c.name) || "")), count: Number(c && c.count) || 0 }))
  };
}

/** New chunks since last visit? (unread dot) — compare kb_generated_at to the stored last-seen timestamp. */
export function kbStatsUnread(generatedAt, lastSeenAt) {
  const g = Date.parse(generatedAt || ""), s = Date.parse(lastSeenAt || "");
  if (!Number.isFinite(g)) return false;
  return !Number.isFinite(s) || g > s;
}

/**
 * Local sessions → { stats:{active,total,totalAsks,kbHits,anthropicHits,diskBytes}, list:[{id,startedAt,count,turns}] }.
 * `sessions` is an array of parsed session objects (main.mjs reads ~/.aria-sentinel/sessions/*.json). 🔒 R11 —
 * every rendered string is path-scrubbed; a turn whose content references the off-limits folder is dropped.
 */
export function parseSessions(sessions, { now = Date.now() } = {}) {
  const list = (Array.isArray(sessions) ? sessions : []).filter(Boolean).map((s) => {
    const turns = (Array.isArray(s.turns) ? s.turns : [])
      .filter((tn) => tn && !isBlockedPath(JSON.stringify(tn)))           // drop any off-limits-referencing turn
      .map((tn) => ({ role: tn.role === "user" ? "user" : "assistant", text: redactPrivate(scrubPath(String(tn.text || ""))).slice(0, 800) }));
    return {
      id: redactPrivate(String(s.id || s.sessionId || "")),
      startedAt: s.started_at || s.startedAt || null,
      // D2 — count = real ask count when the session records it (2 turns/ask), else fall back to turns.length.
      count: Number(s.asks) || turns.length, turns,
      kbHits: Number(s.kb_hits) || turns.filter((tn) => /knowledge base/i.test(tn.text)).length,
      anthropicHits: Number(s.anthropic_hits) || 0
    };
  });
  const sum = (f) => list.reduce((a, x) => a + (Number(f(x)) || 0), 0);
  return {
    stats: {
      active: list.length ? 1 : 0, total: list.length,
      totalAsks: sum((x) => x.count), kbHits: sum((x) => x.kbHits), anthropicHits: sum((x) => x.anthropicHits),
      oldest: list.reduce((acc, x) => { const t = Date.parse(x.startedAt || ""); return Number.isFinite(t) && t < acc ? t : acc; }, now)
    },
    list: list.slice(0, 10)
  };
}

/** Agent heartbeats → [{name,lastTs,status,lastTask}]. Stalled = no heartbeat in >1h (red). */
export function parseHeartbeats(beats, { now = Date.now(), stalledMs = 60 * 60 * 1000 } = {}) {
  return (Array.isArray(beats) ? beats : []).filter(Boolean).map((b) => {
    const lastTs = Number(b.ts || b.lastTs || Date.parse(b.last_heartbeat || "")) || 0;
    const age = now - lastTs;
    const status = !lastTs ? "stalled" : age > stalledMs ? "stalled" : String(b.status || "").toLowerCase() === "idle" ? "idle" : "running";
    return { name: redactPrivate(String(b.name || "agent")), lastTs, status, lastTask: redactPrivate(scrubPath(String(b.last_task || b.lastTask || ""))).slice(0, 120) };
  }).sort((a, b) => (a.status === "stalled" ? -1 : 1) - (b.status === "stalled" ? -1 : 1));
}

// strip absolute paths to a placeholder (defense-in-depth alongside redactPrivate's R11 scrub).
function scrubPath(text) {
  return String(text == null ? "" : text)
    .replace(/[A-Za-z]:\\[^\s"'()]+/g, "[path]")
    .replace(/\/(?:Users|home|mnt|var|tmp|opt)\/[^\s"'()]+/gi, "[path]");
}
