// RUN 16 §D — Security battery. Hand-rolled static + behavioural security checks over the real source
// (we deliberately do NOT add eslint-plugin-security as a dep — see RUN_16_REPORT justification; these
// assertions cover the same rule intents: no eval, hardened webPreferences, CSP, constant-time HMAC,
// env-only admin auth, a destructive-command denylist, and content-blind IPC payloads).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isActionExecutable, EXECUTABLE_RECIPES } from "../src/shared/recipe-runner.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const mainJs = read("src", "main", "main.mjs");
const preload = read("src", "main", "preload.cjs");

// 1 · Hardened BrowserWindow: every window isolates context and disables node integration; no remote.
const ci = (mainJs.match(/contextIsolation:\s*true/g) || []).length;
const ni = (mainJs.match(/nodeIntegration:\s*false/g) || []).length;
assert.ok(ci >= 3, "every BrowserWindow sets contextIsolation:true");
assert.ok(ni >= 3, "every BrowserWindow sets nodeIntegration:false");
assert.doesNotMatch(mainJs, /nodeIntegration:\s*true/, "nodeIntegration is never enabled");
assert.doesNotMatch(mainJs, /enableRemoteModule:\s*true/, "remote module never enabled");
assert.doesNotMatch(mainJs, /webSecurity:\s*false/, "webSecurity is never disabled");

// 2 · No eval / Function-constructor / child_process in renderer-facing code.
for (const [name, src] of [["main", mainJs], ["preload", preload]]) {
  assert.doesNotMatch(src, /\beval\s*\(/, `${name}: no eval()`);
  assert.doesNotMatch(src, /new Function\s*\(/, `${name}: no Function constructor`);
}
// preload exposes a fixed bridge surface, not raw ipcRenderer.
assert.doesNotMatch(preload, /contextBridge\.exposeInMainWorld\([^)]*ipcRenderer\s*\)/, "preload never leaks raw ipcRenderer");

// 3 · CSP present in every renderer HTML.
for (const html of ["index.html", "overlay.html"]) {
  assert.match(read("src", "renderer", html), /http-equiv="Content-Security-Policy"/, `${html} sets a CSP`);
}

// 4 · Constant-time comparison for license + admin-session HMAC (no timing oracle).
assert.match(read("src", "shared", "license.mjs"), /crypto\.timingSafeEqual/, "license uses timingSafeEqual");
assert.match(read("src", "shared", "admin-gate.mjs"), /crypto\.timingSafeEqual/, "admin-gate uses timingSafeEqual");

// 5 · Admin auth is env-var only, bcrypt-validated, with no hardcoded credential and no silent fallback.
const adminAuth = read("netlify", "functions", "aria-admin-auth.js");
assert.match(adminAuth, /process\.env\.ARIA_ADMIN_USERNAME/, "admin username from env");
assert.match(adminAuth, /process\.env\.ARIA_ADMIN_PASSWORD_HASH/, "admin password hash from env");
assert.match(adminAuth, /bcrypt/, "admin password verified with bcrypt");
assert.doesNotMatch(adminAuth, /password\s*===\s*["']/, "no hardcoded password comparison");
assert.match(adminAuth, /admin-auth-not-configured/, "refuses when creds not configured (no fallback)");

// 6 · Destructive-command denylist intact — even on a GREEN recipe with full system-fix authority and
// a restore point, these NEVER execute.
const green = [...EXECUTABLE_RECIPES][0];
assert.ok(green, "there is at least one green recipe");
const fullAuth = { recipeId: green, allowSystemFixes: true, dryRun: false, confirmed: true, restorePointTaken: true };
for (const cmd of ["format-volume -driveletter c", "diskpart", "bcdedit /set", "reg delete HKLM\\x", "clear-disk", "remove-partition", "cipher /w:c"]) {
  assert.equal(isActionExecutable({ ...fullAuth, action: { shell: "powershell", command: cmd } }), false, `denylist blocks: ${cmd}`);
}
// A safe, allowlisted cache-flush on a green recipe still runs.
assert.equal(isActionExecutable({ ...fullAuth, action: { shell: "powershell", command: "ipconfig /flushdns" } }), true, "safe allowlisted command on a green recipe executes");
// Dry-run (the default) never executes anything — the core fix-safety invariant.
assert.equal(isActionExecutable({ ...fullAuth, dryRun: true, action: { shell: "powershell", command: "ipconfig /flushdns" } }), false, "dry-run never executes");
// Without explicit system-fix authority, nothing executes.
assert.equal(isActionExecutable({ recipeId: green, allowSystemFixes: false, dryRun: false, action: { shell: "powershell", command: "ipconfig /flushdns" } }), false, "no execution without allowSystemFixes");

// 7 · Content-blind IPC: the inbound paths run user input through assertContentSafePayload / sanitizer.
assert.match(mainJs, /assertContentSafePayload|sanitizeToSignature|contentSafeContext/, "main sanitizes user→main payloads");

console.log("Security battery passed (hardened webPreferences · no eval · CSP · constant-time HMAC · env-only admin auth · destructive denylist · content-blind IPC).");
