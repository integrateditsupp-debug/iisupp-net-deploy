// RUN 12 — "Open Admin Console" actually works. Asserts the full chain is wired:
// renderer binds the button → preload exposes openAdminConsole → main handles the IPC by opening
// (or focusing) a dedicated BrowserWindow that loads admin-console/index.html.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");

// Button exists in the Settings shell.
const indexHtml = read("src", "renderer", "index.html");
assert.match(indexHtml, /id="openAdminConsole"/, "Open Admin Console button exists");

// Renderer binds it to the bridge.
const rendererJs = read("src", "renderer", "renderer.js");
assert.match(rendererJs, /openAdminConsole/, "renderer references openAdminConsole");

// Preload exposes the method over the existing channel.
const preload = read("src", "main", "preload.cjs");
assert.match(preload, /openAdminConsole:\s*\(\)\s*=>\s*ipcRenderer\.invoke\(["']sentinel:open-admin-console["']\)/, "preload exposes openAdminConsole");

// Main handles the IPC and opens a real window loading the admin console HTML.
const mainJs = read("src", "main", "main.mjs");
assert.match(mainJs, /ipcMain\.handle\(["']sentinel:open-admin-console["']/, "main handles the IPC");
assert.match(mainJs, /adminWindow\s*=\s*new BrowserWindow/, "main opens a dedicated admin window");
assert.match(mainJs, /adminWindow\.loadFile\(adminPath\)/, "admin window loads the admin-console HTML");
assert.match(mainJs, /adminWindow && !adminWindow\.isDestroyed\(\)/, "re-focuses if already open");
// No longer the silent shell.openPath that did nothing on Ahmad's machine.
assert.ok(!/shell\.openPath\(adminPath\)/.test(mainJs), "old shell.openPath path removed");

// The admin console file it loads exists.
assert.ok(fs.existsSync(path.join(root, "admin-console", "index.html")), "admin console HTML present");

console.log("Admin-console-open test passed (button → preload → IPC → dedicated window, focus-if-open).");
