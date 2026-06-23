import { getStore } from '@netlify/blobs';

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
  // === Mac-specific FIRST (must beat BSOD on kernel-panic) ===
  [/\b(macbook|imac|mac\s*mini|mac\s*pro|mac\s*os|macos)\b.*(kernel\s*panic|beach\s*ball|rainbow\s*wheel|spinning|freez|restart|crash|sleep|wake)/i, 'l1-mac-001'],
  [/(kernel\s*panic|beach\s*ball|rainbow\s*wheel|spinning\s*beach)/i, 'l1-mac-001'],
  [/(mac\s*was\s*restarted|computer\s*was\s*restarted\s*because)/i, 'l1-mac-001'],
  [/\bmac(book)?\b.*\bwifi\b|\bwifi\b.*\bmac(book)?\b/i, 'l1-wifi-001'],
  // === Teams BEFORE windows-audio (so "teams + audio" wins teams) ===
  [/\bteams\b.*(no\s*audio|cant?\s*hear|hear\s*any|mic\b|microphone|speaker|sound)|hear\s*any.*teams/i, 'l1-teams-001'],
  [/\bteams\b.*(won.?t\s*load|stuck|splash|crash|not\s*open|on\s*launch)|teams\s*crash/i, 'l1-teams-002'],
  // === Outlook BEFORE generic windows ===
  [/\boutlook\b.*(not\s*receiv|missing\s*email|inbox\s*not\s*updat|inbox.*update|stuck|offline)|outlook.*receiv|inbox.*outlook/i, 'l1-outlook-001'],
  [/\boutlook\b.*(cant?\s*send|stuck.*outbox|outbox.*stuck|smtp|unable\s*to\s*send|send\s*fail)|smtp.*outlook|outlook.*smtp/i, 'l1-outlook-002'],
  // === OneDrive BEFORE generic ===
  [/\bonedrive\b/i, 'l1-onedrive-001'],
  // === M365 / Office ===
  [/(cant?\s*sign\s*in|password\s*prompt|login\s*loop|aadsts).*\b(office|365|m365)|\b(office|m365|365)\b.*(sign\s*in|login\s*loop|password\s*prompt)/i, 'l1-m365-001'],
  [/(office|word|excel|powerpoint|outlook).*(unlicensed|reduced\s*functionality|activation\s*error|activation\s*fail|not\s*activated)/i, 'l1-m365-002'],
  // === Windows BSOD — actual stop-error terms ===
  [/(blue\s*screen|bsod|stop\s*error|critical_process_died|whea_uncorrectable|memory_management|page_fault_in_nonpaged_area|driver_irql|system_thread|ntoskrnl)/i, 'l1-windows-001'],
  // === Windows boot ===
  [/(wont?\s*boot|cant?\s*boot|spinning\s*dots|stuck.*logo|stuck.*windows.*logo|black\s*screen|boot\s*loop|automatic\s*repair|startup\s*repair|recovery\s*environment)/i, 'l1-windows-002'],
  // === Windows performance ===
  [/(slow|laggy|sluggish|freezing|takes\s*forever|high\s*cpu|100\s*(percent|%)\s*(cpu|disk|memory)|cpu\s*at\s*100|disk\s*usage\s*100)/i, 'l1-windows-003'],
  // === Windows disk ===
  [/(disk\s*full|out\s*of\s*space|low\s*disk|c\s*drive\s*full|storage\s*full|almost\s*full|disk\s*almost\s*full|low\s*storage|cleanmgr)/i, 'l1-windows-004'],
  // === Windows audio (after teams to avoid override) ===
  [/(no\s*sound|no\s*audio|speakers?\s*not\s*working|speakers?\s*dead|audio\s*not\s*working|sound\s*not\s*working|red\s*x.*speaker|speaker.*red\s*x)/i, 'l1-windows-005'],
  // === Windows app crashes (variants) ===
  [/\bapp(lication)?\b.*(wont?\s*open|crash|close|fail|error|hang|freez|not\s*respond)|app.*not\s*respond|(crash|fail|error).*\bapp/i, 'l1-windows-006'],
  // === Networking ===
  [/\b(wi.?fi|wireless)\b|cant?\s*connect.*(wi.?fi|wireless|internet)|(wi.?fi|wireless).*(not\s*working|no\s*internet|cant?\s*connect|dropped|drop|disconnect)/i, 'l1-wifi-001'],
  // === Devices / peripherals ===
  [/\bprinter\b.*(not\s*print|stuck|wont?\s*print|offline|jam|spooler|queue)|print\s*queue|spooler/i, 'l1-printer-001'],
  [/\bbluetooth\b/i, 'l1-bluetooth-001'],
  [/forgot.*password|reset.*password|self.?service|sspr|password\s*(reset|forgot|expired)|cant?.*sign\s*in.*password/i, 'l1-password-001'],
  // === VPN ===
  [/\bvpn\b|cisco\s*anyconnect|globalprotect|fortinet|openvpn|always\s*on\s*vpn|pulse\s*secure|ivanti|anyconnect/i, 'l1-vpn-001'],
  // === Security / phishing ===
  [/(suspicious|phishing|scam|sketchy)\s*email|phishing|scam\s*(email|message)|email.*pretending|fake\s*email/i, 'l1-email-001'],
  [/\bemail\b.*(asking|asks|wants?).*\b(password|account|credentials|verify|sign\s*in|ssn|credit\s*card)/i, 'l1-email-001'],
  // === L2 AD/GPO ===
  [/(domain\s*controllers?|\bDCs?\b.*resolv|repadmin|dcpromo|ntds|fsmo|schema\s*master)/i, 'l2-active-directory-001'],
  [/(account|user)\s*(keeps\s*)?(getting\s*)?lock(ed|out|s\s*out)|account.*lock.*out|locked\s*out\s*repeat/i, 'l2-active-directory-001'],
  [/group\s*policy|\bgpo\b|\bgpupdate\b|\bgpresult\b|\brsop\b|event\s*1058|event\s*1030|event\s*5719/i, 'l2-active-directory-001'],
  [/active\s*directory|\bAD\s*(connect|sync|schema|forest|domain|replication)|replication\s*fail/i, 'l2-active-directory-001'],
  // === L2 Azure AD ===
  [/azure\s*ad\s*connect|aad\s*connect|adfs|federation\s*server|federation\s*broken/i, 'l2-azure-ad-001'],
  [/conditional\s*access|aadsts\d+|access\s*blocked|sign\s*in\s*blocked/i, 'l2-azure-ad-001'],
  // === L2 BitLocker ===
  [/\bbitlocker\b|recovery\s*key\s*prompt|tpm.*bitlocker|bitlocker.*tpm/i, 'l2-bitlocker-001'],
  // === L2 Malware/Ransomware ===
  [/malware|virus|infect|trojan|compromised|ransomware|files?\s*encrypted|ransom\s*note|encrypted\s*all/i, 'l2-malware-001'],
  // === L2 DNS ===
  [/\bdns\b.*(resolution|fail|split.?brain|not\s*resolving|internal|hostname|forwarder)|split.?brain.*dns/i, 'l2-dns-001'],
  [/(cant?\s*resolve|not\s*resolving|name\s*resolution|internal\s*name|fqdn|hostname.*resolve)/i, 'l2-dns-001'],
  [/(isp|wan|router|firewall).*(change|swap|replace|migration|new)/i, 'l2-dns-001'],
  // === L2 DHCP ===
  [/\bdhcp\b|apipa|169\.254|scope\s*exhaust/i, 'l2-dhcp-001'],
  // === L3 DR ===
  [/disaster\s*recovery|\brto\b|\brpo\b|veeam|rubrik|3-2-1|tabletop|backup\s*fail/i, 'l3-disaster-recovery-001'],
  [/raid\s*rebuild|raid\s*fail|disk\s*failure|drive\s*fail|hot\s*swap/i, 'l3-disaster-recovery-001'],
  // === L3 Security ===
  [/cyber\s*incident|p1\s*incident|\bbreach\b|kill\s*chain|exfiltration|lateral\s*movement/i, 'l3-security-001'],
  // === L3 SSO ===
  [/\bsso\b|\bsaml\b|\boidc\b|federation.*identity|\bjwt\b|okta|entra/i, 'l3-sso-saml-001'],
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

// Live KB — chunks the aria-learning-cron has promoted to the 'aria-kb-live' Netlify Blobs
// store. These never made it into the static aria-kb-chunks.json (that file is built from
// local /knowledge-base markdown only). Merging both means cron-promoted chunks become
// searchable within minutes of promotion, not the next manual export+commit+deploy cycle.
let LIVE_CACHE = null;
let LIVE_LOADED_AT = 0;
async function loadLiveChunks() {
  if (LIVE_CACHE && (Date.now() - LIVE_LOADED_AT) < 600 * 1000) return LIVE_CACHE; // 10min cache
  try {
    const store = getStore({ name: 'aria-kb-live', consistency: 'eventual' });
    const idx = await store.get('kb-index.json', { type: 'json' });
    if (!idx || !Array.isArray(idx.entries)) { LIVE_CACHE = []; LIVE_LOADED_AT = Date.now(); return LIVE_CACHE; }
    // Convert entries → chunk format aria-kb-query already scores
    const chunks = [];
    for (const e of idx.entries) {
      if (!e || !e.promoted) continue; // only promoted survive (passes vet gate)
      // Pull the actual body
      let body = '';
      try { const d = await store.get(e.key, { type: 'json' }); body = (d && d.body) || ''; } catch (_) {}
      if (!body || body.length < 25) continue;
      chunks.push({
        slug: e.key,
        title: e.topic || e.key.replace(/^learn-/, '').replace(/-/g, ' '),
        content: String(body).slice(0, 3500),
        keywords: [],
        tier: 'learn',
        vertical: 'learned',
        added_at: e.t ? new Date(e.t).toISOString() : null,
        _live: true
      });
    }
    LIVE_CACHE = chunks;
    LIVE_LOADED_AT = Date.now();
    return LIVE_CACHE;
  } catch (err) {
    // Live KB unavailable (Blobs down or unconfigured) — don't fail the query, just skip
    LIVE_CACHE = [];
    LIVE_LOADED_AT = Date.now();
    return LIVE_CACHE;
  }
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
  const staticChunks = data.chunks || [];
  const liveChunks = await loadLiveChunks();
  const chunks = [...staticChunks, ...liveChunks];

  const scored = chunks.map(c => ({ chunk: c, score: score(query, c) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  const top = scored[0];

  if (!top || top.score < 8) {  // raised 2026-06-23 — align with Sentinel threshold
    return json(200, { match: false, confidence: top ? top.score : 0, source: "aria-kb-public", meta: { kb_generated_at: data.generated_at || null, total_chunks: chunks.length, static_chunks: staticChunks.length, live_chunks: liveChunks.length, cache_age_ms: Date.now() - CHUNKS_LOADED_AT } });
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
    content_excerpt: content,
    meta: {
      kb_generated_at: data.generated_at || null,
      total_chunks: chunks.length,
      static_chunks: staticChunks.length,
      live_chunks: liveChunks.length,
      cache_age_ms: Date.now() - CHUNKS_LOADED_AT
    }
  });
}

export const config = { path: "/.netlify/functions/aria-kb-query" };
