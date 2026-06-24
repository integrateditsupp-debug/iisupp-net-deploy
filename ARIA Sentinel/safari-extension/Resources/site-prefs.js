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

  var api = {
    STORAGE_KEY: STORAGE_KEY,
    AUTO_PAUSE_MS: AUTO_PAUSE_MS,
    normalizeHost: normalizeHost,
    isDisabled: isDisabled,
    toggle: toggle,
    shouldAutoPause: shouldAutoPause,
    load: load,
    save: save,
    detectBrowser: detectBrowser,
    todayKey: todayKey,
    readToday: readToday,
    bumpToday: bumpToday
  };

  global.AriaSitePrefs = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
