// PROD 2026-10-14 (audit R8 / §3) — the first-run wizard's pure model: the three buyer screens, safe defaults
// that keep what was typed, the "What I'll do" cards, the mode/autonomy pairing (Manual stays Manual), the key
// shape gate and the summary that is the ONLY place "You're all set" is said. Plus the renderer wiring: one
// overlay at a time, Skip on every step, the key reaches enterLicense, dialog semantics, 12 steps kept.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { QUICK_TRACK, SAFE_DEFAULTS, WHAT_CARDS, autonomyForMode, modeForAutonomy, quickChoiceToPrefs, quickChoiceOf, isLicenseKeyShaped, applySafeDefaults, summaryLines, progressLabel } from "../src/shared/setup-flow.mjs";
import { autonomyLevelToMode } from "../src/shared/app-config.mjs";

const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
let n = 0; const t = () => { n++; };

// 1 — the quick track + safe defaults are what the copy says they are.
assert.deepEqual([...QUICK_TRACK], ["hello", "who", "what", "summary"]);
assert.equal(SAFE_DEFAULTS.mode, "manual"); assert.equal(SAFE_DEFAULTS.autonomyLevel, "approve-first"); assert.equal(SAFE_DEFAULTS.liveFixes, false);
assert.deepEqual({ ...SAFE_DEFAULTS.notifyChannels }, { desktop: true, email: false, sms: false });
assert.equal(SAFE_DEFAULTS.reportCadence, "weekly"); assert.equal(SAFE_DEFAULTS.maintenanceWindow.enabled, false); assert.equal(SAFE_DEFAULTS.trayIcon, true);
t();

// 2 — the mode is respected: the level follows the mode, and every card's mode matches main's level→mode map.
assert.equal(autonomyForMode("manual"), "approve-first"); assert.equal(autonomyForMode("confirmed"), "safe-auto"); assert.equal(autonomyForMode(undefined), "approve-first");
assert.equal(modeForAutonomy("observe"), "manual"); assert.equal(modeForAutonomy("approve-first"), "manual"); assert.equal(modeForAutonomy("safe-auto"), "confirmed"); assert.equal(modeForAutonomy("full-auto"), "confirmed");
assert.equal(autonomyLevelToMode(autonomyForMode("manual")).mode, "manual", "the default for Manual maps back to Manual in main's own table (no silent Confirmed)");
assert.equal(autonomyLevelToMode(autonomyForMode("confirmed")).mode, "confirmed");
assert.equal(WHAT_CARDS.length, 3); assert.equal(WHAT_CARDS[0].id, "tell-first"); assert.equal(WHAT_CARDS[0].recommended, true);
for (const c of WHAT_CARDS) { assert.equal(autonomyLevelToMode(c.level).mode, c.mode, `${c.id}: card mode agrees with main`); assert.ok(c.consequence.length > 30, `${c.id} has real consequence copy`); }
assert.deepEqual(quickChoiceToPrefs("fix-safe"), { autonomyLevel: "safe-auto", mode: "confirmed" });
assert.deepEqual(quickChoiceToPrefs("nope"), { autonomyLevel: "approve-first", mode: "manual" }, "unknown → the recommended card");
assert.equal(quickChoiceOf({ autonomyLevel: "observe" }), "observe"); assert.equal(quickChoiceOf({ mode: "confirmed" }), "fix-safe"); assert.equal(quickChoiceOf({}), "tell-first");
t();

// 3 — safe defaults keep what was typed; the email channel/recipient turn on only with a real email.
const typed = { mode: "confirmed", autonomyLevel: "full-auto", fullAutoUnderstood: true, identity: { kind: "business", orgName: "Acme" }, deviceUser: { name: "Sam", email: "sam@acme.com", phone: "+1 416 555 0100", smsOptIn: true }, techContacts: [{ name: "Jo", email: "jo@acme.com" }], maintenanceWindow: { enabled: true, windows: [{ days: "daily" }] }, notifyChannels: { desktop: false, email: true, sms: true }, reportCadence: "per-fix" };
const safe = applySafeDefaults(typed);
assert.equal(safe.mode, "manual"); assert.equal(safe.autonomyLevel, "approve-first"); assert.equal(safe.fullAutoUnderstood, false);
assert.deepEqual(safe.identity, { kind: "business", orgName: "Acme" }); assert.deepEqual(safe.deviceUser, { name: "Sam", email: "sam@acme.com", phone: "+1 416 555 0100", smsOptIn: false });
assert.deepEqual(safe.techContacts, [{ name: "Jo", email: "jo@acme.com" }]);
assert.deepEqual(safe.maintenanceWindow, { enabled: false, windows: [] }); assert.deepEqual(safe.notifyChannels, { desktop: true, email: true, sms: false }); assert.equal(safe.reportCadence, "weekly");
assert.deepEqual(safe.reportRecipients, [{ email: "sam@acme.com", phone: "" }]);
assert.equal(typed.mode, "confirmed", "the input is not mutated");
const noEmail = applySafeDefaults({ deviceUser: { email: "not an email" } });
assert.equal(noEmail.notifyChannels.email, false); assert.deepEqual(noEmail.reportRecipients, []); assert.equal(noEmail.deviceUser.email, "not an email");
assert.equal(isLicenseKeyShaped("A".repeat(64)), true); assert.equal(isLicenseKeyShaped("a".repeat(63)), false); assert.equal(isLicenseKeyShaped(""), false);
t();

// 4 — the summary says exactly what will be saved (mode from the level, live fixes, channels, reports, key).
const lines = summaryLines({ mode: "manual", autonomyLevel: "approve-first", notifyChannels: { desktop: true }, reportCadence: "weekly" }, { liveFixes: false, trialLine: "Your free 30-day trial is already running." });
assert.match(lines[0], /^Mode: Manual — ARIA previews and guides/); assert.match(lines[1], /^Autonomy: Tell me first/); assert.match(lines[2], /^Live fixes: OFF — ARIA shows what it would do and changes nothing/);
assert.match(lines[3], /desktop notifications/); assert.match(lines[4], /^Reports: weekly — kept on this device/); assert.match(lines[5], /^Maintenance window: off/); assert.match(lines[6], /^Your free 30-day trial/);
const lines2 = summaryLines({ mode: "manual", autonomyLevel: "safe-auto", reportRecipients: [{ email: "a@b.co" }], maintenanceWindow: { enabled: true, windows: [{ days: "weekdays", start: "02:00", durationMin: 120 }] } }, { liveFixes: true, licenseKey: "f".repeat(64) });
assert.match(lines2[0], /^Mode: Confirmed/, "an explicit safe-auto choice implies Confirmed and the summary says so"); assert.match(lines2[2], /^Live fixes: ON/); assert.match(lines2[4], /to a@b\.co/); assert.match(lines2[5], /weekdays at 02:00 for 120 min/); assert.match(lines2[6], /^License key: will be verified/);
assert.match(summaryLines({}, { licenseKey: "short" })[6], /not a valid 64-character key/);
assert.equal(progressLabel(0, 4), "Step 1 of 4"); assert.equal(progressLabel(12, 13), "Step 13 of 13");
t();

// 5 — renderer wiring: one overlay, Skip everywhere, key → enterLicense, mode respected, dialog, 12 steps kept.
const renderer = rd("src", "renderer", "renderer.js");
const html = rd("src", "renderer", "index.html");
assert.match(html, /<div id="setupWizard" class="onboarding" role="dialog" aria-modal="true" aria-labelledby="setupTitle" hidden>/, "the wizard is a dialog");
assert.match(html, /id="setupSkip"[^>]*>Skip for now — use safe defaults</, "a visible Skip on the wizard");
assert.match(html, /id="setupProgress"/);
assert.match(renderer, /maybeShowSetupWizard\(state\); \/\/ RUN 33-E\n\s*maybeShowOnboarding\(state\);/, "the wizard is shown first; the tour only if it is not");
assert.match(renderer, /if \(next\.setupNeeded \|\| setupVisible\(\)\) return;/, "the tour never stacks on the wizard");
assert.match(renderer, /if \(state && state\.firstRunComplete === false && !onboardingShown\) startTour\(\{ auto: true \}\);/, "the tour runs after the wizard, once");
assert.match(renderer, /bindClick\("dashTakeTour", \(\) => startTour\(\)\)/, "the tour stays reachable on demand (Rule 15)");
assert.match(renderer, /const lic = qs\("#setupLicense"\); if \(lic\) setupLocal\.licenseKey = lic\.value\.trim\(\);/, "the typed key is kept");
assert.match(renderer, /sentinel\.enterLicense\?\.\(\{ key, email: setupPrefs\.deviceUser\.email \|\| "" \}\)/, "…and verified through enterLicense");
assert.match(renderer, /if \(!setupLocal\.autonomyExplicit\) setupPrefs\.autonomyLevel = autonomyForMode\(mode\.value\);/, "the autonomy level follows the chosen mode");
assert.match(renderer, /autonomyLevel: "approve-first", \/\/ follows the recommended Manual mode/, "the default level keeps Manual Manual");
assert.match(renderer, /kicker: "Done", title: "Basics saved"/, "the mid-way step no longer says 'all set'");
assert.match(renderer, /const SUMMARY_STEP = \{ kicker: "Done", title: "You're all set"/, "…only the summary does");
assert.match(renderer, /function setupSteps\(\) \{ return setupTrack === "quick" \? QUICK_STEPS : \[\.\.\.SETUP_STEPS, SUMMARY_STEP\]; \}/, "Customize = all 12 original steps + the summary");
assert.match(renderer, /id="setupSafeDefaults">Start with safe defaults</); assert.match(renderer, /id="setupCustomize">Customize \(all 12 steps\)</);
assert.match(renderer, /function wireSetupDialogA11y\(\)[^]*?if \(e\.key === "Escape"\) \{ e\.preventDefault\(\); if \(!setupIsSummary\(\)\) setupUseSafeDefaults\(\); return; \}/, "Escape → the summary, never a silent close");
assert.match(renderer, /if \(e\.shiftKey && document\.activeElement === first\)/, "focus trap");
for (const id of ["setup-identity", "setup-contacts", "setup-autonomy", "setup-approver", "setup-reports", "setup-window"]) assert.match(renderer, new RegExp(`id: "${id}"`), `${id} still reachable`);
assert.match(renderer, /liveFixesRowHtml\("setupLiveFixes"\)/, "the live-fixes switch is in the wizard (quick + full autonomy step)");
assert.match(renderer, /sentinel\.setLiveFixes\?\.\(\{ enabled: setupLocal\.liveFixes \}\)/, "…written through the consent gate on Finish");
t();

assert.equal(n, 5, "5 setup-flow groups");
console.log(`setup-flow test passed (${n} groups · quick track + safe defaults · mode↔level pairing agrees with main · typed values survive safe defaults · summary = what is saved · renderer wiring: one overlay, Skip, key → enterLicense, dialog, 12 steps kept).`);
