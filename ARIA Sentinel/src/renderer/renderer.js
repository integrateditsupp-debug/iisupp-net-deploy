import { bannerVisible, bannerModel, SECURITY_BANNER_DISMISS_KEY } from "../shared/security-banner.mjs";
import "./components/aria-globe.mjs"; // defines the <aria-globe> custom element used in the rail
import { extOf, requiredSteps, stepFor } from "../shared/delete-confirm.mjs";
import { renderMarkdown } from "../shared/aria-markdown.mjs"; // RUN 34-1 — readable chat answers (markdown → HTML)
import { repairTruncatedTail } from "../shared/kb-text.mjs"; // F2 — never render a mid-line-truncated tail ("Print server (`")
import { splitShapedAnswer } from "../shared/kb-answer-shape.mjs"; // P7 — concise lead + collapsible "more help"
import { walkStepsFor, hasWalkSteps, listFlows, getFlow, flowStep, resolveStep, LAUNCHER_GROUPS } from "../shared/walkthrough-steps.mjs"; // ONE shared source — recipe steps + companion flows + launcher groups
import { confidenceBadge } from "../shared/resolution-outcome.mjs"; // RUN-B B1 — per-answer confidence + "Was this fixed?" feedback
// JULY PORT 2026-10-14 — the web ARIA entry flow (welcome + quick-issue chips) and the SCRIPTED demo lab
// (100-call library · live capture chain · autonomous takeover choice). The demo is copy, never an action.
import { ARIA_WEB_QUICK_ACTIONS, ARIA_WEB_WELCOME } from "../shared/aria-web-surface.mjs";
import { COMMON_CALL_DEMO_SCENARIOS, buildAutonomousTakeoverDemo, buildLiveCaptureDemo, demoDisposition, summarizeCommonCallDemo } from "../shared/common-call-demo.mjs";
// SENTINEL TRIAL GATING 2026-07-02 — per-tab enable/lock map (Walk-Through survives trial expiry; the buy path never locks).
import { tabGateMap, LOCKED_TAB_MESSAGE, WALKTHROUGH_TAB } from "../shared/tab-gating.mjs";
// RUN 22 — dashboard / performance / SLA / compliance / reports tab builders + status.
import { computeHeroStatus, heroSubline, heroTiles, computeRunState, railStatusLabel } from "../shared/dashboard-status.mjs";
import * as DashboardTab from "./tabs/dashboard.mjs";
import * as PerformanceTab from "./tabs/performance.mjs";
import * as SlaTab from "./tabs/sla.mjs";
import * as ComplianceTab from "./tabs/compliance.mjs";
import * as ReportsTab from "./tabs/reports.mjs";
import * as HomeTab from "./tabs/home.mjs"; // PROD 2026-10-14 (audit §4) — the plain-language home lists + watcher line
import { createVoiceConversation } from "./voice-conversation.mjs"; // RUN-CU / CU4 — on-device multi-turn voice (ARIA tab 🎤)
// PROD 2026-10-14 — ONE source each for: prices + the buy URL (R4/R5), trial sentences (R3/R13/R20), what a fix really
// did (R1/R2/R14/R10) and the first-run wizard model (R8). All pure + browser-safe.
import { TIERS, CLIENT_PLANS, plansUrl, priceLine, monthlyDisplay, visitsLabel, SEPARATE_HUMAN_SUPPORT_NOTE } from "../shared/pricing-tiers.mjs";
import { trialDays, trialState, trialFractionLeft, licenseStatusLine, trialBadgeText, accountStatusLine, lockedTabCopy, wizardTrialLine } from "../shared/trial-copy.mjs";
import { describeSupervisedResult, approveToast, describeDryRun, killSwitchToast } from "../shared/fix-outcome.mjs";
import { ruleSentence, normalizeAdvisoryPrefs, ADVISORY_INTERVAL_MIN, ADVISORY_INTERVAL_MAX, ADVISORY_SNOOZE_MIN_H, ADVISORY_SNOOZE_MAX_H } from "../shared/advisory-escalation.mjs"; // 2026-10-14 — advise three times, then act
import { WHAT_CARDS, quickChoiceToPrefs, quickChoiceOf, applySafeDefaults, summaryLines, autonomyForMode, isLicenseKeyShaped, progressLabel } from "../shared/setup-flow.mjs";

let state;
let sentinel;

const HOUR_MS = 60 * 60 * 1000;
// JULY PORT 2026-10-14 (c0a0f6b4) — the Resolution surface inside the Recipes tab: Fix It (search + family filter over
// the same vetted-fix / Tier-0 lists) and Fix History (REAL local activity: detections + audit rows, last 30 days,
// newest first, max 50, 10 per page). Real-or-empty — never a fabricated row.
const FIX_HISTORY_DAYS = 30;
const FIX_HISTORY_MAX = 50;
const FIX_HISTORY_PAGE_SIZE = 10;
let recipeCatalogCache = [];
let tier0Cache = [];
let fixSearchTerm = "";
let fixCategoryFilter = "all";
let fixHistoryPage = 1;
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
  integrations: "Integrations", // RESTORED 2026-07-02 — hosts ServiceNow + Entra + Remote + browser ext + Slack/Teams (Rule 15)
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
  // JULY PORT 2026-10-14 (c0a0f6b4) — Resolution sub-anchors inside the Recipes tab (Fix It · Fix History).
  "fix-it": { tab: "recipes", anchor: "fix-it" },
  "fix-history": { tab: "recipes", anchor: "fix-history" },
  "system-context": { tab: "system", anchor: "system-context" },
  "cross-platform": { tab: "system", anchor: "cross-platform" },
  // Integrations restore — old "servicenow" tab/deep-link routes to the Integrations tab's ServiceNow section
  // (every prior nav call, hotkey, and integration-card deep-link keeps working — Rule 15).
  servicenow: { tab: "integrations", anchor: "sn-section" },
  entra: { tab: "integrations", anchor: "entra-section" },
  remote: { tab: "integrations", anchor: "remote-section" },
  mode: { tab: "settings", anchor: "mode" },
  autonomy: { tab: "settings", anchor: "autonomy" }, // RUN-CU / CU4 — Autonomy & contacts (wizard v2 prefs)
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
  wireCountdownCard();   // PROD 2026-10-14 (audit R10) — the in-app countdown + Cancel
  wireLiveFixes();       // PROD 2026-10-14 (audit R1/R2) — the consent switch everything depends on
  wireHotkeyPrefs();     // PROD 2026-10-14 (audit M20) — shortcuts on/off · AltGr-safe · kill-switch
  wireSetupDialogA11y(); // PROD 2026-10-14 (audit R8/R16) — focus trap + Escape on the wizard
  // (audit R15) the footer globe shrinks so the whole rail fits a 1366×768 work area (size="120" stays in the markup).
  qs(".rail-footer aria-globe")?.setAttribute("size", "56");
  sentinel.onState((next) => renderState(next));
  sentinel.onAdvisory?.((view) => advisoryChatLine(view)); // 2026-10-14 — Notice n of 3 → the ARIA chat (Home row comes with the state)
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
  // F6 (2026-07-02) — highlight the CORRECT sub-anchor: the redirected one, else default to the FIRST link
  // (Chat for ARIA) so opening ARIA never wrongly highlights Memory.
  const activeSub = redirect ? redirect.anchor : null;
  qsa(".nav-sub").forEach((sub) => {
    const on = sub.dataset.sub === target;
    qsa("a[data-anchor]", sub).forEach((a, i) => a.classList.toggle("active", on && (activeSub ? a.dataset.anchor === activeSub : i === 0)));
  });
  setText("pageTitle", TAB_TITLES[target]);
  // Eyebrow follows the active view (was hard-coded "ARIA Sentinel · Settings" on every tab — read as unfinished).
  if (TAB_TITLES[target]) setText("pageEyebrow", `ARIA Sentinel · ${TAB_TITLES[target]}`);
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
  if (target === "settings") loadAutonomyPrefs(); // RUN-CU / CU4 — Autonomy & contacts form
  if (target === "settings") loadAdvisoryPrefs(); // 2026-10-14 — "Tell me first": minutes between notices + the rule in plain words
  if (target === "control-center") renderApprovals(state); // RUN-CU / CU4 — Approvals section (pending + last 10 decided)
  if (target === "integrations") { loadIntegrations(); loadIncidents(); } // Integrations tab — status grid + ServiceNow incidents
  if (target === "integrations") loadOfficeSafety(); // JULY PORT 2026-10-14 — Office Safety Net panel (opt-in)
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
async function renderWalkthrough(target) {
  walkthroughTarget = target || null;
  const body = qs("#walkthroughBody");
  const titleEl = qs("#walkthroughTitle");
  if (!body) return;
  const recipeId = target && target.recipeId ? String(target.recipeId) : "";
  const intent = target && target.intent ? String(target.intent) : "";

  // A companion flow opened full-screen in the tab (the tab is the "library" view of the same content source).
  if (target && target.flowId) { renderCompanionFlowInTab(String(target.flowId)); return; }

  // LAUNCHER (2026-07-14) — the tab is a launcher: pick a system, press Start, and the guided walk-through opens
  // UNDER the floating globe (its own overlay), live-opening each setup target as it advances. "Fix a problem"
  // still routes into the ARIA chat. No step content renders in the tab; the in-tab runner stays as a fallback.
  if (!recipeId && !intent) {
    if (titleEl) titleEl.textContent = "Walk-through";
    let selectedFlow = null;
    const launcherCards = (group) => `
      <div class="walkthrough-library">
        ${listFlows(group).map((f) => `
          <button class="walkthrough-lib-card" data-flow="${escapeHtml(f.id)}">
            <span class="walkthrough-lib-title">${escapeHtml(f.title)}</span>
            <span class="walkthrough-lib-blurb">${escapeHtml(f.blurb || "")}</span>
            <span class="walkthrough-lib-start">Start ▸</span>
          </button>`).join("")}
      </div>`;
    // BIG START (2026-07-16) — pick a system (its card highlights), then the big primary START launches that flow
    // under the globe, which auto-runs the majority for you. The per-card Start (click a card) stays too (Rule 15).
    body.innerHTML = `
      <p class="note">Pick a system to set up, then press <b>Start setup</b> — the guided walk-through opens right under the floating globe and moves itself along: ARIA opens the right web page for you in your browser and pauses whenever you need to type, choose, sign in or pay. Guide and setup change nothing on your PC; you sign in and pay yourself.</p>
      <div class="button-row walkthrough-start-row">
        <button class="primary walkthrough-big-start" id="walkthroughBigStart" disabled>▶ Start setup</button>
        <button class="ghost" id="walkthroughDescribe">Fix a problem</button>
      </div>
      ${LAUNCHER_GROUPS.map((g) => `<p class="eyebrow">${escapeHtml(g.label)}</p>${g.sub ? `<p class="note walkthrough-group-sub">${escapeHtml(g.sub)}</p>` : ""}${launcherCards(g.group)}`).join("")}
      <p class="note resolve-status" id="walkthroughStartStatus" hidden></p>`;
    const bigStart = qs("#walkthroughBigStart");
    const selectCard = (b) => {
      qsa("[data-flow]").forEach((x) => x.classList.toggle("selected", x === b));
      selectedFlow = b.dataset.flow;
      if (bigStart) { bigStart.disabled = false; bigStart.textContent = "▶ Start " + (b.querySelector(".walkthrough-lib-title")?.textContent || "setup"); }
    };
    qs("#walkthroughDescribe")?.addEventListener("click", () => { activateTab("aria"); qs("#ariaChatInput")?.focus(); });
    // Per-card Start (kept): clicking a card highlights it AND launches it under the globe (quick launch).
    qsa("[data-flow]").forEach((b) => b.addEventListener("click", () => { selectCard(b); startWalkthroughUnderGlobe(b.dataset.flow, qs("#walkthroughStartStatus")); }));
    // Big START (picked-system launcher): launches the highlighted system under the globe.
    bigStart?.addEventListener("click", () => { if (selectedFlow) startWalkthroughUnderGlobe(selectedFlow, qs("#walkthroughStartStatus")); });
    return;
  }

  const steps = walkStepsFor(recipeId);
  if (titleEl) titleEl.textContent = "Walk-through" + (recipeId ? " · " + recipeId : "");

  // Real-or-empty fallback — a matched recipe with no authored steps yet. Never fabricate a walk; offer the
  // verified KB article + (only when a genuinely safe auto-fix is bound) the gated-resolve path. F1 (2026-07-02):
  // gate the "Resolve it for me" offer on isVettedRecipe so we NEVER surface a resolve that would be held with
  // "(none) is not in the signed catalog" — an unvetted/empty id shows the article + Ask ARIA only (Rule 14).
  if (!steps.length) {
    const kbUrl = "https://iisupp.net/aria" + (recipeId ? "?article=" + encodeURIComponent(recipeId) : "");
    let vetted = false;
    if (recipeId) { try { vetted = Boolean((await sentinel.isVettedRecipe?.(recipeId))?.vetted); } catch { vetted = false; } }
    body.innerHTML = `
      <p class="note">${vetted
        ? "Guided steps for this exact issue are being written. Here's the verified knowledge-base article, or you can let ARIA resolve it for you (gated — you approve, with a countdown and one-click stop)."
        : "Guided steps for this exact issue are being written. Here's the verified knowledge-base article. There's no safe one-click auto-fix for this one yet — ask ARIA and I'll walk you through it."}</p>
      <div class="button-row">
        <a class="ghost" href="${escapeHtml(kbUrl)}" target="_blank" rel="noopener">Open the KB article ↗</a>
        ${vetted
          ? `<button class="primary" data-walkthrough-resolve="${escapeHtml(recipeId)}">Resolve it for me (gated)</button>`
          : `<button class="ghost" id="walkthroughAskAria">Ask ARIA</button>`}
      </div>
      <p class="note resolve-status" id="walkthroughResolveStatus" hidden></p>`;
    const rb = qs("[data-walkthrough-resolve]");
    if (rb) rb.addEventListener("click", () => runAction(rb, () => resolveViaSupervisor(recipeId, "medium", qs("#walkthroughResolveStatus"))));
    qs("#walkthroughAskAria")?.addEventListener("click", () => { activateTab("aria"); qs("#ariaChatInput")?.focus(); });
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
// never autonomous; surfaces the gate's verdict. PROD 2026-10-14 (audit R1/R2/R14): the status line is the REAL
// result (fix-outcome.mjs) — policy copy from main, needs-admin, declined, failed, countdown, preview — and only
// a result whose policy says dryRun:false may read as "fixing it now". Never "Running" when nothing ran.
async function resolveViaSupervisor(recipeId, risk, statusEl) {
  let r = null;
  try { r = await sentinel.supervisedFix?.({ recipeId, risk: risk || "medium", mode: "confirmed" }); } catch { r = null; }
  const outcome = describeSupervisedResult(r, { liveFixes: state && state.liveFixes });
  if (statusEl) {
    statusEl.hidden = false;
    statusEl.textContent = outcome.text;
    statusEl.dataset.outcome = outcome.kind;
    statusEl.classList.toggle("resolve-fail", outcome.ok === false);
  }
  if (outcome.kind === "countdown") showCountdownCard({ id: outcome.countdownId, secondsLeft: outcome.seconds, recipeId, title: recipeTitleOf(recipeId), canCancel: true });
  return r;
}

function recipeTitleOf(recipeId) {
  const r = (state && Array.isArray(state.recipes) ? state.recipes : []).find((x) => x && x.id === recipeId);
  return (r && r.title) || String(recipeId || "a fix");
}

// Walk-through LAUNCHER — Start opens the guided flow UNDER the floating globe (its own overlay window, which
// survives the app window minimizing/closing). If the overlay can't show (globe unavailable on this run), fall
// back to the in-tab full-screen runner so the user is never stuck — the SAME content, just relocated (Rule 15).
async function startWalkthroughUnderGlobe(flowId, statusEl) {
  if (!flowId) return;
  try {
    const r = await sentinel.openCompanionFlow?.(flowId);
    if (r && r.ok) {
      if (statusEl) { statusEl.hidden = false; statusEl.textContent = "Opened under the floating globe — follow it there. You can minimize this window."; }
      return;
    }
  } catch { /* fall through to the in-tab runner */ }
  renderCompanionFlowInTab(flowId); // graceful fallback — the relocated content is never deleted (Rule 15)
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
    if (!el) return;
    // If the anchor is (or lives inside) a collapsed <details> accordion, open it so the deep-linked
    // content is actually visible — density collapse must never hide a targeted section.
    const details = el.closest && el.closest("details");
    if (details) details.open = true;
    else if (el.tagName === "DETAILS") el.open = true;
    if (el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
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
  wireAutonomyPrefs();    // RUN-CU / CU4 — Settings → Autonomy & contacts + keep-dry-run + test notification
  wireAdvisoryPrefs();    // 2026-10-14 — Settings → Autonomy: advise-first interval / Not-now hours / Never list
  wireCommonCallDemo();   // JULY PORT 2026-10-14 — the scripted demo lab in Control Center (copy only, never an action)
  wireResolutionControls(); // JULY PORT 2026-10-14 — Fix It search/filter + Fix History pagination (Recipes tab)

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
  wireOfficeSafety(); // JULY PORT 2026-10-14 — Office Safety Net toggle + Scan now
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
  // PROD 2026-10-14 (audit R24) — the on-screen kill switch: same path as Ctrl+Alt+K; the toast is main's own sentence.
  bindClick("killSwitchBtn", (button) => runAction(button, async () => {
    const r = await sentinel.killSwitch?.();
    if (r) { markKilledLocally(); showToast(killSwitchToast(r)); }
    else showToast({ title: "Kill switch unavailable", body: "The desktop bridge did not answer. Press Ctrl+Alt+K instead.", danger: true });
    return r;
  }));
  // (audit R8) the coachmark tour on demand — never auto-stacked on the wizard.
  bindClick("dashTakeTour", () => startTour());
  // (audit R18) "browse" is a real picker; the chrome:// button copies the install path instead of pretending to open it.
  const kbInput = qs("#kbFileInput");
  const openPicker = () => kbInput?.click();
  qs("#kbDropzone")?.addEventListener("click", openPicker);
  qs("#kbDropzone")?.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPicker(); } });
  kbInput?.addEventListener("change", async () => {
    const files = Array.from(kbInput.files || []);
    const st = qs("#kbIngestStatus");
    if (st) { st.hidden = false; st.textContent = files.length ? `Indexing ${files.length} file(s)…` : ""; }
    let ok = 0;
    for (const file of files) {
      try { const base64 = await fileToBase64(file); const r = await sentinel.ingestKb?.({ name: file.name, base64 }); if (r && r.ok !== false) ok += 1; }
      catch (err) { reportRendererError(err, "kb-browse"); }
    }
    if (st && files.length) st.textContent = `${ok} of ${files.length} file(s) indexed locally.`;
    kbInput.value = "";
  });
  bindClick("openChromeExt", async (button) => {
    const p = "<Sentinel install path>\\resources\\chrome-extension";
    const r = await sentinel.copyText?.(p);
    const steps = qs("#extSteps"); if (steps) steps.hidden = false;
    showToast(r && r.ok ? { title: "Path copied", body: "Open chrome://extensions in your browser, turn on Developer mode, click Load unpacked and paste the path." } : { title: "Couldn't copy", body: "Follow the steps shown under the button.", danger: true });
    return r;
  });
}

// ===== PROD 2026-10-14 (audit R10) — the in-app countdown card =====
let countdownCurrent = null;
function showCountdownCard(info) {
  const card = qs("#countdownCard");
  if (!card || !info) return;
  countdownCurrent = { id: info.id || null, recipeId: info.recipeId || null };
  const secs = Math.max(0, Number(info.secondsLeft ?? info.remaining) || 0);
  setText("countdownSeconds", String(secs));
  setText("countdownTitle", `Applying: ${info.title || recipeTitleOf(info.recipeId)}`);
  setText("countdownSub", secs > 0 ? `Applying in ${secs} s — press Cancel if you're not sure. Nothing has changed yet.` : "Starting now…");
  const cancel = qs("#countdownCancel");
  if (cancel) { cancel.disabled = info.canCancel === false || secs <= 0; cancel.textContent = "Cancel"; }
  card.classList.toggle("done", secs <= 0);
  card.hidden = false;
  if (secs <= 0) setTimeout(() => { if (countdownCurrent && countdownCurrent.id === (info.id || null)) hideCountdownCard(); }, 2500);
}
function hideCountdownCard() { const card = qs("#countdownCard"); if (card) card.hidden = true; countdownCurrent = null; }
function wireCountdownCard() {
  sentinel.onCountdownTick?.((info) => { if (info) showCountdownCard(info); });
  bindClick("countdownCancel", async (button) => {
    const cur = countdownCurrent || {};
    button.disabled = true; button.textContent = "Cancelling…";
    let r = null;
    try { r = cur.id && sentinel.cancelCountdown ? await sentinel.cancelCountdown(cur.id) : await sentinel.abortCountdown?.(); } catch { r = null; }
    const aborted = r && (r.aborted > 0 || r.ok === true);
    hideCountdownCard();
    showToast(aborted ? { title: "Cancelled", body: `${cur.recipeId ? recipeTitleOf(cur.recipeId) : "The fix"} was cancelled before it ran. Nothing was changed.` } : { title: "Couldn't cancel", body: "The countdown had already finished or could not be reached. Check Dashboard → What I did.", danger: true });
    qsa(`[data-resolve-status]`).forEach((el) => { if (el.dataset.outcome === "countdown" && (!cur.recipeId || el.dataset.resolveStatus === cur.recipeId)) { el.textContent = aborted ? "Cancelled — nothing was changed." : el.textContent; el.dataset.outcome = aborted ? "cancelled" : el.dataset.outcome; } });
    return r;
  });
}

// ===== PROD 2026-10-14 (audit R1/R2) — Live fixes: the consent switch, in Settings → Autonomy + the wizard =====
let liveFixesCache = null;
function liveFixesConsequence(status) {
  if (!status) return "Checking whether ARIA may change this computer…";
  if (status.note) return status.note;
  return status.enabled ? "Live fixes are on. Fixes that need administrator rights ask for your approval (UAC) each time." : "Live fixes are off — every fix previews only. Turn them on to let ARIA apply vetted fixes you confirm.";
}
function renderLiveFixes(status) {
  if (status && typeof status === "object") liveFixesCache = status;
  const s = liveFixesCache;
  const on = Boolean(s && s.enabled);
  const toggle = qs("#liveFixesToggle");
  if (toggle) { toggle.checked = on; toggle.disabled = Boolean(s && s.source === "env"); }
  const note = qs("#liveFixesNote");
  if (note) { note.textContent = liveFixesConsequence(s) + (s && s.source === "env" ? " (set by an environment variable on this device — the switch is read-only)" : ""); note.classList.toggle("on", on); }
  setText("modeLiveFixesLine", on ? "Live fixes: ON — vetted fixes you confirm are applied for real (Windows may ask for admin permission). Switch: Settings → Autonomy." : "Live fixes: OFF — every fix previews only. Turn them on in Settings → Autonomy when you're ready.");
  const chip = qs("#fixStatusChip");
  if (chip) { chip.textContent = s ? (on ? "Fixes: live" : "Fixes: preview") : "Fixes: checking…"; chip.classList.toggle("fix-live", on); chip.classList.toggle("fix-preview", Boolean(s) && !on); chip.title = liveFixesConsequence(s); }
  const sl = qs("#setupLiveFixes"); if (sl && !sl.dataset.touched) sl.checked = on;
}
async function loadLiveFixes() {
  try { const r = await sentinel.getLiveFixes?.(); if (r && typeof r.enabled === "boolean") renderLiveFixes(r); } catch { /* the state push carries the same block */ }
}
function wireLiveFixes() {
  bindChange("liveFixesToggle", async (input) => {
    const want = input.checked;
    let r = null;
    try { r = await sentinel.setLiveFixes?.({ enabled: want }); } catch { r = null; }
    if (r && typeof r.enabled === "boolean") {
      renderLiveFixes(r);
      showToast(r.enabled ? { title: "Live fixes on", body: "ARIA may now apply vetted fixes you confirm. Windows may ask for administrator permission (UAC) for some of them." } : { title: "Live fixes off", body: "Every fix previews only — nothing changes on this computer." });
    } else {
      input.checked = !want;
      showToast({ title: "Couldn't change live fixes", body: "The desktop bridge did not answer. Nothing changed.", danger: true });
    }
    return r;
  });
  loadLiveFixes();
}

// ===== PROD 2026-10-14 (audit M20) — hotkey prefs (on/off · AltGr-safe · kill-switch) =====
function wireHotkeyPrefs() {
  const apply = async () => {
    const prefs = { enabled: Boolean(qs("#hotkeysEnabled")?.checked), altGrSafe: Boolean(qs("#hotkeysAltGrSafe")?.checked), killSwitch: Boolean(qs("#hotkeysKillSwitch")?.checked) };
    let r = null;
    try { r = await sentinel.setHotkeyPrefs?.(prefs); } catch { r = null; }
    setText("hotkeyPrefsStatus", r && r.ok !== false ? "Saved — shortcuts re-registered." : "Couldn't save shortcut settings.");
    return r;
  };
  for (const id of ["hotkeysEnabled", "hotkeysAltGrSafe", "hotkeysKillSwitch"]) bindChange(id, apply);
  (async () => {
    try {
      const r = await sentinel.getHotkeyPrefs?.();
      const p = (r && r.prefs) || {};
      const en = qs("#hotkeysEnabled"); if (en) en.checked = p.enabled !== false;
      const ag = qs("#hotkeysAltGrSafe"); if (ag) ag.checked = p.altGrSafe === true;
      const ks = qs("#hotkeysKillSwitch"); if (ks) ks.checked = p.killSwitch !== false;
    } catch { /* prefs stay at their defaults */ }
  })();
}

// ===== PROD 2026-10-14 (audit R9) — run state: Stop / Pause / kill switch reflected honestly =====
let killedLocally = false;
function markKilledLocally() { killedLocally = true; killDimmed = true; setGlobeState("dim"); renderRunState(state || {}); }
function currentRunState(next) {
  const s = next || state || {};
  const bridge = s.bridgeStatus || {};
  return computeRunState({ ariaStopped: Boolean(s.ariaStopped), killed: Boolean(s.killed), killedLocal: killedLocally && !s.ariaStopped, paused: Boolean(s.paused), bridgeConflict: Boolean(bridge.conflict) });
}
function renderRunState(next) {
  const rs = currentRunState(next);
  setText("railStatus", railStatusLabel((next && next.mode) || "manual", rs));
  const chip = qs("#railStatus");
  if (chip) {
    chip.classList.toggle("stopped", rs.running === false);
    chip.classList.toggle("paused", rs.id === "paused");
    chip.title = rs.hint || "";
  }
  const note = qs("#runStateNote");
  if (note) { note.hidden = rs.id === "watching" || rs.id === "self-repair"; note.textContent = rs.hint ? `ARIA is ${rs.label}. ${rs.hint}` : ""; }
  const start = qs("#startAria"), stop = qs("#stopAria");
  if (start) start.disabled = !(rs.running === false || rs.id === "paused");
  if (stop) stop.disabled = rs.running === false;
  setText("homeWatch", HomeTab.watcherLine({ runState: rs, watchers: next && next.watchers, platformCapabilities: next && next.platformCapabilities, processHealthAgeMs: processHealthAgeMs() }));
  renderHero(rs);
  return rs;
}
// The hero word = trust sources (from the last dashboard call) + the run state; STOPPED / PAUSED never read "PROTECTED".
let lastDashboardSources = {};
let lastSubline = {};
function renderHero(rs) {
  const status = computeHeroStatus({ ...(lastDashboardSources || {}), running: rs.running !== false, paused: rs.id === "paused" });
  const hero = qs("#heroStatus");
  // UX 2026-07-03: no separate dot/globe — the WORD itself carries the status color (see .hero-label CSS).
  if (hero) { hero.dataset.level = status.level; hero.innerHTML = `<strong class="hero-label">${status.label}</strong>`; }
  setText("heroSubline", heroSubline({ ...(lastSubline || {}), runState: rs }));
}
let lastProcessHealthAt = 0;
function processHealthAgeMs() { return lastProcessHealthAt ? Math.max(0, Date.now() - lastProcessHealthAt) : null; }

// ===== JULY PORT 2026-10-14 — the SCRIPTED demo lab (Control Center). Ported from cd518cea · 9f2b9bd7 · 69058206.
// Rule 14: everything rendered here is pre-written copy from src/shared/common-call-demo.mjs, labelled as a scripted
// demonstration in the markup. None of these runners calls window.sentinel — no probe, no recipe, no executor, no
// supervisor; a timer only advances which scripted step is highlighted. The golden frame is a visual label. =====
let commonCallDemoTimer = null;
let liveCaptureDemoTimer = null;
let autonomyDemoTimer = null;

function wireCommonCallDemo() {
  bindClick("runLiveCaptureDemo", () => runLiveCaptureDemo());
  bindClick("runAutonomousTakeoverDemo", () => renderAutonomyChoice());
  bindClick("runAutonomyFrontend", () => runAutonomousTakeoverDemo("frontend"));
  bindClick("runAutonomyBackend", () => runAutonomousTakeoverDemo("backend"));
  bindClick("runCommonCallManual", () => runCommonCallDemo("manual"));
  bindClick("runCommonCallConfirmed", () => runCommonCallDemo("confirmed"));
  bindClick("runCommonCallAutonomous", () => runCommonCallDemo("autonomous"));
  renderLiveCaptureDemo(-1);
  renderAutonomyChoice();
  renderCommonCallDemoSummary("manual", 0);
}

function listHtml(items) {
  return (items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function proofReportFor(demo, stepIndex) {
  const done = stepIndex >= demo.steps.length;
  const active = done ? demo.steps[demo.steps.length - 1] : demo.steps[Math.max(0, stepIndex)];
  const completed = demo.steps.slice(0, Math.max(0, Math.min(stepIndex + 1, demo.steps.length)));
  if (stepIndex < 0) return "No proof report yet.";
  return [
    `Report: ${demo.case.reportId} (scripted demonstration — not measured on this device)`,
    `Case: ${demo.case.title}`,
    `Status: ${done ? "VERIFIED - safe demo complete" : "RUNNING - " + active.label}`,
    "",
    "Before:",
    ...demo.case.before.map((line) => `- ${line}`),
    "",
    "Troubleshooting chain:",
    ...completed.map((step) => `- ${step.label}: ${step.proof}`),
    "",
    "After:",
    ...(done ? demo.case.after.map((line) => `- ${line}`) : ["- Waiting for verification to finish."]),
    ...(done ? ["", demo.completedText] : []),
    "",
    `Safety: ${demo.safety}`
  ].join("\n");
}

function renderLiveCaptureDemo(stepIndex = -1) {
  const demo = buildLiveCaptureDemo();
  const title = qs("#liveCaptureTitle");
  const status = qs("#liveCaptureStatus");
  const before = qs("#liveCaptureBefore");
  const after = qs("#liveCaptureAfter");
  const timeline = qs("#liveCaptureTimeline");
  const report = qs("#liveCaptureReport");
  const progress = qs("#liveCaptureProgress");
  if (!title || !timeline) return;
  const done = stepIndex >= demo.steps.length;
  const running = stepIndex >= 0 && !done;
  title.textContent = running || done ? demo.case.title : "Ready for live capture";
  if (status) status.textContent = done ? "verified (scripted)" : running ? "capturing (scripted)" : "standby";
  if (before) before.innerHTML = listHtml(demo.case.before);
  if (after) after.innerHTML = done ? listHtml(demo.case.after) : "<li>Waiting for verification to finish.</li>";
  if (progress) progress.style.width = `${done ? 100 : stepIndex < 0 ? 0 : Math.round(((stepIndex + 1) / demo.steps.length) * 100)}%`;
  timeline.innerHTML = demo.steps.map((step, index) => {
    const state = done || index < stepIndex ? "done" : index === stepIndex ? "running" : "pending";
    return `
      <article class="live-capture-step ${state}">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <div>
          <strong>${escapeHtml(step.label)}</strong>
          <p>${escapeHtml(step.detail)}</p>
          <small>${escapeHtml(step.proof)}</small>
        </div>
      </article>`;
  }).join("");
  if (report) report.textContent = proofReportFor(demo, stepIndex);
}

function runLiveCaptureDemo() {
  if (liveCaptureDemoTimer) window.clearInterval(liveCaptureDemoTimer);
  setAriaUsingComputerFrame(false);
  let stepIndex = 0;
  renderLiveCaptureDemo(stepIndex);
  liveCaptureDemoTimer = window.setInterval(() => {
    stepIndex += 1;
    renderLiveCaptureDemo(stepIndex);
    if (stepIndex >= buildLiveCaptureDemo().steps.length) {
      window.clearInterval(liveCaptureDemoTimer);
      liveCaptureDemoTimer = null;
    }
  }, 760);
}

function setAriaUsingComputerFrame(active, mode = "frontend") {
  const frame = qs("#ariaUsingComputerFrame");
  if (!frame) return;
  frame.hidden = !active;
  frame.dataset.mode = mode;
  document.body.classList.toggle("aria-control-active", Boolean(active));
}

function autonomyRebootPlanHtml(demo, done) {
  if (!demo?.rebootPolicy?.required) return "";
  const policy = demo.rebootPolicy;
  const attempts = policy.attempts || [];
  const attemptHtml = attempts.map((item, index) => `<li><strong>Attempt ${index + 1}:</strong> ${escapeHtml(item)}</li>`).join("");
  const options = (policy.postponeOptions || []).map((item) => `<button class="ghost autonomy-postpone" type="button" disabled title="Scripted demo — this does not schedule anything">${escapeHtml(item)}</button>`).join("");
  return `
    <h4>Reboot reminder plan</h4>
    <p>${done ? "A reboot is needed for some real fixes. ARIA reminds the user, but this build does not force a restart without user/admin approval." : "If the verified fix needs a reboot, ARIA will show this reminder plan after remediation."}</p>
    <ol>${attemptHtml}</ol>
    <div class="autonomy-postpone-row">${options}</div>
    <small>Forced reboot policy: ${policy.forceEnabled ? "enabled by admin policy" : "disabled in this production-safe demo build"}.</small>`;
}

function autonomyReportFor(demo, stepIndex) {
  if (stepIndex < 0) return "Waiting for user choice: front end visible control or back end remediation.";
  const done = stepIndex >= demo.steps.length;
  const completed = demo.steps.slice(0, Math.max(0, Math.min(stepIndex + 1, demo.steps.length)));
  return [
    `Report: ${demo.reportId} (scripted demonstration — not measured on this device)`,
    `Mode: ${demo.choice.label}`,
    `Status: ${done ? "VERIFIED - autonomous proof complete" : "RUNNING"}`,
    "",
    "Control chain:",
    ...completed.map((step) => `- ${step.label}: ${step.proof}`),
    "",
    done ? demo.completedText : "ARIA is still running the selected workflow.",
    "",
    `Safety: ${demo.safety}`
  ].join("\n");
}

function renderAutonomyChoice(mode = null, stepIndex = -1) {
  const demo = buildAutonomousTakeoverDemo(mode || "frontend");
  const title = qs("#autonomyChoiceTitle");
  const status = qs("#autonomyRunStatus");
  const prompt = qs("#autonomyChoicePrompt");
  const timeline = qs("#autonomyTimeline");
  const reboot = qs("#autonomyRebootPlan");
  if (!title || !timeline) return;
  const standby = !mode && stepIndex < 0;
  const done = !standby && stepIndex >= demo.steps.length;
  const running = !standby && stepIndex >= 0 && !done;
  title.textContent = standby ? "Issue detected - choose how ARIA should run" : demo.issueTitle;
  if (status) status.textContent = done ? "verified (scripted)" : running ? demo.choice.label : "waiting";
  if (prompt) prompt.textContent = standby ? demo.prompt : `${demo.choice.detail} ${demo.safety}`;
  timeline.innerHTML = standby ? demo.choices.map((choice) => `
    <article class="live-capture-step running autonomy-choice-option">
      <span>${choice.id === "frontend" ? "FE" : "BE"}</span>
      <div>
        <strong>${escapeHtml(choice.label)}</strong>
        <p>${escapeHtml(choice.detail)}</p>
        <small>${choice.id === "frontend" ? "User can watch ARIA work." : "User gets status updates while ARIA works quietly."}</small>
      </div>
    </article>`).join("") : demo.steps.map((step, index) => {
      const state = done || index < stepIndex ? "done" : index === stepIndex ? "running" : "pending";
      return `
        <article class="live-capture-step ${state}">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>${escapeHtml(step.label)}</strong>
            <p>${escapeHtml(step.detail)}</p>
            <small>${escapeHtml(step.proof)}</small>
          </div>
        </article>`;
    }).join("");
  if (reboot) {
    reboot.innerHTML = `${autonomyRebootPlanHtml(demo, done)}<pre class="live-capture-report">${escapeHtml(autonomyReportFor(demo, stepIndex))}</pre>`;
  }
}

function runAutonomousTakeoverDemo(mode = "frontend") {
  if (autonomyDemoTimer) window.clearInterval(autonomyDemoTimer);
  const demo = buildAutonomousTakeoverDemo(mode);
  let stepIndex = 0;
  setAriaUsingComputerFrame(demo.visibleFrame, mode);
  renderAutonomyChoice(mode, stepIndex);
  autonomyDemoTimer = window.setInterval(() => {
    stepIndex += 1;
    renderAutonomyChoice(mode, stepIndex);
    if (stepIndex >= demo.steps.length) {
      window.clearInterval(autonomyDemoTimer);
      autonomyDemoTimer = null;
      setAriaUsingComputerFrame(false, mode);
    }
  }, 860);
}

function renderCommonCallDemoSummary(mode, completed = 0) {
  const host = qs("#commonCallDemoSummary");
  if (!host) return;
  const summary = summarizeCommonCallDemo(mode);
  const demoLabel = /demo/i.test(summary.label) ? summary.label : `${summary.label} demo`;
  host.innerHTML = `
    <strong>${escapeHtml(demoLabel)}: ${completed}/${summary.count} scripted calls shown</strong>
    <span>${escapeHtml(summary.categories)} categories · ${escapeHtml(summary.green)} low-risk · ${escapeHtml(summary.highRisk)} high/critical approval stops · ${escapeHtml(summary.safety)} Scripted demonstration — not a measurement.</span>`;
}

function runCommonCallDemo(mode) {
  const list = qs("#commonCallDemoList");
  const progress = qs("#commonCallDemoProgress");
  if (!list) return;
  if (commonCallDemoTimer) window.clearInterval(commonCallDemoTimer);
  setAriaUsingComputerFrame(false);
  const scenarios = COMMON_CALL_DEMO_SCENARIOS;
  const rows = scenarios.map((scenario, index) => {
    const disposition = demoDisposition(scenario, mode);
    return `
      <article class="common-call-row" data-common-call-index="${index}">
        <div class="ccr-top">
          <span class="ccr-number">${String(index + 1).padStart(3, "0")}</span>
          <strong>${escapeHtml(scenario.title)}</strong>
          <em class="ccr-risk ${escapeHtml(scenario.risk)}">${escapeHtml(scenario.riskLabel)}</em>
        </div>
        <p>${escapeHtml(scenario.visualSymptom)}</p>
        <div class="ccr-meta"><span>${escapeHtml(scenario.category)}</span><span>${escapeHtml(disposition.label)} · ${escapeHtml(disposition.status)}</span></div>
        <small>${escapeHtml(disposition.summary)}</small>
      </article>`;
  }).join("");
  list.innerHTML = rows;
  let completed = 0;
  const step = Math.max(2, Math.ceil(scenarios.length / 28));
  const tick = () => {
    completed = Math.min(scenarios.length, completed + step);
    qsa(".common-call-row", list).forEach((row, index) => row.classList.toggle("live", index < completed));
    renderCommonCallDemoSummary(mode, completed);
    if (progress) progress.style.width = `${Math.round((completed / scenarios.length) * 100)}%`;
    if (completed >= scenarios.length && commonCallDemoTimer) {
      window.clearInterval(commonCallDemoTimer);
      commonCallDemoTimer = null;
    }
  };
  renderCommonCallDemoSummary(mode, 0);
  if (progress) progress.style.width = "0%";
  tick();
  commonCallDemoTimer = window.setInterval(tick, 80);
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

  // (audit M4) the version is the real one from main; an unknown version shows "—", never a stale literal.
  setText("railVersion", state.version ? `v${state.version}` : "v—");
  setText("aboutVersion", state.version || "—");
  setText("aboutBuildKind", state.devMode ? "Development run" : "Desktop build");
  if (state.ariaStopped === false && !state.killed) killedLocally = false; // a Start from main re-arms the run state
  renderRunState(state); // (audit R9) rail chip + Start/Stop + watcher line reflect stopped / paused / killed

  setChip("bridgeStatus", bridge.conflict ? `Bridge conflict :${bridge.port}` : bridge.listening ? `Bridge :${bridge.port}` : `Bridge standby :${bridge.port || state.bridgePort}`, bridge.conflict ? "red" : bridge.listening ? "cyan" : "amber");
  renderKbFreshness(state.kbMeta); // RUN 33-A — live KB version + last-synced in the top bar
  if (state.liveFixes && typeof state.liveFixes === "object") renderLiveFixes(state.liveFixes); // (audit R2) the live-fix truth
  renderExcludedFolders(state.excludedFolders); // (audit R7) a count from the person's own settings, never a name

  qsa(".mode-row").forEach((button) => button.classList.toggle("selected", button.dataset.mode === state.mode));
  if (qs("#dryRunToggle")) qs("#dryRunToggle").checked = Boolean(state.dryRun);
  // F5 — the "Simulate ARIA error" dev tool is shown only in a dev run, never in the packaged customer build.
  qs("#simulateAriaError")?.toggleAttribute("hidden", !state.devMode);

  setText("recipeCatalogMeta", `${Number(catalog.localInteractive || recipes.length || 0)} local interactive recipes. Admin-only release gates live in the separate web console.`);
  renderRecipes(recipes);
  renderFixHistory(state); // JULY PORT 2026-10-14 — Fix History from the real detections + audit rows
  renderKnowledge(state.knowledgeSources || []);
  renderRouting(state.routingTargets || []);
  renderOutbound(state.allowedOutboundPaths || []);
  renderLog(state.transparencyLog || []);
  renderSystemChecks(state.systemChecks || defaultChecks(state));
  renderServiceNowStatus(state.serviceNowStatus);
  renderOfficeSafety(state.officeSafety); // JULY PORT 2026-10-14 — path-blind Office Safety Net status
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
  renderApprovals(state);        // RUN-CU / CU4 — approvals (Control Center) refresh on every state push
  renderAutonomyBadge(state);    // RUN-CU / CU4 — current level + keep-dry-run checkbox
  renderPlatformHonesty(state);  // RUN-CU / CU4 (fix k) — detect-only / guided relabels where no fix engine exists
  renderHomeLists(state);        // PROD 2026-10-14 (audit §4) — What I found / did / need from you + what this version can fix
  renderDataUploadStat(state.allowedOutboundPaths || []); // (audit R6) computed, never a literal
  // (audit R8) ONE overlay at a time: the wizard first; the coachmark tour only after it, once.
  maybeShowSetupWizard(state); // RUN 33-E
  maybeShowOnboarding(state);
  maybeShowWhatsNew(state);
}

// PROD 2026-10-14 (audit R7) — excluded folders are shown as a COUNT from the person's own settings.
function renderExcludedFolders(ex) {
  const line = qs("#excludedFoldersLine");
  if (!line) return;
  if (!ex || !Number.isFinite(Number(ex.count))) { line.textContent = "Excluded folders: —"; return; }
  const n = Number(ex.count);
  const extra = Array.isArray(ex.configured) ? ex.configured.length : 0;
  line.textContent = `Excluded folders: ${n} — never read, listed or fixed${extra ? ` (${extra} added by you)` : ""}. The names stay on this device.`;
}

// PROD 2026-10-14 (audit R6) — "paths that upload your content": counted from the declared outbound list.
function renderDataUploadStat(paths) {
  const list = Array.isArray(paths) ? paths : [];
  // A path "uploads your content" only when its declared direction says so and is not content-blind by design.
  const uploads = list.filter((p) => p && /upload|raw|content/i.test(String(p.direction || "")) && !/content-blind/i.test(String(p.direction || ""))).length;
  setText("dataUploadCount", String(uploads));
  setText("dataUploadLabel", `of ${list.length} declared outbound paths upload your content to iisupp.net`);
}

// PROD 2026-10-14 (audit §4) — the plain-language home, fed only from real state.
let lastPendingCards = [];
function renderHomeLists(next) {
  const host = qs("#homeLists");
  if (!host || !next) return;
  host.innerHTML = HomeTab.homeListsHtml({ detections: next.detections || [], log: next.transparencyLog || [], approvals: next.approvals || {}, deferred: next.deferredFixes || [], pending: lastPendingCards });
  // 2026-10-14 — the advise-first notices lead "What I need from you" (each one says when ARIA acts unless you choose).
  const noticeRows = HomeTab.advisoryRowsHtml(Array.isArray(next.advisories) ? next.advisories : []);
  if (noticeRows) { const need = qs("#homeNeed"); if (need) { need.querySelector(".home-empty")?.remove(); need.querySelector(".eyebrow")?.insertAdjacentHTML("afterend", noticeRows); } }
  setText("homeCanFix", HomeTab.canFixLine({ recipes: next.recipes || [], platformCapabilities: next.platformCapabilities, liveFixes: next.liveFixes }));
  qsa("#homeLists [data-home-fix]").forEach((b) => b.addEventListener("click", () => runAction(b, async () => {
    const row = b.closest(".home-row");
    let st = row && row.querySelector(".resolve-status");
    if (!st && row) { st = document.createElement("p"); st.className = "note resolve-status"; st.style.gridColumn = "1 / -1"; st.style.margin = "0"; row.appendChild(st); }
    return resolveViaSupervisor(b.dataset.homeFix, b.dataset.risk || "medium", st);
  })));
  qsa("#homeLists [data-home-walk]").forEach((b) => b.addEventListener("click", () => { activateTab("walkthrough"); renderWalkthrough({ recipeId: b.dataset.homeWalk, mode: "guide" }); }));
  qsa("#homeLists [data-home-dismiss]").forEach((b) => b.addEventListener("click", () => { const row = b.closest(".home-row"); if (row) row.remove(); if (!qs("#homeFound .home-row")) { const f = qs("#homeFound"); if (f) f.insertAdjacentHTML("beforeend", `<p class="home-empty">Nothing else right now.</p>`); } }));
  qsa("#homeLists [data-approve]").forEach((b) => b.addEventListener("click", () => runAction(b, async () => { const r = await sentinel.approveFix?.(b.dataset.approve); showToast(approveToast(r, { liveFixes: next.liveFixes })); return r; })));
  qsa("#homeLists [data-deny]").forEach((b) => b.addEventListener("click", () => runAction(b, async () => { const r = await sentinel.denyFix?.(b.dataset.deny); showToast(r && r.ok ? { title: "Denied", body: "Nothing was changed." } : { title: "Couldn't deny", body: (r && r.reason) || "Already decided or expired.", danger: true }); return r; })));
  // 2026-10-14 — the advise-first notices: Fix now · Not now · Never for this (any choice ends the escalation).
  qsa("#homeLists [data-advisory-ack]").forEach((b) => b.addEventListener("click", () => runAction(b, async () => {
    const row = b.closest(".home-row");
    if (row) row.querySelectorAll("[data-advisory-ack]").forEach((x) => { x.disabled = true; });
    const r = await sentinel.advisoryAck?.(b.dataset.advisoryAck, b.dataset.choice);
    showToast(advisoryAckToast(b.dataset.choice, r));
    return r;
  })));
  wireDeepLinks("homeLists");
}

// ===== RUN-CU / CU4 — approvals · autonomy level · platform honesty =====
function approvalWhen(iso) { const t = Date.parse(iso || ""); if (!Number.isFinite(t)) return ""; const m = Math.round((t - Date.now()) / 60000); return m > 0 ? `waits ${m} min` : "expiring"; }
function renderApprovals(next) {
  const list = qs("#approvalsList"), decided = qs("#approvalsDecided"), count = qs("#approvalsCount"), note = qs("#approvalsNote"), deferred = qs("#deferredFixes");
  if (!list || !decided) return;
  const a = (next && next.approvals) || { pending: [], decided: [], pendingCount: 0 };
  const pending = Array.isArray(a.pending) ? a.pending : [];
  if (count) { count.hidden = pending.length === 0; count.textContent = `${pending.length} pending`; }
  if (note) note.hidden = pending.length > 0;
  list.innerHTML = pending.map((p) => `
    <div class="approval-row" data-approval="${escapeHtml(p.id)}">
      <div><strong><span class="approval-color ${escapeHtml(p.color || "yellow")}"></span>${escapeHtml(p.title || p.recipeId)}</strong>
        <small>${escapeHtml(p.recipeId)} · ${escapeHtml(p.color || "yellow")} tier · asked by ${escapeHtml(p.requestedBy || "sentinel")} (${escapeHtml(p.reason || p.source || "")}) · ${escapeHtml(approvalWhen(p.expiresAt))}</small></div>
      <div class="button-row">
        <button class="primary" data-approve="${escapeHtml(p.id)}">Approve</button>
        <button class="ghost" data-deny="${escapeHtml(p.id)}">Deny</button>
      </div>
    </div>`).join("");
  qsa("#approvalsList [data-approve]").forEach((b) => b.addEventListener("click", () => runAction(b, async () => {
    const r = await sentinel.approveFix?.(b.dataset.approve);
    // (audit R14) the toast branches on the EXECUTION result (r.result.ok), never on the ledger write alone.
    showToast(approveToast(r, { liveFixes: next && next.liveFixes }));
    return r;
  })));
  qsa("#approvalsList [data-deny]").forEach((b) => b.addEventListener("click", () => runAction(b, async () => {
    const r = await sentinel.denyFix?.(b.dataset.deny);
    showToast(r && r.ok ? { title: "Denied", body: "Nothing was changed." } : { title: "Couldn't deny", body: (r && r.reason) || "Already decided or expired.", danger: true });
    return r;
  })));
  const dec = Array.isArray(a.decided) ? a.decided : [];
  decided.innerHTML = dec.length ? dec.map((d) => `<div class="approval-decided"><b>${escapeHtml(d.status)}</b> · ${escapeHtml(d.title || d.recipeId)} · by ${escapeHtml(d.decidedBy || "—")} via ${escapeHtml(d.channel || "—")} · ${escapeHtml(new Date(d.decidedAt || d.createdAt).toLocaleString())}</div>`).join("") : `<p class="note">No decisions yet.</p>`;
  const df = (next && next.deferredFixes) || [];
  if (deferred) { deferred.hidden = df.length === 0; deferred.innerHTML = df.map((d) => `<div class="health-row"><span>queued</span><strong>${escapeHtml(d.title || d.recipeId)}</strong><em>${d.nextWindowStart ? "next window " + escapeHtml(new Date(d.nextWindowStart).toLocaleString()) : "waiting for a maintenance window"}</em></div>`).join(""); }
}
const AUTONOMY_CARDS = [
  { id: "observe", label: "Observe", consequence: "I find it, I tell you, I touch nothing." },
  { id: "safe-auto", label: "Safe-auto", consequence: "I ask you once per fix, then fix it with you present." }, // REVIEW P1-1 — Confirmed asks once, every time
  { id: "approve-first", label: "Approve-first", consequence: "I ask before every fix." },
  { id: "full-auto", label: "Full-auto", consequence: "I fix green and yellow inside your maintenance window and report." }
];
// (audit R2) every "I fix" card carries the live-fix truth: with live fixes OFF the same card previews only.
function autonomyCardsHtml(selected, idPrefix = "autonomy") {
  const live = Boolean(liveFixesCache && liveFixesCache.enabled);
  const fixNote = live ? "" : " (previews only until Live fixes are on)";
  return AUTONOMY_CARDS.map((c) => `<button type="button" class="autonomy-card${c.id === selected ? " selected" : ""}" data-${idPrefix}-level="${c.id}"><b>${escapeHtml(c.label)}</b><span>${escapeHtml(c.consequence)}${c.id === "safe-auto" || c.id === "full-auto" ? escapeHtml(fixNote) : ""}</span><em>${c.id === "full-auto" ? "needs opt-in + restore point" : c.id === "observe" ? "nothing ever changes" : c.id === "safe-auto" ? "asks once per fix · one-click approve" : "every fix waits for a yes"}</em></button>`).join("");
}
function renderAutonomyBadge(next) {
  const cur = qs("#autonomyCurrent");
  const a = next && next.autonomy;
  if (cur && a) {
    const card = AUTONOMY_CARDS.find((c) => c.id === a.level) || AUTONOMY_CARDS[2];
    cur.textContent = `Now: ${card.label} — ${card.consequence}${a.clamped ? ` (${a.reason})` : ""} · runs as ${a.mode} mode · approver: ${a.approverMode}.`;
    cur.classList.toggle("clamped", Boolean(a.clamped));
  }
  const keep = qs("#keepDryRunToggle");
  if (keep && next) keep.checked = next.keepSystemFixesDryRun === true;
}
// (fix k) — where no fix engine exists (macOS = user-level only · phones/tablets/ChromeOS/Linux = guided), every
// control stays, the words change: "Resolve it for me" reads "Guide me (detect-only here)" and the Mode panel says so.
function renderPlatformHonesty(next) {
  const caps = next && next.platformCapabilities;
  if (!caps) return;
  const note = qs("#platformModeNote");
  const guidedOnly = caps.fix !== true;
  if (note) { note.hidden = !guidedOnly; note.textContent = guidedOnly ? `On ${caps.label}: ${caps.copy} Fix modes above apply only where a fix engine exists; here ARIA detects and guides.` : ""; }
  document.body.classList.toggle("platform-guided-only", guidedOnly);
  document.body.classList.toggle("platform-limited-fix", caps.fix === "limited");
  if (guidedOnly) {
    qsa("[data-resolve-fix], .aria-chat-resolve-btn:not(.ghost)").forEach((b) => { if (!b.dataset.relabeled) { b.dataset.relabeled = "1"; b.textContent = caps.fix === "limited" ? "Resolve (user-level) / guide me" : "Guide me (detect-only here)"; } });
    const tier0Note = qs("#tier0List")?.closest(".panel")?.querySelector(".note");
    if (tier0Note && !tier0Note.dataset.platformNote) { tier0Note.dataset.platformNote = "1"; tier0Note.textContent += ` On ${caps.label}: ${caps.copy}`; }
  }
}

// (audit R9) a control-plane / customer-policy kill shows on the real fix chip (the old #dryRunStatus never existed).
function renderKillBanner(next) {
  const chip = qs("#fixStatusChip");
  if (!chip) return;
  if (next.killed) { chip.textContent = "Fixes: halted"; chip.classList.remove("fix-live", "fix-preview"); chip.classList.add("red"); chip.title = next.killReason || "Fixes are halted on this device."; }
  else chip.classList.remove("red");
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

// Integrations tab (RESTORED 2026-07-02) — draw every integration as a status card grouped by area. Status
// is READ-ONLY and real-or-empty: a card is "Connected" only after a verified Test connection; otherwise
// "Not connected". Cards deep-link to the in-tab section that holds their full config (Rule 15 — nothing lost).
// ===== JULY PORT 2026-10-14 (af5e03ab) — the Office File Safety Net panel (Integrations tab). Real-or-empty: every row
// is a count or a time from the service's path-blind status; off = "Off — turn it on above" (never a fake "Healthy"). =====
function formatOfficeSafetyTime(value) {
  if (!value) return "not yet";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "not yet";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatOfficeMinutes(ms) {
  const minutes = Math.max(1, Math.round(Number(ms || 0) / 60000));
  return `${minutes} min`;
}

function renderOfficeSafety(status) {
  const rows = qs("#officeSafetyRows");
  if (!rows || !status) return;
  const toggle = qs("#officeSafetyEnabled");
  if (toggle && toggle !== document.activeElement) toggle.checked = status.enabled === true;
  const on = status.enabled === true;
  const runningText = !on ? "Off — turn it on above" : status.running ? "Running" : "Enabled — waiting for the first scan";
  const healthText = !on ? "Nothing is scanned or copied while off" : status.lastError ? `Needs review (${status.lastError})` : status.validationFailures ? "Review failed backups" : status.lastScanAt ? "Healthy" : "Not measured yet";
  const validationText = on ? `${Number(status.validationsPassed || 0)} passed / ${Number(status.validationFailures || 0)} failed` : "—";
  const skips = Number(status.excludedFolderSkips || 0);
  rows.innerHTML = [
    ["Status", runningText, healthText],
    ["Cadence", `Backup ${formatOfficeMinutes(status.backupIntervalMs)} / validate ${formatOfficeMinutes(status.validationIntervalMs)}`, "Renamed copy"],
    ["Coverage", on ? `${Number(status.filesTracked || 0)} tracked Office file(s)` : "—", on ? `${Number(status.watchRootsCount || 0)} folder(s) watched` : "off"],
    ["Backups", on ? `${Number(status.backupsCreated || 0)} created` : "—", on ? formatOfficeSafetyTime(status.lastBackupAt) : "off"],
    ["Validation", validationText, on ? formatOfficeSafetyTime(status.lastValidationAt) : "off"],
    ["Safety", "Local vault only; no cloud upload; no macros", skips ? `${skips} excluded-folder skip(s)` : "Excluded folders never read"]
  ].map(([label, value, meta]) => `
    <div class="table-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <em>${escapeHtml(meta)}</em>
    </div>
  `).join("");
}

async function loadOfficeSafety() {
  const fallback = state && state.officeSafety;
  let status = fallback;
  try { status = sentinel.officeSafetyStatus ? (await sentinel.officeSafetyStatus()) || fallback : fallback; } catch { status = fallback; }
  renderOfficeSafety(status && typeof status === "object" && "enabled" in status ? status : fallback);
}

function wireOfficeSafety() {
  bindClick("officeSafetyScan", (button) => runAction(button, async () => {
    setText("officeSafetyResult", "Scanning…");
    const result = sentinel.scanOfficeSafety ? await sentinel.scanOfficeSafety() : { ok: false, status: state?.officeSafety };
    renderOfficeSafety(result?.status || state?.officeSafety);
    setText("officeSafetyResult", result?.ok ? "Scan complete." : result?.copy || result?.error === "office-safety-off" ? "Office Safety Net is off — turn it on first." : "Scan needs review.");
    return result;
  }));
  bindChange("officeSafetyEnabled", (input) => runAction(input, async () => {
    setText("officeSafetyResult", input.checked ? "Enabling…" : "Disabling…");
    const want = input.checked;
    const result = sentinel.setOfficeSafetyEnabled ? await sentinel.setOfficeSafetyEnabled(want) : { ok: false, status: state?.officeSafety };
    const status = result?.status || state?.officeSafety;
    renderOfficeSafety(status);
    const applied = status && status.enabled === want;
    if (!applied) input.checked = !want;
    setText("officeSafetyResult", applied ? (want ? "Protection enabled — backups start with the next scan." : "Protection disabled — nothing is scanned or copied.") : "Could not change Office Safety Net.");
    return result;
  }));
}

const INTEGRATION_STATUS_LABELS = { connected: "Connected", not_configured: "Not connected", error: "Error" };

async function loadIntegrations() {
  const host = qs("#integrationsGrid");
  if (!host) return;
  const data = sentinel.getIntegrations ? await sentinel.getIntegrations().catch(() => null) : null;
  const items = Array.isArray(data && data.items) ? data.items : [];
  if (!items.length) {
    host.innerHTML = `<p class="note">No integrations available.</p>`;
    return;
  }
  const groups = [];
  for (const item of items) {
    let group = groups.find((g) => g.name === item.group);
    if (!group) { group = { name: item.group, cards: [] }; groups.push(group); }
    group.cards.push(item);
  }
  host.innerHTML = groups.map((group) => `
    <section class="integration-group">
      <header class="integration-group-head">
        <h3>${escapeHtml(group.name)}</h3>
        <span class="integration-count">${group.cards.length}</span>
      </header>
      <div class="integrations-grid">
        ${group.cards.map(renderIntegrationCard).join("")}
      </div>
    </section>`).join("");
  qsa("#integrationsGrid [data-goto]").forEach((button) => {
    button.addEventListener("click", () => scrollToAnchor(button.dataset.goto));
  });
  qsa("#integrationsGrid [data-test-for]").forEach((button) => {
    button.addEventListener("click", () => runIntegrationCardTest(button));
  });
}

function renderIntegrationCard(card) {
  const status = INTEGRATION_STATUS_LABELS[card.status] ? card.status : "not_configured";
  const label = INTEGRATION_STATUS_LABELS[status];
  const canTest = card.id === "servicenow" || card.id === "entra"; // only these two have a live read-only probe
  const manage = card.goto ? `<button class="ghost int-link" data-goto="${escapeHtml(card.goto)}">Configure →</button>` : "";
  return `
    <article class="integration-card" data-integration="${escapeHtml(card.id)}">
      <div class="integration-top">
        <span class="integration-icon" aria-hidden="true">${escapeHtml(card.icon || "🔌")}</span>
        <span class="int-badge ${status}">${escapeHtml(label)}</span>
      </div>
      <h4 class="integration-name">${escapeHtml(card.name)}</h4>
      <p class="integration-desc">${escapeHtml(card.description || "")}</p>
      ${card.statusDetail ? `<p class="integration-detail">${escapeHtml(card.statusDetail)}</p>` : ""}
      <div class="integration-actions">
        ${canTest ? `<button class="ghost" data-test-for="${escapeHtml(card.id)}" title="Read-only connection test">Test connection</button>` : ""}
        ${manage}
        <span class="int-result" data-result-for="${escapeHtml(card.id)}" hidden></span>
      </div>
    </article>`;
}

async function runIntegrationCardTest(button) {
  const id = button.dataset.testFor;
  const out = qs(`#integrationsGrid [data-result-for="${cssEscape(id)}"]`);
  const previous = button.textContent;
  button.disabled = true; button.textContent = "Testing…";
  if (out) { out.hidden = false; out.classList.remove("pass", "fail"); out.textContent = "Checking…"; }
  let res;
  try { res = sentinel.testIntegration ? await sentinel.testIntegration(id) : { ok: false, message: "Unavailable" }; }
  catch { res = { ok: false, message: "Connection test failed" }; }
  button.disabled = false; button.textContent = previous;
  const ok = Boolean(res && res.ok);
  const message = (res && res.message) || (ok ? "Connected" : "Not connected");
  if (out) { out.hidden = false; out.textContent = `${ok ? "✓" : "✕"} ${message}`; out.classList.remove("pass", "fail"); out.classList.add(ok ? "pass" : "fail"); }
  const card = qs(`#integrationsGrid [data-integration="${cssEscape(id)}"]`);
  const badge = card && card.querySelector(".int-badge");
  if (badge) {
    const state = ok ? "connected" : (/not connected|not configured/i.test(message) ? "not_configured" : "error");
    badge.classList.remove("connected", "not_configured", "error");
    badge.classList.add(state);
    badge.textContent = INTEGRATION_STATUS_LABELS[state];
  }
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
  // (audit R11) honest about the globe: it moves to the top of your screen when it needs you; Manual mode keeps it click-through.
  { kicker: "Welcome", title: "Meet the globe", body: "A calm gold globe sits on your desktop. It is ARIA Sentinel — resident IT support that keeps watching while you work. When it needs you it moves to the top of your screen; click it, or press Ctrl+Alt+G to bring it forward.", state: "idle" },
  { kicker: "Always on", title: "It watches quietly", body: "ARIA watches for disk, service, network, crash, performance and event-log problems on this device. It stays calm until something needs attention.", state: "diagnosing" },
  { kicker: "Your call", title: "You're in control", body: "Manual mode walks you through fixes in chat. Confirmed asks you once per fix; only Autonomous ever fixes on its own (after telling you three times) — and nothing changes at all until Live fixes are on (Settings → Autonomy).", state: "fixing" },
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

// (audit R8) the coachmark tour never stacks on the wizard: it auto-shows once, only when no wizard is needed or
// open; after the wizard finishes it runs then (once). "Take the 30-second tour" on the Dashboard re-opens it.
function maybeShowOnboarding(next) {
  if (onboardingShown) return;
  if (!next || next.firstRunComplete !== false) return;
  if (next.setupNeeded || setupVisible()) return; // the wizard is the only overlay on screen right now
  startTour({ auto: true });
}
function setupVisible() { const w = qs("#setupWizard"); return Boolean(w && !w.hidden); }
function startTour({ auto = false } = {}) {
  if (auto) onboardingShown = true;
  onboardIndex = 0;
  renderOnboardStep();
  const modal = qs("#onboarding");
  if (modal) { modal.hidden = false; setTimeout(() => qs("#onboardNext")?.focus(), 30); }
}

function wireOnboarding() {
  bindClick("onboardNext", () => advanceOnboarding());
  bindClick("onboardSkip", () => finishOnboarding());
  qs("#onboarding")?.addEventListener("keydown", (e) => { if (e.key === "Escape") finishOnboarding(); });
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
  onboardingShown = true;
  try {
    await sentinel.completeOnboarding?.();
  } catch {
    // Completing onboarding must never throw into the UI.
  }
}

function renderRecipes(recipes) {
  // JULY PORT 2026-10-14 — the list is rendered through the Fix It browser (search + family filter); with no filter
  // every recipe renders exactly as before.
  recipeCatalogCache = Array.isArray(recipes) ? recipes : [];
  populateFixCategoryFilter();
  renderFixBrowser();
}

// ===== JULY PORT 2026-10-14 (c0a0f6b4) — the Fix It browser + Fix History =====
function wireResolutionControls() {
  const search = qs("#fixSearch");
  if (search) {
    search.addEventListener("input", () => {
      fixSearchTerm = String(search.value || "").trim().toLowerCase();
      renderFixBrowser();
    });
  }
  const category = qs("#fixCategory");
  if (category) {
    category.addEventListener("change", () => {
      fixCategoryFilter = category.value || "all";
      renderFixBrowser();
    });
  }
  bindClick("fixHistoryPrev", () => {
    fixHistoryPage = Math.max(1, fixHistoryPage - 1);
    renderFixHistory(state);
  });
  bindClick("fixHistoryNext", () => {
    fixHistoryPage += 1;
    renderFixHistory(state);
  });
}

function normalizeFixCategory(value) {
  return String(value || "other").trim().toLowerCase().replace(/\s+/g, "-");
}

function fixCategoryLabel(value) {
  const raw = String(value || "Other").replace(/[-_]+/g, " ").trim();
  return raw.toUpperCase() === raw ? raw : titleCase(raw);
}

function recipeCategory(recipe) {
  return recipe?.family || String(recipe?.signal || "").split(".")[0] || recipe?.chip || "Other";
}

function tier0Category(recipe) {
  return recipe?.category || recipe?.family || "Tier-0 safe generic";
}

function populateFixCategoryFilter() {
  const select = qs("#fixCategory");
  if (!select) return;
  const previous = fixCategoryFilter || select.value || "all";
  const categories = new Map();
  for (const recipe of recipeCatalogCache) categories.set(normalizeFixCategory(recipeCategory(recipe)), fixCategoryLabel(recipeCategory(recipe)));
  for (const recipe of tier0Cache) categories.set(normalizeFixCategory(tier0Category(recipe)), fixCategoryLabel(tier0Category(recipe)));
  const rows = [...categories.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  select.innerHTML = `<option value="all">All fixes</option>${rows.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("")}`;
  select.value = rows.some(([value]) => value === previous) ? previous : "all";
  fixCategoryFilter = select.value;
}

function fixMatchesSearch(item, category) {
  const categoryKey = normalizeFixCategory(category);
  if (fixCategoryFilter !== "all" && categoryKey !== fixCategoryFilter) return false;
  if (!fixSearchTerm) return true;
  const haystack = [item.id, item.recipeId, item.title, item.summary, item.signal, item.chip, item.family, category].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(fixSearchTerm);
}

function renderFixBrowser() {
  const recipes = (recipeCatalogCache || []).filter((recipe) => fixMatchesSearch(recipe, recipeCategory(recipe)));
  const tier0 = (tier0Cache || []).filter((recipe) => fixMatchesSearch(recipe, tier0Category(recipe)));
  setText("recipeFilterMeta", `${recipes.length}/${(recipeCatalogCache || []).length} shown`);
  setText("tier0FilterMeta", tier0Loaded ? `${tier0.length}/${tier0Cache.length} shown` : "Loads when this tab opens");
  setHtml("recipeList", recipes.length ? recipes.map(interactiveRecipeCardHtml).join("") : `<p class="note fix-empty">${recipeCatalogCache.length ? "No interactive fixes match this search." : "Loading recipes."}</p>`);
  const tier0Host = qs("#tier0List");
  if (tier0Host && tier0Loaded) tier0Host.innerHTML = tier0.length ? tier0.map(tier0RecipeCardHtml).join("") : `<p class="note fix-empty">${tier0Cache.length ? "No safe generic fixes match this search." : "No Tier-0 recipes available."}</p>`;
  bindFixBrowserActions();
}

// The SAME card as before the port (walk · resolve · dry-run), plus the family label for the filter.
function interactiveRecipeCardHtml(recipe) {
  const category = recipeCategory(recipe);
  return `
    <article class="recipe-card" data-fix-family="${escapeHtml(normalizeFixCategory(category))}">
      <div class="fix-card-head"><span class="chip">${escapeHtml(recipe.chip || fixCategoryLabel(category))}</span><em>${escapeHtml(fixCategoryLabel(category))}</em></div>
      <h3>${escapeHtml(recipe.title)}</h3>
      <p>${escapeHtml(recipe.summary)}</p>
      <div class="button-row">
        <button class="ghost" data-walk-recipe="${escapeHtml(recipe.id)}">Walk me through it</button>
        <button class="primary" data-resolve-fix="${escapeHtml(recipe.id)}" data-risk="${escapeHtml(recipe.risk || "medium")}">Resolve it for me</button>
        <button class="ghost" data-recipe-run="${escapeHtml(recipe.id)}">Dry-run</button>
      </div>
      <p class="note resolve-status" data-resolve-status="${escapeHtml(recipe.id)}" hidden></p>
    </article>`;
}

function tier0RecipeCardHtml(recipe) {
  const id = recipe.recipeId || recipe.id || "";
  const category = tier0Category(recipe);
  return `
    <article class="recipe-card tier0-card" data-fix-family="${escapeHtml(normalizeFixCategory(category))}">
      <div class="fix-card-head"><span class="chip">${escapeHtml(recipe.readOnly ? "READ-ONLY" : "SAFE")}</span><em>${escapeHtml(fixCategoryLabel(category))}</em></div>
      <h3>${escapeHtml(recipe.title || id)}</h3>
      <p>${escapeHtml(recipe.summary || "")}</p>
      <div class="button-row">
        <button class="ghost" data-tier0="${escapeHtml(id)}">Dry-run</button>
      </div>
    </article>`;
}

function bindFixBrowserActions() {
  // "Walk me through it" — open the Walk-through tab in GUIDE mode for this recipe (changes nothing).
  qsa("[data-walk-recipe]").forEach((button) => button.addEventListener("click", () => {
    activateTab("walkthrough"); renderWalkthrough({ recipeId: button.dataset.walkRecipe, mode: "guide" });
  }));

  // (audit R17) Dry-run gives visible feedback in the card's status line — never a silent click.
  qsa("[data-recipe-run]").forEach((button) => {
    button.addEventListener("click", () => runAction(button, async () => {
      const id = button.dataset.recipeRun;
      const statusEl = qs(`[data-resolve-status="${cssEscape(id)}"]`) || button.closest(".recipe-card")?.querySelector(".resolve-status");
      if (statusEl) { statusEl.hidden = false; statusEl.textContent = "Previewing…"; }
      let r = null;
      try { r = id === "sentinel-self-repair-v1" ? await sentinel.selfRepair("recipe-list") : await sentinel.runRecipe(id, { dryRun: true }); } catch { r = null; }
      if (statusEl) { statusEl.textContent = describeDryRun(r); statusEl.dataset.outcome = r && r.ok !== false ? "preview" : "failed"; }
      return r;
    }));
  });
  // Tier-0 dry-run preview (the same toast as before the port).
  qsa("[data-tier0]").forEach((btn) => btn.addEventListener("click", () => runAction(btn, async () => {
    const r = await sentinel.previewTier0?.(btn.dataset.tier0);
    showToast({ title: `${r?.title || "Dry-run"}`, body: `${r?.summary || ""}${r?.requiresReboot ? " (needs reboot)" : ""}` });
    return r;
  })));
  // RUN 36 / TASK 3 — "Resolve it for me": run the matched fix LOCALLY through the gated control plane
  // (R11 → supervisor → execution policy → 10s countdown → kill-switch). Confirmed-grade gating; never
  // autonomous. The countdown indicator is the visible confirm/cancel; Ctrl+Alt+K aborts mid-fix.
  qsa("[data-resolve-fix]").forEach((button) => bindResolveFix(button));
}

function parseHistoryTime(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function isResolutionLogEntry(entry = {}) {
  const tag = String(entry.tag || "").toUpperCase();
  const text = String(entry.text || "");
  const directTags = new Set(["DETECT", "RUN", "FIX", "DONE", "ERROR", "REVIEW", "ESCALATE", "SUPERVISOR", "SECURITY", "KILL-SWITCH", "CANCEL", "RESTORE PT", "SELF-ERROR", "AUTONOMOUS", "AUTONOMY", "POLICY", "WATCH", "GUIDE"]);
  return directTags.has(tag) || /\b(fix|recipe|diagnos|detect|repair|guard|resolution|verify|incident|supervisor)\b/i.test(text);
}

function historyTimeLabel(ms) {
  if (!ms) return "Unknown time";
  try { return new Date(ms).toLocaleString(); } catch { return "Unknown time"; }
}

function buildFixHistory(next = state, now = Date.now()) {
  const cutoff = now - FIX_HISTORY_DAYS * 24 * 60 * 60 * 1000;
  const rows = [];
  for (const detection of next?.detections || []) {
    const ms = parseHistoryTime(detection.ts);
    if (!ms || ms < cutoff) continue;
    rows.push({
      ts: detection.ts,
      sort: ms,
      kind: "DETECTED",
      title: detection.title || detection.signal || "Issue detected",
      detail: `${detection.signal || detection.chip || "Local signal"} - ${detection.source || "desktop"} - ${detection.mode || "manual"}`,
      recipeId: detection.recipeId || "",
      tone: detection.risk === "red" || detection.risk === "orange" ? "red" : detection.risk === "yellow" ? "amber" : "green",
      source: "Detection"
    });
  }
  for (const entry of next?.transparencyLog || []) {
    const ms = parseHistoryTime(entry.ts);
    if (!ms || ms < cutoff || !isResolutionLogEntry(entry)) continue;
    const tag = String(entry.tag || "LOG").toUpperCase();
    rows.push({
      ts: entry.ts,
      sort: ms,
      kind: tag,
      title: fixHistoryTitle(entry),
      detail: entry.text || "",
      recipeId: entry.recipeId || "",
      tone: tag.includes("ERROR") || tag.includes("SECURITY") || tag.includes("KILL") ? "red" : tag.includes("REVIEW") || tag.includes("ESCALATE") || tag.includes("CANCEL") || tag.includes("POLICY") ? "amber" : "green",
      source: "Audit"
    });
  }
  return rows
    .sort((a, b) => b.sort - a.sort)
    .slice(0, FIX_HISTORY_MAX);
}

function fixHistoryTitle(entry = {}) {
  const text = String(entry.text || "").trim();
  if (!text) return String(entry.tag || "Resolution event");
  return text.length > 86 ? `${text.slice(0, 83).trim()}...` : text;
}

function renderFixHistory(next = state) {
  const host = qs("#fixHistoryList");
  if (!host) return;
  const rows = buildFixHistory(next);
  const totalPages = Math.max(1, Math.min(5, Math.ceil(rows.length / FIX_HISTORY_PAGE_SIZE)));
  fixHistoryPage = Math.min(Math.max(1, fixHistoryPage), totalPages);
  const start = (fixHistoryPage - 1) * FIX_HISTORY_PAGE_SIZE;
  const pageRows = rows.slice(start, start + FIX_HISTORY_PAGE_SIZE);
  setText("fixHistorySummary", rows.length ? `${rows.length} event${rows.length === 1 ? "" : "s"}` : "No events yet");
  setText("fixHistoryPage", `Page ${fixHistoryPage} of ${totalPages}`);
  const prev = qs("#fixHistoryPrev");
  const nextBtn = qs("#fixHistoryNext");
  if (prev) prev.disabled = fixHistoryPage <= 1;
  if (nextBtn) nextBtn.disabled = fixHistoryPage >= totalPages;
  host.innerHTML = pageRows.length
    ? pageRows.map(fixHistoryCardHtml).join("")
    : `<p class="note fix-empty">No troubleshooting history in the last ${FIX_HISTORY_DAYS} days. When ARIA detects, previews or applies something on this device, it is listed here with its real outcome.</p>`;
}

function fixHistoryCardHtml(item) {
  const recipe = item.recipeId ? `<code>${escapeHtml(item.recipeId)}</code>` : `<code>${escapeHtml(item.source)}</code>`;
  return `
    <article class="fix-history-card ${escapeHtml(item.tone || "")}">
      <div class="fix-history-when"><strong>${escapeHtml(relativeTime(item.ts))}</strong><span>${escapeHtml(historyTimeLabel(item.sort))}</span></div>
      <div class="fix-history-body">
        <div class="fix-history-head"><span class="chip">${escapeHtml(item.kind)}</span>${recipe}</div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.detail || "Resolution event recorded.")}</p>
      </div>
    </article>`;
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
  // (audit R17) a palette dry-run reports what it previewed — never a silent action.
  else if (cmd.type === "recipe") Promise.resolve(sentinel.runRecipe?.(cmd.recipeId, { dryRun: true })).then((r) => showToast({ title: `Preview: ${recipeTitleOf(cmd.recipeId)}`, body: describeDryRun(r) })).catch(() => showToast({ title: "Preview failed", body: "Couldn't run the preview just now. Nothing was changed.", danger: true }));
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
  // Start/Stop reflect run state — (audit R9) one source: renderRunState() (stopped / paused / killed re-arm Start).
  renderRunState(state);
  // Hotkey rows — (audit R6) every row comes from state.hotkeys (real combo + live status); nothing is static.
  const hk = qs("#hotkeyStatus");
  if (hk && Array.isArray(state.hotkeys)) {
    const combo = (c) => String(c || "").replace(/CommandOrControl/g, "Ctrl").replace(/\+/g, " + ");
    const badge = (h) => h.status === "active" ? `<em class="active-badge">${h.usedFallback ? "Active (fallback combo)" : "Active"}</em>` : h.status === "disabled" ? `<em class="off-badge">Off</em>` : `<em class="fail-badge">Failed — another app holds it</em>`;
    setHtml("hotkeyStatus", state.hotkeys.length ? state.hotkeys.map((h) =>
      `<div class="table-row${h.action === "kill-aria" || h.id === "kill" ? " kill-row" : ""}"><span>${escapeHtml(combo(h.combo))}</span><strong>${escapeHtml(h.label || h.id)}</strong>${badge(h)}<button class="ghost" data-rebind="${escapeHtml(h.id)}">Rebind</button></div>`
    ).join("") : `<div class="table-row"><span>—</span><strong>No shortcuts are registered on this device.</strong><em class="off-badge">Off</em></div>`);
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
// D3 (2026-07-03) — honest update toast: an update, a real "up to date" (a feed answered), or manual-update
// mode when no OTA feed is reachable (never a false "you're on the latest version" that we can't actually verify).
function updateToast(r) {
  if (r?.updateAvailable) return { title: "Update available", body: r?.event?.version ? `v${r.event.version} is ready to install.` : "A newer version is ready." };
  if (r?.manifest) return { title: "Up to date", body: "You're on the latest version." };
  return { title: "Manual updates", body: `You're on ${r?.current || "this version"} · manual updates for now.` };
}
function renderUpdates(state) {
  const u = state && state.updates;
  if (!u) return;
  const tog = qs("#autoUpdateToggle");
  if (tog) tog.checked = u.autoUpdate !== false;
  // (audit R19) honest update mode: "manual in this version" unless main reports a live OTA channel.
  const ota = u.mode === "ota" || u.channel === "ota";
  setText("updateStatusLine", `Current version ${u.current || state.version || "—"}. ${ota ? (u.autoUpdate === false ? "Auto-update is off." : "Updates install automatically.") : "Updates are manual in this version — use \"Get latest from website\"."}`);
  setText("planModalUpdates", ota ? "Updates: automatic (OTA channel live)" : "Updates: manual in this version");
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
  // Trial-end plan picker — each "Subscribe" CTA opens the tier's checkout. PROD 2026-10-14 (audit R4/R5): main resolves
  // the URL (a customer machine has no Stripe env, so it lands on the live /plans/?from=app&tier=… page) and the
  // billing period chosen in the modal travels with the request; the prices on the cards come from pricing-tiers.mjs.
  qsa(".plan-subscribe").forEach((btn) => btn.addEventListener("click", () => sentinel.choosePlan?.(btn.getAttribute("data-plan"), { billing: planModalBilling })));
  qsa("[data-plan-billing]").forEach((btn) => btn.addEventListener("click", () => { planModalBilling = btn.dataset.planBilling === "yearly" ? "yearly" : "monthly"; qsa("[data-plan-billing]").forEach((b) => b.classList.toggle("active", b === btn)); renderPlanModalPrices(); }));
  renderPlanModalPrices();
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

// PROD 2026-10-14 (audit R5) — the plan modal's prices are rendered from pricing-tiers.mjs: monthly tiers "/mo",
// annual tiers "/mo · billed annually ($X/yr)", and the Yearly tab shows real yearly totals. One source, no literal.
let planModalBilling = "monthly";
function renderPlanModalPrices() {
  qsa("#planModal .plan-card").forEach((card) => {
    const plan = card.dataset.tier;
    if (!TIERS[plan]) return;
    const pl = priceLine(plan, planModalBilling);
    const priceEl = card.querySelector(".plan-price");
    if (priceEl) priceEl.innerHTML = `${escapeHtml(pl.amount)}<em>${escapeHtml(pl.unit)}</em>`;
    let note = card.querySelector(".plan-note");
    if (!note) { note = document.createElement("small"); note.className = "plan-note"; priceEl?.insertAdjacentElement("afterend", note); }
    const visits = visitsLabel(plan);
    note.textContent = [pl.note, visits].filter(Boolean).join(" · ");
  });
  setText("planSupportNote", SEPARATE_HUMAN_SUPPORT_NOTE);
}

// Open the plan modal with honest framing: "Trial ended" only when it really ended; otherwise "Plans".
function openPlanModal() {
  const gate = (state && state.gate) || {};
  const st = trialState(gate);
  setText("planModalKicker", st === "expired" ? "Trial ended" : "Plans");
  setText("planModalTitle", st === "expired" ? "Your ARIA trial has ended" : "Choose an ARIA Sentinel plan");
  setText("planModalSub", st === "expired" ? "Choose your tier to keep every feature running on this machine. Manual mode and ARIA chat keep working either way." : st === "active" ? `Every Pro feature is unlocked during your ${trialDays(gate)}-day trial. Subscribe now to keep it that way.` : "Choose the tier that fits — your key unlocks the matching features on this machine.");
  renderPlanModalPrices();
  const pm = qs("#planModal");
  if (pm) { pm.hidden = false; planModalShown = true; setTimeout(() => qs("#planModal .plan-subscribe")?.focus(), 30); }
  else sentinel.openPlanPicker?.();
}

function renderGate(state) {
  const gate = state && state.gate;
  if (!gate) return;
  // (audit R3/R13/R20) every trial sentence comes from trial-copy.mjs, fed by main's real end date — never "undefined".
  const badge = qs("#trialBadge");
  if (badge) { badge.hidden = false; badge.textContent = trialBadgeText(gate); }
  setText("accountStatus", accountStatusLine(gate));
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

// Honest locked-tab overlay (audit R3/R20): the real reason, the real days line, what still works, and the buy path.
// "Keep using your Walk-Through" shows ONLY when the entitlement is real (never a locked tab offered as consolation).
function showLockedTabOverlay() {
  const gate = (state && state.gate) || {};
  const copy = lockedTabCopy(gate);
  setText("lockedTabKicker", trialState(gate) === "expired" ? "Trial ended" : "Paid feature");
  setText("lockedTabMessage", copy.message);
  const info = qs("#lockedTabTrialInfo");
  if (info) { info.textContent = copy.trialInfo; info.hidden = !copy.trialInfo; }
  const keep = qs("#lockedTabKeepWalkthrough");
  if (keep) keep.hidden = !copy.showWalkthroughButton;
  const m = qs("#lockedTabOverlay");
  if (m) { m.hidden = false; setTimeout(() => qs("#lockedTabChoosePlan")?.focus(), 30); }
}
function closeLockedTabOverlay() { const m = qs("#lockedTabOverlay"); if (m) m.hidden = true; }
function wireLockedTabOverlay() {
  bindClick("lockedTabClose", () => closeLockedTabOverlay());
  bindClick("lockedTabKeepWalkthrough", () => { closeLockedTabOverlay(); activateTab(WALKTHROUGH_TAB); });
  // "Choose a plan" opens the existing plan picker (the buy path) — never blocked.
  bindClick("lockedTabChoosePlan", () => { closeLockedTabOverlay(); openPlanModal(); });
  qs("#lockedTabOverlay")?.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLockedTabOverlay(); });
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
  // (audit R13) the trial status line is rendered from the gate main returns — never "undefined days left".
  bindClick("startTrial", (button) => runAction(button, async () => {
    const email = qs("#trialEmail")?.value?.trim() || "";
    const result = await sentinel.startTrial?.(email);
    const gate = (result && result.status) || (state && state.gate) || {};
    if (result && result.ok) {
      setText("licenseStatus", licenseStatusLine(state && state.license, gate));
      showToast(result.started ? { title: "Trial started", body: licenseStatusLine(state && state.license, gate) } : { title: "Trial already running", body: licenseStatusLine(state && state.license, gate) });
    } else setText("licenseStatus", "Couldn't start the trial just now — the desktop bridge did not answer.");
    return result;
  }));
  bindClick("checkUpdates", (button) => runAction(button, async () => {
    const r = await sentinel.checkUpdates?.();
    // D3 — honest, non-alarming state. No OTA manifest wired → "manual updates for now" (not a dead "unavailable").
    const cur = r?.current || "this version";
    setText("updateStatus",
      r?.updateAvailable && r.latest ? `Update available: ${r.latest.version}`
      : (!r?.ok || r?.mode === "manual") ? `You're on ${cur} · manual updates for now`
      : `Up to date (${cur}).`);
    return r;
  }));
  bindClick("manageSubscription", (button) => runAction(button, () => sentinel.manageSubscription?.()));
}
function renderLicense(next) {
  const lic = next && next.license;
  const gate = (next && next.gate) || {};
  if (!lic && !next?.gate) return;
  // (audit R3/R13) ONE sentence from trial-copy.mjs: licensed → "Licensed · plan"; active → real days left + end date;
  // expired → what ended, what still works, how to buy; never started → the offer with the real day count.
  setText("licenseStatus", licenseStatusLine(lic || {}, gate));
  const st = trialState(gate);
  // The trial is write-once (it starts at first launch): the Start button shows only when no trial exists yet.
  const startBtn = qs("#startTrial");
  if (startBtn) { startBtn.hidden = st !== "not-started"; startBtn.textContent = `Start ${trialDays(gate)}-day trial`; }
  const emailField = qs("#trialEmailField");
  if (emailField) emailField.hidden = st !== "not-started";
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

// (audit R3) no local trial constant: the trial's length arrives in gate.trial (durationMs / days) from main.
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
  // Kill-switch (Ctrl+Alt+K) confirmation pushed from main: dim the globe, reflect the run state, toast main's OWN
  // sentence (audit R9) — never a default "last action undone" for an undo that did not run.
  sentinel.onKillSwitch?.((info) => {
    markKilledLocally();
    showToast(killSwitchToast(info || {}));
  });
  // A user Start re-arms the globe + the run state.
  qs("#startAria")?.addEventListener("click", () => { killDimmed = false; killedLocally = false; setGlobeState("active"); renderRunState(state || {}); });
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
  // (audit R3) the fraction uses the gate's OWN duration (trial-copy.mjs), never a local constant.
  const gate = next && next.gate;
  if (!trialNudgeShown && gate && !gate.licensed && gate.trial?.state === "active") {
    const frac = trialFractionLeft(gate);
    if (frac != null && frac > 0 && frac < 0.30) {
      trialNudgeShown = true;
      showToast({
        title: "Trial ending soon",
        body: `${trialBadgeText(gate)} — choose a tier to keep every feature running.`,
        cta: "See plans",
        ctaAction: () => openPlanModal()
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
  if (search) search.addEventListener("input", () => {
    // Density: the app inventory is collapsed by default — typing a search auto-expands it so results are visible.
    const acc = qs("#system-apps");
    if (acc && search.value.trim()) acc.open = true;
    renderSystemContextApps(search.value.trim().toLowerCase());
  });
}

async function loadSystemContext() {
  if (systemContextLoaded && lastSystemContext) return;
  try {
    const ctx = await sentinel.getSystemContext?.();
    systemContextLoaded = true;
    renderSystemContext(ctx);
  } catch (e) { reportRendererError(e, "system-context"); }
}

// F4 (2026-07-02) — real disk usage like RAM. Computes % used from whatever the inventory reports (percent, or
// size+free under common CIM field names); honest fallback (never a bare "Disk" with no value).
function diskPercentUsed(disk = {}) {
  if (disk.percentUsed != null) return Math.round(Number(disk.percentUsed));
  const size = Number(disk.sizeGb ?? disk.size ?? disk.totalGb ?? disk.total);
  const free = Number(disk.freeGb ?? disk.freeSpace ?? disk.free);
  if (Number.isFinite(size) && size > 0 && Number.isFinite(free)) return Math.round((1 - free / size) * 100);
  return null;
}
function diskUsageLabel(disk = {}) {
  const pct = diskPercentUsed(disk);
  if (pct != null) {
    // D6 — real usage like RAM, plus free GB when we have the system-volume size/free (value-first).
    const size = Number(disk.sizeGb ?? disk.size ?? disk.totalGb ?? disk.total);
    const free = Number(disk.freeGb ?? disk.freeSpace ?? disk.free);
    const gb = (n) => n > 1e6 ? Math.round(n / 1e9) : Math.round(n); // bytes → GB (already-GB values pass through)
    const freeStr = Number.isFinite(size) && Number.isFinite(free) ? ` · ${gb(free)} GB free of ${gb(size)}` : "";
    return `${pct}% used${freeStr}`;
  }
  if (disk && disk.model) return `${disk.model}${disk.status ? " · " + disk.status : ""}`;
  return "usage not reported";
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
    { id: "disk", message: diskUsageLabel(disk), ok: (diskPercentUsed(disk) ?? 0) < 90 }
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
  // JULY PORT 2026-10-14 — the Tier-0 list is loaded once into the Fix It browser cache and rendered through the same
  // search/family filter as the interactive fixes (the card + dry-run toast are unchanged).
  if (tier0Loaded) { renderFixBrowser(); return; }
  try {
    const list = await sentinel.listTier0?.();
    tier0Loaded = true;
    tier0Cache = Array.isArray(list) ? list : [];
    populateFixCategoryFilter();
    renderFixBrowser();
  } catch (e) { reportRendererError(e, "tier-0"); }
}

// ===== RUN 21 — auto-update orchestrator · startup security · heartbeat (renderer) =====

function wireRun21() {
  bindClick("checkUpdateChannel", (b) => runAction(b, async () => {
    const r = await sentinel.checkUpdateChannel?.();
    await loadUpdatesPanel();
    // D3 — honest: only claim "up to date" if a feed actually answered; otherwise say manual-update mode.
    showToast(updateToast(r));
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
  bindClick("dashCheckUpdates", (b) => runAction(b, async () => { const r = await sentinel.checkUpdateChannel?.(); showToast(updateToast(r)); return r; })); // D3 — honest toast
  // (audit R18) the Dashboard export gives feedback — a result line + toast — never a silent click.
  bindClick("dashExportEvidence", (b) => runAction(b, async () => {
    const st = qs("#dashQuickStatus"); if (st) { st.hidden = false; st.textContent = "Building the evidence pack…"; }
    const r = await sentinel.exportEvidence?.();
    const msg = r?.ok ? `Evidence pack saved → ${r.path}` : "Export unavailable in this build.";
    if (st) st.textContent = msg;
    showToast({ title: r?.ok ? "Evidence pack saved" : "Export unavailable", body: msg, danger: !r?.ok });
    return r;
  }));
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
    // (audit R9) the hero word reflects the run state too: STOPPED / PAUSED are never "PROTECTED".
    lastDashboardSources = d.sources || {};
    lastSubline = d.subline || {};
    renderHero(currentRunState(state));
    setHtml("kpiTiles", DashboardTab.tilesHtml(heroTiles(d.metrics || {})));
    // (audit R24) a pending card deep-links only to a tab/anchor that exists; the rest fall back to Settings → About.
    const pending = (d.pending || []).map((p) => ({ ...p, tab: p && (TAB_TITLES[p.tab] || TAB_REDIRECTS[p.tab]) ? p.tab : "about" }));
    lastPendingCards = pending;
    const pPanel = qs("#pendingActionsPanel"); if (pPanel) pPanel.hidden = pending.length === 0;
    setHtml("pendingActions", DashboardTab.pendingHtml(pending));
    setHtml("recentActivity", DashboardTab.activityHtml((d.activity || []).map(DashboardTab.eventToActivity)));
    if (d.trust) setText("trustStrip", d.trust);
    wireDeepLinks("recentActivity"); wireDeepLinks("pendingActions");
    renderHomeLists(state); // the "need from you" block carries the same pending cards
    // (§4.2) a process-health snapshot gives a real "last check" age when the watcher block is not in state yet.
    try { const ph = await sentinel.getProcessHealth?.(); const t = Date.parse(ph && (ph.timestamp || ph.ts) || ""); if (Number.isFinite(t)) { lastProcessHealthAt = t; renderRunState(state); } } catch { /* optional */ }
  } catch (e) { reportRendererError(e, "dashboard"); }
}

// Density redesign (2026-07-02) — render SLA + KPIs as LIVE horizontal-bar charts (not raw number grids).
// REAL-OR-EMPTY: a row is drawn only for a finite value; with no real values yet the host shows a clean
// empty state ("appears after ARIA's first real fix"), never a fabricated bar. `rows`: [{label,value,max,unit}].
function renderBarChart(hostId, rows, { empty } = {}) {
  const host = qs(`#${hostId}`);
  if (!host) return;
  const real = (rows || []).filter((r) => Number.isFinite(Number(r.value)));
  if (!real.length) {
    host.innerHTML = `<p class="chart-empty">${escapeHtml(empty || "No data yet — this chart appears after ARIA's first real fix.")}</p>`;
    return;
  }
  // Shared 0→max axis so bars are visually comparable, with light gridlines + tick labels (clean axis, Rule 17).
  const unit = real.find((r) => r.unit)?.unit || "";
  const axisMax = real.reduce((m, r) => Math.max(m, Number.isFinite(Number(r.max)) && Number(r.max) > 0 ? Number(r.max) : 100), 0) || 100;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(axisMax * f));
  const grid = `<span class="chart-bar-grid" aria-hidden="true">${ticks.map(() => "<i></i>").join("")}</span>`;
  const bars = real.map((r) => {
    const max = Number.isFinite(Number(r.max)) && Number(r.max) > 0 ? Number(r.max) : axisMax;
    const pct = Math.max(0, Math.min(100, (Number(r.value) / max) * 100));
    return `<div class="chart-bar-row"><span class="cb-label">${escapeHtml(r.label)}</span>` +
      `<span class="chart-bar-track">${grid}<span class="chart-bar-fill" style="width:${pct.toFixed(1)}%"></span></span>` +
      `<span class="cb-val">${escapeHtml(r.value)}${escapeHtml(r.unit || "")}</span></div>`;
  }).join("");
  const axis = `<div class="chart-axis" aria-hidden="true"><span class="cb-label"></span>` +
    `<span class="chart-axis-ticks">${ticks.map((t) => `<span>${t}${escapeHtml(unit)}</span>`).join("")}</span>` +
    `<span class="cb-val"></span></div>`;
  host.innerHTML = `<div class="chart-bars">${bars}${axis}</div>`;
}

async function loadPerformance() {
  try {
    const p = (await sentinel.getPerformance?.()) || {};
    const op = p.operational || {}, ai = p.ai || {};
    // Live chart (default view): the rate KPIs on a shared 0–100 scale. Real-or-empty.
    renderBarChart("perfChart", [
      { label: "First-touch", value: op.ftr, max: 100, unit: "%" },
      { label: "Auto-resolved", value: op.autoPct, max: 100, unit: "%" },
      { label: "Recipe success", value: op.recipeSuccess, max: 100, unit: "%" },
      { label: "Diagnosis acc.", value: ai.accuracy, max: 100, unit: "%" },
      { label: "KB hit rate", value: ai.kbHitRate, max: 100, unit: "%" }
    ], { empty: "Operational KPIs appear here as a live chart after ARIA's first real fixes." });
    // Full number grids stay available (collapsed under "See the numbers") — Rule 15.
    setHtml("perfOperational", PerformanceTab.operationalTilesHtml(op));
    setHtml("perfAI", PerformanceTab.aiTilesHtml(ai));
    setHtml("perfUsage", PerformanceTab.usageHtml(p.usage || {}));
  } catch (e) { reportRendererError(e, "performance"); }
}

async function loadSla() {
  try {
    const s = (await sentinel.getSla?.()) || {};
    // (audit R6) main sends measured:false + nulls until something was really recorded → "SLA not measured yet".
    setText("slaComposite", SlaTab.compositeHeadline(s.compliance || {}, s));
    setText("slaComplianceNote", SlaTab.complianceLine(s.compliance || {}, s));
    // Live chart (default view): uptime across windows on a 0–100 scale. Real-or-empty.
    const u = s.uptime || {};
    renderBarChart("slaChart", [
      { label: "Uptime 24h", value: u.h24, max: 100, unit: "%" },
      { label: "Uptime 7d", value: u.d7, max: 100, unit: "%" },
      { label: "Uptime 30d", value: u.d30, max: 100, unit: "%" },
      { label: "Uptime 90d", value: u.d90, max: 100, unit: "%" }
    ], { empty: "Uptime trend appears here as a live chart once ARIA has run long enough to measure it." });
    // Full number grids + severity rows stay available (collapsed) — Rule 15.
    setHtml("slaUptime", SlaTab.uptimeTilesHtml(u));
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
    // (audit R7) excluded folders by COUNT from the person's own settings — never a folder name.
    setHtml("compR11", ComplianceTab.r11RowsHtml(c.r11 || {}, state && state.excludedFolders));
    // (audit M9) endpoints: ok:null = "not available in this version" (grey), never a red failure.
    setHtml("compEndpoints", ComplianceTab.endpointRowsHtml((state && state.endpointStatus) || []));
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

// Recommended upgrade target + copy per locked feature. Plans AND prices come from pricing-tiers.mjs (audit R5) —
// never a literal dollar figure in this file.
const PRO_PRICE = monthlyDisplay("pro");
const PRO_RECIPES = TIERS.pro.features.recipesCount;
const PERSONAL_RECIPES = TIERS.personal.features.recipesCount;
const UPSELL = {
  manual: { plan: "personal", title: "Manual mode is always yours", body: "Manual mode is the free floor: ARIA watches, chats and guides. Nothing to buy for this." },
  confirmed: { plan: "pro", title: "Confirmed mode is a Pro feature", body: `Confirmed mode pops a fix-card and applies once you approve — upgrade to Pro (${PRO_PRICE}) to enable it.` },
  autonomous: { plan: "pro", title: "Autonomous mode is a Pro feature", body: `Autonomous auto-applies low-risk fixes and tells you after — upgrade to Pro (${PRO_PRICE}) to enable it.` },
  recipes: { plan: "pro", title: "The full recipe library is on Pro", body: `Personal includes ${PERSONAL_RECIPES} safe-generic fixes. Pro (${PRO_PRICE}) unlocks the complete ${PRO_RECIPES}-recipe library.` },
  quarterlyPdf: { plan: "pro", title: "Quarterly PDF reports are on Pro", body: `Self-serve quarterly PDF reports are available on Pro (${PRO_PRICE}) and up.` },
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

  // 1 — Mode tiles: lock any mode this plan doesn't include. (audit R3/R20) Manual is the free floor the app
  // already runs in (detect · chat · guided preview) — it is NEVER shown locked, so an expired trial can still
  // click it and the lock copy never contradicts the Mode panel.
  qsa(".mode-row").forEach((row) => {
    const allowed = row.dataset.mode === "manual" || modes.includes(row.dataset.mode);
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

// Locked mode-tile click / upsell-button click → the buy path (main opens the live plans page for the tier).
function showUpgradeUpsell(modeOrKey) {
  const u = UPSELL[modeOrKey] || UPSELL.confirmed;
  showToast({ title: u.title, body: u.body, cta: modeOrKey === "manual" ? "OK" : "Upgrade", ctaAction: () => { if (modeOrKey !== "manual") sentinel.choosePlan?.(u.plan); } });
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

// JULY PORT 2026-10-14 (cd518cea) — readable KB answers. The July line shaped a raw KB blob into a guided card
// (kicker · article title · the question · up to 5 "safest first checks" · the gate note · a "Show KB detail"
// drawer). The current line already leads with the P7 concise lead + "More help" drawer, so the card is a FRAME
// around that content: the extracted steps render only when the lead carries no list of its own (a raw blob),
// never as a duplicate of steps the lead already shows. Pure string shaping; nothing here touches the device.
function cleanAriaAnswerLine(line) {
  return String(line || "")
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shortenAriaAnswerLine(line, max = 168) {
  const clean = cleanAriaAnswerLine(line);
  return clean.length > max ? `${clean.slice(0, max - 3).trim()}...` : clean;
}

function shapeReadableAriaAnswer(rawText, res, question) {
  const kb = res && res.kbMatch;
  if (!kb || res?.action !== "kb-match") return null;
  const sourceText = String(rawText || "")
    .replace(/^\s*(?:->|→)?\s*Full article:.*$/gim, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, (_m, label) => label) // markdown links → their label (no "$n" literal: pricing-surface-sync)
    .trim();
  const lines = sourceText
    .split(/\r?\n+/)
    .map(cleanAriaAnswerLine)
    .filter((line) => line && line.length > 12 && !/^full article/i.test(line));
  const actionable = [];
  const fallback = [];
  const seen = new Set();
  for (const line of lines) {
    const compact = shortenAriaAnswerLine(line);
    const key = compact.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (/\b(check|open|restart|reset|clear|verify|try|select|choose|update|reconnect|repair|save|backup|restore|escalate|ask|confirm|run)\b/i.test(compact)) {
      actionable.push(compact);
    } else {
      fallback.push(compact);
    }
    if (actionable.length >= 5) break;
  }
  const steps = (actionable.length >= 2 ? actionable : actionable.concat(fallback)).slice(0, 5);
  return {
    title: kb.title || kb.slug || "ARIA knowledge-base match",
    lead: "ARIA matched this to the knowledge base. Start with the safest checks below, then use Resolve it for me only if you want Sentinel to open the gated local fix path.",
    question: shortenAriaAnswerLine(question || "", 120),
    steps: steps.length ? steps : [
      "Confirm the visible symptom and affected app or device.",
      "Try the lowest-risk check first before changing settings.",
      "Escalate if the issue involves security, identity, file loss, or policy authority."
    ],
    detail: sourceText.length > 1100 ? `${sourceText.slice(0, 1100).trim()}...` : sourceText
  };
}

// Builds the card frame. `contentNodes` (the P7 lead + "More help" drawer) go inside it; `showSteps` adds the
// extracted "safest first checks" list only when the lead has no list of its own.
function renderReadableAriaAnswer(model, { contentNodes = [], showSteps = true } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "aria-answer-card";
  const questionHtml = model.question ? `<p class="aria-answer-question">${escapeHtml(model.question)}</p>` : "";
  const stepsHtml = showSteps ? `<ol class="aria-answer-steps">${model.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>` : "";
  wrap.innerHTML = `<p class="aria-answer-kicker">Knowledge-base match</p><h3 class="aria-answer-title">${escapeHtml(model.title)}</h3>${questionHtml}<p class="aria-answer-lead">${escapeHtml(model.lead)}</p>${stepsHtml}`;
  const body = document.createElement("div"); body.className = "aria-answer-body";
  for (const node of contentNodes) if (node) body.appendChild(node);
  wrap.appendChild(body);
  const note = document.createElement("p"); note.className = "aria-answer-note";
  note.textContent = "Sentinel never applies a fix from chat without the normal approval gates, rollback notes, and kill-switch.";
  wrap.appendChild(note);
  if (model.detail) {
    const details = document.createElement("details");
    details.className = "aria-answer-details";
    details.innerHTML = `<summary>Show KB detail</summary><div class="aria-answer-detail-md">${renderMarkdown(model.detail)}</div>`;
    wrap.appendChild(details);
  }
  return wrap;
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
  // JULY PORT 2026-10-14 (69058206) — the desktop chat mirrors the iisupp.net/aria entry flow: the web welcome copy
  // + the quick-issue chips. A chip only fills the composer and submits through the SAME pipeline as typing.
  setText("ariaWebWelcomeTitle", ARIA_WEB_WELCOME.title);
  setText("ariaWebWelcomeBody", ARIA_WEB_WELCOME.body);
  function submitAriaQuestion(text) {
    const value = String(text || "").trim();
    if (!value || input.disabled) return;
    input.value = value;
    input.style.height = "auto";
    input.style.height = Math.min(140, input.scrollHeight) + "px";
    input.focus();
    form.requestSubmit();
  }
  function renderAriaWebQuickActions() {
    const host = qs("#ariaWebQuickActions");
    if (!host || host.dataset.ready === "1") return;
    host.innerHTML = ARIA_WEB_QUICK_ACTIONS.map((item) => `<button class="aria-web-chip" type="button" data-aria-web-ask="${escapeHtml(item.ask)}">${escapeHtml(item.label)}</button>`).join("");
    qsa("[data-aria-web-ask]", host).forEach((button) => {
      button.addEventListener("click", () => submitAriaQuestion(button.getAttribute("data-aria-web-ask") || ""));
    });
    host.dataset.ready = "1";
  }
  renderAriaWebQuickActions();
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
    // F2 — repairTruncatedTail is a no-op on complete answers; it only trims a dangling fragment if an upstream
    // path (e.g. offline/local-kb) ever handed us a mid-line-cut excerpt. Main already swaps in full text for KB.
    // P7 — lead with the plain-language explanation + fix steps; tuck verify/escalate/prevent behind a toggle.
    const full = repairTruncatedTail(stripFm((res && res.text) || "I couldn't get an answer just now — please try again."));
    const { lead, more } = splitShapedAnswer(full);
    answer.innerHTML = renderMarkdown(lead || full);
    bubble.textContent = "";
    let moreDrawer = null;
    if (more) {
      const det = document.createElement("details"); det.className = "aria-chat-more";
      const sum = document.createElement("summary"); sum.textContent = "More help — verify, escalate, prevent";
      const body2 = document.createElement("div"); body2.className = "aria-chat-md"; body2.innerHTML = renderMarkdown(more);
      det.append(sum, body2); moreDrawer = det;
    }
    // JULY PORT 2026-10-14 — a KB match renders inside the readable answer card (frame around the P7 lead + drawer);
    // the extracted "safest first checks" appear only when the lead has no list of its own. Anything else is unchanged.
    const readable = shapeReadableAriaAnswer(full, res, question);
    if (readable) { bubble.appendChild(renderReadableAriaAnswer(readable, { contentNodes: [answer, moreDrawer], showSteps: !/<li>/i.test(answer.innerHTML) })); }
    else { bubble.appendChild(answer); if (moreDrawer) bubble.appendChild(moreDrawer); }
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
    if (meta && Number.isFinite(Number(meta.total_chunks))) { const c = qs("#ariaChatChunks"); if (c) c.textContent = `KB size: ${Number(meta.total_chunks)} passages`; } // (audit R6) real count only after a real answer
    // TASK 4 — the one intentional difference from web: Sentinel can RESOLVE it on this device. The chip runs
    // the matched fix through the gated control plane (Confirmed-grade, never autonomous, countdown + kill-switch).
    appendResolveChip(bubble, question);
    // RUN-CU / CU4 — the brain offered a VETTED fix by name (voice/chat action sentinel-fix): one honest button
    // that goes through the same gated pipeline + approval policy; the status line says exactly what happened.
    if (res && res.fixOffer && res.fixOffer.recipeId) appendFixOffer(bubble, res.fixOffer);
    appendConfidenceAndFeedback(bubble, res, question);
  }
  function appendFixOffer(bubble, offer) {
    const wrap = document.createElement("div"); wrap.className = "aria-chat-resolve aria-chat-fixoffer";
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "aria-chat-resolve-btn"; btn.textContent = `Approve: ${offer.title || offer.recipeId}`;
    const st = document.createElement("span"); st.className = "aria-chat-resolve-status"; st.textContent = offer.announce || "";
    btn.addEventListener("click", async () => {
      btn.disabled = true; st.textContent = "Asking the safety gate…";
      try {
        const fix = await window.sentinel.supervisedFix({ recipeId: offer.recipeId, mode: "confirmed", source: "chat" });
        const o = describeSupervisedResult(fix, { liveFixes: state && state.liveFixes }); // (audit R1) the real outcome, never "Done." by default
        st.textContent = o.text; st.dataset.outcome = o.kind;
        if (o.kind === "countdown") showCountdownCard({ id: o.countdownId, secondsLeft: o.seconds, recipeId: offer.recipeId, title: offer.title, canCancel: true });
        if (o.ok === false) btn.disabled = false;
      } catch { st.textContent = "Couldn't resolve right now. Nothing was changed."; btn.disabled = false; }
    });
    wrap.append(btn, st); bubble.appendChild(wrap);
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
        // (audit R1/R2) ONE describer: policy copy from main · needs-admin · declined · failed · countdown · preview · running.
        const o = describeSupervisedResult(fix, { liveFixes: state && state.liveFixes });
        st.textContent = o.text; st.dataset.outcome = o.kind;
        if (o.kind === "countdown") showCountdownCard({ id: o.countdownId, secondsLeft: o.seconds, recipeId, title: recipeTitleOf(recipeId), canCancel: true });
        if (o.ok === false) btn.disabled = false;
      } catch { st.textContent = "Couldn't resolve right now. Nothing was changed."; btn.disabled = false; }
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
        if (outcome === "resolved") { st.textContent = "Thanks — logged as resolved."; return; }
        // P5 (2026-07-14) — "Not yet" is no longer a dead end. Log the miss to the local learning loop, then offer
        // real next steps: the guided walk-through OR a real technician ticket (P6 — a minted IIS-YYYYMMDD-NNN ref).
        st.textContent = "Thanks — let's get you unstuck.";
        try { await window.sentinel.logAnswerMiss?.({ matchScore: top }); } catch { /* miss-log is best-effort */ }
        renderEscalation();
      } catch { st.textContent = "Couldn't save that just now."; yes.disabled = false; no.disabled = false; }
    }
    // P5/P6 — the escalation panel under a "Not yet" answer: try the guided walk-through, or open a REAL ticket a
    // technician can pick up (the minted reference shows here AND lands in Dashboard → Activity). Never a dead end.
    function renderEscalation() {
      if (wrap.querySelector(".aria-chat-escalate")) return; // render once
      const panel = document.createElement("div"); panel.className = "aria-chat-escalate";
      const walk = document.createElement("button"); walk.type = "button"; walk.className = "aria-chat-feedback-btn"; walk.textContent = "Walk me through it";
      const tech = document.createElement("button"); tech.type = "button"; tech.className = "aria-chat-feedback-btn"; tech.textContent = "Connect a technician";
      const es = document.createElement("span"); es.className = "aria-chat-feedback-status";
      walk.addEventListener("click", () => { activateTab("walkthrough"); renderWalkthrough({ intent: question || "", mode: "guide" }); });
      tech.addEventListener("click", async () => {
        tech.disabled = true; es.textContent = "Opening a ticket…";
        try {
          let recipeId = ""; try { recipeId = await diagnoseRecipeId(question); } catch { /* recipe is optional — a local ref is always minted */ }
          const r = await window.sentinel.escalateTicket?.({ issue: question || "", recipeId });
          es.textContent = r && r.ok && r.ref
            ? `Ticket ${r.ref} opened — a technician can take it from here. You'll see it on your Dashboard activity.`
            : "Couldn't open a ticket just now — please try again.";
        } catch { es.textContent = "Couldn't open a ticket just now — please try again."; tech.disabled = false; }
      });
      panel.append(walk, tech, es); wrap.appendChild(panel);
    }
    yes.addEventListener("click", () => mark("resolved"));
    no.addEventListener("click", () => mark("not-yet"));
    wrap.append(q, yes, no, st); bubble.appendChild(wrap);
  }
  input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = Math.min(140, input.scrollHeight) + "px"; });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  // RUN-CU / CU4 — the tab keeps its own turn history (last 12) and sends it with every ask, so a follow-up
  // ("and the printer?") lands in context. Typed and spoken turns share ONE history.
  const turns = [];
  const remember = (role, content) => { turns.push({ role, content: String(content || "").slice(0, 2000) }); while (turns.length > 12) turns.shift(); };
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg || !window.sentinel || !window.sentinel.chat) return;
    row("me", msg); input.value = ""; input.style.height = "auto"; send.disabled = true; input.disabled = true;
    const r = thinking();
    try { const res = await window.sentinel.chat(msg, { history: turns.slice() }); remember("user", msg); if (res && res.text) remember("assistant", res.text); fill(r, res, msg); }
    catch (err) { r.querySelector(".aria-chat-bubble").textContent = "Something went wrong reaching ARIA. Please try again."; }
    finally { send.disabled = false; input.disabled = false; input.focus(); scrollEnd(); }
  });

  // ── RUN-CU / CU4 — 🎤 voice in the tab: on-device STT (bundled Vosk model) + narration; the mic shows ONLY
  // when the local model exists (never a cloud recognizer). "Voice conversation" keeps listening after each
  // answer until you say "that's all". A fix the brain offers is approved by your spoken "yes" through the
  // SAME gated pipeline as the Resolve chip — never executed from here.
  const mic = qs("#ariaChatMic"), voiceBar = qs("#ariaChatVoiceBar"), convoToggle = qs("#ariaVoiceConversation"), vstatus = qs("#ariaVoiceStatus");
  const canMic = typeof navigator !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  if (mic && canMic && window.sentinel.voskModelUrl) {
    window.sentinel.voskModelUrl().then((u) => { if (u) { mic.hidden = false; if (voiceBar) voiceBar.hidden = false; } }).catch(() => undefined);
    let pendingRow = null;
    const convo = createVoiceConversation({
      voskModelUrl: () => window.sentinel.voskModelUrl(),
      chat: (text, ctx) => window.sentinel.chat(text, { ...ctx, history: turns.slice() }),
      supervisedFix: (p) => window.sentinel.supervisedFix(p),
      voiceApprove: (recipeId) => window.sentinel.voiceApprove?.(recipeId),
      platform: state && state.platform,
      setGlobeState: () => {},
      onStatus: (st) => {
        mic.classList.toggle("listening", st === "listening"); mic.classList.toggle("speaking", st === "speaking");
        if (vstatus) vstatus.textContent = st === "listening" ? "Listening… (on this device)" : st === "thinking" ? "Thinking…" : st === "speaking" ? "Speaking — tap 🎤 to interrupt" : "";
        if (st === "thinking" && !pendingRow) pendingRow = thinking();
      },
      onTranscript: ({ who, text }) => {
        if (!text) return;
        if (who === "me") { const el = row("me", text); el.classList.add("voice"); remember("user", text); }
        else if (who === "aria") { if (pendingRow) { pendingRow.querySelector(".aria-chat-bubble").textContent = text; pendingRow.classList.add("voice"); pendingRow = null; } else row("aria", text).classList.add("voice"); remember("assistant", text); }
        else if (vstatus) vstatus.textContent = text;
      }
    });
    // Single-turn by default (one question, one spoken answer); the toggle turns it into a conversation.
    // (audit R12) a failed start never makes the mic vanish: it says why voice is unavailable on this install.
    mic.addEventListener("click", async () => {
      if (convo.isActive()) { await convo.globeTap(); return; }
      let r = null;
      try { r = await convo.start(); } catch { r = null; }
      if (!r || r.ok === false) { mic.disabled = true; mic.title = "Voice isn't available on this install"; if (vstatus) vstatus.textContent = "Voice isn't available on this install — typing works. (The on-device speech engine or microphone could not start.)"; }
    });
    convoToggle?.addEventListener("change", () => { if (!convoToggle.checked && convo.isActive() && convo.state() !== "listening") convo.stop(); });
    // When the conversation toggle is OFF, end after the first spoken answer (the loop re-arms only when ON).
    let lastState = "idle";
    const observer = setInterval(() => {
      const st = convo.state();
      if (st !== lastState) {
        if (lastState === "speaking" && st === "listening" && convoToggle && !convoToggle.checked) convo.stop();
        lastState = st;
      }
    }, 250);
    window.addEventListener("beforeunload", () => clearInterval(observer));
  }
}

// RUN 33-E — first-launch Setup wizard (6 steps). Shows once on a fresh install (state.setupNeeded) or when
// re-run from Settings; collects prefs and persists via sentinel.completeSetup. The state machine + never-replay
// invariant live in app-config.mjs (tested). Setup must never replay after completion.
//
// PROD 2026-10-14 (audit R8 / §3) — TWO TRACKS, ONE DIALOG:
//   · QUICK (default): Hello → Who are you → What I'll do → summary ("You're all set" — the LAST screen only).
//     "Start with safe defaults" fills every later step with the safe defaults and jumps to the summary;
//     "Customize" opens the full track. Finish in ≤3 clicks.
//   · FULL: the original 12 steps exactly as before (nothing removed — Rule 15) + the same summary at the end.
//   · "Skip for now — use safe defaults" on EVERY step; the license key typed in the License step is kept and
//     verified on Finish; the mode the person picked is respected (Manual stays Manual: the autonomy level
//     follows the mode unless they explicitly change it); role="dialog" + focus trap + Escape (→ summary).
let setupShown = false;
// RUN-CU / CU4 — wizard v2 prefs live beside the v1 four (sanitized in main by app-config.mjs; this is just the form state).
const setupPrefs = {
  mode: "manual", landOnAria: false, kbNotifications: true, trayIcon: true,
  identity: { kind: "personal", orgName: "" },
  deviceUser: { name: "", email: "", phone: "", smsOptIn: false },
  techContacts: [],
  autonomyLevel: "approve-first", // follows the recommended Manual mode (R8: Manual must stay Manual)
  fullAutoUnderstood: false,
  approver: { mode: "self", contacts: [], timeoutMinutes: 30, onTimeout: "skip" },
  reportRecipients: [],
  reportCadence: "weekly",
  maintenanceWindow: { enabled: false, windows: [] },
  notifyChannels: { desktop: true, email: true, sms: false }
};
// Wizard-only state (never sent to completeSetup): the typed license key, the live-fixes wish, explicit autonomy.
const setupLocal = { licenseKey: "", liveFixes: null, liveFixesTouched: false, autonomyExplicit: false, licenseVerified: null };
// Pure parsers shared by the wizard + the Settings form (one line per contact: "name, email, phone, role").
function parseContactLines(text) {
  return String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const parts = l.split(",").map((p) => p.trim());
    const email = parts.find((p) => /@/.test(p)) || "";
    const phone = parts.find((p) => /^\+?[0-9()\-\s.]{7,20}$/.test(p)) || "";
    const role = parts.map((p) => p.toLowerCase()).find((p) => ["admin", "it-lead", "approver"].includes(p)) || "admin";
    const name = parts.find((p) => p && p !== email && p !== phone && !["admin", "it-lead", "approver"].includes(p.toLowerCase())) || "";
    return { name, email, phone, role };
  });
}
function parseRecipientList(text) {
  return String(text || "").split(/[,\n;]/).map((p) => p.trim()).filter(Boolean).map((p) => (/@/.test(p) ? { email: p, phone: "" } : { email: "", phone: p }));
}
function contactLinesText(list) { return (list || []).map((c) => [c.name, c.email, c.phone, c.role].filter(Boolean).join(", ")).join("\n"); }
function recipientListText(list) { return (list || []).map((r) => r.email || r.phone).filter(Boolean).join(", "); }
function mwFrom(prefs) { const w = (prefs.maintenanceWindow && prefs.maintenanceWindow.windows && prefs.maintenanceWindow.windows[0]) || {}; return { days: typeof w.days === "string" ? w.days : "daily", start: w.start || "02:00", durationMin: w.durationMin || 120, enabled: Boolean(prefs.maintenanceWindow && prefs.maintenanceWindow.enabled) }; }
const liveFixesRowHtml = (id) => `<label class="setup-check setup-live-row"><input type="checkbox" id="${id}" ${setupLocal.liveFixes === true ? "checked" : ""}/> <span><b>Live fixes</b> — let ARIA apply vetted fixes for real.<br/><small>Off = ARIA shows what it would do and changes nothing. On = ARIA applies vetted fixes you confirm; Windows may ask for admin permission (UAC).</small></span></label>`;
const SETUP_STEPS = [
  { kicker: "Welcome", title: "ARIA Sentinel — your AI IT assistant", body: () => `<p class="setup-lead">Resident IT support that answers from the knowledge base first (free), and only calls the reasoning model for novel questions. Let's get you set up in a few steps.</p>` },
  { kicker: "License", title: "Activate or start a trial", id: "setup-license", body: () => `<p class="setup-lead">${escapeHtml(wizardTrialLine((state && state.gate) || {}))}</p><input id="setupLicense" placeholder="Paste license key (optional)" aria-label="License key (optional)" autocomplete="off" value="${escapeHtml(setupLocal.licenseKey)}" /><div class="button-row"><button type="button" class="ghost" id="setupVerifyLicense">Verify key now</button></div><p class="setup-inline-status" id="setupLicenseStatus">${escapeHtml(setupLocal.licenseVerified || "")}</p>` },
  { kicker: "Mode", title: "Choose your default mode", body: () => `<p class="setup-lead">Manual is recommended — ARIA previews fixes before doing anything. You can change this anytime.</p>
    <label class="setup-radio"><input type="radio" name="setupMode" value="manual" ${setupPrefs.mode === "manual" ? "checked" : ""}/> <b>Manual</b> — preview only (recommended)</label>
    <label class="setup-radio"><input type="radio" name="setupMode" value="confirmed" ${setupPrefs.mode === "confirmed" ? "checked" : ""}/> <b>Confirmed</b> — asks you once per fix, then fixes it with you present (needs Live fixes on)</label>` },
  { kicker: "ARIA Chat", title: "ARIA Chat", body: () => `<p class="setup-lead">ARIA Chat lives in the ARIA tab (left panel) — or press Ctrl+Alt+A anytime.</p><label class="setup-check"><input type="checkbox" id="setupLand" ${setupPrefs.landOnAria ? "checked" : ""}/> Open the ARIA tab when Sentinel starts</label>` },
  { kicker: "Notifications", title: "Notifications", body: () => `<label class="setup-check"><input type="checkbox" id="setupKbNotif" ${setupPrefs.kbNotifications ? "checked" : ""}/> Tell me when ARIA learns new fixes</label><label class="setup-check"><input type="checkbox" id="setupTray" ${setupPrefs.trayIcon ? "checked" : ""}/> Show the system-tray icon</label>` },
  // (audit R8) this mid-way checkpoint no longer says "all set" — only the LAST screen does.
  { kicker: "Done", title: "Basics saved", body: () => `<p class="setup-lead">The basics are in. A few more questions tell ARIA who to keep informed and how much to do on its own — or press <b>Skip for now</b> to keep the safe defaults and finish.</p>` },
  // ── RUN-CU / CU4 — wizard v2 steps, APPENDED after the original six (ids above are untouched) ──
  { kicker: "Who uses this device", title: "Who uses this device", id: "setup-identity", body: () => `<p class="setup-lead">ARIA uses this to know who to tell when something breaks. Nothing here leaves the device except to send you those notifications.</p>
    <label class="setup-radio"><input type="radio" name="setupIdentity" value="personal" ${setupPrefs.identity.kind === "personal" ? "checked" : ""}/> <b>Personal</b> — it's my device; I decide</label>
    <label class="setup-radio"><input type="radio" name="setupIdentity" value="business" ${setupPrefs.identity.kind === "business" ? "checked" : ""}/> <b>Business</b> — an IT contact should know too</label>
    <span class="setup-field-label">Organization (business only)</span><input id="setupOrg" type="text" value="${escapeHtml(setupPrefs.identity.orgName)}" placeholder="Acme Dental" aria-label="Organization" />
    <div class="setup-grid"><div><span class="setup-field-label">Your name</span><input id="setupUserName" type="text" value="${escapeHtml(setupPrefs.deviceUser.name)}" placeholder="Sam" aria-label="Your name" /></div><div><span class="setup-field-label">Your email</span><input id="setupUserEmail" type="email" value="${escapeHtml(setupPrefs.deviceUser.email)}" placeholder="sam@company.com" aria-label="Your email" /></div></div>
    <span class="setup-field-label">Your mobile (optional)</span><input id="setupUserPhone" type="tel" value="${escapeHtml(setupPrefs.deviceUser.phone)}" placeholder="+1 416 555 0100" aria-label="Your mobile (optional)" />
    <label class="setup-check"><input type="checkbox" id="setupUserSms" ${setupPrefs.deviceUser.smsOptIn ? "checked" : ""}/> Text me when something breaks</label>` },
  { kicker: "Who should know", title: "Who should know when something breaks", id: "setup-contacts", body: () => `<p class="setup-lead">Tech contacts get the same honest note you do: what broke, which vetted fix exists, what happened. One per line — <b>name, email, phone, role</b> (admin · it-lead · approver).${setupPrefs.identity.kind === "business" ? " A business device needs at least one before ARIA fixes anything on its own." : ""}</p>
    <textarea id="setupTechContacts" aria-label="Tech contacts, one per line" placeholder="Jordan Lee, jordan@company.com, +1 416 555 0101, admin">${escapeHtml(contactLinesText(setupPrefs.techContacts))}</textarea>` },
  { kicker: "Autonomy", title: "How much should Sentinel fix on its own", id: "setup-autonomy", body: () => `<p class="setup-lead">Pick one. Each card says exactly what ARIA will and won't touch. Red-tier issues always wait for a person, whatever you choose.</p>
    <div class="autonomy-cards">${autonomyCardsHtml(setupPrefs.autonomyLevel, "setup")}</div>
    <label class="setup-check" id="setupFullAutoRow" ${setupPrefs.autonomyLevel === "full-auto" ? "" : "hidden"}><input type="checkbox" id="setupFullAutoUnderstood" ${setupPrefs.fullAutoUnderstood ? "checked" : ""}/> I understand Full-auto applies green and yellow fixes inside my maintenance window without asking first.</label>
    ${liveFixesRowHtml("setupLiveFixes")}` },
  { kicker: "Approver", title: "Who approves a fix before it runs", id: "setup-approver", body: () => `<p class="setup-lead">When ARIA needs a yes, who gives it? Approvals show up in Control Center and by email; a fix never runs until someone says yes.</p>
    <span class="setup-field-label">Who can say yes</span><select id="setupApproverMode" aria-label="Who can say yes"><option value="self" ${setupPrefs.approver.mode === "self" ? "selected" : ""}>Me, on this device</option><option value="admin" ${setupPrefs.approver.mode === "admin" ? "selected" : ""}>A tech contact / approver email</option><option value="either" ${setupPrefs.approver.mode === "either" ? "selected" : ""}>Either</option></select>
    <span class="setup-field-label">Approver emails (comma-separated)</span><input id="setupApproverContacts" type="text" value="${escapeHtml((setupPrefs.approver.contacts || []).join(", "))}" placeholder="it@company.com" aria-label="Approver emails" />
    <div class="setup-grid"><div><span class="setup-field-label">Wait for an answer (minutes)</span><input id="setupApproverTimeout" type="number" min="5" max="1440" value="${Number(setupPrefs.approver.timeoutMinutes) || 30}" aria-label="Wait for an answer (minutes)" /></div><div><span class="setup-field-label">If nobody answers</span><select id="setupApproverOnTimeout" aria-label="If nobody answers"><option value="skip" ${setupPrefs.approver.onTimeout === "skip" ? "selected" : ""}>Skip the fix, tell me</option><option value="proceed-green-only" ${setupPrefs.approver.onTimeout === "proceed-green-only" ? "selected" : ""}>Go ahead with green only</option></select></div></div>` },
  { kicker: "Reports", title: "Who gets the report", id: "setup-reports", body: () => `<p class="setup-lead">The full PDF stays on this device. Email and text carry counts and titles only — never log lines, file paths or document text.</p>
    <span class="setup-field-label">Recipients (email or phone, comma-separated)</span><input id="setupReportRecipients" type="text" value="${escapeHtml(recipientListText(setupPrefs.reportRecipients))}" placeholder="owner@company.com" aria-label="Report recipients" />
    <span class="setup-field-label">How often</span><select id="setupReportCadence" aria-label="How often"><option value="per-fix" ${setupPrefs.reportCadence === "per-fix" ? "selected" : ""}>After every fix</option><option value="daily" ${setupPrefs.reportCadence === "daily" ? "selected" : ""}>Daily summary</option><option value="weekly" ${setupPrefs.reportCadence === "weekly" ? "selected" : ""}>Weekly summary</option></select>
    <div class="setup-grid"><label class="setup-check"><input type="checkbox" id="setupChDesktop" ${setupPrefs.notifyChannels.desktop ? "checked" : ""}/> Desktop notifications</label><label class="setup-check"><input type="checkbox" id="setupChEmail" ${setupPrefs.notifyChannels.email ? "checked" : ""}/> Email</label><label class="setup-check"><input type="checkbox" id="setupChSms" ${setupPrefs.notifyChannels.sms ? "checked" : ""}/> Text (SMS)</label></div>` },
  { kicker: "Maintenance", title: "When can maintenance run", id: "setup-window", body: () => { const mw = mwFrom(setupPrefs); return `<p class="setup-lead">Full-auto applies yellow-tier fixes only inside this window; everything else waits for a yes. Leave it off and yellow fixes always ask.</p>
    <label class="setup-check"><input type="checkbox" id="setupMwEnabled" ${mw.enabled ? "checked" : ""}/> Use a maintenance window</label>
    <div class="setup-grid"><div><span class="setup-field-label">Days</span><select id="setupMwDays" aria-label="Days"><option value="daily" ${mw.days === "daily" ? "selected" : ""}>Every day</option><option value="weekdays" ${mw.days === "weekdays" ? "selected" : ""}>Weekdays</option><option value="weekends" ${mw.days === "weekends" ? "selected" : ""}>Weekends</option></select></div><div><span class="setup-field-label">Starts at (local)</span><input id="setupMwStart" type="time" value="${escapeHtml(mw.start)}" aria-label="Starts at" /></div></div>
    <span class="setup-field-label">Lasts (minutes, 15–1440)</span><input id="setupMwDuration" type="number" min="15" max="1440" value="${Number(mw.durationMin) || 120}" aria-label="Lasts (minutes)" />`; } }
];
let setupStep = 0;
// ── PROD 2026-10-14 (audit §3) — the quick track: the three screens a buyer judges the product by + the summary ──
const SUMMARY_STEP = { kicker: "Done", title: "You're all set", id: "setup-summary", body: () => `<p class="setup-lead">Here is exactly what ARIA will do on this computer. Press <b>Finish</b> to start — you can change any of it in Settings.</p><ul class="setup-summary">${summaryLines(setupPrefs, { liveFixes: setupLocal.liveFixes === true, licenseKey: setupLocal.licenseKey, trialLine: wizardTrialLine((state && state.gate) || {}) }).map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>` };
const QUICK_STEPS = [
  { kicker: "Hello", title: "ARIA Sentinel — resident IT support", id: "setup-hello", body: () => `<div class="setup-hello"><p class="setup-lead">I watch this computer for problems, tell you in plain words, and apply the safe, vetted fixes only when you say so. Nothing you type or open ever leaves this PC.</p>
    <div class="setup-hello-actions"><button type="button" class="primary" id="setupSafeDefaults">Start with safe defaults</button><button type="button" class="ghost" id="setupCustomize">Customize (all 12 steps)</button></div>
    <p class="setup-defaults-line">Safe defaults: Manual mode · ask before every fix · desktop notifications · tray icon · weekly summary · live fixes off (previews only).</p></div>` },
  { kicker: "Who are you", title: "Who are you?", id: "setup-who", body: () => `<p class="setup-lead">Your name and email are what approvals and reports are addressed to. A license key is optional — ${escapeHtml(wizardTrialLine((state && state.gate) || {}).replace(/\.\s.*$/, "."))}</p>
    <div class="setup-grid"><div><span class="setup-field-label">Your name</span><input id="setupUserName" type="text" value="${escapeHtml(setupPrefs.deviceUser.name)}" placeholder="Sam" aria-label="Your name" /></div><div><span class="setup-field-label">Your email</span><input id="setupUserEmail" type="email" value="${escapeHtml(setupPrefs.deviceUser.email)}" placeholder="sam@company.com" aria-label="Your email" /></div></div>
    <span class="setup-field-label">License key (optional)</span><input id="setupLicense" placeholder="Paste license key (optional)" aria-label="License key (optional)" autocomplete="off" value="${escapeHtml(setupLocal.licenseKey)}" />
    <p class="setup-inline-status" id="setupLicenseStatus">${escapeHtml(setupLocal.licenseVerified || "")}</p>
    <p class="setup-defaults-line"><a href="#" id="setupForBusiness">Set up for a business (IT contacts, approver, reports) →</a></p>` },
  { kicker: "What I'll do", title: "What should I do when I find a problem?", id: "setup-what", body: () => `<div class="what-cards">${WHAT_CARDS.map((c) => `<button type="button" class="what-card${quickChoiceOf(setupPrefs) === c.id ? " selected" : ""}" data-what-card="${c.id}"><b>${escapeHtml(c.label)}</b><span>${escapeHtml(c.consequence)}</span>${c.recommended ? "<em>recommended</em>" : ""}</button>`).join("")}</div>
    ${liveFixesRowHtml("setupLiveFixes")}
    <p class="setup-defaults-line"><a href="#" id="setupMoreOptions">More options (Full-auto, maintenance window) →</a></p>` },
  SUMMARY_STEP
];
let setupTrack = "quick";
function setupSteps() { return setupTrack === "quick" ? QUICK_STEPS : [...SETUP_STEPS, SUMMARY_STEP]; }
function setupIsSummary() { const s = setupSteps()[setupStep]; return Boolean(s && s.id === "setup-summary"); }
function maybeShowSetupWizard(state) {
  if (setupShown || !state || !state.setupNeeded) return;
  setupShown = true; setupStep = 0; setupTrack = "quick";
  if (setupLocal.liveFixes == null) setupLocal.liveFixes = Boolean(state.liveFixes && state.liveFixes.enabled);
  renderSetupStep();
  const modal = qs("#setupWizard"); if (modal) { modal.hidden = false; setTimeout(() => focusFirstInSetup(), 30); }
}
function captureSetupStep() {
  const mode = qs('input[name="setupMode"]:checked');
  if (mode) { setupPrefs.mode = mode.value; if (!setupLocal.autonomyExplicit) setupPrefs.autonomyLevel = autonomyForMode(mode.value); } // (R8) the mode is respected
  const lic = qs("#setupLicense"); if (lic) setupLocal.licenseKey = lic.value.trim(); // (R8) the typed key is KEPT
  const land = qs("#setupLand"); if (land) setupPrefs.landOnAria = land.checked;
  const kb = qs("#setupKbNotif"); if (kb) setupPrefs.kbNotifications = kb.checked;
  const tray = qs("#setupTray"); if (tray) setupPrefs.trayIcon = tray.checked;
  const lf = qs("#setupLiveFixes"); if (lf) { setupLocal.liveFixes = lf.checked; }
  // RUN-CU / CU4 — v2 steps (each capture is a no-op when its fields are not on screen).
  const idk = qs('input[name="setupIdentity"]:checked'); if (idk) setupPrefs.identity.kind = idk.value;
  const org = qs("#setupOrg"); if (org) setupPrefs.identity.orgName = org.value.trim();
  const un = qs("#setupUserName"); if (un) setupPrefs.deviceUser.name = un.value.trim();
  const ue = qs("#setupUserEmail"); if (ue) { setupPrefs.deviceUser.email = ue.value.trim(); if (!qs("#setupChEmail")) setupPrefs.notifyChannels.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(setupPrefs.deviceUser.email); } // the email channel is honest: on only with an email (the Reports step's checkbox still overrides)
  const up = qs("#setupUserPhone"); if (up) setupPrefs.deviceUser.phone = up.value.trim();
  const us = qs("#setupUserSms"); if (us) setupPrefs.deviceUser.smsOptIn = us.checked;
  const tc = qs("#setupTechContacts"); if (tc) setupPrefs.techContacts = parseContactLines(tc.value);
  const fau = qs("#setupFullAutoUnderstood"); if (fau) setupPrefs.fullAutoUnderstood = fau.checked;
  const am = qs("#setupApproverMode"); if (am) setupPrefs.approver.mode = am.value;
  const ac = qs("#setupApproverContacts"); if (ac) setupPrefs.approver.contacts = ac.value.split(",").map((s) => s.trim()).filter(Boolean);
  const at = qs("#setupApproverTimeout"); if (at) setupPrefs.approver.timeoutMinutes = Number(at.value) || 30;
  const ao = qs("#setupApproverOnTimeout"); if (ao) setupPrefs.approver.onTimeout = ao.value;
  const rr = qs("#setupReportRecipients"); if (rr) setupPrefs.reportRecipients = parseRecipientList(rr.value);
  const rc = qs("#setupReportCadence"); if (rc) setupPrefs.reportCadence = rc.value;
  const cd = qs("#setupChDesktop"); if (cd) setupPrefs.notifyChannels.desktop = cd.checked;
  const ce = qs("#setupChEmail"); if (ce) setupPrefs.notifyChannels.email = ce.checked;
  const cs = qs("#setupChSms"); if (cs) setupPrefs.notifyChannels.sms = cs.checked;
  const mwe = qs("#setupMwEnabled");
  if (mwe) {
    const w = { days: qs("#setupMwDays")?.value || "daily", start: qs("#setupMwStart")?.value || "02:00", durationMin: Number(qs("#setupMwDuration")?.value) || 120 };
    setupPrefs.maintenanceWindow = { enabled: mwe.checked, windows: [w] };
  }
}
function focusFirstInSetup() {
  const modal = qs("#setupWizard"); if (!modal || modal.hidden) return;
  const first = modal.querySelector("#setupBody input:not([type=hidden]), #setupBody select, #setupBody textarea, #setupBody button, #setupNext");
  if (first) first.focus();
}
function renderSetupStep() {
  const steps = setupSteps();
  setupStep = Math.max(0, Math.min(setupStep, steps.length - 1));
  const s = steps[setupStep]; if (!s) return;
  setText("setupKicker", s.kicker); setText("setupTitle", s.title);
  const body = qs("#setupBody"); if (body) { body.innerHTML = s.body(); body.dataset.step = s.id || `setup-v1-${setupStep}`; body.dataset.track = setupTrack; }
  const dots = qs("#setupDots"); if (dots) dots.innerHTML = steps.map((_, i) => `<span class="onboard-dot${i === setupStep ? " active" : ""}"></span>`).join("");
  setText("setupProgress", progressLabel(setupStep, steps.length) + (setupTrack === "quick" ? "" : " · full setup"));
  const summary = setupIsSummary();
  const back = qs("#setupBack"); if (back) back.style.visibility = setupStep === 0 ? "hidden" : "visible";
  const next = qs("#setupNext"); if (next) next.textContent = summary ? "Finish" : "Next";
  const skip = qs("#setupSkip"); if (skip) skip.hidden = summary; // (R8) visible on every step but the summary
  // RUN-CU / CU4 — autonomy cards select on click; Full-auto reveals its "I understand" line (never silent).
  qsa("[data-setup-level]").forEach((card) => card.addEventListener("click", () => {
    setupPrefs.autonomyLevel = card.dataset.setupLevel; setupLocal.autonomyExplicit = true;
    qsa("[data-setup-level]").forEach((c) => c.classList.toggle("selected", c === card));
    const row = qs("#setupFullAutoRow"); if (row) row.hidden = setupPrefs.autonomyLevel !== "full-auto";
  }));
  // Quick track: the three "What I'll do" cards set autonomy + mode together (setup-flow.mjs).
  qsa("[data-what-card]").forEach((card) => card.addEventListener("click", () => {
    Object.assign(setupPrefs, quickChoiceToPrefs(card.dataset.whatCard)); setupLocal.autonomyExplicit = true;
    qsa("[data-what-card]").forEach((c) => c.classList.toggle("selected", c === card));
  }));
  qs("#setupLiveFixes")?.addEventListener("change", (e) => { setupLocal.liveFixes = e.target.checked; setupLocal.liveFixesTouched = true; });
  qs("#setupSafeDefaults")?.addEventListener("click", () => setupUseSafeDefaults());
  qs("#setupCustomize")?.addEventListener("click", () => { captureSetupStep(); setupTrack = "full"; setupStep = 0; renderSetupStep(); focusFirstInSetup(); });
  qs("#setupForBusiness")?.addEventListener("click", (e) => { e.preventDefault(); captureSetupStep(); setupPrefs.identity.kind = "business"; setupTrack = "full"; setupStep = SETUP_STEPS.findIndex((x) => x.id === "setup-identity"); renderSetupStep(); focusFirstInSetup(); });
  qs("#setupMoreOptions")?.addEventListener("click", (e) => { e.preventDefault(); captureSetupStep(); setupTrack = "full"; setupStep = SETUP_STEPS.findIndex((x) => x.id === "setup-autonomy"); renderSetupStep(); focusFirstInSetup(); });
  qs("#setupVerifyLicense")?.addEventListener("click", () => verifySetupLicense(true));
  qs("#setupLicense")?.addEventListener("input", () => { setupLocal.licenseVerified = null; const st = qs("#setupLicenseStatus"); if (st) st.textContent = ""; });
}
// "Skip for now — use safe defaults": keep what was typed, fill the rest with the safe defaults, show the summary.
function setupUseSafeDefaults() {
  captureSetupStep();
  const safe = applySafeDefaults(setupPrefs);
  Object.assign(setupPrefs, safe);
  setupLocal.autonomyExplicit = false;
  if (!setupLocal.liveFixesTouched) setupLocal.liveFixes = false;
  setupStep = setupSteps().length - 1; // the summary is always the last step of either track
  renderSetupStep();
  setTimeout(() => qs("#setupNext")?.focus(), 30);
}
async function verifySetupLicense(explicit = false) {
  captureSetupStep();
  const key = setupLocal.licenseKey;
  const st = qs("#setupLicenseStatus");
  if (!key) { if (st && explicit) st.textContent = "Paste a key first (64 characters)."; return null; }
  if (!isLicenseKeyShaped(key)) { setupLocal.licenseVerified = "That doesn't look like a license key (64 characters expected) — nothing was sent."; if (st) st.textContent = setupLocal.licenseVerified; return null; }
  if (st) st.textContent = "Verifying…";
  let r = null;
  try { r = await sentinel.enterLicense?.({ key, email: setupPrefs.deviceUser.email || "" }); } catch { r = null; }
  setupLocal.licenseVerified = r && r.ok ? `License activated${r.plan ? " · " + r.plan : ""}.` : `Couldn't activate that key${r && r.error ? " (" + String(r.error).replace(/_/g, " ") + ")" : ""} — you can try again in Settings → License.`;
  if (st) st.textContent = setupLocal.licenseVerified;
  return r;
}
async function finishSetup() {
  captureSetupStep();
  const prefs = { ...setupPrefs };
  try {
    const r = await sentinel.completeSetup?.(prefs);
    if (r && r.applied && r.applied.note) showToast({ title: "Autonomy", body: r.applied.note });
  } catch (e) { /* persistence best-effort */ }
  // (R8) the license key typed in the wizard reaches enterLicense (once, unless it was already verified here).
  if (setupLocal.licenseKey && isLicenseKeyShaped(setupLocal.licenseKey) && !/activated/i.test(setupLocal.licenseVerified || "")) {
    const r = await verifySetupLicense(false);
    showToast(r && r.ok ? { title: "License activated", body: "ARIA is unlocked on this machine." } : { title: "License not activated", body: setupLocal.licenseVerified || "Try again in Settings → License.", danger: true });
  }
  // (R1/R2) the live-fixes wish is written through the consent gate, and only when it differs from the current state.
  const cur = Boolean(liveFixesCache && liveFixesCache.enabled);
  if (setupLocal.liveFixes != null && setupLocal.liveFixes !== cur) {
    try { const lf = await sentinel.setLiveFixes?.({ enabled: setupLocal.liveFixes }); if (lf && typeof lf.enabled === "boolean") renderLiveFixes(lf); } catch { /* the Settings switch still works */ }
  }
  const modal = qs("#setupWizard"); if (modal) modal.hidden = true;
  if (setupPrefs.landOnAria) activateTab("aria");
  // (R8) the coachmark tour runs AFTER the wizard, once — never stacked on top of it.
  if (state && state.firstRunComplete === false && !onboardingShown) startTour({ auto: true });
}
function initSetupWizard() {
  bindClick("setupBack", () => { captureSetupStep(); if (setupStep > 0) { setupStep--; renderSetupStep(); focusFirstInSetup(); } });
  bindClick("setupNext", async () => {
    captureSetupStep();
    if (!setupIsSummary()) { setupStep++; renderSetupStep(); focusFirstInSetup(); return; }
    await finishSetup();
  });
  bindClick("setupSkip", () => setupUseSafeDefaults());
  bindClick("reRunSetup", async () => { try { await sentinel.reopenSetup?.(); setupShown = false; } catch (e) {} });
}
// (audit R8 / R16) a real dialog: Tab cycles inside the wizard, Escape goes to the summary (never closes silently).
function wireSetupDialogA11y() {
  const modal = qs("#setupWizard");
  if (!modal) return;
  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); if (!setupIsSummary()) setupUseSafeDefaults(); return; }
    if (e.key !== "Tab") return;
    const items = Array.from(modal.querySelectorAll("button:not([hidden]):not([disabled]), input:not([hidden]):not([disabled]), select, textarea, a[href]")).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

// ===== 2026-10-14 — ADVISE THREE TIMES, THEN ACT (Autonomous mode) =====
// main gives every notice in plain words (advisory-escalation.mjs advisoryCopy); the renderer only shows it and returns
// the person's choice. The Settings sentence is generated by ruleSentence() from the same constants the code runs.
function advisoryChatLine(view) {
  if (!view || !view.copy) return;
  const c = view.copy;
  const choices = (Array.isArray(c.choices) ? c.choices : []).map((x) => x && x.label).filter(Boolean).join(" · ");
  appendChat("aria", `${c.line}: ${c.found} ${c.willDo} ${c.when}${choices ? ` (On Home or the globe card: ${choices}.)` : ""}`);
}
/** The toast for a choice — what really happened (Rule 14: "fixed" only when the pipeline says so). */
function advisoryAckToast(choice, r) {
  if (!r || r.ok !== true) return { title: "Couldn't record that", body: r && /already|not-found/.test(String(r.error || "")) ? "That notice was already answered or has closed. Nothing else changed." : "Nothing was changed.", danger: true };
  if (choice === "not-now") {
    const until = r.advisory && Date.parse(r.advisory.snoozedUntil || "");
    return { title: "Not now", body: `I'll tell you again ${Number.isFinite(until) ? "after " + new Date(until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "later"}. Nothing runs before then.` };
  }
  if (choice === "never") return { title: "Never for this", body: "I won't fix this on my own on this device again. If it comes back, I'll ask you first. (Settings → Autonomy → Allow again.)" };
  if (!r.fix) return { title: "IT contact told", body: "Your IT contact has been told. Nothing was changed on this device." };
  const o = describeSupervisedResult(r.fix);
  return { title: "Fix now", body: o.text, danger: o.ok === false };
}
function advisoryRuleFromForm() {
  return ruleSentence({ advisoryIntervalMinutes: Number(qs("#advisoryInterval")?.value), advisorySnoozeHours: Number(qs("#advisorySnooze")?.value) });
}
function renderAdvisoryNeverList(never) {
  const host = qs("#advisoryNeverList");
  if (!host) return;
  const list = Array.isArray(never) ? never : [];
  host.hidden = list.length === 0;
  host.textContent = "";
  if (!list.length) return;
  const lead = document.createElement("p"); lead.className = "note"; lead.textContent = "You chose “Never for this” for these — ARIA asks you first instead of fixing them on its own:";
  host.appendChild(lead);
  const titles = new Map(((state && state.recipes) || []).map((r) => [r.id, r.title]));
  for (const id of list) {
    const row = document.createElement("div"); row.className = "health-row";
    const name = document.createElement("strong"); name.textContent = titles.get(id) || id;
    const again = document.createElement("button"); again.className = "ghost"; again.type = "button"; again.textContent = "Allow again"; again.dataset.advisoryAllow = id;
    again.addEventListener("click", () => runAction(again, async () => { const r = await sentinel.setAdvisoryPrefs?.({ allowAgain: [id] }); renderAdvisoryPrefs(r); return r; }));
    row.append(name, again);
    host.appendChild(row);
  }
}
function renderAdvisoryPrefs(r) {
  if (!r || !r.prefs) return;
  const p = normalizeAdvisoryPrefs(r.prefs);
  const iv = qs("#advisoryInterval"), sz = qs("#advisorySnooze");
  if (iv) iv.value = String(p.intervalMinutes);
  if (sz) sz.value = String(p.snoozeHours);
  setText("advisoryRuleSentence", ruleSentence(p));
  renderAdvisoryNeverList(r.never);
}
async function loadAdvisoryPrefs() {
  try {
    const r = await sentinel.getAdvisoryPrefs?.();
    if (r && r.ok && r.prefs) renderAdvisoryPrefs(r);
    else setText("advisoryRuleSentence", ruleSentence((state && state.advisoryPrefs) || {})); // older main: the defaults, still from the same constants
  } catch (e) { reportRendererError(e, "advisory-prefs"); }
}
function wireAdvisoryPrefs() {
  const iv = qs("#advisoryInterval"), sz = qs("#advisorySnooze");
  for (const [el, lo, hi] of [[iv, ADVISORY_INTERVAL_MIN, ADVISORY_INTERVAL_MAX], [sz, ADVISORY_SNOOZE_MIN_H, ADVISORY_SNOOZE_MAX_H]]) {
    if (!el) continue;
    el.min = String(lo); el.max = String(hi);
    el.addEventListener("input", () => setText("advisoryRuleSentence", advisoryRuleFromForm())); // the sentence follows the numbers
  }
  bindClick("saveAdvisoryPrefs", (b) => runAction(b, async () => {
    const r = await sentinel.setAdvisoryPrefs?.({ intervalMinutes: Number(iv?.value), snoozeHours: Number(sz?.value) });
    const st = qs("#advisoryPrefsStatus");
    if (st) st.textContent = r && r.ok ? `Saved · a notice every ${r.prefs.intervalMinutes} min · Not now waits ${r.prefs.snoozeHours} h` : "Couldn't save.";
    renderAdvisoryPrefs(r);
    return r;
  }));
}

// ===== RUN-CU / CU4 — Settings → Autonomy & contacts (edits the SAME prefs the wizard collects; setup:update-prefs) =====
let autonomyFormLevel = "safe-auto";
async function loadAutonomyPrefs() {
  try {
    const r = await sentinel.getSetup?.();
    const p = (r && r.prefs) || {};
    autonomyFormLevel = p.autonomyLevel || "safe-auto";
    const cards = qs("#autonomyCards"); if (cards) cards.innerHTML = autonomyCardsHtml(autonomyFormLevel, "autonomy");
    const fa = qs("#fullAutoUnderstoodRow"); if (fa) fa.hidden = autonomyFormLevel !== "full-auto";
    const fau = qs("#fullAutoUnderstood"); if (fau) fau.checked = p.fullAutoUnderstood === true;
    qsa("[data-autonomy-level]").forEach((card) => card.addEventListener("click", () => {
      autonomyFormLevel = card.dataset.autonomyLevel;
      qsa("[data-autonomy-level]").forEach((c) => c.classList.toggle("selected", c === card));
      if (fa) fa.hidden = autonomyFormLevel !== "full-auto";
    }));
    const set = (id, v) => { const el = qs(`#${id}`); if (el) el.value = v == null ? "" : String(v); };
    const chk = (id, v) => { const el = qs(`#${id}`); if (el) el.checked = Boolean(v); };
    set("identityKind", (p.identity || {}).kind || "personal"); set("identityOrg", (p.identity || {}).orgName);
    set("deviceUserName", (p.deviceUser || {}).name); set("deviceUserEmail", (p.deviceUser || {}).email); set("deviceUserPhone", (p.deviceUser || {}).phone); chk("deviceUserSms", (p.deviceUser || {}).smsOptIn);
    set("techContacts", contactLinesText(p.techContacts));
    set("approverMode", (p.approver || {}).mode || "self"); set("approverContacts", ((p.approver || {}).contacts || []).join(", ")); set("approverTimeout", (p.approver || {}).timeoutMinutes || 30); set("approverOnTimeout", (p.approver || {}).onTimeout || "skip");
    set("reportRecipients", recipientListText(p.reportRecipients)); set("reportCadence", p.reportCadence || "weekly");
    const mw = mwFrom(p); set("mwDays", mw.days); set("mwStart", mw.start); set("mwDuration", mw.durationMin); chk("mwEnabled", mw.enabled);
    chk("chDesktop", (p.notifyChannels || {}).desktop !== false); chk("chEmail", (p.notifyChannels || {}).email !== false); chk("chSms", (p.notifyChannels || {}).sms === true);
    if (r && r.autonomy) renderAutonomyBadge({ autonomy: r.autonomy, keepSystemFixesDryRun: state && state.keepSystemFixesDryRun });
  } catch (e) { reportRendererError(e, "autonomy-prefs"); }
}
function wireAutonomyPrefs() {
  bindClick("saveAutonomyPrefs", (b) => runAction(b, async () => {
    const partial = {
      identity: { kind: qs("#identityKind")?.value, orgName: qs("#identityOrg")?.value },
      deviceUser: { name: qs("#deviceUserName")?.value, email: qs("#deviceUserEmail")?.value, phone: qs("#deviceUserPhone")?.value, smsOptIn: qs("#deviceUserSms")?.checked },
      techContacts: parseContactLines(qs("#techContacts")?.value),
      autonomyLevel: autonomyFormLevel,
      fullAutoUnderstood: Boolean(qs("#fullAutoUnderstood")?.checked),
      approver: { mode: qs("#approverMode")?.value, contacts: String(qs("#approverContacts")?.value || "").split(",").map((s) => s.trim()).filter(Boolean), timeoutMinutes: Number(qs("#approverTimeout")?.value), onTimeout: qs("#approverOnTimeout")?.value },
      reportRecipients: parseRecipientList(qs("#reportRecipients")?.value),
      reportCadence: qs("#reportCadence")?.value,
      maintenanceWindow: { enabled: Boolean(qs("#mwEnabled")?.checked), windows: [{ days: qs("#mwDays")?.value || "daily", start: qs("#mwStart")?.value || "02:00", durationMin: Number(qs("#mwDuration")?.value) || 120 }] },
      notifyChannels: { desktop: Boolean(qs("#chDesktop")?.checked), email: Boolean(qs("#chEmail")?.checked), sms: Boolean(qs("#chSms")?.checked) }
    };
    const r = await sentinel.updateSetupPrefs?.(partial);
    const st = qs("#autonomyPrefsStatus");
    if (st) st.textContent = r && r.ok ? `Saved · level ${r.autonomy ? r.autonomy.level : autonomyFormLevel}${r.applied && r.applied.note ? " — " + r.applied.note : ""}` : "Couldn't save.";
    await loadAutonomyPrefs();
    return r;
  }));
  bindClick("testNotification", (b) => runAction(b, async () => {
    const r = await sentinel.testNotification?.();
    const st = qs("#autonomyPrefsStatus");
    // Rule 14 — report exactly what happened per channel; "dormant" reads as NOT sent.
    if (st) st.textContent = r ? `Desktop: ${r.desktop && r.desktop.shown ? "shown" : "not shown (" + ((r.desktop && r.desktop.reason) || "unsupported") + ")"} · Email: ${(r.email && r.email.status) || "skipped"}${r.email && r.email.status === "dormant" ? " (not sent — no email provider on the server)" : r.email && r.email.reason ? " (" + r.email.reason + ")" : ""} · SMS: ${(r.sms && r.sms.status) || "skipped"}${r.sms && r.sms.status === "dormant" ? " (not sent — SMS provider not configured)" : r.sms && r.sms.reason ? " (" + r.sms.reason + ")" : ""}` : "No result.";
    return r;
  }));
  bindChange("keepDryRunToggle", (input) => sentinel.setKeepDryRun?.(input.checked ? true : null));
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
      // D4 — when external AI is off this build, say so honestly rather than a bare "All systems healthy".
      const offNote = data.externalAiEnabled === false ? " · external AI off (local-symbolic)" : "";
      setText("healthOverall", (data.overall === "green" ? "All systems healthy" : data.overall === "yellow" ? "Degraded — fallback active" : data.overall === "red" ? "Outage — using local KB" : "Status unavailable") + offNote);
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
  throw new Error("sentinel_bridge_unavailable");
}

init().catch((error) => {
  console.error(error);
  const bridgeDown = String(error?.message || "").includes("sentinel_bridge_unavailable");
  document.body.innerHTML = `
    <main class="settings-workspace">
      <section class="panel">
        <p class="eyebrow">ARIA Sentinel</p>
        <h1>${bridgeDown ? "Desktop bridge unavailable" : "Self-repair started"}</h1>
        <p>${bridgeDown
          ? "ARIA Sentinel did not load its local Electron bridge, so the app stopped instead of falling back to a simulated preview. Restart the desktop app. If this persists, the preload bridge is failing before the renderer can talk to the real local runtime."
          : "ARIA caught a renderer startup error and reported it to the local self-diagnosis path."}</p>
      </section>
    </main>
  `;
});
