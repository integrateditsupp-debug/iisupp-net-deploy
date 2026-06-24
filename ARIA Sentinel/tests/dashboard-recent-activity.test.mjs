// RUN 22 §1 — recent activity timeline (last 10) built from the audit log, with clickable deep-links.
import assert from "node:assert/strict";
import { eventToActivity, activityHtml } from "../src/renderer/tabs/dashboard.mjs";

// A transparency-log entry maps to an activity row with an icon + a deep-link tab.
const run = eventToActivity({ ts: "2026-07-05T11:42:00Z", tag: "RUN", text: "Cleared %TEMP%" });
assert.equal(run.icon, "🔧");
assert.equal(run.tab, "recipes");
assert.match(run.text, /Cleared %TEMP%/);
assert.ok(run.time, "carries a formatted time");

assert.equal(eventToActivity({ tag: "DIAGNOSE" }).tab, "mode");
assert.equal(eventToActivity({ tag: "UPDATE" }).icon, "🔄");
assert.equal(eventToActivity({ tag: "SECURITY" }).tab, "compliance");

// activityHtml caps at 10 rows + emits deep-link attributes.
const events = Array.from({ length: 15 }, (_, i) => eventToActivity({ ts: "2026-07-05T10:00:00Z", tag: "RUN", text: `fix ${i}` }));
const html = activityHtml(events);
assert.equal((html.match(/activity-row/g) || []).length, 10, "last 10 only");
assert.match(html, /data-deeplink="recipes"/, "rows carry a deep-link tab");

// Empty → friendly placeholder.
assert.match(activityHtml([]), /No activity yet/);

console.log("Dashboard-recent-activity test passed (audit → timeline · icons · deep-links · capped at 10).");
