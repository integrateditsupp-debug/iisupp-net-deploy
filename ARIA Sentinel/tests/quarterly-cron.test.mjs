// RUN 23 §7 — quarterly cron. Unit-tests the quarter math + the opt-in gate, and meta-tests the function
// file (scheduled registration, Resend send, attachment, the right Blobs stores). Mirrors the existing
// netlify-function test convention (no handler import — avoids @netlify/blobs at test time).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { quarterLabel, shouldSend } from "../src/shared/quarterly-email.mjs";

// Quarter math (UTC).
assert.equal(quarterLabel(new Date("2026-01-01T00:00:00Z")), "2026-Q1");
assert.equal(quarterLabel(new Date("2026-04-01T09:00:00Z")), "2026-Q2");
assert.equal(quarterLabel(new Date("2026-07-15T12:00:00Z")), "2026-Q3");
assert.equal(quarterLabel(new Date("2026-12-31T23:59:59Z")), "2026-Q4");

// Opt-in gate (only opted-in tenants with a contact + a non-off cadence are mailed).
assert.equal(shouldSend({ optIn: true, contactEmail: "cfo@acme.com", cadence: "quarterly" }), true);
assert.equal(shouldSend({ optIn: false, contactEmail: "cfo@acme.com" }), false);
assert.equal(shouldSend({ optIn: true, contactEmail: "", cadence: "quarterly" }), false);
assert.equal(shouldSend({ optIn: true, contactEmail: "x@y.com", cadence: "off" }), false);

// Meta-test the cron function file.
const fn = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "netlify", "functions", "aria-sentinel-quarterly-cron.js"), "utf8");
assert.match(fn, /export const config = \{ schedule: "0 9 1 \*\/3 \*" \}/, "registers the quarterly cron timer");
assert.match(fn, /getStore\("licenses"\)/, "enumerates tenants");
assert.match(fn, /getStore\("quarterly-reports"\)/, "reads the pre-generated report");
assert.match(fn, /getStore\("email-send-log"\)/, "logs delivery status");
assert.match(fn, /api\.resend\.com\/emails/, "sends via Resend");
assert.match(fn, /attachments/, "attaches the report PDF");
assert.match(fn, /shouldSend\(/, "respects opt-in");
assert.match(fn, /RESEND_API_KEY/, "dry-run without the key");
// 🔒 R11 — the cron relies on the already-content-blind emailBody (which wires the guard); no raw paths here.
assert.doesNotMatch(fn, /private pics and vids/i);

console.log("Quarterly-cron test passed (quarter math · opt-in gate · scheduled config · Resend + attachment + send-log).");
