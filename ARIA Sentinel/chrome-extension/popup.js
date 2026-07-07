const bridge = document.getElementById("bridge");
const messages = document.getElementById("messages");
const input = document.getElementById("input");
const chromeApi = globalThis.chrome?.runtime?.sendMessage ? globalThis.chrome : createPreviewChromeApi();
const ARIA_WEB_URL = "https://iisupp.net/aria";
const ARIA_KB_ENDPOINT = "https://iisupp.net/.netlify/functions/aria-kb-query";
const ARIA_CHAT_ENDPOINT = "https://iisupp.net/.netlify/functions/aria-chat";
const KB_CONFIDENCE_MIN = 8;
const EXTENSION_BUILD_MARKER = globalThis.AriaSitePrefs?.EXTENSION_BUILD_MARKER || "unknown";

document.documentElement.dataset.sentinelBuild = EXTENSION_BUILD_MARKER;

init();

async function init() {
  const ping = await chromeApi.runtime.sendMessage({ type: "PING_BRIDGE" });
  bridge.textContent = ping.ok ? "Desktop bridge online" : "Desktop bridge offline - extension-only";
  addMessage("aria", ping.ok
    ? "Connected to the local desktop agent. Browser fixes stay on this machine."
    : "The desktop app is not running. I can still perform browser-only fixes.");
  renderStatusBadge(ping.ok);
  await initProtectionToggle();
  await initSiteToggle();
  await renderTodayCounter();
}

// Section 1: status badge — bridge dot + the detected browser, so the same popup reads right on
// Chrome, Edge and Safari.
function renderStatusBadge(bridgeOk) {
  const prefs = globalThis.AriaSitePrefs;
  const dot = document.getElementById("statusDot");
  const text = document.getElementById("statusText");
  const chip = document.getElementById("browserChip");
  if (dot) dot.classList.toggle("on", Boolean(bridgeOk));
  if (text) text.textContent = bridgeOk ? "Desktop agent connected · fixes stay local" : "Browser-only mode · fixes stay local";
  if (chip && prefs) chip.textContent = prefs.detectBrowser(navigator.userAgent);
}

// Section 3: "What ARIA did here today" counter from chrome.storage.local.
async function renderTodayCounter() {
  const prefs = globalThis.AriaSitePrefs;
  const el = document.getElementById("todayCount");
  if (!prefs || !el || !globalThis.chrome?.storage?.local) return;
  const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
  const host = prefs.normalizeHost(tab?.url || "");
  const n = await prefs.readToday(chrome.storage.local, host, new Date().toISOString());
  el.textContent = String(n);
}

// Record a browser-fix action for today's counter (bumped after each successful fix below).
async function recordAction() {
  const prefs = globalThis.AriaSitePrefs;
  if (!prefs || !globalThis.chrome?.storage?.local) return;
  const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
  const host = prefs.normalizeHost(tab?.url || "");
  await prefs.bumpToday(chrome.storage.local, host, new Date().toISOString());
  await renderTodayCounter();
}

// "On this site" — a per-host mute that follows the user across devices via chrome.storage.sync.
async function initSiteToggle() {
  const prefs = globalThis.AriaSitePrefs;
  const box = document.getElementById("siteDisable");
  if (!prefs || !box || !globalThis.chrome?.storage?.sync) return; // preview mode: leave inert
  const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
  const host = prefs.normalizeHost(tab?.url || "");
  const nameEl = document.getElementById("siteName");
  const stateEl = document.getElementById("siteState");
  if (nameEl && host) nameEl.textContent = host;
  const render = (list) => {
    const off = prefs.isDisabled(list, host);
    box.checked = off;
    if (stateEl) stateEl.textContent = off ? "Paused on this site" : "ARIA is active here";
  };
  render(await prefs.load(chrome.storage.sync));
  box.addEventListener("change", async () => {
    const next = prefs.toggle(await prefs.load(chrome.storage.sync), host);
    await prefs.save(chrome.storage.sync, next);
    render(next);
  });
}

async function initProtectionToggle() {
  const prefs = globalThis.AriaSitePrefs;
  const box = document.getElementById("protectionToggle");
  const stateEl = document.getElementById("protectionState");
  if (!prefs || !box || !globalThis.chrome?.storage?.sync) return;
  const render = (protection) => {
    box.checked = protection.enabled;
    box.disabled = Boolean(protection.locked);
    if (stateEl) {
      if (protection.locked) stateEl.textContent = protection.enabled ? "Monitoring active - locked by admin" : "Monitoring paused - locked by admin";
      else stateEl.textContent = protection.enabled ? "Monitoring active" : "Monitoring paused";
    }
  };
  render(await prefs.loadEffectiveProtection(chrome.storage.sync, chrome.storage.managed));
  box.addEventListener("change", async () => {
    const current = await prefs.loadEffectiveProtection(chrome.storage.sync, chrome.storage.managed);
    if (current.locked) {
      render(current);
      return;
    }
    const enabled = Boolean(box.checked);
    await prefs.saveProtection(chrome.storage.sync, enabled);
    const result = await chromeApi.runtime.sendMessage({ type: "SET_PROTECTION", payload: { enabled } });
    if (result?.error === "policy_locked") render(await prefs.loadEffectiveProtection(chrome.storage.sync, chrome.storage.managed));
    else render({ enabled, locked: false });
  });
}

document.getElementById("clearCache").addEventListener("click", async () => {
  const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
  const result = await chromeApi.runtime.sendMessage({ type: "CLEAR_ORIGIN_CACHE", payload: { origin: originFrom(tab.url) } });
  addMessage("aria", result.ok ? "Cache cleared for this site. Page reloaded." : "Cache clear is unavailable on this page.");
  if (result.ok) await recordAction();
});

document.getElementById("resetWorkers").addEventListener("click", async () => {
  const result = await chromeApi.runtime.sendMessage({ type: "RESET_SERVICE_WORKERS", payload: {} });
  addMessage("aria", result.ok ? "Service workers reset. Page reloaded." : "Service worker reset is unavailable here.");
  if (result.ok) await recordAction();
});

document.getElementById("resetZoom").addEventListener("click", async () => {
  const result = await chromeApi.runtime.sendMessage({ type: "RESET_ZOOM", payload: {} });
  addMessage("aria", result.ok ? "Zoom reset to 100%." : "Zoom reset is unavailable here.");
  if (result.ok) await recordAction();
});

document.getElementById("openDesktop").addEventListener("click", async () => {
  await chromeApi.tabs.create({ url: "http://127.0.0.1:37841/state" });
});

document.getElementById("openAriaWeb").addEventListener("click", async () => {
  await chromeApi.tabs.create({ url: ARIA_WEB_URL });
});

document.getElementById("send").addEventListener("click", send);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") send();
});

async function send() {
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  addMessage("user", text);
  const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
  const result = await chromeApi.runtime.sendMessage({
    type: "ASK_SENTINEL",
    payload: { message: text, url: tab?.url || "" }
  });
  const provider = result.provider === "aria-web-chat" || result.provider === "aria-web-kb" ? "ARIA web chat: " : "";
  const webUrl = result.webChatUrl || result.webBrainUrl;
  const webHint = webUrl ? `\n\nOpen ARIA web: ${webUrl}` : "";
  addMessage("aria", `${provider}${result.text || result.error || "ARIA could not respond."}${webHint}`);
}

function addMessage(role, text) {
  const item = document.createElement("div");
  item.className = `message ${role}`;
  item.textContent = text;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

function originFrom(url) {
  try { return new URL(url).origin; }
  catch { return ""; }
}

function createPreviewChromeApi() {
  const previewTab = { id: 1, url: "https://iisupp.net/aria.html" };
  return {
    tabs: {
      query: async () => [previewTab],
      create: async ({ url }) => {
        window.open(url, "_blank", "noopener");
        return { id: 2, url };
      }
    },
    runtime: {
      sendMessage: async (message) => {
        if (message.type === "PING_BRIDGE") {
          try {
            const response = await fetch("http://127.0.0.1:37841/health");
            return { ok: response.ok };
          } catch {
            return { ok: false };
          }
        }
        if (message.type === "ASK_SENTINEL") {
          try {
            const response = await fetch("http://127.0.0.1:37841/chat", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ message: message.payload?.message || "", context: { surface: "popup-preview" } })
            });
            const local = await response.json();
            if (local && (local.text || local.reply)) return { ...local, provider: local.provider || "sentinel-desktop-bridge", webChatUrl: ARIA_WEB_URL };
          } catch {
            // Fall through to ARIA web chat.
          }
          try {
            const kbResponse = await fetch(ARIA_KB_ENDPOINT, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ query: String(message.payload?.message || "").slice(0, 1000), platform: "browser-extension" })
            });
            if (kbResponse.ok) {
              const kb = await kbResponse.json();
              if (kb.match && Number(kb.confidence) >= KB_CONFIDENCE_MIN && kb.content_excerpt) {
                const article = kb.article || {};
                return {
                  ok: true,
                  provider: "aria-web-kb",
                  text: `${kb.content_excerpt}${article.url ? `\n\nFull ARIA article: ${article.url}` : ""}`,
                  webChatUrl: ARIA_WEB_URL
                };
              }
            }
          } catch {
            // Fall through to aria-chat.
          }
          try {
            const response = await fetch(ARIA_CHAT_ENDPOINT, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                messages: [{ role: "user", content: String(message.payload?.message || "").slice(0, 1000) }],
                sessionId: null,
                source: "sentinel-browser-extension-preview",
                platform: "browser-extension",
                tier: "",
                version: ""
              })
            });
            const web = await response.json();
            return { ok: true, provider: "aria-web-chat", text: web.text || web.reply || "ARIA web chat responded.", webChatUrl: ARIA_WEB_URL };
          } catch {
            return { ok: true, provider: "local-extension", text: `Preview mode: open ${ARIA_WEB_URL} for the full ARIA web chat.`, webChatUrl: ARIA_WEB_URL };
          }
        }
        return { ok: true };
      }
    }
  };
}
