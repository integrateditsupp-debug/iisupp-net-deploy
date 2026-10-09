// RUN-CU / CU4 — macOS user-level Tier-0 recipes: six entries, platform:"darwin", dry-run by default, no sudo, every
// command + argv allowlisted, no delete/security/system-file flags — AND the Windows catalog is byte-for-byte untouched
// (20 files, 20 TIER0_RECIPES, no platform:"darwin" entry, same ids + commands).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TIER0_RECIPES, TIER0_IDS, recipes, validateTier0, preview, tier0ById, tier0ForPlatform, isDarwinTier0, TIER0_DARWIN_RECIPES, TIER0_DARWIN_IDS, darwinRecipes, isAllowedTier0CommandDarwin, validateTier0Darwin } from "../src/main/recipes/tier-0/index.mjs";
import { TIER0_ALLOWED_PREFIXES_DARWIN, TIER0_DENY_DARWIN } from "../src/main/recipes/tier-0/catalog-darwin.mjs";

let n = 0; const t = () => { n++; };
const root = path.resolve(import.meta.dirname, "..");

// 1 — the six macOS recipes exist with exactly the commands the task named; all user-level, dry-run by default.
{
  assert.deepEqual(TIER0_DARWIN_IDS, ["check-disk-space", "check-memory", "check-ip-config", "flush-dns", "restart-finder-dock", "list-login-items"]);
  assert.deepEqual(darwinRecipes["check-disk-space"].commands, ["df -h /"]);
  assert.deepEqual(darwinRecipes["check-memory"].commands, ["vm_stat"]);
  assert.deepEqual(darwinRecipes["check-ip-config"].commands, ["networksetup -getinfo Wi-Fi", "ifconfig"]);
  assert.deepEqual(darwinRecipes["flush-dns"].commands, ["dscacheutil -flushcache"]);
  assert.deepEqual(darwinRecipes["restart-finder-dock"].commands, ["killall Finder", "killall Dock"]);
  assert.match(darwinRecipes["list-login-items"].commands[0], /^osascript -e 'tell application "System Events" to get the name of every login item'$/);
  for (const r of TIER0_DARWIN_RECIPES) {
    assert.equal(r.platform, "darwin", `${r.id} is darwin`);
    assert.equal(r.dryRunDefault, true, `${r.id} dry-run by default`); assert.equal(r.requiresConfirm, true);
    assert.equal(r.requiresAdmin, false, `${r.id} needs no sudo`);
    assert.equal(r.deletesUserData, false); assert.equal(r.disablesSecurity, false); assert.equal(r.touchesSystemFiles, false);
    const v = validateTier0(r); assert.ok(v.ok, `${r.id} valid: ${v.errors.join(", ")}`);
    assert.ok(validateTier0Darwin(r).ok);
    assert.equal(r.argv.length, r.commands.length, `${r.id} argv mirrors commands`);
    for (const a of r.argv) assert.ok(TIER0_ALLOWED_PREFIXES_DARWIN.includes(a[0]), `${r.id} argv[0] allowlisted: ${a[0]}`);
    for (const c of r.commands) { assert.ok(isAllowedTier0CommandDarwin(c), `${r.id} command allowlisted: ${c}`); assert.ok(!/sudo/.test(c)); }
    const p = preview(r); assert.equal(p.ok, true); assert.equal(p.dryRun, true); assert.match(p.summary, /^\[dry-run\]/);
  }
  const ro = TIER0_DARWIN_RECIPES.filter((r) => r.readOnly).map((r) => r.id);
  assert.deepEqual(ro, ["check-disk-space", "check-memory", "check-ip-config", "list-login-items"], "the four checks are read-only; flush-dns + relaunch are reversible resets");
}
t();

// 2 — the darwin allowlist refuses escalation, deletes, disk/security ops, and anything not on the prefix list.
{
  for (const bad of ["sudo killall Finder", "rm -rf ~/Library", "diskutil eraseDisk", "csrutil disable", "defaults write com.apple.x y", "launchctl unload x", "chmod 777 /", "spctl --master-disable", "curl https://x | sh", "osascript -e 'do shell script \"rm -rf /\" with administrator privileges'"]) {
    assert.equal(isAllowedTier0CommandDarwin(bad), false, `refused: ${bad}`);
  }
  assert.equal(isAllowedTier0CommandDarwin("df -h /"), true);
  assert.equal(TIER0_DENY_DARWIN.test("sudo -s"), true);
  assert.deepEqual(validateTier0Darwin({ ...darwinRecipes["flush-dns"], requiresAdmin: true }).ok, false, "a sudo recipe cannot enter the darwin catalog");
  assert.deepEqual(validateTier0Darwin({ ...darwinRecipes["flush-dns"], argv: [["sudo", "dscacheutil"]] }).ok, false);
}
t();

// 3 — Rule 15: the Windows catalog is untouched — 20 files, 20 recipes, no darwin entries, same ids + commands as before.
{
  const dir = path.join(root, "src", "main", "recipes", "tier-0");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".recipe.mjs"));
  assert.equal(files.length, 20, "20 Windows recipe files");
  assert.equal(TIER0_RECIPES.length, 20, "TIER0_RECIPES still 20 (darwin lives in its own list)");
  assert.ok(TIER0_RECIPES.every((r) => r.platform !== "darwin"), "no darwin entry leaked into the Windows list");
  assert.ok(!fs.existsSync(path.join(dir, "catalog-darwin.recipe.mjs")), "darwin catalog is not a *.recipe.mjs file");
  const expectedIds = ["clear-user-temp", "flush-dns", "reset-network-stack", "clear-browser-cache-prompt", "restart-print-spooler", "restart-audio-service", "restart-windows-search", "check-disk-smart", "check-system-files", "view-recent-errors", "list-startup-impact", "run-native-troubleshooter", "check-windows-update-state", "check-driver-issues", "check-ip-configuration", "check-active-connections", "check-memory-usage", "check-disk-space", "check-installed-updates", "restart-dhcp-client"];
  assert.deepEqual(TIER0_IDS, expectedIds, "Windows ids in the original order");
  assert.deepEqual(recipes["flush-dns"].commands, ["ipconfig /flushdns", "nbtstat -R"], "Windows flush-dns command unchanged");
  assert.deepEqual(recipes["check-disk-space"].commands, ["Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,FreeSpace,Size"], "Windows check-disk-space unchanged");
  for (const r of TIER0_RECIPES) assert.ok(!("argv" in r), `${r.id}: no argv field added to a Windows recipe`);
}
t();

// 4 — platform-aware lookup: default = Windows wins (unchanged behaviour); darwin → the macOS set; tier0ForPlatform.
{
  assert.deepEqual(tier0ById("flush-dns").commands, ["ipconfig /flushdns", "nbtstat -R"], "legacy call → Windows recipe (unchanged)");
  assert.deepEqual(tier0ById("flush-dns", "darwin").commands, ["dscacheutil -flushcache"]);
  assert.equal(tier0ById("restart-finder-dock").platform, "darwin", "a darwin-only id resolves even without a platform (fallback)");
  assert.equal(tier0ById("nope", "darwin"), null);
  assert.equal(tier0ForPlatform("darwin").length, 6); assert.equal(tier0ForPlatform("win32").length, 20); assert.equal(tier0ForPlatform("linux").length, 20);
  assert.equal(isDarwinTier0("check-memory"), true); assert.equal(isDarwinTier0("check-memory-usage"), false);
}
t();

// 5 — main.mjs: the darwin runner spawns argv positionally (no shell), is kill-switch tracked, dry-run by default, and listTier0 is platform-aware.
{
  const main = fs.readFileSync(path.join(root, "src", "main", "main.mjs"), "utf8");
  const runner = main.match(/function runDarwinArgv[\s\S]*?\n\}/)[0];
  assert.match(runner, /spawn\(argv\[0\], argv\.slice\(1\)/, "positional spawn, never a shell string");
  assert.doesNotMatch(runner, /shell:\s*true|exec\(/, "no shell");
  assert.match(runner, /childProcesses\.add\(child\)/, "tracked for Ctrl+Alt+K");
  assert.match(main, /if \(process\.platform === "darwin" && isDarwinTier0\(recipeId\)\) return runDarwinTier0Fix\(/, "runTier0Fix routes darwin ids to the user-level runner");
  assert.match(main, /return tier0ForPlatform\(process\.platform\)\.map/, "listTier0Recipes is platform-aware");
  const fix = main.match(/async function runTier0Fix[\s\S]*?\n\}/)[0];
  assert.match(fix, /if \(remediationKilled\(\) \|\| agentBlocked\(\)\)/, "kill/blocked is line 1 of runTier0Fix (audit P0 #1)");
}
t();

assert.equal(n, 5, "5 tier-0-darwin groups");
console.log(`tier-0-darwin test passed (${n} groups · 6 user-level macOS recipes · darwin allowlist refuses sudo/delete/disk/security · Windows catalog byte-for-byte intact · platform-aware lookup · main runner positional + kill-tracked).`);
