// PUBLIC KB endpoint for ARIA Sentinel desktop (and any other ARIA surface).
// Mirrors the same retrieval engine + chunks that iisupp.net/aria uses client-side.
// POST { query, platform?, audience? } → { match: bool, article, content_excerpt, confidence, source }
//
// 🔒 KB-FIRST architecture (Ahmad's rule 2026-06-22): the Sentinel desktop calls THIS endpoint
// BEFORE aria-chat. If we return a confident match, Sentinel uses our answer for $0 (no Anthropic).
// Only when match.confidence < threshold does Sentinel fall through to aria-chat (Anthropic).
//
// This is faithful to the web /aria architecture — pure-JS token-overlap retrieval, no LLM, no cost.

// Routing rules — ORDER MATTERS, first match adds +25 score boost. Tuned 2026-06-23 from
// live stress test on 30 real-world queries. Mac-specific BEFORE BSOD (otherwise BSOD eats kernel-panic).
// Mobile (iPhone/iPad/Android) — no article exists yet, let them fall through to generic wifi/bluetooth.
const ROUTING = [
  // === Mac-specific FIRST (must beat BSOD on kernel-panic, beach-ball, etc.) ===
  [/\b(macbook|imac|mac\s*mini|mac\s*pro|mac\s*os|macos)\b.*\b(kernel\s*panic|beach\s*ball|rainbow\s*wheel|spinning|freez|restart|crash|sleep)\b/i, 'l1-mac-001'],
  [/\b(kernel\s*panic|beach\s*ball|rainbow\s*wheel|spinning\s*beach)\b/i, 'l1-mac-001'],
  [/\b(mac\s*was\s*restarted|computer\s*was\s*restarted\s*because)\b/i, 'l1-mac-001'],
  // mac + wifi → use the generic wifi article (no mac-wifi-specific chunk exists)
  [/\bmac(book)?\b.*\bwifi\b|\bwifi\b.*\bmac(book)?\b/i, 'l1-wifi-001'],
  // === Windows BSOD — only for actual Windows stop-error terms ===
  [/\b(blue\s*screen|bsod|stop\s*error|critical_process_died|whea_uncorrectable|memory_management|page_fault_in_nonpaged_area)\b/i, 'l1-windows-001'],
  [/\b(won.?t\s*boot|can.?t\s*boot|spinning\s*dots|stuck\s*on\s*logo|black\s*screen|boot\s*loop|automatic\s*repair)\b/i, 'l1-windows-002'],
  [/\b(slow|laggy|sluggish|freezing|takes\s*forever|high\s*cpu|100%\s*disk)\b.*\b(pc|computer|laptop|machine)?\b/i, 'l1-windows-003'],
  [/\b(disk\s*full|out\s*of\s*space|low\s*disk|c\s*drive\s*full|storage\s*full|almost\s*full)\b/i, 'l1-windows-004'],
  [/\b(no\s*sound|no\s*audio|speakers?\s*not\s*working|speakers?\s*dead|audio\s*not\s*working|sound\s*not\s*working|can.?t\s*hear|red\s*x\s*speaker)\b/i, 'l1-windows-005'],
  [/\b(app\s*won.?t\s*open|app\s*crash|app\s*closes?\s*immediately|application\s*error)\b/i, 'l1-windows-006'],
  // === M365 / Office ===
  [/\b(can.?t\s*sign\s*in|password\s*prompt|login\s*loop|aadsts)\b.*\b(office|365|m365)\b/i, 'l1-m365-001'],
  [/\b(office|word|excel)\b.*(unlicensed|reduced\s*functionality|activation)\b/i, 'l1-m365-002'],
  [/\boutlook\b.*(not\s*receiv|missing\s*email|inbox\s*not\s*updat|stuck|offline)\b/i, 'l1-outlook-001'],
  [/\boutlook\b.*(can.?t\s*send|stuck\s*in\s*outbox|smtp|unable\s*to\s*send)\b/i, 'l1-outlook-002'],
  [/\bteams\b.*(no\s*audio|can.?t\s*hear|mic|microphone|speaker|sound)\b/i, 'l1-teams-001'],
  [/\bteams\b.*(won.?t\s*load|stuck|splash|crash|not\s*open)\b/i, 'l1-teams-002'],
  [/\bonedrive\b.*(not\s*sync|sync\s*stuck|paused|red\s*x)\b/i, 'l1-onedrive-001'],
  // === Networking ===
  [/\b(wi.?fi|wireless)\b.*(not\s*working|no\s*internet|can.?t\s*connect|dropped|drop|keep\s*dropping)\b/i, 'l1-wifi-001'],
  // === Devices / peripherals ===
  [/\bprinter\b.*(not\s*print|stuck|won.?t\s*print|offline|jam|spooler)\b/i, 'l1-printer-001'],
  [/\bbluetooth\b.*(pair|disconnect|cut.?out|won.?t|stuck)\b/i, 'l1-bluetooth-001'],
  [/\b(forgot|reset)\s*password|self.?service|sspr\b/i, 'l1-password-001'],
  // VPN — match BEFORE password (e.g. "vpn keeps disconnecting" must beat "password locked" matcher)
  [/\bvpn\b/i, 'l1-vpn-001'],
  [/\b(cisco\s*anyconnect|globalprotect|fortinet|openvpn|always\s*on\s*vpn|pulse\s*secure|ivanti)\b/i, 'l1-vpn-001'],
  // === Security / phishing ===
  [/\b(suspicious|phishing|scam|sketchy)\s*email\b/i, 'l1-email-001'],
  [/\bemail\b.*(asking\s*for|asks\s*for|wants?\s*my)\s*(password|account|credentials|verify|sign\s*in|ssn|credit\s*card)\b/i, 'l1-email-001'],
  // === L2 enterprise infrastructure (tier-2) ===
  [/\b(domain\s*controllers?|\bDCs?\b.*resolv|repadmin|dcpromo|ntds|fsmo)\b/i, 'l2-active-directory-001'],
  [/\b(account|user)\s*(keeps\s*)?(getting\s*)?lock(ed|out)\s*out?\b/i, 'l2-active-directory-001'],
  [/\bgroup\s*policy\b|\bgpo\b|\bgpupdate\b|\bgpresult\b|\brsop\b|\bevent\s*1058\b|\bevent\s*1030\b/i, 'l2-active-directory-001'],
  [/\b(active\s*directory|\bAD\s*(connect|sync|schema|forest|domain)|schema\s*master|fsmo)\b/i, 'l2-active-directory-001'],
  [/\b(azure\s*ad\s*connect|aad\s*connect|adfs|federation)\b/i, 'l2-azure-ad-001'],
  [/\bconditional\s*access|aadsts5(3003|3000|0053|0126)|access\s*blocked\b/i, 'l2-azure-ad-001'],
  [/\bbitlocker\b.*(recovery|prompt|key|tpm|protector|boot)\b/i, 'l2-bitlocker-001'],
  [/\b(malware|virus|infect|trojan|compromised|ransomware|files?\s*encrypted|ransom\s*note)\b/i, 'l2-malware-001'],
  [/\bdns\b.*(resolution|fail|split.?brain|not\s*resolving|internal\s*hostname)\b/i, 'l2-dns-001'],
  [/\b(can.?t\s*resolve|not\s*resolving|name\s*resolution|internal\s*name|fqdn|hostname.*resolve)\b/i, 'l2-dns-001'],
  [/\b(isp|wan|router|firewall)\b.*\b(change|swap|replace|migration|new)\b/i, 'l2-dns-001'],
  [/\b(dhcp|apipa|169\.254|scope\s*exhaust)\b/i, 'l2-dhcp-001'],
  // === L3 architecture ===
  [/\b(disaster\s*recovery|\brto\b|\brpo\b|veeam|rubrik|3-2-1|tabletop)\b/i, 'l3-disaster-recovery-001'],
  [/\b(raid\s*rebuild|raid\s*fail|disk\s*failure|drive\s*failed|hot\s*swap)\b/i, 'l3-disaster-recovery-001'],
  [/\b(cyber\s*incident|p1\s*incident|breach|kill\s*chain|exfiltration|lateral\s*movement)\b/i, 'l3-security-001'],
  [/\b(sso|saml|oidc|federation|identity\s*provider|jwt|okta\s*entra)\b/i, 'l3-sso-saml-001'],
  // === Generic catch-alls (lower priority — only fire if nothing else did) ===
  [/\b(internet|wi.?fi)\b.*(not\s*working|down|out)\b/i, 'l1-wifi-001'],
];

let CHUNKS_CACHE = null;
let CHUNKS_LOADED_AT = 0;
async function loadChunks() {
  // Cache 1 hour in function memory (warm starts reuse, cold start re-fetches)
  if (CHUNKS_CACHE && (Date.now() - CHUNKS_LOADED_AT) < 3600 * 1000) return CHUNKS_CACHE;
  // Fetch from the public static asset — Netlify serves it at edge, ~50ms global
  const r = await fetch("https://iisupp.net/assets/aria-kb-chunks.json", { headers: { "user-agent": "aria-kb-query/1.0" } });
  if (!r.ok) throw new Error(`KB fetch failed: ${r.status}`);
  CHUNKS_CACHE = await r.json();
  CHUNKS_LOADED_AT = Date.now();
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
