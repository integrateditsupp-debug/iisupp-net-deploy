// RUN 20 §1 — installed-apps + system inventory enumerator: 3 sources merged + deduped, required fields.
import assert from "node:assert/strict";
import { mergeInstalledApps, buildSystemContext, REQUIRED_APP_FIELDS } from "../src/main/system-context.mjs";

// Three sources, with the same app appearing in two of them → one merged entry.
const registry = [
  { DisplayName: "Google Chrome", DisplayVersion: "120.0", Publisher: "Google LLC", InstallDate: "20240101", EstimatedSize: 250000, InstallLocation: "C:\\Program Files\\Chrome", UninstallString: "C:\\...\\setup.exe" },
  { DisplayName: "7-Zip", DisplayVersion: "23.01", Publisher: "Igor Pavlov" }
];
const packages = [{ Name: "Google Chrome", Version: "120.0" }]; // dup of Chrome → merge, not duplicate
const store = [{ Name: "Windows Terminal", DisplayVersion: "1.19", Publisher: "Microsoft" }];

const apps = mergeInstalledApps(registry, packages, store);
const names = apps.map((a) => a.name);
assert.ok(names.includes("Google Chrome") && names.includes("7-Zip") && names.includes("Windows Terminal"), "all apps present");
assert.equal(names.filter((n) => n === "Google Chrome").length, 1, "duplicate app deduped across sources");

// Every app carries all required fields (null when unknown, never missing).
for (const app of apps) {
  for (const f of REQUIRED_APP_FIELDS) assert.ok(f in app, `app ${app.name} has field ${f}`);
  assert.ok("source" in app, "app records its source(s)");
}
const chrome = apps.find((a) => a.name === "Google Chrome");
assert.match(chrome.source, /registry/, "merged app credits the registry source");
assert.match(chrome.source, /get-package/, "merged app credits the get-package source");

// The full context shape carries hardware + apps + the event-log summary scaffold.
const ctx = buildSystemContext({ registryApps: registry, packageApps: packages, storeApps: store, cpu: { model: "x", cores: 8 }, ram: { percentUsed: 40 } }, "2026-06-20T00:00:00.000Z");
assert.equal(ctx.contentBlind, true);
assert.equal(ctx.appCount, ctx.apps.length);
for (const k of ["cpu", "ram", "gpu", "disks", "network", "os", "drivers", "services", "startup", "recentUpdates", "eventLog"]) {
  assert.ok(k in ctx, `context has ${k}`);
}
assert.ok(ctx.eventLog && "errorsBySubsystem" in ctx.eventLog, "event-log subsystem map present");

console.log(`System-context-enum test passed (${apps.length} apps merged from 3 sources, deduped, all required fields).`);
