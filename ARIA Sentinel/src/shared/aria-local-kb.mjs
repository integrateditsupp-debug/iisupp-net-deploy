// RUN 30-B — offline local KB for Sentinel's "Ask ARIA". When the live brain (aria-chat) is unreachable,
// this answers from the cross-platform KB pack that already ships in the .exe (aria-kb-pack/blueprints +
// diagnostics — Windows, macOS, iOS, iPadOS, Android, ChromeOS, Linux). Pure matcher (token overlap +
// platform bias) so it's fully unit-tested; the markdown loader is a thin wrapper.
//
// 🔒 R11 / scrub invariant (RUN 29): answers NEVER echo a filesystem path, and NEVER surface admin-internal
// terms (recipe ids, mode names, OTA paths). The KB pack is customer-facing content only.

const STOP = new Set(["the","and","but","for","with","that","this","have","has","are","was","were","not","cant",
  "cannot","wont","you","your","our","will","would","should","could","please","help","need","when","then","from",
  "into","just","what","why","how","who","get","got","now","its","why","does","did","a","an","is","it","my","me","on","in","to","of"]);

export function tokenize(text) {
  return String(text == null ? "" : text).toLowerCase()
    .replace(/['’]/g, "")                 // won't → wont (a stopword), don't → dont
    .replace(/\bwi[-\s]?fi\b/g, "wifi")    // wi-fi / wi fi → wifi (one token)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

// Map a blueprint filename / a query mention → a canonical platform key.
const PLATFORM_OF_FILE = [
  [/windows|win10|win11/i, "win32"], [/macos|mac-?os|sequoia|sonoma|imac|macbook/i, "darwin"],
  [/ipados|ipad/i, "ipados"], [/ios|iphone/i, "ios"], [/android/i, "android"],
  [/chromeos|chromebook/i, "chromeos"], [/linux|ubuntu|debian|fedora|rhel/i, "linux"]
];
export function platformOf(name) {
  for (const [re, key] of PLATFORM_OF_FILE) if (re.test(String(name || ""))) return key;
  return "";
}
// Infer the platform the user is asking about: an explicit mention in the message wins over the host OS.
export function inferPlatform(message, hostPlatform = "") {
  const m = String(message || "").toLowerCase();
  if (/\bipad\b/.test(m)) return "ipados";
  if (/\biphone\b|\bios\b/.test(m)) return "ios";
  if (/\bandroid\b|\bpixel\b|\bsamsung\b|\bgalaxy\b/.test(m)) return "android";
  if (/\bmac\b|macbook|imac|macos|osx|os x\b/.test(m)) return "darwin";
  if (/\bchromebook\b|chromeos/.test(m)) return "chromeos";
  if (/\blinux\b|ubuntu|debian|fedora\b/.test(m)) return "linux";
  if (/\bwindows\b|\bpc\b|win10|win11/.test(m)) return "win32";
  return hostPlatform || "";
}

/** Score a KB doc against the query tokens. Platform-agnostic docs (diagnostics) always eligible; a doc whose
 *  platform matches the target gets a bias bump so e.g. a Mac question prefers the macOS blueprint. */
export function scoreKbDoc(doc, queryTokens, targetPlatform) {
  if (!doc || !queryTokens || !queryTokens.length) return 0;
  const hay = doc._tokens || tokenize(`${doc.title || ""} ${doc.text || ""} ${(doc.tags || []).join(" ")}`);
  const hp = doc._tokenSet || new Set(hay);
  let hits = 0;
  for (const t of queryTokens) if (hp.has(t)) hits++;
  if (!hits) return 0;
  let score = hits / queryTokens.length;
  if (doc.platform && targetPlatform && doc.platform === targetPlatform) score += 0.25; // platform bias
  if (doc.platform && targetPlatform && doc.platform !== targetPlatform) score -= 0.05; // mild off-platform penalty
  if (!targetPlatform && !doc.platform) score += 0.02; // no platform given → prefer the general diagnostic
  return score;
}

// D1 (2026-07-03) — generic platform / support words that appear in almost EVERY article of a category, so
// they must NOT count toward relevance. Without this, any Windows question "matches" any Windows article on
// the shared word "windows" (e.g. "stuck Windows update" scored the "no sound" audio article as nearest).
const GENERIC_TERMS = new Set([
  "windows","win10","win11","macos","mac","osx","ios","iphone","ipad","ipados","android","pixel","samsung",
  "galaxy","chromeos","chromebook","linux","ubuntu","debian","fedora","rhel","pc","computer","laptop","desktop",
  "device","machine","phone","tablet","system","fix","fixing","fixed","help","issue","issues","problem","problems",
  "error","errors","working","work","broken","trouble","support","cant","wont"
]);

// D1 — query-anchored relevance: what fraction of the query's MEANINGFUL (non-generic) terms actually appear
// in the article's title/text. This is what separates a real match ("printer not printing" → printer article,
// 1.0) from the nearest-but-wrong one ("stuck Windows update" → audio article, 0.0 — neither "stuck" nor
// "update" is in an audio doc). Returns 0..1. An all-generic query falls back to full tokens (can't discriminate).
export const KB_RELEVANCE_FLOOR = 0.3;
export function kbRelevance(query, articleText) {
  const meaningful = tokenize(query).filter((t) => !GENERIC_TERMS.has(t));
  if (!meaningful.length) return 1; // no discriminating terms → can't judge → defer to the confidence gate
  const bag = new Set(tokenize(articleText));
  let hits = 0;
  for (const t of meaningful) if (bag.has(t)) hits++;
  return hits / meaningful.length;
}

/** Best-matching KB doc above a confidence floor, or null. */
export function matchKb(index, message, { platform = "", min = 0.15 } = {}) {
  const tokens = tokenize(message);
  const target = inferPlatform(message, platform);
  let best = null, bestScore = min;
  for (const doc of Array.isArray(index) ? index : []) {
    const s = scoreKbDoc(doc, tokens, target);
    if (s > bestScore) { bestScore = s; best = doc; }
  }
  return best ? { doc: best, score: bestScore, platform: target } : null;
}

const NO_MATCH = "I couldn't find a local match for that. I can help across Windows, Mac, iPhone, iPad, Android, ChromeOS and Linux — reconnect to the internet for the full assistant, or rephrase with the device + symptom.";

/**
 * Offline answer for Ask ARIA. Returns { text, source, matched, platform } — never throws, never echoes a path.
 * `index` is the loaded KB pack (inject for tests). With no match → the cross-platform NO_MATCH message.
 */
export function localKbAnswer({ message, platform = "", index = [] } = {}) {
  const hit = matchKb(index, message, { platform });
  // D1 — matchKb returns the best doc above a low score floor, which for an unknown query is still just the
  // NEAREST (wrong) doc. Abstain honestly unless the query's meaningful terms actually appear in that doc.
  if (!hit || kbRelevance(message, `${hit.doc.title || ""} ${hit.doc.summary || hit.doc.text || ""}`) < KB_RELEVANCE_FLOOR) {
    return { text: NO_MATCH, source: "local-kb", matched: false, platform: inferPlatform(message, platform) };
  }
  const d = hit.doc;
  const excerpt = scrub(String(d.summary || d.text || "").trim()).slice(0, 600);
  const text = `From the offline knowledge base — ${scrub(d.title || "guide")}:\n\n${excerpt}\n\n(Reconnect for the full ARIA assistant.)`;
  return { text, source: "local-kb", matched: true, platform: hit.platform, id: d.id };
}

// 🔒 strip any absolute path + admin-internal term from KB output (defense-in-depth; KB content is clean).
function scrub(text) {
  return String(text == null ? "" : text)
    .replace(/([a-z]:\\)?[^\r\n"<>|]*?private\s+pics\s+and\s+vids[^\r\n"<>|]*/gi, "<private-folder>")
    .replace(/[A-Za-z]:\\[^\s"'()]+/g, "[path]")
    .replace(/\/(?:Users|home|mnt|var|tmp|opt)\/[^\s"'()]+/gi, "[path]")
    .replace(/\brcp_[a-z0-9_-]+/gi, "[recipe]");
}

// ── Thin loader: index aria-kb-pack/{blueprints,diagnostics}/*.md (not unit-tested; the matcher above is) ──
export function loadKbPack(dir, fsImpl) {
  const index = [];
  for (const sub of ["blueprints", "diagnostics"]) {
    let files = [];
    try { files = fsImpl.readdirSync(`${dir}/${sub}`).filter((f) => f.endsWith(".md")); } catch { continue; }
    for (const f of files) {
      let raw = "";
      try { raw = fsImpl.readFileSync(`${dir}/${sub}/${f}`, "utf8"); } catch { continue; }
      const title = (raw.match(/^#\s+(.+)$/m) || [])[1] || f.replace(/\.md$/, "");
      const text = raw.toLowerCase();
      index.push({ id: `${sub}/${f}`, platform: sub === "blueprints" ? platformOf(f) : "", title, text, _tokens: tokenize(`${title} ${text}`), _tokenSet: new Set(tokenize(`${title} ${text}`)) });
    }
  }
  return index;
}
