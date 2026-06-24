// RUN 22 §2 — AI performance: diagnosis accuracy + calibration + confirmation + KB hit + top-3.
import assert from "node:assert/strict";
import { diagnosisAccuracy, userConfirmationRate, fuzzyTop3Accuracy, calibrationScore, kbHitRate, anomalySurfacingCount } from "../src/shared/metrics.mjs";

const diags = [
  { correct: true, accepted: true, confidence: 0.95, inTop3: true },
  { correct: true, accepted: true, confidence: 0.9, inTop3: true },
  { correct: false, accepted: false, confidence: 0.55, inTop3: true },
  { correct: true, accepted: true, confidence: 0.85, inTop3: false }
];
assert.equal(diagnosisAccuracy(diags), 75, "3 of 4 top-1 correct");
assert.equal(userConfirmationRate(diags), 75, "3 of 4 accepted");
assert.equal(fuzzyTop3Accuracy(diags), 75, "3 of 4 in top-3");

// Calibration: 0..100, higher = better. A perfectly-calibrated set scores ~100.
const perfect = [
  { correct: true, confidence: 0.95 }, { correct: true, confidence: 0.95 },          // 95% bucket, all right
  { correct: true, confidence: 0.55 }, { correct: false, confidence: 0.55 }           // 55% bucket, ~half right
];
assert.ok(calibrationScore(perfect) >= 85, `well-calibrated scores high (${calibrationScore(perfect)})`);
const overconfident = [{ correct: false, confidence: 0.95 }, { correct: false, confidence: 0.95 }];
assert.ok(calibrationScore(overconfident) < 20, `overconfident-and-wrong scores low (${calibrationScore(overconfident)})`);
assert.equal(calibrationScore([]), 0, "no data → 0");

// KB hit rate + anomaly surfacing count.
assert.equal(kbHitRate([{ matchedKb: true }, { matchedKb: false }, { matchedKb: true }]), 66.7);
assert.equal(anomalySurfacingCount([{ anomaly: true }, {}, { anomaly: true }]), 2);

console.log("Performance-ai-accuracy test passed (diagnosis accuracy + calibration + confirmation + KB hit).");
