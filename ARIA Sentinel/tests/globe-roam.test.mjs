// RUN 12 — floating globe v2 free-roam physics + click-through.
// Asserts: the repel force decays per spec and is exactly 0 beyond 180px; free-roam never leaves the
// padded work area over thousands of ticks; and the overlay is click-through by default.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  repelForce,
  tickFreeRoam,
  roamBounds,
  REPEL_RADIUS,
  REPEL_STRENGTH,
  ROAM_PADDING
} from "../src/main/overlay-physics.mjs";

// 1) Repel force: (1 - dist/180)^2 * 0.8, clamped to 0 at/beyond the radius.
assert.equal(repelForce(0), REPEL_STRENGTH, "max force at the cursor");
assert.equal(repelForce(REPEL_RADIUS), 0, "exactly 0 at the radius");
assert.equal(repelForce(REPEL_RADIUS + 50), 0, "0 beyond the radius (>180px = no force)");
assert.equal(repelForce(1000), 0);
const half = repelForce(REPEL_RADIUS / 2);
assert.ok(Math.abs(half - 0.25 * REPEL_STRENGTH) < 1e-9, "half-radius force matches the spec");
// Monotonic decreasing as distance grows.
let prev = Infinity;
for (let d = 0; d <= REPEL_RADIUS; d += 10) {
  const f = repelForce(d);
  assert.ok(f <= prev + 1e-9, "force never increases with distance");
  prev = f;
}

// 2) Free-roam stays inside the padded work area over thousands of ticks (random cursor + waypoints).
const WA = { x: 0, y: 0, width: 1920, height: 1080 };
const SIZE = 104;
const b = roamBounds(WA, SIZE);
assert.equal(b.minX, ROAM_PADDING);
let seed = 99;
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
let state = { x: 1600, y: 900, vx: 0, vy: 0, waypoint: { x: 1600, y: 900 } };
for (let i = 0; i < 6000; i++) {
  if (i % 60 === 0) state.waypoint = { x: b.minX + rand() * (b.maxX - b.minX), y: b.minY + rand() * (b.maxY - b.minY) };
  const cursor = { x: Math.round(rand() * 2000 - 40), y: Math.round(rand() * 1120 - 40) };
  state = { ...tickFreeRoam(state, cursor, WA, { size: SIZE, dtMs: 16 }), waypoint: state.waypoint };
  assert.ok(state.x >= b.minX - 1 && state.x <= b.maxX + 1, `tick ${i}: x in bounds (${state.x})`);
  assert.ok(state.y >= b.minY - 1 && state.y <= b.maxY + 1, `tick ${i}: y in bounds (${state.y})`);
}

// Cursor parked on the globe pushes it away (velocity moves it off the cursor over a few ticks).
let s2 = { x: 900, y: 500, vx: 0, vy: 0, waypoint: { x: 900, y: 500 } };
const startDist = Math.hypot(s2.x + SIZE / 2 - 900, s2.y + SIZE / 2 - 500);
for (let i = 0; i < 10; i++) s2 = { ...tickFreeRoam(s2, { x: 900, y: 500 }, WA, { size: SIZE, dtMs: 16 }), waypoint: s2.waypoint };
const endDist = Math.hypot(s2.x + SIZE / 2 - 900, s2.y + SIZE / 2 - 500);
assert.ok(endDist > startDist, "globe flees a cursor parked on it");

// 3) Click-through by default: overlay page is pointer-events:none (globe catches clicks only when
//    the window's ignore-mouse is briefly disabled), and main sets ignore-mouse true by default.
const root = path.resolve(import.meta.dirname, "..");
const overlayHtml = fs.readFileSync(path.join(root, "src", "renderer", "overlay.html"), "utf8");
assert.match(overlayHtml, /html,\s*body\s*\{[^}]*pointer-events:\s*none/, "overlay page is click-through");
assert.match(overlayHtml, /\.globe-button[^{]*\{[^}]*pointer-events:\s*auto/, "globe button re-enables pointer events");
const mainJs = fs.readFileSync(path.join(root, "src", "main", "main.mjs"), "utf8");
assert.match(mainJs, /setIgnoreMouseEvents\(true,\s*\{\s*forward:\s*true\s*\}\)/, "main click-through by default");

console.log("Globe-roam test passed (repel decays to 0 >180px · free-roam stays in work area · click-through default).");
