const BRIDGE = "http://127.0.0.1:37841";
const ARIA_WEB_URL = "https://iisupp.net/aria";
const ARIA_KB_ENDPOINT = "https://iisupp.net/.netlify/functions/aria-kb-query";
const ARIA_CHAT_ENDPOINT = "https://iisupp.net/.netlify/functions/aria-chat";
const KB_CONFIDENCE_MIN = 8;
const LOCAL_STATE_KEY = "ariaSentinelState";
const PROTECTION_KEY = "ariaBrowserProtectionEnabled";
const PROTECTION_POLICY_KEY = "ariaBrowserProtectionPolicy";
const OUTCOME_LIMIT = 50;

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    [LOCAL_STATE_KEY]: {
      mode: "manual",
      bridgeOnline: false,
      protectionEnabled: true,
      protectionLocked: false,
      detections: [],
      outcomes: [],
      lastFix: null
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true;
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "PING_BRIDGE":
      return pingBridge();
    case "BROWSER_SIGNAL":
      return handleBrowserSignal(message.payload || {}, sender);
    case "CLEAR_ORIGIN_CACHE":
      return clearOriginCache(message.payload || {}, sender.tab);
    case "RESET_SERVICE_WORKERS":
      return resetServiceWorkers(message.payload || {}, sender.tab);
    case "RESET_ZOOM":
      return resetZoom(sender.tab);
    case "RELOAD_PAGE":
      return reloadPage(message.payload || {}, sender.tab);
    case "SET_PROTECTION":
      return setProtection(message.payload || {});
    case "BROWSER_OUTCOME":
      return handleBrowserOutcome(message.payload || {}, sender);
    case "ASK_SENTINEL":
      return askSentinel(message.payload || {}, sender);
    case "GET_STATE":
      return getLocalState();
    default:
      return { ok: false, error: "unknown_message" };
  }
}

async function pingBridge() {
  try {
    const res = await fetch(`${BRIDGE}/health`);
    const data = await res.json();
    await patchState({ bridgeOnline: res.ok });
    return { ok: res.ok, data };
  } catch {
    await patchState({ bridgeOnline: false });
    return { ok: false, error: "bridge_offline" };
  }
}

async function handleBrowserSignal(payload, sender) {
  const protection = await readEffectiveProtection();
  if (!protection.enabled) {
    await patchState({ protectionEnabled: protection.enabled, protectionLocked: protection.locked, protectionSource: protection.source });
    return { ok: false, error: "monitoring_disabled" };
  }
  const tab = sender.tab || {};
  const origin = safeOrigin(payload.url || tab.url);
  const originCategory = categorizeOrigin(origin);
  const signal = normalizeSymbolicCode(payload.signal || "UNKNOWN.SIGNAL");
  // Phase B — clamp the content-script's managed policy decision to the known enums (content-blind).
  const policyDecision = safePolicyDecision(payload.policyDecision);
  const threatLevel = safeThreatLevel(payload.threatLevel);
  const detectionPayload = {
    source: "chrome-extension",
    signal,
    issue: signal,
    originCategory,
    title: safeText(payload.title, 120),
    likelyCause: safeText(payload.likelyCause, 200),
    recommendation: safeText(payload.recommendation, 240),
    severity: safeText(payload.severity, 40),
    vendorOutagePossible: Boolean(payload.vendorOutagePossible),
    policyDecision,
    threatLevel,
    policyLocked: payload.policyLocked === true
  };
  let bridgeResult = null;
  try {
    bridgeResult = await postBridge("/detect", detectionPayload);
  } catch {
    bridgeResult = { ok: false, error: "bridge_offline" };
  }
  const detection = {
    id: crypto.randomUUID(),
    issueId: safeId(payload.issueId) || crypto.randomUUID(),
    ts: new Date().toISOString(),
    bridgeOnline: bridgeResult.ok,
    signal,
    originCategory,
    title: detectionPayload.title,
    likelyCause: detectionPayload.likelyCause,
    recommendation: detectionPayload.recommendation,
    severity: detectionPayload.severity,
    vendorOutagePossible: detectionPayload.vendorOutagePossible,
    policyDecision: detectionPayload.policyDecision,
    threatLevel: detectionPayload.threatLevel,
    policyLocked: detectionPayload.policyLocked,
    bridgeResult
  };
  // Read state FRESH after the awaited bridge call — a state object held across that await clobbers
  // any concurrent write (e.g. clearOriginCache's lastFix) with stale data (lost-update race).
  const state = await getLocalState();
  state.protectionEnabled = protection.enabled;
  state.protectionLocked = protection.locked;
  state.protectionSource = protection.source;
  state.detections = Array.isArray(state.detections) ? state.detections : [];
  state.detections.unshift(detection);
  state.detections = state.detections.slice(0, 50);
  state.bridgeOnline = bridgeResult.ok;
  await chrome.storage.local.set({ [LOCAL_STATE_KEY]: state });
  return { ok: true, detection, bridgeResult };
}

async function handleBrowserOutcome(payload, sender) {
  const origin = safeOrigin(payload.url || sender.tab?.url);
  const originCategory = categorizeOrigin(origin);
  const record = {
    id: crypto.randomUUID(),
    issueId: safeId(payload.issueId) || crypto.randomUUID(),
    ts: new Date().toISOString(),
    source: "chrome-extension",
    signal: normalizeSymbolicCode(payload.signal || "UNKNOWN.SIGNAL"),
    action: safeAction(payload.action),
    outcome: normalizeOutcome(payload.outcome),
    originCategory,
    severity: safeText(payload.severity, 40),
    bridgeOnline: false
  };
  let bridgeResult = null;
  try {
    bridgeResult = await postBridge("/browser-outcome", {
      issueId: record.issueId,
      signal: record.signal,
      action: record.action,
      outcome: record.outcome,
      originCategory: record.originCategory,
      severity: record.severity
    });
  } catch {
    bridgeResult = { ok: false, error: "bridge_offline" };
  }
  record.bridgeOnline = Boolean(bridgeResult && bridgeResult.ok);
  // Fresh state read AFTER the awaited bridge call (same lost-update guard as handleBrowserSignal).
  const state = await getLocalState();
  const key = outcomeKey(record);
  const existing = Array.isArray(state.outcomes) ? state.outcomes : [];
  state.outcomes = [record]
    .concat(existing.filter((item) => outcomeKey(item) !== key))
    .slice(0, OUTCOME_LIMIT);
  state.bridgeOnline = record.bridgeOnline;
  await chrome.storage.local.set({ [LOCAL_STATE_KEY]: state });
  return { ok: true, outcome: record, bridgeResult };
}

async function clearOriginCache(payload, tab) {
  const origin = safeOrigin(payload.origin || tab?.url);
  if (!origin) return { ok: false, error: "invalid_origin" };
  await chrome.browsingData.remove({ origins: [origin] }, { cache: true, serviceWorkers: true });
  if (tab?.id) await chrome.tabs.reload(tab.id, { bypassCache: true });
  await patchState({ lastFix: { type: "CACHE.STALE", originCategory: categorizeOrigin(origin), ts: new Date().toISOString() } });
  await recordActionOutcome(payload, tab, "clear-cache", "BROWSER.CACHE.STALE");
  await safeNotify("ARIA Sentinel", "Cache cleared for this site. Page reloaded.");
  return { ok: true, type: "CACHE.STALE" };
}

async function resetServiceWorkers(payload, tab) {
  if (!tab?.id) return { ok: false, error: "missing_tab" };
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async () => {
      if (!("serviceWorker" in navigator)) return 0;
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
      return registrations.length;
    }
  });
  await chrome.tabs.reload(tab.id, { bypassCache: true });
  await patchState({ lastFix: { type: "SERVICE.WORKER.STUCK", ts: new Date().toISOString() } });
  await recordActionOutcome(payload, tab, "service-worker", "BROWSER.SERVICE_WORKER.STUCK");
  return { ok: true };
}

// A reload-type fix kills the page's content script before its "resolved" outcome message can be
// sent, so the background records the outcome itself right after the action succeeds. If the content
// script DOES survive and records too, handleBrowserOutcome dedupes on issueId:outcome:action.
async function recordActionOutcome(payload, tab, action, fallbackSignal) {
  try {
    await handleBrowserOutcome({
      issueId: payload.issueId,
      signal: payload.signal || fallbackSignal,
      action,
      outcome: "resolved",
      severity: payload.severity,
      url: payload.origin || tab?.url
    }, { tab });
  } catch {
    // Outcome recording is best-effort; the fix itself already ran.
  }
}

async function resetZoom(tab) {
  if (!tab?.id) return { ok: false, error: "missing_tab" };
  await chrome.tabs.setZoom(tab.id, 1);
  await patchState({ lastFix: { type: "ZOOM.WEIRD", ts: new Date().toISOString() } });
  return { ok: true };
}

async function reloadPage(payload, tab) {
  if (!tab?.id) return { ok: false, error: "missing_tab" };
  await chrome.tabs.reload(tab.id, { bypassCache: true });
  await patchState({ lastFix: { type: "BROWSER.RELOAD", ts: new Date().toISOString() } });
  await recordActionOutcome(payload || {}, tab, "reload", "BROWSER.RELOAD");
  return { ok: true };
}

async function setProtection(payload) {
  const current = await readEffectiveProtection();
  if (current.locked) {
    await patchState({
      protectionEnabled: current.enabled,
      protectionLocked: true,
      protectionSource: current.source
    });
    return { ok: false, error: "policy_locked", protectionEnabled: current.enabled, protectionLocked: true };
  }
  const enabled = payload.enabled !== false;
  try {
    await chrome.storage.sync.set({ [PROTECTION_KEY]: enabled });
  } catch {
    // Popup/content sync storage already handles the user state; local state is the fallback.
  }
  await patchState({ protectionEnabled: enabled, protectionLocked: false, protectionSource: "user" });
  return { ok: true, protectionEnabled: enabled, protectionLocked: false };
}

async function askSentinel(payload) {
  try {
    const result = await postBridge("/chat", {
      message: String(payload.message || "").slice(0, 500),
      context: {
        source: "chrome-extension",
        originCategory: categorizeOrigin(payload.url)
      }
    });
    if (result && (result.text || result.reply)) {
      return { ...result, provider: result.provider || "sentinel-desktop-bridge", webChatUrl: ARIA_WEB_URL };
    }
  } catch {
    // Fall through to the web chat below.
  }
  const web = await askAriaWeb(payload);
  if (web.ok) return web;
  return {
    ok: true,
    provider: "local-extension",
    text: `I could not reach the desktop bridge or ARIA web chat. Open ${ARIA_WEB_URL} for the full ARIA chat experience.`,
    webChatUrl: ARIA_WEB_URL
  };
}

async function askAriaWeb(payload) {
  const message = String(payload.message || "").slice(0, 1000);
  if (!message.trim()) return { ok: false, error: "empty_message" };
  try {
    const kbRes = await fetch(ARIA_KB_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: message, platform: "browser-extension" })
    });
    if (kbRes.ok) {
      const kb = await kbRes.json();
      if (kb.match && Number(kb.confidence) >= KB_CONFIDENCE_MIN && kb.content_excerpt) {
        const article = kb.article || {};
        return {
          ok: true,
          provider: "aria-web-kb",
          text: `${kb.content_excerpt}${article.url ? `\n\nFull ARIA article: ${article.url}` : ""}`,
          sessionId: null,
          webChatUrl: ARIA_WEB_URL
        };
      }
    }
  } catch {
    // Fall through to aria-chat.
  }
  try {
    const res = await fetch(ARIA_CHAT_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: message }],
        sessionId: payload.sessionId || null,
        source: "sentinel-browser-extension",
        platform: "browser-extension",
        tier: "",
        version: chrome.runtime.getManifest?.().version || ""
      })
    });
    if (!res.ok) return { ok: false, error: `aria_web_${res.status}` };
    const data = await res.json();
    const text = String(data.text || data.reply || "");
    if (!text) return { ok: false, error: "empty_aria_web_reply" };
    return {
      ok: true,
      provider: "aria-web-chat",
      text,
      sessionId: data.sessionId || data.session_id || null,
      webChatUrl: ARIA_WEB_URL
    };
  } catch {
    return { ok: false, error: "aria_web_unreachable" };
  }
}
async function postBridge(path, body) {
  const res = await fetch(`${BRIDGE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function getLocalState() {
  const data = await chrome.storage.local.get(LOCAL_STATE_KEY);
  return data[LOCAL_STATE_KEY] || { mode: "manual", bridgeOnline: false, protectionEnabled: true, protectionLocked: false, detections: [], outcomes: [], lastFix: null };
}

async function patchState(patch) {
  const state = await getLocalState();
  await chrome.storage.local.set({ [LOCAL_STATE_KEY]: { ...state, ...patch } });
}

function safeOrigin(url) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.origin;
  } catch {
    return "";
  }
}

function normalizeSymbolicCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+|\.+$/g, "") || "UNKNOWN.SIGNAL";
}

// Phase B — decision/threat enums from the managed malicious-site policy layer. Anything else -> "".
function safePolicyDecision(value) {
  const v = String(value || "").toLowerCase();
  return ["allow", "warn", "block-recommend", "escalate"].includes(v) ? v : "";
}

function safeThreatLevel(value) {
  const v = String(value || "").toLowerCase();
  return ["clean", "suspicious", "malicious", "critical"].includes(v) ? v : "";
}

function normalizeOutcome(value) {
  const out = String(value || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  return ["detected", "resolved", "failed", "walkthrough", "live_help", "dismissed"].includes(out) ? out : "detected";
}

function safeAction(value) {
  return String(value || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "unknown";
}

function safeId(value) {
  return String(value || "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function outcomeKey(record) {
  return [record.issueId, record.outcome, record.action].map((part) => String(part || "")).join(":");
}

function safeText(value, max) {
  return String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .slice(0, max || 200);
}

function categorizeOrigin(url) {
  const origin = safeOrigin(url);
  if (!origin) return "unknown";
  const host = new URL(origin).hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") return "localhost";
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".corp")) return "internal";
  if (/(login|auth|sso|okta|microsoftonline|accounts\.google)/.test(host)) return "sso";
  if (/(service-now|salesforce|hubspot|slack|teams|sharepoint|zoom|atlassian|github)/.test(host)) return "saas";
  return "public";
}

async function safeNotify(title, message) {
  try {
    await chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/i-128.png",
      title,
      message,
      priority: 1
    });
  } catch {
    // Notifications can be unavailable in unpacked/dev contexts.
  }
}

async function readEffectiveProtection() {
  const userEnabled = await readStorageValue(chrome.storage.sync, PROTECTION_KEY, true);
  const policyRaw = await readStorageValue(chrome.storage.managed, PROTECTION_POLICY_KEY, null);
  const policy = normalizeProtectionPolicy(policyRaw);
  if (policy.locked) {
    return { enabled: policy.enabled !== false, locked: true, source: "managed", reason: policy.reason };
  }
  return {
    enabled: userEnabled !== false,
    locked: false,
    source: policy.managed ? "managed-default" : "user",
    reason: policy.reason
  };
}

async function readStorageValue(storage, key, fallback) {
  try {
    if (!storage || typeof storage.get !== "function") return fallback;
    const data = await storage.get(key);
    return data && data[key] !== undefined ? data[key] : fallback;
  } catch {
    return fallback;
  }
}

function normalizeProtectionPolicy(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { managed: false, locked: false, enabled: null, reason: "" };
  }
  const locked = raw.locked === true || raw.force === true;
  let enabled = raw.enabled === false ? false : raw.enabled === true ? true : null;
  if (locked && enabled === null) enabled = true;
  return {
    managed: locked || enabled !== null,
    locked,
    enabled,
    reason: safeText(raw.reason, 160)
  };
}
