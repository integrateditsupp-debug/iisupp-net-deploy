// RUN 20 §5 — "first, do no harm". Only read-only, dry-run Tier-0 actions may proceed without an explicit
// OK; everything that changes state needs confirmation. Tier-0 deletes never touch system files.
import assert from "node:assert/strict";
import { canAutoRun, requiresConfirmation } from "../src/shared/diagnostic-reasoner.mjs";
import { TIER0_RECIPES, tier0ById, isAllowedTier0Command } from "../src/main/recipes/tier-0/index.mjs";

// A read-only, dry-run Tier-0 action may auto-run; anything else requires confirmation.
assert.equal(canAutoRun({ tier: "tier-0-safe-generic", readOnly: true, dryRun: true }), true);
assert.equal(canAutoRun({ tier: "tier-0-safe-generic", readOnly: false, dryRun: true }), false, "state-changing tier-0 still confirms");
assert.equal(canAutoRun({ tier: "tier-1", readOnly: true, dryRun: true }), false, "tier-1+ always confirms");
assert.equal(canAutoRun({ tier: "tier-0-safe-generic", readOnly: true, dryRun: true, touchesSystemFiles: true }), false, "no auto-run if it touches system files");
assert.equal(requiresConfirmation({ tier: "tier-1" }), true);

// Every Tier-0 recipe requires confirmation and never deletes user data / touches system files / disables security.
for (const r of TIER0_RECIPES) {
  assert.equal(r.requiresConfirm, true, `${r.id} requires confirm`);
  assert.equal(r.deletesUserData, false, `${r.id} never deletes user data`);
  assert.equal(r.touchesSystemFiles, false, `${r.id} never touches system files`);
  assert.equal(r.disablesSecurity, false, `${r.id} never disables security`);
}

// The only delete recipe (clear-user-temp) is scoped to %TEMP% — never Windows/System32/user documents.
const clear = tier0ById("clear-user-temp");
assert.ok(clear, "clear-user-temp exists");
const del = clear.commands.find((c) => /Remove-Item/i.test(c));
assert.match(del, /\$env:TEMP/i, "delete is scoped to %TEMP%");
assert.doesNotMatch(del, /windows\\|system32|documents/i, "delete never targets a protected location");

// A Remove-Item that is NOT scoped to TEMP is rejected by the allowlist (defense in depth).
assert.equal(isAllowedTier0Command("Remove-Item -Path C:\\Windows\\System32\\* -Recurse"), false, "unscoped system delete rejected");
assert.equal(isAllowedTier0Command("Set-MpPreference -DisableRealtimeMonitoring $true"), false, "security-disabling command rejected");

console.log("No-harm-gate test passed (auto-run only read-only/dry-run Tier-0 · deletes scoped to %TEMP% · system/security protected).");
