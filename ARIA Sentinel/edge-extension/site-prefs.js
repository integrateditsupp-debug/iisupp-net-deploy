// site-prefs — the pure "leave me alone" logic shared by the popup toggle and the content script.
// Classic script (no ES module syntax) so it can be the FIRST content_scripts entry and expose its
// API on globalThis for content-script.js, and also be loaded before the popup module. The same file
// is exercised by tests/extension.test.mjs in a sandbox, so the disabled-sites behaviour is verified.
//
// Storage: chrome.storage.sync under one key, so a user's disabled-sites list follows them across
// devices with NO new permission ("storage" is already granted). Everything here is content-blind —
// it stores only hostnames the user explicitly silenced, never page content.
(function (global) {
  "use strict";

  var STORAGE_KEY = "ariaDisabledSites";
  var PROTECTION_KEY = "ariaBrowserProtectionEnabled";
  var PROTECTION_POLICY_KEY = "ariaBrowserProtectionPolicy";
  var EXTENSION_BUILD_MARKER = "web-chat-20260707";
  var AUTO_PAUSE_MS = 5 * 60 * 1000; // hide the globe after 5 min with the tab unfocused

  // Reduce any URL / host string to a bare, comparable hostname (lowercased, no leading www.).
  function normalizeHost(input) {
    if (!input) return "";
    var host = String(input);
    if (host.indexOf("://") !== -1) {
      try { host = new URL(host).hostname; } catch (e) { /* fall through with raw string */ }
    }
    host = host.trim().toLowerCase();
    if (host.indexOf("/") !== -1) host = host.split("/")[0];
    if (host.indexOf("www.") === 0) host = host.slice(4);
    return host;
  }

  function isDisabled(list, host) {
    var h = normalizeHost(host);
    return Array.isArray(list) && h !== "" && list.indexOf(h) !== -1;
  }

  // Return a NEW list with the host toggled on/off — pure, never mutates the input.
  function toggle(list, host) {
    var h = normalizeHost(host);
    var base = Array.isArray(list) ? list.slice() : [];
    if (h === "") return base;
    var idx = base.indexOf(h);
    if (idx === -1) base.push(h);
    else base.splice(idx, 1);
    return base;
  }

  // True once the tab has been unfocused longer than the auto-pause window.
  function shouldAutoPause(lastFocusMs, nowMs) {
    if (!Number.isFinite(lastFocusMs) || !Number.isFinite(nowMs)) return false;
    return nowMs - lastFocusMs > AUTO_PAUSE_MS;
  }

  function isProtectionEnabled(value) {
    return value !== false;
  }

  function normalizeProtectionPolicy(value) {
    var raw = value && value[PROTECTION_POLICY_KEY] !== undefined ? value[PROTECTION_POLICY_KEY] : value;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { managed: false, locked: false, enabled: null, reason: "" };
    }
    var locked = raw.locked === true || raw.force === true;
    var enabled = raw.enabled === false ? false : raw.enabled === true ? true : null;
    if (locked && enabled === null) enabled = true;
    return {
      managed: locked || enabled !== null,
      locked: locked,
      enabled: enabled,
      reason: String(raw.reason || "").replace(/[\r\n\t]+/g, " ").slice(0, 160)
    };
  }

  function resolveProtection(userEnabled, policy) {
    var normalized = normalizeProtectionPolicy(policy);
    if (normalized.locked) {
      return {
        enabled: normalized.enabled !== false,
        locked: true,
        source: "managed",
        reason: normalized.reason
      };
    }
    return {
      enabled: isProtectionEnabled(userEnabled),
      locked: false,
      source: normalized.managed ? "managed-default" : "user",
      reason: normalized.reason
    };
  }

  // Detect the host browser from a UA string so the same globe renders on Chrome / Edge / Safari.
  // (Edge UA contains "Edg/"; Safari UA has "Safari" but not "Chrome".) Pure + testable.
  function detectBrowser(ua) {
    const s = String(ua || "").toLowerCase();
    if (s.includes("edg/") || s.includes("edga") || s.includes("edgios")) return "edge";
    if (s.includes("chrome") || s.includes("chromium") || s.includes("crios")) return "chrome";
    if (s.includes("safari")) return "safari";
    return "chrome";
  }

  // "What ARIA did here today" — a per-host, per-day action counter kept in chrome.storage.local.
  // The key embeds only a normalized hostname + an ISO date (YYYY-MM-DD) — never page content.
  function todayKey(host, dateStr) {
    return "ariaToday:" + normalizeHost(host) + ":" + String(dateStr || "").slice(0, 10);
  }

  function readToday(storageLocal, host, dateStr) {
    var key = todayKey(host, dateStr);
    return new Promise(function (resolve) {
      try {
        var p = storageLocal.get(key);
        if (p && typeof p.then === "function") p.then(function (r) { resolve(Number((r && r[key]) || 0)); }, function () { resolve(0); });
        else storageLocal.get(key, function (r) { resolve(Number((r && r[key]) || 0)); });
      } catch (e) { resolve(0); }
    });
  }

  function bumpToday(storageLocal, host, dateStr) {
    var key = todayKey(host, dateStr);
    return readToday(storageLocal, host, dateStr).then(function (n) {
      var next = n + 1;
      var payload = {};
      payload[key] = next;
      return new Promise(function (resolve) {
        try {
          var p = storageLocal.set(payload);
          if (p && typeof p.then === "function") p.then(function () { resolve(next); }, function () { resolve(next); });
          else storageLocal.set(payload, function () { resolve(next); });
        } catch (e) { resolve(next); }
      });
    });
  }

  function classifyBrowserIssue(input) {
    var data = input || {};
    var statusCode = Number(data.statusCode || 0);
    var text = [
      data.signal,
      data.errorText,
      data.message,
      data.title,
      data.bodyText,
      data.url
    ].map(function (x) { return String(x || ""); }).join(" ").slice(0, 6000);

    if (statusCode === 404 || /\b404\b|not found|page not found/i.test(text)) {
      return issue("BROWSER.HTTP.404", "Page not found", "The link or route may no longer exist.", "Check the address, retry once, or contact the site owner if this is a work app.", "reload", "warning", true);
    }
    if ((statusCode >= 500 && statusCode <= 599) || /\b(500|502|503|504)\b|service unavailable|bad gateway|gateway timeout|vendor outage|temporarily unavailable/i.test(text)) {
      return issue("BROWSER.VENDOR.OUTAGE_POSSIBLE", "Website may be down", "The site is returning a server-side failure.", "Retry once, then escalate to the vendor/admin if other sites work.", "reload", "warning", true);
    }
    if (/deceptive site|phishing|malware|unsafe site|suspicious site|security warning|dangerous/i.test(text)) {
      return issue("BROWSER.SECURITY.SUSPICIOUS", "Suspicious site warning", "The browser or page content indicates a possible unsafe site.", "Do not enter credentials. Use the walkthrough or contact support.", "walkthrough", "danger", false);
    }
    if (/net::err_cert|certificate|cert_authority|cert_common_name|cert_date_invalid|ssl error|privacy error/i.test(text)) {
      return issue("BROWSER.CERT.ERROR", "Certificate problem", "The site certificate, system clock, or inspection policy may be wrong.", "Do not bypass the warning. Check clock/VPN policy or contact support.", "walkthrough", "danger", false);
    }
    if (/proxy|err_proxy|tunnel connection failed|pac script|proxy server/i.test(text)) {
      return issue("BROWSER.PROXY.ERROR", "Proxy connection problem", "The browser may be using the wrong proxy or VPN route.", "Check VPN/proxy status and use the walkthrough before changing settings.", "walkthrough", "warning", false);
    }
    if (/dns_probe|err_name_not_resolved|name not resolved|server dns address|dns/i.test(text)) {
      return issue("BROWSER.DNS.ERROR", "DNS lookup failed", "The address could not be resolved from this network.", "Retry after checking network/VPN. ARIA can guide a safe DNS check.", "walkthrough", "warning", false);
    }
    if (/site can.t be reached|page cannot be displayed|err_connection|err_internet_disconnected|network error|failed to fetch/i.test(text)) {
      return issue("BROWSER.PAGE.UNREACHABLE", "Page cannot be reached", "The issue may be local network, VPN, proxy, or a site outage.", "Try reload once, then use the walkthrough to classify local vs vendor.", "reload", "warning", true);
    }
    if (/blocked by client|blocked resource|content security policy|csp|mixed content|not allowed to load/i.test(text)) {
      return issue("BROWSER.RESOURCE.BLOCKED", "Page resource blocked", "A security policy, extension, or mixed-content rule blocked part of the page.", "Use the walkthrough; do not disable security controls without admin approval.", "walkthrough", "warning", false);
    }
    if (/service worker|chunkloaderror|loading chunk|stale cache|cache stale|old page/i.test(text)) {
      return issue("BROWSER.CACHE.STALE", "This page looks stale", "Cached site files or a service worker may be stuck.", "Clear this site's cache and reload from the network.", "clear-cache", "notice", false);
    }
    return null;
  }

  function issue(signal, title, cause, recommendation, action, severity, vendorOutagePossible) {
    return {
      signal: signal,
      title: title,
      likelyCause: cause,
      recommendation: recommendation,
      action: action,
      severity: severity || "notice",
      vendorOutagePossible: Boolean(vendorOutagePossible)
    };
  }

  // ---- malicious-site policy DECISION layer (Phase B wiring) --------------------------------
  // A faithful port of src/shared/malicious-site-policy.mjs so the extension can route a managed
  // decision (allow / warn / block-recommend / escalate) for suspicious/malicious signals. Parity
  // with the shared module is pinned by tests/malicious-site-wiring.test.mjs. DECISION ONLY: this
  // never blocks, redirects, closes a tab, or writes any browser/OS setting (enforced:false always).
  var MALICIOUS_SITE_POLICY_KEY = "ariaMaliciousSitePolicy";
  var MALICIOUS_SITE_POLICY_VERSION = "malicious-site-policy-v1";
  var MALICIOUS_SITE_DECISIONS = ["allow", "warn", "block-recommend", "escalate"];
  var THREAT_LEVELS = ["clean", "suspicious", "malicious", "critical"];
  var PROTECTION_MODES = ["on", "off", "locked-on", "locked-off"];
  var DEFAULT_THREAT_DECISION = { clean: "allow", suspicious: "warn", malicious: "block-recommend", critical: "escalate" };

  function policyCode(value, max) {
    return String(value == null ? "" : value)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9._-]+/g, ".")
      .replace(/\.{2,}/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, max || 80);
  }

  function policyEnum(value, allowed, fallback) {
    var raw = String(value == null ? "" : value).trim().toLowerCase();
    return allowed.indexOf(raw) !== -1 ? raw : fallback;
  }

  function severityRank(value) {
    var s = String(value == null ? "" : value).trim().toLowerCase();
    if (s === "critical" || s === "severe") return 3;
    if (s === "danger" || s === "high" || s === "malicious") return 2;
    if (s === "warning" || s === "warn" || s === "medium" || s === "suspicious") return 1;
    return 0;
  }

  function deriveThreatLevel(signal) {
    var data = signal || {};
    var explicit = policyEnum(data.threatLevel !== undefined ? data.threatLevel : data.threat_level, THREAT_LEVELS, "");
    if (explicit) return explicit;
    var code = policyCode(data.signal !== undefined ? data.signal : data.code);
    var looksActiveThreat = /(MALWARE|RANSOMWARE)\b/.test(code) || /PHISH\.(CONFIRMED|ACTIVE)/.test(code) || /THREAT\.ACTIVE/.test(code);
    var looksMalicious = /MALICIOUS|BLOCKLIST|PHISH/.test(code);
    var looksSuspicious = /SUSPICIOUS|UNSAFE|RISKY|BLOCKED/.test(code);
    var rank = severityRank(data.severity);
    if (rank >= 3) return "critical";
    if (looksActiveThreat && rank >= 2) return "critical";
    if (looksMalicious || rank >= 2) return "malicious";
    if (looksSuspicious || rank >= 1) return "suspicious";
    return "clean";
  }

  function normalizeMaliciousSitePolicy(policy) {
    var p = policy && typeof policy === "object" ? policy : {};
    var modeRaw = p.mode !== undefined ? p.mode : (p.protection !== undefined ? p.protection : p.browserProtection);
    var mode = policyEnum(modeRaw, PROTECTION_MODES, "on");
    var decisions = {};
    var src = p.decisions && typeof p.decisions === "object" ? p.decisions : {};
    for (var i = 0; i < THREAT_LEVELS.length; i += 1) {
      var level = THREAT_LEVELS[i];
      decisions[level] = policyEnum(src[level], MALICIOUS_SITE_DECISIONS, DEFAULT_THREAT_DECISION[level]);
    }
    var routeRaw = p.escalationRoute !== undefined ? p.escalationRoute : (p.escalation !== undefined ? p.escalation : "SUPPORT.DESK");
    return {
      v: MALICIOUS_SITE_POLICY_VERSION,
      mode: mode,
      locked: mode === "locked-on" || mode === "locked-off",
      protectionActive: mode === "on" || mode === "locked-on",
      silenceWhenOff: p.silenceWhenOff === true && mode !== "locked-off",
      decisions: decisions,
      escalationRoute: policyCode(routeRaw, 60) || "SUPPORT.DESK"
    };
  }

  function evaluateMaliciousSite(policy, signal) {
    var p = normalizeMaliciousSitePolicy(policy);
    var data = signal || {};
    var threatLevel = deriveThreatLevel(data);
    var wantsOverride = policyEnum(data.userOverride !== undefined ? data.userOverride : data.override, ["allow", "block"], "");
    var baseline = p.decisions[threatLevel] || DEFAULT_THREAT_DECISION[threatLevel] || "warn";
    var decision = baseline;
    var reason = "policy." + threatLevel;
    var policyLocked = false;

    if (!p.protectionActive) {
      if (threatLevel === "critical") {
        decision = "escalate";
        reason = "protection-off-critical-still-escalates";
      } else if (threatLevel === "malicious") {
        decision = "warn";
        reason = "protection-off-malicious-downgraded-to-warn";
      } else if (p.silenceWhenOff) {
        decision = "allow";
        reason = "protection-off-silenced";
      } else {
        decision = threatLevel === "clean" ? "allow" : "warn";
        reason = "protection-off";
      }
    }

    if (wantsOverride) {
      if (p.locked) {
        policyLocked = true;
        reason = "policy_locked";
      } else if (wantsOverride === "allow" && threatLevel !== "critical") {
        decision = "allow";
        reason = "user-override-allow";
      } else if (wantsOverride === "allow" && threatLevel === "critical") {
        decision = "escalate";
        reason = "override-refused-critical";
      } else if (wantsOverride === "block") {
        decision = "block-recommend";
        reason = "user-override-block";
      }
    }

    return {
      v: MALICIOUS_SITE_POLICY_VERSION,
      decision: MALICIOUS_SITE_DECISIONS.indexOf(decision) !== -1 ? decision : "warn",
      reason: reason,
      policy_locked: policyLocked,
      threatLevel: threatLevel,
      escalationRoute: decision === "escalate" ? p.escalationRoute : null,
      enforced: false // DECISION ONLY — the extension never blocks or overrides anything for real
    };
  }

  // Load the managed malicious-site policy (chrome.storage.managed) — absent/garbage -> {} (defaults).
  function loadMaliciousSitePolicy(managedStorage) {
    return new Promise(function (resolve) {
      try {
        if (!managedStorage || typeof managedStorage.get !== "function") return resolve({});
        var p = managedStorage.get(MALICIOUS_SITE_POLICY_KEY);
        if (p && typeof p.then === "function") {
          p.then(function (r) { resolve((r && r[MALICIOUS_SITE_POLICY_KEY]) || {}); }, function () { resolve({}); });
        } else {
          managedStorage.get(MALICIOUS_SITE_POLICY_KEY, function (r) { resolve((r && r[MALICIOUS_SITE_POLICY_KEY]) || {}); });
        }
      } catch (e) {
        resolve({});
      }
    });
  }

  // ---- storage adapter (injectable so tests can pass a fake chrome.storage.sync) ----
  function load(storage) {
    return new Promise(function (resolve) {
      try {
        var p = storage.get(STORAGE_KEY);
        if (p && typeof p.then === "function") {
          p.then(function (r) { resolve((r && r[STORAGE_KEY]) || []); }, function () { resolve([]); });
        } else {
          storage.get(STORAGE_KEY, function (r) { resolve((r && r[STORAGE_KEY]) || []); });
        }
      } catch (e) {
        resolve([]);
      }
    });
  }

  function save(storage, list) {
    var payload = {};
    payload[STORAGE_KEY] = Array.isArray(list) ? list : [];
    return new Promise(function (resolve) {
      try {
        var p = storage.set(payload);
        if (p && typeof p.then === "function") p.then(function () { resolve(true); }, function () { resolve(false); });
        else storage.set(payload, function () { resolve(true); });
      } catch (e) {
        resolve(false);
      }
    });
  }

  function loadProtection(storage) {
    return new Promise(function (resolve) {
      try {
        if (!storage || typeof storage.get !== "function") return resolve(true);
        var p = storage.get(PROTECTION_KEY);
        if (p && typeof p.then === "function") {
          p.then(function (r) { resolve(isProtectionEnabled(r && r[PROTECTION_KEY])); }, function () { resolve(true); });
        } else {
          storage.get(PROTECTION_KEY, function (r) { resolve(isProtectionEnabled(r && r[PROTECTION_KEY])); });
        }
      } catch (e) {
        resolve(true);
      }
    });
  }

  function loadProtectionPolicy(storage) {
    return new Promise(function (resolve) {
      try {
        if (!storage || typeof storage.get !== "function") return resolve(normalizeProtectionPolicy(null));
        var p = storage.get(PROTECTION_POLICY_KEY);
        if (p && typeof p.then === "function") {
          p.then(function (r) { resolve(normalizeProtectionPolicy(r && r[PROTECTION_POLICY_KEY])); }, function () { resolve(normalizeProtectionPolicy(null)); });
        } else {
          storage.get(PROTECTION_POLICY_KEY, function (r) { resolve(normalizeProtectionPolicy(r && r[PROTECTION_POLICY_KEY])); });
        }
      } catch (e) {
        resolve(normalizeProtectionPolicy(null));
      }
    });
  }

  function loadEffectiveProtection(syncStorage, managedStorage) {
    return Promise.all([
      loadProtection(syncStorage),
      loadProtectionPolicy(managedStorage)
    ]).then(function (values) {
      return resolveProtection(values[0], values[1]);
    });
  }

  function saveProtection(storage, enabled) {
    var payload = {};
    payload[PROTECTION_KEY] = enabled !== false;
    return new Promise(function (resolve) {
      try {
        var p = storage.set(payload);
        if (p && typeof p.then === "function") p.then(function () { resolve(true); }, function () { resolve(false); });
        else storage.set(payload, function () { resolve(true); });
      } catch (e) {
        resolve(false);
      }
    });
  }

  var api = {
    STORAGE_KEY: STORAGE_KEY,
    PROTECTION_KEY: PROTECTION_KEY,
    PROTECTION_POLICY_KEY: PROTECTION_POLICY_KEY,
    EXTENSION_BUILD_MARKER: EXTENSION_BUILD_MARKER,
    AUTO_PAUSE_MS: AUTO_PAUSE_MS,
    normalizeHost: normalizeHost,
    isDisabled: isDisabled,
    toggle: toggle,
    shouldAutoPause: shouldAutoPause,
    load: load,
    save: save,
    loadProtection: loadProtection,
    saveProtection: saveProtection,
    loadProtectionPolicy: loadProtectionPolicy,
    loadEffectiveProtection: loadEffectiveProtection,
    isProtectionEnabled: isProtectionEnabled,
    normalizeProtectionPolicy: normalizeProtectionPolicy,
    resolveProtection: resolveProtection,
    detectBrowser: detectBrowser,
    classifyBrowserIssue: classifyBrowserIssue,
    MALICIOUS_SITE_POLICY_KEY: MALICIOUS_SITE_POLICY_KEY,
    MALICIOUS_SITE_DECISIONS: MALICIOUS_SITE_DECISIONS,
    normalizeMaliciousSitePolicy: normalizeMaliciousSitePolicy,
    evaluateMaliciousSite: evaluateMaliciousSite,
    loadMaliciousSitePolicy: loadMaliciousSitePolicy,
    todayKey: todayKey,
    readToday: readToday,
    bumpToday: bumpToday
  };

  global.AriaSitePrefs = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
