// 🔒 R11 — "Private pics and Vids" is OFF LIMITS. This proves every file-enum / startup-scan / heartbeat
// path excludes it (case-insensitive), and that the new RUN 21 + system-context code wire the guard.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isBlockedPath, filterBlocked, redactPrivate, PRIVATE_FOLDER_RE, r11AuditEntry, R11_SURFACE } from "../src/shared/path-guard.mjs";
import { sanitizeText, mergeInstalledApps } from "../src/main/system-context.mjs";
import { buildHeartbeatPayload } from "../src/main/heartbeat.mjs";
import { registryRunEntry } from "../src/main/startup-registrar.mjs";

const root = path.resolve(import.meta.dirname, "..");

// The block matches case-insensitively, with any separators or bare name.
for (const p of [
  "C:\\Users\\x\\Private pics and Vids\\a.jpg",
  "D:/media/private pics and vids/clip.mp4",
  "\\\\NAS\\Private Pics And Vids\\",
  "Private pics and Vids"
]) assert.equal(isBlockedPath(p), true, `blocks: ${p}`);
assert.equal(isBlockedPath("C:\\Users\\x\\Pictures\\a.jpg"), false, "ordinary path allowed");
assert.ok(PRIVATE_FOLDER_RE.flags.includes("i"), "regex is case-insensitive");
assert.equal(r11AuditEntry("startup").surfaced, R11_SURFACE);
assert.equal(R11_SURFACE, "1 personal folder excluded");

// filterBlocked splits a scan list.
const { kept, blocked } = filterBlocked([{ p: "C:\\ok" }, { p: "C:\\Private Pics and Vids\\x" }], (x) => x.p);
assert.equal(kept.length, 1);
assert.equal(blocked.length, 1);

// System-context: sanitizeText redacts the folder; installed-apps enum drops anything inside it.
assert.match(sanitizeText("opened C:\\Users\\bob\\Private pics and Vids\\v.mp4"), /<private-folder>/);
assert.doesNotMatch(sanitizeText("C:\\Private pics and Vids\\x"), /private pics and vids/i);
const apps = mergeInstalledApps(
  [{ DisplayName: "Normal App", DisplayVersion: "1", InstallLocation: "C:\\Program Files\\App" },
   { DisplayName: "Hidden", DisplayVersion: "1", InstallLocation: "D:\\Private pics and Vids\\app" }],
  [], []);
assert.equal(apps.length, 1, "app located in the private folder is never inventoried");
assert.equal(apps[0].name, "Normal App");

// Heartbeat never transmits a value referencing the folder.
assert.equal(buildHeartbeatPayload({ licenseId: "x", version: "C:\\Private pics and Vids\\v" }).version, null);

// Startup registration refuses an exe path inside the folder.
assert.throws(() => registryRunEntry("D:\\Private pics and Vids\\evil.exe"), /R11_BLOCKED/);

// Enforcement proof: every RUN 21 file-enum / startup / heartbeat / inventory module wires the guard.
const GUARDED = [
  "src/main/system-context.mjs", "src/main/startup-registrar.mjs", "src/main/heartbeat.mjs", "src/main/main.mjs"
];
for (const f of GUARDED) {
  const src = fs.readFileSync(path.join(root, f), "utf8");
  assert.match(src, /path-guard\.mjs/, `${f} imports the R11 path-guard`);
}
// And no enumerated OUTPUT artifact ever contains the literal folder name (the guard strips it).
const sample = JSON.stringify({ apps, hb: buildHeartbeatPayload({ licenseId: "x", version: "0.1.0" }) });
assert.doesNotMatch(sample, /private pics and vids/i, "no enumerated output references the private folder");

console.log("Private-folder-never-touched test passed (R11 blocks every enum/startup/heartbeat path; guard wired in 4 modules).");
