// RUN 23 §3 — contextual status panel that opens downward from the floating globe. Pure HTML-string builder
// (`buildStatusPanel`) so it is unit-testable + content-blind; the renderer calls `bindStatusPanel` to wire
// clicks. Sections render ONLY when populated: Status hero · Frozen · High CPU · High RAM · Odd · Footer.
// Empty state: "All clear · {N} events scanned · CPU {X}% · RAM {Y}%". Every button is CSP-safe (no inline
// handlers — data-* attributes + addEventListener) and routes to window.sentinelBridge.runRecipe({recipeId,
// processName, pid}). 🔒 R11 — every interpolated value is redactPrivate + HTML-escaped, so an off-limits
// path can never render.
import { redactPrivate } from "../shared/path-guard.mjs";
import { recommendAction } from "../shared/recommend-action.mjs";

const esc = (v) => redactPrivate(String(v == null ? "" : v)).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : "—");

function actionButton(rec, finding) {
  if (rec.action === "info" || rec.action === "none") return "";
  const recipeId = esc(rec.recipeId || rec.action);
  const pname = esc(finding.name || finding.service || "");
  const pid = Number.isFinite(finding.pid) ? String(finding.pid) : "";
  const label = rec.action === "end-task" ? "End task" : rec.action === "investigate" ? "Investigate" : "Run fix";
  // CSP-safe: data-* only; bindStatusPanel() attaches the click → window.sentinelBridge.runRecipe(...).
  return `<button class="sp-btn sp-risk-${esc(rec.risk)}" data-action="runRecipe" data-recipe="${recipeId}" data-pname="${pname}" data-pid="${pid}">${esc(label)}</button>`;
}

function row(finding, meta) {
  const rec = recommendAction(finding);
  // 🔒 R11 — a blocked finding surfaces the standard exclusion notice (never the path) and no action.
  if (rec.action === "none") {
    return `<div class="sp-row sp-row-excluded"><div class="sp-row-main"><span class="sp-name">${esc(rec.label)}</span></div></div>`;
  }
  return `<div class="sp-row"><div class="sp-row-main"><span class="sp-name">${esc(finding.name || finding.service || "process")}</span>` +
    `<span class="sp-meta">${esc(meta)}</span></div>${actionButton(rec, finding)}</div>`;
}

function section(title, rows) {
  if (!rows.length) return "";
  return `<div class="sp-section"><div class="sp-h">${esc(title)}</div>${rows.join("")}</div>`;
}

/**
 * Build the panel inner HTML. `data = { snapshot, cpu, ram, services }` where snapshot is a process-health
 * snapshot (D1), cpu/ram are overall percentages for the empty-state subline, services is a stopped-service
 * list. Returns a CSP-safe HTML fragment for `#globeStatusPanel`.
 */
export function buildStatusPanel(data = {}) {
  const s = data.snapshot || {};
  const frozen = s.frozen || [];
  const cpuHogs = s.cpuHogs || [];
  const ramHogs = s.ramHogs || [];
  const odd = s.odd || [];
  const services = data.services || [];
  const total = frozen.length + cpuHogs.length + ramHogs.length + odd.length + services.length;

  const hero = total
    ? `<div class="sp-hero sp-hero-alert"><span class="sp-dot"></span>${total} system issue${total > 1 ? "s" : ""} · click for detail</div>`
    : `<div class="sp-hero sp-hero-clear"><span class="sp-dot"></span>All clear · ${pct(s.scanned)} events scanned · CPU ${pct(data.cpu)}% · RAM ${pct(data.ram)}%</div>`;

  const body = [
    section("Frozen", frozen.map((f) => row({ type: "frozen", ...f }, `not responding ${Math.round((f.since_ms || 0) / 1000)}s`))),
    section("High CPU", cpuHogs.map((f) => row({ type: "cpu-hog", ...f }, `${pct(f.cpu)}% CPU`))),
    section("High RAM", ramHogs.map((f) => row({ type: "ram-hog", ...f }, `${pct(f.ramMB)} MB`))),
    section("Odd", odd.map((f) => row({ type: "odd", ...f }, f.reason || "unusual"))),
    section("Stopped services", services.map((sv) => row({ type: "service-stopped", ...sv }, "stopped")))
  ].join("");

  return `<div class="sp-wrap">${hero}${body}<div class="sp-foot">ARIA Sentinel · supervised · every fix is reviewed before it runs</div></div>`;
}

/**
 * Wire panel buttons to the bridge (renderer-side, CSP-safe). Every `[data-action="runRecipe"]` button
 * dispatches window.sentinelBridge.runRecipe({recipeId, processName, pid}). Defensive so it no-ops in Node.
 */
export function bindStatusPanel(root, bridge) {
  const b = bridge || (typeof window !== "undefined" ? window.sentinelBridge : null);
  if (!root || typeof root.querySelectorAll !== "function" || !b || typeof b.runRecipe !== "function") return 0;
  const btns = root.querySelectorAll('[data-action="runRecipe"]');
  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const pidRaw = btn.getAttribute("data-pid");
      b.runRecipe({
        recipeId: btn.getAttribute("data-recipe") || "",
        processName: btn.getAttribute("data-pname") || "",
        pid: pidRaw ? Number(pidRaw) : null
      });
    });
  });
  return btns.length;
}
