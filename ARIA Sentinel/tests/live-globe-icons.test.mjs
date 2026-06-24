// RUN 16 §0 — live-globe icon swap is now APPLIED (Ahmad approved the RUN 15 preview). This suite
// verifies the swap shipped in-app + extensions, AND that the two protected marks are UNCHANGED:
// the floating overlay crystal-A presence avatar, and the Windows installer build/icon.ico.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");

// The live globe SVG asset still carries the rotating-ring + breathing-core animations.
const svg = read("src", "renderer", "aria-live-globe.svg");
assert.match(svg, /alg-rotate/, "SVG has the rotating ring animation");
assert.match(svg, /alg-breathe/, "SVG has the breathing core animation");

// RUN 19 §2 — the rail header + footer now render the live globe via the self-contained <aria-globe>
// canvas component (starfield + rotating sphere + orbiting sun + centre "A"). The ServiceNow chip keeps
// the lightweight animated SVG. The component bundle must exist and clean up its rAF on disconnect.
const indexHtml = read("src", "renderer", "index.html");
assert.match(indexHtml, /<aria-globe class="brand-globe" size="56">/, "header renders the live globe component");
assert.match(indexHtml, /<aria-globe class="aria-living-globe" size="120">/, "footer renders the live globe component");
assert.match(indexHtml, /class="mini-globe live-globe-img"\s+src="aria-live-globe\.svg"/, "ServiceNow chip keeps the live globe SVG");
const globeComp = read("src", "renderer", "components", "aria-globe.mjs");
assert.match(globeComp, /customElements\.define\("aria-globe"/, "component registers <aria-globe>");
assert.match(globeComp, /cancelAnimationFrame/, "component cancels its rAF (no canvas leak on close)");
assert.match(globeComp, /disconnectedCallback\(\)/, "component cleans up on disconnect");
// No empty gold-A globe divs (or stale <img> rail globes) remain in the rail.
assert.doesNotMatch(indexHtml, /<div class="brand-globe mini-globe"/, "old header gold-A div gone");
assert.doesNotMatch(indexHtml, /<div class="aria-living-globe floating-globe/, "old footer gold-A div gone");
assert.doesNotMatch(indexHtml, /class="brand-globe live-globe-img"/, "old header <img> globe replaced by the component");

// Extension toolbar icons rasterized to the live globe at the right dimensions (PNG IHDR width/height).
for (const dir of ["chrome-extension/icons", "edge-extension/icons", path.join("safari-extension", "Resources", "icons")]) {
  for (const [file, want] of [["i-16.png", 16], ["i-32.png", 32], ["i-128.png", 128]]) {
    const buf = fs.readFileSync(path.join(root, dir, file));
    assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${dir}/${file} is a PNG`);
    assert.equal(buf.readUInt32BE(16), want, `${dir}/${file} is ${want}px wide`);
    assert.equal(buf.readUInt32BE(20), want, `${dir}/${file} is ${want}px tall`);
  }
}

// PROTECTED — overlay crystal-A presence avatar is UNCHANGED (not swapped to the live globe).
const overlayHtml = read("src", "renderer", "overlay.html");
assert.match(overlayHtml, /class="aria-globe"/, "overlay still uses the crystal-A avatar");
assert.doesNotMatch(overlayHtml, /aria-live-globe\.svg/, "overlay was NOT swapped to the live globe");

// PROTECTED — the Windows installer icon stays the crystal A.
assert.ok(fs.existsSync(path.join(root, "build", "icon.ico")), "build/icon.ico still present (unchanged)");

// Visual-stability record exists.
const after = read("design-review", "run16-live-globe-after.html");
assert.match(after, /APPLIED/i, "after-record states the swap is applied");

console.log("Live-globe-icons test passed (swap APPLIED in-app + 3 extensions; overlay crystal-A + icon.ico protected).");
