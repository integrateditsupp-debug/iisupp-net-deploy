// A2 test — real recipe execution gate + argv builder.
// Asserts: only the 3 reversible greens are executable; the argv is always Restricted policy
// + positional command; risky recipes never execute even with the flag on; the 3 .ps1
// source mirrors exist and match their recipe commands; the denylist blocks destructive verbs.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  EXECUTABLE_RECIPES,
  isExecutableRecipe,
  isActionExecutable,
  buildExecution,
  buildVerification,
  VERIFY_COMMANDS
} from "../src/shared/recipe-runner.mjs";
import { recipeById, RECIPES } from "../src/shared/recipes.mjs";

const root = path.resolve(import.meta.dirname, "..");

// 1) The GREEN tier — auto-eligible reversible recipes. RUN 1 took this 3 → 8; RUN 2 moved
//    teams-cache-v1 to the yellow tier (kill-app + clear-cache must never auto-fire), leaving 7.
assert.deepEqual([...EXECUTABLE_RECIPES].sort(), [
  "audio-no-output-v1",
  "disk-low-space-v1",
  "dns-fail-v1",
  "printer-spooler-v1",
  "svc-audiosrv-stopped-v1",
  "svc-bits-stopped-v1",
  "svc-dnscache-stopped-v1",
  "svc-rasman-stopped-v1",
  "svc-spooler-stopped-v1",
  "svc-wlansvc-stopped-v1",
  "svc-workstation-stopped-v1",
  "svc-wuauserv-stopped-v1",
  "vpn-connect-fail-v1",
  "wifi-no-internet-v1",
  "windows-update-stuck-v1"
]);
assert.equal(EXECUTABLE_RECIPES.size, 15, "7 original + 8 RUN 7 service-restart greens");
assert.equal(isExecutableRecipe("dns-fail-v1"), true);
assert.equal(isExecutableRecipe("teams-cache-v1"), true, "yellow recipes are still 'executable' (verify path runs)");
assert.equal(isExecutableRecipe("bsod-critical-process-v1"), false, "red BSOD recipe is never executable");

// 1b) Every one of the 8 has at least one powershell action that clears the gate (flag on, not dry-run).
for (const id of EXECUTABLE_RECIPES) {
  const recipe = recipeById(id);
  assert.ok(recipe, `${id} exists in the registry`);
  const live = (recipe.actions || []).find((a) =>
    isActionExecutable({ recipeId: id, action: a, allowSystemFixes: true, dryRun: false }));
  assert.ok(live, `${id} has a real-executable action`);
  // …and that same action is held to dry-run without the flag.
  assert.equal(isActionExecutable({ recipeId: id, action: live, allowSystemFixes: false, dryRun: false }), false, `${id} needs the flag`);
}

// 2) argv is always Restricted + positional command.
const flush = recipeById("dns-fail-v1").actions[0];
const exec = buildExecution(flush);
assert.equal(exec.file, "powershell.exe");
assert.deepEqual(exec.args.slice(0, 5), ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Restricted", "-Command"]);
assert.equal(exec.args[5], "ipconfig /flushdns", "command passed positionally, not shell-joined");

// 3) The gate: requires flag ON, not dry-run, AND an allow-listed recipe.
assert.equal(isActionExecutable({ recipeId: "dns-fail-v1", action: flush, allowSystemFixes: true, dryRun: false }), true);
assert.equal(isActionExecutable({ recipeId: "dns-fail-v1", action: flush, allowSystemFixes: false, dryRun: false }), false, "no flag = no real exec");
assert.equal(isActionExecutable({ recipeId: "dns-fail-v1", action: flush, allowSystemFixes: true, dryRun: true }), false, "dry-run = no real exec");

// 4) A risky recipe stays dry-run EVEN with the flag on and dry-run off — for both a red and a yellow.
const bsodAction = recipeById("bsod-critical-process-v1").actions.find((a) => a.shell === "powershell");
assert.equal(isActionExecutable({ recipeId: "bsod-critical-process-v1", action: bsodAction, allowSystemFixes: true, dryRun: false }), false, "red BSOD never auto-executes");
const yellowRecipe = recipeById("onedrive-sync-stuck-v1");
assert.equal(yellowRecipe.risk, "yellow", "onedrive recipe is the yellow control case");
const yellowAction = yellowRecipe.actions.find((a) => a.shell === "powershell");
assert.equal(isActionExecutable({ recipeId: "onedrive-sync-stuck-v1", action: yellowAction, allowSystemFixes: true, dryRun: false }), false, "a yellow recipe is BLOCKED from real execution even with the flag");

// 5) Denylist blocks destructive verbs even inside an allow-listed recipe.
const evil = { shell: "powershell", command: "Format-Volume -DriveLetter C" };
assert.equal(isActionExecutable({ recipeId: "dns-fail-v1", action: evil, allowSystemFixes: true, dryRun: false }), false, "destructive verb blocked");
const regDelete = { shell: "powershell", command: "reg delete HKLM\\SOFTWARE /f" };
assert.equal(isActionExecutable({ recipeId: "disk-low-space-v1", action: regDelete, allowSystemFixes: true, dryRun: false }), false);

// 6) Manual / non-powershell actions are never executable.
assert.equal(isActionExecutable({ recipeId: "dns-fail-v1", action: { shell: "manual", command: "do thing" }, allowSystemFixes: true, dryRun: false }), false);

// 7) Verification probes exist for all 3, are read-only, Restricted, never reference deletion.
for (const id of EXECUTABLE_RECIPES) {
  const v = buildVerification(id);
  assert.ok(v, `verification exists for ${id}`);
  assert.deepEqual(v.args.slice(0, 4), ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Restricted"]);
  assert.ok(!/remove-item|del |format|reg delete/i.test(VERIFY_COMMANDS[id]), `verify for ${id} is read-only`);
}
assert.equal(buildVerification("not-a-recipe"), null);

// 8) The 3 .ps1 source mirrors exist and contain their recipe's exact command.
const action = (recipeId, actionId) => recipeById(recipeId).actions.find((a) => a.id === actionId).command;
const mirrors = {
  "src/recipes/scripts/flush-dns.ps1": action("dns-fail-v1", "flush-dns"),
  "src/recipes/scripts/clear-temp-files.ps1": action("disk-low-space-v1", "clear-user-temp"),
  "src/recipes/scripts/clear-teams-cache.ps1": action("teams-cache-v1", "clear-cache"),
  // RUN 1 — the 5 newly-cleared reversible recipes + the fuller R-02 DNS follow-on.
  "src/recipes/scripts/restart-wlan.ps1": action("wifi-no-internet-v1", "restart-wlan"),
  "src/recipes/scripts/restart-spooler.ps1": action("printer-spooler-v1", "restart-spooler"),
  "src/recipes/scripts/restart-audio.ps1": action("audio-no-output-v1", "restart-audio"),
  "src/recipes/scripts/restart-rasman.ps1": action("vpn-connect-fail-v1", "restart-rasman"),
  "src/recipes/scripts/restart-update-services.ps1": action("windows-update-stuck-v1", "restart-update-services"),
  "src/recipes/scripts/dns-reregister.ps1": action("dns-fail-v1", "register-dns")
};
for (const [rel, command] of Object.entries(mirrors)) {
  const file = path.join(root, rel);
  assert.ok(fs.existsSync(file), `${rel} exists`);
  const body = fs.readFileSync(file, "utf8");
  assert.ok(body.includes(command), `${rel} mirrors its recipe command exactly`);
}

console.log(`Recipe-execution test passed (${EXECUTABLE_RECIPES.size} reversible greens cleared, ${RECIPES.length - EXECUTABLE_RECIPES.size} stay dry-run, denylist holds).`);
