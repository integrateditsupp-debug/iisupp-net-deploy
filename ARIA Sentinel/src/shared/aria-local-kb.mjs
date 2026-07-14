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

// P1 (2026-07-14) — the offline matcher scores hits/meaningful-tokens over FULL article text, so a long
// doc can swallow a short generic query ("pizza place near the office" → Audio at 0.33). A higher offline
// floor restores the honest abstain for those without regressing any real match (lowest genuine match ≈ 0.40).
// The shared KB_RELEVANCE_FLOOR (0.30) stays for the ONLINE brain-client path (unchanged, separately tested).
export const OFFLINE_KB_RELEVANCE_FLOOR = 0.38;

// P1 (2026-07-14) — credential/secret RETRIEVAL requests are out of scope and a liability. ARIA never
// surfaces account secrets; it points the user at the approved IT access process. This is NOT a
// password-RESET help request ("i forgot my password" still routes to the KB) — only "give/tell/share me
// the … password" or "the admin password for the server" style asks.
const CREDENTIAL_REQUEST =
  /\b(give|share|tell|send|show|whats?|what\s+is|provide|retrieve|hand\s+over)\b[^.?!]{0,40}\b(password|passwd|credential|credentials|admin\s+login|login\s+details|api\s+key|secret)\b|\b(admin|administrator|root|domain|server)\b[^.?!]{0,20}\bpassword\b[^.?!]{0,20}\b(for|to|of)\b/i;
const CREDENTIAL_REFUSAL =
  "For security, I can't look up or share passwords, admin credentials, or account secrets — even offline. I couldn't find a safe self-service step for a credential request like this. To get access to the server or account, request it from your IT team through the approved process (a ticket or admin approval).";

// P2 (2026-07-14) — security & recovery incidents where minutes matter. The offline tier answers
// containment-FIRST, deterministically, instead of routing generic KB excerpts (which lack disconnect /
// change-password-now / don't-call language) or asking a multi-turn clarifier. Honest (Rule 14): these are
// guidance, never a claim that ARIA acted. Ordered most-urgent first; first matching responder wins.
const INCIDENT_RESPONDERS = [
  {
    id: "ransomware",
    test: (m) => /\bransom(ware)?\b|ransom\s*note|files?\s*(were|got|are)?\s*(renamed|encrypted)|encrypted\s*(all|our|my|the)\s*(files|data|drive)|\bbitcoin\b/i.test(m),
    title: "Suspected ransomware — contain first",
    body: "Those are ransomware signs. Contain first, clean second — minutes matter.\n\n1. DISCONNECT / isolate the machine from the network NOW (unplug Ethernet, turn off Wi-Fi) so it can't spread to shares and backups.\n2. Do NOT pay the ransom, and don't delete anything — leave the note and files as evidence.\n3. From a different, clean device, change your important passwords (email first).\n4. Contact IT / security immediately. Recovery is isolate → clean/reimage → restore from backups that predate the infection."
  },
  {
    id: "phishing-credential",
    test: (m) => /enter(ed)?\s*(my\s*)?(password|credentials|login)[^.?!]*\b(fake|phishing|suspicious|scam)\b|\bfake\s*(microsoft|office|google|outlook|login|sign\W?in)\b[^.?!]*\b(page|screen|site|form|link)\b|typed\s*my\s*password[^.?!]*\b(fake|phish)/i.test(m),
    title: "Password entered on a fake page — treat it as stolen",
    body: "Treat the password as stolen — speed matters now.\n\n1. Change that password IMMEDIATELY from a device you trust — and everywhere you reused it.\n2. Sign out all sessions (for Microsoft accounts: account Security page → \"Sign out everywhere\").\n3. Make sure MFA is on for the account and review recent sign-in activity.\n4. Report it to IT / security so they can watch the account for misuse."
  },
  {
    id: "fake-support-scam",
    test: (m) => /virus\s*detected[^.?!]*call|call\s*(microsoft|apple|windows|support)[^.?!]*(now|number|immediately|back)|(popup|pop\W?up)[^.?!]*(call|virus\s*detected)|says?\s*(to\s*)?call\s*(microsoft|this\s*number|support)|tech\s*support\s*(scam|popup)/i.test(m),
    title: "\"Virus detected — call this number\" is a scam",
    body: "That full-screen \"virus detected — call this number\" page is a scam, not a real detection. Real antivirus never asks you to call.\n\n1. Do NOT call the number, and do not let anyone remote into your PC from that page.\n2. Close the browser (Ctrl+Shift+Esc → select the browser → End task) and reopen WITHOUT restoring tabs.\n3. Clear that site's notification permission (browser Settings → Site settings → Notifications → remove it).\n4. Run a full Windows Security scan to be safe."
  },
  {
    id: "deleted-file",
    test: (m) => /(deleted|removed)[^.?!]*(folder|file|files|directory)[^.?!]*(accident|by\s*mistake|didn\W?t\s*mean)|accidentally\s*(deleted|removed)|deleted\s*the\s*(whole|entire)[^.?!]*(folder|file|files)/i.test(m),
    title: "Recover a deleted file or folder",
    body: "Don't panic — deleted files are usually recoverable if you act before they're overwritten.\n\n1. Check the Recycle Bin first and restore from there if it's present.\n2. On a network / shared drive, right-click the parent folder → Properties → Previous Versions, or ask IT to restore from the file-server backup / snapshot.\n3. On OneDrive / SharePoint, use the Recycle Bin on the web (deleted items stay ~30–93 days) and \"Restore your OneDrive\".\n4. Stop writing to that drive until it's recovered; if the above don't show it, IT can restore from backup."
  }
];

function incidentAnswer(message) {
  const m = String(message || "");
  for (const r of INCIDENT_RESPONDERS) {
    try { if (r.test(m)) return r; } catch { /* a bad regex must never break chat */ }
  }
  return null;
}

/**
 * Offline answer for Ask ARIA. Returns { text, source, matched, platform } — never throws, never echoes a path.
 * `index` is the loaded KB pack (inject for tests). With no match → the cross-platform NO_MATCH message.
 */
export function localKbAnswer({ message, platform = "", index = [] } = {}) {
  const msg = String(message || "");
  // P2 — security / recovery incidents first: containment-first, deterministic (minutes matter).
  const inc = incidentAnswer(msg);
  if (inc) {
    const text = `${inc.title}\n\n${scrub(inc.body)}\n\n(Guidance only — I can't make changes on your device from here. Reconnect for the full ARIA assistant, or tell me what happens after a step.)`;
    return { text, source: "local-kb", matched: true, platform: inferPlatform(msg, platform), id: `incident/${inc.id}` };
  }
  // P1 — credential/secret RETRIEVAL requests: honest refusal, never a KB junk match (out of scope).
  if (CREDENTIAL_REQUEST.test(msg)) {
    return { text: CREDENTIAL_REFUSAL, source: "local-kb", matched: false, refusal: true, platform: inferPlatform(msg, platform) };
  }
  const hit = matchKb(index, msg, { platform });
  // D1 — matchKb returns the best doc above a low score floor, which for an unknown query is still just the
  // NEAREST (wrong) doc. Abstain honestly unless the query's meaningful terms actually appear in that doc.
  // P1 — the offline floor (0.38) is stricter than the shared online floor so short generic out-of-scope
  // queries ("pizza place near the office" → Audio @ 0.33) abstain honestly instead of returning a wrong doc.
  if (!hit || kbRelevance(msg, `${hit.doc.title || ""} ${hit.doc.summary || hit.doc.text || ""}`) < OFFLINE_KB_RELEVANCE_FLOOR) {
    return { text: NO_MATCH, source: "local-kb", matched: false, platform: inferPlatform(msg, platform) };
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
