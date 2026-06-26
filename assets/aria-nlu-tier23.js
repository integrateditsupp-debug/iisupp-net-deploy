/* === ARIA NLU Tier-2/3 — RUN 25 ============================================================
   Expert-domain vocabulary + expert-mode detector + topic-switch detector for the public /aria
   classifier. This is a POST-CLASSIFY routing layer: it runs alongside aria.html's classify()
   WITHOUT modifying the regex tree, so the 34K scenario corpus can never regress because of it.

   Why this exists: paying customers ask AD / GPO / DNS / virtualization / identity questions in
   hour one. The regex tree drops phrasings it doesn't know (e.g. "GPO not applying … Event 1058")
   to 'default' → the generic "no confident match" path. That reads like a consumer toy and triggers
   refunds. This module recognizes the expert vocabulary and routes to a domain-aware first-3-checks
   + human handoff instead.

   Loads in TWO worlds: the browser (aria.html, as window.AriaNLUTier23) and Node (tests, via require).
   🔒 R11: pure string logic — no filesystem paths, no logging, no PII. scrubPublicSurface() additionally
   strips any admin-internal term (recipe IDs, mode names, OTA/Sentinel internals) from public output. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AriaNLUTier23 = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ----- Vocabulary banks ----------------------------------------------------------------------
  // Tier-2 = infrastructure/admin vocabulary. 1 hit → skip the generic picker (Tier-2 framing);
  // 2+ hits → full expert mode.
  var TIER2 = [
    'domain controller', 'dc', 'ad', 'active directory', 'gpo', 'group policy', 'ou',
    'dns forwarder', 'internal hostname', 'fqdn', 'replication', 'isp', 'wan', 'vlan',
    'subnet mask', 'default gateway', 'dhcp scope', 'dhcp reservation', 'netbios',
    'smb share', 'mapped drive', 'file server', 'print server', 'rdp', 'vpn tunnel',
    'exchange', 'owa', 'eac', 'mx record', 'spf', 'dkim', 'dmarc'
  ];
  // Tier-3 = deep/architectural vocabulary → escalation-ready "deep IT" framing.
  var TIER3 = [
    'schema upgrade', 'schema master', 'fsmo', 'dcpromo', 'ntdsutil', 'repadmin',
    'gpupdate', 'gpresult', 'rsop', 'rsop.msc', 'secedit', 'lgpo', 'sysvol', 'netlogon',
    'event 1058', 'event 1030', 'event 4624', 'event 5719', 'event 5722',
    'hyper-v', 'vsphere', 'vcenter', 'esxi', 'raid rebuild', 'iscsi target',
    'lun', 'san', 'veeam', 'active backup', 'bcdr', 'rto', 'rpo',
    'azure ad connect', 'aad connect', 'adfs', 'hybrid identity',
    'intune', 'autopilot', 'mdm enrollment', 'conditional access',
    'powershell remoting', 'winrm', 'kerberos', 'spn', 'delegation'
  ];

  // Whole-token / phrase matcher. Boundaries are "start|non-alphanumeric" so short tokens like
  // "ad" / "ou" / "dc" match only as standalone words (never inside "had" / "about" / "dcpromo"),
  // and tokens with internal punctuation ("rsop.msc", "hyper-v", "event 1058") still match cleanly.
  function termRegex(term) {
    var esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp('(^|[^a-z0-9])' + esc + '([^a-z0-9]|$)', 'i');
  }
  function matchedTerms(q, bank) {
    var out = [];
    for (var i = 0; i < bank.length; i++) if (termRegex(bank[i]).test(q)) out.push(bank[i]);
    return out;
  }

  /**
   * detectExpertMode(message) → { expert, skipPicker, tier, framing, matched, hits, domain }
   *   - hits >= 2            → expert:true,  tier 3 if any Tier-3 word present else 2
   *   - hits === 1           → expert:false, skipPicker:true, Tier-2 framing (still bypass the picker)
   *   - hits === 0           → expert:false, skipPicker:false → caller uses the existing Tier-1 flow
   * `matched` lists the distinct keywords hit; `domain` is the best-fit domain for the first-3-checks.
   */
  function detectExpertMode(message) {
    var q = ' ' + String(message == null ? '' : message).toLowerCase() + ' ';
    var m2 = matchedTerms(q, TIER2);
    var m3 = matchedTerms(q, TIER3);
    var matched = m2.concat(m3);
    var hits = matched.length;
    var tier = m3.length ? 3 : (m2.length ? 2 : 0);
    var expert = hits >= 2;
    var skipPicker = hits >= 1;
    // Spec: 1 hit always uses Tier-2 framing; 2+ uses Tier-3 framing only when a Tier-3 word is present.
    var framing = !skipPicker ? 'none' : (expert ? (tier === 3 ? 'tier3' : 'tier2') : 'tier2');
    return { expert: expert, skipPicker: skipPicker, tier: tier, framing: framing, matched: matched, hits: hits, domain: expertDomain(matched) };
  }

  // ----- Domain → first-3-checks content -------------------------------------------------------
  // Each domain owns a slice of the banks + a credible, escalation-framed first-3-checks. Content is
  // generic best-practice IT (standard built-in tooling) — no IIS-internal terms, no guarantees.
  var DOMAINS = {
    'ad-gpo': {
      label: 'Active Directory / Group Policy',
      terms: ['active directory', 'domain controller', 'dc', 'ad', 'gpo', 'group policy', 'ou', 'replication',
        'schema upgrade', 'schema master', 'fsmo', 'dcpromo', 'ntdsutil', 'repadmin', 'gpupdate', 'gpresult',
        'rsop', 'rsop.msc', 'secedit', 'lgpo', 'sysvol', 'netlogon', 'event 1058', 'event 1030', 'kerberos', 'spn', 'delegation'],
      checks: [
        'Confirm the client is reaching a healthy DC and check Event Viewer → System for Group Policy / Netlogon errors — 1058/1030 point straight at SYSVOL or DFSR access.',
        'Force and trace the policy: gpupdate /force, then gpresult /h report.html (or rsop.msc) to see which GPO actually wins and whether security-group or WMI filtering is dropping it.',
        'Check replication health — repadmin /replsummary and SYSVOL/DFSR state — since a single stale DC will keep serving the old policy after a schema or OU change.'
      ],
      escalation: 'Schema/replication changes are domain-wide and carry real risk — a technician should drive this hands-on.'
    },
    'dns-net': {
      label: 'DNS / Networking',
      terms: ['dns forwarder', 'internal hostname', 'fqdn', 'isp', 'wan', 'vlan', 'subnet mask', 'default gateway',
        'dhcp scope', 'dhcp reservation', 'netbios'],
      checks: [
        'Test the resolution path directly: nslookup the internal FQDN against each DNS server — after an ISP change a stale or wrong forwarder is the usual cause of hosts not resolving each other.',
        'Verify forwarders / conditional forwarders and root hints now point at the new resolvers; the old ISP IPs go dead the moment the circuit is cut.',
        'Walk the basics end-to-end with ipconfig /all: default gateway, subnet mask, and that DHCP is handing out the INTERNAL DNS servers (not the ISP\'s).'
      ],
      escalation: 'Cross-site DNS after an ISP change usually needs a technician on the firewall and DNS config together.'
    },
    'virtualization': {
      label: 'Virtualization / Storage / Backup',
      terms: ['hyper-v', 'vsphere', 'vcenter', 'esxi', 'raid rebuild', 'iscsi target', 'lun', 'san', 'veeam',
        'active backup', 'bcdr', 'rto', 'rpo'],
      checks: [
        'Capture host + guest state first: host CPU/RAM and datastore latency, and whether the VM is paused, in a saved state, or pointing at storage that has gone offline.',
        'Check the storage layer — array/RAID status and iSCSI/SAN connectivity / LUN visibility — because a degraded array or a dropped target stalls every VM on it.',
        'Confirm your last good restore point and RTO/RPO (Veeam / Active Backup) BEFORE any change, so recovery stays an option.'
      ],
      escalation: 'Virtualization and storage work carries data-loss risk — our team should do this hands-on rather than over chat.'
    },
    'identity': {
      label: 'Identity / Microsoft 365',
      terms: ['azure ad connect', 'aad connect', 'adfs', 'hybrid identity', 'intune', 'autopilot',
        'mdm enrollment', 'conditional access', 'exchange', 'owa', 'eac', 'mx record', 'spf', 'dkim', 'dmarc'],
      checks: [
        'Check directory sync health: Azure AD Connect last sync time and any export errors in the Synchronization Service Manager.',
        'Confirm the sign-in path — conditional access policies, ADFS / relying-party trust, and whether the account is cloud-only or synced.',
        'For mail flow, validate MX / SPF / DKIM / DMARC; for devices, check Intune / Autopilot enrollment and compliance state.'
      ],
      escalation: 'Identity and SSO changes touch every user — a technician should make these changes carefully.'
    },
    'remote-access': {
      label: 'Remote Access',
      terms: ['rdp', 'vpn tunnel', 'powershell remoting', 'winrm', 'smb share', 'mapped drive', 'file server', 'print server'],
      checks: [
        'Confirm the endpoint is reachable and the service is listening (RDP 3389 / WinRM 5985-5986 / SMB 445) before chasing credentials.',
        'Check the path: firewall rules, the VPN tunnel state, and DNS for the target host name — a half-up tunnel looks like an auth failure.',
        'Validate the account and Kerberos/SPN side for mapped drives and remoting, since a stale ticket or bad SPN blocks access cleanly.'
      ],
      escalation: 'Remote-access and file/print-server changes are best done by a technician with eyes on the server.'
    }
  };
  var GENERIC_DOMAIN = {
    label: 'Infrastructure',
    checks: [
      'Pin down the exact scope first — one user or org-wide, and what changed right before it started.',
      'Reproduce against the relevant server or service directly (not just the client) so we know which side is actually failing.',
      'Capture the precise error text / event ID before any change, so the fix is targeted and reversible.'
    ],
    escalation: 'This looks like infrastructure-level work — I\'ll route it to a technician.'
  };

  /** Pick the best-fit domain from the matched keywords (most matches wins; ties → first defined). */
  function expertDomain(matched) {
    if (!matched || !matched.length) return 'generic';
    var best = 'generic', bestN = 0;
    for (var key in DOMAINS) {
      if (!Object.prototype.hasOwnProperty.call(DOMAINS, key)) continue;
      var terms = DOMAINS[key].terms, n = 0;
      for (var i = 0; i < matched.length; i++) if (terms.indexOf(matched[i]) !== -1) n++;
      if (n > bestN) { bestN = n; best = key; }
    }
    return bestN ? best : 'generic';
  }

  /** The first-3-checks content for a domain key (always returns label + 3 checks + escalation). */
  function expertChecks(domain) {
    var d = DOMAINS[domain] || GENERIC_DOMAIN;
    return { label: d.label, checks: d.checks.slice(), escalation: d.escalation };
  }

  // ----- Topic-switch detector -----------------------------------------------------------------
  var STOPWORDS = {};
  ['the', 'and', 'but', 'for', 'with', 'that', 'this', 'have', 'has', 'had', 'are', 'was', 'were',
    'not', 'cant', 'cannot', 'wont', 'didnt', 'doesnt', 'isnt', 'wasnt', 'they', 'them', 'their',
    'you', 'your', 'youre', 'our', 'will', 'would', 'should', 'could', 'please', 'help', 'need',
    'when', 'then', 'than', 'about', 'after', 'before', 'still', 'again', 'from', 'into', 'just',
    'some', 'what', 'why', 'how', 'who', 'get', 'got', 'now', 'its', 'been', 'being', 'mine', 'here', 'there'
  ].forEach(function (w) { STOPWORDS[w] = true; });

  // Significant tokens = >3 chars (per spec), letters/digits, not a stopword.
  function significantTokens(text) {
    var raw = String(text == null ? '' : text).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/);
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var t = raw[i];
      if (t.length > 3 && !STOPWORDS[t]) out.push(t);
    }
    return out;
  }

  /**
   * isTopicSwitch(prevMessage, newMessage) — Jaccard overlap of significant tokens < 0.15 → true.
   * Minimum-signal guard: if EITHER side has fewer than 2 significant tokens we return false — a one-word
   * reply ("yes", "ok thanks", "go ahead") carries too little signal to call a topic change, and the caller
   * already routes explicit continuations ("walk me through", "show me the steps") before reaching here.
   */
  function isTopicSwitch(prevMessage, newMessage) {
    var a = significantTokens(prevMessage), b = significantTokens(newMessage);
    if (a.length < 2 || b.length < 2) return false;
    var setA = {}, i, inter = 0, seen = {};
    for (i = 0; i < a.length; i++) setA[a[i]] = true;
    var uniqB = [];
    for (i = 0; i < b.length; i++) { if (!seen[b[i]]) { seen[b[i]] = true; uniqB.push(b[i]); } }
    var uniqA = Object.keys(setA);
    for (i = 0; i < uniqB.length; i++) if (setA[uniqB[i]]) inter++;
    var union = uniqA.length + uniqB.length - inter;
    var jaccard = union === 0 ? 1 : inter / union;
    return jaccard < 0.15;
  }

  // ----- Low-confidence → technician handoff ---------------------------------------------------
  var LOW_CONFIDENCE_SOURCE = 'aria-low-confidence-escalation';

  /**
   * shouldEscalateToTechnician(intent, expertResult) — the public classifier has no numeric confidence,
   * so 'default' (the catch-all) IS the low-confidence signal. Escalate when the message classified to
   * 'default' AND it is not an expert-domain message (those get the domain-aware response instead).
   */
  function shouldEscalateToTechnician(intent, expertResult) {
    return intent === 'default' && !(expertResult && expertResult.skipPicker);
  }

  /** The lead payload for a low-confidence escalation — carries the full message + the source tag. */
  function buildEscalationLead(message, intent) {
    return { message: String(message == null ? '' : message), last_intent: intent || 'default', source: LOW_CONFIDENCE_SOURCE };
  }

  // ----- Public-surface scrub (fc13223 invariant) ----------------------------------------------
  // Defense-in-depth: never let an admin-internal term reach the public chat. Applied to expert output.
  function scrubPublicSurface(text) {
    return String(text == null ? '' : text)
      .replace(/\brcp_[a-z0-9_-]+/gi, '[recipe]')
      .replace(/\bSENTINEL_[A-Z0-9_]+/g, '[internal]')
      .replace(/\b(?:OTA_[A-Z0-9_]+|ota-build[a-z0-9.-]*)/gi, '[internal]')
      .replace(/\.netlify\/functions\/[a-z0-9-]+/gi, '[internal]')
      .replace(/\b(?:dry-?run|tier-0 executor|supervisor-agent|admin console|admin-token)\b/gi, '[internal]');
  }

  return {
    TIER2: TIER2, TIER3: TIER3,
    detectExpertMode: detectExpertMode,
    expertDomain: expertDomain,
    expertChecks: expertChecks,
    isTopicSwitch: isTopicSwitch,
    significantTokens: significantTokens,
    shouldEscalateToTechnician: shouldEscalateToTechnician,
    buildEscalationLead: buildEscalationLead,
    scrubPublicSurface: scrubPublicSurface,
    LOW_CONFIDENCE_SOURCE: LOW_CONFIDENCE_SOURCE
  };
}));
