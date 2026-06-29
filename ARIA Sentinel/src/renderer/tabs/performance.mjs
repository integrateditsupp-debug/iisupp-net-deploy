// RUN 22 S2 -- Performance tab: pure HTML builders for operational + AI + usage sections. R11-safe.
// A1 (RULE 14): null metrics -> "--" empty-state, never 0/100/derived. mv() enforces this contract.
import { esc, tileHtml } from "./dashboard.mjs";
import { sparklineSvg } from "../../shared/dashboard-status.mjs";

/** RULE 14 helper: null -> empty-state "--" (no unit). Real value -> pass through with unit. */
const mv = (v, unit = "", values = []) => ({ value: v == null ? "--" : v, unit: v == null ? "" : unit, values: v == null ? [] : values });

export function operationalTilesHtml(m = {}) {
  const lastDet = (m.detTrend || []).slice(-1)[0];
  return [
    tileHtml({ id: "mttd",   label: "MTTD (min)",            ...mv(m.mttd,          "",  m.detTrend) }),
    tileHtml({ id: "mttr",   label: "MTTR (min)",            ...mv(m.mttr,          "",  m.mttrTrend) }),
    tileHtml({ id: "ftr",    label: "First-touch resolution",...mv(m.ftr,           "%") }),
    tileHtml({ id: "auto",   label: "Auto-resolved",         ...mv(m.autoPct,       "%") }),
    tileHtml({ id: "recipe", label: "Recipe success",        ...mv(m.recipeSuccess, "%") }),
    tileHtml({ id: "detday", label: "Detections/day",        ...mv(lastDet == null ? null : lastDet, "", m.detTrend) })
  ].join("");
}

export function aiTilesHtml(m = {}) {
  return [
    tileHtml({ id: "accuracy",    label: "Diagnosis accuracy",     ...mv(m.accuracy,    "%",    m.accuracyTrend) }),
    tileHtml({ id: "calibration", label: "Confidence calibration", ...mv(m.calibration, "/100") }),
    tileHtml({ id: "confirm",     label: "User confirmation",      ...mv(m.confirmRate, "%") }),
    tileHtml({ id: "kbhit",       label: "KB hit rate",            ...mv(m.kbHitRate,   "%") }),
    tileHtml({ id: "top3",        label: "Fuzzy top-3 accuracy",   ...mv(m.top3,        "%") }),
    tileHtml({ id: "hours",       label: "Hours saved (MTD)",      ...mv(m.hoursSaved) }),
    tileHtml({ id: "cost",        label: "Cost saved (MTD)",       value: m.costSaved == null ? "--" : "$" + m.costSaved, unit: "" }),
    tileHtml({ id: "anomaly",     label: "Anomalies surfaced",     value: m.anomalies ?? 0 })
  ].join("");
}

export function usageHtml(u = {}) {
  const rows = [
    ["Active today (hrs)", u.activeToday ?? 0],
    ["Active this week (hrs)", u.activeWeek ?? 0],
    ["Top recipe tier", u.topTier || "tier-0"],
    ["Hotkey invocations (30d)", u.hotkeys ?? 0]
  ];
  return rows.map(([label, value]) => `<div class="health-row"><span>${esc(label)}</span><strong>${esc(value)}</strong><em></em></div>`).join("");
}

export { sparklineSvg };
