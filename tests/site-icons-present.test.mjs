// site-icons-present.test.mjs — every PNG the site advertises as an icon or share image must exist
// and be a real PNG of the size it is declared to be.
//
// RUN-CU 2026-10-08 (site audit, Top-10 #7): /icons/icon-192.png, /icons/icon-512.png and
// /icons/apple-touch-icon.png were one and the same 41×226 crop while manifest.webmanifest declared
// them 192×192 and 512×512 maskable (install prompt failed, Apple icon distorted), and 26 pages pointed
// og:image at /assets/aria-og.png, which did not exist. The PNG IHDR chunk is parsed directly so a
// renamed JPEG, an SVG with a .png name or a wrong-size file all fail here, not in a share preview.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Parse the IHDR of a PNG; throws when the file is not a PNG. */
export function pngSize(file) {
  const buf = readFileSync(file);
  assert.ok(buf.length > 33, `${file}: too small to be a PNG`);
  assert.ok(buf.subarray(0, 8).equals(PNG_SIGNATURE), `${file}: not a PNG (bad signature)`);
  assert.equal(buf.subarray(12, 16).toString("ascii"), "IHDR", `${file}: first chunk is not IHDR`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// Declared sizes: the manifest is the contract for the PWA icons; Apple reads 180×180;
// Open Graph recommends 1200×630 for summary_large_image cards.
const DECLARED = {
  "icons/icon-192.png": { width: 192, height: 192 },
  "icons/icon-512.png": { width: 512, height: 512 },
  "icons/apple-touch-icon.png": { width: 180, height: 180 },
  "assets/aria-og.png": { width: 1200, height: 630 },
};

test("manifest.webmanifest declares the sizes this test enforces", () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.webmanifest"), "utf8"));
  for (const icon of manifest.icons) {
    if (!icon.src.endsWith(".png")) continue;
    const rel = icon.src.replace(/^\//, "");
    const [w, h] = icon.sizes.split("x").map(Number);
    assert.ok(DECLARED[rel], `manifest icon ${icon.src} is not covered by this test — add it to DECLARED`);
    assert.deepEqual(DECLARED[rel], { width: w, height: h }, `manifest declares ${icon.src} as ${icon.sizes}`);
  }
  for (const shortcut of manifest.shortcuts || []) {
    for (const icon of shortcut.icons || []) {
      const rel = icon.src.replace(/^\//, "");
      assert.ok(existsSync(join(ROOT, rel)), `shortcut icon ${icon.src} is missing`);
    }
  }
});

test("every declared PNG exists, is a PNG, and matches its declared size", () => {
  for (const [rel, want] of Object.entries(DECLARED)) {
    const file = join(ROOT, rel);
    assert.ok(existsSync(file), `${rel} is missing`);
    assert.ok(statSync(file).size > 1000, `${rel} is suspiciously small (${statSync(file).size} B)`);
    assert.deepEqual(pngSize(file), want, `${rel} has the wrong pixel size`);
  }
});

test("the three icon files are no longer the same 41×226 crop", () => {
  const sizes = ["icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"].map((r) => pngSize(join(ROOT, r)));
  for (const s of sizes) {
    assert.ok(s.width === s.height, `icon must be square, got ${s.width}×${s.height}`);
    assert.notDeepEqual(s, { width: 41, height: 226 });
  }
});

// Walk the public HTML and make sure every /icons/*.png or /assets/aria-og.png reference resolves
// to a file this test has verified.
function* htmlFiles(dir, depth = 0) {
  if (depth > 3) return;
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || name === "node_modules" || name === "archive" || name === "backups" || name.startsWith("_")) continue;
    const p = join(dir, name);
    let s;
    try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) yield* htmlFiles(p, depth + 1);
    else if (name.endsWith(".html")) yield p;
  }
}

test("every referenced /icons/*.png and /assets/aria-og.png is a verified file", () => {
  const missing = new Set();
  const unverified = new Set();
  for (const file of htmlFiles(ROOT)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/(?:https:\/\/iisupp\.net)?(\/(?:icons\/[\w.-]+\.png|assets\/aria-og\.png))/g)) {
      const rel = m[1].replace(/^\//, "");
      if (!existsSync(join(ROOT, rel))) missing.add(rel);
      else if (!DECLARED[rel]) unverified.add(rel);
    }
  }
  assert.deepEqual([...missing], [], `referenced icon/og PNGs that do not exist: ${[...missing].join(", ")}`);
  for (const rel of unverified) {
    // Any other referenced icon PNG must at least be a real PNG.
    pngSize(join(ROOT, rel));
  }
});
