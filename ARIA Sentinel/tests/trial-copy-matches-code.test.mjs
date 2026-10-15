// PROD 2026-10-14 (audit R3 / R13 / R20) — TRIAL TRUTH. The trial is 30 days (license.mjs TRIAL_DAYS); every
// "N-day trial" sentence the renderer or a UI-shaping module prints must say that same N; the renderer owns NO
// trial constant of its own (it reads gate.trial.durationMs / days); "days left" is real or absent — never
// "undefined"; and after expiry the copy says plainly what still works (Dashboard · ARIA chat · Manual mode ·
// Settings), offers the Walk-Through ONLY to the entitled, and never contradicts the Mode panel (Manual is never
// locked in the renderer).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TRIAL_DAYS, TRIAL_DURATION_MS } from "../src/shared/license.mjs";
import { DEFAULT_TRIAL_DAYS, DAY_MS, trialDays, trialDurationMs, trialDaysLeft, trialState, licenseStatusLine, trialBadgeText, accountStatusLine, lockedTabCopy, wizardTrialLine, trialFractionLeft, freeFloorLine } from "../src/shared/trial-copy.mjs";
import { tabGateMap, BASELINE_TABS } from "../src/shared/tab-gating.mjs";

const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
let n = 0; const t = () => { n++; };
const NOW = Date.parse("2026-10-14T12:00:00Z");

// 1 — one number: the renderer's default equals license.mjs, and every "N-day trial" string in the UI says it.
assert.equal(DEFAULT_TRIAL_DAYS, TRIAL_DAYS, "trial-copy default pinned to license.mjs TRIAL_DAYS");
assert.equal(TRIAL_DURATION_MS, TRIAL_DAYS * DAY_MS);
const OWNED = [
  ["src", "renderer", "index.html"], ["src", "renderer", "renderer.js"], ["src", "renderer", "overlay.js"], ["src", "renderer", "overlay.html"],
  ["src", "shared", "tab-gating.mjs"], ["src", "shared", "trial-copy.mjs"], ["src", "shared", "upsell.mjs"], ["src", "shared", "license-plan.mjs"], ["src", "shared", "pricing-tiers.mjs"], ["src", "overlay", "plan-picker.html"], ["src", "overlay", "plan-picker.mjs"]
];
for (const f of OWNED) {
  const src = rd(...f);
  for (const m of src.matchAll(/(\d+)-day(?:s)?\b[^\n]{0,40}/g)) {
    if (!/trial/i.test(m[0])) continue; // "7-day pause" (updates) is not the trial
    assert.equal(Number(m[1]), TRIAL_DAYS, `${f.join("/")}: "${m[0]}" must equal the ${TRIAL_DAYS}-day trial`);
  }
  assert.doesNotMatch(src, /12-hour|12 \* 60 \* 60 \* 1000/, `${f.join("/")}: no 12-hour trial remnant`);
}
const renderer = rd("src", "renderer", "renderer.js");
assert.doesNotMatch(renderer, /const TRIAL_DURATION_MS/, "the renderer owns no trial constant (gate.trial.durationMs is the source)");
assert.match(renderer, /trialFractionLeft\(gate\)/, "the <30% nudge uses the gate's own duration");
assert.doesNotMatch(renderer, /daysRemaining/, "the dead RUN-10 daysRemaining field is never read (it produced 'undefined days left')");
t();

// 2 — the gate numbers: days from durationMs/days/trialDays; days-left real or null, never NaN.
const endsAt = new Date(NOW + 9.5 * DAY_MS).toISOString();
const active = { licensed: false, trialEndsAt: endsAt, daysLeft: 10, trialDays: 30, trial: { state: "active", remainingMs: 9.5 * DAY_MS, endsAt, daysLeft: 10, durationMs: 30 * DAY_MS, days: 30, badge: "Trial · 9d 12h left" } };
assert.equal(trialDays(active), 30); assert.equal(trialDurationMs(active), 30 * DAY_MS);
assert.equal(trialDays({ trial: { durationMs: 14 * DAY_MS } }), 14, "days derive from durationMs when days is absent");
assert.equal(trialDays({}), TRIAL_DAYS, "no gate → the pinned default");
assert.equal(trialDaysLeft(active, NOW), 10);
assert.equal(trialDaysLeft({ trial: { state: "active", endsAt } }, NOW), 10, "computed from the end date when daysLeft is absent");
assert.equal(trialDaysLeft({ trial: { state: "expired", remainingMs: 0 } }, NOW), null, "no end date → null, never NaN");
assert.equal(trialDaysLeft({ trial: { state: "active", remainingMs: 2.2 * DAY_MS } }, NOW), 3, "falls back to remainingMs");
assert.equal(trialState(active), "active"); assert.equal(trialState({ licensed: true, plan: "pro" }), "licensed"); assert.equal(trialState({}), "not-started");
assert.ok(Math.abs(trialFractionLeft(active) - 9.5 / 30) < 1e-9); assert.equal(trialFractionLeft({}), null);
t();

// 3 — the sentences: never "undefined", always the real number / date, and the free floor named plainly.
// 2026-10-14 (review P2-9) — EXPECTATIONS CHANGED ON PURPOSE: the trial unlocks the Pro plan (TRIAL_PLAN = "pro"), so the
// copy says "every Pro feature", never "every feature" (business-tier features are not part of the trial).
for (const [gate, re] of [
  [active, /^Trial active · 10 days left \(ends .*\) — every Pro feature is unlocked\.$/],
  [{ licensed: true, plan: "pro" }, /^Licensed · pro\.$/],
  [{ trial: { state: "expired", endsAt: new Date(NOW - DAY_MS).toISOString(), days: 30 } }, /^Your 30-day trial ended .*\. Dashboard, ARIA chat, Manual mode and Settings keep working\. Subscribe to unlock/],
  [{}, /^Manual mode \(free\)\. Start a 30-day trial of every Pro feature/]
]) {
  const line = licenseStatusLine({}, gate, NOW);
  assert.match(line, re); assert.doesNotMatch(line, /undefined|NaN/);
}
assert.equal(trialBadgeText(active), "Trial · 9d 12h left"); assert.equal(trialBadgeText({ trial: { state: "expired" } }), "Trial ended"); assert.equal(trialBadgeText({ licensed: true }), "Licensed"); assert.equal(trialBadgeText({}), "Free");
assert.equal(trialBadgeText({ trial: { state: "active", endsAt } }, NOW), "Trial · 10d left", "no badge from main → a real count, never undefined");
assert.match(accountStatusLine({ trial: { state: "expired" } }), /Trial ended — choose a plan to unlock the rest\. Manual mode and ARIA chat keep working\./);
assert.match(wizardTrialLine(active, NOW), /already running — 10 days left/); assert.match(wizardTrialLine({}), /free 30-day trial of every Pro feature starts the first time ARIA runs/);
assert.match(wizardTrialLine(active, NOW), /Every Pro feature is unlocked while it runs/);
for (const g of [active, {}]) for (const line of [licenseStatusLine({}, g, NOW), wizardTrialLine(g, NOW)]) assert.doesNotMatch(line, /\bevery feature\b/i, "never 'every feature' for a Pro trial");
assert.match(freeFloorLine({ walkthroughEntitled: true }), /Walk-Through is yours to keep/); assert.doesNotMatch(freeFloorLine({}), /Walk-Through/);
t();

// 4 — the locked-tab overlay: honest reason + what still works; Walk-Through offered ONLY to the entitled; no contradiction with Manual.
const expired = { licensed: false, trialEndsAt: new Date(NOW - 2 * DAY_MS).toISOString(), trial: { state: "expired", remainingMs: 0, endsAt: new Date(NOW - 2 * DAY_MS).toISOString(), daysLeft: 0, durationMs: 30 * DAY_MS, days: 30 } };
const plain = lockedTabCopy(expired, NOW);
assert.match(plain.message, /Your 30-day ARIA Sentinel trial has ended\./); assert.match(plain.message, /Dashboard, ARIA chat, Manual mode and Settings keep working\./);
assert.doesNotMatch(plain.message, /Walk-Through/i, "no 'keep using your Walk-Through' promise without the entitlement");
assert.equal(plain.showWalkthroughButton, false); assert.match(plain.trialInfo, /^Your 30-day trial ended /);
const entitled = lockedTabCopy({ ...expired, walkthroughEntitled: true }, NOW);
assert.equal(entitled.showWalkthroughButton, true); assert.match(entitled.message, /Walk-Through is yours to keep/);
const activeLock = lockedTabCopy(active, NOW);
assert.match(activeLock.message, /part of the paid ARIA Sentinel plans/); assert.match(activeLock.trialInfo, /10 days left in your trial/);
// the tab matrix the overlay sits on: baseline always open, Walk-Through by entitlement only (tab-gating unchanged)
const map = tabGateMap(expired);
for (const tab of BASELINE_TABS) assert.equal(map[tab], true);
assert.equal(map.walkthrough, false); assert.equal(tabGateMap({ ...expired, walkthroughEntitled: true }).walkthrough, true);
// Manual is never locked in the renderer, so the "Manual → 'Confirmed is a Pro feature'" contradiction cannot recur.
assert.match(renderer, /const allowed = row\.dataset\.mode === "manual" \|\| modes\.includes\(row\.dataset\.mode\)/, "Manual mode tile is never locked");
assert.match(renderer, /manual: \{ plan: "personal", title: "Manual mode is always yours"/, "an honest Manual entry exists in the upsell map");
assert.match(renderer, /lockedTabCopy\(gate\)/, "the overlay copy comes from trial-copy.mjs");
assert.match(renderer, /keep\.hidden = !copy\.showWalkthroughButton/, "the Walk-Through button hides when not entitled");
assert.match(renderer, /startBtn\.hidden = st !== "not-started"/, "Start trial is hidden once a trial exists (it is write-once)");
t();

assert.equal(n, 4, "4 trial-copy-matches-code groups");
console.log(`trial-copy-matches-code test passed (${n} groups · ${TRIAL_DAYS}-day everywhere, no renderer constant · gate numbers real-or-null · sentences never 'undefined' · locked overlay honest + Walk-Through by entitlement + Manual never locked).`);
