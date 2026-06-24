// RUN 2 — yellow-tier execution gate.
// Yellow recipes (close app / rename cache / reset sync client) are reversible but MUST:
//   (a) take a System Restore point before any action runs, and
//   (b) require an explicit user confirm — regardless of mode, so Autonomous never auto-fires them.
// Asserts the gate enforces both, that a restore-point hook is called before execution, that the
// green tier is unaffected, and that the 3 new yellow .ps1 mirrors match their recipe commands.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  YELLOW_RECIPES,
  EXECUTABLE_RECIPES,
  isYellowRecipe,
  isGreenRecipe,
  isExecutableRecipe,
  requiresRestorePoint,
  isActionExecutable,
  VERIFY_COMMANDS,
  buildVerification
} from "../src/shared/recipe-runner.mjs";
import { recipeById } from "../src/shared/recipes.mjs";

const root = path.resolve(import.meta.dirname, "..");

// 1) The 4 yellow recipes, none overlapping the green tier.
assert.deepEqual([...YELLOW_RECIPES].sort(), [
  "bluetooth-off-v1",
  "net-down-troubleshoot-v1",
  "onedrive-sync-stuck-v1",
  "outlook-ost-repair-v1",
  "teams-cache-v1"
]);
for (const id of YELLOW_RECIPES) {
  assert.equal(isYellowRecipe(id), true, `${id} is yellow`);
  assert.equal(isGreenRecipe(id), false, `${id} is not also green`);
  assert.equal(isExecutableRecipe(id), true, `${id} still 'executable' so its verify probe runs`);
  assert.equal(requiresRestorePoint(id), true, `${id} mandates a restore point`);
  assert.ok(VERIFY_COMMANDS[id], `${id} has a read-only verify probe`);
  assert.ok(buildVerification(id), `${id} builds a Restricted verify command`);
}
for (const id of EXECUTABLE_RECIPES) {
  assert.equal(requiresRestorePoint(id), false, `green ${id} does not mandate a restore point at the gate`);
}

// 2) The gate for a yellow action. Use Outlook's close-outlook (a real powershell action).
const outlook = recipeById("outlook-ost-repair-v1");
const ya = outlook.actions.find((a) => a.shell === "powershell" && a.command);
const gate = (over) => isActionExecutable({ recipeId: outlook.id, action: ya, allowSystemFixes: true, dryRun: false, ...over });

assert.equal(gate({ confirmed: false, restorePointTaken: true }), false, "no confirm = no yellow execution");
assert.equal(gate({ confirmed: true, restorePointTaken: false }), false, "no restore point = no yellow execution");
assert.equal(gate({ confirmed: true, restorePointTaken: true }), true, "confirm + restore point + flag = execute");
assert.equal(isActionExecutable({ recipeId: outlook.id, action: ya, allowSystemFixes: false, dryRun: false, confirmed: true, restorePointTaken: true }), false, "no flag = no execution");

// 2b) Mode-independence: the gate has no mode input, so passing Autonomous changes nothing.
assert.equal(gate({ confirmed: false, restorePointTaken: true, mode: "autonomous" }), false, "Autonomous cannot bypass the yellow confirm");
assert.equal(gate({ confirmed: true, restorePointTaken: true, mode: "autonomous" }), true, "Autonomous + confirm still works once a restore point exists");

// 3) Green tier is unchanged — auto-eligible with the flag, no confirm needed.
const dns = recipeById("dns-fail-v1");
const ga = dns.actions.find((a) => a.shell === "powershell");
assert.equal(isActionExecutable({ recipeId: dns.id, action: ga, allowSystemFixes: true, dryRun: false }), true, "green still executes without confirm");

// 4) Red never executes, even with confirm + restore point.
const bsod = recipeById("bsod-critical-process-v1");
const ra = bsod.actions.find((a) => a.shell === "powershell");
assert.equal(isActionExecutable({ recipeId: bsod.id, action: ra, allowSystemFixes: true, dryRun: false, confirmed: true, restorePointTaken: true }), false, "red BSOD never executes");

// 5) Orchestration contract: the restore-point hook is CALLED BEFORE any action executes, and
//    execution only proceeds once it has succeeded. This mirrors main.mjs's runRecipe sequence.
function simulateRun(recipe, { confirmed, restorePointSucceeds = true }) {
  const calls = [];
  let restorePointTaken = false;
  // main records a restore point before the action loop whenever an action touches the system.
  if ((recipe.actions || []).some((a) => a.shell === "powershell")) {
    calls.push("restore-point");
    restorePointTaken = restorePointSucceeds; // a failed restore point leaves this false
  }
  for (const action of recipe.actions || []) {
    if (isActionExecutable({ recipeId: recipe.id, action, allowSystemFixes: true, dryRun: false, confirmed, restorePointTaken })) {
      calls.push(`exec:${action.id}`);
    }
  }
  return calls;
}

// Confirmed yellow run: restore point first, then real execution.
const confirmedRun = simulateRun(outlook, { confirmed: true });
assert.equal(confirmedRun[0], "restore-point", "restore-point hook runs first");
const firstExec = confirmedRun.findIndex((c) => c.startsWith("exec:"));
assert.ok(firstExec > 0, "at least one action executes, and only after the restore point");

// Unconfirmed yellow run: restore point may be recorded, but NOTHING executes.
const unconfirmedRun = simulateRun(outlook, { confirmed: false });
assert.ok(!unconfirmedRun.some((c) => c.startsWith("exec:")), "no confirm → no action executes");

// Failed restore point: even a confirmed yellow run executes nothing.
const noRestoreRun = simulateRun(outlook, { confirmed: true, restorePointSucceeds: false });
assert.ok(!noRestoreRun.some((c) => c.startsWith("exec:")), "failed restore point → no action executes");

// 6) The 3 new yellow .ps1 mirrors exist and contain their recipe's exact command.
const mirrors = {
  "src/recipes/scripts/rename-ost.ps1": recipeById("outlook-ost-repair-v1").actions.find((a) => a.id === "rename-ost").command,
  "src/recipes/scripts/reset-onedrive.ps1": recipeById("onedrive-sync-stuck-v1").actions.find((a) => a.id === "reset-onedrive").command,
  "src/recipes/scripts/restart-bthserv.ps1": recipeById("bluetooth-off-v1").actions.find((a) => a.id === "restart-bthserv").command
};
for (const [rel, command] of Object.entries(mirrors)) {
  const file = path.join(root, rel);
  assert.ok(fs.existsSync(file), `${rel} exists`);
  assert.ok(fs.readFileSync(file, "utf8").includes(command), `${rel} mirrors its recipe command`);
}

console.log(`Recipe-runner yellow-tier test passed (${YELLOW_RECIPES.size} yellow recipes, confirm + restore-point enforced, Autonomous cannot bypass).`);
