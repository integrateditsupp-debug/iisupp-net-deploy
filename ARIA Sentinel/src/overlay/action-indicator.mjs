// RUN 23 §4 — action-indicator banner that renders in a separate frameless Electron window anchored below
// the floating globe. Pure HTML-string builder (`buildIndicator`) + CSP-safe `bindIndicator` (data-* +
// addEventListener, no inline handlers). Shows "RUNNING: <recipe> (8s)" with a live ⏹ ABORT button that
// aborts the pending countdown (same effect as Ctrl+Alt+K). 🔒 R11 — the recipe id is redactPrivate-escaped.
import { redactPrivate } from "../shared/path-guard.mjs";
import { countdownBannerText } from "../main/action-countdown.mjs";

const esc = (v) => redactPrivate(String(v == null ? "" : v)).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Build the banner inner HTML for {recipeId, remaining, risk}. */
export function buildIndicator(data = {}) {
  const risk = ["low", "medium", "high"].includes(data.risk) ? data.risk : "medium";
  const text = countdownBannerText(data.recipeId, Number.isFinite(data.remaining) ? data.remaining : 0);
  return `<div class="ai-banner ai-risk-${esc(risk)}">` +
    `<span class="ai-pulse"></span>` +
    `<span class="ai-text">${esc(text)}</span>` +
    `<button class="ai-abort" data-action="abort">⏹ ABORT</button>` +
    `</div>`;
}

/** Wire the ABORT button → bridge.abortCountdown(). CSP-safe; no-ops in Node. */
export function bindIndicator(root, bridge) {
  const b = bridge || (typeof window !== "undefined" ? window.sentinelBridge : null);
  if (!root || typeof root.querySelector !== "function" || !b || typeof b.abortCountdown !== "function") return false;
  const btn = root.querySelector('[data-action="abort"]');
  if (!btn) return false;
  btn.addEventListener("click", () => b.abortCountdown());
  return true;
}
