// kb-recycler — continuous KB lifecycle engine (pure + injectable; node built-ins only).
//
// Each cycle re-validates a ROLLING BATCH of KB articles (so the whole library is swept over time
// without re-reading all 100+ every run) and decides, per article:
//   KEEP    — structurally valid, current, not superseded.
//   REVIEW  — works but is stale/uncertain (e.g. last_updated very old, metadata drift, a linked
//             recipe regressed in a logic dry-run). Stays in routing; flagged for a human. Stale ≠ dead.
//   RECYCLE — broken or obsolete (file missing/empty, no id, explicitly marked obsolete/deprecated/
//             superseded). Pulled from routing → soft-deleted to a recycle bin WITH a reason →
//             retained 4 months → hard-deleted on a later cycle.
//
// SAFETY: validation is READ-ONLY. On a live machine we never apply a destructive fix just to test an
// article — a linked recipe is only ever LOGIC/dry-run validated (Stage 7 in dry-run), never executed.
// Soft-delete is a reversible MOVE to a bin with a tombstone; nothing is hard-deleted before retention.
//
// TAMPER-EVIDENCE: every decision (keep/review/recycle/hard-delete) is one append-only log entry, and
// the log is sealed with a sha256 hash chain (same construction as the app's audit-integrity). A
// hard-delete is itself a logged entry — there are no silent deletes.

import crypto from "node:crypto";

export const RETENTION_DAYS = 122;           // ~4 months
export const STALE_REVIEW_DAYS = 365;        // older than a year with no update → REVIEW (not recycle)
const DAY_MS = 86400000;
const GENESIS = "kb-recycle-genesis-v1";

// ── Frontmatter ───────────────────────────────────────────────────────────────────────────────
// The KB uses simple `key: value` / `key:` + `- item` YAML frontmatter. A minimal, dependency-free
// parser is enough for the fields the recycler reads (id, last_updated, status/deprecated/superseded_by).
export function parseFrontmatter(text) {
  const s = String(text || "");
  const m = s.match(/^\s*---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: s, hasFrontmatter: false };
  const data = {};
  let lastKey = null;
  for (const rawLine of m[1].split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim()) continue;
    const listItem = line.match(/^\s+-\s+(.*)$/);
    if (listItem && lastKey) {
      (Array.isArray(data[lastKey]) ? data[lastKey] : (data[lastKey] = [])).push(unquote(listItem[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (kv) {
      lastKey = kv[1];
      data[lastKey] = kv[2] === "" ? [] : unquote(kv[2]);
    }
  }
  return { data, body: m[2], hasFrontmatter: true };
}
function unquote(v) {
  const t = String(v).trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

// ── Per-article validation (READ-ONLY) ──────────────────────────────────────────────────────────
/**
 * @param {object} article  manifest entry { id, path, last_updated? }
 * @param {object} ctx
 *   loader(path)       → { exists:boolean, content:string }   (injected fs read; read-only)
 *   now()              → epoch ms
 *   recipeDryRun(id)?  → { wouldApply:boolean }                (Stage 7 logic dry-run; never executes)
 * @returns {{ id, path, status:"keep"|"review"|"recycle", reasons:string[] }}
 */
export function validateArticle(article, ctx = {}) {
  const id = String((article && article.id) || "");
  const p = String((article && article.path) || "");
  const reasons = [];
  const loader = typeof ctx.loader === "function" ? ctx.loader : () => ({ exists: false, content: "" });
  const now = typeof ctx.now === "function" ? ctx.now : () => Date.now();

  const file = loader(p) || { exists: false, content: "" };
  if (!file.exists) return { id, path: p, status: "recycle", reasons: ["file-missing"] };

  const { data, body, hasFrontmatter } = parseFrontmatter(file.content);
  if (!hasFrontmatter || !data.id) return { id, path: p, status: "recycle", reasons: ["malformed-no-frontmatter-id"] };
  if (String(body || "").trim().length < 120) return { id, path: p, status: "recycle", reasons: ["empty-or-truncated-body"] };

  // Explicitly obsolete → recycle.
  const status = String(data.status || "").toLowerCase();
  if (status === "obsolete" || status === "deprecated" || String(data.deprecated || "").toLowerCase() === "true") {
    return { id, path: p, status: "recycle", reasons: [`marked-${status || "deprecated"}`] };
  }
  if (data.superseded_by) return { id, path: p, status: "recycle", reasons: [`superseded-by-${data.superseded_by}`] };

  // From here the article KEEPS, but may be flagged for REVIEW (kept in routing, surfaced to a human).
  if (data.id && id && String(data.id) !== id) reasons.push("id-drift-vs-manifest");

  const lu = Date.parse(data.last_updated || article.last_updated || "");
  if (Number.isFinite(lu) && (now() - lu) > STALE_REVIEW_DAYS * DAY_MS) reasons.push("stale>1y");

  // A linked recipe is only LOGIC/dry-run validated — never executed on the real machine.
  if (article.recipeId && typeof ctx.recipeDryRun === "function") {
    let dr; try { dr = ctx.recipeDryRun(article.recipeId); } catch { dr = { wouldApply: false }; }
    if (dr && dr.wouldApply === false) reasons.push(`linked-recipe-regressed:${article.recipeId}`);
  }

  return { id, path: p, status: reasons.length ? "review" : "keep", reasons };
}

// ── Rolling batch ───────────────────────────────────────────────────────────────────────────────
export function selectBatch(ids, cursor = 0, size = 12) {
  const list = Array.isArray(ids) ? ids : [];
  if (!list.length) return { batch: [], next: 0 };
  const start = ((Number(cursor) || 0) % list.length + list.length) % list.length;
  const batch = [];
  for (let i = 0; i < Math.min(size, list.length); i++) batch.push(list[(start + i) % list.length]);
  return { batch, next: (start + batch.length) % list.length };
}

// ── Cycle decision (pure) ───────────────────────────────────────────────────────────────────────
/**
 * Decide one cycle. Validates the next rolling batch and computes which recycle-bin tombstones have
 * passed retention and are due for hard-delete. Performs NO I/O — returns a plan for applyPlan().
 * @returns {{ cursorNext, batchIds, keeps, reviews, recycles, hardDeletes, summary }}
 */
export function decideCycle({ articles, cursor = 0, batchSize = 12, loader, now = () => Date.now(), recycleBin = [], retentionDays = RETENTION_DAYS, recipeDryRun } = {}) {
  const list = Array.isArray(articles) ? articles : [];
  const byId = new Map(list.map((a) => [String(a.id), a]));
  const ids = list.map((a) => String(a.id));
  const { batch, next } = selectBatch(ids, cursor, batchSize);

  const keeps = [], reviews = [], recycles = [];
  for (const id of batch) {
    const v = validateArticle(byId.get(id) || { id }, { loader, now, recipeDryRun });
    if (v.status === "recycle") recycles.push(v);
    else if (v.status === "review") reviews.push(v);
    else keeps.push(v);
  }

  const cutoff = now() - retentionDays * DAY_MS;
  const hardDeletes = (Array.isArray(recycleBin) ? recycleBin : []).filter((b) => {
    const t = Date.parse(b && b.recycledAt);
    return Number.isFinite(t) && t <= cutoff;
  });

  return {
    cursorNext: next,
    batchIds: batch,
    keeps, reviews, recycles, hardDeletes,
    summary: { batch: batch.length, keep: keeps.length, review: reviews.length, recycle: recycles.length, hardDelete: hardDeletes.length, binSize: (recycleBin || []).length }
  };
}

// ── Tamper-evident log (sha256 hash chain) ──────────────────────────────────────────────────────
function serializeLog(e) {
  return JSON.stringify({ ts: String((e && e.ts) || ""), action: String((e && e.action) || ""), id: String((e && e.id) || ""), reason: String((e && e.reason) || "") });
}
export function logEntryHash(prev, entry) {
  return crypto.createHash("sha256").update(String(prev || GENESIS) + "|" + serializeLog(entry)).digest("hex");
}
export function sealLog(entries = []) {
  let h = GENESIS; const chain = [];
  for (const e of (Array.isArray(entries) ? entries : [])) { h = logEntryHash(h, e); chain.push(h); }
  return { v: "kb-recycle-seal-v1", count: chain.length, chain, seal: h };
}
export function verifyLog(entries = [], sealed = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const prior = Array.isArray(sealed.chain) ? sealed.chain : [];
  let h = GENESIS, brokenAt = -1;
  for (let i = 0; i < list.length; i++) { h = logEntryHash(h, list[i]); if (brokenAt === -1 && (i >= prior.length || h !== prior[i])) brokenAt = i; }
  const countMismatch = list.length !== (Number.isFinite(sealed.count) ? sealed.count : prior.length);
  const ok = brokenAt === -1 && !countMismatch;
  return { ok, tampered: !ok, brokenAt: ok ? -1 : (brokenAt === -1 ? Math.min(list.length, prior.length) : brokenAt), reason: ok ? "intact" : (countMismatch ? "row-count-changed" : "entry-modified") };
}

// Build the log entries for a decided cycle. nowIso passed in (caller stamps the time).
export function cycleLogEntries(plan, nowIso) {
  const ts = String(nowIso || "");
  const out = [];
  for (const r of plan.recycles || []) out.push({ ts, action: "recycle", id: r.id, reason: (r.reasons || []).join(",") });
  for (const r of plan.reviews || []) out.push({ ts, action: "review", id: r.id, reason: (r.reasons || []).join(",") });
  for (const h of plan.hardDeletes || []) out.push({ ts, action: "hard-delete", id: h.id, reason: `retention-expired(${h.reason || ""})` });
  return out;
}
