// ARIA KB retrieval — pure ESM, runs in Node and modern browsers.
// Implements the contract from /knowledge-base/_meta/AI-INTEGRATION-GUIDE.md:
//   1. classify(query)  → { level_hint, audience, sensitive }
//   2. retrieve(query)  → top-K articles (deterministic routing + token overlap)
//   3. (rendering done by caller — never expose §10 to non-admin audiences)

// ─── Hard routing rules (from /knowledge-base/_meta/routing.md) ────────────────
// Each rule: [regex, articleId]. Matches add a +25 score boost so the routed
// article almost always wins over generic token overlap. First match wins per id.
const ROUTING = [
  [/\b(blue\s*screen|bsod|stop\s*error|kernel\s*panic|critical_process_died|whea_uncorrectable)\b/i, 'l1-windows-001'],
  [/\b(won.?t\s*boot|can.?t\s*boot|spinning\s*dots|stuck\s*on\s*logo|black\s*screen|boot\s*loop|automatic\s*repair)\b/i, 'l1-windows-002'],
  [/\b(slow|laggy|sluggish|freezing|takes\s*forever|high\s*cpu|100%\s*disk)\b.*\b(pc|computer|laptop|machine|mac)?\b/i, 'l1-windows-003'],
  [/\b(disk\s*full|out\s*of\s*space|low\s*disk|c\s*drive\s*full|storage\s*full)\b/i, 'l1-windows-004'],
  [/\b(no\s*sound|no\s*audio|speakers?\s*not\s*working|red\s*x\s*speaker)\b/i, 'l1-windows-005'],
  [/\b(app\s*won.?t\s*open|app\s*crash|app\s*closes?\s*immediately|application\s*error)\b/i, 'l1-windows-006'],
  [/\b(can.?t\s*sign\s*in|password\s*prompt|login\s*loop|aadsts)\b.*\b(office|365|m365)\b/i, 'l1-m365-001'],
  [/\b(office|m365).*(can.?t\s*sign\s*in|password\s*prompt)\b/i, 'l1-m365-001'],
  [/\b(office|word|excel)\b.*(unlicensed|reduced\s*functionality|activation|product\s*deactivated|subscription\s*expired)\b/i, 'l1-m365-002'],
  [/\boutlook\b.*(not\s*receiv|missing\s*email|inbox\s*not\s*updat|stuck|offline|i.?m\s*offline|says.*offline)\b/i, 'l1-outlook-001'],
  [/\boutlook\b.*(can.?t\s*send|stuck\s*in\s*outbox|smtp|unable\s*to\s*send)\b/i, 'l1-outlook-002'],
  [/\bteams\b.*(no\s*audio|can.?t\s*hear|hear\s*me|mic|microphone|speaker|sound)\b/i, 'l1-teams-001'],
  [/\b(mic|microphone)\b.*\bteams\b/i, 'l1-teams-001'],
  [/\bteams\b.*(won.?t\s*load|stuck|splash|crash|not\s*open)\b/i, 'l1-teams-002'],
  [/\bonedrive\b.*(not\s*sync|sync\s*stuck|paused|looking\s*for\s*changes|red\s*x)\b/i, 'l1-onedrive-001'],
  [/\b(restore|recover)\s*(deleted|previous)|version\s*history|recycle\s*bin\b/i, 'l1-onedrive-002'],
  [/\bonedrive\b.*(duplicate|conflict|two\s*copies|computer\s*copy)\b/i, 'l1-onedrive-003'],
  [/\b(wi.?fi|wireless)\b.*(not\s*working|yellow\s*triangle|no\s*internet|secured|can.?t\s*connect|dropped)\b/i, 'l1-wifi-001'],
  [/\bprinter\b.*(not\s*print|stuck|won.?t\s*print|offline|jam|spooler)\b/i, 'l1-printer-001'],
  [/\bprinter\b.*(garble|garbage|symbols|wrong\s*characters|gibberish)\b/i, 'l1-printer-002'],
  [/\b(lost|new)\s+phone\b.*\b(mfa|2fa|authenticator)\b/i, 'l1-mfa-001'],
  [/\b(mfa|2fa|authenticator)\b.*\b(lost|new)\s+phone\b/i, 'l1-mfa-001'],
  [/\b(mfa|2fa|two.?factor|authenticator)\b.*(setup|recovery|reset|locked\s*out)\b/i, 'l1-mfa-001'],
  [/\b(forgot|reset)\s*password|self.?service|sspr|reset\s*link\b/i, 'l1-password-001'],
  [/\bvpn\b.*(won.?t\s*connect|disconnect|timeout|drop|not\s*connecting)\b/i, 'l1-vpn-001'],
  [/\b(cisco\s*anyconnect|globalprotect|fortinet|openvpn|always\s*on\s*vpn)\b/i, 'l1-vpn-001'],
  [/\bbrowser\b.*(won.?t\s*load|cert|crash|certificate|err_cert|connection\s*not\s*private)\b/i, 'l1-browser-001'],
  [/\b(this\s*site\s*can.?t\s*be\s*reached|err_cert|net::err)\b/i, 'l1-browser-001'],
  [/\b(webcam|web\s*cam)\b/i, 'l1-webcam-001'],
  [/\bcamera\b.*(not\s*work|not\s*detect|black\s*screen|in\s*use|won.?t\s*turn\s*on)\b/i, 'l1-webcam-001'],
  [/\bbluetooth\b.*(pair|disconnect|cut.?out|won.?t|stuck)\b/i, 'l1-bluetooth-001'],
  [/\b(airpods|jabra|bose)\b.*(disconnect|won.?t|cut|drop)\b/i, 'l1-bluetooth-001'],
  [/\b(usb|usb-c|thunderbolt)\b.*(not\s*recogniz|unknown\s*device|malfunction|won.?t\s*work)\b/i, 'l1-usb-001'],
  [/\bunknown\s*device|code\s*43\b/i, 'l1-usb-001'],
  [/\b(kernel\s*panic|spinning\s*beach\s*ball|rainbow\s*wheel|mac\s*restart|mac\s*frozen|computer\s*was\s*restarted\s*because)\b/i, 'l1-mac-001'],
  [/\b(suspicious|phishing|scam|sketchy)\s*email\b/i, 'l1-email-001'],
  [/\bemail\b.*(asking\s*for|asks\s*for|wants?\s*my)\s*(password|account|credentials|verify|sign\s*in|ssn|credit\s*card)\b/i, 'l1-email-001'],
  [/\b(got\s*an?\s*email|email\s*from)\b.*\b(chase|amazon|paypal|apple|microsoft|google|bank)\b.*\b(password|verify|account|sign\s*in|click)\b/i, 'l1-email-001'],
  [/\b(account|user)\s*(keeps\s*)?(getting\s*)?lock(ed|out)\s*out?\b/i, 'l2-active-directory-001'],
  [/\brepeating\s*lockout|account\s*lockout|4740\s*event\b/i, 'l2-active-directory-001'],
  [/\bconditional\s*access|aadsts5(3003|3000|0053|0126)|access\s*blocked|compliant\s*device\s*required\b/i, 'l2-azure-ad-001'],
  [/\bbitlocker\b.*(recovery|prompt|key|tpm|protector)\b/i, 'l2-bitlocker-001'],
  [/\b(malware|virus|infect|trojan|compromised|quarantine)\b/i, 'l2-malware-001'],
  [/\bransomware|files?\s*encrypted|\.locked|\.crypted|ransom\s*note\b/i, 'l2-malware-001'],
  [/\bdns\b.*(resolution|fail|split.?brain|not\s*resolving)\b/i, 'l2-dns-001'],
  [/\b(dhcp|apipa|169\.254|scope\s*exhaust)\b/i, 'l2-dhcp-001'],
  [/\b(rdp|remote\s*desktop|rd\s*gateway|terminal\s*server|rds)\b/i, 'l2-rdp-001'],
  [/\bsharepoint\b.*\bpermission\b/i, 'l2-sharepoint-001'],
  [/\b(autopilot|intune|company\s*portal|hybrid\s*join|device\s*compliance)\b/i, 'l2-intune-001'],
  [/\b(mail\s*flow|ndr|bounce|message\s*trace|dkim|spf|dmarc)\b/i, 'l2-exchange-001'],
  [/\b(temp\s*profile|profile\s*corrupted|profilelist)\b/i, 'l2-windows-001'],
  [/\b(ntfs|fileshare)\b.*(permission|access\s*denied|inheritance|icacls)\b/i, 'l2-permissions-001'],
  [/\b(asr|attack\s*surface\s*reduction|defender)\b.*(rule|tuning|block)\b/i, 'l2-endpoint-001'],
  [/\b(driver)\b.*(rollback|whql|fleet)\b/i, 'l2-drivers-001'],
  [/\b(asset\s*(register|management|tag|lifecycle|tracking|audit)|cmdb|itam|device\s*refresh|hardware\s*lifecycle|e.?waste|depreciation)\b/i, 'l2-asset-management-001'],
  [/\b(vip|c.?suite|executive|board\s*member|white\s*glove|ceo|cfo|coo|board\s*meeting)\b.*(support|issue|help|down|broken|cant|won.?t)\b/i, 'l2-vip-support-001'],
  [/\b(white\s*glove|desk.?side|vvip|earnings\s*call|customer\s*demo)\b/i, 'l2-vip-support-001'],
  [/\b(byod|bring\s*your\s*own\s*device|personal\s*device|app\s*protection|mam(\s|$)|work\s*profile|jamf|app\s*wrap)\b/i, 'l2-byod-001'],
  [/\bonboarding|new\s*hire|provisioning|first\s*day\b/i, 'l2-onboarding-001'],
  [/\b(offboarding|termination|exit|disable\s*account)\b/i, 'l2-offboarding-001'],
  [/\b(print\s*server|universal\s*print|printnightmare|0x0000011b)\b/i, 'l2-printers-001'],
  [/\b(latency|packet\s*loss|mtu|traceroute|jumbo\s*frame)\b/i, 'l2-networking-001'],
  [/\b(deployment|app\s*ring|configuration\s*profile|white\s*glove)\b/i, 'l2-deployment-001'],
  [/\b(wpr|xperf|performance\s*trace|boot\s*performance)\b/i, 'l2-performance-001'],
  [/\b(vpn\s*gateway|always\s*on\s*vpn|aovpn|device\s*tunnel|user\s*tunnel|rras|ikev2)\b/i, 'l2-vpn-001'],
  [/\b(cyber\s*incident|p1\s*incident|breach|kill\s*chain|exfiltration|lateral\s*movement)\b/i, 'l3-security-001'],
  [/\b(sso|saml|oidc|federation|identity\s*provider|jwt|okta\s*entra)\b/i, 'l3-sso-saml-001'],
  [/\b(pki|certificate\s*authority|ad\s*cs|autoenroll|crl|ocsp|root\s*ca|hsm)\b/i, 'l3-certificates-001'],
  [/\b(disaster\s*recovery|rto|rpo|veeam|rubrik|cohesity|3-2-1|tabletop|bcp)\b/i, 'l3-disaster-recovery-001'],
  [/\b(immutable\s*backup|object\s*lock|air\s*gap|hardened\s*repository)\b/i, 'l3-backup-dr-002'],
  [/\b(edr|applocker|wdac|device\s*guard|credential\s*guard|hvci|cis|stig)\b/i, 'l3-endpoint-001'],
  [/\b(msp|multi\s*tenant|lighthouse|delegated\s*administration|psa|rmm|itil|itsm)\b/i, 'l3-enterprise-001'],
  [/\b(azure\s*ad\s*connect|aad\s*connect|hybrid\s*identity|password\s*hash\s*sync|writeback)\b/i, 'l3-hybrid-ad-001'],
  [/\b(network\s*architecture|segmentation|zero\s*trust|sd-?wan|hub\s*spoke|microsegment)\b/i, 'l3-networking-001'],
  [/\b(landing\s*zone|management\s*group|azure\s*policy|tenant\s*design)\b/i, 'l3-cloud-001'],
  [/\b(server\s*role|sysprep|reference\s*image|s2d|storage\s*spaces\s*direct)\b/i, 'l3-server-001'],
  // GA — general assistance
  [/\b(scam|fake)\s*(site|website)|look.?alike\s*domain|typo.?squat|amaz0n|paypa1|microsoft-update|is\s*this\s*site\s*safe\b/i, 'ga-scam-001'],
  [/\b(help|teach|show)\b.*\b(my\s*)?(mom|dad|grandm|grandp|elderly|senior|parent)\b/i, 'ga-senior-001'],
  [/\b(senior|elderly|non.?technical)\b.*\b(help|how|guide)\b/i, 'ga-senior-001'],
  [/\bcompare\s+\w+\s+(vs|versus|or)\s+\w+|which\s+is\s+better|wirecutter|rtings\b/i, 'ga-shopping-002'],
  [/\b(buy|shop|purchase|order)\b.*\b(online|safely|first\s*time|amazon|shopify)\b/i, 'ga-shopping-001'],
  [/\b(safe\s*checkout|payment\s*method|virtual\s*card|apple\s*pay|google\s*pay)\b/i, 'ga-checkout-001'],
  [/\b(vendor|seller)\s*(research|legit|real)|is\s*this\s*(real|legit)|bbb|trustpilot\b/i, 'ga-vendor-research-001'],
  [/\bbook\s+(an?\s+)?appointment|reservation|opentable|resy\b/i, 'ga-booking-001'],
  [/\bfill\s+out\s+(an?\s+)?form|online\s+form|autofill\b/i, 'ga-form-filling-001'],
  [/\bexplain\s+(this|it)?\s*(simply|like\s*i|in\s*plain|like\s*i.?m\s*5)|eli5\b/i, 'ga-explanation-001'],
  [/\b(personal\s*budget|budgeting|50.?30.?20|emergency\s*fund|ynab|mint)\b/i, 'ga-budgeting-001'],
];

// ─── Stop words & tokenizer ────────────────────────────────────────────────────
const STOP = new Set([
  'a','an','and','as','at','be','by','for','from','i','in','is','it','my','of',
  'on','or','our','so','that','the','this','to','was','were','will','with','you',
  'your','me','have','has','had','do','does','did','am','if','then','than','but',
  "i'm","i've","i'd","can't","cant","won't","wont","doesn't","doesnt","didn't","didnt",
  'me','some','any','all','just'
]);

function tokenize(text) {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP.has(t));
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function classify(query) {
  const q = (query || '').toLowerCase();
  const signals = { level_hint: 'L1', audience: 'end-user', severity_signal: 'medium', sensitive: false };

  if (/\b(0x8004|aadsts5|0x800ccc|stop\s*0x|bugcheck|tenant|policy|gpo|intune|conditional\s*access|all\s*our\s*users|whole\s*office|finance\s*team|domain[- ]joined)\b/.test(q)) {
    signals.level_hint = 'L2';
    signals.audience = 'admin';
  }
  if (/\b(architecture|design|strategy|rollout|ransomware|breach|compromise|exfil|cross.?tenant|multi.?site|p1|incident\s*response)\b/.test(q)) {
    signals.level_hint = 'L3';
    signals.audience = 'technician';
  }
  if (/\b(my\s*(mom|dad|grandm|grandp|parent)|elderly|senior|how\s*do\s*i\s*buy|compare\s+\w+\s+(vs|or)|is\s*this\s*site|scam|eli5|like\s*i.?m\s*5)\b/.test(q)) {
    signals.level_hint = 'GA';
    signals.audience = 'end-user';
  }
  if (/\b(panic(king)?|scared|stressed|locked\s*me\s*out|encrypt|ransom|help\s*me\s*now|urgent)\b/.test(q)) {
    signals.sensitive = true;
  }
  return signals;
}

function scoreArticle(article, queryTokens, queryRaw, signals) {
  let score = 0;
  const t = article._tokens || {};
  const titleTokens = t.title || [];
  const keywordTokens = t.keywords || [];
  const symptomTokens = t.symptoms || [];
  const lowerQ = queryRaw.toLowerCase();

  // 1. Phrase-level keyword match (strongest signal).
  for (const kw of (article.keywords || [])) {
    const norm = kw.toLowerCase();
    if (norm.length >= 3 && lowerQ.includes(norm)) {
      score += 12 * Math.max(1, norm.split(/\s+/).length);
    }
  }
  // 2. Token overlap — title heaviest, then keywords, then symptoms.
  for (const tok of queryTokens) {
    if (titleTokens.includes(tok)) score += 3;
    if (keywordTokens.includes(tok)) score += 2;
    if (symptomTokens.includes(tok)) score += 1;
  }
  // 3. Level hint boost — only if there's already some signal (avoids surfacing
  //    irrelevant L2/L3 articles just because the query *sounded* admin-y).
  if (score > 0 && signals.level_hint === article.level) score += 4;
  // 4. Audience match.
  if (score > 0 && signals.audience === article.audience) score += 2;
  // 5. Sensitive → boost critical-severity matches.
  if (signals.sensitive && article.severity === 'critical') score += 3;

  return score;
}

export function retrieve(query, articles, opts = {}) {
  const topK = opts.topK || 5;
  const queryTokens = tokenize(query);
  const queryRaw = query || '';
  const signals = classify(queryRaw);

  // Hard routing first — exact pattern matches almost always win.
  const routedIds = new Set();
  for (const [re, id] of ROUTING) {
    if (re.test(queryRaw)) routedIds.add(id);
  }

  const scored = articles
    .map(a => {
      let score = scoreArticle(a, queryTokens, queryRaw, signals);
      if (routedIds.has(a.id)) score += 25;
      return { ...a, score, _signals: signals };
    })
    .filter(a => a.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

// Renders the public-safe portion of an article for an audience.
// NEVER returns §10 (Internal Technician Notes) for non-admin audiences.
// Inputs caller controls: { article, audience }
export function renderForAudience(article, audience = 'end-user') {
  const safeAudiences = new Set(['end-user', 'senior-user']);
  const isPublic = safeAudiences.has(audience);
  return {
    title: article.title,
    summary: article.user_friendly || article.symptoms?.split('\n')[0] || '',
    symptoms: isPublic ? article.symptoms : article.symptoms,
    escalation: article.escalation_trigger || '',
    show_internal_notes: !isPublic && audience === 'admin',
    severity: article.severity,
    level: article.level,
    path: article.path,
  };
}
