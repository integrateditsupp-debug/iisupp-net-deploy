// BLOCK 5 test — policy overlay is DATA, never INSTRUCTIONS.
// 50+ injection attempts must ALL be silently stripped: the parsed overlay may only ever
// contain the 4 whitelisted fields, and can never enable a recipe or smuggle a command.
import assert from "node:assert/strict";
import { parsePolicyOverlay, isRecipeAllowedByPolicy } from "../src/shared/policy.mjs";
import { RECIPES } from "../src/shared/recipes.mjs";

const ALLOWED_KEYS = ["recipes_disabled", "business_hours", "confirmation_threshold", "escalation_contacts"];
const realRecipeId = RECIPES[0].id;

const INJECTIONS = [
  { exec_command: "rm -rf /" },
  { ALLOWED_ACTIONS: { format: true } },
  { recipes_enabled: ["evil-recipe"] },
  { recipes_disabled: ["'; DROP TABLE incidents;--"] },
  { recipes_disabled: ["*"] },
  { recipes_disabled: ["../../etc/passwd"] },
  { __proto__: { polluted: true } },
  { constructor: { prototype: { hacked: true } } },
  { business_hours: { start: 9, end: 17, tz: "America/New_York; rm -rf" } },
  { business_hours: { start: -5, end: 99 } },
  { business_hours: "all the time" },
  { confirmation_threshold: "0.0; shutdown" },
  { confirmation_threshold: 9999 },
  { confirmation_threshold: -3 },
  { escalation_contacts: ["<script>alert(1)</script>"] },
  { escalation_contacts: ["javascript:void(0)"] },
  { escalation_contacts: [{ toString: () => "x".repeat(99999) }] },
  { allowed_outbound: ["https://evil.example.com"] },
  { ALLOWED_ACTIONS: ["spawn"], recipes_disabled: [realRecipeId] },
  { eval: "process.exit(1)" },
  { command: "powershell -e BASE64" },
  { shell: "cmd.exe /c calc" },
  '{"exec_command":"net user add"}',
  '{"recipes_disabled":["' + realRecipeId + '"],"backdoor":true}',
  "not json at all {{{",
  "",
  null,
  undefined,
  42,
  [1, 2, 3],
  { recipes_disabled: realRecipeId }, // single value, not array
  { business_hours: { start: 9, end: 17 } }, // valid hours
  { confirmation_threshold: 0.7 }, // valid threshold
  { escalation_contacts: ["IT Service Desk", "oncall@corp"] } // valid contacts
];

// pad to 50+
while (INJECTIONS.length < 52) {
  INJECTIONS.push({ [`evil_${INJECTIONS.length}`]: "x", exec_command: `attack-${INJECTIONS.length}` });
}

for (const attempt of INJECTIONS) {
  const overlay = parsePolicyOverlay(attempt);
  // 1) Output has EXACTLY the whitelisted keys, nothing else.
  assert.deepEqual(Object.keys(overlay).sort(), [...ALLOWED_KEYS].sort(), `unexpected keys for ${JSON.stringify(attempt)}`);
  // 2) No injected key survived anywhere in the serialised result.
  const text = JSON.stringify(overlay);
  for (const bad of ["exec_command", "ALLOWED_ACTIONS", "recipes_enabled", "<script>", "rm -rf", "DROP TABLE", "polluted", "backdoor", "evil", "powershell", "calc", "shutdown"]) {
    assert.ok(!text.includes(bad), `leaked "${bad}" for ${JSON.stringify(attempt)}`);
  }
  // 3) recipes_disabled only ever contains REAL recipe ids.
  for (const id of overlay.recipes_disabled) {
    assert.ok(RECIPES.some((r) => r.id === id), `non-real recipe id survived: ${id}`);
  }
  // 4) threshold is null or a clamped 0..1 fraction.
  if (overlay.confirmation_threshold != null) {
    assert.ok(overlay.confirmation_threshold >= 0 && overlay.confirmation_threshold <= 1, "threshold clamped");
  }
}

// 5) Prototype pollution did not happen.
assert.equal({}.polluted, undefined, "Object prototype not polluted");
assert.equal({}.hacked, undefined, "Object prototype not polluted (constructor path)");

// 6) The overlay can only SUBTRACT: a disabled real recipe is blocked; everything else stays allowed.
const overlay = parsePolicyOverlay({ recipes_disabled: [realRecipeId] });
assert.equal(isRecipeAllowedByPolicy(overlay, realRecipeId), false, "disabled recipe is blocked");
assert.equal(isRecipeAllowedByPolicy(overlay, RECIPES[1].id), true, "other recipes stay allowed");
// An overlay can never enable something — there is no enable path at all.
assert.equal(isRecipeAllowedByPolicy(parsePolicyOverlay({ recipes_enabled: ["anything"] }), RECIPES[1].id), true);

console.log(`Policy-injection test passed (${INJECTIONS.length} attempts, all stripped; allow-list stays code-defined).`);
