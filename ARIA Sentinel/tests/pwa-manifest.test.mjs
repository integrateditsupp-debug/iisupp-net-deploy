// RUN 11 — PWA. Asserts the admin manifest is valid, the service worker registers + caches for
// offline, and the admin HTML wires both (manifest link + SW registration + responsive breakpoints).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const admin = path.resolve("admin-console");

// Manifest is valid + installable (name, start_url, standalone display, icons).
const manifest = JSON.parse(fs.readFileSync(path.join(admin, "manifest.webmanifest"), "utf8"));
assert.ok(manifest.name && manifest.short_name, "has name + short_name");
assert.ok(manifest.start_url, "has start_url");
assert.equal(manifest.display, "standalone", "installable display mode");
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2, "has icons (192 + 512)");
assert.ok(manifest.icons.some((i) => i.sizes === "512x512"), "has a 512 icon for install");

// Service worker exists and implements install + fetch (offline) + a cache version.
const sw = fs.readFileSync(path.join(admin, "service-worker.js"), "utf8");
assert.match(sw, /addEventListener\(["']install["']/, "SW handles install");
assert.match(sw, /addEventListener\(["']fetch["']/, "SW handles fetch (offline)");
assert.match(sw, /caches\.open/, "SW uses the Cache API");
assert.match(sw, /index\.html/, "SW caches the shell for offline fallback");

// Admin HTML wires the manifest + registers the SW + has responsive breakpoints.
const html = fs.readFileSync(path.join(admin, "index.html"), "utf8");
assert.match(html, /rel="manifest"/, "links the manifest");
assert.match(html, /serviceWorker\.register\(["']\.\/service-worker\.js["']\)/, "registers the SW");
assert.match(html, /@media \(max-width: *720px\)/, "has a phone breakpoint");

console.log("PWA-manifest test passed (valid manifest · SW install+fetch offline · registered + responsive).");
