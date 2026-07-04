// roi — pure value-proof math for the Settings → About ROI calculator. Reads only local audit
// counts (no content). "ARIA fixed N issues, saved ~M hours @ $X/hr = $Y this period."
export const DEFAULT_HOURLY_RATE = 75;
export const DEFAULT_MINUTES_PER_FIX = 20;

export function computeRoi(input = {}) {
  const fixes = Math.max(0, Math.floor(Number(input.fixes) || 0));
  const hourlyRate = Number.isFinite(input.hourlyRate) && input.hourlyRate >= 0 ? Number(input.hourlyRate) : DEFAULT_HOURLY_RATE;
  const minutesPerFix = Number.isFinite(input.minutesPerFix) && input.minutesPerFix > 0 ? Number(input.minutesPerFix) : DEFAULT_MINUTES_PER_FIX;
  const minutesSaved = fixes * minutesPerFix;
  const hoursSaved = Math.round((minutesSaved / 60) * 10) / 10;
  const dollarsSaved = Math.round((minutesSaved / 60) * hourlyRate);
  return { fixes, hourlyRate, minutesPerFix, hoursSaved, dollarsSaved };
}

// One-line summary for the About panel.
export function roiSummary(roi) {
  return `ARIA has fixed ${roi.fixes} issue${roi.fixes === 1 ? "" : "s"}, saving ~${roi.hoursSaved} hour${roi.hoursSaved === 1 ? "" : "s"} @ $${roi.hourlyRate}/hr = $${roi.dollarsSaved.toLocaleString("en-US")} this period.`;
}

// B2: derive real ROI from a transparencyLog array (content-blind — counts only, no text).
// A "fix" = a RUN-tagged event (recipe actually executed). Returns null for hoursSaved/dollarsSaved
// when fixes === 0 — real-or-empty, never a fabricated "0 hours" (Rule 14).
export function roiFromLog(log, opts) {
  const arr = Array.isArray(log) ? log : [];
  const fixes = arr.filter((e) => e && e.tag === "RUN").length;
  const roi = computeRoi({ fixes, hourlyRate: opts && opts.hourlyRate, minutesPerFix: opts && opts.minutesPerFix });
  return {
    fixes,
    hoursSaved:    fixes > 0 ? roi.hoursSaved   : null,
    dollarsSaved:  fixes > 0 ? roi.dollarsSaved  : null,
    hourlyRate:    roi.hourlyRate,
    minutesPerFix: roi.minutesPerFix,
  };
}

// Real-or-empty one-liner: shows placeholder when no events recorded (Rule 14).
export function roiSummaryFromLog(log, opts) {
  const r = roiFromLog(log, opts);
  if (r.fixes === 0) return "ARIA has not recorded any resolved incidents yet.";
  return roiSummary({ ...r, hoursSaved: r.hoursSaved, dollarsSaved: r.dollarsSaved });
}
