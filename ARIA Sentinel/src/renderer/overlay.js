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
  onGreeting: () => {}
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

sentinel.onOverlayMode?.((mode) => {
  setMode(mode);
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
  setGlobeState("listening");
  setTimeout(() => setGlobeState("idle"), 2400);
  await sentinel.showGlobe();
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
  body.classList.toggle("globe-only", !showCard);
  body.classList.toggle("card-visible", showCard);
  card.hidden = !showCard;
}

function render(detection) {
  chip.textContent = detection.chip;
  title.textContent = detection.title;
  copy.textContent = detection.summary;
}
