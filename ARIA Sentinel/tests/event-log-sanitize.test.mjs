// RUN 20 — Event Log reads are content-blind: usernames, machine names, emails and PII paths stripped.
import assert from "node:assert/strict";
import { sanitizeEventLog, sanitizeText } from "../src/main/system-context.mjs";

const raw = [
  { level: "Error", source: "Application Error", id: 1000, message: "Faulting app for user C:\\Users\\jsmith\\AppData failed" },
  { level: "Critical", source: "Kernel-Power", id: 41, message: "Unexpected shutdown on \\\\WORKSTATION-12 reported by admin@corp.com" }
];
const clean = sanitizeEventLog(raw);

const blob = JSON.stringify(clean);
assert.doesNotMatch(blob, /jsmith/, "username stripped");
assert.doesNotMatch(blob, /WORKSTATION-12/, "machine name stripped");
assert.doesNotMatch(blob, /admin@corp\.com/, "email stripped");
assert.match(blob, /<user>/, "user path replaced with placeholder");
assert.match(blob, /<machine>/, "machine name replaced with placeholder");
assert.match(blob, /<email>/, "email replaced with placeholder");

// Structure preserved (level / source / id / message) so the data is still useful.
assert.equal(clean.length, 2);
for (const e of clean) for (const k of ["level", "source", "id", "message"]) assert.ok(k in e, `entry keeps ${k}`);

// sanitizeText handles each PII class independently.
assert.doesNotMatch(sanitizeText("C:\\Users\\bob\\Desktop"), /bob/);
assert.doesNotMatch(sanitizeText("home /home/alice/docs"), /alice/);

console.log("Event-log-sanitize test passed (usernames · machine names · emails stripped; structure kept).");
