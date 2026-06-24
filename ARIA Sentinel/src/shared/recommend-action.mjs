// RUN 23 §2 — findings → action mapper. Pure + node-safe: a single process/service finding (or a whole
// process-health snapshot) maps to a per-finding recommendation {action,label,risk,confirmRequired,
// recipeId?}. It points at the RUN 20 Tier-0 catalog where a vetted recipe exists; otherwise it proposes a
// generic, confirm-required, manual action. DRY-RUN safe BY DESIGN — this module NEVER executes anything;
// it only describes the safest next step for the supervisor (D5) + 10s countdown (D4) to evaluate.
// 🔒 R11 — every label is run through redactPrivate; a finding that references the off-limits private
// folder yields a no-op "1 personal folder excluded" card and never an executable action.
import { redactPrivate, isBlockedPath } from "./path-guard.mjs";
import { recipes } from "../main/recipes/tier-0/catalog.mjs";

// Stopped-service → vetted Tier-0 restart recipe (keys are lower-cased Windows service short names).
const SERVICE_RECIPE = {
  spooler: "restart-print-spooler",
  wsearch: "restart-windows-search",
  audiosrv: "restart-audio-service",
  audioendpointbuilder: "restart-audio-service"
};

const safe = (s) => redactPrivate(String(s == null ? "" : s));

/** Risk derived from the catalog flags: reboot → high, read-only → low, Stop/Start-Service → medium. */
export function riskOfRecipe(recipeId) {
  const r = recipes[recipeId];
  if (!r) return "medium"; // unmapped / generic action — treat as medium until vetted
  if (r.requiresReboot) return "high";
  if (r.readOnly) return "low";
  return "medium";
}

const lowRisk = (action, label, recipeId, extra = {}) =>
  ({ action, label, risk: "low", confirmRequired: false, recipeId: recipeId || null, ...extra });

/** Map ONE finding to a recommendation. Never throws; unknown types fall back to a passive info card. */
export function recommendAction(finding = {}) {
  // 🔒 R11 — any off-limits reference short-circuits to a passive, non-executable card.
  if (isBlockedPath(finding.name) || isBlockedPath(finding.service) || isBlockedPath(finding.path)) {
    return { action: "none", label: "1 personal folder excluded", risk: "low", confirmRequired: false, recipeId: null };
  }
  const name = safe(finding.name || finding.service || "process");
  const pid = Number.isFinite(finding.pid) ? finding.pid : null;
  switch (String(finding.type || "")) {
    case "frozen":
      // Ending a not-responding UI app is low-risk — bypasses the countdown (executes immediately).
      return lowRisk("end-task", `End “${name}” (not responding)`, null, { pid });
    case "cpu-hog":
      return lowRisk("investigate", `Review high-CPU process “${name}”`, "list-startup-impact", { pid });
    case "ram-hog":
      return lowRisk("investigate", `Review high-memory process “${name}”`, "list-startup-impact", { pid });
    case "odd":
      return lowRisk("info", `Unusual process “${name}” — monitoring`, null, { pid });
    case "network-down":
      return { action: "restart-service", label: "Reset network stack (reboot required)", risk: riskOfRecipe("reset-network-stack"), confirmRequired: true, recipeId: "reset-network-stack" };
    case "service-stopped": {
      const key = String(finding.service || finding.name || "").toLowerCase();
      const recipeId = SERVICE_RECIPE[key] || null;
      const label = recipeId ? recipes[recipeId].title : `Restart “${name}” service (manual review)`;
      return { action: "restart-service", label, risk: riskOfRecipe(recipeId), confirmRequired: true, recipeId, service: key || null };
    }
    default:
      return lowRisk("info", `Observed “${name}”`, null, { pid });
  }
}

/** Flatten a process-health snapshot (+ optional stopped-service list) into a flat finding list. */
export function snapshotFindings(snapshot = {}, services = []) {
  const out = [];
  for (const f of snapshot.frozen || []) out.push({ type: "frozen", ...f });
  for (const f of snapshot.cpuHogs || []) out.push({ type: "cpu-hog", ...f });
  for (const f of snapshot.ramHogs || []) out.push({ type: "ram-hog", ...f });
  for (const f of snapshot.odd || []) out.push({ type: "odd", ...f });
  for (const s of services || []) out.push({ type: "service-stopped", ...s });
  return out;
}

/** snapshot → array of {finding, ...recommendation}. */
export function recommendActions(snapshot = {}, services = []) {
  return snapshotFindings(snapshot, services).map((finding) => ({ finding, ...recommendAction(finding) }));
}
