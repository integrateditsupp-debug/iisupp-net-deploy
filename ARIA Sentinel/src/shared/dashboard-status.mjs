// RUN 22 §1 — dashboard hero status + inline-SVG sparklines + delta arrows. Pure + node-safe; the
// status is driven by the four trust sources (audit integrity · privacy verifier · Tier-0 safety gate ·
// heartbeat health) — never a cosmetic guess.

export const STATUS = {
  protected: { level: "protected", color: "#7afbff", emoji: "🟢", label: "PROTECTED" },
  attention: { level: "attention", color: "#ffcb6b", emoji: "🟡", label: "ATTENTION" },
  critical: { level: "critical", color: "#ff7e7e", emoji: "🔴", label: "ACTION REQUIRED" }
};

/**
 * Single posture indicator (SentinelOne pattern). A security guarantee failing (audit tamper or a
 * privacy/sanitization failure) is CRITICAL; an operational degradation (Tier-0 gate or heartbeat) is
 * ATTENTION; all clear is PROTECTED.
 */
export function computeHeroStatus({ auditOk = true, privacyOk = true, tier0Ok = true, heartbeatOk = true } = {}) {
  if (auditOk === false || privacyOk === false) return STATUS.critical;
  if (tier0Ok === false || heartbeatOk === false) return STATUS.attention;
  return STATUS.protected;
}

/** Hero sub-line copy. */
export function heroSubline({ eventsToday = 0, threats = 0, lastSyncAgo = "just now" } = {}) {
  return `ARIA is watching · ${eventsToday} events scanned · ${threats} threats blocked · last sync ${lastSyncAgo}`;
}

/** Direction + magnitude of a KPI vs the prior period. */
export function deltaArrow(cur, prev) {
  const c = Number(cur) || 0, p = Number(prev) || 0;
  if (p === 0 && c === 0) return { dir: "flat", symbol: "→", pct: 0 };
  const change = p === 0 ? 100 : ((c - p) / Math.abs(p)) * 100;
  const rounded = Math.round(change * 10) / 10;
  if (Math.abs(rounded) < 0.05) return { dir: "flat", symbol: "→", pct: 0 };
  return rounded > 0 ? { dir: "up", symbol: "▲", pct: rounded } : { dir: "down", symbol: "▼", pct: rounded };
}

/** Inline SVG sparkline (no chart lib). Returns a self-contained <svg> string. */
export function sparklineSvg(values = [], { width = 96, height = 24, color = "#c5a059" } = {}) {
  const xs = (values || []).map(Number).filter(Number.isFinite);
  if (xs.length < 2) return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true"></svg>`;
  const min = Math.min(...xs), max = Math.max(...xs), span = max - min || 1;
  const stepX = width / (xs.length - 1);
  const pts = xs.map((v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - min) / span) * (height - 2) - 1).toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true"><polyline fill="none" stroke="${color}" stroke-width="1.5" points="${pts}" /></svg>`;
}

/** Build one KPI tile descriptor (rendered by dashboard.mjs). */
export function kpiTile({ id, label, value, unit = "", values = [], prev = null } = {}) {
  return { id, label, value, unit, sparkline: sparklineSvg(values), delta: prev == null ? null : deltaArrow(value, prev) };
}

/** The six hero tiles from live state (Overview ROW 2).
 *  RULE 14 (A1): a null metric means "no data yet" and renders as "—" (no unit, no delta) — never a
 *  fabricated 100/0. Real values render normally. */
export function heroTiles(m = {}) {
  const t = (id, label, value, unit = "", values = [], prev = null) =>
    kpiTile({ id, label, value: value == null ? "—" : value, unit: value == null ? "" : unit, values, prev: value == null ? null : prev });
  return [
    t("status", "Uptime (7d)", m.uptime7d, "%", m.uptimeTrend, m.uptimePrev),
    t("mttr", "MTTR (min, 30d)", m.mttr, "", m.mttrTrend, m.mttrPrev),
    t("accuracy", "Diagnosis accuracy", m.accuracy, "%", m.accuracyTrend, m.accuracyPrev),
    t("breaches", "SLA breaches MTD", m.breaches, "", m.breachTrend, m.breachPrev),
    t("hours", "Hours saved MTD", m.hoursSaved, "", m.hoursTrend, m.hoursPrev),
    kpiTile({ id: "update", label: "Version", value: m.version || "0.1.0", unit: m.updatePending ? " · update ready" : "" })
  ];
}
