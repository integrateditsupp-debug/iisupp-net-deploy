// RUN 13 §9 — Chrome/Edge extension install path + bundling.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const files = pkg.build.files;
assert.ok(files.includes("chrome-extension/**/*"), "chrome-extension bundled in build.files");
assert.ok(files.includes("edge-extension/**/*"), "edge-extension bundled in build.files");

// Install instructions UI present in the Knowledge tab.
const indexHtml = fs.readFileSync(path.join(root, "src", "renderer", "index.html"), "utf8");
assert.match(indexHtml, /id="extInstructions"/, "install-instructions button");
assert.match(indexHtml, /id="extSteps"/, "install steps list");
assert.match(indexHtml, /Load unpacked/, "mentions Load unpacked");
assert.match(indexHtml, /resources\\chrome-extension/, "points at the bundled extension path");

// The extension itself still exists to bundle.
assert.ok(fs.existsSync(path.join(root, "chrome-extension", "manifest.json")), "chrome extension present");

console.log("Chrome-ext-install test passed (bundled in build.files + install UI present).");
