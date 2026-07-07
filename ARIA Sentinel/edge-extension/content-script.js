const ROOT_ID = "aria-sentinel-root";
const PASSWORD_ATTEMPT_KEY = "ariaSentinelPasswordAttempts";
const prefs = globalThis.AriaSitePrefs;

let autoPauseTimer = null;
let lastFocusMs = Date.now();
let currentIssue = null;
let currentIssueId = "";

if (window.top === window && /^https?:/.test(location.protocol)) {
  guardedBoot();
}

async function guardedBoot() {
  try {
    const protection = prefs ? await prefs.loadEffectiveProtection(chrome.storage.sync, chrome.storage.managed) : { enabled: true };
    if (!protection.enabled) return;
    const list = prefs ? await prefs.load(chrome.storage.sync) : [];
    if (prefs && prefs.isDisabled(list, location.hostname)) return;
  } catch {
    // Storage read failures should not stop the default-on companion.
  }
  boot();
  watchFocus();
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (!prefs || (area !== "sync" && area !== "managed")) return;
      if (changes[prefs.PROTECTION_KEY] || changes[prefs.PROTECTION_POLICY_KEY]) {
        prefs.loadEffectiveProtection(chrome.storage.sync, chrome.storage.managed).then((protection) => {
          if (!protection.enabled) return setGlobeHidden(true);
          if (!document.getElementById(ROOT_ID)) boot();
          return setGlobeHidden(false);
        }).catch(() => undefined);
        return;
      }
      if (area === "sync" && changes[prefs.STORAGE_KEY]) {
        const next = changes[prefs.STORAGE_KEY].newValue || [];
        setGlobeHidden(prefs.isDisabled(next, location.hostname));
      }
    });
  } catch {
    // onChanged is best-effort.
  }
}

function watchFocus() {
  const onHide = () => {
    if (autoPauseTimer) clearTimeout(autoPauseTimer);
    const wait = prefs ? prefs.AUTO_PAUSE_MS : 5 * 60 * 1000;
    autoPauseTimer = setTimeout(() => setGlobeHidden(true), wait);
  };
  const onShow = async () => {
    if (autoPauseTimer) { clearTimeout(autoPauseTimer); autoPauseTimer = null; }
    lastFocusMs = Date.now();
    let hidden = false;
    try {
      const protection = prefs ? await prefs.loadEffectiveProtection(chrome.storage.sync, chrome.storage.managed) : { enabled: true };
      const list = prefs ? await prefs.load(chrome.storage.sync) : [];
      hidden = !protection.enabled || (prefs ? prefs.isDisabled(list, location.hostname) : false);
    } catch {
      hidden = false;
    }
    setGlobeHidden(hidden);
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
  try { root.dataset.browser = prefs ? prefs.detectBrowser(navigator.userAgent) : "chrome"; } catch { /* default */ }
  root.dataset.sentinelBuild = prefs?.EXTENSION_BUILD_MARKER || "unknown";
  root.innerHTML = `
    <button class="aria-sentinel-globe" type="button" aria-label="Open ARIA Sentinel"></button>
    <section class="aria-sentinel-card" hidden>
      <span class="aria-sentinel-chip">BROWSER - CACHE.STALE</span>
      <h2>This page looks stale</h2>
      <p class="aria-sentinel-body">Here is the issue we found. Would you like me to resolve it?</p>
      <p class="aria-sentinel-cause"><strong>Likely cause:</strong> Cached site files or a service worker may be stuck.</p>
      <p class="aria-sentinel-recommendation"><strong>Recommended:</strong> Clear this site's cache and reload from the network.</p>
      <div class="aria-sentinel-actions">
        <button data-action="resolve" type="button">Resolve it for me</button>
        <button data-action="walkthrough" type="button">Walkthrough</button>
        <button data-action="live-help" type="button">Live help</button>
        <button data-action="dismiss" type="button">Not now</button>
      </div>
      <p class="aria-sentinel-live" hidden>If you wish to talk to a live agent, call: +1-647-581-3182.</p>
    </section>
  `;
  document.documentElement.appendChild(root);

  const card = root.querySelector(".aria-sentinel-card");
  root.querySelector(".aria-sentinel-globe").addEventListener("click", () => {
    card.hidden = !card.hidden;
    if (!card.hidden) showIssue(classifyIssue({ signal: "BROWSER.CACHE.STALE", title: document.title, url: location.href }) || defaultIssue());
  });
  root.querySelector('[data-action="resolve"]').addEventListener("click", resolveIssue);
  root.querySelector('[data-action="walkthrough"]').addEventListener("click", openWalkthrough);
  root.querySelector('[data-action="live-help"]').addEventListener("click", () => {
    const live = card.querySelector(".aria-sentinel-live");
    if (live) live.hidden = false;
    recordOutcome("live_help", "live-help");
  });
  root.querySelector('[data-action="dismiss"]').addEventListener("click", () => {
    card.hidden = true;
    recordOutcome("dismissed", "dismiss");
  });

  observeInitialPage();
  observePageErrors();
  observePasswordLoops();
  checkZoom();
}

async function resolveIssue() {
  const issue = currentIssue || defaultIssue();
  // Issue context rides with the action so the background can record the outcome itself — a
  // reload-type fix kills this content script before its own "resolved" message can be sent.
  const actionContext = {
    origin: location.origin,
    issueId: issue.issueId || currentIssueId,
    signal: issue.signal,
    severity: issue.severity
  };
  let res = { ok: false };
  if (issue.action === "clear-cache") {
    res = await chrome.runtime.sendMessage({ type: "CLEAR_ORIGIN_CACHE", payload: actionContext });
  } else if (issue.action === "service-worker") {
    res = await chrome.runtime.sendMessage({ type: "RESET_SERVICE_WORKERS", payload: actionContext });
  } else if (issue.action === "reset-zoom") {
    res = await chrome.runtime.sendMessage({ type: "RESET_ZOOM", payload: {} });
  } else if (issue.action === "reload") {
    res = await chrome.runtime.sendMessage({ type: "RELOAD_PAGE", payload: actionContext });
  } else {
    return openWalkthrough();
  }
  if (res?.ok) {
    recordOutcome("resolved", issue.action, res);
    const card = document.querySelector(`#${ROOT_ID} .aria-sentinel-card`);
    if (!card) return;
    card.querySelector(".aria-sentinel-chip").textContent = "BROWSER - RESOLVED";
    card.querySelector("h2").textContent = "Fix applied";
    card.querySelector(".aria-sentinel-body").textContent = "ARIA ran the approved browser-only action for this site.";
    card.querySelector(".aria-sentinel-cause").textContent = "Verification: the page was refreshed or browser setting was reset.";
    card.querySelector(".aria-sentinel-recommendation").textContent = "If the issue continues, choose Walkthrough or Live help.";
  } else {
    recordOutcome("failed", issue.action, res);
  }
}

async function openWalkthrough() {
  const issue = currentIssue || defaultIssue();
  let result = null;
  try {
    const fallback = {
      ok: true,
      text: `Safe local guidance: ${issue.recommendation} No browser or system setting was changed.`
    };
    result = await Promise.race([
      chrome.runtime.sendMessage({
        type: "ASK_SENTINEL",
        payload: {
          message: `Walk me through this browser issue: ${issue.signal}. Likely cause: ${issue.likelyCause}. Recommended: ${issue.recommendation}.`,
          url: location.origin
        }
      }),
      new Promise((resolve) => setTimeout(() => resolve(fallback), 1200))
    ]);
  } catch {
    result = {
      ok: true,
      text: `Safe local guidance: ${issue.recommendation} No browser or system setting was changed.`
    };
  }
  const card = document.querySelector(`#${ROOT_ID} .aria-sentinel-card`);
  if (!card) return;
  recordOutcome("walkthrough", "walkthrough", result);
  card.querySelector("h2").textContent = "Walkthrough ready";
  card.querySelector(".aria-sentinel-body").textContent = result?.text || "ARIA opened a safe step-by-step walkthrough.";
  card.querySelector(".aria-sentinel-cause").textContent = "Manual mode: no browser or system setting was changed.";
  card.querySelector(".aria-sentinel-recommendation").textContent = "Follow one step at a time, then return here if it is not resolved.";
}

function observeInitialPage() {
  setTimeout(() => {
    const bodyText = document.body ? document.body.innerText.slice(0, 3000) : "";
    const issue = classifyIssue({ title: document.title, bodyText, url: location.href });
    if (issue) showIssue(issue);
  }, 900);
}

function observePageErrors() {
  window.addEventListener("error", (event) => {
    const target = event.target;
    if (target && target !== window && (target.src || target.href)) {
      const issue = classifyIssue({ signal: "BROWSER.RESOURCE.BLOCKED", errorText: "blocked resource", url: location.href });
      if (issue) showIssue(issue);
      return;
    }
    const message = String(event.message || "");
    const issue = classifyIssue({ errorText: message, url: location.href });
    if (issue) {
      if (/service worker|chunk/i.test(message)) issue.action = "service-worker";
      showIssue(issue);
    }
  }, true);
  window.addEventListener("unhandledrejection", (event) => {
    const message = String(event.reason?.message || event.reason || "");
    const issue = classifyIssue({ errorText: message, url: location.href });
    if (issue) showIssue(issue);
  }, true);
  document.addEventListener("securitypolicyviolation", () => {
    const issue = classifyIssue({ signal: "BROWSER.RESOURCE.BLOCKED", errorText: "content security policy blocked resource", url: location.href });
    if (issue) showIssue(issue);
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
      showIssue({
        signal: "AUTH.LOGIN.RETRY_LOOP",
        title: "Repeated login failure",
        likelyCause: "The account, password manager entry, MFA prompt, or site session may be out of sync.",
        recommendation: "Use the walkthrough. ARIA will not read or transmit credentials.",
        action: "walkthrough",
        severity: "warning",
        vendorOutagePossible: false
      });
    }
  }, true);
}

async function checkZoom() {
  try {
    const zoom = Number((window.outerWidth / window.innerWidth).toFixed(2));
    if (zoom && (zoom < 0.8 || zoom > 1.25)) {
      showIssue({
        signal: "BROWSER.ZOOM.WRONG",
        title: "Browser zoom looks off",
        likelyCause: "The page scale appears outside the normal range.",
        recommendation: "Reset browser zoom to 100%.",
        action: "reset-zoom",
        severity: "notice",
        vendorOutagePossible: false
      });
    }
  } catch {
    // Best-effort only.
  }
}

function showIssue(issue) {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  const card = root.querySelector(".aria-sentinel-card");
  issue.issueId = issue.issueId || makeIssueId(issue.signal);
  currentIssueId = issue.issueId;
  currentIssue = issue;
  card.dataset.severity = issue.severity || "notice";
  card.querySelector(".aria-sentinel-chip").textContent = issue.signal.replace(".", " - ");
  card.querySelector("h2").textContent = issue.title;
  card.querySelector(".aria-sentinel-body").textContent = "Here is the issue we found. Would you like me to resolve it?";
  card.querySelector(".aria-sentinel-cause").innerHTML = `<strong>Likely cause:</strong> ${escapeHtml(issue.likelyCause)}`;
  card.querySelector(".aria-sentinel-recommendation").innerHTML = `<strong>Recommended:</strong> ${escapeHtml(issue.recommendation)}`;
  const resolve = card.querySelector('[data-action="resolve"]');
  if (resolve) resolve.textContent = issue.action === "walkthrough" ? "Open guidance" : "Resolve it for me";
  const live = card.querySelector(".aria-sentinel-live");
  if (live) live.hidden = true;
  card.hidden = false;
  // Phase B — suspicious/malicious signals get a managed DECISION (warn / block-recommend / escalate)
  // that routes the card to guidance/live-help. Decision only: nothing is ever blocked or closed.
  decoratePolicyDecision(issue).then(() => sendSignal(issue)).catch(() => sendSignal(issue));
}

// Evaluate the managed malicious-site policy for this issue and route the card accordingly.
// Honors the managed/admin lock (policy_locked) and NEVER enforces anything: no navigation change,
// no tab close, no setting write — copy + escalation routing only.
async function decoratePolicyDecision(issue) {
  try {
    if (!prefs || typeof prefs.evaluateMaliciousSite !== "function") return issue;
    const policy = await prefs.loadMaliciousSitePolicy(chrome.storage.managed);
    const verdict = prefs.evaluateMaliciousSite(policy || {}, { signal: issue.signal, severity: issue.severity });
    issue.policyDecision = verdict.decision;
    issue.threatLevel = verdict.threatLevel;
    issue.policyLocked = verdict.policy_locked === true;
    if (verdict.threatLevel === "clean" || verdict.decision === "allow") return issue;
    const card = document.querySelector(`#${ROOT_ID} .aria-sentinel-card`);
    if (!card || card.hidden) return issue;
    const lockNote = issue.policyLocked ? " This is managed by your organization and cannot be overridden here." : "";
    if (verdict.decision === "escalate") {
      card.querySelector(".aria-sentinel-body").textContent = `Your organization's policy routes this site issue to live help. Do not enter credentials.${lockNote}`;
      const live = card.querySelector(".aria-sentinel-live");
      if (live) live.hidden = false;
    } else if (verdict.decision === "block-recommend") {
      card.querySelector(".aria-sentinel-body").textContent = `ARIA recommends leaving this site and not entering credentials. No browser or system setting was changed.${lockNote}`;
    }
    return issue;
  } catch {
    return issue;
  }
}

function classifyIssue(input) {
  if (prefs && typeof prefs.classifyBrowserIssue === "function") return prefs.classifyBrowserIssue(input);
  return null;
}

function defaultIssue() {
  return {
    signal: "BROWSER.CACHE.STALE",
    title: "This page looks stale",
    likelyCause: "Cached site files or a service worker may be stuck.",
    recommendation: "Clear this site's cache and reload from the network.",
    action: "clear-cache",
    severity: "notice",
    vendorOutagePossible: false
  };
}

function sendSignal(issue) {
  const payload = typeof issue === "string" ? { signal: issue } : issue;
  chrome.runtime.sendMessage({
    type: "BROWSER_SIGNAL",
    payload: {
      issueId: payload.issueId || currentIssueId,
      signal: payload.signal,
      issue: payload.signal,
      title: payload.title,
      likelyCause: payload.likelyCause,
      recommendation: payload.recommendation,
      severity: payload.severity,
      vendorOutagePossible: payload.vendorOutagePossible,
      policyDecision: payload.policyDecision,
      threatLevel: payload.threatLevel,
      policyLocked: payload.policyLocked === true,
      url: location.origin
    }
  }).catch(() => undefined);
}

function recordOutcome(outcome, action, result) {
  const issue = currentIssue || defaultIssue();
  chrome.runtime.sendMessage({
    type: "BROWSER_OUTCOME",
    payload: {
      issueId: issue.issueId || currentIssueId,
      signal: issue.signal,
      action: action || issue.action,
      outcome,
      severity: issue.severity,
      ok: Boolean(result && result.ok),
      url: location.origin
    }
  }).catch(() => undefined);
}

function makeIssueId(signal) {
  const safeSignal = String(signal || "BROWSER.ISSUE").replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 48);
  return `${safeSignal}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}
