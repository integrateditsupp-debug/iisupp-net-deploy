// RUN 20 §5 — the doctor reasoner fuzzy-matches 20 real user phrasings to the correct symptom (top-3).
import assert from "node:assert/strict";
import path from "node:path";
import { loadSymptomKb } from "../src/shared/symptom-kb.mjs";
import { fuzzyMatchSymptoms } from "../src/shared/diagnostic-reasoner.mjs";

const kb = loadSymptomKb(path.join(path.resolve(import.meta.dirname, ".."), "aria-kb-pack", "diagnostics"));

const CASES = [
  ["my computer is so slow", "slow-performance"],
  ["everything takes forever", "slow-performance"],
  ["app keeps crashing", "app-crashes"],
  ["program won't open", "app-crashes"],
  ["blue screen", "system-crashes"],
  ["computer keeps restarting", "system-crashes"],
  ["no internet", "no-internet"],
  ["can't get online", "no-internet"],
  ["no sound", "audio-issues"],
  ["i can't hear anything", "audio-issues"],
  ["black screen", "display-issues"],
  ["second monitor not detected", "display-issues"],
  ["printer won't print", "printer-issues"],
  ["update stuck", "update-stuck"],
  ["windows not activated", "license-activation"],
  ["computer won't start", "boot-issues"],
  ["battery drains fast", "battery-power"],
  ["file explorer won't open", "file-explorer"],
  ["outlook won't open", "email-issues"],
  ["wifi keeps dropping", "bluetooth-wifi"]
];

let top1 = 0;
for (const [phrase, expected] of CASES) {
  const top = fuzzyMatchSymptoms(phrase, kb, 3).map((m) => m.id);
  assert.ok(top.includes(expected), `"${phrase}" → expected ${expected} in top-3, got [${top.join(", ")}]`);
  if (top[0] === expected) top1 += 1;
}
assert.ok(top1 >= 16, `strong top-1 accuracy (${top1}/20)`);

// An empty/garbage input returns no match (reasoner asks for more info rather than guessing).
assert.equal(fuzzyMatchSymptoms("", kb, 3).length, 0, "no phantom matches on empty input");

console.log(`Diagnostic-reasoner-fuzzy test passed (20/20 in top-3, ${top1}/20 top-1).`);
