// RUN 23 §2 — findings → action mapper. Every finding maps to the safest next step; only service/network
// fixes require confirm; low-risk reads bypass the countdown; the Tier-0 catalog is the recipe source.
import assert from "node:assert/strict";
import { recommendAction, recommendActions, snapshotFindings, riskOfRecipe } from "../src/shared/recommend-action.mjs";

// 1 — frozen → end-task, low, no confirm (bypasses the countdown).
const frozen = recommendAction({ type: "frozen", name: "Notepad", pid: 42 });
assert.equal(frozen.action, "end-task");
assert.equal(frozen.risk, "low");
assert.equal(frozen.confirmRequired, false);
assert.equal(frozen.pid, 42);

// 2/3 — cpu-hog + ram-hog → investigate (read-only Tier-0), low, no confirm.
assert.equal(recommendAction({ type: "cpu-hog", name: "chrome" }).action, "investigate");
assert.equal(recommendAction({ type: "cpu-hog", name: "chrome" }).recipeId, "list-startup-impact");
assert.equal(recommendAction({ type: "ram-hog", name: "Teams" }).risk, "low");

// 4 — odd → passive info card.
assert.equal(recommendAction({ type: "odd", name: "x.exe" }).action, "info");
assert.equal(recommendAction({ type: "odd", name: "x.exe" }).confirmRequired, false);

// 5/6/7 — stopped known services map to their vetted Tier-0 restart recipe (medium, confirm).
assert.equal(recommendAction({ type: "service-stopped", service: "Spooler" }).recipeId, "restart-print-spooler");
assert.equal(recommendAction({ type: "service-stopped", service: "Spooler" }).risk, "medium");
assert.equal(recommendAction({ type: "service-stopped", service: "Spooler" }).confirmRequired, true);
assert.equal(recommendAction({ type: "service-stopped", service: "WSearch" }).recipeId, "restart-windows-search");
assert.equal(recommendAction({ type: "service-stopped", service: "AudioSrv" }).recipeId, "restart-audio-service");

// 8 — unknown stopped service → generic restart, no recipe, manual review, still medium + confirm.
const unknownSvc = recommendAction({ type: "service-stopped", service: "Foobar" });
assert.equal(unknownSvc.recipeId, null);
assert.equal(unknownSvc.confirmRequired, true);
assert.match(unknownSvc.label, /manual review/);

// 9 — network-down → reset-network-stack, HIGH risk (reboot), confirm.
const net = recommendAction({ type: "network-down" });
assert.equal(net.recipeId, "reset-network-stack");
assert.equal(net.risk, "high");
assert.equal(net.confirmRequired, true);

// 10 — 🔒 R11: a finding referencing the off-limits folder → passive "1 personal folder excluded", no action.
const blocked = recommendAction({ type: "frozen", name: "C:/Users/bob/Private pics and Vids/clip.mp4" });
assert.equal(blocked.action, "none");
assert.equal(blocked.recipeId, null);
assert.doesNotMatch(JSON.stringify(blocked), /private pics and vids/i);

// 11 — riskOfRecipe derives from catalog flags (reboot=high, read-only=low, Stop/Start=medium).
assert.equal(riskOfRecipe("reset-network-stack"), "high");
assert.equal(riskOfRecipe("check-disk-smart"), "low");
assert.equal(riskOfRecipe("restart-print-spooler"), "medium");
assert.equal(riskOfRecipe("nonexistent"), "medium");

// 12 — snapshot flatten + recommendActions over a whole snapshot (+ services).
const snap = { frozen: [{ name: "a", pid: 1 }], cpuHogs: [{ name: "b", pid: 2, cpu: 90 }], ramHogs: [], odd: [] };
const flat = snapshotFindings(snap, [{ service: "Spooler" }]);
assert.equal(flat.length, 3);
assert.equal(flat[2].type, "service-stopped");
const recs = recommendActions(snap, [{ service: "Spooler" }]);
assert.equal(recs.length, 3);
assert.equal(recs[0].action, "end-task");
assert.equal(recs[2].recipeId, "restart-print-spooler");
assert.ok(recs.every((r) => "finding" in r && "risk" in r));

console.log("Recommend-action test passed (12 finding→action maps · Tier-0 catalog · risk tiers · R11 short-circuit).");
