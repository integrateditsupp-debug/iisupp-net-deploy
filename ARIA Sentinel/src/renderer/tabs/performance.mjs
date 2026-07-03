// RUN 22 §2 — Performance tab: pure HTML builders for operational + AI + usage sections. 🔒 R11-safe.
import { esc, tileHtml } from "./dashboard.mjs";
import { sparklineSvg } from "../../shared/dashboard-status.mjs";

export function operationalTilesHtml(m = {}) {
  return [
    tileHtml({ id: "mttd", label: "MTTD (min)", value: m.mttd, values: m.detTrend }),
    tileHtml({ id: "mttr", label: "MTTR (min)", value: m.mttr, values: m.mttrTrend }),
    tileHtml({ id: "ftr", label: "First-touch resolution", value: m.ftr, unit: "%" }),
    tileHtml({ id: "auto", label: "Auto-resolved", value: m.autoPct, unit: "%" }),
    tileHtml({ id: "recipe", label: "Recipe success", value: m.recipeSuccess, unit: "%" }),
    tileHtml({ id: "detday", label: "Detections/day", value: (m.detTrend || []).slice(-1)[0] ?? 0, values: m.detTrend })
  ].join("");
}

export function aiTilesHtml(m = {}) {
  return [
    tileHtml({ id: "accuracy", label: "Diagnosis accuracy", value: m.accuracy, unit: "%", values: m.accuracyTrend }),
    tileHtml({ id: "calibration", label: "Confidence calibration", value: m.calibration, unit: "/100" }),
    tileHtml({ id: "confirm", label: "User confirmation", value: m.confirmRate, unit: "%" }),
    tileHtml({ id: "kbhit", label: "KB hit rate", value: m.kbHitRate, unit: "%" }),
    tileHtml({ id: "top3", label: "Fuzzy top-3 accuracy", value: m.top3, unit: "%" }),
    tileHtml({ id: "hours", label: "Hours saved (MTD)", value: m.hoursSaved }),
    tileHtml({ id: "cost", label: "Cost saved (MTD)", value: m.costSaved == null ? null : `$${m.costSaved}` }),
    tileHtml({ id: "anomaly", label: "Anomalies surfaced", value: m.anomalies ?? 0 })
  ].join("");
}

export function usageHtml(u = {}) {
  const rows = [
    ["Ask ARIA questions", u.asks ?? 0],            // D2 — real local usage
    ["Answered from KB ($0)", u.kbHits ?? 0],       // D2
    ["Active today (hrs)", u.activeToday ?? 0],
    ["Active this week (hrs)", u.activeWeek ?? 0],
    ["Top recipe tier", u.topTier || "tier-0"],
    ["Hotkey invocations (30d)", u.hotkeys ?? 0]
  ];
  return rows.map(([label, value]) => `<div class="health-row"><span>${esc(label)}</span><strong>${esc(value)}</strong><em></em></div>`).join("");
}

export { sparklineSvg };
