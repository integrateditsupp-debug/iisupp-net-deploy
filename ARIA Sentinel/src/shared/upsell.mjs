// RUN 23e — pure upsell logic for the Personal tier. No DOM, no I/O: the renderer/overlay own the
// surface, this owns the throttle + copy so it is unit-testable. 🔒 R11 — text + timers only.

// Don't spam: a given detection class triggers the chat upsell at most once every 7 days.
export const UPSELL_THROTTLE_MS = 7 * 24 * 60 * 60 * 1000;

// Detection class → the chat nudge shown when Personal hits an issue Confirmed/Autonomous would auto-fix.
const DETECTION_COPY = {
  "service-stopped": "⚡ Autonomous mode could have restarted that stopped service automatically — upgrade to Pro to enable auto-fix.",
  "network": "⚡ Autonomous mode could have flushed DNS and recovered the network on its own — upgrade to Pro to enable auto-fix.",
  "disk-low": "⚡ Confirmed mode could have cleared that space the moment you approved — upgrade to Pro to enable one-tap fixes.",
  "cache-stale": "⚡ Autonomous mode could have cleared that stale cache automatically — upgrade to Pro to enable auto-fix.",
  "default": "⚡ Confirmed & Autonomous modes could have fixed that for you — upgrade to Pro to enable auto-fix."
};

/** The chat upsell line for a detection class (falls back to a generic line). */
export function upsellMessageFor(detectionClass) {
  return DETECTION_COPY[String(detectionClass || "").toLowerCase()] || DETECTION_COPY.default;
}

/**
 * Should we show the detection upsell now? True only when this class hasn't fired within the throttle
 * window. `seen` is a plain { className: lastShownEpochMs } map (persisted by the caller).
 */
export function shouldUpsell(detectionClass, seen = {}, now = Date.now()) {
  const cls = String(detectionClass || "").trim();
  if (!cls) return false;
  const last = Number((seen || {})[cls] || 0);
  return !(last > 0) || (now - last) >= UPSELL_THROTTLE_MS;
}

// Estimated hours Pro's auto-fix would have saved this month, given N manual fixes (~45 min each on
// Personal vs. near-instant auto-apply). Returns the saved-hours estimate (>=0).
export function estimatedHoursSaved(manualFixes, minutesPerFix = 45) {
  const fixes = Math.max(0, Number(manualFixes) || 0);
  return Math.round((fixes * minutesPerFix / 60) * 10) / 10;
}

/**
 * The monthly About-tab nudge. Returns null below a small threshold (don't nag for 1-2 fixes), else a
 * sentence quantifying the manual time spent + what Pro would have saved.
 */
export function aboutNudge(manualFixes, { minimumFixes = 5, minutesPerFix = 45 } = {}) {
  const fixes = Math.max(0, Number(manualFixes) || 0);
  if (fixes < minimumFixes) return null;
  const spent = estimatedHoursSaved(fixes, minutesPerFix);
  const saved = Math.max(0, Math.round((spent * 0.8) * 10) / 10); // Pro auto-applies ~80% hands-free
  return `You've spent ~${spent}h on manual fixes this period — Pro would have saved you ~${saved}h with Confirmed & Autonomous auto-fix.`;
}
