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
  // === Mac-specific (must beat BSOD on kernel-panic, beach-ball) ===
  [/\b(macbook|imac|mac\s*mini|mac\s*pro|mac\s*os|macos|os\s*x|apple\s*logo|beach\s*ball|kernel\s*panic|rainbow\s*wheel|spinning\s*beach)/i, 'l1-mac-001'],
  [/\bmac\b.*(freeze|crash|restart|hang|slow|wont|boot|start|sleep|wake|stuck|spinning)|mac.*wont\s*(start|boot|turn\s*on)/i, 'l1-mac-001'],
  [/(beach\s*ball|rainbow\s*wheel|spinning\s*beach|stuck\s*on\s*apple|apple\s*logo)/i, 'l1-mac-001'],
  // === Teams (broader) ===
  [/\b(teams|msteams|ms\s*teams|microsoft\s*teams)\b/i, 'l1-teams-001'],
  [/\b(teams|microsoft\s*teams)\b.*(crash|stuck|splash|won.?t\s*load|notification|missing\s*message|cant?\s*join|channels?|meeting\s*link|reconnect|call\s*quality)/i, 'l1-teams-002'],
  // === Outlook / Mail (much broader — corpus uses "outlok", "inbox", "email") ===
  [/\b(outlook|outlok|outluk|outloook)\b/i, 'l1-outlook-001'],
  [/\b(inbox|emails?|email's|e-mail|signature|email\s*attachment|outlook\s*profile|outlook\s*calendar|outlook\s*rules|outlook\s*search)\b/i, 'l1-outlook-001'],
  [/(cant?\s*send|stuck.*outbox|outbox.*stuck|smtp|unable\s*to\s*send|cant?\s*open\s*email|where\s*did\s*my\s*emails)/i, 'l1-outlook-002'],
  // === OneDrive (already strong, add coverage) ===
  [/\b(one.?drive|on.?drive|onedrive)\b/i, 'l1-onedrive-001'],
  [/(set\s*up\s*one.?drive|shared\s*file.*sync|share\s*with\s*me|file\s*on\s*demand|over\s*quota|sync\s*conflict|files?\s*won.?t\s*sync|files?\s*not\s*syncing|onedrive\s*selective)/i, 'l1-onedrive-001'],
  // === M365 / Office activation ===
  [/(cant?\s*sign\s*in|password\s*prompt|login\s*loop|aadsts).*\b(office|365|m365)|\b(office|m365|365)\b.*(sign\s*in|login\s*loop|password\s*prompt|licensed|unlicensed)/i, 'l1-m365-001'],
  [/(office|word|excel|powerpoint).*(unlicensed|reduced\s*functionality|activation\s*error|activation\s*fail|not\s*activated|licensing)/i, 'l1-m365-002'],
  // === Windows BSOD / boot / system errors (broader — corpus has many variants) ===
  [/(blue\s*screen|bsod|stop\s*error|critical_process_died|whea_uncorrectable|memory_management|page_fault|driver_irql|system_thread|ntoskrnl|stop\s*error|0x000000|0x8024|0x80070005|error\s*0x[0-9a-f])/i, 'l1-windows-001'],
  [/(wont?\s*boot|cant?\s*boot|spinning\s*dots|stuck.*logo|stuck.*windows.*logo|black\s*screen|boot\s*loop|bootloop|automatic\s*repair|startup\s*repair|recovery\s*environment|recovery\s*mode|windows\s*won.?t\s*start|servicing\s*stack|cumulative\s*update\s*fail|cannot\s*activate\s*windows|windows\s*update\s*fail|windows\s*update\s*broke|keeps\s*restart)/i, 'l1-windows-002'],
  // === Windows performance (broader) ===
  [/(slow|laggy|sluggish|freezing|takes\s*forever|high\s*cpu|100\s*(percent|%)\s*(cpu|disk|memory)|cpu\s*at\s*100|disk\s*usage|fans?\s*spinning|laptop\s*hot|overheat|memory\s*leak|high\s*memory|slow\s*shutdown|slow\s*startup|sluggish|laggy\s*machine|disk\s*100%|svchost|antimalware\s*service|windows\s*search\s*high\s*cpu|laptop\s*takes\s*forever|computer\s*is\s*sluggish|system\s*slow|my\s*laptop\s*is\s*slow)/i, 'l1-windows-003'],
  [/(disk\s*full|out\s*of\s*space|low\s*disk|c\s*drive\s*full|storage\s*full|almost\s*full)/i, 'l1-windows-004'],
  // === Windows audio ===
  [/(no\s*sound|no\s*audio|speakers?\s*not\s*working|speakers?\s*dead|audio\s*not\s*working|sound\s*not\s*working|red\s*x.*speaker)/i, 'l1-windows-005'],
  [/\bapp(lication)?\b.*(wont?\s*open|crash|close|fail|error|hang|freez|not\s*respond)/i, 'l1-windows-006'],
  // === Networking (much broader — corpus has DNS/DHCP/gateway/ping terms) ===
  [/(dns|hostname|fqdn|name\s*resolution|cant?\s*resolve|not\s*resolving|internal\s*site|internal\s*name|switch\s*port|aruba\s*switch|forwarder|split.?brain)/i, 'l2-dns-001'],
  [/(dhcp|apipa|169\.254|scope\s*exhaust|gateway\s*unreachable|ping\s*timeout|traceroute|ip\s*address\s*conflict|ip\s*conflict|route\s*to\s*host)/i, 'l2-dhcp-001'],
  // === Wi-Fi (broader) ===
  [/\b(wi.?fi|wireless|internet)\b|cant?\s*connect.*(wi.?fi|wireless|internet)|(wi.?fi|wireless).*(not\s*working|no\s*internet|cant?\s*connect|dropped|drop|disconnect|disabled|card\s*missing|adapter|5g\s*network)|(no\s*wifi|no\s*internet|internet\s*down|internet\s*keeps|connected\s*but\s*no\s*internet|network\s*keeps\s*timing|office\s*wifi)/i, 'l1-wifi-001'],
  // === Printer (much broader — accept just "print" verb or "printer" noun) ===
  [/\bprint(er|ing|s|ed|out)?\b/i, 'l1-printer-001'],
  [/(install\s*printer|need\s*printer\s*driver|print\s*queue|clear\s*print|cant?\s*print|print\s*to\s*pdf|jobs?\s*stuck.*queue|spooler)/i, 'l1-printer-001'],
  // === Bluetooth (broader — include device brand names) ===
  [/\b(bluetooth|airpod|airpods|jabra|poly\s*headset|bose\s*qc|headset|earbuds)\b/i, 'l1-bluetooth-001'],
  // === Password (broader — corpus has many phrasings) ===
  [/(forgot.*password|reset.*password|self.?service|sspr|password\s*(reset|forgot|expired|incorrect|not\s*working|failed)|wrong\s*password|wrong\s*passwrd|change\s*my\s*password|need\s*to\s*change\s*password|login\s*wont?\s*work|i.?m\s*locked\s*out|help.*locked\s*out|account\s*locked\s*after|need\s*password\s*reset|reset\s*password\s*for|it\s*says\s*password|smart\s*?card|smartcard|cac\s*certificate|piv\s*card)/i, 'l1-password-001'],
  // === VPN ===
  [/\bvpn\b|cisco\s*anyconnect|globalprotect|fortinet|openvpn|always\s*on\s*vpn|pulse\s*secure|ivanti|anyconnect|remote\s*access|vpn\s*tunnel|split\s*tunnel|vpn\s*cert/i, 'l1-vpn-001'],
  // === Security / phishing / malware (broader — corpus has many threat phrasings) ===
  [/(phishing|scam|sketchy|suspicious)\s*(email|link|activity|message)|phishing|scam|suspicious\s*email|phishing\s*scam|suspicious\s*link|got\s*a\s*phishing|clicked\s*a\s*phishing|email.*pretending|fake\s*email/i, 'l1-email-001'],
  [/(malware|virus|infect|trojan|compromised|ransomware|files?\s*encrypted|ransom\s*note|encrypted\s*all|lockbit|virus\s*warning|virus\s*popup|account\s*compromised|someone\s*has\s*access|ransomware\s*on)/i, 'l2-malware-001'],
  [/(mfa\s*bombing|impossible\s*travel|sign.?in\s*from\s*(russia|china)|suspicious\s*activity)/i, 'l3-security-001'],
  // === AD / GPO (broader — corpus has many AD phrasings) ===
  [/\b(domain\s*controllers?|\bDCs?\b.*resolv|repadmin|dcpromo|ntds|fsmo|active\s*directory|\bAD\b\s*(connect|sync|schema|forest|domain|replication|lockout|authentication|password\s*reset|account\s*locked|issue|replication\s*issue)|ad\s*lockout|ad\s*authentication|ad\s*password\s*reset|locked\s*out\s*in\s*domain|account\s*locked\s*in\s*ad|domain\s*account\s*is\s*locked|active\s*directory\s*issue|active\s*directory\s*account)/i, 'l2-active-directory-001'],
  [/group\s*policy|\bgpo\b|\bgpupdate\b|\bgpresult\b|\brsop\b|event\s*1058|event\s*1030/i, 'l2-active-directory-001'],
  // === Azure ===
  [/azure\s*ad\s*connect|aad\s*connect|adfs|federation\s*server|conditional\s*access|aadsts\d+|access\s*blocked/i, 'l2-azure-ad-001'],
  // === BitLocker ===
  [/\bbitlocker\b|recovery\s*key\s*prompt|tpm.*bitlocker|bitlocker.*tpm|need\s*bitlocker|lost\s*bitlocker|bitlocker\s*recovery|bitlocker\s*locked|bitlocker\s*prompt/i, 'l2-bitlocker-001'],
  // === L3 architecture ===
  [/disaster\s*recovery|\brto\b|\brpo\b|veeam|rubrik|3-2-1|tabletop|raid\s*rebuild|raid\s*fail|disk\s*failure|drive\s*fail|hot\s*swap/i, 'l3-disaster-recovery-001'],
  [/cyber\s*incident|p1\s*incident|\bbreach\b|kill\s*chain|exfiltration|lateral\s*movement/i, 'l3-security-001'],
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

  // Strip YAML frontmatter if present (chunks built from markdown sometimes ship it leading)
  function stripFrontmatter(s) {
    if (!s) return s;
    const m = String(s).match(/^---\s*\n[\s\S]*?\n---\s*\n([\s\S]*)$/);
    return m ? m[1].trim() : s;
  }
  // Trim content for response
  let content = stripFrontmatter(top.chunk.content || "");
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
