// RUN 22 §1 — Overview/Dashboard tab: pure HTML builders (node-safe + testable). 🔒 R11: every displayed
// string is run through redactPrivate so the private folder can never surface in a tile/activity row.
import { sparklineSvg, deltaArrow } from "../../shared/dashboard-status.mjs";
import { redactPrivate } from "../../shared/path-guard.mjs";

export const esc = (v) => redactPrivate(String(v == null ? "" : v)).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function tileHtml(t = {}) {
  const d = t.delta;
  const deltaSpan = d ? `<span class="kpi-delta ${d.dir}">${d.symbol} ${Math.abs(d.pct)}%</span>` : "<span></span>";
  return `<div class="kpi-tile" data-kpi="${esc(t.id || "")}"><div class="kpi-value">${esc(t.value)}${esc(t.unit || "")}</div><div class="kpi-label">${esc(t.label)}</div><div class="kpi-foot">${t.sparkline || sparklineSvg(t.values || [])}${deltaSpan}</div></div>`;
}
export function tilesHtml(tiles = []) { return (tiles || []).map(tileHtml).join(""); }

export function activityHtml(events = []) {
  const rows = (events || []).slice(0, 10).map((e) =>
    `<div class="activity-row" data-deeplink="${esc(e.tab || "")}"><span class="act-time">${esc(e.time || "")}</span><span>${esc(e.icon || "•")}</span><strong>${esc(e.text || "")}</strong><em>${esc(e.status || "")}</em></div>`
  ).join("");
  return rows || `<div class="activity-row"><span class="act-time">--</span><span>·</span><strong>No activity yet.</strong><em></em></div>`;
}

export function pendingHtml(actions = []) {
  return (actions || []).map((a) =>
    `<div class="pending-card" data-deeplink="${esc(a.tab || "")}"><span>${esc(a.text || "")}</span><strong>${esc(a.cta || "Open")}</strong></div>`
  ).join("");
}

/** Map a raw transparency-log entry to an activity row (icon + deep-link tab by tag). */
export function eventToActivity(entry = {}) {
  const tag = String(entry.tag || "LOG");
  const icon = { "RUN": "🔧", "DIAGNOSE": "🩺", "UPDATE": "🔄", "SECURITY": "🛡", "HEARTBEAT": "💓", "KILL-SWITCH": "🛑", "SELF-HEAL": "🩹" }[tag] || "•";
  const tab = { "DIAGNOSE": "mode", "UPDATE": "about", "SECURITY": "compliance", "RUN": "recipes" }[tag] || "overview";
  const time = entry.ts ? new Date(entry.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  return { time, icon, text: `${tag}: ${entry.text || ""}`, status: "✓", tab };
}
export { deltaArrow };
