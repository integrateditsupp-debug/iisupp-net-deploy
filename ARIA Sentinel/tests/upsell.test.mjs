// RUN 23e — Personal-tier upsell logic: 7-day per-class throttle, detection copy, About nudge.
import assert from "node:assert/strict";
import { shouldUpsell, upsellMessageFor, estimatedHoursSaved, aboutNudge, UPSELL_THROTTLE_MS } from "../src/shared/upsell.mjs";

const NOW = Date.parse("2026-06-22T00:00:00.000Z");

// Throttle: unseen class fires; seen-within-7d is suppressed; seen->8d ago fires again.
assert.equal(shouldUpsell("service-stopped", {}, NOW), true, "first time → show");
assert.equal(shouldUpsell("service-stopped", { "service-stopped": NOW - 1000 }, NOW), false, "just shown → suppress");
assert.equal(shouldUpsell("service-stopped", { "service-stopped": NOW - (UPSELL_THROTTLE_MS + 1) }, NOW), true, "past window → show again");
assert.equal(shouldUpsell("service-stopped", { "service-stopped": NOW - (UPSELL_THROTTLE_MS - 1000) }, NOW), false, "still inside window → suppress");
assert.equal(shouldUpsell("", {}, NOW), false, "empty class never fires");

// Distinct classes are throttled independently.
assert.equal(shouldUpsell("network", { "service-stopped": NOW }, NOW), true, "other class unaffected");

// Copy: known classes get specific lines, unknown falls back, all pitch Pro.
assert.match(upsellMessageFor("service-stopped"), /Autonomous|auto-fix/i);
assert.match(upsellMessageFor("totally-unknown"), /Pro/);
assert.match(upsellMessageFor("disk-low"), /Pro/);

// Hours-saved estimate.
assert.equal(estimatedHoursSaved(0), 0);
assert.equal(estimatedHoursSaved(8, 45), 6, "8 fixes × 45min = 6h");

// About nudge: below threshold → null; at/above → quantified Pro pitch.
assert.equal(aboutNudge(2), null, "don't nag for 2 fixes");
assert.equal(aboutNudge(0), null);
const nudge = aboutNudge(10);
assert.ok(nudge && /Pro/.test(nudge), "nudge pitches Pro");
assert.match(nudge, /\d/, "nudge quantifies hours");
assert.equal(aboutNudge(4, { minimumFixes: 5 }), null, "respects custom minimum");

console.log("Upsell test passed (7-day per-class throttle · detection copy · hours-saved · About nudge threshold).");
