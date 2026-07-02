// vision-diagnose-core.mjs — STAGE 2 "show, don't type" engine (pure, testable, $0, no network)
// ---------------------------------------------------------------------------------------------
// Turns an image/log/PDF/text problem into a structured description, REDACTS PII/secrets, then
// matches it against the existing ARIA KB using the SAME RUN-A token-overlap + routing retriever
// that iisupp.net/aria and aria-kb-query.mjs use — so behaviour is faithful across surfaces.
//
// Powers three surfaces via one engine (spec STAGE-2-VISION-DIAGNOSIS): ARIA web upload/paste,
// ARIA Sentinel "diagnose a screenshot", and the Forums "Ask AI" tab.
//
// 🔒 RULE 14 (honesty): never fabricate a diagnosis. If the top score is below threshold, we
//    ABSTAIN and return the honest "closest guidance + open a discussion / escalate to IIS" path.
// 🔒 PRIVACY-FIRST: redaction runs on any extracted text BEFORE it is returned or sent to any
//    cloud model. What leaves the device is disclosed to the user (see vision-consent.mjs).
//
// This module does ZERO network I/O and imports nothing with side-effects → unit-testable offline.

// ============================ RETRIEVER (ported from aria-kb-query.mjs, RUN-A) ============================
// Routing rules — ORDER MATTERS, first match adds +25. Kept in parity with the live web retriever.
export const ROUTING = [
  [/\b(macbook|imac|mac\s*mini|mac\s*pro|mac\s*os|macos|os\s*x|apple\s*logo|beach\s*ball|kernel\s*panic|rainbow\s*wheel|spinning\s*beach)/i, 'l1-mac-001'],
  [/\bmac\b.*(freeze|crash|restart|hang|slow|wont|boot|start|sleep|wake|stuck|spinning)|mac.*wont\s*(start|boot|turn\s*on)/i, 'l1-mac-001'],
  [/(beach\s*ball|rainbow\s*wheel|spinning\s*beach|stuck\s*on\s*apple|apple\s*logo)/i, 'l1-mac-001'],
  [/\b(teams|msteams|ms\s*teams|microsoft\s*teams)\b/i, 'l1-teams-001'],
  [/\b(teams|microsoft\s*teams)\b.*(crash|stuck|splash|won.?t\s*load|notification|missing\s*message|cant?\s*join|channels?|meeting\s*link|reconnect|call\s*quality)/i, 'l1-teams-002'],
  [/\b(outlook|outlok|outluk|outloook)\b/i, 'l1-outlook-001'],
  [/\b(inbox|emails?|email's|e-mail|signature|email\s*attachment|outlook\s*profile|outlook\s*calendar|outlook\s*rules|outlook\s*search)\b/i, 'l1-outlook-001'],
  [/(cant?\s*send|stuck.*outbox|outbox.*stuck|smtp|unable\s*to\s*send|cant?\s*open\s*email|where\s*did\s*my\s*emails)/i, 'l1-outlook-002'],
  [/\b(one.?drive|on.?drive|onedrive)\b/i, 'l1-onedrive-001'],
  [/(set\s*up\s*one.?drive|shared\s*file.*sync|share\s*with\s*me|file\s*on\s*demand|over\s*quota|sync\s*conflict|files?\s*won.?t\s*sync|files?\s*not\s*syncing|onedrive\s*selective)/i, 'l1-onedrive-001'],
  [/(cant?\s*sign\s*in|password\s*prompt|login\s*loop|aadsts).*\b(office|365|m365)|\b(office|m365|365)\b.*(sign\s*in|login\s*loop|password\s*prompt|licensed|unlicensed)/i, 'l1-m365-001'],
  [/(office|word|excel|powerpoint).*(unlicensed|reduced\s*functionality|activation\s*error|activation\s*fail|not\s*activated|licensing)/i, 'l1-m365-002'],
  [/(blue\s*screen|bsod|stop\s*error|critical_process_died|whea_uncorrectable|memory_management|page_fault|driver_irql|system_thread|ntoskrnl|stop\s*error|0x000000|0x8024|0x80070005|error\s*0x[0-9a-f])/i, 'l1-windows-001'],
  [/(wont?\s*boot|cant?\s*boot|spinning\s*dots|stuck.*logo|stuck.*windows.*logo|black\s*screen|boot\s*loop|bootloop|automatic\s*repair|startup\s*repair|recovery\s*environment|recovery\s*mode|windows\s*won.?t\s*start|servicing\s*stack|cumulative\s*update\s*fail|cannot\s*activate\s*windows|windows\s*update\s*fail|windows\s*update\s*broke|keeps\s*restart)/i, 'l1-windows-002'],
  [/(slow|laggy|sluggish|freezing|takes\s*forever|high\s*cpu|100\s*(percent|%)\s*(cpu|disk|memory)|cpu\s*at\s*100|disk\s*usage|fans?\s*spinning|laptop\s*hot|overheat|memory\s*leak|high\s*memory|slow\s*shutdown|slow\s*startup|svchost|antimalware\s*service|windows\s*search\s*high\s*cpu|system\s*slow|my\s*laptop\s*is\s*slow)/i, 'l1-windows-003'],
  [/(disk\s*full|out\s*of\s*space|low\s*disk|c\s*drive\s*full|storage\s*full|almost\s*full)/i, 'l1-windows-004'],
  [/(no\s*sound|no\s*audio|speakers?\s*not\s*working|speakers?\s*dead|audio\s*not\s*working|sound\s*not\s*working|red\s*x.*speaker)/i, 'l1-windows-005'],
  [/\bapp(lication)?\b.*(wont?\s*open|crash|close|fail|error|hang|freez|not\s*respond)/i, 'l1-windows-006'],
  [/(dns|hostname|fqdn|name\s*resolution|cant?\s*resolve|not\s*resolving|internal\s*site|internal\s*name|switch\s*port|aruba\s*switch|forwarder|split.?brain)/i, 'l2-dns-001'],
  [/(dhcp|apipa|169\.254|scope\s*exhaust|gateway\s*unreachable|ping\s*timeout|traceroute|ip\s*address\s*conflict|ip\s*conflict|route\s*to\s*host)/i, 'l2-dhcp-001'],
  [/\b(wi.?fi|wireless|internet)\b|cant?\s*connect.*(wi.?fi|wireless|internet)|(wi.?fi|wireless).*(not\s*working|no\s*internet|cant?\s*connect|dropped|drop|disconnect|disabled|card\s*missing|adapter|5g\s*network)|(no\s*wifi|no\s*internet|internet\s*down|internet\s*keeps|connected\s*but\s*no\s*internet|network\s*keeps\s*timing|office\s*wifi)/i, 'l1-wifi-001'],
  [/\bprint(er|ing|s|ed|out)?\b/i, 'l1-printer-001'],
  [/(install\s*printer|need\s*printer\s*driver|print\s*queue|clear\s*print|cant?\s*print|print\s*to\s*pdf|jobs?\s*stuck.*queue|spooler)/i, 'l1-printer-001'],
  [/\b(bluetooth|airpod|airpods|jabra|poly\s*headset|bose\s*qc|headset|earbuds)\b/i, 'l1-bluetooth-001'],
  [/(forgot.*password|reset.*password|self.?service|sspr|password\s*(reset|forgot|expired|incorrect|not\s*working|failed)|wrong\s*password|change\s*my\s*password|login\s*wont?\s*work|i.?m\s*locked\s*out|account\s*locked\s*after|need\s*password\s*reset|smart\s*?card|smartcard|cac\s*certificate|piv\s*card)/i, 'l1-password-001'],
  [/\bvpn\b|cisco\s*anyconnect|globalprotect|fortinet|openvpn|always\s*on\s*vpn|pulse\s*secure|ivanti|anyconnect|remote\s*access|vpn\s*tunnel|split\s*tunnel|vpn\s*cert/i, 'l1-vpn-001'],
  [/(phishing|scam|sketchy|suspicious)\s*(email|link|activity|message)|phishing|scam|suspicious\s*email|suspicious\s*link|email.*pretending|fake\s*email/i, 'l1-email-001'],
  [/(malware|virus|infect|trojan|compromised|ransomware|files?\s*encrypted|ransom\s*note|encrypted\s*all|lockbit|virus\s*warning|virus\s*popup|account\s*compromised|someone\s*has\s*access)/i, 'l2-malware-001'],
  [/(mfa\s*bombing|impossible\s*travel|sign.?in\s*from\s*(russia|china)|suspicious\s*activity)/i, 'l3-security-001'],
  [/\b(domain\s*controllers?|repadmin|dcpromo|ntds|fsmo|active\s*directory|ad\s*lockout|ad\s*authentication|account\s*locked\s*in\s*ad|active\s*directory\s*issue)/i, 'l2-active-directory-001'],
  [/group\s*policy|\bgpo\b|\bgpupdate\b|\bgpresult\b|\brsop\b|event\s*1058|event\s*1030/i, 'l2-active-directory-001'],
  [/azure\s*ad\s*connect|aad\s*connect|adfs|federation\s*server|conditional\s*access|aadsts\d+|access\s*blocked/i, 'l2-azure-ad-001'],
  [/\bbitlocker\b|recovery\s*key\s*prompt|tpm.*bitlocker|bitlocker.*tpm|need\s*bitlocker|lost\s*bitlocker|bitlocker\s*recovery|bitlocker\s*locked|bitlocker\s*prompt/i, 'l2-bitlocker-001'],
  [/disaster\s*recovery|\brto\b|\brpo\b|veeam|rubrik|3-2-1|tabletop|raid\s*rebuild|raid\s*fail|disk\s*failure|drive\s*fail|hot\s*swap/i, 'l3-disaster-recovery-001'],
  [/cyber\s*incident|p1\s*incident|\bbreach\b|kill\s*chain|exfiltration|lateral\s*movement/i, 'l3-security-001'],
  [/\bsso\b|\bsaml\b|\boidc\b|federation.*identity|\bjwt\b|okta|entra/i, 'l3-sso-saml-001'],
];

const STOP_WORDS = new Set("a an and are as at be been being but by can could did do does for from get had has have he her him his how i if in into is it its me my no not now of on only or our should so than that the their them then there these they this to too us was we were what when where which who why will with would you your".split(" "));

export function tokenize(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9\s.-]/g, " ").split(/\s+/).filter(t => t && t.length >= 2 && !STOP_WORDS.has(t));
}

// Score one chunk against a query — identical weighting to the live RUN-A retriever.
export function scoreChunk(query, chunk) {
  const qTokens = tokenize(query);
  if (!qTokens.length) return 0;
  const hay = (chunk.title + " " + chunk.slug + " " + (chunk.keywords || []).join(" ") + " " + chunk.content).toLowerCase();
  let s = 0;
  for (const t of qTokens) {
    if (hay.includes(t)) s += 1;
    if (chunk.title && chunk.title.toLowerCase().includes(t)) s += 2;
  }
  const qLower = String(query).toLowerCase();
  if (qLower.length >= 6) {
    for (let i = 0; i < qLower.length - 6; i++) {
      const frag = qLower.slice(i, Math.min(i + 30, qLower.length));
      if (frag.length >= 8 && hay.includes(frag)) { s += 4; break; }
    }
  }
  for (const [regex, articleId] of ROUTING) {
    if (regex.test(query) && chunk.slug.startsWith(articleId)) { s += 25; break; }
  }
  return s;
}

// Abstain threshold — kept aligned with aria-kb-query.mjs / Sentinel (raised 2026-06-23).
export const CONFIDENCE_THRESHOLD = 8;

export function confidenceLabel(score) {
  if (score >= 25) return 'high';
  if (score >= 12) return 'medium';
  if (score >= CONFIDENCE_THRESHOLD) return 'low';
  return 'abstain';
}

// ============================ PII / SECRET REDACTION (privacy-first) ============================
// Diagnostic-relevant, non-PII IPs we intentionally KEEP (loopback/APIPA/broadcast) — they help
// the DHCP/DNS routing and contain no personal info.
const IP_ALLOWLIST = /^(127\.0\.0\.1|0\.0\.0\.0|255\.255\.255\.255|169\.254\.\d{1,3}\.\d{1,3})$/;

// Order matters: most specific / highest-risk first so a secret is never left partially matched.
const REDACTORS = [
  ['SECRET', /\b(gh[pousr]_[A-Za-z0-9]{16,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,})\b/g],
  ['SECRET', /\b(?:bearer|authorization|api[_-]?key|access[_-]?token|secret|passw(?:or)?d|pwd)\b\s*[:=]\s*["']?([^\s"'\r\n]{4,})/gi],
  ['EMAIL', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g],
  ['CARD', /\b(?:\d[ -]?){13,16}\b/g],
  ['SSN', /\b\d{3}-\d{2}-\d{4}\b/g],
  ['MAC', /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g],
  ['IPV6', /\b(?:[0-9A-Fa-f]{1,4}:){2,7}[0-9A-Fa-f]{1,4}\b/g],
  ['IP', /\b(?:\d{1,3}\.){3}\d{1,3}\b/g],
  ['WINUSER', /([A-Za-z]:\\Users\\)[^\\\/\r\n"']+/g],
  ['UNC', /\\\\[A-Za-z0-9._-]+\\[^\s"'\r\n]+/g],
  ['PHONE', /(?<!\d)(?:\+?\d[\d ()-]{8,}\d)(?!\d)/g],
];

// Redact PII/secrets from text. Returns { redacted, found:[{type,count}], count } — a report the
// UI shows the user ("we removed N emails / M secrets before analysis"). CARD uses a light Luhn
// filter to avoid nuking long numeric error codes.
export function redactPII(input) {
  let text = String(input || '');
  const found = {};
  for (const [type, re] of REDACTORS) {
    text = text.replace(re, (m, g1) => {
      if (type === 'IP' && IP_ALLOWLIST.test(m)) return m;               // keep diagnostic IPs
      if (type === 'IP') { const bad = m.split('.').some(o => +o > 255); if (bad) return m; }
      if (type === 'CARD' && !luhnish(m)) return m;                       // avoid false positives
      if (type === 'PHONE') { const digits = m.replace(/\D/g, ''); if (digits.length < 9 || digits.length > 15) return m; }
      found[type] = (found[type] || 0) + 1;
      // For key=value secrets, keep the key label, redact only the value.
      if ((type === 'SECRET') && g1 && /[:=]/.test(m)) return m.slice(0, m.length - g1.length) + '[REDACTED_SECRET]';
      if (type === 'WINUSER') return g1 + '[REDACTED_USER]';
      return `[REDACTED_${type}]`;
    });
  }
  const list = Object.keys(found).map(type => ({ type, count: found[type] }));
  const total = list.reduce((n, x) => n + x.count, 0);
  return { redacted: text, found: list, count: total };
}

function luhnish(s) {
  const d = s.replace(/\D/g, '');
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0, alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = +d[i];
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}

// ============================ SIGNAL EXTRACTION ============================
// Pull the high-value tokens (error codes, bugcheck names, app/service names) that most improve
// retrieval. These get appended to the description so the ROUTING table fires reliably.
const APP_HINTS = ['outlook','teams','onedrive','word','excel','powerpoint','office','m365','365','chrome','edge','printer','wifi','wi-fi','wireless','vpn','bitlocker','bluetooth','windows','onenote','sharepoint','azure','active directory'];

export function extractSignals(text) {
  const t = String(text || '');
  const hexCodes = (t.match(/\b0x[0-9A-Fa-f]{4,8}\b/g) || []);
  const bugchecks = (t.match(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+){1,}\b/g) || []).filter(w => w.length >= 8 && w.length <= 40);
  const apps = APP_HINTS.filter(a => new RegExp('\\b' + a.replace(/[-\/]/g, '.?') + '\\b', 'i').test(t));
  return {
    codes: [...new Set(hexCodes.map(c => c.toLowerCase()))].slice(0, 8),
    bugchecks: [...new Set(bugchecks)].slice(0, 8),
    apps: [...new Set(apps)].slice(0, 8),
  };
}

// ============================ DESCRIPTION BUILDER ============================
// kind: 'text' | 'log' | 'pdf' | 'image'
//   text/log/pdf → `text` is the raw extracted content (we redact it here).
//   image        → `visionText` is Fable-5's already-redacted description of the picture.
// Returns { query, redaction, signals, description } — `query` is what the retriever scores.
export function buildProblemDescription({ kind, text = '', visionText = '', filename = '' }) {
  let base, redaction;
  if (kind === 'image') {
    // Vision text is redacted by the caller before it reaches us, but redact again defensively.
    const r = redactPII(visionText);
    base = r.redacted; redaction = r;
  } else {
    const r = redactPII(text);
    base = r.redacted; redaction = r;
  }
  const signals = extractSignals(base + ' ' + filename);
  const signalTail = [...signals.codes, ...signals.bugchecks, ...signals.apps].join(' ');
  // Cap the base so a giant log doesn't drown the routing signal; keep the first 4000 chars.
  const description = (base.slice(0, 4000) + ' ' + signalTail).trim();
  return { query: description, redaction, signals, description };
}

// ============================ DIAGNOSE ============================
// Run the retriever over the KB chunks. Returns a Rule-14-honest result:
//   match=true  → { article, excerpt, confidence, confidenceLabel }
//   match=false → { abstain:true, reason } with the honest fallback path handled by the caller.
export function diagnose(query, chunks, opts = {}) {
  const threshold = opts.threshold ?? CONFIDENCE_THRESHOLD;
  if (!query || String(query).trim().length < 2 || !Array.isArray(chunks) || !chunks.length) {
    return { match: false, abstain: true, confidence: 0, confidenceLabel: 'abstain', reason: 'empty-input' };
  }
  const scored = chunks
    .map(c => ({ chunk: c, score: scoreChunk(query, c) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (!top || top.score < threshold) {
    return {
      match: false, abstain: true,
      confidence: top ? top.score : 0,
      confidenceLabel: 'abstain',
      reason: 'below-threshold',
      closest: top ? { slug: top.chunk.slug, title: top.chunk.title || top.chunk.slug } : null,
    };
  }
  let content = stripFrontmatter(top.chunk.content || '');
  if (content.length > 4000) content = content.slice(0, 4000) + '\n…[truncated — see iisupp.net/aria for full article]';
  return {
    match: true, abstain: false,
    confidence: top.score,
    confidenceLabel: confidenceLabel(top.score),
    article: {
      slug: top.chunk.slug,
      title: top.chunk.title || top.chunk.slug.replace(/-/g, ' '),
      tier: top.chunk.tier,
      vertical: top.chunk.vertical,
      url: `https://iisupp.net/aria?article=${encodeURIComponent(top.chunk.slug)}`,
    },
    excerpt: content,
    runnerUp: scored[1] ? { slug: scored[1].chunk.slug, score: scored[1].score } : null,
  };
}

function stripFrontmatter(s) {
  if (!s) return s;
  const m = String(s).match(/^---\s*\n[\s\S]*?\n---\s*\n([\s\S]*)$/);
  return m ? m[1].trim() : s;
}

// One-call convenience used by the function + tests: description → diagnosis.
export function diagnoseInput({ kind, text, visionText, filename, chunks, threshold }) {
  const built = buildProblemDescription({ kind, text, visionText, filename });
  const result = diagnose(built.query, chunks, { threshold });
  return { ...result, redaction: built.redaction, signals: built.signals };
}
