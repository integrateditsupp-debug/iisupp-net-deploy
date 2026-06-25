// Q-QA1 — classifier accuracy + per-intent regression lock, COMPUTED at test time (never a stored number).
// This is the CI gate that makes the web /aria classifier's accuracy honest and self-measuring (C-1 + H-1),
// locks the kb:active-directory fix (49% -> 100%), and enforces the project's "no intent below 50%" HARD floor
// with per-intent traceability (M-2). Disposition logic is the shared tests/mega-eval.js (same as the
// run-mega-scenarios harness + the iis-tester ACC-1 check) so there is no drift between report and gate.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..", "..");
const corpus = require(path.join(root, "tests/scenario-corpus-mega.js"));
const { classify, looksLikeResolution } = require(path.join(root, "tests/aria-classifier-mirror.js"));
const { evaluate } = require(path.join(root, "tests/mega-eval.js"));

const ev = evaluate(corpus, classify, looksLikeResolution);
const acc = ev.pass / ev.total;

// 1 — Overall accuracy floor (current ~92.4%; lock at 0.92 so any real regression trips CI).
assert.ok(ev.total >= 300000, `corpus is the full mega set (got ${ev.total})`);
assert.ok(acc >= 0.92, `overall accuracy ${(acc * 100).toFixed(2)}% must be >= 92.00%`);

// 2 — HARD FLOOR: the project rule is "no intent below 50%". Assert EVERY intent by name (per-intent
//     traceability, M-2). This is what caught kb:active-directory at 49% before the fix.
for (const [intent, v] of Object.entries(ev.by_intent)) {
  const r = v.pass / v.total;
  assert.ok(r >= 0.50, `intent "${intent}" = ${(r * 100).toFixed(1)}% (${v.pass}/${v.total}) is below the 50% HARD floor`);
}

// 3 — Lock the headline fix: kb:active-directory was 49% (misrouted to "password"); it must stay >= 95%.
const ad = ev.by_intent["kb:active-directory"];
assert.ok(ad && ad.pass / ad.total >= 0.95,
  `kb:active-directory = ${ad ? ((ad.pass / ad.total) * 100).toFixed(1) : "n/a"}% must stay >= 95% (regression lock)`);

// 4 — Per-intent regression floors for the other previously-weak intents, so a future change can't quietly
//     drop them. Floors sit just under the measured value at the time of writing (2026-06-25).
const FLOORS = {
  password: 0.90, mail: 0.97, default: 0.86,
  "kb:m365": 0.84, resolution: 0.84, escalation: 0.83, "kb:onboarding": 0.87, "kb:onedrive": 0.91,
  "kb:browser": 0.92, "kb:networking": 0.92, "not-resolution": 0.92,
};
for (const [intent, floor] of Object.entries(FLOORS)) {
  const v = ev.by_intent[intent];
  if (!v) continue;
  const r = v.pass / v.total;
  assert.ok(r >= floor, `intent "${intent}" = ${(r * 100).toFixed(1)}% dropped below its regression floor ${(floor * 100).toFixed(0)}%`);
}

console.log(`classifier-accuracy test passed (computed at test time: ${(acc * 100).toFixed(2)}% over ${ev.total} · ${Object.keys(ev.by_intent).length} intents all >= 50% floor · kb:active-directory ${((ad.pass / ad.total) * 100).toFixed(0)}% locked).`);
