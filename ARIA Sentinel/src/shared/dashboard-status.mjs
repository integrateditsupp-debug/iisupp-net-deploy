// RUN 22 §1 — dashboard hero status + inline-SVG sparklines + delta arrows. Pure + node-safe; the
// status is driven by the four trust sources (audit integrity · privacy verifier · Tier-0 safety gate ·
// heartbeat health) — never a cosmetic guess.

export const STATUS = {
  protected: { level: "protected", color: "#7afbff", emoji: "🟢", label: "PROTECTED" },
  attention: { level: "attention", color: "#ffcb6b", emoji: "🟡", label: "ATTENTION" },
  critical: { level: "critical", color: "#ff7e7e", emoji: "🔴", label: "ACTION REQUIRED" },
  // PROD 2026-10-14 (audit R9) — the run state is part of the truth: a stopped / killed agent is not "PROTECTED".
  stopped: { level: "stopped", color: "#8f8f8f", emoji: "⚪", label: "STOPPED" },
  paused: { level: "paused", color: "#ffcb6b", emoji: "⏸", label: "PAUSED" }
};

/**
 * Single posture indicator (SentinelOne pattern). A security guarantee failing (audit tamper or a
 * privacy/sanitization failure) is CRITICAL; an operational degradation (Tier-0 gate or heartbeat) is
 * ATTENTION; all clear is PROTECTED. (R9) `running:false` (Stop ARIA / kill switch) is STOPPED and
 * `paused:true` is PAUSED — a security failure still outranks both, because it is still true while stopped.
 */
export function computeHeroStatus({ auditOk = true, privacyOk = true, tier0Ok = true, heartbeatOk = true, running = true, paused = false } = {}) {
  if (auditOk === false || privacyOk === false) return STATUS.critical;
  if (running === false) return STATUS.stopped;
  if (paused === true) return STATUS.paused;
  if (tier0Ok === false || heartbeatOk === false) return STATUS.attention;
  return STATUS.protected;
}

/**
 * The run state the top bar + hero describe (R9): stopped (Stop ARIA), killed (Ctrl+Alt+K / control-plane kill),
 * paused (Pause 1 hour / 24h hotkey), self-repair (bridge conflict), else watching. Pure.
 */
export function computeRunState({ ariaStopped = false, killed = false, killedLocal = false, paused = false, bridgeConflict = false } = {}) {
  if (killedLocal) return { id: "killed", running: false, label: "stopped by kill switch", hint: "Press Start ARIA to resume watching." };
  if (ariaStopped) return { id: "stopped", running: false, label: "stopped", hint: "Press Start ARIA to resume watching." };
  if (killed) return { id: "killed", running: false, label: "fixes stopped", hint: "Fixes are halted on this device; watching continues in detect-only mode." };
  if (paused) return { id: "paused", running: true, label: "paused", hint: "Watching resumes when the pause ends, or press Start ARIA." };
  if (bridgeConflict) return { id: "self-repair", running: true, label: "self repair", hint: "" };
  return { id: "watching", running: true, label: "watching", hint: "" };
}

/** The top-bar chip: "<Mode> mode - watching | paused | stopped". */
export function railStatusLabel(mode, runState) {
  const m = String(mode || "manual").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return `${m} mode - ${(runState && runState.label) || "watching"}`;
}

/**
 * Hero sub-line copy — REAL-OR-EMPTY (audit R6): a zero count of something ARIA never claimed to fight is not
 * a number to show. Threats appear only when a SECURITY row really exists; "last sync never" reads as the
 * honest "no update check yet"; a stopped/paused agent says so instead of "watching".
 */
export function heroSubline({ eventsToday = 0, threats = 0, lastSyncAgo = "just now", runState = null } = {}) {
  const head = runState && runState.running === false ? `ARIA is ${runState.label || "stopped"}` : runState && runState.id === "paused" ? "ARIA is paused" : "ARIA is watching";
  const parts = [head];
  const events = Number(eventsToday) || 0;
  parts.push(events > 0 ? `${events} events scanned` : "no events logged yet");
  const th = Number(threats) || 0;
  if (th > 0) parts.push(`${th} threats blocked`);
  const sync = String(lastSyncAgo || "");
  parts.push(!sync || sync === "never" ? "no update check yet" : `last sync ${sync}`);
  if (runState && runState.hint) parts.push(runState.hint);
  return parts.join(" · ");
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

/** The six hero tiles from live state (Overview ROW 2). */
export function heroTiles(m = {}) {
  return [
    kpiTile({ id: "status", label: "Uptime (7d)", value: m.uptime7d, unit: "%", values: m.uptimeTrend, prev: m.uptimePrev }),
    kpiTile({ id: "mttr", label: "MTTR (min, 30d)", value: m.mttr, values: m.mttrTrend, prev: m.mttrPrev }),
    kpiTile({ id: "accuracy", label: "Diagnosis accuracy", value: m.accuracy, unit: "%", values: m.accuracyTrend, prev: m.accuracyPrev }),
    // (audit R6) real-or-empty: breaches are null until the SLA surface has measured anything — never a literal 0.
    kpiTile({ id: "breaches", label: "SLA breaches MTD", value: m.breaches == null ? null : m.breaches, values: m.breachTrend, prev: m.breachPrev }),
    kpiTile({ id: "hours", label: "Hours saved MTD", value: m.hoursSaved, values: m.hoursTrend, prev: m.hoursPrev }),
    kpiTile({ id: "update", label: "Version", value: m.version || "0.1.0", unit: m.updatePending ? " · update ready" : "" })
  ];
}
