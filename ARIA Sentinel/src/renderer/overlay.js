import { COMPANION_MENU, getFlow, flowStep, resolveStep, stepKey, isStepAnswered, listFlows } from "../shared/walkthrough-steps.mjs";
import { createLocalStt } from "./local-stt.mjs"; // TRUE on-device offline STT (Vosk) — no cloud, no audio egress

// Defensive: if the preload bridge ever fails to attach, fall back to a no-op API so the
// globe still renders instead of throwing an uncaught TypeError.
const sentinel = window.sentinel || {
  onOverlayMode: () => {},
  onDetection: () => {},
  getState: async () => ({ detections: [] }),
  showGlobe: async () => {},
  dismissOverlay: async () => {},
  selfDiagnose: async () => ({ ok: true }),
  selfRepair: async () => ({ ok: true }),
  runRecipe: async () => ({ ok: true, dryRun: true }),
  onGreeting: () => {},
  onGlobeConfirmation: () => {},
  openCompanion: async () => {},
  openWalkthrough: async () => ({ ok: true }),
  openMainTab: async () => ({ ok: true }),
  openExternal: async () => ({ ok: true }),
  copyText: async () => ({ ok: true }),
  supervisedFix: async () => ({ ok: true }),
  diagnose: async () => ({}),
  isVettedRecipe: async () => ({ vetted: false })
};
let currentDetection = null;
let wiggledThisSession = false;
const body = document.body;
const card = document.getElementById("overlayCard");
const chip = document.getElementById("overlayChip");
const title = document.getElementById("overlayTitle");
const copy = document.getElementById("overlayBody");
const globeSvg = document.querySelector(".aria-globe");
const greeting = document.getElementById("overlayGreeting");
let greetingTimer = null;
const confirmEl = document.getElementById("overlayConfirm");
let confirmTimer = null;
const companionPanel = document.getElementById("companionPanel");
const companionBody = document.getElementById("companionBody");
const companionBackBtn = document.getElementById("companionBack");
const companionCloseBtn = document.getElementById("companionClose");
const companionMuteBtn = document.getElementById("companionMute");

// ============================================================================================================
// COMPANION VOICE — on-device only, $0 (no paid/cloud voice API). Two halves, both guarded so the companion
// degrades gracefully where the browser/OS lacks the API:
//  · NARRATION (OUTPUT): speechSynthesis speaks the SAME visible card text (never a separate/embellished
//    script — Rule 14), in a calm/warm/professional FEMALE voice (prefer Microsoft Aria/Jenny → Zira →
//    any female en-US), rate ~0.95 / pitch ~1.0. ON by default; a header mute toggle always available.
//  · INPUT (tap-to-speak): a bundled ON-DEVICE offline STT engine (Vosk WASM, see ./local-stt.mjs) transcribes
//    into the field — NO audio leaves the machine and there is NO cloud recognizer fallback; typing ALWAYS works.
// ============================================================================================================
let narrationMuted = false; // narration is ON by default; the header toggle mutes/unmutes it

function pickNarrationVoice() {
  if (typeof speechSynthesis === "undefined") return null;
  const voices = speechSynthesis.getVoices() || [];
  const byName = (re) => voices.find((v) => re.test(v.name));
  // Preference order: Microsoft Aria / Jenny (neural, natural) → Zira → any female en-US → any en-US → any en.
  return byName(/aria|jenny/i)
    || byName(/zira/i)
    || voices.find((v) => /female|woman/i.test(v.name) && /^en[-_]?US/i.test(v.lang))
    || voices.find((v) => /^en[-_]?US/i.test(v.lang))
    || voices.find((v) => /^en/i.test(v.lang))
    || null;
}

function narrate(text) {
  if (typeof speechSynthesis === "undefined") return; // no TTS here → stay silent, screen text is the source
  if (narrationMuted || !text || !text.trim()) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.trim());
    const v = pickNarrationVoice(); if (v) u.voice = v;
    u.lang = (v && v.lang) || "en-US";
    u.rate = 0.95; u.pitch = 1.0; // soft, unhurried, professional
    speechSynthesis.speak(u);
  } catch { /* on-device TTS is best-effort; it never blocks the visible card */ }
}

// Speak EXACTLY what is on the card — read the rendered lead/sub text, never a separate script (Rule 14).
function speakCurrentCard() {
  if (!companionBody) return;
  const parts = [...companionBody.querySelectorAll(".companion-lead, .companion-sub")]
    .map((n) => n.textContent).filter((s) => s && s.trim());
  narrate(parts.join(". "));
}

companionMuteBtn?.addEventListener("click", () => {
  narrationMuted = !narrationMuted;
  if (narrationMuted && typeof speechSynthesis !== "undefined") { try { speechSynthesis.cancel(); } catch { /* ignore */ } }
  companionMuteBtn.setAttribute("aria-pressed", String(narrationMuted));
  companionMuteBtn.title = narrationMuted ? "Unmute narration" : "Mute narration";
  companionMuteBtn.innerHTML = narrationMuted ? "&#128263;" : "&#128266;"; // muted-speaker / speaker
});

// Tap-to-speak (voice INPUT): TRUE on-device offline STT (Vosk, ./local-stt.mjs). Guarded on a mic + a bundled
// local model; if either is missing the button hides and typing still works — there is NEVER a cloud fallback.
// The audio + transcription stay 100% local, so the caption "Voice stays on your device" is truthful. The mic is
// active ONLY while listening and is released on stop. Returns the button or null.
function addTapToSpeak(input, container) {
  const host = container || input.parentNode;
  const canMic = (typeof navigator !== "undefined") && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  // No mic API, or no local-STT bridge → no button (the text field alone is fully usable). Never a cloud shim.
  if (!canMic || !window.sentinel || !window.sentinel.voskModelUrl) return null;
  const btn = el("button", "companion-speak"); btn.type = "button"; btn.textContent = "🎤 Tap to speak";
  const cap = el("div", "companion-speak-note", "Voice stays on your device");
  const hide = () => { try { btn.remove(); cap.remove(); } catch { /* already gone */ } };
  let stt = null, listening = false;
  const stop = () => { listening = false; btn.classList.remove("listening"); btn.textContent = "🎤 Tap to speak"; if (stt) { try { stt.stop(); } catch { /* ignore */ } stt = null; } };
  btn.addEventListener("click", async () => {
    if (listening) { stop(); return; }
    try {
      const modelUrl = await window.sentinel.voskModelUrl();
      if (!modelUrl) return hide(); // no bundled model → hide the mic; NEVER fall back to a cloud recognizer
      listening = true; btn.classList.add("listening"); btn.textContent = "● Listening… tap to stop";
      stt = await createLocalStt({
        modelUrl,
        onText: (said) => { if (said) { input.value = (input.value ? input.value + " " : "") + said; input.dispatchEvent(new Event("input")); } }
      });
    } catch { stop(); hide(); } // local engine unavailable → hide the mic (typing still works)
  });
  host.appendChild(btn); host.appendChild(cap);
  // Probe up front: if there's no bundled model on this install, don't show a dead mic button.
  window.sentinel.voskModelUrl().then((u) => { if (!u) hide(); }).catch(() => hide());
  return btn;
}

function setGlobeState(state) {
  if (globeSvg) globeSvg.setAttribute("data-state", state);
}

// RUN 15 §2 — show an ambient greeting bubble above the globe, auto-hiding after its duration.
sentinel.onGreeting?.((g) => {
  if (!greeting || !g || !g.message) return;
  if (currentDetection) return; // never cover an active fix card with small talk
  greeting.textContent = g.message;
  greeting.hidden = false;
  // reflow so the opacity transition runs
  void greeting.offsetWidth;
  greeting.classList.add("show");
  if (greetingTimer) clearTimeout(greetingTimer);
  greetingTimer = setTimeout(() => {
    greeting.classList.remove("show");
    setTimeout(() => { greeting.hidden = true; }, 320);
  }, Math.max(2000, Number(g.durationMs) || 4000));
});

// RUN-B B5 - show the "issue resolved | email sent | ticket reference" confirmation DIRECTLY UNDER the globe.
// Renders only what main sent (main already gated it on a real applied+verified resolve + a real send result).
sentinel.onGlobeConfirmation?.((c) => {
  if (!confirmEl || !c || !c.show || !c.text) return;
  confirmEl.textContent = c.text;
  confirmEl.hidden = false;
  void confirmEl.offsetWidth; // reflow so the fade-in runs
  confirmEl.classList.add("show");
  const hide = () => { confirmEl.classList.remove("show"); setTimeout(() => { confirmEl.hidden = true; }, 320); };
  if (confirmTimer) clearTimeout(confirmTimer);
  confirmTimer = setTimeout(hide, Math.max(6000, Number(c.dismissMs) || 9000));
  confirmEl.onclick = () => { if (confirmTimer) clearTimeout(confirmTimer); hide(); };
});

sentinel.onOverlayMode?.((mode) => {
  setMode(mode);
  // If main put us into companion mode (globe click / proactive), make sure the menu is rendered.
  if (mode === "companion") { if (!comp) openCompanion(); }
  else { comp = null; } // leaving companion mode clears the in-memory session (answers never persist)
});

sentinel.onDetection((detection) => {
  currentDetection = detection;
  render(detection);
  setMode("card");
  const target = detection.risk === "red" ? "escalation" : "diagnosing";
  // First detection of the session: a single 300ms attention wiggle, then settle into the state.
  if (!wiggledThisSession) {
    wiggledThisSession = true;
    setGlobeState("attention");
    setTimeout(() => setGlobeState(target), 320);
  } else {
    setGlobeState(target);
  }
});

sentinel.getState().then((state) => {
  const latest = state.detections && state.detections[0];
  if (latest) {
    currentDetection = latest;
    render(latest);
    setGlobeState(latest.risk === "red" ? "escalation" : "diagnosing");
  } else {
    setGlobeState("idle");
  }
});

document.getElementById("overlayGlobe").addEventListener("click", async () => {
  if (currentDetection) {
    setMode("card");
    return;
  }
  // No active detection → open the interactive assistant ("What would you like to do?").
  // main resizes the overlay + sends overlay-mode "companion", which renders the menu via onOverlayMode.
  setGlobeState("listening");
  await sentinel.openCompanion();
});

document.getElementById("overlayDismiss").addEventListener("click", async () => {
  currentDetection = null;
  chip.textContent = "MANUAL MODE";
  title.textContent = "ARIA is watching";
  copy.textContent = "Local self-diagnosis is active.";
  setMode("globe");
  setGlobeState("idle");
  await sentinel.dismissOverlay?.();
});

document.getElementById("overlayFix").addEventListener("click", async () => {
  setGlobeState("fixing");
  if (!currentDetection) {
    const diagnosis = await sentinel.selfDiagnose("overlay");
    chip.textContent = diagnosis.ok ? "SELF-CHECK OK" : "REVIEW";
    title.textContent = "ARIA self-check";
    copy.textContent = diagnosis.ok ? "No local runtime fault is active." : "Open ARIA Sentinel for details.";
    setGlobeState(diagnosis.ok ? "done" : "escalation");
    setTimeout(() => setGlobeState("idle"), 2000);
    return;
  }
  const result = currentDetection.recipeId === "sentinel-self-repair-v1"
    ? await sentinel.selfRepair("overlay")
    : await sentinel.runRecipe(currentDetection.recipeId, { dryRun: true });
  chip.textContent = result.dryRun ? "DRY-RUN COMPLETE" : result.ok ? "DONE" : "REVIEW";
  title.textContent = result.recipe?.title || "ARIA self-repair";
  copy.textContent = result.message || "Self-repair completed.";
  setGlobeState(result.ok ? "done" : "escalation");
  setTimeout(() => setGlobeState("idle"), 2400);
});

function setMode(mode) {
  const showCard = mode === "card";
  const showCompanion = mode === "companion";
  body.classList.toggle("globe-only", !showCard && !showCompanion);
  body.classList.toggle("card-visible", showCard);
  body.classList.toggle("companion-visible", showCompanion);
  card.hidden = !showCard;
  if (companionPanel) companionPanel.hidden = !showCompanion;
  if (showCompanion) setGlobeState("idle");
}

function render(detection) {
  chip.textContent = detection.chip;
  title.textContent = detection.title;
  copy.textContent = detection.summary;
}

// ============================================================================================================
// ARIA COMPANION — the interactive assistant on the globe. Renders ONE card at a time and carries the user's
// answers forward (in-memory only). GUIDE/LEARN CHANGES NOTHING: the only path that touches the machine is the
// Fix flow's "Resolve it for me", which goes through the existing gated pipeline. No account/sign-in/payment is
// ever performed here — `open` steps launch the USER's browser to official sites; the user does the rest.
// ============================================================================================================
let comp = null; // { answers, stack:[view] } — null when the panel is closed

function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
function topView() { return comp && comp.stack[comp.stack.length - 1]; }

function openCompanion() {
  comp = { answers: {}, stack: [{ kind: "menu" }] };
  setMode("companion");
  renderCompanion();
}
function closeCompanion() { comp = null; if (typeof speechSynthesis !== "undefined") { try { speechSynthesis.cancel(); } catch { /* ignore */ } } setGlobeState("idle"); sentinel.showGlobe(); }
function pushView(view) { comp.stack.push(view); renderCompanion(); }
function backView() { if (!comp) return; comp.stack.pop(); if (!comp.stack.length) { closeCompanion(); return; } renderCompanion(); }
function advance(view) { pushView({ kind: "flow", flowId: view.flowId, index: view.index + 1 }); }

companionBackBtn?.addEventListener("click", backView);
companionCloseBtn?.addEventListener("click", closeCompanion);

function renderCompanion() {
  if (!comp || !companionBody) return;
  companionBody.innerHTML = "";
  const view = topView();
  companionBackBtn.hidden = comp.stack.length <= 1;
  if (view.kind === "menu") renderMenu();
  else if (view.kind === "picker") renderPicker(view.group);
  else if (view.kind === "fix") renderFix();
  else if (view.kind === "fix-result") renderFixResult(view); // async; lead/sub are appended synchronously first
  else if (view.kind === "flow") renderFlowStep(view);
  // NARRATION: speak the same visible card text after it renders (guarded + muteable inside narrate()).
  speakCurrentCard();
}

function renderMenu() {
  companionBody.appendChild(el("div", "companion-lead", "What would you like to do?"));
  for (const item of COMPANION_MENU) {
    const b = el("button", "companion-menu-item"); b.type = "button";
    b.appendChild(el("b", null, item.label));
    b.appendChild(el("span", null, item.sub));
    b.addEventListener("click", () => {
      if (item.action === "fix") return pushView({ kind: "fix" });
      if (item.action === "flow-picker") return pushView({ kind: "picker", group: item.group });
      if (item.action === "ask") { sentinel.openMainTab("aria"); return closeCompanion(); }
    });
    companionBody.appendChild(b);
  }
}

function renderPicker(group) {
  companionBody.appendChild(el("div", "companion-lead", group === "setup" ? "Set up an AI tool" : "Learn"));
  companionBody.appendChild(el("div", "companion-sub", group === "setup"
    ? "I'll interview you, then walk you through it. You create the account and pay yourself — I never touch your login or card."
    : "Short, hands-on lessons. Nothing changes on your PC."));
  for (const f of listFlows(group)) {
    const b = el("button", "companion-menu-item"); b.type = "button";
    b.appendChild(el("b", null, f.title));
    if (f.blurb) b.appendChild(el("span", null, f.blurb));
    b.addEventListener("click", () => pushView({ kind: "flow", flowId: f.id, index: 0 }));
    companionBody.appendChild(b);
  }
}

function renderFlowStep(view) {
  const step = flowStep(view.flowId, view.index);
  if (!step) return renderFlowDone();
  const r = resolveStep(step, comp.answers);
  let showNext = true; // choice/confirm advance on their own; a not-ready copy has nothing to proceed to
  const nextBtn = el("button", "cbtn primary"); nextBtn.type = "button";
  nextBtn.textContent = (view.index >= (getFlow(view.flowId).steps.length - 1)) ? "Done" : "Next";

  if (step.type === "display") {
    companionBody.appendChild(el("div", "companion-lead", step.title));
    // compose-backed display: show the live text, or the re-ask body when a required input is still missing.
    companionBody.appendChild(el("div", "companion-sub", r.text != null ? r.text : (step.body || "")));
  } else if (step.type === "input-text") {
    companionBody.appendChild(el("div", "companion-lead", step.title));
    if (step.body) companionBody.appendChild(el("div", "companion-sub", step.body));
    const input = el("input", "companion-input"); input.type = "text"; input.placeholder = step.placeholder || "";
    input.value = comp.answers[step.key] || "";
    input.addEventListener("input", () => { comp.answers[step.key] = input.value; nextBtn.disabled = !input.value.trim(); });
    companionBody.appendChild(input);
    addTapToSpeak(input, companionBody); // optional voice INPUT; hidden gracefully when unavailable
    nextBtn.disabled = !input.value.trim();
    setTimeout(() => input.focus(), 30);
  } else if (step.type === "choice") {
    companionBody.appendChild(el("div", "companion-lead", step.title));
    for (const opt of step.options) {
      const c = el("button", "companion-choice" + (comp.answers[step.key] === opt.value ? " sel" : "")); c.type = "button";
      c.appendChild(el("b", null, opt.label));
      if (opt.sub) c.appendChild(el("span", null, opt.sub));
      c.addEventListener("click", () => { comp.answers[step.key] = opt.value; advance(view); });
      companionBody.appendChild(c);
    }
    // choice advances on selection; only Back is offered here.
    showNext = false;
  } else if (step.type === "copy") {
    companionBody.appendChild(el("div", "companion-lead", step.title));
    if (step.body) companionBody.appendChild(el("div", "companion-sub", step.body));
    if (r.ready && r.text) {
      const block = el("div", "companion-copy", r.text);
      companionBody.appendChild(block);
      const copyBtn = el("button", "cbtn primary"); copyBtn.type = "button"; copyBtn.textContent = "Copy";
      const status = el("div", "companion-status", "");
      copyBtn.addEventListener("click", async () => { const res = await sentinel.copyText(r.text); status.textContent = res && res.ok ? "Copied — paste it into your AI." : "Couldn't copy."; });
      const row = el("div", "companion-actions"); row.appendChild(copyBtn); companionBody.appendChild(row);
      companionBody.appendChild(status);
      if (step.safety) companionBody.appendChild(el("div", "companion-safety", step.safety));
    } else {
      // REAL-OR-EMPTY: a required answer is missing → re-ask, never show a fabricated prompt.
      companionBody.appendChild(el("div", "companion-sub", "Answer the earlier question and I'll build this from your words — I won't make one up."));
      showNext = false;
    }
  } else if (step.type === "open") {
    companionBody.appendChild(el("div", "companion-lead", step.title));
    if (step.body) companionBody.appendChild(el("div", "companion-sub", step.body));
    const openBtn = el("button", "cbtn primary"); openBtn.type = "button"; openBtn.textContent = "Open in my browser";
    const status = el("div", "companion-status", "");
    openBtn.addEventListener("click", async () => { const res = await sentinel.openExternal(step.url); status.textContent = res && res.ok ? "Opened in your browser." : "Couldn't open that link."; });
    const row = el("div", "companion-actions"); row.appendChild(openBtn); companionBody.appendChild(row);
    companionBody.appendChild(status);
    if (step.note) companionBody.appendChild(el("div", "companion-safety", step.note));
  } else if (step.type === "confirm") {
    companionBody.appendChild(el("div", "companion-lead", step.title));
    const row = el("div", "companion-actions");
    const yes = el("button", "cbtn primary"); yes.type = "button"; yes.textContent = (step.yes && step.yes.label) || "Yes";
    const no = el("button", "cbtn ghost"); no.type = "button"; no.textContent = (step.no && step.no.label) || "Not yet";
    yes.addEventListener("click", () => { comp.answers[step.key] = "yes"; if (view.flowId === "learn-loops") { sentinel.openMainTab("aria"); return closeCompanion(); } advance(view); });
    no.addEventListener("click", () => { comp.answers[step.key] = "no"; companionBody.appendChild(el("div", "companion-note", (step.no && step.no.help) || "No problem.")); });
    row.appendChild(yes); row.appendChild(no); companionBody.appendChild(row);
    showNext = false;
  }

  // Shared footer: Back is always available inside a flow; Next only when the step doesn't advance itself.
  const footer = el("div", "companion-actions");
  const backBtn = el("button", "cbtn ghost"); backBtn.type = "button"; backBtn.textContent = "Back";
  backBtn.addEventListener("click", backView);
  if (view.index > 0 || comp.stack.length > 1) footer.appendChild(backBtn);
  if (showNext) { nextBtn.addEventListener("click", () => advance(view)); footer.appendChild(nextBtn); }
  if (footer.childElementCount) companionBody.appendChild(footer);
}

function renderFlowDone() {
  companionBody.appendChild(el("div", "companion-lead", "That's the walk-through."));
  companionBody.appendChild(el("div", "companion-sub", "You can revisit any step from the Walk-through tab, or ask me something else."));
  const row = el("div", "companion-actions");
  const menuBtn = el("button", "cbtn primary"); menuBtn.type = "button"; menuBtn.textContent = "Back to menu";
  menuBtn.addEventListener("click", () => { comp.stack = [{ kind: "menu" }]; renderCompanion(); });
  row.appendChild(menuBtn); companionBody.appendChild(row);
}

function renderFix() {
  companionBody.appendChild(el("div", "companion-lead", "What's the problem?"));
  companionBody.appendChild(el("div", "companion-sub", "Describe it in a few words. I'll guide you or, if it's a vetted fix, resolve it for you (gated — you approve)."));
  const input = el("input", "companion-input"); input.type = "text"; input.placeholder = "e.g. my printer won't print";
  companionBody.appendChild(input);
  addTapToSpeak(input, companionBody); // first walk-through/problem step gets voice INPUT (optional, guarded)
  const status = el("div", "companion-status", "");
  const row = el("div", "companion-actions");
  const backBtn = el("button", "cbtn ghost"); backBtn.type = "button"; backBtn.textContent = "Back"; backBtn.addEventListener("click", backView);
  const go = el("button", "cbtn primary"); go.type = "button"; go.textContent = "Continue"; go.disabled = true;
  input.addEventListener("input", () => { go.disabled = !input.value.trim(); });
  go.addEventListener("click", async () => {
    const intent = input.value.trim(); if (!intent) return;
    status.textContent = "Checking this device…"; go.disabled = true;
    let recipeId = "";
    try { const d = (await sentinel.diagnose(intent)) || {}; recipeId = d.recipeId || (Array.isArray(d.causes) && (d.causes.find((c) => c && c.recipeId) || {}).recipeId) || ""; } catch { /* fall through to guide */ }
    pushView({ kind: "fix-result", recipeId, intent });
  });
  row.appendChild(backBtn); row.appendChild(go); companionBody.appendChild(row); companionBody.appendChild(status);
  setTimeout(() => input.focus(), 30);
}

async function renderFixResult(view) {
  companionBody.appendChild(el("div", "companion-lead", view.recipeId ? "I found a matching fix" : "Let's walk through it"));
  companionBody.appendChild(el("div", "companion-sub", view.recipeId
    ? "Choose how you want to handle it. Walk-through changes nothing; Resolve is gated (you approve, with a countdown and one-click stop)."
    : "I don't have an automatic fix for this yet — I'll open the step-by-step walk-through so you're never stuck."));
  const status = el("div", "companion-status", "");
  const row = el("div", "companion-actions");
  const backBtn = el("button", "cbtn ghost"); backBtn.type = "button"; backBtn.textContent = "Back"; backBtn.addEventListener("click", backView);
  const walk = el("button", "cbtn ghost"); walk.type = "button"; walk.textContent = "Walk me through it";
  walk.addEventListener("click", async () => { await sentinel.openWalkthrough({ recipeId: view.recipeId, intent: view.intent }); closeCompanion(); });
  row.appendChild(backBtn); row.appendChild(walk);

  // "Resolve it for me" only when the recipe is a vetted/bound Tier-0 action; otherwise Walk-through only.
  let vetted = false;
  if (view.recipeId) { try { vetted = Boolean((await sentinel.isVettedRecipe(view.recipeId))?.vetted); } catch { vetted = false; } }
  if (vetted) {
    const resolve = el("button", "cbtn primary"); resolve.type = "button"; resolve.textContent = "Resolve it for me";
    resolve.addEventListener("click", async () => {
      status.textContent = "Starting the gated fix…";
      const r = await sentinel.supervisedFix({ recipeId: view.recipeId, mode: "confirmed" });
      if (!r || r.ok === false) status.textContent = r?.error === "r11_blocked" ? "1 personal folder excluded." : r?.verdict === "veto" ? "Held by the safety supervisor." : "Couldn't start the fix.";
      else if (r.countdown) status.textContent = `Applying in ${r.seconds || 10}s — cancel from the countdown, or Ctrl+Alt+K to abort.`;
      else status.textContent = r.policy && r.policy.dryRun === false ? "Fix applied (reversible)." : "Previewed safely (dry-run).";
    });
    row.appendChild(resolve);
  } else if (view.recipeId) {
    companionBody.appendChild(el("div", "companion-note", "I can't safely auto-apply this one yet — here are the exact steps instead."));
  }
  companionBody.appendChild(row); companionBody.appendChild(status);
}
