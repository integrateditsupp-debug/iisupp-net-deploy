const bridge = document.getElementById("bridge");
const messages = document.getElementById("messages");
const input = document.getElementById("input");
const chromeApi = globalThis.chrome?.runtime?.sendMessage ? globalThis.chrome : createPreviewChromeApi();

init();

async function init() {
  const ping = await chromeApi.runtime.sendMessage({ type: "PING_BRIDGE" });
  bridge.textContent = ping.ok ? "Desktop bridge online" : "Desktop bridge offline - extension-only";
  addMessage("aria", ping.ok
    ? "Connected to the local desktop agent. Browser fixes stay on this machine."
    : "The desktop app is not running. I can still perform browser-only fixes.");
  renderStatusBadge(ping.ok);
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
  addMessage("aria", result.text || result.error || "ARIA could not respond.");
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
            return await response.json();
          } catch {
            return { ok: true, text: "Preview mode: desktop bridge is offline, browser-only fixes remain local." };
          }
        }
        return { ok: true };
      }
    }
  };
}
