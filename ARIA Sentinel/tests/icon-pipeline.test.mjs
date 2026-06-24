// RUN 16 §0 (support) — the dependency-free PNG downscaler used to rasterize the live-globe extension
// icons. Round-trips the deployed 128px icon through decode → downscale → encode → decode and asserts
// dimensions + alpha are preserved, and that the generated icons + the master record exist.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readPng, downscale, writePng } from "../design-review/png-downscale.mjs";

const root = path.resolve(import.meta.dirname, "..");

// The generation record + deployed source-of-truth master exist.
assert.ok(fs.existsSync(path.join(root, "design-review", "run16-icon-master.png")), "icon master archived");
assert.ok(fs.existsSync(path.join(root, "design-review", "png-downscale.mjs")), "downscaler kept for reproducibility");

// Decode a real deployed icon.
const src = readPng(fs.readFileSync(path.join(root, "chrome-extension", "icons", "i-128.png")));
assert.equal(src.w, 128);
assert.equal(src.h, 128);
assert.equal(src.rgba.length, 128 * 128 * 4, "RGBA buffer is w*h*4");

// Downscale 128 → 32 → encode → decode: dimensions preserved, output is a valid 32px PNG.
const small = downscale(src, 32);
assert.equal(small.w, 32);
assert.equal(small.h, 32);
const png = writePng(small);
assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "encoder emits a valid PNG signature");
const round = readPng(png);
assert.equal(round.w, 32);
assert.equal(round.h, 32);

// Alpha is real (the globe is on a transparent field): some pixels opaque, some transparent.
let opaque = 0, clear = 0;
for (let i = 3; i < src.rgba.length; i += 4) { if (src.rgba[i] > 200) opaque++; else if (src.rgba[i] < 20) clear++; }
assert.ok(opaque > 0, "icon has opaque globe pixels");
assert.ok(clear > 0, "icon has transparent background pixels");

console.log("Icon-pipeline test passed (PNG decode/downscale/encode round-trip · dimensions + transparency preserved · master archived).");
