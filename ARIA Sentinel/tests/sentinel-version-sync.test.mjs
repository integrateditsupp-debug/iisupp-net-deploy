import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SENTINEL_VERSION } from "../src/shared/recipes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
const html = fs.readFileSync(path.join(root, "src", "renderer", "index.html"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "src", "shared", "dashboard-status.mjs"), "utf8");

assert.equal(SENTINEL_VERSION, pkg.version, "runtime SENTINEL_VERSION must match package.json");
assert.match(html, new RegExp(`v${pkg.version}`), "initial renderer HTML shows current package version");
assert.match(renderer, new RegExp(`"${pkg.version}"`), "renderer fallback uses current package version");
assert.match(dashboard, new RegExp(`"${pkg.version}"`), "dashboard version fallback uses current package version");

console.log(`Sentinel version sync test passed (${pkg.version}).`);
