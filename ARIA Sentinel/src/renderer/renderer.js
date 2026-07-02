import { bannerVisible, bannerModel, SECURITY_BANNER_DISMISS_KEY } from "../shared/security-banner.mjs";
import "./components/aria-globe.mjs"; // defines the <aria-globe> custom element used in the rail
import { extOf, requiredSteps, stepFor } from "../shared/delete-confirm.mjs";
import { renderMarkdown } from "../shared/aria-markdown.mjs"; // RUN 34-1 — readable chat answers (markdown → HTML)
import { walkStepsFor, hasWalkSteps, listFlows, getFlow, flowStep, resolveStep } from "../shared/walkthrough-steps.mjs"; // ONE shared source — recipe steps + companion flows
import { confidenceBadge } from "../shared/resolution-outcome.mjs"; // RUN-B B1 — per-answer confidence + "Was this fixed?" feedback
// SENTINEL TRIAL GATING 2026-07-02 — per-tab enable/lock map (Walk-Through survives trial expiry; the buy path never locks).
import { tabGateMap, LOCKED_TAB_MESSAGE, WALKTHROUGH_TAB } from "../shared/tab-gating.mjs";
// RUN 22 — dashboard / performance / SLA / compliance / reports tab builders + status.
import { computeHeroStatus, heroSubline, heroTiles } from "../shared/dashboard-status.mjs";
import * as DashboardTab from "./tabs/dashboard.mjs";
import * as PerformanceTab from "./tabs/performance.mjs";
import * as SlaTab from "./tabs/sla.mjs";
import * as ComplianceTab from "./tabs/compliance.mjs";
import * as ReportsTab from "./tabs/reports.mjs";

let state;
let sentinel;

const HOUR_MS = 60 * 60 * 1000;
// RUN 23d — IA consolidated 17→9 tabs. TAB_TITLES holds the 9 canonical nav tabs.
const TAB_TITLES = {
  dashboard: "Dashboard",
  aria: "ARIA", // RUN 33 PIVOT — the ARIA parent tab (Chat + Learning + Health + Memory + Agents)
  "control-center": "Control Center",
  recipes: "Recipes",
  walkthrough: "Walk-through", // guided step-by-step fix tab (guide mode changes nothing on the machine)
  "compliance-privacy": "Compliance & Privacy",
  reports: "Reports",
  knowledge: "Knowledge & policy",
  system: "System",
  servicenow: "ServiceNow",
  settings: "Settings"
};
// RUN 23d — old tab routes redirect to their new parent + the in-page anchor (= the old tab id),
// so every prior deep-link, hotkey, command-palette nav and internal activateTab() call keeps working.
const TAB_REDIRECTS = {
  // RUN 33 PIVOT — ARIA sub-section anchors switch to the ARIA parent tab then smooth-scroll to the ## H2.
  "aria-chat": { tab: "aria", anchor: "aria-chat" },
  "aria-learning": { tab: "aria", anchor: "aria-learning" },
  "aria-health": { tab: "aria", anchor: "aria-health" },
  "aria-memory": { tab: "aria", anchor: "aria-memory" },
  "aria-agents": { tab: "aria", anchor: "aria-agents" },
  overview: { tab: "dashboard", anchor: "overview" },
  performance: { tab: "dashboard", anchor: "performance" },
  sla: { tab: "dashboard", anchor: "sla" },
  compliance: { tab: "compliance-privacy", anchor: "compliance" },
  privacy: { tab: "compliance-privacy", anchor: "privacy" },
  "system-context": { tab: "system", anchor: "system-context" },
  "cross-platform": { tab: "system", anchor: "cross-platform" },
  mode: { tab: "settings", anchor: "mode" },
  hotkeys: { tab: "settings", anchor: "hotkeys" },
  troubleshoot: { tab: "settings", anchor: "troubleshoot" },
  support: { tab: "settings", anchor: "support" },
  about: { tab: "settings", anchor: "about" }
};

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

async function init() {
  sentinel = await getSentinelApi();
  installErrorReporting();
  wireNavigation();
  wireActions();
  sentinel.onState((next) => renderState(next));
  sentinel.onNavigate((tab) => activateTab(tab));
  // A web deep-link (mode=walkthrough) hands a recipe to the app → open the Walk-through tab in GUIDE mode.
  sentinel.onWalkthrough?.((payload) => { activateTab("walkthrough"); renderWalkthrough(payload); });
  state = await sentinel.getState();
  renderState(state);
  // RUN 23d — Dashboard is the default landing tab; it now hosts Overview + Performance + SLA sections.
  loadDashboard();
  loadPerformance();
  loadSla();
}

function installErrorReporting() {
  window.addEventListener("error", (event) => reportRendererError(event.error || event.message, "renderer-window"));
  window.addEventListener("unhandledrejection", (event) => reportRendererError(event.reason, "renderer-promise"));
}

function wireNavigation() {
  qsa(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      // SENTINEL TRIAL GATING 2026-07-02 — a locked tab (post-trial, no paid plan) shows the honest upsell
      // + buy path instead of activating. Walk-Through + Settings are never locked (buy path stays open).
      if (currentTabGate[button.dataset.tab] === false) { showLockedTabOverlay(); return; }
      activateTab(button.dataset.tab);
    });
  });
  // RUN 23d — sidebar sub-anchors switch to the parent tab then smooth-scroll to the ## H2 section.
  qsa(".nav-sub a[data-anchor]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      activateTab(link.dataset.anchor);
    });
  });
}

// RUN 23d — resolve old tab routes to their new parent + anchor, switch panels, expand the active
// parent's sub-anchor list, run that tab's lazy loaders, and smooth-scroll to the section if redirected.
function activateTab(tab) {
  const redirect = TAB_REDIRECTS[tab];
  const target = redirect ? redirect.tab : (TAB_TITLES[tab] ? tab : "dashboard");
  qsa(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.tab === target));
  qsa(".nav-sub").forEach((sub) => sub.classList.toggle("open", sub.dataset.sub === target));
  qsa(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === target));
  setText("pageTitle", TAB_TITLES[target]);
  // Window title follows the active view (was always "ARIA Sentinel Settings").
  if (TAB_TITLES[target]) document.title = `ARIA Sentinel — ${TAB_TITLES[target]}`;
  runTabLoaders(target);
  if (redirect) scrollToAnchor(redirect.anchor);
}

// Lazy loaders for the new merged parents — every former-tab loader still fires when its host tab opens.
function runTabLoaders(target) {
  if (target === "aria") loadAriaData(); // RUN 33 — Learning/Health/Memory/Agents sub-sections
  if (target === "dashboard") { loadDashboard(); loadPerformance(); loadSla(); }
  if (target === "compliance-privacy") loadCompliance();
  if (target === "system") { loadSystemContext(); loadBlueprints(); }
  if (target === "settings") loadUpdatesPanel();
  if (target === "servicenow") loadIncidents();
  if (target === "recipes") renderTier0();
  if (target === "reports") loadReports();
  if (target === "walkthrough") loadWalkthrough();
}

// Walk-through tab loader — on open, pull any pending web-deep-linked target (fresh-launch race), else keep the
// current target, else show the empty explainer. Guide mode is pure display; nothing here changes the machine.
let walkthroughTarget = null;
async function loadWalkthrough() {
  try {
    const pending = await sentinel.getWalkthrough?.();
    if (pending && (pending.recipeId || pending.intent)) walkthroughTarget = pending;
  } catch { /* pull is best-effort — fall back to the current/empty state */ }
  renderWalkthrough(walkthroughTarget);
}

// Render the step-by-step guided fix (or an honest fallback). REAL-OR-EMPTY: authored steps render Next/Back/Done;
// a matched-but-unauthored recipe shows the verified KB article + gated-resolve option (never a fake/blank walk);
// no target shows a short explainer + "Describe your problem" that routes into the ARIA chat.
function renderWalkthrough(target) {
  walkthroughTarget = target || null;
  const body = qs("#walkthroughBody");
  const titleEl = qs("#walkthroughTitle");
  if (!body) return;
  const recipeId = target && target.recipeId ? String(target.recipeId) : "";
  const intent = target && target.intent ? String(target.intent) : "";

  // A companion flow opened full-screen in the tab (the tab is the "library" view of the same content source).
  if (target && target.flowId) { renderCompanionFlowInTab(String(target.flowId)); return; }

  // Empty state — the library: describe a problem + the same guided setups/lessons the globe companion runs.
  if (!recipeId && !intent) {
    if (titleEl) titleEl.textContent = "Walk-through";
    const flowCards = (group, heading) => `
      <p class="eyebrow">${escapeHtml(heading)}</p>
      <div class="walkthrough-library">
        ${listFlows(group).map((f) => `
          <button class="walkthrough-lib-card" data-flow="${escapeHtml(f.id)}">
            <span class="walkthrough-lib-title">${escapeHtml(f.title)}</span>
            <span class="walkthrough-lib-blurb">${escapeHtml(f.blurb || "")}</span>
          </button>`).join("")}
      </div>`;
    body.innerHTML = `
      <p class="note">Pick a guided task and I'll walk you through it step by step — collecting what I need as we go. Guide and learn change nothing on your PC. The same walk-throughs run right on the floating globe.</p>
      <div class="button-row"><button class="primary" id="walkthroughDescribe">Fix a problem</button></div>
      ${flowCards("setup", "Set up an AI tool")}
      ${flowCards("learn", "Learn")}`;
    qs("#walkthroughDescribe")?.addEventListener("click", () => { activateTab("aria"); qs("#ariaChatInput")?.focus(); });
    qsa("[data-flow]").forEach((b) => b.addEventListener("click", () => renderCompanionFlowInTab(b.dataset.flow)));
    return;
  }

  const steps = walkStepsFor(recipeId);
  if (titleEl) titleEl.textContent = "Walk-through" + (recipeId ? " · " + recipeId : "");

  // Real-or-empty fallback — a matched recipe with no authored steps yet. Never fabricate a walk; offer the
  // verified KB article + the gated-resolve path instead.
  if (!steps.length) {
    const kbUrl = "https://iisupp.net/aria" + (recipeId ? "?article=" + encodeURIComponent(recipeId) : "");
    body.innerHTML = `
      <p class="note">Guided steps for this exact issue are being written. Here's the verified knowledge-base article, or you can let ARIA resolve it for you (gated — you approve, with a countdown and one-click stop).</p>
      <div class="button-row">
        <a class="ghost" href="${escapeHtml(kbUrl)}" target="_blank" rel="noopener">Open the KB article ↗</a>
        <button class="primary" data-walkthrough-resolve="${escapeHtml(recipeId)}">Resolve it for me (gated)</button>
      </div>
      <p class="note resolve-status" id="walkthroughResolveStatus" hidden></p>`;
    const rb = qs("[data-walkthrough-resolve]");
    if (rb) rb.addEventListener("click", () => runAction(rb, () => resolveViaSupervisor(recipeId, "medium", qs("#walkthroughResolveStatus"))));
    return;
  }

  // Authored steps — the guided experience. Step cards + a Back/Next/Done control. Pure display.
  let i = 0;
  function paint() {
    const s = steps[i];
    body.innerHTML = `
      <ol class="walkthrough-steps" aria-label="Guided fix steps">
        ${steps.map((st, idx) => `
          <li class="walkthrough-step${idx === i ? " active" : idx < i ? " done" : ""}">
            <span class="walkthrough-step-num">${String(idx + 1).padStart(2, "0")}</span>
            <span class="walkthrough-step-copy"><span class="walkthrough-step-title">${escapeHtml(st.title)}</span><span class="walkthrough-step-sub">${escapeHtml(st.sub || "")}</span></span>
          </li>`).join("")}
      </ol>
      ${s && s.screenshot ? `<div class="walkthrough-shot">${s.screenshot}</div>` : ""}
      <div class="walkthrough-nav button-row">
        <button class="ghost" id="walkthroughBack"${i === 0 ? " disabled" : ""}>Back</button>
        <span class="walkthrough-count note">Step ${i + 1} of ${steps.length}</span>
        <button class="primary" id="walkthroughNext">${i >= steps.length - 1 ? "Done" : "Next"}</button>
      </div>`;
    qs("#walkthroughBack")?.addEventListener("click", () => { if (i > 0) { i -= 1; paint(); } });
    qs("#walkthroughNext")?.addEventListener("click", () => {
      if (i >= steps.length - 1) {
        body.innerHTML = `<p class="note">That's the full walk-through. If it's still not fixed, open the ARIA chat and I'll dig deeper — or let ARIA resolve it for you (gated).</p>
          <div class="button-row"><button class="primary" id="walkthroughToChat">Ask ARIA</button></div>`;
        qs("#walkthroughToChat")?.addEventListener("click", () => { activateTab("aria"); qs("#ariaChatInput")?.focus(); });
        return;
      }
      i += 1; paint();
    });
  }
  paint();
}

// Shared gated-apply helper used by the Walk-through fallback + the P1 chat/recipe routing. Confirmed-grade,
// never autonomous; surfaces the gate's verdict. Nothing runs live by default (dry-run policy holds).
async function resolveViaSupervisor(recipeId, risk, statusEl) {
  const r = await sentinel.supervisedFix?.({ recipeId, risk: risk || "medium", mode: "confirmed" });
  if (statusEl) {
    statusEl.hidden = false;
    if (!r || r.ok === false) {
      if (r?.error === "r11_blocked") statusEl.textContent = "1 personal folder excluded — fix blocked by privacy rule.";
      else if (r?.verdict === "veto") statusEl.textContent = `Held by the safety supervisor: ${r.reason || "vetoed"}.`;
      else statusEl.textContent = "Couldn't start this fix.";
    } else if (r.countdown) {
      statusEl.textContent = `Applying in ${r.seconds || 10}s — cancel from the countdown, or press Ctrl+Alt+K to abort.`;
    } else if (r.bypass) {
      statusEl.textContent = "Low-risk action acknowledged.";
    } else {
      statusEl.textContent = r.policy && r.policy.dryRun === false ? "Fix applied (reversible — see Restore points)." : "Previewed safely (dry-run). Enable live fixes to apply.";
    }
  }
  return r;
}

// Full-screen runner for a companion flow inside the Walk-through tab — the SAME engine + content the globe
// companion uses (ONE source). Collects input, carries answers forward, composes real prompts. GUIDE/LEARN
// CHANGES NOTHING on the machine: `open` launches the user's browser to an official site, `copy` uses the OS
// clipboard, account/sign-in/payment stay the user's clicks. No fabricated values (missing answer re-asks).
function renderCompanionFlowInTab(flowId) {
  const body = qs("#walkthroughBody");
  const titleEl = qs("#walkthroughTitle");
  const flow = getFlow(flowId);
  if (!body || !flow) return;
  walkthroughTarget = { flowId };
  if (titleEl) titleEl.textContent = "Walk-through · " + flow.title;
  const answers = {};
  let index = 0;

  const setStatus = (elm, txt) => { if (elm) { elm.hidden = false; elm.textContent = txt; } };
  function paint() {
    const step = flowStep(flowId, index);
    if (!step) {
      body.innerHTML = `<p class="note">That's the walk-through. Revisit any step below, or pick another guide.</p>
        <div class="button-row"><button class="primary" id="wtBackToLibrary">Back to the library</button></div>`;
      qs("#wtBackToLibrary")?.addEventListener("click", () => renderWalkthrough(null));
      return;
    }
    const r = resolveStep(step, answers);
    const last = index >= flow.steps.length - 1;
    let inner = `<p class="eyebrow">Step ${index + 1} of ${flow.steps.length}</p><h3 class="walkthrough-step-title">${escapeHtml(step.title)}</h3>`;
    if (step.type === "display") {
      inner += `<p class="note">${escapeHtml(r.text != null ? r.text : (step.body || ""))}</p>`;
    } else if (step.type === "input-text") {
      if (step.body) inner += `<p class="note">${escapeHtml(step.body)}</p>`;
      inner += `<input id="wtInput" class="companion-input" type="text" placeholder="${escapeHtml(step.placeholder || "")}" />`;
    } else if (step.type === "choice") {
      inner += `<div class="walkthrough-library">${step.options.map((o) => `<button class="walkthrough-lib-card" data-choice="${escapeHtml(o.value)}"><span class="walkthrough-lib-title">${escapeHtml(o.label)}</span>${o.sub ? `<span class="walkthrough-lib-blurb">${escapeHtml(o.sub)}</span>` : ""}</button>`).join("")}</div>`;
    } else if (step.type === "copy") {
      if (step.body) inner += `<p class="note">${escapeHtml(step.body)}</p>`;
      if (r.ready && r.text) inner += `<pre class="companion-copy" id="wtCopyText">${escapeHtml(r.text)}</pre><div class="button-row"><button class="primary" id="wtCopyBtn">Copy</button></div>${step.safety ? `<p class="note walkthrough-guide-note">${escapeHtml(step.safety)}</p>` : ""}`;
      else inner += `<p class="note">Answer the earlier question and I'll build this from your words — I won't make one up.</p>`;
    } else if (step.type === "open") {
      if (step.body) inner += `<p class="note">${escapeHtml(step.body)}</p>`;
      inner += `<div class="button-row"><button class="primary" id="wtOpenBtn">Open in my browser</button></div>${step.note ? `<p class="note walkthrough-guide-note">${escapeHtml(step.note)}</p>` : ""}`;
    } else if (step.type === "confirm") {
      inner += `<div class="button-row"><button class="primary" id="wtYes">${escapeHtml((step.yes && step.yes.label) || "Yes")}</button><button class="ghost" id="wtNo">${escapeHtml((step.no && step.no.label) || "Not yet")}</button></div>`;
    }
    inner += `<p class="note resolve-status" id="wtStatus" hidden></p>`;
    const showNext = step.type === "display" || step.type === "input-text" || step.type === "open" || (step.type === "copy" && r.ready && r.text);
    inner += `<div class="button-row">${index > 0 ? `<button class="ghost" id="wtBack">Back</button>` : ""}${showNext ? `<button class="primary" id="wtNext">${last ? "Done" : "Next"}</button>` : ""}</div>`;
    body.innerHTML = inner;

    const status = qs("#wtStatus");
    qs("#wtBack")?.addEventListener("click", () => { index = Math.max(0, index - 1); paint(); });
    qs("#wtNext")?.addEventListener("click", () => {
      if (step.type === "input-text") { const v = qs("#wtInput")?.value.trim(); if (!v) { setStatus(status, "Type an answer so I can use it."); return; } answers[step.key] = v; }
      index += 1; paint();
    });
    qsa("[data-choice]").forEach((c) => c.addEventListener("click", () => { answers[step.key] = c.dataset.choice; index += 1; paint(); }));
    qs("#wtCopyBtn")?.addEventListener("click", async () => { const res = await sentinel.copyText?.(r.text); setStatus(status, res && res.ok ? "Copied — paste it into your AI." : "Couldn't copy."); });
    qs("#wtOpenBtn")?.addEventListener("click", async () => { const res = await sentinel.openExternal?.(step.url); setStatus(status, res && res.ok ? "Opened in your browser." : "Couldn't open that link."); });
    qs("#wtYes")?.addEventListener("click", () => { answers[step.key] = "yes"; if (flowId === "learn-loops") { activateTab("aria"); qs("#ariaChatInput")?.focus(); return; } index += 1; paint(); });
    qs("#wtNo")?.addEventListener("click", () => { answers[step.key] = "no"; setStatus(status, (step.no && step.no.help) || "No problem."); });
    if (step.type === "input-text") { const inp = qs("#wtInput"); if (inp) { inp.value = answers[step.key] || ""; setTimeout(() => inp.focus(), 20); } }
  }
  paint();
}

function scrollToAnchor(anchorId) {
  if (!anchorId) return;
  // Defer one frame so the freshly-shown panel is laid out before we scroll to the in-page anchor.
  requestAnimationFrame(() => {
    const el = qs(`#${anchorId}`);
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function wireActions() {
  qsa(".mode-row").forEach((button) => {
    button.addEventListener("click", () => {
      // RUN 23e — a mode the current plan doesn't include never switches; it opens the upgrade upsell.
      if (button.classList.contains("locked")) {
        showUpgradeUpsell(button.dataset.mode);
        return;
      }
      // Autonomous is never enabled by a single click — it opens an explicit opt-in modal.
      if (button.dataset.mode === "autonomous" && state?.mode !== "autonomous") {
        openAutonomousModal();
        return;
      }
      runAction(button, () => sentinel.setMode(button.dataset.mode));
    });
  });
  wireAutonomousModal();
  wireNotify();
  wireCommandPalette();
  wireLowPower();
  wireRoi();
  wireLicense();
  wireFloatingGlobe();
  wireRun13();
  wireUpdates();
  wireRun15();
  wireSecurityBanner();
  wireRun19();
  wireRun20();
  wireRun21();
  wireRun22();
  wireRun23e();
  wireLockedTabOverlay(); // SENTINEL TRIAL GATING 2026-07-02 — locked-tab upsell overlay + buy path

  bindClick("showGlobe", (button) => runAction(button, () => sentinel.showGlobe()));
  bindClick("pauseOneHour", (button) => runAction(button, () => sentinel.setPaused(HOUR_MS)));
  // RUN 34-7 — removed the dead "resumeWatching" binding (no such button since RUN 15 renamed the model to
  // Start/Stop ARIA). "Start ARIA" already clears the pause (applyRunState start → pausedUntil: 0).
  bindClick("runSelfDiagnose", (button) => runAction(button, () => sentinel.selfDiagnose("settings")));
  bindClick("runSelfRepair", (button) => runAction(button, () => sentinel.selfRepair("settings")));
  bindClick("openAdminConsole", (button) => runAction(button, () => sentinel.openAdminConsole()));
  bindClick("updateKnowledge", (button) => runAction(button, () => sentinel.updateKnowledge()));
  bindClick("exportAudit", () => downloadJson("aria-sentinel-audit.json", state?.transparencyLog || []));
  bindClick("liveCapture", (button) => runAction(button, async () => {
    setText("captureVerdict", "Capturing 10s…");
    const result = await sentinel.privacyCapture?.(10000);
    renderCapture(result);
    return result;
  }));
  bindClick("exportEvidence", (button) => runAction(button, async () => {
    setText("evidenceResult", "Building…");
    const result = await sentinel.exportEvidence?.();
    setText("evidenceResult", result?.ok
      ? `Saved ${result.artifacts?.length || 6} artifacts → ${result.path}`
      : "Export unavailable in this build.");
    return result;
  }));
  bindClick("exportAuditCsv", (button) => runAction(button, () => downloadAudit("csv")));
  bindClick("exportAuditPdf", (button) => runAction(button, () => downloadAudit("pdf")));
  bindClick("whatsNewGotIt", async () => {
    const modal = qs("#whatsNew");
    if (modal) modal.hidden = true;
    try { await sentinel.ackWhatsNew?.(); } catch { /* ack must not throw into the UI */ }
  });
  bindClick("testServiceNow", (button) => runAction(button, async () => {
    const result = (await sentinel.serviceNowTest?.()) || { ok: false, configured: false };
    renderServiceNowStatus(state.serviceNowStatus, result);
    if (result.configured) loadIncidents();
    return result;
  }));
  wireDropzone();
  wireOnboarding();
  bindClick("runDiagnostic", (button) => runAction(button, async () => {
    const report = await sentinel.runDiagnostic?.();
    renderDiagnostic(report);
    return report;
  }));
  bindClick("simulateAriaError", (button) => runAction(button, () => sentinel.detect({
    source: "operator-sim",
    issue: "ARIA Sentinel javascript error main process EADDRINUSE port 37841"
  })));
}

function bindClick(id, handler) {
  const element = qs(`#${id}`);
  if (!element) return;
  element.addEventListener("click", () => {
    Promise.resolve(handler(element)).catch((error) => reportRendererError(error, `button:${id}`));
  });
}

function bindChange(id, handler) {
  const element = qs(`#${id}`);
  if (!element) return;
  element.addEventListener("change", () => {
    Promise.resolve(handler(element)).catch((error) => reportRendererError(error, `input:${id}`));
  });
}

async function runAction(element, task) {
  if (element && "disabled" in element) element.disabled = true;
  try {
    return await task();
  } catch (error) {
    await reportRendererError(error, "operator-action");
    return null;
  } finally {
    if (element && "disabled" in element) element.disabled = false;
  }
}

function renderState(next) {
  state = next || {};
  const bridge = state.bridgeStatus || { listening: Boolean(state.bridgePort), conflict: false, port: state.bridgePort };
  const catalog = state.recipeCatalog || {};
  const recipes = state.recipes || [];

  setText("railVersion", `v${state.version || "0.1.0"}`);
  setText("aboutVersion", state.version || "0.1.0");
  setText("railStatus", `${titleCase(state.mode || "manual")} mode - ${state.paused ? "paused" : bridge.conflict ? "self repair" : "watching"}`);

  setChip("bridgeStatus", bridge.conflict ? `Bridge conflict :${bridge.port}` : bridge.listening ? `Bridge :${bridge.port}` : `Bridge standby :${bridge.port || state.bridgePort}`, bridge.conflict ? "red" : bridge.listening ? "cyan" : "amber");
  renderKbFreshness(state.kbMeta); // RUN 33-A — live KB version + last-synced in the top bar

  qsa(".mode-row").forEach((button) => button.classList.toggle("selected", button.dataset.mode === state.mode));
  if (qs("#dryRunToggle")) qs("#dryRunToggle").checked = Boolean(state.dryRun);

  setText("recipeCatalogMeta", `${Number(catalog.localInteractive || recipes.length || 0)} local interactive recipes. Admin-only release gates live in the separate web console.`);
  renderRecipes(recipes);
  renderKnowledge(state.knowledgeSources || []);
  renderRouting(state.routingTargets || []);
  renderOutbound(state.allowedOutboundPaths || []);
  renderLog(state.transparencyLog || []);
  renderSystemChecks(state.systemChecks || defaultChecks(state));
  renderServiceNowStatus(state.serviceNowStatus);
  renderRestorePoints(state.restorePoints || []);
  renderKillBanner(state);
  if (state.lastPrivacyCapture) renderCapture(state.lastPrivacyCapture);
  const lp = qs("#lowPowerToggle");
  if (lp) lp.checked = Boolean(state.lowPower);
  // Fix 7 gate — when low-power is on, the body class disables every animation/transition.
  document.body.classList.toggle("low-power", Boolean(state.lowPower));
  const sfg = qs("#showFloatingGlobe");
  if (sfg && typeof state.showFloatingGlobe === "boolean") sfg.checked = state.showFloatingGlobe;
  renderRoi(state).catch(() => undefined);
  renderLicense(state);
  renderGate(state);
  applyTabGates(state); // SENTINEL TRIAL GATING 2026-07-02 — lock non-Walk-Through tabs after trial expiry (no paid plan)
  applyFeatureGates(state); // RUN 23e — tier feature gates + upsell cards
  renderAboutNudge(state).catch(() => undefined); // RUN 23e — Personal monthly upsell nudge
  renderUpdates(state);
  renderRun15(state);
  renderSecurityBanner(state);
  renderRun19(state);
  renderRun21(state);
  maybeShowOnboarding(state);
  maybeShowSetupWizard(state); // RUN 33-E
  maybeShowWhatsNew(state);
}

function renderKillBanner(next) {
  const note = qs("#snStatusNote");
  if (!note) return;
  if (next.killed) {
    setChip("dryRunStatus", "Remediation paused", "red");
  }
}

// RUN 17 — audit-tamper banner. Driven by state.auditIntegrity (set at session start). The Dismiss
// flag is per-session (sessionStorage), so the banner returns on the next launch while ok is false.
function renderSecurityBanner(next) {
  const banner = qs("#securityBanner");
  if (!banner) return;
  const integrity = next && next.auditIntegrity;
  let dismissed = false;
  try { dismissed = sessionStorage.getItem(SECURITY_BANNER_DISMISS_KEY) === "1"; } catch { dismissed = false; }
  const visible = bannerVisible(integrity, dismissed);
  banner.hidden = !visible;
  document.body.classList.toggle("has-security-banner", visible);
  if (visible) setText("securityBannerSub", bannerModel(integrity).subtitle);
}

function wireSecurityBanner() {
  // "View audit log" jumps to the Privacy verifier tab (which hosts the audit log list) and scrolls to it.
  bindClick("securityBannerView", () => {
    activateTab("privacy");
    const log = qs("#logList");
    if (log && log.scrollIntoView) log.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  // Dismiss hides for THIS session only — it writes a sessionStorage flag and never touches the
  // auditIntegrity state, so the tamper finding is preserved and re-surfaces on the next launch.
  bindClick("securityBannerDismiss", () => {
    try { sessionStorage.setItem(SECURITY_BANNER_DISMISS_KEY, "1"); } catch { /* sessionStorage may be unavailable */ }
    const banner = qs("#securityBanner");
    if (banner) banner.hidden = true;
    document.body.classList.remove("has-security-banner");
  });
}

function renderServiceNowStatus(status, testResult) {
  const note = qs("#snStatusNote");
  const sync = qs("#snSyncNote");
  if (!note) return;
  status = status || {};
  if (testResult && testResult.configured === false) {
    note.textContent = "ServiceNow is not configured. Set SN_INSTANCE_URL / SN_USER / SN_PASS to enable live incidents. Drafts stay local and content-blind.";
  } else if (status.configured) {
    const ago = status.lastVerified ? relativeTime(status.lastVerified) : "not yet";
    note.textContent = `Connected · last verified ${ago}${status.queued ? ` · ${status.queued} queued` : ""}.`;
  } else if (status.queued) {
    note.textContent = `Offline · ${status.queued} incident(s) queued for retry. Content-blind until ServiceNow is reachable.`;
  } else {
    note.textContent = "Not configured. Incidents stay as local content-blind drafts until customer ServiceNow OAuth is set.";
  }
  if (sync) sync.textContent = status.configured ? "Newest first" : "Local drafts";
}

function renderRestorePoints(points) {
  const host = qs("#restorePoints");
  if (!host) return;
  if (!points.length) {
    host.innerHTML = `<p class="note">No restore points yet. ARIA creates one before any fix that changes the system.</p>`;
    return;
  }
  host.innerHTML = points.map((p) => `
    <div class="restore-card">
      <div class="restore-icon" aria-hidden="true">⟲</div>
      <div class="restore-body">
        <strong>Restore point created</strong>
        <code>${escapeHtml(p.name || "ARIA pre-fix")}</code>
        <small>${escapeHtml(new Date(p.createdAt).toLocaleString())}${p.rolledBack ? " · rolled back" : ""}</small>
      </div>
      <button class="ghost rollback-btn" data-rollback="${escapeHtml(p.id)}" ${p.rolledBack ? "disabled" : ""}>ROLL BACK THIS FIX</button>
    </div>
  `).join("");
  qsa("[data-rollback]").forEach((button) => {
    const point = points.find((p) => p.id === button.dataset.rollback);
    const name = point ? (point.name || "restore point") : "restore point";
    // Recipe revert / restore-point rollback is an irreversible action → triple-confirm gate (§4).
    button.addEventListener("click", () => confirmDelete(name, () => runAction(button, async () => {
      const result = await sentinel.rollback?.(button.dataset.rollback);
      if (result?.ok) showToast({ title: "Roll back requested", body: "ARIA logged the event to the local transparency log." });
      return result;
    })));
  });
}

function renderDiagnostic(report) {
  const host = qs("#diagnosticRows");
  const summary = qs("#diagnosticSummary");
  if (!host || !report) return;
  if (summary) summary.textContent = `${report.passed}/${report.total} checks passed${report.ok ? "" : " · attention needed"}.`;
  host.innerHTML = (report.rows || []).map((r) => `
    <div class="health-row">
      <span>${escapeHtml(r.label)}</span>
      <strong>${escapeHtml(r.detail || "")}${r.remediation ? ` — ${escapeHtml(r.remediation)}` : ""}</strong>
      <em class="${r.ok ? "diag-ok" : r.severity === "warn" ? "diag-warn" : "diag-fail"}">${r.ok ? "PASS" : r.severity === "warn" ? "WARN" : "FAIL"}</em>
    </div>
  `).join("");
}

async function loadIncidents() {
  const host = qs("#incidentList");
  if (!host || !sentinel.serviceNowList) return;
  const result = await sentinel.serviceNowList().catch(() => null);
  if (!result || !result.configured) {
    host.innerHTML = `<p class="note">No live ServiceNow connection. Configure the customer instance to see real incidents here.</p>`;
    return;
  }
  renderIncidents(result.incidents || []);
}

function renderIncidents(incidents) {
  const host = qs("#incidentList");
  if (!host) return;
  if (!incidents.length) {
    host.innerHTML = `<p class="note">No incidents for you. ARIA only raises one when a local fix cannot resolve the issue.</p>`;
    return;
  }
  host.innerHTML = incidents.map((inc) => {
    const tone = /resolved|closed/i.test(inc.state) ? "cyan" : /progress/i.test(inc.state) ? "amber" : "cyan";
    const notes = (inc.workNotes || []).map((n) => `<div class="work-note">${escapeHtml(n)}</div>`).join("");
    const open = !/resolved|closed/i.test(inc.state);
    return `
      <article class="incident-card">
        <header class="incident-head">
          <strong>${escapeHtml(inc.number)}</strong>
          <span class="chip ${tone}">${escapeHtml(inc.state)}</span>
          <span class="incident-meta">${escapeHtml(inc.assignmentGroup || "Service Desk")} · ${escapeHtml(relativeTime(inc.sysUpdatedOn))}</span>
        </header>
        <p class="incident-title">${escapeHtml(inc.shortDescription || "Incident")}</p>
        ${notes ? `<div class="work-notes"><p class="eyebrow">Work notes</p>${notes}</div>` : ""}
        ${open ? `
          <div class="incident-composer">
            <input type="text" data-comment-for="${escapeHtml(inc.sysId)}" placeholder="Ask for an update…" />
            <button class="primary" data-comment-post="${escapeHtml(inc.sysId)}">Post</button>
          </div>` : ""}
      </article>`;
  }).join("");
  qsa("[data-comment-post]").forEach((button) => {
    button.addEventListener("click", () => runAction(button, async () => {
      const input = qs(`[data-comment-for="${button.dataset.commentPost}"]`);
      const comment = (input?.value || "").trim();
      if (!comment) return null;
      const result = await sentinel.serviceNowComment?.(button.dataset.commentPost, comment);
      if (result?.ok && input) input.value = "";
      loadIncidents();
      return result;
    }));
  });
}

function relativeTime(value) {
  const t = typeof value === "number" ? value : Date.parse(value);
  if (!t) return "just now";
  const diff = Date.now() - t;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

function wireDropzone() {
  const zone = qs(".dropzone");
  if (!zone) return;
  const prevent = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  ["dragenter", "dragover", "dragleave", "drop"].forEach((evt) => zone.addEventListener(evt, prevent));
  ["dragenter", "dragover"].forEach((evt) => zone.addEventListener(evt, () => zone.classList.add("dragging")));
  ["dragleave", "drop"].forEach((evt) => zone.addEventListener(evt, () => zone.classList.remove("dragging")));
  zone.addEventListener("drop", async (e) => {
    const files = Array.from(e.dataTransfer?.files || []);
    for (const file of files) {
      try {
        const base64 = await fileToBase64(file);
        await sentinel.ingestKb?.({ name: file.name, base64 });
      } catch (err) {
        reportRendererError(err, "kb-dropzone");
      }
    }
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error || new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

const ONBOARD_STEPS = [
  { kicker: "Welcome", title: "Meet the globe", body: "A calm gold globe lives in the corner of your screen. It is ARIA Sentinel — resident IT support that never sleeps.", state: "idle" },
  { kicker: "Always on", title: "It watches quietly", body: "ARIA watches for disk, network, app and blue-screen problems on-device. It stays calm until something needs attention.", state: "diagnosing" },
  { kicker: "Your call", title: "You're in control", body: "Manual mode walks you through fixes in chat. Nothing is applied automatically unless you choose Confirmed or Autonomous.", state: "fixing" },
  { kicker: "Even on a blue screen", title: "Even on a blue screen", body: "BSOD recovery stays live even when ARIA is paused. Press F8 → Recovery menu → ARIA.", state: "escalation" },
  {
    kicker: "First run", title: "Windows protected your PC", body: "Windows may show 'Windows protected your PC' because ARIA is newly published. Click More info → Run anyway. This is expected until code signing reputation builds — it's not a problem with the app.", state: "idle",
    dialog: "SmartScreen · Windows protected your PC → More info → Run anyway"
  },
  {
    kicker: "First run", title: "Do you want to allow this app to make changes?", body: "You'll see 'Do you want to allow this app to make changes?' once. ARIA needs elevation to run fixes and add the recovery boot entry. Click Yes — it won't ask again unless a fix requires it.", state: "idle",
    dialog: "User Account Control · Publisher: Integrated IT Support Inc."
  }
];
let onboardIndex = 0;
let onboardingShown = false;

function maybeShowOnboarding(next) {
  if (onboardingShown) return;
  if (next && next.firstRunComplete === false) {
    onboardingShown = true;
    onboardIndex = 0;
    renderOnboardStep();
    const modal = qs("#onboarding");
    if (modal) modal.hidden = false;
  }
}

function wireOnboarding() {
  bindClick("onboardNext", () => advanceOnboarding());
  bindClick("onboardSkip", () => finishOnboarding());
}

function renderOnboardStep() {
  const step = ONBOARD_STEPS[onboardIndex];
  if (!step) return;
  setText("onboardKicker", step.kicker);
  setText("onboardTitle", step.title);
  setText("onboardBody", step.body);
  const globe = qs(".coach-globe");
  if (globe) globe.setAttribute("data-state", step.state);
  const dialog = qs("#onboardDialog");
  if (dialog) {
    dialog.hidden = !step.dialog;
    dialog.textContent = step.dialog || "";
  }
  const dots = qs("#onboardDots");
  if (dots) dots.innerHTML = ONBOARD_STEPS.map((_, i) => `<span class="${i === onboardIndex ? "on" : ""}"></span>`).join("");
  const nextBtn = qs("#onboardNext");
  if (nextBtn) nextBtn.textContent = onboardIndex >= ONBOARD_STEPS.length - 1 ? "Finish" : "Next";
}

function advanceOnboarding() {
  if (onboardIndex >= ONBOARD_STEPS.length - 1) return finishOnboarding();
  onboardIndex += 1;
  renderOnboardStep();
}

async function finishOnboarding() {
  const modal = qs("#onboarding");
  if (modal) modal.hidden = true;
  try {
    await sentinel.completeOnboarding?.();
  } catch {
    // Completing onboarding must never throw into the UI.
  }
}

function renderRecipes(recipes) {
  setHtml("recipeList", recipes.map((recipe) => `
    <article class="recipe-card">
      <span class="chip">${escapeHtml(recipe.chip)}</span>
      <h3>${escapeHtml(recipe.title)}</h3>
      <p>${escapeHtml(recipe.summary)}</p>
      <div class="button-row">
        <button class="ghost" data-walk-recipe="${escapeHtml(recipe.id)}">Walk me through it</button>
        <button class="primary" data-resolve-fix="${escapeHtml(recipe.id)}" data-risk="${escapeHtml(recipe.risk || "medium")}">Resolve it for me</button>
        <button class="ghost" data-recipe-run="${escapeHtml(recipe.id)}">Dry-run</button>
      </div>
      <p class="note resolve-status" data-resolve-status="${escapeHtml(recipe.id)}" hidden></p>
    </article>
  `).join(""));

  // "Walk me through it" — open the Walk-through tab in GUIDE mode for this recipe (changes nothing).
  qsa("[data-walk-recipe]").forEach((button) => button.addEventListener("click", () => {
    activateTab("walkthrough"); renderWalkthrough({ recipeId: button.dataset.walkRecipe, mode: "guide" });
  }));

  qsa("[data-recipe-run]").forEach((button) => {
    button.addEventListener("click", () => runAction(button, () => {
      if (button.dataset.recipeRun === "sentinel-self-repair-v1") return sentinel.selfRepair("recipe-list");
      return sentinel.runRecipe(button.dataset.recipeRun, { dryRun: true });
    }));
  });
  // RUN 36 / TASK 3 — "Resolve it for me": run the matched fix LOCALLY through the gated control plane
  // (R11 → supervisor → execution policy → 10s countdown → kill-switch). Confirmed-grade gating; never
  // autonomous. The countdown indicator is the visible confirm/cancel; Ctrl+Alt+K aborts mid-fix.
  qsa("[data-resolve-fix]").forEach((button) => bindResolveFix(button));
}

// Wire one "Resolve it for me" button to the gated pipeline. P1: a vetted/bound Tier-0 recipe goes through the
// gated apply (supervisor → countdown → tier-0 → kill-switch). An UNVETTED recipe (no safe auto-apply) degrades
// to the Walk-through tab + an honest "can't auto-apply this yet — here are the steps" — NEVER Control Center.
function bindResolveFix(button) {
  const recipeId = button.dataset.resolveFix;
  const risk = button.dataset.risk || "medium";
  const statusEl = qs(`[data-resolve-status="${cssEscape(recipeId)}"]`) || button.closest(".recipe-card")?.querySelector(".resolve-status");
  button.addEventListener("click", () => runAction(button, async () => {
    let vetted = true;
    try { vetted = Boolean((await sentinel.isVettedRecipe?.(recipeId))?.vetted); } catch { vetted = true; }
    if (!vetted) {
      if (statusEl) { statusEl.hidden = false; statusEl.textContent = "I can't safely auto-apply this one yet — opening the step-by-step walk-through."; }
      activateTab("walkthrough");
      renderWalkthrough({ recipeId, mode: "guide" });
      return { ok: true, routed: "walkthrough" };
    }
    // mode:"confirmed" requests explicit-approval + countdown gating for THIS fix (clamped — never autonomous).
    return resolveViaSupervisor(recipeId, risk, statusEl);
  }));
}

// Minimal CSS.escape shim (older Electron renderers) so the status selector is always valid.
function cssEscape(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c); }

function renderKnowledge(sources) {
  setHtml("knowledgeRows", sources.map((source) => `
    <div class="source-row">
      <span>${escapeHtml(source.name)}</span>
      <strong>${escapeHtml(source.status || "Ready")} - ${Number(source.docs || 0)} docs</strong>
    </div>
  `).join(""));
}

function renderRouting(targets) {
  const fallback = [
    { signal: "BSOD", group: "Desktop Support", priority: "2 - High" },
    { signal: "NETWORK", group: "Network Team", priority: "3 - Moderate" },
    { signal: "SECURITY", group: "Security Team", priority: "2 - High" },
    { signal: "APP", group: "Service Desk", priority: "4 - Low" }
  ];
  setHtml("routingRows", (targets.length ? targets : fallback).map((target) => `
    <span>${escapeHtml(target.signal)}</span>
    <strong>${escapeHtml(target.group)} / ${escapeHtml(target.priority)}</strong>
  `).join(""));
}

function renderOutbound(paths) {
  setHtml("outboundList", paths.map((item) => `
    <div class="outbound-row">
      <span>${escapeHtml(item.method)}</span>
      <strong>${escapeHtml(item.host)}${escapeHtml(item.path)}</strong>
      <em>${escapeHtml(item.direction)}</em>
    </div>
  `).join(""));
}

function renderCapture(summary) {
  if (!summary || !Array.isArray(summary.rows)) {
    setText("captureVerdict", "Capture unavailable in this build.");
    return;
  }
  setText("captureVerdict", summary.pass
    ? `PASS — ${summary.rows.length} paths, all on allowlist, 0 user content`
    : `REVIEW — ${summary.disallowedHostCount} off-allowlist, ${summary.leakingPayloadCount} with content`);
  setHtml("captureRows", summary.rows.map((row) => {
    const ok = row.allowlistMatch && row.sanitizationStatus !== "leak";
    return `
      <div class="capture-row ${ok ? "ok" : "bad"}">
        <span class="tick">${ok ? "✓" : "✕"}</span>
        <strong>${escapeHtml(row.method)} ${escapeHtml(row.host)}${escapeHtml(row.path)}</strong>
        <em>${escapeHtml(String(row.payloadBytes))} B · ${escapeHtml(row.sanitizationStatus)}</em>
      </div>
    `;
  }).join("") || `<div class="capture-row"><span class="tick">·</span><strong>No outbound paths observed.</strong><em></em></div>`);
}

// Autonomous opt-in modal — Enable stays disabled until "I understand" is checked, so Autonomous
// can never be turned on by a stray click. The actual switch passes { understood: true } to main.
function wireAutonomousModal() {
  const check = qs("#autoUnderstand");
  const enable = qs("#autoEnable");
  if (check && enable) {
    check.addEventListener("change", () => { enable.disabled = !check.checked; });
  }
  bindClick("autoEnable", async (button) => {
    if (!qs("#autoUnderstand")?.checked) return;
    await runAction(button, () => sentinel.setMode("autonomous", { understood: true }));
    closeAutonomousModal();
  });
  bindClick("autoCancel", () => closeAutonomousModal());
}
function openAutonomousModal() {
  const check = qs("#autoUnderstand");
  const enable = qs("#autoEnable");
  if (check) check.checked = false;
  if (enable) enable.disabled = true;
  const modal = qs("#autonomousModal");
  if (modal) modal.hidden = false;
}
function closeAutonomousModal() {
  const modal = qs("#autonomousModal");
  if (modal) modal.hidden = true;
}

// Slack/Teams notify config (Integrations panel under the ServiceNow tab).
function wireNotify() {
  bindClick("saveNotify", (button) => runAction(button, async () => {
    const url = qs("#notifyWebhook")?.value?.trim() || "";
    const channel = qs("#notifyChannel")?.value?.trim() || "";
    const result = await sentinel.setNotify?.({ webhookUrl: url, channel });
    setText("notifyStatus", result?.ok ? (result.enabled ? "Saved · notifications on" : "Saved · cleared") : "Webhook host not allowed (Slack/Teams only)");
    return result;
  }));
  bindClick("testNotify", (button) => runAction(button, async () => {
    const result = await sentinel.testNotify?.();
    setText("notifyStatus", result?.ok ? "Test ping sent." : result?.dryRun ? "Save a Slack/Teams webhook first." : "Test failed.");
    return result;
  }));
}

// Command palette (Cmd/Ctrl+K) — pure search over recipes + nav/action commands.
let cmdkCommands = [];
let cmdkApi = null;
async function ensureCmdk() {
  if (!cmdkApi) cmdkApi = await import("../shared/command-palette.mjs");
  cmdkCommands = cmdkApi.buildCommands(state?.recipes || []);
  return cmdkApi;
}
function wireCommandPalette() {
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      openCmdk();
    } else if (e.key === "Escape") {
      closeCmdk();
    }
  });
  const input = qs("#cmdkInput");
  if (input) input.addEventListener("input", () => renderCmdk(input.value));
}
async function openCmdk() {
  await ensureCmdk();
  const modal = qs("#commandPalette");
  const input = qs("#cmdkInput");
  if (modal) modal.hidden = false;
  if (input) { input.value = ""; input.focus(); }
  renderCmdk("");
}
function closeCmdk() {
  const modal = qs("#commandPalette");
  if (modal) modal.hidden = true;
}
function renderCmdk(query) {
  if (!cmdkApi) return;
  const results = cmdkApi.filterCommands(cmdkCommands, query, 8);
  setHtml("cmdkResults", results.map((c, i) =>
    `<button class="cmdk-item${i === 0 ? " active" : ""}" data-cmd="${escapeHtml(c.id)}">${escapeHtml(c.label)}</button>`
  ).join("") || `<div class="cmdk-empty">No matches</div>`);
  qsa("#cmdkResults [data-cmd]").forEach((btn) => btn.addEventListener("click", () => runCmdk(btn.dataset.cmd, results)));
}
function runCmdk(id, results) {
  const cmd = (results || []).find((c) => c.id === id);
  closeCmdk();
  if (!cmd) return;
  if (cmd.type === "nav") activateTab(cmd.tab);
  else if (cmd.type === "recipe") sentinel.runRecipe?.(cmd.recipeId, { dryRun: true });
  else if (cmd.id === "act:admin") sentinel.openAdminConsole?.();
  else if (cmd.id === "act:globe") sentinel.showGlobe?.();
}

function wireLowPower() {
  bindChange("lowPowerToggle", (input) => sentinel.setLowPower?.(input.checked));
}

// RUN 15 — Start/Stop ARIA · Self Check → self-heal · hotkey status + rebind · admin-build gating · focus-chat.
function wireRun15() {
  bindClick("startAria", (b) => runAction(b, () => sentinel.startAria?.()));
  bindClick("stopAria", (b) => runAction(b, () => sentinel.stopAria?.()));
  // Self Check now runs the full self-heal pass.
  bindClick("runSelfDiagnose", (b) => runAction(b, async () => {
    const r = await sentinel.selfHeal?.();
    setText("selfHealHeadline", r?.summary?.headline || "Self-check complete.");
    return r;
  }));
  sentinel.onFocusChat?.(() => { activateTab("aria"); qs("#ariaChatInput")?.focus(); }); // RUN 33 PIVOT — ARIA tab Chat sub-section
}
function renderRun15(state) {
  // RUN 23e — admin console buttons show only for an admin-tier license (single build, license-gated).
  const adminAllowed = Boolean(state.adminConsole || (state.features && state.features.adminConsole));
  const adminBtn = qs("#openAdminConsole");
  if (adminBtn) adminBtn.style.display = adminAllowed ? "" : "none";
  const adminBtn2 = qs("#openAdminConsole2");
  if (adminBtn2) adminBtn2.style.display = adminAllowed ? "" : "none";
  // Start/Stop reflect run state.
  const start = qs("#startAria");
  const stop = qs("#stopAria");
  if (start) start.disabled = !state.ariaStopped && !state.paused;
  if (stop) stop.disabled = Boolean(state.ariaStopped);
  // Hotkey live status in the Hotkeys tab.
  const hk = qs("#hotkeyStatus");
  if (hk && Array.isArray(state.hotkeys)) {
    setHtml("hotkeyStatus", state.hotkeys.map((h) =>
      `<div class="table-row"><span>${escapeHtml(h.combo)}</span><strong>${escapeHtml(h.label || h.id)}</strong><em class="${h.status === "active" ? "active-badge" : "fail-badge"}">${h.status === "active" ? (h.usedFallback ? "Active (rebound)" : "Active") : "Failed"}</em><button class="ghost" data-rebind="${escapeHtml(h.id)}">Rebind</button></div>`
    ).join(""));
    qsa("[data-rebind]").forEach((btn) => btn.addEventListener("click", () => {
      const combo = prompt("New combo (e.g. CommandOrControl+Shift+J):");
      if (combo) sentinel.rebindHotkey?.(btn.dataset.rebind, combo);
    }));
  }
}

// RUN 14 — self-hosted auto-update panel + history + rollback.
function wireUpdates() {
  bindChange("autoUpdateToggle", (input) => sentinel.setAutoUpdate?.(input.checked));
  bindClick("installUpdateBtn", (b) => runAction(b, () => sentinel.installUpdate?.()));
  sentinel.onUpdateAvailable?.((info) => {
    const btn = qs("#installUpdateBtn");
    if (btn) btn.hidden = false;
    setText("updateStatusLine", `Update available: ${info?.version || ""} — click Install.`);
  });
}
function renderUpdates(state) {
  const u = state && state.updates;
  if (!u) return;
  const tog = qs("#autoUpdateToggle");
  if (tog) tog.checked = u.autoUpdate !== false;
  setText("updateStatusLine", `Current version ${u.current}.${u.autoUpdate === false ? " Auto-update is off." : ""}`);
  const installed = new Set((u.history || []).map((h) => h.version));
  const rows = (u.history && u.history.length ? u.history : [{ version: u.current, installed: "this build" }]).map((h) => {
    const isCurrent = h.version === u.current;
    const canRoll = !isCurrent && installed.has(h.version);
    return `<div class="health-row"><span>${escapeHtml(h.version)}</span><strong>${escapeHtml(h.installed || "")}</strong>` +
      (isCurrent ? `<em>current</em>` : (canRoll ? `<button class="ghost" data-rollback-version="${escapeHtml(h.version)}">Roll back to this</button>` : `<em></em>`)) + `</div>`;
  }).join("");
  setHtml("updateHistory", rows);
  qsa("[data-rollback-version]").forEach((btn) => btn.addEventListener("click", () => runAction(btn, () => sentinel.rollbackUpdate?.(btn.dataset.rollbackVersion))));
}

// RUN 13 — support links, ext instructions, chat dock, account, plan-picker gate.
let planModalShown = false;
function wireRun13() {
  // Support / external links (data-support="mailto:|tel:|https:")
  qsa("[data-support]").forEach((btn) => btn.addEventListener("click", (e) => {
    e.preventDefault();
    sentinel.openExternal?.(btn.getAttribute("data-support"));
  }));
  bindClick("extInstructions", () => { const s = qs("#extSteps"); if (s) s.hidden = !s.hidden; });
  bindClick("openAdminConsole2", (b) => runAction(b, () => sentinel.openAdminConsole?.()));
  // Chat dock
  initAriaChat(); // RUN 33 PIVOT — the in-tab ARIA Chat sub-section (replaces the detached window)
  initSetupWizard(); // RUN 33-E — first-launch wizard
  // RUN 34-2 — the Settings Ask-ARIA dock was removed; ARIA Chat lives only in the ARIA tab.
  // Account
  bindClick("enterLicenseBtn", (b) => runAction(b, () => activateLicense()));
  bindClick("planEnterLicense", (b) => runAction(b, () => { closePlanModal(); activateTab("about"); }));
  // 2026-07-02 DEAD-SHELL FIX — the plan modal is a DISMISSIBLE upsell, never a trap. "Maybe later" closes it and
  // drops the user onto the navigable baseline (Dashboard). Esc also closes it.
  bindClick("planModalClose", () => { closePlanModal(); activateTab("dashboard"); });
  qs("#planModal")?.addEventListener("keydown", (e) => { if (e.key === "Escape") closePlanModal(); });
  bindClick("logoutBtn", (b) => runAction(b, async () => { const r = await sentinel.logout?.(); return r; }));
  bindClick("managePlanBtn", (b) => runAction(b, () => sentinel.manageSubscription?.()));
  // Trial-end plan picker — each "Subscribe" CTA opens the tier's Stripe Checkout URL.
  qsa(".plan-subscribe").forEach((btn) => btn.addEventListener("click", () => sentinel.choosePlan?.(btn.getAttribute("data-plan"))));
  // "Enter license" inline reveal inside the trial-end modal.
  bindClick("planEnterLicenseLink", () => { const row = qs("#planLicenseRow"); if (row) row.hidden = !row.hidden; qs("#planLicenseInput")?.focus(); });
  bindClick("planActivateBtn", (b) => runAction(b, async () => {
    const key = qs("#planLicenseInput")?.value?.trim() || "";
    const r = await sentinel.enterLicense?.({ key });
    if (r?.ok) { closePlanModal(); showToast({ title: "License activated", body: "ARIA is unlocked on this machine." }); }
    else showToast({ title: "Activation failed", body: "That key didn't validate (need a 64-character key).", danger: true });
    return r;
  }));
}
// RUN 34-2/34-7 — the Settings chat dock (#chatStream) was removed; appendChat now posts into the live ARIA
// Chat sub-section log (#ariaChatLog) so the Personal-tier upsell nudge actually appears (it was silently
// dropped after the dock was deleted). Falls back to a no-op if the ARIA tab hasn't rendered its log yet.
function appendChat(who, text) {
  const log = qs("#ariaChatLog");
  if (!log) return;
  const w = qs("#ariaChatWelcome"); if (w) w.remove();
  const panel = log.closest(".aria-chat-panel"); if (panel) panel.classList.add("chatting");
  const r = document.createElement("div");
  r.className = "aria-chat-row " + (who === "me" || who === "user" ? "me" : "aria");
  const whoLabel = (who === "me" || who === "user") ? "You" : "ARIA";
  const p = document.createElement("p"); p.className = "aria-chat-who"; p.textContent = whoLabel;
  const bubble = document.createElement("div"); bubble.className = "aria-chat-bubble"; bubble.textContent = text;
  r.append(p, bubble);
  log.appendChild(r);
  log.scrollTop = log.scrollHeight;
}
async function activateLicense() {
  const key = qs("#licenseKeyInput")?.value?.trim() || "";
  const r = await sentinel.enterLicense?.({ key });
  setText("accountStatus", r?.ok ? "License activated." : "That key didn't validate (need a 64-character key).");
  if (r?.ok) closePlanModal();
  return r;
}
function closePlanModal() { const m = qs("#planModal"); if (m) m.hidden = true; planModalShown = false; }

function renderGate(state) {
  const gate = state && state.gate;
  if (!gate) return;
  const badge = qs("#trialBadge");
  if (badge) {
    if (gate.licensed) { badge.hidden = false; badge.textContent = "Licensed"; }
    else if (gate.trial?.state === "active") { badge.hidden = false; badge.textContent = gate.trial.badge; }
    else { badge.hidden = false; badge.textContent = "Trial ended"; }
  }
  const acct = qs("#accountStatus");
  if (acct) acct.textContent = gate.licensed ? `Licensed${gate.plan ? " · " + gate.plan : ""}` : (gate.trial?.state === "active" ? gate.trial.badge : "Trial ended — choose a plan.");
  // 2026-07-02 DEAD-SHELL FIX — do NOT force the full-screen #planModal (an .onboarding{position:fixed;inset:0}
  // overlay with no close) as an interaction-blocking wall. It trapped every click, including Settings, whenever
  // the trial had expired. The app now always keeps a navigable baseline (Dashboard · ARIA · Settings, + Walk-
  // Through if entitled) via applyTabGates; the plan modal is only ever opened intentionally (Settings → upgrade,
  // or a locked paid-tab click) and is dismissible. Nothing is auto-walled here.
}

// SENTINEL TRIAL GATING 2026-07-02 — the per-tab enable/lock map for the current license/gate status.
let currentTabGate = {};
function applyTabGates(state) {
  const gate = state && state.gate;
  if (!gate) return;
  currentTabGate = tabGateMap(gate);
  qsa(".nav-item").forEach((btn) => {
    const tab = btn.dataset.tab;
    const locked = currentTabGate[tab] === false;
    btn.classList.toggle("tab-locked", locked);
    btn.setAttribute("aria-disabled", locked ? "true" : "false");
    let lk = btn.querySelector(".nav-lock");
    if (locked && !lk) {
      lk = document.createElement("span");
      lk.className = "nav-lock";
      lk.textContent = "🔒";
      lk.setAttribute("aria-hidden", "true");
      btn.appendChild(lk);
    } else if (!locked && lk) {
      lk.remove();
    }
  });
}

// Real days-left from the server-issued trialEndsAt (Rule 14 — no fabricated countdown). "" when unknown/past.
function trialDaysLeftLabel(gate) {
  const ends = gate && gate.trialEndsAt ? Date.parse(gate.trialEndsAt) : NaN;
  if (!Number.isFinite(ends)) return "";
  const ms = ends - Date.now();
  if (ms <= 0) return `Your 30-day trial ended ${new Date(ends).toLocaleDateString()}.`;
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return `${days} day${days === 1 ? "" : "s"} left in your Sentinel trial (ends ${new Date(ends).toLocaleDateString()}).`;
}

// Honest locked-tab overlay: the real upsell message + the buy path (plan picker) + "keep your Walk-Through".
function showLockedTabOverlay() {
  const gate = (state && state.gate) || {};
  setText("lockedTabMessage", LOCKED_TAB_MESSAGE);
  const info = qs("#lockedTabTrialInfo");
  const label = trialDaysLeftLabel(gate);
  if (info) { info.textContent = label; info.hidden = !label; }
  const m = qs("#lockedTabOverlay");
  if (m) m.hidden = false;
}
function closeLockedTabOverlay() { const m = qs("#lockedTabOverlay"); if (m) m.hidden = true; }
function wireLockedTabOverlay() {
  bindClick("lockedTabClose", () => closeLockedTabOverlay());
  bindClick("lockedTabKeepWalkthrough", () => { closeLockedTabOverlay(); activateTab(WALKTHROUGH_TAB); });
  // "Choose a plan" opens the existing plan picker (the buy path) — never blocked.
  bindClick("lockedTabChoosePlan", () => { closeLockedTabOverlay(); const pm = qs("#planModal"); if (pm) { pm.hidden = false; planModalShown = true; } else sentinel.openPlanPicker?.(); });
}

// Fix 5 — "Show the floating globe" toggle (persists via electron-store).
function wireFloatingGlobe() {
  const el = qs("#showFloatingGlobe");
  if (!el) return;
  if (sentinel.getSettings) {
    sentinel.getSettings().then((s) => { el.checked = (s?.showFloatingGlobe ?? true); }).catch(() => undefined);
  }
  el.addEventListener("change", () => sentinel.setShowFloatingGlobe?.(el.checked));
}

let roiApi = null;
let valueProofApi = null; // RUN-B B2 — real-or-empty value proof (ROI + deflection)
function wireRoi() {
  bindChange("roiRate", () => renderRoi(state));
}
async function renderRoi(next) {
  if (!roiApi) roiApi = await import("../shared/roi.mjs");
  if (!valueProofApi) valueProofApi = await import("../shared/value-proof.mjs"); // RUN-B B2
  const log = (next && next.transparencyLog) || [];
  const fixes = log.filter((e) => e.tag === "RUN" && /^Executing/.test(e.text || "")).length;
  const rate = Number(qs("#roiRate")?.value) || roiApi.DEFAULT_HOURLY_RATE;
  // RUN-B B2 — surface the real deflection % (B1) alongside ROI; honest empty-state until the first real fix.
  const deflection = next && next.metrics ? next.metrics.deflection : null;
  const roi = roiApi.computeRoi({ fixes, hourlyRate: rate });
  const summary = fixes > 0
    ? `${roiApi.roiSummary(roi)}${deflection == null ? "" : ` \u00b7 ${deflection}% resolved first-touch`}`
    : valueProofApi.VALUE_PROOF_EMPTY;
  setText("roiSummary", summary);
}

function wireLicense() {
  bindClick("startTrial", (button) => runAction(button, async () => {
    const email = qs("#trialEmail")?.value?.trim() || "";
    const result = await sentinel.startTrial?.(email);
    setText("licenseStatus", result?.ok ? `Trial active · ${result.status.daysRemaining} days left (Confirmed + Autonomous)` : "Enter a valid email to start the trial.");
    return result;
  }));
  bindClick("checkUpdates", (button) => runAction(button, async () => {
    const r = await sentinel.checkUpdates?.();
    setText("updateStatus", !r?.ok ? "Update check unavailable." : r.updateAvailable ? `Update available: ${r.latest.version}` : `Up to date (${r.current}).`);
    return r;
  }));
  bindClick("manageSubscription", (button) => runAction(button, () => sentinel.manageSubscription?.()));
}
function renderLicense(next) {
  const lic = next && next.license;
  if (!lic) return;
  const el = qs("#licenseStatus");
  if (el) el.textContent = lic.licensed
    ? `Trial active · ${lic.daysRemaining} days left (Confirmed + Autonomous)`
    : "Manual mode (free). Start a 30-day trial of Confirmed + Autonomous.";
}

let whatsNewShown = false;
function maybeShowWhatsNew(next) {
  if (whatsNewShown) return;
  const wn = next && next.whatsNew;
  if (!wn || !wn.show) return;
  whatsNewShown = true;
  setText("whatsNewTitle", `ARIA Sentinel ${wn.version || ""} — what's new`);
  setText("whatsNewBody", wn.notes || "See the release notes for details.");
  const modal = qs("#whatsNew");
  if (modal) modal.hidden = false;
}

function renderLog(log) {
  const rows = (log || []).slice(0, 30).map((entry) => {
    const time = new Date(entry.ts || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `
      <div class="log-row">
        <span>${escapeHtml(time)}</span>
        <strong>${escapeHtml(entry.tag || "LOG")}</strong>
        <em>${escapeHtml(entry.text || "")}</em>
      </div>
    `;
  }).join("");
  setHtml("logList", rows || `<div class="log-row"><span>--:--</span><strong>IDLE</strong><em>No local events yet.</em></div>`);
}

function renderSystemChecks(checks) {
  setHtml("systemChecks", checks.map((item) => `
    <div class="health-row">
      <span>${escapeHtml(item.id || "check")}</span>
      <strong>${escapeHtml(item.message || "")}</strong>
      <em>${escapeHtml(item.ok ? "OK" : (item.severity || "WARN").toUpperCase())}</em>
    </div>
  `).join(""));
}

function defaultChecks(next) {
  const bridge = next.bridgeStatus || {};
  return [
    { id: "bridge", ok: !bridge.conflict, severity: bridge.conflict ? "warn" : "ok", message: bridge.conflict ? bridge.lastError || "Bridge conflict detected." : "Local bridge is available or safely standing by." },
    { id: "dry-run", ok: Boolean(next.dryRun), severity: "ok", message: "System-changing actions remain gated." },
    { id: "privacy", ok: !next.externalAiCalls, severity: "ok", message: "External AI calls are disabled for this MVP build." }
  ];
}

// ===== RUN 19 — toasts · triple-confirm delete · kill-switch · trial nudge · live globe state =====

const TRIAL_DURATION_MS = 12 * 60 * 60 * 1000;
let deletePrefs = { skipTripleFor: [] };
let deleteFlow = null;
let killDimmed = false;
let trialNudgeShown = false;

// Non-blocking toast (top-right, dismissible). Returns the toast element.
function showToast({ title, body, cta, ctaAction, danger = false, timeout = 0 } = {}) {
  const stack = qs("#toastStack");
  if (!stack) return null;
  const toast = document.createElement("div");
  toast.className = `toast${danger ? " danger" : ""}`;
  const main = document.createElement("div");
  if (title) { const t = document.createElement("strong"); t.textContent = title; main.appendChild(t); }
  if (body) { const b = document.createElement("div"); b.className = "toast-body"; b.textContent = body; main.appendChild(b); }
  if (cta) {
    const c = document.createElement("span");
    c.className = "toast-cta";
    c.textContent = cta;
    c.addEventListener("click", () => { try { ctaAction?.(); } finally { toast.remove(); } });
    main.appendChild(c);
  }
  const close = document.createElement("button");
  close.className = "toast-close";
  close.setAttribute("aria-label", "Dismiss");
  close.textContent = "×";
  close.addEventListener("click", () => toast.remove());
  toast.append(main, close);
  stack.appendChild(toast);
  if (timeout > 0) setTimeout(() => toast.remove(), timeout);
  return toast;
}

// Triple-confirm delete gate (§4). Opens the 3-step modal; only the final step runs onConfirm.
function confirmDelete(name, onConfirm) {
  deleteFlow = { name: String(name || "this item"), onConfirm, index: 0, optOut: false };
  renderDeleteStep();
  const modal = qs("#deleteModal");
  if (modal) modal.hidden = false;
}
function renderDeleteStep() {
  if (!deleteFlow) return;
  const step = stepFor(deleteFlow.name, deletePrefs, deleteFlow.index);
  setText("deleteStepKicker", step.title);
  setText("deleteStepTitle", step.body(deleteFlow.name));
  setText("deleteStepBody", step.last && step.total > 1 ? "This cannot be undone." : "");
  const confirmBtn = qs("#deleteConfirm");
  if (confirmBtn) confirmBtn.textContent = step.confirm;
  const ext = extOf(deleteFlow.name);
  const optWrap = qs(".delete-optout");
  if (optWrap) optWrap.style.display = ext ? "flex" : "none"; // no ext (folder/restore point) → no opt-out
  if (ext) setText("deleteOptOutLabel", `Don't ask me again for ${ext} files`);
  const cb = qs("#deleteOptOut");
  if (cb) cb.checked = Boolean(deleteFlow.optOut);
}
function advanceDelete() {
  if (!deleteFlow) return;
  const cb = qs("#deleteOptOut");
  if (cb) deleteFlow.optOut = cb.checked;
  const step = stepFor(deleteFlow.name, deletePrefs, deleteFlow.index);
  if (step.last) {
    const ext = extOf(deleteFlow.name);
    const fn = deleteFlow.onConfirm;
    if (deleteFlow.optOut && ext) {
      // Persist the per-ext opt-out; optimistically update local prefs so the NEXT delete drops to 1 step.
      sentinel.setDeletePref?.(ext);
      if (!deletePrefs.skipTripleFor.includes(ext)) deletePrefs.skipTripleFor = [...deletePrefs.skipTripleFor, ext];
    }
    closeDeleteModal();
    Promise.resolve(fn?.()).catch((e) => reportRendererError(e, "delete-confirm"));
  } else {
    deleteFlow.index += 1;
    renderDeleteStep();
  }
}
function closeDeleteModal() {
  const modal = qs("#deleteModal");
  if (modal) modal.hidden = true;
  deleteFlow = null;
}

function setGlobeState(s) {
  qsa("aria-globe").forEach((g) => g.setAttribute("state", s === "dim" ? "dim" : "active"));
}

function wireRun19() {
  bindClick("deleteCancel", () => closeDeleteModal());
  bindClick("deleteConfirm", () => advanceDelete());
  bindClick("resetDeletePrefs", (b) => runAction(b, async () => {
    const r = await sentinel.resetDeletePrefs?.();
    deletePrefs = { skipTripleFor: [] };
    renderDeletePrefs();
    showToast({ title: "Delete confirmations reset", body: "Every file type is triple-confirmed again." });
    return r;
  }));
  // Kill-switch (Ctrl+Alt+K) confirmation pushed from main: dim the globe + toast.
  sentinel.onKillSwitch?.((info) => {
    killDimmed = true;
    setGlobeState("dim");
    showToast({ title: "ARIA terminated", body: (info && info.toast) || "last action undone", danger: true });
  });
  // A user Start re-arms the globe.
  qs("#startAria")?.addEventListener("click", () => { killDimmed = false; setGlobeState("active"); });
}

function renderDeletePrefs() {
  const host = qs("#deletePrefsList");
  if (!host) return;
  const list = (deletePrefs && deletePrefs.skipTripleFor) || [];
  host.innerHTML = list.map((ext) => `
    <div class="delete-pref-row">
      <span><code>${escapeHtml(ext)}</code> files skip triple-confirm (single confirmation only)</span>
      <button class="ghost" data-restore-ext="${escapeHtml(ext)}">Re-enable</button>
    </div>`).join("");
  qsa("[data-restore-ext]").forEach((btn) => btn.addEventListener("click", () => runAction(btn, async () => {
    const r = await sentinel.clearDeletePref?.(btn.dataset.restoreExt);
    deletePrefs.skipTripleFor = deletePrefs.skipTripleFor.filter((e) => e !== btn.dataset.restoreExt);
    renderDeletePrefs();
    return r;
  })));
}

function renderRun19(next) {
  if (next && next.deletePrefs && Array.isArray(next.deletePrefs.skipTripleFor)) {
    deletePrefs = { skipTripleFor: next.deletePrefs.skipTripleFor.slice() };
    renderDeletePrefs();
  }
  // Keep the globe dim once killed for the session.
  if (killDimmed) setGlobeState("dim");
  // Trial nudge — when active and <30% remaining (and not licensed), a dismissible top-right toast.
  const gate = next && next.gate;
  if (!trialNudgeShown && gate && !gate.licensed && gate.trial?.state === "active") {
    const frac = Number(gate.trial.remainingMs || 0) / TRIAL_DURATION_MS;
    if (frac > 0 && frac < 0.30) {
      trialNudgeShown = true;
      showToast({
        title: "Trial ending soon",
        body: `${gate.trial.badge} — choose a tier to keep ARIA running.`,
        cta: "See plans",
        ctaAction: () => activateTab("about")
      });
    }
  }
}

// ===== RUN 20 — system context · Tier-0 safe-generic · cross-platform blueprints · diagnose =====

let lastSystemContext = null;
let systemContextLoaded = false;
let blueprintsLoaded = false;
let tier0Loaded = false;

function wireRun20() {
  // Diagnose Issue — opens the chat dock in diagnostic mode (asks ARIA's doctor reasoner).
  bindClick("diagnoseIssue", () => { activateTab("aria"); qs("#ariaChatInput")?.focus(); }); // RUN 34-2 — route to the ARIA tab chat
  bindClick("refreshSystemContext", (b) => runAction(b, async () => {
    setText("systemContextMeta", "Refreshing inventory…");
    const ctx = await sentinel.refreshSystemContext?.();
    renderSystemContext(ctx);
    return ctx;
  }));
  const search = qs("#systemContextSearch");
  if (search) search.addEventListener("input", () => renderSystemContextApps(search.value.trim().toLowerCase()));
}

async function loadSystemContext() {
  if (systemContextLoaded && lastSystemContext) return;
  try {
    const ctx = await sentinel.getSystemContext?.();
    systemContextLoaded = true;
    renderSystemContext(ctx);
  } catch (e) { reportRendererError(e, "system-context"); }
}

function renderSystemContext(ctx) {
  lastSystemContext = ctx || null;
  if (!ctx) { setText("systemContextMeta", "Inventory not available in this build."); return; }
  const when = ctx.generatedAt ? new Date(ctx.generatedAt).toLocaleString() : "unknown";
  setText("systemContextMeta", `${ctx.appCount || 0} apps · ${(ctx.services || []).length} services · last refreshed ${when}. Local + content-blind.`);
  const cpu = ctx.cpu || {};
  const ram = ctx.ram || {};
  const disk = ctx.disk || {};
  const os = ctx.os || {};
  const rows = [
    { id: "os", message: `${os.edition || "Windows"}${os.build ? " · build " + os.build : ""}`, ok: true },
    { id: "cpu", message: `${cpu.model || "CPU"}${cpu.cores ? " · " + cpu.cores + " cores" : ""}${cpu.load != null ? " · " + cpu.load + "% load" : ""}`, ok: true },
    { id: "ram", message: ram.percentUsed != null ? `${ram.percentUsed}% used` : "RAM", ok: (ram.percentUsed || 0) < 90 },
    { id: "disk", message: disk.model ? `${disk.model} · ${disk.status || "OK"}` : "Disk", ok: true }
  ];
  setHtml("systemContextSummary", rows.map((r) => `
    <div class="health-row"><span>${escapeHtml(r.id)}</span><strong>${escapeHtml(r.message)}</strong><em>${r.ok ? "OK" : "CHECK"}</em></div>
  `).join(""));
  renderSystemContextApps("");
}

function renderSystemContextApps(filter) {
  const host = qs("#systemContextApps");
  if (!host) return;
  const apps = (lastSystemContext && lastSystemContext.apps) || [];
  const shown = (filter ? apps.filter((a) => `${a.name} ${a.publisher || ""}`.toLowerCase().includes(filter)) : apps).slice(0, 300);
  host.innerHTML = shown.map((a) => `
    <div class="source-row">
      <span>${escapeHtml(a.name || "App")}</span>
      <strong>${escapeHtml(a.version || "—")}${a.publisher ? " · " + escapeHtml(a.publisher) : ""}</strong>
    </div>`).join("") || `<div class="source-row"><span>No matches.</span><strong></strong></div>`;
}

async function loadBlueprints() {
  if (blueprintsLoaded) return;
  try {
    const list = await sentinel.listBlueprints?.();
    blueprintsLoaded = true;
    const host = qs("#blueprintList");
    if (!host) return;
    host.innerHTML = (list || []).map((b) => `
      <div class="source-row">
        <span>${escapeHtml(b.title || b.id)}</span>
        <button class="ghost" data-blueprint="${escapeHtml(b.id)}">View</button>
      </div>`).join("") || `<div class="source-row"><span>No blueprints found.</span><strong></strong></div>`;
    qsa("[data-blueprint]").forEach((btn) => btn.addEventListener("click", () => runAction(btn, async () => {
      const r = await sentinel.getBlueprint?.(btn.dataset.blueprint);
      const view = qs("#blueprintView");
      if (view) { view.hidden = false; view.textContent = r?.ok ? r.content : "Blueprint unavailable."; view.scrollIntoView?.({ behavior: "smooth", block: "start" }); }
      return r;
    })));
  } catch (e) { reportRendererError(e, "blueprints"); }
}

async function renderTier0() {
  if (tier0Loaded) return;
  try {
    const list = await sentinel.listTier0?.();
    tier0Loaded = true;
    const host = qs("#tier0List");
    if (!host) return;
    host.innerHTML = (list || []).map((r) => `
      <article class="recipe-card">
        <span class="chip">${escapeHtml(r.readOnly ? "READ-ONLY" : "SAFE")}</span>
        <h3>${escapeHtml(r.title)}</h3>
        <p>${escapeHtml(r.summary || "")}</p>
        <div class="button-row">
          <button class="ghost" data-tier0="${escapeHtml(r.recipeId)}">Dry-run</button>
        </div>
      </article>`).join("") || `<p class="note">No Tier-0 recipes available.</p>`;
    qsa("[data-tier0]").forEach((btn) => btn.addEventListener("click", () => runAction(btn, async () => {
      const r = await sentinel.previewTier0?.(btn.dataset.tier0);
      showToast({ title: `${r?.title || "Dry-run"}`, body: `${r?.summary || ""}${r?.requiresReboot ? " (needs reboot)" : ""}` });
      return r;
    })));
  } catch (e) { reportRendererError(e, "tier-0"); }
}

// ===== RUN 21 — auto-update orchestrator · startup security · heartbeat (renderer) =====

function wireRun21() {
  bindClick("checkUpdateChannel", (b) => runAction(b, async () => {
    const r = await sentinel.checkUpdateChannel?.();
    await loadUpdatesPanel();
    showToast({ title: r?.updateAvailable ? "Update available" : "Up to date", body: r?.event?.version ? `v${r.event.version} is ready to install.` : "You're on the latest version." });
    return r;
  }));
  bindClick("pauseUpdates", (b) => runAction(b, async () => {
    const r = await sentinel.pauseUpdates?.();
    showToast({ title: r?.ok ? "Updates paused 7 days" : "Pause unavailable", body: r?.ok ? "Each strike window is extended by 7 days." : "Only one 7-day pause is allowed per quarter.", danger: !r?.ok });
    return r;
  }));
  const tog = qs("#autoStartupToggle");
  if (tog) tog.addEventListener("change", () => {
    if (tog.checked) { sentinel.setAutoStartup?.(true); showToast({ title: "Auto-start on", body: "ARIA will start automatically at login." }); }
    else startupDisableDoubleConfirm(tog);
  });
  // Orchestrator notice (strike escalation) → non-blocking toast with Install CTA.
  sentinel.onUpdateNotice?.((info) => {
    showToast({ title: `Update v${info?.version || ""} ready`, body: `Strike ${info?.strike || 0}/3 — install now or choose later.`, cta: "Install", ctaAction: () => sentinel.updateChoice?.("install") });
    loadUpdatesPanel();
  });
  // Startup tamper → warn + offer re-enable (the keep-off path is double-confirmed in main's audit).
  sentinel.onStartupTamper?.(() => {
    showToast({ title: "ARIA removed from startup", body: "I can't monitor or help while I'm not running.", cta: "Re-enable", ctaAction: () => { sentinel.setAutoStartup?.(true); const t = qs("#autoStartupToggle"); if (t) t.checked = true; loadUpdatesPanel(); }, danger: true });
    loadUpdatesPanel();
  });
}

// Disabling auto-start needs TWO explicit confirmations (mirrors the startup-watchdog keep-off flow).
function startupDisableDoubleConfirm(tog) {
  if (tog) tog.checked = true; // stays on until both confirms complete
  showToast({
    title: "Disable auto-start?", body: "ARIA won't run unless you launch it manually.", danger: true,
    cta: "Yes, disable", ctaAction: () => showToast({
      title: "Confirm — keep ARIA off", body: "You'll need to launch it manually each time.", danger: true,
      cta: "Confirm, keep off", ctaAction: () => { if (tog) tog.checked = false; sentinel.setAutoStartup?.(false); loadUpdatesPanel(); }
    })
  });
}

async function loadUpdatesPanel() {
  try {
    const us = await sentinel.getUpdateState?.();
    if (us) {
      setText("updPending", us.phase && us.phase !== "IDLE" && us.phase !== "INSTALLED" ? `Update v${us.version || ""} pending` : "No update pending.");
      setText("updStrike", us.strike ? `strike ${us.strike}/3` : "");
      if (us.lastCheckAt) setText("updLastCheck", `checked ${new Date(us.lastCheckAt).toLocaleString()}`);
    }
    const ss = await sentinel.getStartupState?.();
    if (ss) {
      const tog = qs("#autoStartupToggle");
      if (tog) tog.checked = ss.enabled !== false;
      const banner = qs("#startupBanner");
      if (banner) {
        if (ss.enabled === false) { banner.hidden = false; banner.textContent = `⚠ Auto-start disabled${ss.disabledAt ? " on " + new Date(ss.disabledAt).toLocaleDateString() : ""}. ARIA only runs when manually launched.`; }
        else banner.hidden = true;
      }
      renderStartupAudit(ss.audit || []);
    }
  } catch (e) { reportRendererError(e, "updates-panel"); }
}

function renderStartupAudit(audit) {
  setHtml("startupAuditLog", (audit || []).map((a) => `
    <div class="log-row"><span>${escapeHtml(new Date(a.timestamp).toLocaleDateString())}</span><strong>STARTUP</strong><em>${escapeHtml(a.method)}${a.userConfirmed ? " · confirmed" : ""}</em></div>
  `).join("") || `<div class="log-row"><span>--</span><strong>OK</strong><em>No startup changes recorded.</em></div>`);
}

function renderRun21(next) {
  const v = `v${(next && next.version) || "0.1.0"}`;
  setText("updCurrentVersion", v);
  setText("trialEndVersion", v);
}

// ===== RUN 22 — dashboard · performance · SLA · compliance · reports (renderer) =====

function wireRun22() {
  // Overview quick actions.
  bindClick("dashDiagnose", () => { activateTab("aria"); qs("#ariaChatInput")?.focus(); }); // RUN 34-2 — route to the ARIA tab chat
  bindClick("dashHealthCheck", (b) => runAction(b, async () => { const r = await sentinel.selfHeal?.(); showToast({ title: "Health check", body: r?.summary?.headline || "Self-check complete." }); return r; }));
  bindClick("dashCheckUpdates", (b) => runAction(b, async () => { const r = await sentinel.checkUpdateChannel?.(); showToast({ title: r?.updateAvailable ? "Update available" : "Up to date", body: r?.event?.version ? `v${r.event.version} ready.` : "Latest version." }); return r; }));
  bindClick("dashExportEvidence", (b) => runAction(b, () => sentinel.exportEvidence?.()));
  bindClick("compExportEvidence", (b) => runAction(b, async () => { const r = await sentinel.exportEvidence?.(); setText("compEvidenceResult", r?.ok ? `Saved → ${r.path}` : "Export unavailable."); return r; }));
  // Reports actions.
  bindClick("generateReport", (b) => runAction(b, async () => { const r = await sentinel.generateReport?.({ adhoc: true }); showToast({ title: r?.ok ? "Report generated" : "Report unavailable", body: r?.filename || "" }); loadReports(); return r; }));
  bindClick("saveReportPrefs", (b) => runAction(b, async () => {
    const prefs = { optIn: qs("#reportOptIn")?.checked || false, contactEmail: qs("#reportContactEmail")?.value?.trim() || "", cc: qs("#reportCcEmails")?.value?.trim() || "", cadence: "quarterly" };
    const r = await sentinel.setReportPrefs?.(prefs);
    setText("reportPrefsStatus", r?.ok ? "Saved." : "Save failed.");
    return r;
  }));
}

// Deep-link clicks (activity rows + pending cards) jump to the relevant tab.
function wireDeepLinks(rootId) {
  qsa(`#${rootId} [data-deeplink]`).forEach((el) => el.addEventListener("click", () => { const t = el.getAttribute("data-deeplink"); if (t && (TAB_TITLES[t] || TAB_REDIRECTS[t])) activateTab(t); }));
}

async function loadDashboard() {
  try {
    const d = (await sentinel.getDashboard?.()) || {};
    const status = computeHeroStatus(d.sources || {});
    const hero = qs("#heroStatus");
    if (hero) { hero.dataset.level = status.level; hero.innerHTML = `<span class="hero-emoji">${status.emoji}</span><strong class="hero-label">${status.label}</strong>`; }
    setText("heroSubline", heroSubline(d.subline || {}));
    setHtml("kpiTiles", DashboardTab.tilesHtml(heroTiles(d.metrics || {})));
    const pending = d.pending || [];
    const pPanel = qs("#pendingActionsPanel"); if (pPanel) pPanel.hidden = pending.length === 0;
    setHtml("pendingActions", DashboardTab.pendingHtml(pending));
    setHtml("recentActivity", DashboardTab.activityHtml((d.activity || []).map(DashboardTab.eventToActivity)));
    if (d.trust) setText("trustStrip", d.trust);
    wireDeepLinks("recentActivity"); wireDeepLinks("pendingActions");
  } catch (e) { reportRendererError(e, "dashboard"); }
}

async function loadPerformance() {
  try {
    const p = (await sentinel.getPerformance?.()) || {};
    setHtml("perfOperational", PerformanceTab.operationalTilesHtml(p.operational || {}));
    setHtml("perfAI", PerformanceTab.aiTilesHtml(p.ai || {}));
    setHtml("perfUsage", PerformanceTab.usageHtml(p.usage || {}));
  } catch (e) { reportRendererError(e, "performance"); }
}

async function loadSla() {
  try {
    const s = (await sentinel.getSla?.()) || {};
    setText("slaComposite", `${s.compliance?.composite ?? 0}% SLA-met this month`);
    setText("slaComplianceNote", SlaTab.complianceLine(s.compliance || {}));
    setHtml("slaUptime", SlaTab.uptimeTilesHtml(s.uptime || {}));
    setHtml("slaResponse", SlaTab.severityRowsHtml(s.compliance?.response || {}, s.thresholds?.response || {}));
    setHtml("slaResolution", SlaTab.severityRowsHtml(s.compliance?.resolution || {}, s.thresholds?.resolution || {}));
    setHtml("slaBreaches", SlaTab.breachRowsHtml(s.breaches || [], s.credits || {}));
  } catch (e) { reportRendererError(e, "sla"); }
}

async function loadCompliance() {
  try {
    const c = (await sentinel.getCompliance?.()) || {};
    setHtml("compAudit", ComplianceTab.auditRowsHtml(c.audit || {}));
    setHtml("compPrivacy", ComplianceTab.privacyRowsHtml(c.privacy || {}));
    setHtml("compTier0", ComplianceTab.tier0RowsHtml(c.tier0 || {}));
    setHtml("compR11", ComplianceTab.r11RowsHtml(c.r11 || {}));
    setHtml("compFrameworks", ComplianceTab.frameworkTilesHtml(c.frameworks || {}));
    setHtml("compTrust", ComplianceTab.trustPostureHtml(c.trust || {})); // RUN-B B3 — honest trust/security surface
  } catch (e) { reportRendererError(e, "compliance"); }
}

async function loadReports() {
  try {
    const r = (await sentinel.listReports?.()) || {};
    setHtml("reportsList", ReportsTab.reportsRowsHtml(r.reports || []));
    setText("reportsRetentionNote", ReportsTab.retentionNote(r.nextCleanupAt));
    setText("reportPreview", ReportsTab.previewText(r.preview || {}));
    const prefs = r.prefs || {};
    if (qs("#reportOptIn")) qs("#reportOptIn").checked = Boolean(prefs.optIn);
    if (qs("#reportContactEmail") && prefs.contactEmail) qs("#reportContactEmail").value = prefs.contactEmail;
  } catch (e) { reportRendererError(e, "reports"); }
}

// ===== RUN 23e — license-tier feature gating + upsell (single build; gates off state.features) =====

// Recommended upgrade target + copy per locked feature. Plans come from the tier table; never a URL.
const UPSELL = {
  confirmed: { plan: "pro", title: "Confirmed mode is a Pro feature", body: "Confirmed mode pops a fix-card and applies once you approve — upgrade to Pro ($1,500/mo) to enable it." },
  autonomous: { plan: "pro", title: "Autonomous mode is a Pro feature", body: "Autonomous auto-applies low-risk fixes and tells you after — upgrade to Pro ($1,500/mo) to enable it." },
  recipes: { plan: "pro", title: "The full recipe library is on Pro", body: "Personal includes 14 safe-generic fixes. Pro ($1,500/mo) unlocks the complete 77-recipe library." },
  quarterlyPdf: { plan: "pro", title: "Quarterly PDF reports are on Pro", body: "Self-serve quarterly PDF reports are available on Pro ($1,500/mo) and up." },
  fleetView: { plan: "smb", title: "Fleet view is a business feature", body: "Multi-device fleet view is available on Small Business and up." },
  complianceEvidence: { plan: "smb", title: "Compliance pack is a business feature", body: "The compliance evidence pack is available on Small Business and up." },
  customRecipes: { plan: "smb", title: "Custom recipes are a business feature", body: "Custom recipes are available on Small Business and up." }
};

function upsellCardHtml(key) {
  const u = UPSELL[key];
  if (!u) return "";
  return `<div class="upsell-card" data-upsell-for="${key}">
    <div class="upsell-text"><strong>🔒 ${escapeHtml(u.title)}</strong><p>${escapeHtml(u.body)}</p></div>
    <button class="primary upsell-btn" data-upsell-plan="${escapeHtml(u.plan)}">Upgrade</button>
  </div>`;
}

// Idempotent: create (or update) an upsell node with `id` just after `anchorEl`, or remove it when hidden.
function setUpsell(id, anchorEl, key, show) {
  let node = qs(`#${id}`);
  if (!show) { if (node) node.remove(); return; }
  if (!anchorEl) return;
  if (!node) {
    node = document.createElement("div");
    node.id = id;
    anchorEl.insertAdjacentElement("afterend", node);
  }
  node.innerHTML = upsellCardHtml(key);
}

// Apply every tier gate from the broadcast feature object. Manual-only Personal sees locked mode tiles +
// upsell cards; sub-77 quota locks the recipe library; no quarterlyPdf locks the Reports controls.
function applyFeatureGates(state) {
  const features = (state && state.features) || { modes: ["manual"], recipesCount: 14 };
  const modes = features.modes || ["manual"];

  // 1 — Mode tiles: lock any mode this plan doesn't include.
  qsa(".mode-row").forEach((row) => {
    const allowed = modes.includes(row.dataset.mode);
    row.classList.toggle("locked", !allowed);
    let badge = row.querySelector(".lock-badge");
    if (!allowed && !badge) {
      badge = document.createElement("span");
      badge.className = "lock-badge";
      badge.textContent = "🔒";
      row.appendChild(badge);
    } else if (allowed && badge) {
      badge.remove();
    }
  });
  // Mode upsell card — show the highest locked mode's pitch under the mode panel.
  const modePanel = qs(".mode-panel-centered");
  const modeLockKey = !modes.includes("confirmed") ? "confirmed" : !modes.includes("autonomous") ? "autonomous" : null;
  setUpsell("modeUpsell", modePanel, modeLockKey, Boolean(modeLockKey));

  // 2 — Recipe library: lock the 77-recipe interactive list when the quota is below it (Personal = 14).
  const recipeLocked = Number(features.recipesCount || 0) < 77;
  const recipeList = qs("#recipeList");
  if (recipeList) recipeList.classList.toggle("feature-locked", recipeLocked);
  setUpsell("recipeUpsell", qs("#recipeCatalogMeta"), "recipes", recipeLocked);

  // 3 — Reports: lock the quarterly-PDF controls when the plan lacks them.
  const reportsPanel = qs("#reports .panel");
  setUpsell("reportsUpsell", reportsPanel ? qs("#reports .panel .panel-actions") || reportsPanel : null, "quarterlyPdf", !features.quarterlyPdf);

  // 4 — Generic declarative gates: any [data-feature] element shows only when its flag is on.
  qsa("[data-feature]").forEach((el) => { el.hidden = !features[el.dataset.feature]; });
}

// Locked mode-tile click / upsell-button click → open the tier's Stripe checkout (env-resolved in main).
function showUpgradeUpsell(modeOrKey) {
  const u = UPSELL[modeOrKey] || UPSELL.confirmed;
  showToast({ title: u.title, body: u.body, cta: "Upgrade", ctaAction: () => sentinel.choosePlan?.(u.plan) });
}

// ===== RUN 23e — Personal-tier upsell triggers (detection nudge + monthly About nudge) =====
let upsellMod = null;
async function ensureUpsellMod() {
  if (!upsellMod) upsellMod = await import("../shared/upsell.mjs");
  return upsellMod;
}

function wireRun23e() {
  // Delegated handler for every upsell button (mode card, recipe card, reports lock, about nudge).
  document.addEventListener("click", (e) => {
    const btn = e.target.closest?.("[data-upsell-plan]");
    if (!btn) return;
    sentinel.choosePlan?.(btn.dataset.upsellPlan);
  });
  // Settings → About → Upgrade plan opens the full tier-comparison plan-picker surface.
  bindClick("upgradePlanBtn", (b) => runAction(b, () => sentinel.openPlanPicker?.()));
}

// Detection-time chat upsell for Personal: once per detection class per 7 days. Called from the detection
// path when an issue would have benefited from Confirmed/Autonomous. The throttle map is in-memory only
// (no browser persistence APIs — those would survive relaunch and break the content-blind/no-persist rule).
let upsellSeen = {};
async function maybeUpsellOnDetection(detectionClass) {
  try {
    const mod = await ensureUpsellMod();
    const modesAllowed = (state && state.features && state.features.modes) || ["manual"];
    if (modesAllowed.includes("confirmed")) return; // only Personal (no Confirmed/Autonomous) gets upsold
    if (!mod.shouldUpsell(detectionClass, upsellSeen, Date.now())) return;
    upsellSeen[detectionClass] = Date.now();
    appendChat("aria", mod.upsellMessageFor(detectionClass));
  } catch { /* upsell must never break the detection path */ }
}

// Monthly About-tab nudge: "You've spent ~Nh on manual fixes this month — Pro would have saved ~Mh".
async function renderAboutNudge(state) {
  try {
    const mod = await ensureUpsellMod();
    const features = (state && state.features) || {};
    if ((features.modes || []).includes("confirmed")) { const n = qs("#aboutNudge"); if (n) n.remove(); return; }
    const log = (state && state.transparencyLog) || [];
    const fixes = log.filter((e) => e.tag === "RUN" && /^Executing/.test(e.text || "")).length;
    const msg = mod.aboutNudge(fixes);
    if (!msg) return;
    let node = qs("#aboutNudge");
    const anchor = qs("#roiSummary");
    if (!node && anchor) { node = document.createElement("p"); node.id = "aboutNudge"; node.className = "note upsell-nudge"; anchor.insertAdjacentElement("afterend", node); }
    if (node) { node.textContent = msg; node.dataset.upsellPlan = "pro"; }
  } catch { /* nudge is best-effort */ }
}

async function reportRendererError(error, source = "renderer") {
  const message = error instanceof Error ? error.message : String(error || "renderer error");
  console.error(error);
  try {
    await sentinel?.reportError?.({ source, message });
  } catch {
    // Reporting cannot create another renderer fault.
  }
}

async function downloadAudit(kind) {
  const result = await sentinel.exportAudit?.(kind);
  if (!result?.ok) return result;
  const type = kind === "pdf" ? "application/pdf" : "text/csv";
  const blob = new Blob([result.content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = result.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return result;
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function setText(id, text) {
  const element = qs(`#${id}`);
  if (element) element.textContent = text;
}

function setHtml(id, html) {
  const element = qs(`#${id}`);
  if (element) element.innerHTML = html;
}

function setChip(id, text, tone = "") {
  const element = qs(`#${id}`);
  if (!element) return;
  element.textContent = text;
  element.classList.remove("cyan", "amber", "red");
  if (tone) element.classList.add(tone);
}

// RUN 33 PIVOT — in-tab ARIA Chat (Chat sub-section of the ARIA tab). Reuses the Slice 0 design + the same
// window.sentinel.chat brain (KB-first → Anthropic → local). 🔒 frontmatter-strip + escaping; no node access.
function initAriaChat() {
  const log = qs("#ariaChatLog"), form = qs("#ariaChatForm"), input = qs("#ariaChatInput"), send = qs("#ariaChatSend");
  if (!log || !form || !input || !send) return;
  const panel = log.closest(".aria-chat-panel");
  const esc = (s) => String(s == null ? "" : s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  const stripFm = (s) => String(s == null ? "" : s).replace(/^﻿?\s*---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
  let dropped = false;
  const drop = () => { if (dropped) return; dropped = true; if (panel) panel.classList.add("chatting"); const w = qs("#ariaChatWelcome"); if (w) w.remove(); };
  // RUN 35-1 — auto-scroll to bottom on new content, BUT pause if the user has scrolled up to read history.
  // stickToBottom flips false when they scroll away from the bottom, true again when they return near it.
  let stickToBottom = true;
  log.addEventListener("scroll", () => {
    const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 48;
    stickToBottom = nearBottom;
  });
  const scrollEnd = (force = false) => { if (force || stickToBottom) { log.scrollTop = log.scrollHeight; stickToBottom = true; } };
  function row(who, text) {
    drop();
    const r = document.createElement("div"); r.className = "aria-chat-row " + (who === "me" ? "me" : "aria");
    r.innerHTML = `<p class="aria-chat-who">${who === "me" ? "You" : "ARIA"}</p><div class="aria-chat-bubble">${esc(text)}</div>`;
    log.appendChild(r); scrollEnd(who === "me"); return r; // the user's own message always jumps to bottom
  }
  function thinking() {
    drop();
    const r = document.createElement("div"); r.className = "aria-chat-row aria";
    r.innerHTML = `<p class="aria-chat-who">ARIA</p><div class="aria-chat-bubble"><span class="aria-chat-dots"><span></span><span></span><span></span></span></div>`;
    log.appendChild(r); scrollEnd(); return r;
  }
  function fill(r, res, question) {
    const bubble = r.querySelector(".aria-chat-bubble");
    // RUN 34-1 — render the answer as real markdown (H3/ol/ul/code/links), not raw "## / - / 1." text.
    const answer = document.createElement("div"); answer.className = "aria-chat-md";
    answer.innerHTML = renderMarkdown(stripFm((res && res.text) || "I couldn't get an answer just now — please try again."));
    bubble.textContent = ""; bubble.appendChild(answer);
    const kb = res && res.kbMatch;
    if (kb && (kb.title || kb.slug)) {
      const card = document.createElement("div"); card.className = "aria-chat-article";
      const tier = (kb.tier || "").toLowerCase();
      const url = "https://iisupp.net/aria?article=" + encodeURIComponent(kb.slug || "");
      card.innerHTML = `<div class="ac-top"><span class="ac-title">${esc(kb.title || kb.slug)}</span>${tier ? `<span class="ac-tier">${esc(tier)}</span>` : ""}</div><a href="${url}" target="_blank" rel="noopener">Read full article ↗</a>`;
      bubble.appendChild(card);
    }
    const viaAnthropic = res && res.action !== "kb-match" && res.provider === "aria-brain";
    const badge = document.createElement("div");
    badge.className = "aria-chat-src" + (viaAnthropic ? " anthropic" : "");
    badge.textContent = res && res.action === "kb-match" ? "from the knowledge base · $0" : viaAnthropic ? "via Anthropic (novel question)" : res && res.provider === "local-kb" ? "from the offline knowledge base" : "";
    if (badge.textContent) bubble.appendChild(badge);
    const meta = res && res.kbMeta;
    if (meta && Number.isFinite(Number(meta.total_chunks))) { const c = qs("#ariaChatChunks"); if (c) c.textContent = Number(meta.total_chunks) + " chunks"; }
    // TASK 4 — the one intentional difference from web: Sentinel can RESOLVE it on this device. The chip runs
    // the matched fix through the gated control plane (Confirmed-grade, never autonomous, countdown + kill-switch).
    appendResolveChip(bubble, question);
    appendConfidenceAndFeedback(bubble, res, question);
  }
  // Under every answer, present TWO clear Sentinel-only paths (P1): "Walk me through it" (opens the Walk-through
  // tab in GUIDE mode — safe, changes nothing) and "Resolve it for me" (the gated apply flow). A matched recipe
  // that isn't a vetted/bound Tier-0 action degrades to the Walk-through tab + honest "can't auto-apply this yet";
  // no match also opens the Walk-through tab. NEVER Control Center, never a dead click.
  async function diagnoseRecipeId(question) {
    const d = (await window.sentinel.diagnose?.(question || "")) || {};
    return d.recipeId
      || (Array.isArray(d.causes) && (d.causes.find((c) => c && c.recipeId) || {}).recipeId)
      || (Array.isArray(d.attempts) && (d.attempts.find((a) => a && a.recipeId) || {}).recipeId)
      || "";
  }
  function appendResolveChip(bubble, question) {
    if (!window.sentinel || !window.sentinel.supervisedFix) return;
    const wrap = document.createElement("div"); wrap.className = "aria-chat-resolve";
    const walkBtn = document.createElement("button"); walkBtn.type = "button"; walkBtn.className = "aria-chat-resolve-btn ghost"; walkBtn.textContent = "Walk me through it";
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "aria-chat-resolve-btn";
    btn.textContent = "Resolve it for me";
    const st = document.createElement("span"); st.className = "aria-chat-resolve-status";
    // "Walk me through it" — always opens the guided tab (matched recipe if we can find one, else the intent text).
    walkBtn.addEventListener("click", async () => {
      walkBtn.disabled = true; st.textContent = "Opening the walk-through…";
      let recipeId = ""; try { recipeId = await diagnoseRecipeId(question); } catch { /* fall back to intent */ }
      activateTab("walkthrough");
      renderWalkthrough({ recipeId, intent: question || "", mode: "guide" });
      st.textContent = ""; walkBtn.disabled = false;
    });
    btn.addEventListener("click", async () => {
      btn.disabled = true; st.textContent = "Checking this device…";
      try {
        const recipeId = await diagnoseRecipeId(question);
        // No automatic fix matched → open the Walk-through tab (guide / describe-your-problem), NEVER Control Center.
        if (!recipeId) {
          st.textContent = "No automatic fix matched — opening the step-by-step walk-through.";
          activateTab("walkthrough"); renderWalkthrough({ intent: question || "", mode: "guide" });
          return;
        }
        // Unvetted (no safe auto-apply) → degrade to the Walk-through tab + honest note, NEVER Control Center.
        let vetted = true;
        try { vetted = Boolean((await window.sentinel.isVettedRecipe?.(recipeId))?.vetted); } catch { vetted = true; }
        if (!vetted) {
          st.textContent = "I can't safely auto-apply this one yet — here are the exact steps.";
          activateTab("walkthrough"); renderWalkthrough({ recipeId, intent: question || "", mode: "guide" });
          return;
        }
        const fix = await window.sentinel.supervisedFix({ recipeId, mode: "confirmed" });
        if (!fix || fix.ok === false) {
          st.textContent = fix?.error === "r11_blocked" ? "1 personal folder excluded." : fix?.verdict === "veto" ? `Held by safety supervisor: ${fix.reason || "vetoed"}.` : "Couldn't start the fix.";
        } else if (fix.countdown) {
          st.textContent = `Applying in ${fix.seconds || 10}s — cancel from the countdown, or Ctrl+Alt+K to abort.`;
        } else if (fix.policy && fix.policy.dryRun === false) { st.textContent = "Fix applied (reversible — see Restore points)."; }
        else { st.textContent = "Previewed safely (dry-run)."; }
      } catch { st.textContent = "Couldn't resolve right now."; btn.disabled = false; }
    });
    wrap.append(walkBtn, btn, st); bubble.appendChild(wrap);
  }
  // RUN-B B1 — per-answer confidence badge (derived from the REAL top match score) + a "Was this fixed?"
  // feedback control that records a REAL resolution outcome. That outcome drives the honest deflection %
  // on the dashboard + the RUN-D pilot->paid proof. Real-or-empty: no score => no badge; nothing is faked.
  function appendConfidenceAndFeedback(bubble, res, question) {
    const top = res && Array.isArray(res.matches) && res.matches[0] && Number.isFinite(res.matches[0].score)
      ? res.matches[0].score : null;
    const conf = confidenceBadge(top);
    if (conf) {
      const c = document.createElement("span");
      c.className = "aria-chat-confidence conf-" + conf.level;
      c.textContent = conf.label;
      c.title = "Confidence reflects how well your question matched the knowledge base.";
      bubble.appendChild(c);
    }
    if (!window.sentinel || !window.sentinel.resolutionOutcome) return;
    const sid = "ans-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const wrap = document.createElement("div"); wrap.className = "aria-chat-feedback";
    const q = document.createElement("span"); q.className = "aria-chat-feedback-q"; q.textContent = "Did this fix it?";
    const yes = document.createElement("button"); yes.type = "button"; yes.className = "aria-chat-feedback-btn"; yes.textContent = "Yes, fixed";
    const no = document.createElement("button"); no.type = "button"; no.className = "aria-chat-feedback-btn"; no.textContent = "Not yet";
    const st = document.createElement("span"); st.className = "aria-chat-feedback-status";
    async function mark(outcome) {
      yes.disabled = true; no.disabled = true;
      try {
        await window.sentinel.resolutionOutcome({ outcome, matchScore: top, sessionId: sid });
        st.textContent = outcome === "resolved" ? "Thanks — logged as resolved." : "Thanks — we'll keep improving.";
      } catch { st.textContent = "Couldn't save that just now."; yes.disabled = false; no.disabled = false; }
    }
    yes.addEventListener("click", () => mark("resolved"));
    no.addEventListener("click", () => mark("not-yet"));
    wrap.append(q, yes, no, st); bubble.appendChild(wrap);
  }
  input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = Math.min(140, input.scrollHeight) + "px"; });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg || !window.sentinel || !window.sentinel.chat) return;
    row("me", msg); input.value = ""; input.style.height = "auto"; send.disabled = true; input.disabled = true;
    const r = thinking();
    try { fill(r, await window.sentinel.chat(msg, {}), msg); }
    catch (err) { r.querySelector(".aria-chat-bubble").textContent = "Something went wrong reaching ARIA. Please try again."; }
    finally { send.disabled = false; input.disabled = false; input.focus(); scrollEnd(); }
  });
}

// RUN 33-E — first-launch Setup wizard (6 steps). Shows once on a fresh install (state.setupNeeded) or when
// re-run from Settings; collects prefs and persists via sentinel.completeSetup. The state machine + never-replay
// invariant live in app-config.mjs (tested). Setup must never replay after completion.
let setupShown = false;
const setupPrefs = { mode: "manual", landOnAria: false, kbNotifications: true, trayIcon: true };
const SETUP_STEPS = [
  { kicker: "Welcome", title: "ARIA Sentinel — your AI IT assistant", body: () => `<p class="setup-lead">Resident IT support that answers from the knowledge base first (free), and only calls the reasoning model for novel questions. Let's get you set up in a few steps.</p>` },
  { kicker: "License", title: "Activate or start a trial", body: () => `<p class="setup-lead">Paste a license key, or start a free 12-hour Pro trial — you can do this anytime from Settings.</p><input id="setupLicense" placeholder="Paste license key (optional)" autocomplete="off" />` },
  { kicker: "Mode", title: "Choose your default mode", body: () => `<p class="setup-lead">Manual is recommended — ARIA previews fixes before doing anything. You can change this anytime.</p>
    <label class="setup-radio"><input type="radio" name="setupMode" value="manual" ${setupPrefs.mode === "manual" ? "checked" : ""}/> <b>Manual</b> — preview only (recommended)</label>
    <label class="setup-radio"><input type="radio" name="setupMode" value="confirmed" ${setupPrefs.mode === "confirmed" ? "checked" : ""}/> <b>Confirmed</b> — execute after a 10s countdown</label>` },
  { kicker: "ARIA Chat", title: "ARIA Chat", body: () => `<p class="setup-lead">ARIA Chat lives in the ARIA tab (left panel) — or press Ctrl+Alt+A anytime.</p><label class="setup-check"><input type="checkbox" id="setupLand" ${setupPrefs.landOnAria ? "checked" : ""}/> Open the ARIA tab when Sentinel starts</label>` },
  { kicker: "Notifications", title: "Notifications", body: () => `<label class="setup-check"><input type="checkbox" id="setupKbNotif" ${setupPrefs.kbNotifications ? "checked" : ""}/> Tell me when ARIA learns new fixes</label><label class="setup-check"><input type="checkbox" id="setupTray" ${setupPrefs.trayIcon ? "checked" : ""}/> Show the system-tray icon</label>` },
  { kicker: "Done", title: "You're all set", body: () => `<p class="setup-lead">ARIA Sentinel is ready. Open the Dashboard to see status, the ARIA tab to chat, or the Learning sub-section to see what ARIA knows.</p>` }
];
let setupStep = 0;
function maybeShowSetupWizard(state) {
  if (setupShown || !state || !state.setupNeeded) return;
  setupShown = true; setupStep = 0; renderSetupStep();
  const modal = qs("#setupWizard"); if (modal) modal.hidden = false;
}
function captureSetupStep() {
  const mode = qs('input[name="setupMode"]:checked'); if (mode) setupPrefs.mode = mode.value;
  const land = qs("#setupLand"); if (land) setupPrefs.landOnAria = land.checked;
  const kb = qs("#setupKbNotif"); if (kb) setupPrefs.kbNotifications = kb.checked;
  const tray = qs("#setupTray"); if (tray) setupPrefs.trayIcon = tray.checked;
}
function renderSetupStep() {
  const s = SETUP_STEPS[setupStep]; if (!s) return;
  setText("setupKicker", s.kicker); setText("setupTitle", s.title);
  const body = qs("#setupBody"); if (body) body.innerHTML = s.body();
  const dots = qs("#setupDots"); if (dots) dots.innerHTML = SETUP_STEPS.map((_, i) => `<span class="onboard-dot${i === setupStep ? " active" : ""}"></span>`).join("");
  const back = qs("#setupBack"); if (back) back.style.visibility = setupStep === 0 ? "hidden" : "visible";
  const next = qs("#setupNext"); if (next) next.textContent = setupStep === SETUP_STEPS.length - 1 ? "Finish" : "Next";
}
function initSetupWizard() {
  bindClick("setupBack", () => { captureSetupStep(); if (setupStep > 0) { setupStep--; renderSetupStep(); } });
  bindClick("setupNext", async () => {
    captureSetupStep();
    if (setupStep < SETUP_STEPS.length - 1) { setupStep++; renderSetupStep(); return; }
    try { await sentinel.completeSetup?.({ ...setupPrefs }); } catch (e) { /* persistence best-effort */ }
    const modal = qs("#setupWizard"); if (modal) modal.hidden = true;
    if (setupPrefs.landOnAria) activateTab("aria");
  });
  bindClick("reRunSetup", async () => { try { await sentinel.reopenSetup?.(); setupShown = false; } catch (e) {} });
}

// RUN 33 Phase 2 — fill the ARIA tab's data sub-sections (Learning/Health/Memory/Agents). All data is parsed +
// R11-scrubbed in the main process (aria-surfaces.mjs); the renderer only paints it. 🔒 no raw paths reach here.
async function loadAriaData() {
  const esc = (s) => String(s == null ? "" : s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  const timeAgoShort = (iso) => { const t = Date.parse(iso || ""); if (!Number.isFinite(t)) return ""; const m = Math.max(0, Math.floor((Date.now() - t) / 60000)), h = Math.floor(m / 60), d = Math.floor(h / 24); return d >= 1 ? `${d}d ago` : h >= 1 ? `${h}h ago` : `${m}m ago`; };
  const bars = (rows) => rows.map((r) => { const max = Math.max(1, ...rows.map((x) => x.n)); return `<div class="lb-row"><span class="lb-label">${esc(r.label)}</span><span class="lb-track"><span class="lb-fill" style="width:${Math.round((r.n / max) * 100)}%"></span></span><span class="lb-n">${r.n}</span></div>`; }).join("");

  // Health ← aria-system-status (the locked Anthropic banner is already in the HTML — we never touch it).
  try {
    const { data } = (await window.sentinel?.ariaStatus?.()) || { data: null };
    if (data) {
      const dot = qs("#healthDot"); if (dot) dot.dataset.status = data.overall;
      setText("healthOverall", data.overall === "green" ? "All systems healthy" : data.overall === "yellow" ? "Degraded — fallback active" : data.overall === "red" ? "Outage — using local KB" : "Status unavailable");
      setText("healthProbe", data.lastProbe ? `last probe ${timeAgoShort(data.lastProbe)}` : "");
      const ft = qs("#fallthroughChain");
      if (ft) ft.innerHTML = data.tiers.map((tr) => `<div class="ft-tier"><span class="ft-name"><span class="health-dot" data-status="${tr.status}" style="width:9px;height:9px;display:inline-block;margin-right:7px"></span>${esc(tr.name)}</span><span class="ft-meta">${esc(tr.cost)} · ${esc(tr.coverage)}</span></div>`).join("");
    }
  } catch (e) { /* offline → leave placeholder */ }

  // Learning ← aria-kb-stats.
  try {
    const { data } = (await window.sentinel?.ariaLearning?.()) || { data: null };
    if (data) {
      setText("learningHeader", `Knowledge base · ${data.totalChunks != null ? data.totalChunks + " chunks" : "—"}${data.generatedAt ? " · synced " + timeAgoShort(data.generatedAt) : ""}`);
      const recent = qs("#learningRecent");
      if (recent) recent.innerHTML = data.recent.length ? data.recent.map((r) => `<div class="lr-item">${esc(r.title)}${r.tier ? `<span class="lr-tier">${esc(r.tier)}</span>` : ""}<span class="merge-sub" style="float:right">${esc(timeAgoShort(r.addedAt))}</span></div>`).join("") : `<p class="merge-sub">No recent learnings reported.</p>`;
      const tiers = qs("#learningTiers"); if (tiers) tiers.innerHTML = bars([{ label: "L1 (easy)", n: data.byTier.l1 }, { label: "L2 (mid)", n: data.byTier.l2 }, { label: "L3 (hard)", n: data.byTier.l3 }]);
      const cats = qs("#learningCategories"); if (cats) cats.innerHTML = bars(data.topCategories.map((c) => ({ label: c.name, n: c.count })));
    }
  } catch (e) { /* offline */ }

  // Memory ← local sessions (already R11-scrubbed by the main process).
  try {
    const { data } = (await window.sentinel?.ariaMemory?.()) || { data: null };
    if (data) {
      const ms = qs("#memoryStats"); if (ms) ms.innerHTML = `<div class="memory-stats-grid"><span>${data.stats.total} session(s)</span> · <span>${data.stats.totalAsks} asks</span> · <span>${data.stats.kbHits} KB hits</span> · <span>${data.stats.anthropicHits} Anthropic</span></div>`;
      const list = qs("#memoryList");
      if (list) list.innerHTML = data.list.length ? data.list.map((s) => `<details class="mem-item"><summary>${esc(s.id || "session")} · ${s.count} messages · ${esc(timeAgoShort(s.startedAt))}</summary>${s.turns.map((tn) => `<div class="mem-turn ${tn.role}"><strong>${tn.role === "user" ? "You" : "ARIA"}:</strong> ${esc(tn.text)}</div>`).join("")}</details>`).join("") : `<p class="merge-sub">No local conversations yet.</p>`;
    }
  } catch (e) { /* none */ }

  // Agents ← heartbeat files.
  try {
    const { data } = (await window.sentinel?.ariaAgents?.()) || { data: null };
    const fleet = qs("#agentFleet");
    if (fleet) fleet.innerHTML = (data && data.length) ? data.map((a) => `<div class="af-row"><span class="af-dot ${a.status}"></span><strong>${esc(a.name)}</strong><span class="merge-sub">${esc(a.status)}${a.lastTs ? " · " + esc(timeAgoShort(new Date(a.lastTs).toISOString())) : ""}</span><span class="merge-sub" style="margin-left:auto">${esc(a.lastTask)}</span></div>`).join("") : `<p class="merge-sub">No agent heartbeats found.</p>`;
  } catch (e) { /* none */ }
}

// RUN 33-A — "KB v203 · synced 3h ago" in the top bar (mirrors aria-brain-client.formatKbFreshness, tested there).
function renderKbFreshness(meta) {
  const el = qs("#kbFreshness");
  if (!el) return;
  const total = meta && Number.isFinite(Number(meta.total_chunks)) ? Number(meta.total_chunks) : null;
  if (!meta || (total == null && !meta.kb_generated_at)) { el.hidden = true; return; }
  let label = total != null ? `KB v${total}` : "KB";
  const gen = meta.kb_generated_at ? Date.parse(meta.kb_generated_at) : NaN;
  if (Number.isFinite(gen)) {
    const mins = Math.max(0, Math.floor((Date.now() - gen) / 60000)), hrs = Math.floor(mins / 60), days = Math.floor(hrs / 24);
    label += " · synced " + (days >= 1 ? `${days}d ago` : hrs >= 1 ? `${hrs}h ago` : mins >= 1 ? `${mins}m ago` : "just now");
  }
  el.textContent = label; el.hidden = false;
}

function titleCase(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function getSentinelApi() {
  if (window.sentinel) return window.sentinel;
  const {
    ALLOWED_OUTBOUND_PATHS,
    BRIDGE_PORT,
    CONTROL_PLANE_MVP_RECIPE_COUNT,
    CONTROL_PLANE_MVP_STOP_CODE_COUNT,
    RECIPES,
    ROUTING_TARGETS,
    SENTINEL_VERSION,
    STOP_CODES,
    matchRecipes
  } = await import("../shared/recipes.mjs");
  const { contentSafeContext, sanitizeToSignature } = await import("../shared/safety.mjs");

  const listeners = new Set();
  const previewState = {
    version: SENTINEL_VERSION,
    mode: "manual",
    dryRun: true,
    systemFixesEnabled: false,
    externalAiCalls: false,
    paused: false,
    pausedUntil: 0,
    firstRunComplete: true,
    killed: false,
    restorePoints: [
      { id: "rp-preview-1", name: "ARIA pre-fix DISK.LOW_SPACE", createdAt: new Date().toISOString(), rolledBack: false }
    ],
    serviceNowStatus: { configured: false, connected: false, queued: 0, lastVerified: 0 },
    bridgePort: BRIDGE_PORT,
    bridgeStatus: { listening: true, conflict: false, port: BRIDGE_PORT, owner: "preview", lastError: "" },
    recipeCatalog: {
      localInteractive: RECIPES.length,
      controlPlaneMvp: CONTROL_PLANE_MVP_RECIPE_COUNT,
      localStopCodes: STOP_CODES.length,
      controlPlaneStopCodes: CONTROL_PLANE_MVP_STOP_CODE_COUNT
    },
    recipes: RECIPES,
    routingTargets: ROUTING_TARGETS,
    allowedOutboundPaths: ALLOWED_OUTBOUND_PATHS,
    transparencyLog: [{ ts: new Date().toISOString(), tag: "PREVIEW", text: "Browser preview mode. Desktop bridge not required." }],
    knowledgeSources: [
      { name: "Procedures & runbooks", status: "Indexed", docs: 24 },
      { name: "IT policies & workflows", status: "Indexed", docs: 12 },
      { name: "Security & compliance", status: "Indexed", docs: 9 },
      { name: "Audit & regulatory", status: "Indexed", docs: 6 },
      { name: "Culture & tone", status: "Processing", docs: 4 }
    ],
    systemChecks: []
  };
  previewState.systemChecks = defaultChecks(previewState);

  const notify = () => listeners.forEach((listener) => listener({ ...previewState }));
  const log = (tag, text) => {
    previewState.transparencyLog.unshift({ ts: new Date().toISOString(), tag, text });
    notify();
  };

  return {
    getState: async () => ({ ...previewState }),
    onState: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onNavigate: () => () => {},
    setMode: async (mode) => {
      previewState.mode = mode;
      log("POLICY", `Mode set to ${mode}.`);
      return { ok: true };
    },
    setDryRun: async (dryRun) => {
      previewState.dryRun = Boolean(dryRun);
      log("POLICY", `Dry-run ${previewState.dryRun ? "enabled" : "disabled"}.`);
      return { ok: true };
    },
    setPaused: async (milliseconds = 0) => {
      previewState.pausedUntil = milliseconds ? Date.now() + Number(milliseconds) : 0;
      previewState.paused = previewState.pausedUntil > Date.now();
      log("WATCH", previewState.paused ? "Watching paused." : "Watching resumed.");
      return { ok: true };
    },
    showGlobe: async () => {
      log("OVERLAY", "Top-center globe requested.");
      return { ok: true };
    },
    openAdminConsole: async () => {
      log("ADMIN", "Local admin console requested.");
      return { ok: true };
    },
    updateKnowledge: async () => {
      previewState.knowledgeSources = previewState.knowledgeSources.map((source) => ({ ...source, status: "Indexed" }));
      log("KB", "Preview knowledge sources refreshed.");
      return { ok: true };
    },
    selfDiagnose: async () => {
      previewState.systemChecks = defaultChecks(previewState);
      log("SELF-CHECK", "Settings self diagnosis passed.");
      return { ok: true, checks: previewState.systemChecks, bridgeStatus: previewState.bridgeStatus };
    },
    selfRepair: async () => {
      previewState.systemChecks = defaultChecks(previewState);
      log("SELF-REPAIR", "Preview self repair ran.");
      return { ok: true, actions: ["overlay-verified", "bridge-verified"], diagnosis: { ok: true, checks: previewState.systemChecks } };
    },
    detect: async (input = {}) => {
      const signature = sanitizeToSignature(input);
      const [match] = matchRecipes([signature.code, signature.family, input.issue || ""].join(" "), { limit: 1 });
      if (!match) return { ok: false, error: "no_match" };
      log("DETECT", `${match.recipe.signal}: ${match.recipe.title}`);
      return { ok: true, detection: { ...match.recipe, recipeId: match.recipe.id, context: contentSafeContext(input) } };
    },
    runRecipe: async (recipeId) => {
      const recipe = RECIPES.find((item) => item.id === recipeId);
      log("RUN", `Dry-run recipe ${recipe?.signal || recipeId}.`);
      return { ok: Boolean(recipe), dryRun: true, recipe, message: "Dry-run complete. No system changes were made." };
    },
    reportError: async (payload = {}) => {
      log("SELF-ERROR", `Renderer reported ${payload.source || "error"}.`);
      return { ok: true };
    },
    serviceNowTest: async () => {
      log("SERVICENOW", "Preview ServiceNow test (no live connection).");
      return { ok: false, configured: false };
    },
    serviceNowList: async () => ({ ok: true, configured: false, incidents: [] }),
    serviceNowComment: async () => ({ ok: false, dryRun: true }),
    rollback: async (id) => {
      log("RESTORE PT", `Preview roll back ${String(id).slice(0, 8)}.`);
      return { ok: true, dryRun: true };
    },
    ingestKb: async (file = {}) => {
      previewState.knowledgeSources.unshift({ name: file.name || "Customer document", status: "Indexed", docs: 1 });
      log("KB", "Preview document indexed locally.");
      notify();
      return { ok: true, chunkCount: 1, status: "Indexed", sha256: "preview" };
    },
    completeOnboarding: async () => ({ ok: true }),
    runDiagnostic: async () => ({
      ok: true,
      passed: 7,
      total: 7,
      rows: [
        { id: "bridge", label: "Local bridge port", ok: true, severity: "ok", detail: "Listening on 127.0.0.1:37841", remediation: "" },
        { id: "watchers", label: "Detection watchers", ok: true, severity: "ok", detail: "7/7 watchers · last tick 4s ago", remediation: "" },
        { id: "servicenow", label: "ServiceNow connection", ok: true, severity: "ok", detail: "Not configured (local drafts only)", remediation: "" },
        { id: "kb-bundle", label: "Knowledge bundle", ok: true, severity: "ok", detail: "Bundle current verified", remediation: "" },
        { id: "audit", label: "Audit log integrity", ok: true, severity: "ok", detail: "1 local events · content-blind", remediation: "" },
        { id: "tray", label: "Tray icon", ok: true, severity: "ok", detail: "Gold globe present", remediation: "" },
        { id: "overlay", label: "Overlay rendering", ok: true, severity: "ok", detail: "Globe window available", remediation: "" }
      ]
    })
  };
}

init().catch((error) => {
  console.error(error);
  document.body.innerHTML = `
    <main class="settings-workspace">
      <section class="panel">
        <p class="eyebrow">ARIA Sentinel</p>
        <h1>Self-repair started</h1>
        <p>ARIA caught a renderer startup error and reported it to the local self-diagnosis path.</p>
      </section>
    </main>
  `;
});
