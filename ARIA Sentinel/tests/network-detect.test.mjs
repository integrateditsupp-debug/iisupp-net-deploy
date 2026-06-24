// RUN 13 — internet-down detection (§6): 2 consecutive reachability failures emit NET.DOWN once.
import assert from "node:assert/strict";
import { evaluateConnectivity } from "../src/sub-agents/detection/network-watcher.mjs";
import { recipeById } from "../src/shared/recipes.mjs";

let state = { fails: 0, down: false };

// One failure → no signal.
let r = evaluateConnectivity(state, false);
state = r.state;
assert.deepEqual(r.signals, [], "single failure does not fire");
assert.equal(state.fails, 1);

// Second consecutive failure → NET.DOWN, exactly once.
r = evaluateConnectivity(state, false);
state = r.state;
assert.deepEqual(r.signals, [{ signal: "NET.DOWN", hint: "internet-unreachable" }], "2 consecutive → NET.DOWN");
assert.equal(state.down, true);

// Still down on the next failure → no duplicate emit (edge-triggered).
r = evaluateConnectivity(state, false);
state = r.state;
assert.deepEqual(r.signals, [], "no duplicate while still down");

// Reachable again → resets, no signal.
r = evaluateConnectivity(state, true);
state = r.state;
assert.equal(state.fails, 0);
assert.equal(state.down, false);
assert.deepEqual(r.signals, []);

// A single blip between successes never fires.
let s2 = { fails: 0, down: false };
s2 = evaluateConnectivity(s2, true).state;
s2 = evaluateConnectivity(s2, false).state;
const blip = evaluateConnectivity(s2, true);
assert.deepEqual(blip.signals, [], "blip (1 fail then ok) does not fire");

// The NET.DOWN.TROUBLESHOOT recipe exists, is yellow, and renews/flushes/restarts then re-tests.
const recipe = recipeById("net-down-troubleshoot-v1");
assert.ok(recipe, "net-down recipe exists");
assert.equal(recipe.risk, "yellow", "always confirms (restarts connectivity services)");
const cmds = recipe.actions.map((a) => a.command).join(" ");
assert.match(cmds, /ipconfig \/flushdns/);
assert.match(cmds, /Restart-Service Dnscache,Dhcp/);

console.log("Network-detect test passed (2 consec → NET.DOWN once · blip ignored · yellow troubleshoot recipe).");
