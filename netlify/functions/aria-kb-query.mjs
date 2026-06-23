// PUBLIC KB endpoint for ARIA Sentinel desktop (and any other ARIA surface).
// Mirrors the same retrieval engine + chunks that iisupp.net/aria uses client-side.
// POST { query, platform?, audience? } → { match: bool, article, content_excerpt, confidence, source }
//
// 🔒 KB-FIRST architecture (Ahmad's rule 2026-06-22): the Sentinel desktop calls THIS endpoint
// BEFORE aria-chat. If we return a confident match, Sentinel uses our answer for $0 (no Anthropic).
// Only when match.confidence < threshold does Sentinel fall through to aria-chat (Anthropic).
//
// This is faithful to the web /aria architecture — pure-JS token-overlap retrieval, no LLM, no cost.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Same hard routing rules as assets/aria-kb-retrieval.mjs — kept inline so this function is self-contained.
const ROUTING = [
  [/\b(blue\s*screen|bsod|stop\s*error|kernel\s*panic|critical_process_died|whea_uncorrectable)\b/i, 'l1-windows-001'],
  [/\b(won.?t\s*boot|can.?t\s*boot|spinning\s*dots|stuck\s*on\s*logo|black\s*screen|boot\s*loop|automatic\s*repair)\b/i, 'l1-windows-002'],
  [/\b(slow|laggy|sluggish|freezing|takes\s*forever|high\s*cpu|100%\s*disk)\b.*\b(pc|computer|laptop|machine|mac)?\b/i, 'l1-windows-003'],
  [/\b(disk\s*full|out\s*of\s*space|low\s*disk|c\s*drive\s*full|storage\s*full)\b/i, 'l1-windows-004'],
  [/\b(no\s*sound|no\s*audio|speakers?\s*not\s*working|red\s*x\s*speaker)\b/i, 'l1-windows-005'],
  [/\b(app\s*won.?t\s*open|app\s*crash|app\s*closes?\s*immediately|application\s*error)\b/i, 'l1-windows-006'],
  [/\b(can.?t\s*sign\s*in|password\s*prompt|login\s*loop|aadsts)\b.*\b(office|365|m365)\b/i, 'l1-m365-001'],
  [/\b(office|word|excel)\b.*(unlicensed|reduced\s*functionality|activation)\b/i, 'l1-m365-002'],
  [/\boutlook\b.*(not\s*receiv|missing\s*email|inbox\s*not\s*updat|stuck|offline)\b/i, 'l1-outlook-001'],
  [/\boutlook\b.*(can.?t\s*send|stuck\s*in\s*outbox|smtp|unable\s*to\s*send)\b/i, 'l1-outlook-002'],
  [/\bteams\b.*(no\s*audio|can.?t\s*hear|mic|microphone|speaker|sound)\b/i, 'l1-teams-001'],
  [/\bteams\b.*(won.?t\s*load|stuck|splash|crash|not\s*open)\b/i, 'l1-teams-002'],
  [/\bonedrive\b.*(not\s*sync|sync\s*stuck|paused|red\s*x)\b/i, 'l1-onedrive-001'],
  [/\b(wi.?fi|wireless)\b.*(not\s*working|no\s*internet|can.?t\s*connect|dropped)\b/i, 'l1-wifi-001'],
  [/\bprinter\b.*(not\s*print|stuck|won.?t\s*print|offline|jam|spooler)\b/i, 'l1-printer-001'],
  [/\b(forgot|reset)\s*password|self.?service|sspr\b/i, 'l1-password-001'],
  [/\bvpn\b.*(won.?t\s*connect|disconnect|timeout|drop)\b/i, 'l1-vpn-001'],
  [/\b(macbook|imac|mac\s*mini|mac\s*pro)\b.*\b(won.?t|not\s*work|crash|slow|freez|sleep|wifi)\b/i, 'l1-mac-001'],
  [/\b(iphone|ipad|ios|ipados)\b/i, 'l1-mac-001'],
  [/\bandroid\b/i, 'l1-mac-001'],
];

let CHUNKS_CACHE = null;
async function loadChunks() {
  if (CHUNKS_CACHE) return CHUNKS_CACHE;
  try {
    // The chunks JSON is bundled with the function at deploy time via included_files.
    const buf = await readFile(path.join(__dirname, "aria-kb-chunks.json"), "utf8");
    CHUNKS_CACHE = JSON.parse(buf);
  } catch (e) {
    // Fallback: fetch from public URL if bundling failed
    const r = await fetch("https://iisupp.net/assets/aria-kb-chunks.json");
    CHUNKS_CACHE = await r.json();
  }
  return CHUNKS_CACHE;
}

const STOP_WORDS = new Set("a an and are as at be been being but by can could did do does for from get had has have he her him his how i if in into is it its me my no not now of on only or our should so than that the their them then there these they this to too us was we were what when where which who why will with would you your".split(" "));

function tokenize(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9\s.-]/g, " ").split(/\s+/).filter(t => t && t.length >= 2 && !STOP_WORDS.has(t));
}

function score(query, chunk) {
  const qTokens = tokenize(query);
  if (!qTokens.length) return 0;
  const hay = (chunk.title + " " + chunk.slug + " " + (chunk.keywords || []).join(" ") + " " + chunk.content).toLowerCase();
  let s = 0;
  for (const t of qTokens) {
    if (hay.includes(t)) s += 1;
    if (chunk.title && chunk.title.toLowerCase().includes(t)) s += 2;
  }
  // Phrase boost — full bigram match in title or first 300 chars of content
  const qLower = String(query).toLowerCase();
  if (qLower.length >= 6) {
    for (let i = 0; i < qLower.length - 6; i++) {
      const frag = qLower.slice(i, Math.min(i + 30, qLower.length));
      if (frag.length >= 8 && hay.includes(frag)) { s += 4; break; }
    }
  }
  // Apply hard routing boost
  for (const [regex, articleId] of ROUTING) {
    if (regex.test(query) && chunk.slug.startsWith(articleId)) { s += 25; break; }
  }
  return s;
}

function json(status, body, extra = {}) {
  return {
    statusCode: status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*", "cache-control": "no-store", ...extra },
    body: JSON.stringify(body)
  };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad-json" }); }
  const query = String(body.query || "").trim();
  if (!query || query.length < 2) return json(400, { error: "query required" });

  const data = await loadChunks();
  const chunks = data.chunks || [];

  const scored = chunks.map(c => ({ chunk: c, score: score(query, c) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  const top = scored[0];

  if (!top || top.score < 3) {
    return json(200, { match: false, confidence: top ? top.score : 0, source: "aria-kb-public", totalChunks: chunks.length });
  }

  // Trim content for response
  let content = top.chunk.content || "";
  if (content.length > 4000) content = content.slice(0, 4000) + "\n…[truncated — see iisupp.net/aria for full article]";

  return json(200, {
    match: true,
    confidence: top.score,
    source: "aria-kb-public",
    article: {
      slug: top.chunk.slug,
      title: top.chunk.title || top.chunk.slug.replace(/-/g, " "),
      tier: top.chunk.tier,
      vertical: top.chunk.vertical,
      url: `https://iisupp.net/aria?article=${encodeURIComponent(top.chunk.slug)}`
    },
    content_excerpt: content
  });
}

export const config = { path: "/.netlify/functions/aria-kb-query" };
