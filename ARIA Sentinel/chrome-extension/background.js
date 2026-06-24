const BRIDGE = "http://127.0.0.1:37841";
const LOCAL_STATE_KEY = "ariaSentinelState";

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    [LOCAL_STATE_KEY]: {
      mode: "manual",
      bridgeOnline: false,
      detections: [],
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
      return resetServiceWorkers(sender.tab);
    case "RESET_ZOOM":
      return resetZoom(sender.tab);
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
  const tab = sender.tab || {};
  const origin = safeOrigin(payload.url || tab.url);
  const originCategory = categorizeOrigin(origin);
  const signal = normalizeSymbolicCode(payload.signal || "UNKNOWN.SIGNAL");
  const detectionPayload = {
    source: "chrome-extension",
    signal,
    issue: signal,
    originCategory
  };
  let bridgeResult = null;
  try {
    bridgeResult = await postBridge("/detect", detectionPayload);
  } catch {
    bridgeResult = { ok: false, error: "bridge_offline" };
  }
  const state = await getLocalState();
  const detection = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    bridgeOnline: bridgeResult.ok,
    signal,
    originCategory,
    bridgeResult
  };
  state.detections.unshift(detection);
  state.detections = state.detections.slice(0, 50);
  state.bridgeOnline = bridgeResult.ok;
  await chrome.storage.local.set({ [LOCAL_STATE_KEY]: state });
  return { ok: true, detection, bridgeResult };
}

async function clearOriginCache(payload, tab) {
  const origin = safeOrigin(payload.origin || tab?.url);
  if (!origin) return { ok: false, error: "invalid_origin" };
  await chrome.browsingData.remove({ origins: [origin] }, { cache: true, serviceWorkers: true });
  if (tab?.id) await chrome.tabs.reload(tab.id, { bypassCache: true });
  await patchState({ lastFix: { type: "CACHE.STALE", originCategory: categorizeOrigin(origin), ts: new Date().toISOString() } });
  await safeNotify("ARIA Sentinel", "Cache cleared for this site. Page reloaded.");
  return { ok: true, type: "CACHE.STALE" };
}

async function resetServiceWorkers(tab) {
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
  return { ok: true };
}

async function resetZoom(tab) {
  if (!tab?.id) return { ok: false, error: "missing_tab" };
  await chrome.tabs.setZoom(tab.id, 1);
  await patchState({ lastFix: { type: "ZOOM.WEIRD", ts: new Date().toISOString() } });
  return { ok: true };
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
    return result;
  } catch {
    return {
      ok: true,
      provider: "local-extension",
      text: "The desktop bridge is offline. I can still clear this site's cache, reset service workers, or reset zoom from the extension."
    };
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
  return data[LOCAL_STATE_KEY] || { mode: "manual", bridgeOnline: false, detections: [], lastFix: null };
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
