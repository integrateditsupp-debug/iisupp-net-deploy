// RUN 23c §5 — admin console "Publish current dist" 1-click button. Reads the built .exe metadata from the
// local bridge (/dist-info), then POSTs version+sha512+size+GitHub-url to the publish endpoint. The manual
// entry form is preserved as a fallback.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const adminHtml = read("admin-console", "index.html");
const main = read("src", "main", "main.mjs");

// The new one-click button + the preserved manual button both exist.
assert.match(adminHtml, /id="publishCurrentDist"/, "one-click publish button present");
assert.match(adminHtml, /id="publishVersionBtn"/, "manual entry preserved");

// The handler reads the local bridge dist-info, then publishes with the auto-filled fields + GitHub url.
assert.match(adminHtml, /127\.0\.0\.1:37841\/dist-info/, "reads dist metadata from the local bridge");
assert.match(adminHtml, /adminFetch\(\s*['"]aria-sentinel-update-publish['"]/, "POSTs to the publish endpoint");
assert.match(adminHtml, /sha512:\s*info\.sha512/, "auto-fills sha512");
assert.match(adminHtml, /url:\s*info\.url/, "points clients at the GitHub Release url");

// The bridge exposes the dist metadata route + readDistInfo (version + sha512 + size + url), local/read-only.
assert.match(main, /url\.pathname === "\/dist-info"/, "bridge route present");
assert.match(main, /function readDistInfo\(\)/, "readDistInfo present");
assert.match(main, /createHash\("sha512"\)/, "computes sha512 of the dist .exe");

console.log("Admin-console-publish-button test passed (one-click + manual fallback · dist-info bridge · auto-filled publish with GitHub url).");
