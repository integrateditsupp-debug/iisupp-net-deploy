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

// ── G-PRECISION (RUN 36) — precision-first scoring. Three signals replace the old raw-overlap score that let
// big OS-blueprints swallow specific diagnostics:
//   1. IDF weighting — a token in MANY docs (windows, issue, fix) is near-worthless; a rare topical token
//      (printer, bluetooth, monitor) dominates. Unmatched query tokens (incl. words the KB never mentions)
//      stay in the denominator, so an out-of-scope question gets low coverage and is REJECTED (escalates).
//   2. Heading/title boost — a query token that hits the doc's title or a ## heading (its real topic words)
//      counts far more than a stray body mention, so "audio no sound" → Audio Issues, not the Windows blueprint.
//   3. Explicit-platform bias only — the host OS no longer biases routing; a blueprint is preferred ONLY when
//      the user actually names that platform/device. Generic symptoms route to the specific diagnostic.
// A light stemmer matches morphological variants (crashing/crashes → crash) on BOTH sides. Out-of-scope is
// rejected honestly — we never force a match to pad the metric.
export const TITLE_BOOST = 3;
export const MATCH_FLOOR = 0.30;

/** Light, symmetric stemmer (applied to query AND doc tokens) so word forms align. */
export function stem(word) {
  const w = String(word || "");
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 5 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  return w;
}

// Curated synonym/intent signals → the canonical topic word that appears in the right doc's title/headings.
const SYNONYMS = {
  monitor: ["display"], screen: ["display"], hdmi: ["display"], displayport: ["display"], resolution: ["display"],
  headphones: ["bluetooth", "audio"], headset: ["bluetooth", "audio"], airpods: ["bluetooth"], earbuds: ["bluetooth"],
  sound: ["audio"], speaker: ["audio"], speakers: ["audio"], mic: ["audio"], microphone: ["audio"],
  charge: ["battery"], charging: ["battery"], charger: ["battery"], drain: ["battery"], drains: ["battery"], draining: ["battery"],
  password: ["credential"], signin: ["credential"], login: ["credential"], locked: ["credential"], lockout: ["credential"],
  bsod: ["crash"], freeze: ["crash"], frozen: ["crash"], hang: ["crash"], hangs: ["crash"],
  startup: ["boot"], reboot: ["boot"],
  lag: ["slow"], lagging: ["slow"], sluggish: ["slow"],
  outlook: ["email"], gmail: ["email"], smtp: ["email"], imap: ["email"],
  mouse: ["peripheral", "usb"], keyboard: ["peripheral", "usb"], webcam: ["peripheral", "camera"], scanner: ["peripheral"],
  spooler: ["printer"], printing: ["printer"],
  ethernet: ["network"], activate: ["activation"], license: ["activation"], antivirus: ["antivirus"], defender: ["antivirus"]
};

/** Tokenize a message, fold in synonym signals, and stem → the de-duplicated query stem set. */
export function expandQuery(message) {
  const out = new Set();
  for (const t of tokenize(message)) {
    out.add(stem(t));
    for (const s of (SYNONYMS[t] || [])) out.add(stem(s));
  }
  return [...out];
}

// Platform NAMED in the message (no host-OS fallback) — only an explicit mention biases routing.
export function explicitPlatformMention(message) {
  const m = String(message || "").toLowerCase();
  if (/\bipad\b|ipados/.test(m)) return "ipados";
  if (/\biphone\b|\bios\b/.test(m)) return "ios";
  if (/\bandroid\b|\bpixel\b|\bsamsung\b|\bgalaxy\b/.test(m)) return "android";
  if (/\bmac\b|macbook|imac|macos|osx|os x\b/.test(m)) return "darwin";
  if (/\bchromebook\b|chromeos/.test(m)) return "chromeos";
  if (/\blinux\b|ubuntu|debian|fedora\b/.test(m)) return "linux";
  if (/\bwindows\b|win10|win11/.test(m)) return "win32";
  return "";
}

/** Lazily attach stemmed body + heading/title sets to a doc (works for loaded docs and synthetic ones). */
function ensureStems(doc) {
  if (!doc._stemSet) {
    doc._stemSet = new Set(tokenize(`${doc.title || ""} ${doc.text || ""} ${(doc.tags || []).join(" ")}`).map(stem));
  }
  if (!doc._stemTitleSet) {
    doc._stemTitleSet = new Set(tokenize(doc._headings || doc.title || "").map(stem));
  }
  return doc;
}

/**
 * Score a doc against the stemmed query: IDF-weighted coverage with a heading/title boost, plus an
 * explicit-platform bias. Returns { score }. `opts.idf(token)` + `opts.totalIdf` (the full query IDF mass)
 * come from matchKb; `opts.explicit` is the user-named platform ("" = none).
 */
export function scoreKbDoc(doc, queryStems, opts = {}) {
  const { idf = () => 1, totalIdf = 1, explicit = "", titleBoost = TITLE_BOOST } = opts;
  if (!doc || !Array.isArray(queryStems) || !queryStems.length) return { score: 0 };
  ensureStems(doc);
  let sum = 0;
  for (const q of queryStems) {
    if (doc._stemSet.has(q)) sum += idf(q) * (doc._stemTitleSet.has(q) ? titleBoost : 1);
  }
  let score = sum / (totalIdf || 1);
  if (explicit && doc.platform) score *= (doc.platform === explicit ? 1.5 : 0.5); // bias ONLY on a named platform
  return { score };
}

/** Best-matching KB doc above the confidence floor, or null (honest out-of-scope reject). */
export function matchKb(index, message, { platform = "", min = MATCH_FLOOR } = {}) {
  const docs = (Array.isArray(index) ? index : []).map(ensureStems);
  const N = docs.length || 1;
  const df = new Map();
  for (const d of docs) for (const tok of d._stemSet) df.set(tok, (df.get(tok) || 0) + 1);
  const idf = (tok) => Math.log(1 + N / Math.max(0.5, df.get(tok) || 0)); // absent token → high IDF → penalizes coverage
  const Q = expandQuery(message);
  if (!Q.length) return null;
  const totalIdf = Q.reduce((s, q) => s + idf(q), 0) || 1;
  const explicit = explicitPlatformMention(message);
  let best = null, bestScore = min;
  for (const doc of docs) {
    const { score } = scoreKbDoc(doc, Q, { idf, totalIdf, explicit });
    if (score > bestScore) { bestScore = score; best = doc; }
  }
  return best ? { doc: best, score: bestScore, platform: inferPlatform(message, platform) } : null;
}

const NO_MATCH = "I couldn't find a local match for that. I can help across Windows, Mac, iPhone, iPad, Android, ChromeOS and Linux — reconnect to the internet for the full assistant, or rephrase with the device + symptom.";

/**
 * Offline answer for Ask ARIA. Returns { text, source, matched, platform } — never throws, never echoes a path.
 * `index` is the loaded KB pack (inject for tests). With no match → the cross-platform NO_MATCH message.
 */
export function localKbAnswer({ message, platform = "", index = [] } = {}) {
  const hit = matchKb(index, message, { platform });
  if (!hit) return { text: NO_MATCH, source: "local-kb", matched: false, platform: inferPlatform(message, platform) };
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
      // G-PRECISION — the doc's own headings (# / ## / ###) ARE its topic words; fold them (+ a filename hint)
      // into _headings so a query hitting them gets the title boost. This is what disambiguates topics.
      const headings = [...raw.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => m[1]).join(" ");
      const fileHint = f.replace(/\.md$/, "").replace(/[-_]/g, " ");
      const headingText = `${title} ${headings} ${fileHint}`;
      index.push({
        id: `${sub}/${f}`,
        platform: sub === "blueprints" ? platformOf(f) : "",
        title, text, _headings: headingText,
        _stemSet: new Set(tokenize(`${title} ${text}`).map(stem)),
        _stemTitleSet: new Set(tokenize(headingText).map(stem))
      });
    }
  }
  return index;
}
