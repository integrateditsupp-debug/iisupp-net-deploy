// PROD 2026-10-14 (audit M1) — a FRESH INSTALL can actually resolve a fix.
//
// Before this cycle three independent locks meant no fix could ever run live on a customer machine: the env var
// ARIA_SENTINEL_ALLOW_SYSTEM_FIXES=1 (which nothing in the product sets), the vetted-tier policy ("Tier-2 manual
// only" while every Resolve button sends mode:"confirmed"), and the ledger recording a completed dry-run as "abort"
// so the tier could never rise. This suite pins the fixed truth table (pure policy) and the main-process wiring
// (source-level, because main.mjs needs Electron): a persisted consent (`liveFixesEnabled`, default off), a human-
// initiated Tier-2 run allowed in Confirmed, previews recorded as "preview", and plain `copy` on every refusal.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { executionPolicy, recordOutcome, vettedCountOf, emptyHistory, policyCopy } from "../src/main/dry-run-policy.mjs";

const root = path.resolve(import.meta.dirname, "..");
const main = fs.readFileSync(path.join(root, "src/main/main.mjs"), "utf8");
const preload = fs.readFileSync(path.join(root, "src/main/preload.cjs"), "utf8");
let groups = 0; const g = () => { groups++; };

// 1 — Fresh install (0 vetted), Confirmed, a PERSON clicked Resolve → allowed and LIVE (dry-run off by mode default).
let p = executionPolicy({ vettedCount: 0, mode: "confirmed", supervisorVerdict: "approve", humanInitiated: true });
assert.equal(p.tier, 2, "0 vetted runs = Tier-2");
assert.equal(p.allowed, true, "a person may run a Tier-2 fix in Confirmed");
assert.equal(p.dryRun, false, "Confirmed defaults to live");
assert.equal(p.execute, true, "…so it executes");
assert.equal(p.requiresCountdown, true, "with the 10s countdown");
assert.equal(p.canAutoFire, false, "but never auto-fires");
assert.match(p.copy, /countdown/i, "the copy names the countdown the person can stop");
// An approval (someone said yes in Control Center / by email) counts as a person too.
assert.equal(executionPolicy({ vettedCount: 0, mode: "confirmed", supervisorVerdict: "approve", approved: true }).allowed, true, "an approved Tier-2 run is allowed in Confirmed");
g();

// 2 — The same fresh fix with NOBODY present (watcher / deep-link / bridge) is refused — with honest copy, never "Couldn't start".
p = executionPolicy({ vettedCount: 0, mode: "confirmed", supervisorVerdict: "approve", humanInitiated: false });
assert.equal(p.allowed, false, "unattended Tier-2 in Confirmed is refused");
assert.equal(p.execute, false);
assert.equal(typeof p.copy, "string");
assert.ok(p.copy.length > 20 && /person/i.test(p.copy), `refusal copy is plain language: ${p.copy}`);
assert.equal(p.copy, p.reason, "for a refusal, copy is the reason itself (one string for the UI)");
// Autonomous never runs a fresh fix on its own either.
p = executionPolicy({ vettedCount: 0, mode: "autonomous", supervisorVerdict: "approve", humanInitiated: false });
assert.equal(p.allowed, false);
assert.equal(p.canAutoFire, false);
// Default (no human flag passed) stays the safe, pre-existing answer: refused in Confirmed.
assert.equal(executionPolicy({ vettedCount: 0, mode: "confirmed", supervisorVerdict: "approve" }).allowed, false, "default = unattended = refused (RUN 23 behaviour kept)");
g();

// 3 — Live fixes OFF → the run is an honest PREVIEW (the dry-run checkbox / Manual default) with copy that says so.
p = executionPolicy({ vettedCount: 0, mode: "confirmed", dryRunCheckbox: true, supervisorVerdict: "approve", humanInitiated: true });
assert.equal(p.allowed, true);
assert.equal(p.dryRun, true);
assert.equal(p.execute, false, "a preview never executes");
assert.match(p.copy, /preview/i, "the copy says preview");
assert.match(policyCopy({ allowed: true, dryRun: true }), /nothing on this device changes/i, "preview copy promises nothing changes");
g();

// 4 — The ledger: a completed PREVIEW is recorded as "preview" and the vetted count does NOT move (±0);
//     a live success is +1; a veto/abort is −1 floored at 0. So Tier-2 is no longer permanent.
let h = emptyHistory();
h = recordOutcome(h, "flush-dns-cache", "preview");
assert.equal(vettedCountOf(h, "flush-dns-cache"), 0, "preview does not decrement");
h = recordOutcome(h, "flush-dns-cache", "success");
assert.equal(vettedCountOf(h, "flush-dns-cache"), 1, "live success +1");
h = recordOutcome(h, "flush-dns-cache", "preview");
assert.equal(vettedCountOf(h, "flush-dns-cache"), 1, "preview after a success does not decrement either");
assert.equal(h.recipes["flush-dns-cache"].runs.filter((r) => r.outcome === "preview").length, 2, "previews are still recorded in the run list");
h = recordOutcome(h, "flush-dns-cache", "abort");
assert.equal(vettedCountOf(h, "flush-dns-cache"), 0, "abort −1");
g();

// 5 — Nothing named after a person leaks into the policy object the IPC returns (audit M32): the operator-prompt
//     flag is `requiresOperatorPrompt`; the legacy alias still READS but does not serialize.
p = executionPolicy({ vettedCount: 0, mode: "manual", supervisorVerdict: "approve" });
assert.equal(p.requiresOperatorPrompt, true);
assert.equal(p.requiresAhmadPrompt, true, "legacy alias still readable (Rule 15)");
assert.ok(!JSON.stringify(p).includes("Ahmad"), "…but never serialized into an IPC result");
assert.ok(!Object.keys(p).includes("requiresAhmadPrompt"));
g();

// 6 — main.mjs wiring (source-level): the consent gate replaces the env-only const; env 1/0 still forces; the
//     IPC pair exists; preview is recorded; the direct run-recipe channel is preview-only.
assert.doesNotMatch(main, /const allowSystemFixes = process\.env\.ARIA_SENTINEL_ALLOW_SYSTEM_FIXES === "1";/, "env-only const is gone");
assert.match(main, /function allowSystemFixes\(\)[\s\S]*?store\.get\("liveFixesEnabled"\) === true/, "the gate reads the persisted consent");
assert.match(main, /if \(env === "1"\) return true;\s*\n\s*if \(env === "0"\) return false;/, "env =1 forces on, =0 forces off");
assert.doesNotMatch(main, /[^.\w]allowSystemFixes \|\||[^.\w]!allowSystemFixes \|\|/, "no bare (non-call) reads of the old const remain");
assert.match(main, /ipcMain\.handle\("sentinel:get-live-fixes"/, "get-live-fixes IPC");
assert.match(main, /ipcMain\.handle\("sentinel:set-live-fixes"/, "set-live-fixes IPC");
assert.match(main, /store\.set\("liveFixesEnabled", enabled\)/, "set persists liveFixesEnabled");
assert.match(main, /logEvent\("POLICY", `Live fixes \$\{enabled \? "ENABLED" : "DISABLED"\}/, "the change is audit-logged");
assert.match(main, /source: env === "1" \|\| env === "0" \? "env" : "store"|const source = env === "1" \|\| env === "0" \? "env" : "store"/, "status reports its source");
assert.match(main, /elevation = process\.platform === "win32" \? "uac" : "none"/, "status reports the elevation path");
assert.match(main, /humanInitiated, approved \}\)/, "executionPolicy is told who asked");
assert.match(main, /ran \? "success" : previewed \? "preview" : "abort"/, "a completed preview is recorded as preview");
assert.match(main, /verdict: "policy", reason: policy\.reason, policy, countdown: false, copy: policy\.copy/, "the policy refusal carries copy");
assert.match(main, /verdict: "veto", reason: verdict\.reason, copy:/, "the supervisor veto carries copy");
assert.match(main, /error: "r11_blocked", surface: "1 personal folder excluded", copy:/, "the R11 refusal carries copy");
assert.match(main, /ipcMain\.handle\("sentinel:run-recipe", \(_event, recipeId, options\) => runRecipe\(recipeId, \{ \.\.\.\(options \|\| \{\}\), dryRun: true/, "direct run-recipe is preview-only (audit M18)");
assert.match(main, /liveFixes: liveFixesStatus\(\)/, "state carries liveFixes");
g();

// 7 — preload exposes exactly the contract the renderer wires: getLiveFixes() and setLiveFixes({enabled}).
assert.match(preload, /getLiveFixes: \(\) => ipcRenderer\.invoke\("sentinel:get-live-fixes"\)/);
assert.match(preload, /setLiveFixes: \(enabled\) => ipcRenderer\.invoke\("sentinel:set-live-fixes", \{ enabled:/);
g();

assert.equal(groups, 7);
console.log(`fresh-install-resolve test passed (${groups} groups · Tier-2 person-run allowed in Confirmed · unattended refused with copy · preview ±0 · consent gate + IPC wired · no personal names in IPC).`);
