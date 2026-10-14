// PROD 2026-10-14 (audit M2) — the tray / window icon is a PNG nativeImage can actually decode.
//
// Electron's nativeImage.createFromDataURL decodes only image/png and image/jpeg; the SVG data URL main.mjs used
// to pass produced an EMPTY image (blank tray on Windows, invisible status item on macOS). This suite proves:
//   · every TRAY_PNG[state] (1x and 2x) is a data:image/png;base64 URL whose bytes are a well-formed PNG of the
//     declared size (signature, IHDR, RGBA8, CRC-valid chunks, IEND);
//   · the four states are pairwise distinct images and none is blank (opaque pixels exist, state tints differ);
//   · the committed module is EXACTLY what scripts/render-tray-png.mjs renders from tray-art.mjs right now — the
//     PNGs cannot drift from the art without this going red;
//   · build/icon-256.png (the brand icon main.mjs falls back to) exists and is a real 256×256 PNG;
//   · main.mjs hands nativeImage the PNG URL (with the file + legacy fallbacks) instead of the SVG URL.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { TRAY_PNG, TRAY_PNG_2X, TRAY_PNG_SIZE, TRAY_PNG_SIZE_2X, trayPngDataUrl } from "../src/main/tray-art-png.mjs";
import { TRAY_STATES, trayPrimitives, traySvg } from "../src/main/tray-art.mjs";
import { buildTrayPngModule, renderTrayPng, crc32, TRAY_PNG_MODULE_PATH, ICON_PNG_PATH } from "../scripts/render-tray-png.mjs";

const root = path.resolve(import.meta.dirname, "..");
let groups = 0; const g = () => { groups++; };

/** Parse a PNG: signature, chunks with CRC check, IHDR, decoded RGBA rows (filter 0 only — what we write). */
function parsePng(buf) {
  assert.equal(buf.slice(0, 8).toString("hex"), "89504e470d0a1a0a", "PNG signature");
  let i = 8; const chunks = []; let idat = Buffer.alloc(0);
  while (i < buf.length) {
    const len = buf.readUInt32BE(i); const type = buf.slice(i + 4, i + 8).toString("ascii"); const data = buf.slice(i + 8, i + 8 + len);
    const crc = buf.readUInt32BE(i + 8 + len);
    assert.equal(crc, crc32(Buffer.concat([buf.slice(i + 4, i + 8), data])), `${type} chunk CRC`);
    chunks.push(type); if (type === "IDAT") idat = Buffer.concat([idat, data]);
    i += 12 + len;
  }
  assert.deepEqual(chunks, ["IHDR", "IDAT", "IEND"], "chunk order");
  const width = buf.readUInt32BE(16), height = buf.readUInt32BE(20);
  assert.equal(buf[24], 8, "8-bit"); assert.equal(buf[25], 6, "RGBA");
  const raw = zlib.inflateSync(idat);
  assert.equal(raw.length, (width * 4 + 1) * height, "scanline bytes");
  const px = [];
  for (let y = 0; y < height; y++) { assert.equal(raw[y * (width * 4 + 1)], 0, "filter 0"); for (let x = 0; x < width; x++) { const o = y * (width * 4 + 1) + 1 + x * 4; px.push([raw[o], raw[o + 1], raw[o + 2], raw[o + 3]]); } }
  return { width, height, px };
}
const fromDataUrl = (u) => { assert.ok(u.startsWith("data:image/png;base64,"), `PNG data URL: ${u.slice(0, 30)}`); return Buffer.from(u.slice("data:image/png;base64,".length), "base64"); };

// 1 — every state, both scales: a PNG data URL that is a well-formed PNG of the declared size.
assert.deepEqual(Object.keys(TRAY_PNG), TRAY_STATES);
assert.deepEqual(Object.keys(TRAY_PNG_2X), TRAY_STATES);
const decoded = {};
for (const s of TRAY_STATES) {
  const p1 = parsePng(fromDataUrl(TRAY_PNG[s]));
  assert.equal(p1.width, TRAY_PNG_SIZE); assert.equal(p1.height, TRAY_PNG_SIZE);
  const p2 = parsePng(fromDataUrl(TRAY_PNG_2X[s]));
  assert.equal(p2.width, TRAY_PNG_SIZE_2X); assert.equal(p2.height, TRAY_PNG_SIZE_2X);
  decoded[s] = p1;
}
assert.equal(TRAY_PNG_SIZE, 32); assert.equal(TRAY_PNG_SIZE_2X, 64);
g();

// 2 — not blank, pairwise distinct, and tinted the way the art says (idle gold · detection cyan · fixing amber · escalation red).
for (const s of TRAY_STATES) {
  const opaque = decoded[s].px.filter((p) => p[3] > 200);
  assert.ok(opaque.length > 150, `${s}: has a solid body (${opaque.length} opaque pixels)`);
  const transparent = decoded[s].px.filter((p) => p[3] === 0);
  assert.ok(transparent.length > 50, `${s}: corners are transparent, not a filled square`);
}
assert.equal(new Set(TRAY_STATES.map((s) => TRAY_PNG[s])).size, 4, "four distinct 1x images");
assert.equal(new Set(TRAY_STATES.map((s) => TRAY_PNG_2X[s])).size, 4, "four distinct 2x images");
const avg = (s) => { const o = decoded[s].px.filter((p) => p[3] > 200); return o.reduce((a, p) => [a[0] + p[0] / o.length, a[1] + p[1] / o.length, a[2] + p[2] / o.length], [0, 0, 0]); };
const idle = avg("idle"), det = avg("detection"), fix = avg("fixing"), esc = avg("escalation");
assert.ok(idle[0] > idle[2] && idle[1] > idle[2], "idle reads gold (warm, red+green over blue)");
assert.ok(det[2] > det[0], "detection reads cyan (blue over red)");
assert.ok(fix[0] > fix[2] && fix[0] > idle[0] - 60, "fixing reads amber");
assert.ok(esc[0] > esc[1] + 40 && esc[0] > esc[2] + 40, "escalation reads red");
// The glyphs land where the art puts them: the detection dot at (50,14)/64, the escalation bang in the lower half.
const at = (s, x, y) => decoded[s].px[Math.round(y) * TRAY_PNG_SIZE + Math.round(x)];
const dot = at("detection", 25, 7);
assert.ok(dot[3] > 200 && dot[2] > 200, "the detection alert dot is drawn top-right in cyan");
assert.ok(at("idle", 25, 7)[3] < 80, "…and idle has no dot there");
const bang = at("escalation", 16, 21);
assert.ok(bang[3] > 200 && bang[0] > 200 && bang[1] < 120, "the escalation exclamation is drawn in red");
g();

// 3 — the committed module equals a fresh render of the art (no drift between SVG source and PNG output).
assert.equal(fs.readFileSync(TRAY_PNG_MODULE_PATH, "utf8"), buildTrayPngModule(), "src/main/tray-art-png.mjs is exactly what the renderer produces — re-run `node scripts/render-tray-png.mjs`");
assert.equal(trayPngDataUrl("fixing", 1), TRAY_PNG.fixing);
assert.equal(trayPngDataUrl("fixing", 2), TRAY_PNG_2X.fixing);
assert.equal(trayPngDataUrl("nonsense"), TRAY_PNG.idle, "unknown state falls back to idle");
g();

// 4 — build/icon-256.png: the existing ARIA brand icon (source of icon.ico) main.mjs falls back to — a real
//     256×256 PNG, untouched by the renderer (the script never writes into build/).
assert.ok(fs.existsSync(ICON_PNG_PATH), "build/icon-256.png exists");
assert.equal(ICON_PNG_PATH, path.join(root, "build", "icon-256.png"));
const icon = fs.readFileSync(ICON_PNG_PATH);
assert.equal(icon.slice(0, 8).toString("hex"), "89504e470d0a1a0a", "brand icon is a PNG");
assert.equal(icon.readUInt32BE(16), 256); assert.equal(icon.readUInt32BE(20), 256);
assert.ok(!icon.equals(renderTrayPng("idle", 256)), "the brand icon is not overwritten by the tray renderer");
const script = fs.readFileSync(path.join(root, "scripts", "render-tray-png.mjs"), "utf8");
assert.doesNotMatch(script, /writeFileSync\(ICON_PNG_PATH/, "the script never writes build/icon-256.png");
g();

// 5 — the SVG and the PNG come from the SAME primitive list (traySvg renders every primitive it rasterizes).
for (const s of TRAY_STATES) {
  const svg = traySvg(s);
  for (const p of trayPrimitives(s)) {
    if (p.type === "circle") assert.ok(svg.includes(`<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}"`), `${s}: circle r=${p.r} in SVG`);
    if (p.type === "rect") assert.ok(svg.includes(`<rect x="${p.x}" y="${p.y}"`), `${s}: rect in SVG`);
    if (p.type === "arc") assert.ok(/<path d="M32 6 A26 26 0 0 1 58 32"/.test(svg), `${s}: arc in SVG`);
  }
}
g();

// 6 — main.mjs uses the PNG, with the file icon and only then the legacy SVG as fallbacks.
const main = fs.readFileSync(path.join(root, "src/main/main.mjs"), "utf8");
assert.match(main, /import \{ trayPngDataUrl \} from "\.\/tray-art-png\.mjs"/);
assert.match(main, /nativeImage\.createFromDataURL\(trayPngDataUrl\(key, 1\)\)/, "the tray image is the PNG data URL");
assert.match(main, /addRepresentation\(\{ scaleFactor: 2, dataURL: trayPngDataUrl\(key, 2\) \}\)/, "with a 2x representation");
assert.match(main, /createFromPath\(path\.join\(appRoot, "build", "icon-256\.png"\)\)/, "file fallback");
assert.ok(main.indexOf("trayPngDataUrl(key, 1)") < main.indexOf("return nativeImage.createFromDataURL(traySvgDataUrl(key))"), "the SVG URL is only the last resort");
g();

assert.equal(groups, 6);
console.log(`tray-art test passed (${groups} groups · 4 states × 2 scales are real PNGs · distinct + tinted + glyphs placed · module == renderer · icon-256 · SVG/PNG one source · main wired).`);
