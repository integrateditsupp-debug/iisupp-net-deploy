// RUN-CU / CU4 — Setup wizard v2: the six appended steps + their prefs (identity · device user · tech contacts ·
// autonomy level · approver · report recipients/cadence · maintenance window · channels). Sanitize / defaults /
// clamps are pure (app-config.mjs); the static half proves the steps render, the Settings "Autonomy & contacts"
// section exists, the IPC is wired, and the ORIGINAL six steps + every original data-tab are untouched (Rule 15).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  defaultAppConfig, defaultSetupState, defaultV2Prefs, completeSetup, updateSetupPrefs, normalizeSetupPrefs, sanitizePrefs,
  resolveAutonomy, autonomyLevelToMode, SETUP_TOTAL_STEPS, SETUP_V1_STEPS, AUTONOMY_LEVELS, AUTONOMY_LEVEL_COPY,
  APPROVER_TIMEOUT_MIN, APPROVER_TIMEOUT_MAX, APPROVER_TIMEOUT_DEFAULT
} from "../src/shared/app-config.mjs";

let n = 0; const t = () => { n++; };

// 1 — defaults: personal → safe-auto + approver self; channels desktop+email on, sms off; weekly reports; no window.
{
  const d = defaultSetupState().prefs;
  assert.equal(d.identity.kind, "personal");
  assert.equal(d.autonomyLevel, "safe-auto");
  assert.equal(d.approver.mode, "self");
  assert.equal(d.approver.timeoutMinutes, APPROVER_TIMEOUT_DEFAULT);
  assert.equal(d.approver.onTimeout, "skip");
  assert.deepEqual(d.notifyChannels, { desktop: true, email: true, sms: false });
  assert.equal(d.reportCadence, "weekly");
  assert.deepEqual(d.maintenanceWindow, { enabled: false, windows: [] });
  // v1 prefs still there with their original defaults
  assert.equal(d.mode, "manual"); assert.equal(d.kbNotifications, true); assert.equal(d.trayIcon, true); assert.equal(d.landOnAria, false);
  assert.equal(SETUP_TOTAL_STEPS, SETUP_V1_STEPS + 6, "six v2 steps appended after the original six");
  assert.deepEqual([...AUTONOMY_LEVELS], ["observe", "safe-auto", "approve-first", "full-auto"]);
  for (const l of AUTONOMY_LEVELS) assert.ok(AUTONOMY_LEVEL_COPY[l].consequence.length > 10, `${l} has plain-language consequence copy`);
  assert.equal(AUTONOMY_LEVEL_COPY.observe.consequence, "I find it, I tell you, I touch nothing.");
  assert.equal(AUTONOMY_LEVEL_COPY["full-auto"].consequence, "I fix green and yellow inside your maintenance window and report.");
}
t();

// 2 — sanitize: emails lower-cased + shape-checked, phones shape-checked, unknown enums → defaults, clamps hold.
{
  const p = sanitizePrefs({
    identity: { kind: "corporate", orgName: "Acme <script>" },
    deviceUser: { name: "Sam", email: "SAM@Acme.COM", phone: "not a phone", smsOptIn: true },
    techContacts: [{ name: "Bob", email: "bob@acme.com", role: "ceo" }, { name: "Nobody" }, { email: "bad@", phone: "+1 416 555 0101", role: "approver" }],
    autonomyLevel: "yolo",
    approver: { mode: "god", contacts: ["X@Y.com", "junk", "x@y.com"], timeoutMinutes: 1, onTimeout: "nuke" },
    reportRecipients: [{ email: "owner@acme.com" }, { phone: "+1 647 555 0100" }, {}],
    reportCadence: "hourly",
    maintenanceWindow: { windows: [{ days: "weekdays", start: "2:30", durationMin: 5 }, { days: "weekdays", start: "02:30", durationMin: 120 }, { start: "25:00", durationMin: 60 }] },
    notifyChannels: { desktop: 0, email: "yes", sms: true },
    bogus: 1
  });
  assert.equal(p.identity.kind, "personal", "unknown identity kind → personal");
  assert.equal(p.identity.orgName, "Acme script", "org name stripped of markup characters");
  assert.equal(p.deviceUser.email, "sam@acme.com");
  assert.equal(p.deviceUser.phone, "", "bad phone dropped");
  assert.equal(p.deviceUser.smsOptIn, false, "sms opt-in without a phone is false");
  assert.deepEqual(p.techContacts.map((c) => [c.email, c.phone, c.role]), [["bob@acme.com", "", "admin"], ["", "+1 416 555 0101", "approver"]], "unreachable contact dropped; unknown role → admin");
  assert.equal(p.autonomyLevel, "safe-auto", "unknown level → default");
  assert.equal(p.approver.mode, "self");
  assert.deepEqual(p.approver.contacts, ["x@y.com"], "approver contacts validated + deduped");
  assert.equal(p.approver.timeoutMinutes, APPROVER_TIMEOUT_MIN, "timeout clamped to the floor");
  assert.equal(p.approver.onTimeout, "skip");
  assert.deepEqual(p.reportRecipients, [{ email: "owner@acme.com", phone: "" }, { email: "", phone: "+1 647 555 0100" }]);
  assert.equal(p.reportCadence, "weekly", "unknown cadence → default");
  assert.deepEqual(p.maintenanceWindow, { enabled: true, windows: [{ days: "weekdays", start: "02:30", durationMin: 15 }, { days: "weekdays", start: "02:30", durationMin: 120 }] }, "too-short window clamped to the 15-min floor; invalid start dropped; HH:MM normalized");
  assert.deepEqual(p.notifyChannels, { desktop: false, email: true, sms: true });
  assert.ok(!("bogus" in p), "unknown keys never survive");
  assert.equal(sanitizePrefs({ approver: { timeoutMinutes: 99999 } }).approver.timeoutMinutes, APPROVER_TIMEOUT_MAX, "timeout clamped to the ceiling");
  assert.equal(sanitizePrefs({ approver: { timeoutMinutes: "abc" } }).approver.timeoutMinutes, APPROVER_TIMEOUT_DEFAULT, "non-numeric timeout → default");
}
t();

// 3 — completeSetup + updateSetupPrefs merge partials; a legacy (v1-only) config normalizes with v2 defaults filled in.
{
  const legacy = { setup: { completed: true, step: 6, prefs: { mode: "confirmed", landOnAria: true } } };
  const np = normalizeSetupPrefs(legacy);
  assert.equal(np.mode, "confirmed"); assert.equal(np.landOnAria, true);
  assert.equal(np.autonomyLevel, "safe-auto"); assert.equal(np.approver.mode, "self");
  const done = completeSetup(defaultAppConfig(), { identity: { kind: "business", orgName: "Acme" }, autonomyLevel: "approve-first" });
  assert.equal(done.setup.completed, true);
  assert.equal(done.setup.prefs.identity.kind, "business");
  assert.equal(done.setup.prefs.autonomyLevel, "approve-first");
  const upd = updateSetupPrefs(done, { techContacts: [{ name: "Jo", email: "jo@acme.com", role: "it-lead" }] });
  assert.equal(upd.setup.completed, true, "a prefs update never reopens the wizard");
  assert.equal(upd.setup.prefs.identity.kind, "business", "untouched fields survive a partial update");
  assert.equal(upd.setup.prefs.techContacts.length, 1);
  assert.deepEqual(Object.keys(defaultV2Prefs()).sort(), ["approver", "autonomyLevel", "deviceUser", "identity", "maintenanceWindow", "notifyChannels", "reportCadence", "reportRecipients", "techContacts"]);
}
t();

// 4 — resolveAutonomy: business without a tech contact is clamped to approve-first (observe stays observe); personal keeps its pick.
{
  assert.deepEqual(resolveAutonomy({ identity: { kind: "personal" }, autonomyLevel: "full-auto", techContacts: [] }).level, "full-auto");
  const biz = resolveAutonomy({ identity: { kind: "business" }, autonomyLevel: "safe-auto", techContacts: [] });
  assert.equal(biz.level, "approve-first"); assert.equal(biz.clamped, true);
  assert.equal(resolveAutonomy({ identity: { kind: "business" }, autonomyLevel: "observe", techContacts: [] }).level, "observe", "observe is never escalated by the clamp");
  assert.equal(resolveAutonomy({ identity: { kind: "business" }, autonomyLevel: "safe-auto", techContacts: [{ email: "it@acme.com" }] }).level, "safe-auto", "a tech contact lifts the clamp");
}
t();

// 5 — level → existing mode machine; full-auto needs the opt-in guard (the caller enforces canEnableAutonomous).
{
  assert.deepEqual(autonomyLevelToMode("observe"), { mode: "manual", notify: true, requiresOptIn: false });
  assert.deepEqual(autonomyLevelToMode("approve-first"), { mode: "manual", notify: true, requiresOptIn: false });
  assert.deepEqual(autonomyLevelToMode("safe-auto"), { mode: "confirmed", notify: true, requiresOptIn: false });
  assert.deepEqual(autonomyLevelToMode("full-auto"), { mode: "autonomous", notify: true, requiresOptIn: true });
  assert.equal(autonomyLevelToMode("junk").mode, "confirmed");
}
t();

// 6 — static wiring: renderer renders the six new steps + the original six; Settings has "Autonomy & contacts";
//     main has setup:get / setup:update-prefs / approve / deny / keep-dry-run; preload bridges them; opt-in guard kept.
const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const rjs = rd("src", "renderer", "renderer.js");
const idx = rd("src", "renderer", "index.html");
const main = rd("src", "main", "main.mjs");
const preload = rd("src", "main", "preload.cjs");
{
  for (const id of ["setup-identity", "setup-contacts", "setup-autonomy", "setup-approver", "setup-reports", "setup-window"]) assert.match(rjs, new RegExp(`id: "${id}"`), `wizard step ${id} rendered`);
  for (const kicker of ["Welcome", "License", "Mode", "ARIA Chat", "Notifications", "Done"]) assert.match(rjs, new RegExp(`kicker: "${kicker}"`), `original step ${kicker} intact`);
  const stepsBlock = rjs.slice(rjs.indexOf("const SETUP_STEPS = ["), rjs.indexOf("let setupStep = 0;"));
  assert.ok(stepsBlock.indexOf('kicker: "Done"') < stepsBlock.indexOf('id: "setup-identity"'), "v2 steps come AFTER the original six (appended, not inserted)");
  // 2026-10-14 (review P1-1) — EXPECTATION CHANGED ON PURPOSE: the owner's decision is "Confirmed asks once, every time; it
  // never executes unattended", so the Safe-auto (Confirmed) card no longer says "I fix the safe things myself and tell you after".
  for (const c of ["I find it, I tell you, I touch nothing.", "I ask you once per fix, then fix it with you present.", "I ask before every fix.", "I fix green and yellow inside your maintenance window and report."]) assert.ok(rjs.includes(c), `card consequence copy present: ${c}`);
  assert.ok(!rjs.includes("I fix the safe things myself and tell you after."), "the old Safe-auto promise (unattended green fixes) is gone");
  assert.match(rjs, /setupFullAutoUnderstood/, "full-auto card reveals an explicit understanding checkbox");
  assert.match(rjs, /parseContactLines/, "tech contacts parsed from one-per-line input");
  assert.match(idx, /id="autonomy"/, "Settings hosts the Autonomy & contacts section");
  assert.match(idx, /data-anchor="autonomy"/, "sidebar sub-anchor for Autonomy & contacts");
  assert.match(idx, /id="saveAutonomyPrefs"/, "Save button"); assert.match(idx, /id="testNotification"/, "test notification button");
  assert.match(idx, /id="keepDryRunToggle"/, "keep-dry-run checkbox");
  assert.match(idx, /id="approvalsPanel"/, "Control Center hosts the Approvals section");
  assert.match(rjs, /autonomy: \{ tab: "settings", anchor: "autonomy" \}/, "redirect route for #autonomy");
  for (const ch of ["setup:get", "setup:update-prefs", "sentinel:approve-fix", "sentinel:deny-fix", "sentinel:list-approvals", "sentinel:set-keep-dry-run", "sentinel:test-notification"]) {
    assert.match(main, new RegExp(`ipcMain\\.handle\\("${ch}"`), `main handles ${ch}`);
    assert.match(preload, new RegExp(`invoke\\("${ch}"`), `preload bridges ${ch}`);
  }
  assert.match(main, /ipcMain\.handle\("setup:complete"/, "original setup:complete kept");
  assert.match(main, /m === "manual" \|\| m === "confirmed"/, "wizard never sets Autonomous silently (original guard kept)");
  assert.match(main, /canEnableAutonomous\(optIn\)/, "full-auto → autonomous goes through canEnableAutonomous");
  // Rule 15 — every ORIGINAL data-tab + the original setup overlay ids are still present.
  for (const tab of ["dashboard", "aria", "control-center", "recipes", "walkthrough", "compliance-privacy", "reports", "knowledge", "system", "integrations", "settings"]) assert.match(idx, new RegExp(`data-tab="${tab}"`), `original tab ${tab} present`);
  for (const id of ["setupWizard", "setupKicker", "setupTitle", "setupBody", "setupDots", "setupBack", "setupNext", "reRunSetup"]) assert.match(idx, new RegExp(`id="${id}"`), `original setup element #${id} present`);
}
t();

assert.equal(n, 6, "6 setup-wizard-v2 groups");
console.log(`setup-wizard-v2 test passed (${n} groups · defaults · sanitize/clamp · merge + legacy normalize · business clamp · level→mode · 6 appended steps + Settings section + IPC + Rule 15 tabs/ids intact).`);
