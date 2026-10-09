// RUN-CU / CU4 (2026-10-08) — macOS Tier-0 "safe-generic" recipes. USER-LEVEL ONLY (no sudo, no admin
// prompt, nothing under /System or /Library): read-only diagnostics plus two reversible resets (DNS cache,
// Finder/Dock relaunch — both come straight back). Dry-run by default like every Tier-0 recipe.
//
// Kept in its OWN catalog (not <name>.recipe.mjs) so the Windows catalog — 20 files, TIER0_RECIPES — is
// byte-for-byte untouched (Rule 15; proven by tests/tier-0-darwin.test.mjs). `platform: "darwin"` marks
// every entry; index.mjs resolves by platform. `argv` is the positional spawn form (no shell string); the
// `commands` strings are the human-readable preview the UI shows.
import { TIER0 } from "./catalog.mjs";

// Allowed first tokens for a darwin Tier-0 command (defense in depth; validated per recipe).
export const TIER0_ALLOWED_PREFIXES_DARWIN = Object.freeze(["df", "vm_stat", "networksetup", "ifconfig", "dscacheutil", "killall", "osascript"]);
// Never-allowed on macOS Tier-0: privilege escalation, deletes, disk ops, security changes, writes under /System.
export const TIER0_DENY_DARWIN = /\b(sudo|rm\s+-rf|rm\s+-r|diskutil|csrutil|spctl|launchctl\s+(unload|bootout|disable)|defaults\s+write|chmod|chown|dd\s+if|mkfs|nvram|systemsetup|security\s+(delete|set)|tmutil\s+delete)\b/i;

const def = (o) => ({
  tier: TIER0,
  platform: "darwin",
  readOnly: false,
  touchesSystemFiles: false,
  deletesUserData: false,
  disablesSecurity: false,
  requiresReboot: false,
  requiresConfirm: true,
  dryRunDefault: true,
  requiresAdmin: false,
  ...o
});

export const darwinRecipes = {
  "check-disk-space": def({
    id: "check-disk-space", title: "Check free disk space", category: "slow-performance", readOnly: true,
    whatItDoes: "Shows free and used space on the startup disk (read-only).",
    commands: ["df -h /"],
    argv: [["df", "-h", "/"]]
  }),
  "check-memory": def({
    id: "check-memory", title: "Check memory pressure", category: "slow-performance", readOnly: true,
    whatItDoes: "Reads virtual-memory statistics (read-only) to see whether low memory is causing slowness.",
    commands: ["vm_stat"],
    argv: [["vm_stat"]]
  }),
  "check-ip-config": def({
    id: "check-ip-config", title: "Show network configuration", category: "no-internet", readOnly: true,
    whatItDoes: "Shows the Wi-Fi service's IP, router and DNS plus interface state (read-only).",
    commands: ["networksetup -getinfo Wi-Fi", "ifconfig"],
    argv: [["networksetup", "-getinfo", "Wi-Fi"], ["ifconfig"]]
  }),
  "flush-dns": def({
    id: "flush-dns", title: "Flush DNS cache", category: "no-internet",
    whatItDoes: "Clears the directory-services DNS cache so stale lookups stop failing. Reversible: the cache rebuilds itself.",
    commands: ["dscacheutil -flushcache"],
    argv: [["dscacheutil", "-flushcache"]]
  }),
  "restart-finder-dock": def({
    id: "restart-finder-dock", title: "Relaunch Finder and Dock", category: "app-crashes",
    whatItDoes: "Quits Finder and the Dock; macOS relaunches both immediately. Open windows reopen; nothing is deleted.",
    commands: ["killall Finder", "killall Dock"],
    argv: [["killall", "Finder"], ["killall", "Dock"]]
  }),
  "list-login-items": def({
    id: "list-login-items", title: "List login items", category: "slow-performance", readOnly: true,
    whatItDoes: "Lists the apps set to open at login (read-only) so slow start-ups can be traced.",
    commands: ["osascript -e 'tell application \"System Events\" to get the name of every login item'"],
    argv: [["osascript", "-e", "tell application \"System Events\" to get the name of every login item"]]
  })
};

export const TIER0_DARWIN_IDS = Object.keys(darwinRecipes);
export const TIER0_DARWIN_RECIPES = Object.values(darwinRecipes);

/** Is a single darwin command allowlisted (first token) and off the deny list? */
export function isAllowedTier0CommandDarwin(cmd) {
  const c = String(cmd || "").trim();
  if (!c || TIER0_DENY_DARWIN.test(c)) return false;
  return TIER0_ALLOWED_PREFIXES_DARWIN.includes(c.split(/\s+/)[0]);
}

/** Validate a darwin descriptor: safe flags, user-level, every command + argv allowlisted. */
export function validateTier0Darwin(recipe) {
  const errors = [];
  if (!recipe || recipe.tier !== TIER0) errors.push("not a tier-0 recipe");
  if (recipe?.platform !== "darwin") errors.push("not a darwin recipe");
  if (!recipe?.id || !recipe?.title) errors.push("missing id/title");
  if (recipe?.touchesSystemFiles) errors.push("tier-0 must not touch system files");
  if (recipe?.deletesUserData) errors.push("tier-0 must not delete user data");
  if (recipe?.disablesSecurity) errors.push("tier-0 must not disable security");
  if (recipe?.requiresAdmin) errors.push("darwin tier-0 must be user-level (no sudo)");
  if (recipe?.requiresConfirm !== true) errors.push("tier-0 must require confirmation");
  if (recipe?.dryRunDefault !== true) errors.push("tier-0 must default to dry-run");
  for (const c of recipe?.commands || []) if (!isAllowedTier0CommandDarwin(c)) errors.push(`command not allowlisted: ${c}`);
  if (!Array.isArray(recipe?.argv) || recipe.argv.length !== (recipe?.commands || []).length) errors.push("argv must mirror commands");
  for (const a of recipe?.argv || []) if (!Array.isArray(a) || !TIER0_ALLOWED_PREFIXES_DARWIN.includes(a[0])) errors.push(`argv not allowlisted: ${JSON.stringify(a)}`);
  return { ok: errors.length === 0, errors };
}
