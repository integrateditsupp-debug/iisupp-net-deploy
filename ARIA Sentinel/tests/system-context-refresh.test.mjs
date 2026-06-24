// RUN 20 §1 — a refresh completes fast (injected collector) and is content-blind (PII stripped).
import assert from "node:assert/strict";
import { enumerate } from "../src/main/system-context.mjs";

// Canned per-label collector (what main injects in place of real PowerShell). Includes PII to prove it
// is stripped: an app named with an email, and an event-log entry with a username path + machine name.
const runPS = async (label) => {
  if (label === "registry-apps") return JSON.stringify([{ DisplayName: "Backup for john@acme.com", DisplayVersion: "2.0" }, { DisplayName: "Notepad++", DisplayVersion: "8.6" }]);
  if (label === "get-package") return JSON.stringify([{ Name: "Notepad++", Version: "8.6" }]);
  if (label === "appx") return JSON.stringify([{ Name: "Microsoft.WindowsTerminal", DisplayVersion: "1.19" }]);
  if (label === "hardware") return JSON.stringify({
    cpu: { model: "Intel", cores: 8, load: 22 }, ram: { percentUsed: 61 },
    eventLog: { errorsBySubsystem: { disk: 3 }, entries: [{ level: "Error", source: "Disk", id: 7, message: "fault for C:\\Users\\jane on \\\\DESK-7" }] }
  });
  return "[]";
};

const t0 = Date.now();
const ctx = await enumerate({ runPS, now: "2026-06-20T00:00:00.000Z" });
const elapsed = Date.now() - t0;

assert.ok(elapsed < 3000, `refresh completes in <3s (took ${elapsed}ms)`);
assert.ok(ctx.appCount >= 2, "apps collected + merged");

// Content-blind: the email-bearing app name is redacted; the event-log entry is sanitized.
const serialized = JSON.stringify(ctx);
assert.doesNotMatch(serialized, /john@acme\.com/, "app name PII (email) stripped");
assert.doesNotMatch(serialized, /jane/, "username stripped from event log");
assert.doesNotMatch(serialized, /DESK-7/, "machine name stripped from event log");
assert.ok(ctx.apps.some((a) => a.name === "<redacted app>"), "PII app name → placeholder");
assert.match(JSON.stringify(ctx.eventLog), /<user>/, "event-log path redacted to <user>");

console.log(`System-context-refresh test passed (<3s: ${elapsed}ms · email/username/machine all stripped).`);
