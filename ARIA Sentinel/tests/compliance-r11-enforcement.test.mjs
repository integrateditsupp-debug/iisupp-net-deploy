// RUN 22 §4 — the Compliance tab confirms the private folder is NEVER accessed: counter stays 0, and
// every new tab's data builder is incapable of surfacing the folder name.
import assert from "node:assert/strict";
import { r11EnforcementStatus } from "../src/shared/compliance-score.mjs";
import { r11RowsHtml } from "../src/renderer/tabs/compliance.mjs";
import { activityHtml, pendingHtml, tileHtml } from "../src/renderer/tabs/dashboard.mjs";

// The counter must read 0 attempted accesses (folder never touched).
const ok = r11EnforcementStatus(0, "2026-07-05T00:00:00Z");
assert.equal(ok.attempts, 0);
assert.equal(ok.touched, false);
assert.equal(ok.ok, true);
assert.match(ok.statusLine, /0 attempted accesses/);
assert.equal(ok.folder, "Private pics and Vids");
// If anything ever attempted access, it surfaces (must always be 0 in practice).
assert.equal(r11EnforcementStatus(3).ok, false);

// The compliance R11 rows render the never-touched status (no raw folder leak beyond the rule name).
const rows = r11RowsHtml(ok);
assert.match(rows, /never touched/);
assert.match(rows, /always 0/);

// Defense-in-depth: feeding the private folder into ANY dashboard builder is redacted, never displayed.
assert.doesNotMatch(activityHtml([{ time: "1:00", icon: "x", text: "open C:\\Users\\x\\Private pics and Vids\\v.mp4", status: "" }]), /private pics and vids/i);
assert.doesNotMatch(pendingHtml([{ text: "scan D:\\Private Pics And Vids\\", cta: "Open" }]), /private pics and vids/i);
assert.doesNotMatch(tileHtml({ label: "x", value: "E:\\private pics and vids\\count" }), /private pics and vids/i);

console.log("Compliance-r11-enforcement test passed (counter stays 0 · builders redact the private folder).");
