// RUN 30-B — offline local KB for Sentinel's "Ask ARIA". When the live brain (aria-chat) is unreachable,
// this answers from the cross-platform KB pack that already ships in the .exe (aria-kb-pack/blueprints +
// diagnostics — Windows, macOS, iOS, iPadOS, Android, ChromeOS, Linux). Pure matcher (token overlap +
// platform bias) so it's fully unit-tested; the markdown loader is a thin wrapper.
//
// 🔒 R11 / scrub invariant (RUN 29): answers NEVER echo a filesystem path, and NEVER surface admin-internal
// terms (recipe ids, mode names, OTA paths). The KB pack is customer-facing content only.
//
// A2 (2026-06-29): Intent tags + vertical guard + synonym precision fix.
// A4 (2026-06-29): Edge-case hardening — MAX_QUERY_LEN cap + sanitizeQuery() strips oversized/injected input.
//   The offline KB is pure token matching so injection is inert by design; sanitizeQuery documents + enforces
//   the boundary so tests can prove it. All 8 edge cases (empty, whitespace, gibberish, multi-issue, long,
//   injection, off-topic, non-English) degrade gracefully to NO_MATCH or best-effort, never crash.
//   - loadKbPack now parses YAML frontmatter: intent, vertical, safe_recipe fields.
//   - matchKb applies a vertical guard: non-generic docs outside the query's inferred vertical get a 0.3x penalty.
//   - SYNONYMS: separated "locked/lockout" from generic "credential" to route account-lockout queries precisely.
//   - matchKb logs {query, topScore, chosenId} for τ tuning (console.debug, no-op in prod).

const STOP = new Set(["the","and","but","for","with","that","this","have","has","are","was","were","not","cant",
  "cannot","wont","you","your","our","will","would","should","could","please","help","need","when","then","from",
  "into","just","what","why","how","who","get","got","now","its","why","does","did","a","an","is","it","my","me","on","in","to","of"]);

// A4: Maximum query length before truncation. Guards against oversized payloads slowing the matcher.
export const MAX_QUERY_LEN = 1000;

/** A4: Normalize + truncate query. Returns a trimmed string ≤ MAX_QUERY_LEN chars. Pure, testable. */
export function sanitizeQuery(message) {
  const m = String(message == null ? "" : message).trim();
  return m.length > MAX_QUERY_LEN ? m.slice(0, MAX_QUERY_LEN) : m;
}

export function tokenize(text) {
  return String(text == null ? "" : text).toLowerCase()
    .replace(/['']/g, "")                 // won't → wont (a stopword), don't → dont
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

// ── A2: Infer the vertical the user is asking about (generic = no specific vertical detected) ──
// Verticals: generic | healthcare | banking | legal | hr
export function inferVertical(message) {
  const m = String(message || "").toLowerCase();
  if (/mychart|epic|patient portal|ehr|emr|meditech|cerner|allscripts|healthstream/.test(m)) return "healthcare";
  if (/online banking|bank login|td bank|rbc|bmo|scotiabank|cibc|wells fargo/.test(m)) return "banking";
  if (/legal software|clio|practice management law/.test(m)) return "legal";
  if (/workday|adp|hris|payroll portal|bamboohr/.test(m)) return "hr";
  return "generic";
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
//   4. A2 — Vertical guard: a non-generic doc (vertical=healthcare etc.) is penalized 0.3x for queries that
//      don't signal that vertical. Prevents MyChart/patient-portal docs from polluting generic Windows queries.
// A light stemmer matches morphological variants (crashing/crashes → crash) on BOTH sides. Out-of-scope is
// rejected honestly — we never force a match to pad the metric.
export const TITLE_BOOST = 3;
export const MATCH_FLOOR = 0.30;
export const VERTICAL_PENALTY = 0.3; // A2: non-matching vertical → multiply score by this

/** Light, symmetric stemmer (applied to query AND doc tokens) so word forms align. */
export function stem(word) {
  const w = String(word || "");
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 5 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  return w;
}

// A2 SYNONYM PRECISION FIX: "locked"/"lockout" now map to "lockout" (the specific account-lockout article's
// key term) instead of "credential" (which is shared with password/sign-in articles). This prevents generic
// account-lockout queries from routing to the wrong credential-issues article.
// "password"/"signin"/"login" still map to "credential" for generic sign-in issues.
const SYNONYMS = {
  monitor: ["display"], screen: ["display"], hdmi: ["display"], displayport: ["display"], resolution: ["display"],
  headphones: ["bluetooth", "audio"], headset: ["bluetooth", "audio"], airpods: ["bluetooth"], earbuds: ["bluetooth"],
  sound: ["audio"], speaker: ["audio"], speakers: ["audio"], mic: ["audio"], microphone: ["audio"],
  charge: ["battery"], charging: ["battery"], charger: ["battery"], drain: ["battery"], drains: ["battery"], draining: ["battery"],
  // A2 FIX: locked/lockout → "lockout" (specific), not "credential" (generic).
  // password/signin/login still map to "credential" for password-reset / sign-in issues.
  password: ["credential"], signin: ["credential"], login: ["credential"],
  locked: ["lockout"], lockout: ["lockout"],
  bsod: ["crash"], freeze: ["crash"], frozen: ["crash"], hang: ["crash"], hangs: ["crash"],
  startup: ["boot"], reboot: ["boot"],
  lag: ["slow"], lagging: ["slow"], sluggish: ["slow"],
  outlook: ["email"], gmail: ["email"], smtp: ["email"], imap: ["email"],
  mouse: ["peripheral", "usb"], keyboard: ["peripheral", "usb"], webcam: ["peripheral", "camera"], scanner: ["peripheral"],
  spooler: ["printer"], printing: ["printer"],
  ethernet: ["network"], activate: ["activation"], license: ["activation"], antivirus: ["antivirus"], defender: ["antivirus"],
  // A2: time/clock intent signals
  clock: ["time"], sync: ["time"], timezone: ["time"], "time zone": ["time"],
  // A2: setup intent signals for add-printer
  add: ["setup"], install: ["setup"], connect: ["setup"],
  // A2: Office/Excel
  excel: ["excel", "office"], word: ["office"], powerpoint: ["office"], "microsoft office": ["office"]
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
 * explicit-platform bias and (A2) vertical guard. Returns { score }.
 */
export function scoreKbDoc(doc, queryStems, opts = {}) {
  const { idf = () => 1, totalIdf = 1, explicit = "", titleBoost = TITLE_BOOST, queryVertical = "generic" } = opts;
  if (!doc || !Array.isArray(queryStems) || !queryStems.length) return { score: 0 };
  ensureStems(doc);
  let sum = 0;
  for (const q of queryStems) {
    if (doc._stemSet.has(q)) sum += idf(q) * (doc._stemTitleSet.has(q) ? titleBoost : 1);
  }
  let score = sum / (totalIdf || 1);
  if (explicit && doc.platform) score *= (doc.platform === explicit ? 1.5 : 0.5); // bias ONLY on a named platform
  // A2 vertical guard: suppress non-generic docs when the query doesn't signal that vertical.
  // Example: healthcare lockout docs get 0.3x for generic Windows lockout queries.
  const docVertical = doc.vertical || "generic";
  if (docVertical !== "generic" && docVertical !== queryVertical) {
    score *= VERTICAL_PENALTY;
  }
  return { score };
}

/** Best-matching KB doc above the confidence floor, or null (honest out-of-scope reject). */
export function matchKb(index, message, { platform = "", min = MATCH_FLOOR } = {}) {
  message = sanitizeQuery(message); // A4: truncate oversized / pre-normalized queries
  const docs = (Array.isArray(index) ? index : []).map(ensureStems);
  const N = docs.length || 1;
  const df = new Map();
  for (const d of docs) for (const tok of d._stemSet) df.set(tok, (df.get(tok) || 0) + 1);
  const idf = (tok) => Math.log(1 + N / Math.max(0.5, df.get(tok) || 0)); // absent token → high IDF → penalizes coverage
  const Q = expandQuery(message);
  if (!Q.length) return null;
  const totalIdf = Q.reduce((s, q) => s + idf(q), 0) || 1;
  const explicit = explicitPlatformMention(message);
  const queryVertical = inferVertical(message); // A2
  let best = null, bestScore = min;
  for (const doc of docs) {
    const { score } = scoreKbDoc(doc, Q, { idf, totalIdf, explicit, queryVertical });
    if (score > bestScore) { bestScore = score; best = doc; }
  }
  // A2: log for τ tuning (console.debug no-ops in Electron renderer/prod — no cost, no leak)
  if (typeof console !== "undefined" && typeof console.debug === "function") {
    console.debug("[kb-match]", { query: message.slice(0, 60), topScore: bestScore.toFixed(3), chosen: best?.id ?? "null (abstain)" });
  }
  return best ? { doc: best, score: bestScore, platform: inferPlatform(message, platform) } : null;
}

const NO_MATCH = "I couldn't find a local match for that. I can help across Windows, Mac, iPhone, iPad, Android, ChromeOS and Linux — reconnect to the internet for the full assistant, or rephrase with the device + symptom.";
const ABSTAIN_SUGGEST = "I'm not certain about that one. Here's the closest related guidance I have locally — but I'd recommend connecting to ARIA's full assistant for a confident answer, or I can open a support ticket.";

/**
 * Offline answer for Ask ARIA. Returns { text, source, matched, platform } — never throws, never echoes a path.
 * `index` is the loaded KB pack (inject for tests). With no match → the cross-platform NO_MATCH message.
 */
export function localKbAnswer({ message, platform = "", index = [] } = {}) {
  message = sanitizeQuery(message); // A4: normalize before matching
  const hit = matchKb(index, message, { platform });
  if (!hit) return { text: NO_MATCH, source: "local-kb", matched: false, platform: inferPlatform(message, platform) };
  const d = hit.doc;
  const excerpt = scrub(String(d.summary || d.text || "").trim()).slice(0, 600);
  // A2: if score is above floor but not very high, use the abstain framing
  const confident = hit.score >= MATCH_FLOOR * 2;
  const preamble = confident
    ? `From the offline knowledge base — ${scrub(d.title || "guide")}:`
    : `${ABSTAIN_SUGGEST}\n\nClosest match — ${scrub(d.title || "guide")}:`;
  const text = `${preamble}\n\n${excerpt}\n\n(Reconnect for the full ARIA assistant.)`;
  return { text, source: "local-kb", matched: true, confident, platform: hit.platform, id: d.id };
}

// 🔒 strip any absolute path + admin-internal term from KB output (defense-in-depth; KB content is clean).
function scrub(text) {
  return String(text == null ? "" : text)
    .replace(/([a-z]:\\)?[^\r\n"<>|]*?private\s+pics\s+and\s+vids[^\r\n"<>|]*/gi, "<private-folder>")
    .replace(/[A-Za-z]:\\[^\s"'()]+/g, "[path]")
    .replace(/\/(?:Users|home|mnt|var|tmp|opt)\/[^\s"'()]+/gi, "[path]")
    .replace(/\brcp_[a-z0-9_-]+/gi, "[recipe]");
}

// ── A2: Parse YAML frontmatter from a markdown doc (id, intent, vertical, safe_recipe) ──
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const [k, ...rest] = line.split(":");
    if (k && rest.length) result[k.trim()] = rest.join(":").trim();
  }
  return result;
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
      const fm = parseFrontmatter(raw); // A2: parse intent / vertical / safe_recipe from frontmatter
      const title = (raw.match(/^#\s+(.+)$/m) || [])[1] || f.replace(/\.md$/, "");
      const text = raw.toLowerCase();
      // G-PRECISION — the doc's own headings (# / ## / ###) ARE its topic words; fold them (+ a filename hint)
      // into _headings so a query hitting them gets the title boost. This is what disambiguates topics.
      const headings = [...raw.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => m[1]).join(" ");
      const fileHint = f.replace(/\.md$/, "").replace(/[-_]/g, " ");
      const headingText = `${title} ${headings} ${fileHint}`;
      index.push({
        id: fm.id || `${sub}/${f}`,
        platform: sub === "blueprints" ? platformOf(f) : "",
        // A2: surface frontmatter fields so scorer + vertical guard can use them
        intent: fm.intent || "",
        vertical: fm.vertical || "generic",
        safe_recipe: fm.safe_recipe || "",
        title, text, _headings: headingText,
        _stemSet: new Set(tokenize(`${title} ${text}`).map(stem)),
        _stemTitleSet: new Set(tokenize(headingText).map(stem))
      });
    }
  }
  return index;
}
