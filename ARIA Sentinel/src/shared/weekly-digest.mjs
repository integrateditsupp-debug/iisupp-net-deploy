// weekly-digest — aggregates a week of telemetry-event-v1 records into the "ARIA this week" email.
// PURE: aggregation math + HTML render, no I/O. The netlify function feeds it content-blind events
// and hands the HTML to Resend. No PII can enter because the inputs are already telemetry-events.
import { isTelemetrySafe } from "./telemetry-event.mjs";

// Rough minutes-saved-per-fix by tier (a fix a tech didn't have to do). Conservative defaults.
const MINUTES_PER_FIX = { green: 12, yellow: 25 };

/**
 * Aggregate a week's events for one customer.
 * @param {Array} events telemetry-event-v1 records (only content-blind ones are counted)
 * @returns {{fixes,escalations,uptimeMinutes,top3:[{recipeId,count}],endpoints}}
 */
export function aggregateWeek(events = []) {
  const safe = (Array.isArray(events) ? events : []).filter(isTelemetrySafe);
  const applied = safe.filter((e) => e.outcome === "applied" || e.outcome === "confirmed");
  const escalations = safe.filter((e) => e.outcome === "escalated").length;
  const byRecipe = new Map();
  const endpoints = new Set();
  let uptimeMinutes = 0;
  for (const e of applied) {
    byRecipe.set(e.recipeId, (byRecipe.get(e.recipeId) || 0) + 1);
    if (e.endpoint) endpoints.add(e.endpoint);
    uptimeMinutes += MINUTES_PER_FIX[e.tier] || MINUTES_PER_FIX.green;
  }
  const top3 = [...byRecipe.entries()]
    .map(([recipeId, count]) => ({ recipeId, count }))
    .sort((a, b) => b.count - a.count || a.recipeId.localeCompare(b.recipeId))
    .slice(0, 3);
  return { fixes: applied.length, escalations, uptimeMinutes, top3, endpoints: endpoints.size };
}

export function renderDigestHtml(agg, meta = {}) {
  const hoursSaved = (agg.uptimeMinutes / 60).toFixed(1);
  const week = esc(meta.weekOf || "this week");
  const tenant = esc(meta.tenant || "your fleet");
  const rows = (agg.top3.length ? agg.top3 : [{ recipeId: "—", count: 0 }])
    .map((r) => `<tr><td style="padding:4px 10px">${esc(r.recipeId)}</td><td style="padding:4px 10px;text-align:right">${r.count}</td></tr>`)
    .join("");
  return `<!doctype html><html><body style="font-family:system-ui,Segoe UI,sans-serif;background:#0a0a0a;color:#f5f5f5;margin:0;padding:24px">
  <h1 style="font-size:20px;margin:0 0 4px">ARIA Sentinel — this week</h1>
  <p style="color:#9a9a9a;margin:0 0 18px">${tenant} · week of ${week}</p>
  <table style="border-collapse:collapse;margin-bottom:18px">
    <tr><td style="padding:6px 18px 6px 0;color:#9a9a9a">Issues fixed</td><td style="font-size:22px;color:#7afbff"><b>${agg.fixes}</b></td></tr>
    <tr><td style="padding:6px 18px 6px 0;color:#9a9a9a">Time saved</td><td style="font-size:22px;color:#c5a059"><b>~${esc(hoursSaved)} hrs</b></td></tr>
    <tr><td style="padding:6px 18px 6px 0;color:#9a9a9a">Endpoints helped</td><td style="font-size:22px"><b>${agg.endpoints}</b></td></tr>
    <tr><td style="padding:6px 18px 6px 0;color:#9a9a9a">Escalated to a human</td><td style="font-size:22px"><b>${agg.escalations}</b></td></tr>
  </table>
  <h2 style="font-size:14px;color:#9a9a9a;margin:0 0 6px">Top fixes</h2>
  <table style="border-collapse:collapse;border:1px solid rgba(197,160,89,.3)"><tr><th style="text-align:left;padding:4px 10px;color:#9a9a9a">Recipe</th><th style="text-align:right;padding:4px 10px;color:#9a9a9a">Count</th></tr>${rows}</table>
  <p style="color:#6a6a6a;font-size:12px;margin-top:20px">Content-blind summary. No page content, file names or user data is included.</p>
  </body></html>`;
}

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
