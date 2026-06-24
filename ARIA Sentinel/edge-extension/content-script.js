const ROOT_ID = "aria-sentinel-root";
const PASSWORD_ATTEMPT_KEY = "ariaSentinelPasswordAttempts";
const prefs = globalThis.AriaSitePrefs;

let autoPauseTimer = null;
let lastFocusMs = Date.now();

if (window.top === window && /^https?:/.test(location.protocol)) {
  // Honour the per-site "leave me alone" toggle: if this host is silenced, never inject the globe.
  guardedBoot();
}

async function guardedBoot() {
  try {
    const list = prefs ? await prefs.load(chrome.storage.sync) : [];
    if (prefs && prefs.isDisabled(list, location.hostname)) return; // silenced on this site
  } catch {
    // storage read failure must not stop the (default-on) companion
  }
  boot();
  watchFocus();
  // React live if the user toggles this site from the popup while the page is open.
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync" || !prefs || !changes[prefs.STORAGE_KEY]) return;
      const next = changes[prefs.STORAGE_KEY].newValue || [];
      setGlobeHidden(prefs.isDisabled(next, location.hostname));
    });
  } catch {
    // onChanged is best-effort
  }
}

// Auto-pause: when the tab stays unfocused longer than AriaSitePrefs.AUTO_PAUSE_MS, hide the globe;
// bring it back as soon as the user returns (unless the site is disabled).
function watchFocus() {
  const onHide = () => {
    if (autoPauseTimer) clearTimeout(autoPauseTimer);
    const wait = prefs ? prefs.AUTO_PAUSE_MS : 5 * 60 * 1000;
    autoPauseTimer = setTimeout(() => setGlobeHidden(true), wait);
  };
  const onShow = async () => {
    if (autoPauseTimer) { clearTimeout(autoPauseTimer); autoPauseTimer = null; }
    lastFocusMs = Date.now();
    let disabled = false;
    try {
      const list = prefs ? await prefs.load(chrome.storage.sync) : [];
      disabled = prefs ? prefs.isDisabled(list, location.hostname) : false;
    } catch { /* default visible */ }
    setGlobeHidden(disabled);
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") onHide();
    else onShow();
  });
  window.addEventListener("blur", onHide);
  window.addEventListener("focus", onShow);
}

function setGlobeHidden(hidden) {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  root.style.display = hidden ? "none" : "";
}

function boot() {
  if (document.getElementById(ROOT_ID)) return;
  const root = document.createElement("div");
  root.id = ROOT_ID;
  // Cross-browser: tag the root with the detected engine so the same globe SVG renders identically
  // on Chrome / Edge / Safari (and any per-engine CSS hook can attach without forking the markup).
  try { root.dataset.browser = prefs ? prefs.detectBrowser(navigator.userAgent) : "chrome"; } catch { /* default */ }
  root.innerHTML = `
    <button class="aria-sentinel-globe" type="button" aria-label="Open ARIA Sentinel"></button>
    <section class="aria-sentinel-card" hidden>
      <span class="aria-sentinel-chip">BROWSER - CACHE.STALE</span>
      <h2>This page looks stale</h2>
      <p>Clear cache and service worker data for this site only, then reload.</p>
      <div class="aria-sentinel-actions">
        <button data-action="clear-cache" type="button">CLEAR & RELOAD</button>
        <button data-action="dismiss" type="button">Not now</button>
      </div>
    </section>
  `;
  document.documentElement.appendChild(root);
  const card = root.querySelector(".aria-sentinel-card");
  root.querySelector(".aria-sentinel-globe").addEventListener("click", () => {
    card.hidden = !card.hidden;
    if (!card.hidden) {
      sendSignal("BROWSER.CACHE.STALE");
    }
  });
  root.querySelector('[data-action="clear-cache"]').addEventListener("click", async () => {
    const res = await chrome.runtime.sendMessage({
      type: "CLEAR_ORIGIN_CACHE",
      payload: { origin: location.origin }
    });
    if (res?.ok) {
      card.querySelector(".aria-sentinel-chip").textContent = "BROWSER - RESOLVED";
      card.querySelector("h2").textContent = "Cache cleared";
      card.querySelector("p").textContent = "This site was refreshed with a clean cache.";
    }
  });
  root.querySelector('[data-action="dismiss"]').addEventListener("click", () => {
    card.hidden = true;
  });
  observePageErrors();
  observePasswordLoops();
  checkZoom();
}

function observePageErrors() {
  window.addEventListener("error", (event) => {
    const message = String(event.message || "");
    if (/chunk|service worker|failed to fetch|networkerror/i.test(message)) {
      showCard("SERVICE.WORKER.STUCK", "Site worker stuck", "The page is throwing cached app errors. Reset service workers for this site?");
      sendSignal("BROWSER.SERVICE_WORKER.STUCK");
    }
  }, true);
  window.addEventListener("unhandledrejection", (event) => {
    const message = String(event.reason?.message || event.reason || "");
    if (/failed to fetch|chunk|service worker|network/i.test(message)) {
      showCard("CACHE.STALE", "This page looks stale", "Clear this site's cache and reload from the network?");
      sendSignal("BROWSER.CACHE.STALE");
    }
  }, true);
}

function observePasswordLoops() {
  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!form.querySelector('input[type="password"]')) return;
    const key = `${PASSWORD_ATTEMPT_KEY}:${location.origin}`;
    const count = Number(sessionStorage.getItem(key) || "0") + 1;
    sessionStorage.setItem(key, String(count));
    if (count >= 2) {
      showCard("PASSWORD.RETRY.2", "Repeated login failure", "I can walk you through a safe login check without reading credentials.");
      sendSignal("AUTH.LOGIN.RETRY_LOOP");
    }
  }, true);
}

async function checkZoom() {
  try {
    const zoom = Number((window.outerWidth / window.innerWidth).toFixed(2));
    if (zoom && (zoom < 0.8 || zoom > 1.25)) {
      sendSignal("BROWSER.ZOOM.WRONG");
    }
  } catch {
    // Best-effort only.
  }
}

function showCard(signal, title, body) {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  const card = root.querySelector(".aria-sentinel-card");
  card.querySelector(".aria-sentinel-chip").textContent = signal.replace(".", " - ");
  card.querySelector("h2").textContent = title;
  card.querySelector("p").textContent = body;
  card.hidden = false;
}

function sendSignal(signal) {
  chrome.runtime.sendMessage({
    type: "BROWSER_SIGNAL",
    payload: {
      signal,
      issue: signal,
      url: location.origin
    }
  }).catch(() => undefined);
}
