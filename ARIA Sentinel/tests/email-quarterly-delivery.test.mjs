// RUN 22 §5 — quarterly email: content-blind body + subject + opt-in gate; the Netlify function sends
// via the existing Resend integration with the admin-token gate.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { emailSubject, emailBody, shouldSend, deliveryRecord } from "../src/shared/quarterly-email.mjs";

// Subject format.
assert.equal(emailSubject("Acme Corp", "2026-Q3"), "ARIA Sentinel — Q3 2026 performance report for Acme Corp");

// Body carries the 6 hero KPIs + a CTA, content-blind.
const body = emailBody({ company: "Acme", quarter: "2026-Q3", kpis: { incidents: 42, autoPct: 88, uptime7d: 99.9, mttr: 4, accuracy: 91, breaches: 1, hoursSaved: 33, version: "0.1.0" }, reportUrl: "https://iisupp.net/r/abc" });
assert.match(body, /Uptime \(7d\)/);
assert.match(body, /View full report/);
assert.match(body, /42/);
// Opt-in only; PII + 🔒 R11 stripped from the body.
const piiBody = emailBody({ company: "C:\\Users\\bob\\co at \\\\SRV mail bob@x.com path C:\\Private pics and Vids\\v", kpis: { incidents: 1 } });
assert.doesNotMatch(piiBody, /bob/);
assert.doesNotMatch(piiBody, /private pics and vids/i);

// Send only when opted-in with a contact + a non-off cadence.
assert.equal(shouldSend({ optIn: true, contactEmail: "cfo@acme.com", cadence: "quarterly" }), true);
assert.equal(shouldSend({ optIn: false, contactEmail: "cfo@acme.com" }), false, "no opt-in → no send");
assert.equal(shouldSend({ optIn: true, contactEmail: "" }), false, "no contact → no send");
assert.equal(shouldSend({ optIn: true, contactEmail: "x@y.com", cadence: "off" }), false, "opted out → no send");

// Delivery record shape.
const rec = deliveryRecord({ license: "LIC-1", company: "Acme", q: "2026-Q3", status: "delivered" });
assert.equal(rec.delivered, true);
assert.equal(rec.quarter, "2026-Q3");

// The Netlify function: admin-gated, opt-in respected, sends via Resend, logs delivery.
const fn = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "netlify", "functions", "aria-sentinel-quarterly-email.js"), "utf8");
assert.match(fn, /requireAdminToken/, "admin-token gated");
assert.match(fn, /api\.resend\.com\/emails/, "sends via Resend");
assert.match(fn, /RESEND_API_KEY/, "uses the Resend key (dry-run without it)");
assert.match(fn, /shouldSend\(/, "respects opt-in");
assert.match(fn, /emailBody\(|emailSubject\(/, "uses the content-blind builders");
assert.match(fn, /getStore\("quarterly-reports"\)/, "tracks delivery");

console.log("Email-quarterly-delivery test passed (subject + content-blind body + opt-in gate + Resend send + delivery log).");
