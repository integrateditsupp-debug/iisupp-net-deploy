#!/usr/bin/env node
// PROD 2026-10-14 (audit M2) — build-time rasterizer for the tray / window icon.
//
// Electron's nativeImage.createFromDataURL decodes only image/png and image/jpeg; the SVG data URL main.mjs used
// to pass produced an EMPTY image (blank tray on Windows, invisible status item on macOS). This script renders the
// four tray states from the SAME primitive list tray-art.mjs uses for its SVG (one source of truth) into:
//   · src/main/tray-art-png.mjs — `TRAY_PNG[state]` = "data:image/png;base64,…" at 32×32 (+ 64×64 @2x), what
//     main.mjs hands to nativeImage.
// build/icon-256.png (the ARIA brand icon, source of build/icon.ico) is NOT written here — it is the existing
// createFromPath fallback main.mjs uses when a data URL ever fails to decode; this script never touches build/.
// Zero dependencies: a tiny anti-aliased sampler (16× supersampling) over circles / rings / lines / arcs / rounded
// rects with radial gradients, and a minimal PNG encoder (RGBA8, filter 0, zlib via node:zlib, CRC32 by table).
// Faithful rendering, not a stand-in: every primitive of the SVG is drawn, gradients included.
//
//   node scripts/render-tray-png.mjs            # regenerates src/main/tray-art-png.mjs
// tests/tray-art.test.mjs re-renders in-process and asserts the committed module equals this script's output, so
// the PNGs can never drift from the art without the suite going red.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";
import { TRAY_STATES, TRAY_ART_SIZE, trayPrimitives, trayGradients } from "../src/main/tray-art.mjs";

export const TRAY_PNG_SIZE = 32;
export const TRAY_PNG_SIZE_2X = 64;
const SUPERSAMPLE = 4; // 4×4 = 16 samples per pixel

// ── colour helpers ──────────────────────────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const h = String(hex || "#000000").replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Colour + alpha at distance fraction t∈[0,1] along a radial gradient (SVG pad spreading). */
function gradientAt(grad, t) {
  const stops = grad.stops;
  if (t <= stops[0].offset) return [...hexToRgb(stops[0].color), stops[0].opacity];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1], b = stops[i];
    if (t <= b.offset) {
      const f = b.offset === a.offset ? 0 : (t - a.offset) / (b.offset - a.offset);
      const ca = hexToRgb(a.color), cb = hexToRgb(b.color);
      return [ca[0] + (cb[0] - ca[0]) * f, ca[1] + (cb[1] - ca[1]) * f, ca[2] + (cb[2] - ca[2]) * f, a.opacity + (b.opacity - a.opacity) * f];
    }
  }
  const last = stops[stops.length - 1];
  return [...hexToRgb(last.color), last.opacity];
}

// ── geometry: does design-space point (x,y) lie inside / on primitive p? returns [r,g,b,a] or null ─────
function sampleCircleFill(p, x, y, grads) {
  const dx = x - p.cx, dy = y - p.cy;
  if (dx * dx + dy * dy > p.r * p.r) return null;
  if (p.fill && typeof p.fill === "object") {
    const g = grads[p.fill.gradient];
    // objectBoundingBox units: the circle's box is [cx-r, cx+r] × [cy-r, cy+r]
    const bx = p.cx - p.r, by = p.cy - p.r, bw = 2 * p.r;
    const gx = bx + g.cx * bw, gy = by + g.cy * bw, gr = g.r * bw;
    const t = Math.min(1, Math.hypot(x - gx, y - gy) / gr);
    return gradientAt(g, t);
  }
  return [...hexToRgb(p.fill), 1];
}
function sampleCircleStroke(p, x, y) {
  const d = Math.hypot(x - p.cx, y - p.cy);
  const half = (p.strokeWidth || 1) / 2;
  if (Math.abs(d - p.r) > half) return null;
  return [...hexToRgb(p.stroke), p.strokeOpacity == null ? 1 : p.strokeOpacity];
}
function sampleLine(p, x, y) {
  const half = (p.strokeWidth || 1) / 2;
  const vx = p.x2 - p.x1, vy = p.y2 - p.y1;
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((x - p.x1) * vx + (y - p.y1) * vy) / len2));
  const px = p.x1 + t * vx, py = p.y1 + t * vy;
  if (Math.hypot(x - px, y - py) > half) return null;
  return [...hexToRgb(p.stroke), p.strokeOpacity == null ? 1 : p.strokeOpacity];
}
function sampleArc(p, x, y) {
  const half = (p.strokeWidth || 1) / 2;
  const d = Math.hypot(x - p.cx, y - p.cy);
  const rad = (deg) => (deg * Math.PI) / 180;
  const a0 = rad(p.startDeg), a1 = rad(p.endDeg);
  const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
  let ang = Math.atan2(y - p.cy, x - p.cx);
  // normalise into the arc's angular window (the arcs here span < 360°)
  while (ang < lo - Math.PI) ang += 2 * Math.PI;
  while (ang > hi + Math.PI) ang -= 2 * Math.PI;
  const inBand = Math.abs(d - p.r) <= half && ang >= lo && ang <= hi;
  if (inBand) return [...hexToRgb(p.stroke), p.strokeOpacity == null ? 1 : p.strokeOpacity];
  if (p.cap === "round") {
    for (const a of [a0, a1]) {
      const ex = p.cx + p.r * Math.cos(a), ey = p.cy + p.r * Math.sin(a);
      if (Math.hypot(x - ex, y - ey) <= half) return [...hexToRgb(p.stroke), p.strokeOpacity == null ? 1 : p.strokeOpacity];
    }
  }
  return null;
}
function sampleRect(p, x, y) {
  const rx = Math.min(p.rx || 0, p.width / 2, p.height / 2);
  if (x < p.x || x > p.x + p.width || y < p.y || y > p.y + p.height) return null;
  if (rx > 0) {
    const cx = x < p.x + rx ? p.x + rx : x > p.x + p.width - rx ? p.x + p.width - rx : x;
    const cy = y < p.y + rx ? p.y + rx : y > p.y + p.height - rx ? p.y + p.height - rx : y;
    if (Math.hypot(x - cx, y - cy) > rx) return null;
  }
  return [...hexToRgb(p.fill), 1];
}
function samplePrimitive(p, x, y, grads) {
  switch (p.type) {
    case "circle": return p.stroke ? sampleCircleStroke(p, x, y) : sampleCircleFill(p, x, y, grads);
    case "line": return sampleLine(p, x, y);
    case "arc": return sampleArc(p, x, y);
    case "rect": return sampleRect(p, x, y);
    default: return null;
  }
}

/** Rasterize a state to an RGBA8 buffer of size×size (straight alpha, SVG painter's order, 16× supersampled). */
export function rasterizeTrayState(state, size = TRAY_PNG_SIZE) {
  const prims = trayPrimitives(state);
  const grads = trayGradients(state);
  const out = Buffer.alloc(size * size * 4);
  const scale = TRAY_ART_SIZE / size;
  const n = SUPERSAMPLE, inv = 1 / (n * n);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let R = 0, G = 0, B = 0, A = 0;
      for (let sy = 0; sy < n; sy++) {
        for (let sx = 0; sx < n; sx++) {
          const x = (px + (sx + 0.5) / n) * scale, y = (py + (sy + 0.5) / n) * scale;
          // composite the layer stack at this sample ("over" operator, straight alpha)
          let r = 0, g = 0, b = 0, a = 0;
          for (const p of prims) {
            const c = samplePrimitive(p, x, y, grads);
            if (!c || c[3] <= 0) continue;
            const ca = Math.min(1, c[3]);
            const na = ca + a * (1 - ca);
            if (na <= 0) continue;
            r = (c[0] * ca + r * a * (1 - ca)) / na;
            g = (c[1] * ca + g * a * (1 - ca)) / na;
            b = (c[2] * ca + b * a * (1 - ca)) / na;
            a = na;
          }
          // accumulate premultiplied so transparent samples do not darken the pixel
          R += r * a; G += g * a; B += b * a; A += a;
        }
      }
      const i = (py * size + px) * 4;
      const alpha = A * inv;
      if (alpha > 0) { out[i] = Math.round(R * inv / alpha); out[i + 1] = Math.round(G * inv / alpha); out[i + 2] = Math.round(B * inv / alpha); }
      out[i + 3] = Math.round(alpha * 255);
    }
  }
  return out;
}

// ── minimal PNG encoder ─────────────────────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
/** Encode an RGBA8 buffer as a PNG (8-bit RGBA, no interlace, filter 0 on every scanline). Deterministic. */
export function encodePng(rgba, width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // depth 8, RGBA, deflate, filter 0, no interlace
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter type 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

/** PNG bytes for a tray state at a given size. */
export function renderTrayPng(state, size = TRAY_PNG_SIZE) {
  return encodePng(rasterizeTrayState(state, size), size, size);
}
/** data:image/png;base64 URL for a tray state. */
export function renderTrayPngDataUrl(state, size = TRAY_PNG_SIZE) {
  return `data:image/png;base64,${renderTrayPng(state, size).toString("base64")}`;
}

/** The exact text of src/main/tray-art-png.mjs for the current art. Deterministic (no timestamps). */
export function buildTrayPngModule() {
  const lines = [
    "// GENERATED by scripts/render-tray-png.mjs from src/main/tray-art.mjs — do not edit by hand.",
    "// PROD 2026-10-14 (audit M2): PNG data URLs for the tray / window icon (nativeImage cannot decode SVG).",
    "// Re-run `node scripts/render-tray-png.mjs` after changing the art; tests/tray-art.test.mjs asserts they match.",
    `export const TRAY_PNG_SIZE = ${TRAY_PNG_SIZE};`,
    `export const TRAY_PNG_SIZE_2X = ${TRAY_PNG_SIZE_2X};`,
    "export const TRAY_PNG = Object.freeze({"
  ];
  for (const s of TRAY_STATES) lines.push(`  ${s}: "${renderTrayPngDataUrl(s, TRAY_PNG_SIZE)}",`);
  lines.push("});");
  lines.push("export const TRAY_PNG_2X = Object.freeze({");
  for (const s of TRAY_STATES) lines.push(`  ${s}: "${renderTrayPngDataUrl(s, TRAY_PNG_SIZE_2X)}",`);
  lines.push("});");
  lines.push("export function trayPngDataUrl(state, scale = 1) {");
  lines.push("  const key = Object.prototype.hasOwnProperty.call(TRAY_PNG, state) ? state : \"idle\";");
  lines.push("  return scale >= 2 ? TRAY_PNG_2X[key] : TRAY_PNG[key];");
  lines.push("}");
  return lines.join("\n") + "\n";
}

const here = path.dirname(fileURLToPath(import.meta.url));
export const TRAY_PNG_MODULE_PATH = path.join(here, "..", "src", "main", "tray-art-png.mjs");
/** The existing brand icon main.mjs falls back to (never written by this script). */
export const ICON_PNG_PATH = path.join(here, "..", "build", "icon-256.png");

function main() {
  fs.writeFileSync(TRAY_PNG_MODULE_PATH, buildTrayPngModule());
  console.log(`tray-art-png.mjs: ${TRAY_STATES.length} states × (${TRAY_PNG_SIZE}px + ${TRAY_PNG_SIZE_2X}px)`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
