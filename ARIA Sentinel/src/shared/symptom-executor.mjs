// symptom-executor — the ONE binding from a matched symptom (diagnostic-reasoner id) to a vetted,
// reversible Tier-0 executor recipe id (F1 2026-07-02). Before this, the symptom KB carried NO recipe
// binding, so "Resolve it for me" always fell through to the supervisor with an empty id → held
// "(none) is not in the signed catalog". Now a matched symptom that HAS a genuinely safe, reversible
// first-line auto-fix maps to that fix; everything else stays null so the caller honestly degrades to
// the guided walk-through (Rule 14 — never offer a resolve that will be held).
//
// The mapped ids are CATALOG ids (in the supervisor's signed Tier-0 catalog) that also resolve to a live
// executor binding AND have authored walk steps:
//   restart-print-spooler  (direct)                         — printer: restart the Print Spooler service
//   restart-audio-service  (alias → restart-audio)          — audio: restart Windows Audio
//   flush-dns              (alias → flush-dns-cache)         — no-internet: flush the DNS resolver cache
// Each is non-destructive, reversible, and the standard safe first step for its symptom. Bluetooth/Wi-Fi,
// display, slow-performance, updates etc. are intentionally left UNBOUND — no single safe auto-fix covers
// them, so they route to the step-by-step walk-through instead of a misleading one-click "resolve".
// Pure + node-safe (no imports): importable by the renderer, main, and tests alike.

export const SYMPTOM_EXECUTOR = Object.freeze({
  "printer-issues": "restart-print-spooler",
  "audio-issues": "restart-audio-service",
  "no-internet": "flush-dns"
});

/** The vetted executor recipe id for a matched symptom id, or "" when none is safe to auto-apply. */
export function executorForSymptom(symptomId) {
  const id = String(symptomId || "").trim().toLowerCase();
  return SYMPTOM_EXECUTOR[id] || "";
}
