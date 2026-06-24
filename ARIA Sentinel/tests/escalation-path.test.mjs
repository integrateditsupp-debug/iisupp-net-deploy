// RUN 20 §5 — when safe Tier-0 attempts fail repeatedly (3×), the reasoner drafts a content-blind
// ServiceNow escalation. Fewer than 3 → no draft (keep trying safely first).
import assert from "node:assert/strict";
import { buildEscalationDraft } from "../src/shared/diagnostic-reasoner.mjs";

// 1 or 2 attempts → no escalation yet.
assert.equal(buildEscalationDraft({ symptomTitle: "Slow Performance", attempts: [{ recipeId: "clear-user-temp", outcome: "no-change" }] }), null);
assert.equal(buildEscalationDraft({ symptomTitle: "Slow Performance", attempts: [{ recipeId: "a" }, { recipeId: "b" }] }), null);

// 3 failed attempts → a draft is generated.
const draft = buildEscalationDraft({
  symptomTitle: "Slow Performance",
  attempts: [
    { recipeId: "clear-user-temp", outcome: "no-change" },
    { recipeId: "list-startup-impact", outcome: "no-change" },
    { recipeId: "check-disk-smart", outcome: "no-change" }
  ],
  context: { os: { edition: "Windows 11 Pro" }, ram: { percentUsed: 88 }, disk: { percentFree: 6 } }
});
assert.ok(draft, "draft generated after 3 attempts");
assert.equal(draft.escalate, true);
assert.match(draft.shortDescription, /Slow Performance/);
assert.match(draft.shortDescription, /3 safe attempts/);
assert.equal(draft.category, "endpoint");
assert.equal(draft.contentBlind, true);

// Content-blind: attempts carry symbolic recipe ids + outcomes only — no page content / file paths.
assert.equal(draft.attempts.length, 3);
for (const a of draft.attempts) {
  assert.deepEqual(Object.keys(a).sort(), ["outcome", "recipeId"], "attempt is symbolic only");
}
// The OS edition is summarized symbolically (not the raw string), numbers are coarse.
const blob = JSON.stringify(draft);
assert.doesNotMatch(blob, /Windows 11 Pro/, "raw OS string not leaked into the draft");
assert.equal(draft.systemSummary.ramPercentUsed, 88);

console.log("Escalation-path test passed (3 failed Tier-0 attempts → content-blind ServiceNow draft; <3 → none).");
