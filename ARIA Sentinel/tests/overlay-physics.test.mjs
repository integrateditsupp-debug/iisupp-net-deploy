// BLOCK 2 test — pure cursor-dodge math.
// Invariants over thousands of randomised ticks:
//   1. the globe is ALWAYS pinned on its edge,
//   2. it is ALWAYS inside the work area (never the interior),
//   3. when the cursor is on the globe's band, it stays >= 80px away.
import assert from "node:assert/strict";
import { tickPhysics, cursorOverGlobe, DODGE_RADIUS } from "../src/main/overlay-physics.mjs";

const WA = { x: 0, y: 0, width: 1920, height: 1080 };
const SIZE = 96;
const xb = { min: WA.x, max: WA.x + WA.width - SIZE };
const yb = { min: WA.y, max: WA.y + WA.height - SIZE };

function onEdge(pos, edge) {
  if (edge === "top") return pos.y === yb.min;
  if (edge === "bottom") return pos.y === yb.max;
  if (edge === "left") return pos.x === xb.min;
  if (edge === "right") return pos.x === xb.max;
  return false;
}
function inside(pos) {
  return pos.x >= xb.min && pos.x <= xb.max && pos.y >= yb.min && pos.y <= yb.max;
}

// Deterministic pseudo-random (no Math.random) so failures reproduce.
let seed = 1337;
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

const EDGES = ["top", "bottom", "left", "right"];
let ticks = 0;

for (const edge of EDGES) {
  let state = { x: WA.x + 400, y: edge === "bottom" ? yb.max : edge === "top" ? yb.min : 400, edge, driftDir: 1 };
  for (let i = 0; i < 2000; i++) {
    const cursor = { x: Math.round(rand() * 2200 - 140), y: Math.round(rand() * 1240 - 80) };
    state = tickPhysics(state, cursor, WA, { size: SIZE, dtMs: 33 });
    assert.ok(onEdge(state, edge), `tick ${i} edge=${edge}: globe must stay on its edge -> ${JSON.stringify(state)}`);
    assert.ok(inside(state), `tick ${i} edge=${edge}: globe must stay inside work area -> ${JSON.stringify(state)}`);
    ticks++;
  }
}

// Dodge guarantee: cursor parked right on the globe centre band → globe flees >= 80px.
{
  let state = { x: 900, y: yb.min, edge: "top", driftDir: 1 };
  for (let i = 0; i < 30; i++) {
    const cursorX = state.x + SIZE / 2; // sit exactly on the globe
    const cursor = { x: cursorX, y: WA.y + 10 };
    const next = tickPhysics(state, cursor, WA, { size: SIZE, dtMs: 33 });
    const centre = next.x + SIZE / 2;
    assert.ok(Math.abs(centre - cursorX) >= DODGE_RADIUS - 1, `dodge: globe must keep >=80px (got ${Math.abs(centre - cursorX)})`);
    state = next;
  }
}

// Multi-monitor: negative-origin display still keeps the globe on its own work area.
{
  const wa2 = { x: -1920, y: 0, width: 1920, height: 1080 };
  let state = { x: -1000, y: 0, edge: "top", driftDir: 1 };
  for (let i = 0; i < 500; i++) {
    state = tickPhysics(state, { x: -1500 + i, y: 5 }, wa2, { size: SIZE, dtMs: 33 });
    assert.ok(state.x >= wa2.x && state.x <= wa2.x + wa2.width - SIZE, `multi-monitor x in range -> ${state.x}`);
    assert.equal(state.y, 0, "multi-monitor stays on top edge");
  }
}

// Hitbox helper
assert.equal(cursorOverGlobe({ x: 0, y: 0 }, { x: 48, y: 48 }, SIZE), true);
assert.equal(cursorOverGlobe({ x: 0, y: 0 }, { x: 400, y: 400 }, SIZE), false);

console.log(`Overlay physics test passed (${ticks} randomised ticks, all invariants held).`);
