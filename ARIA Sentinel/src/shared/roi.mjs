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
