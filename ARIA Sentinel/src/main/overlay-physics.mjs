// overlay-physics — pure cursor-dodge motion for the floating globe.
//
// The globe is an edge-hugging satellite: it drifts slowly along the nearest edge of the
// work area, slides AWAY when the cursor gets within 80px, and snaps to a corner when it
// drifts within range of one. It NEVER enters the screen interior and NEVER leaves the
// work area. All math is deterministic and side-effect free so it can be unit-tested
// without Electron; main.mjs feeds it the cursor + work area each tick and applies the
// returned {x, y} to the overlay window.
//
// Tokens honoured: dodge 200ms linear (caller drives the timer), idle drift ~10px/s,
// 80px hitbox, 30% corner-snap magnetism within 60px of a corner.

export const DODGE_RADIUS = 80; // keep this many px between cursor and globe centre
export const CORNER_SNAP_RANGE = 60; // begin snapping within this many px of a corner
export const CORNER_SNAP_FACTOR = 0.3; // 30% magnetism per tick
export const DRIFT_PX_PER_SEC = 10;

/**
 * @param {object} state   { x, y, edge:'top'|'bottom'|'left'|'right', driftDir:1|-1 }
 * @param {object} cursor  { x, y } absolute, on the same display
 * @param {object} workArea{ x, y, width, height } the focused display's work area
 * @param {object} opts    { size, dtMs }  globe square size + ms since last tick
 * @returns {object} next state { x, y, edge, driftDir }
 */
export function tickPhysics(state, cursor, workArea, opts = {}) {
  const size = Number(opts.size) || 96;
  const dtMs = Number.isFinite(opts.dtMs) ? opts.dtMs : 33;
  const wa = normalizeWorkArea(workArea, size);
  const edge = state?.edge && ["top", "bottom", "left", "right"].includes(state.edge) ? state.edge : "top";
  let driftDir = state?.driftDir === -1 ? -1 : 1;

  // Start from the previous position, clamped onto the current edge (handles display changes).
  let { x, y } = clampToEdge(snap(state, wa, size), edge, wa, size);

  const horizontal = edge === "top" || edge === "bottom";
  const cursorPos = horizontal ? cursor?.x : cursor?.y;
  const globeCentre = (horizontal ? x : y) + size / 2;
  const cursorAxisOk = isFinite(cursorPos);

  // 1) Cursor dodge — only meaningful when the cursor is near the globe's edge band.
  const onBand = cursorAxisOk && cursorNearEdge(edge, cursor, wa, size);
  let dodging = false;
  if (onBand && Math.abs(cursorPos - globeCentre) < DODGE_RADIUS) {
    dodging = true;
    // Slide away along the edge. Pick whichever side keeps the globe in-bounds AND
    // farthest from the cursor — so a cornered globe flees inward instead of pinning
    // itself against the wall right under the cursor.
    const b = horizontal ? minMaxX(wa, size) : minMaxY(wa, size);
    const posMinus = clamp(cursorPos - DODGE_RADIUS - size / 2, b.min, b.max);
    const posPlus = clamp(cursorPos + DODGE_RADIUS - size / 2, b.min, b.max);
    const distMinus = Math.abs(posMinus + size / 2 - cursorPos);
    const distPlus = Math.abs(posPlus + size / 2 - cursorPos);
    let chosen;
    if (distPlus > distMinus) {
      chosen = posPlus;
      driftDir = 1;
    } else if (distMinus > distPlus) {
      chosen = posMinus;
      driftDir = -1;
    } else {
      // Tie — keep fleeing the way we were already going.
      chosen = driftDir === -1 ? posMinus : posPlus;
    }
    if (horizontal) x = chosen;
    else y = chosen;
  } else {
    // 2) Idle drift along the edge.
    const step = (DRIFT_PX_PER_SEC * dtMs) / 1000;
    if (horizontal) x += driftDir * step;
    else y += driftDir * step;
  }

  // Bounce off the ends of the edge so the globe never escapes the work area.
  const bounced = bounce({ x, y }, edge, driftDir, wa, size);
  x = bounced.x;
  y = bounced.y;
  driftDir = bounced.driftDir;

  // 3) Corner-snap magnetism — idle drift only. Never while fleeing the cursor.
  if (!dodging) {
    const snapped = applyCornerSnap({ x, y }, edge, wa, size);
    x = snapped.x;
    y = snapped.y;
  }

  // Final hard clamp — invariant: always on the edge, always inside the work area.
  ({ x, y } = clampToEdge({ x, y }, edge, wa, size));
  return { x: Math.round(x), y: Math.round(y), edge, driftDir };
}

function normalizeWorkArea(workArea, size) {
  const wa = workArea || {};
  const width = Math.max(size, Number(wa.width) || size);
  const height = Math.max(size, Number(wa.height) || size);
  return { x: Number(wa.x) || 0, y: Number(wa.y) || 0, width, height };
}

function snap(state, wa, size) {
  const x = Number.isFinite(state?.x) ? state.x : wa.x + (wa.width - size) / 2;
  const y = Number.isFinite(state?.y) ? state.y : wa.y;
  return { x, y };
}

function minMaxX(wa, size) {
  return { min: wa.x, max: wa.x + wa.width - size };
}
function minMaxY(wa, size) {
  return { min: wa.y, max: wa.y + wa.height - size };
}

// Pins the globe ONTO its edge (fixed cross-axis) and clamps the along-edge axis in-bounds.
function clampToEdge(pos, edge, wa, size) {
  const xb = minMaxX(wa, size);
  const yb = minMaxY(wa, size);
  let x = clamp(pos.x, xb.min, xb.max);
  let y = clamp(pos.y, yb.min, yb.max);
  if (edge === "top") y = yb.min;
  else if (edge === "bottom") y = yb.max;
  else if (edge === "left") x = xb.min;
  else if (edge === "right") x = xb.max;
  return { x, y };
}

function cursorNearEdge(edge, cursor, wa, size) {
  // Dodge only when the cursor is within ~1.5 globe-heights of the globe's edge band.
  const band = size * 1.5;
  if (edge === "top") return cursor.y <= wa.y + band;
  if (edge === "bottom") return cursor.y >= wa.y + wa.height - band;
  if (edge === "left") return cursor.x <= wa.x + band;
  return cursor.x >= wa.x + wa.width - band;
}

function bounce(pos, edge, driftDir, wa, size) {
  const horizontal = edge === "top" || edge === "bottom";
  const b = horizontal ? minMaxX(wa, size) : minMaxY(wa, size);
  let v = horizontal ? pos.x : pos.y;
  let dir = driftDir;
  if (v < b.min) {
    v = b.min;
    dir = 1;
  } else if (v > b.max) {
    v = b.max;
    dir = -1;
  }
  return horizontal ? { x: v, y: pos.y, driftDir: dir } : { x: pos.x, y: v, driftDir: dir };
}

function applyCornerSnap(pos, edge, wa, size) {
  const xb = minMaxX(wa, size);
  const yb = minMaxY(wa, size);
  const horizontal = edge === "top" || edge === "bottom";
  let v = horizontal ? pos.x : pos.y;
  const lo = horizontal ? xb.min : yb.min;
  const hi = horizontal ? xb.max : yb.max;
  if (v - lo <= CORNER_SNAP_RANGE) v = lo + (v - lo) * (1 - CORNER_SNAP_FACTOR);
  else if (hi - v <= CORNER_SNAP_RANGE) v = hi - (hi - v) * (1 - CORNER_SNAP_FACTOR);
  return horizontal ? { x: v, y: pos.y } : { x: pos.x, y: v };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Is the cursor within the globe's clickable hitbox? main.mjs uses this to flip
 * setIgnoreMouseEvents on/off so clicks reach the globe button but pass through elsewhere.
 */
export function cursorOverGlobe(globePos, cursor, size = 96) {
  const cx = globePos.x + size / 2;
  const cy = globePos.y + size / 2;
  const dx = cursor.x - cx;
  const dy = cursor.y - cy;
  return Math.hypot(dx, dy) <= DODGE_RADIUS;
}

// ===== RUN 12 — free-roam motion (globe v2) =================================================
// The globe v2 free-roams the whole work area: it drifts toward a caller-supplied waypoint and is
// pushed away from the cursor by a spring-damped force, so it flows like water around the pointer.
// Pure + deterministic (no clock, no RNG — the caller picks waypoints), so it is unit-testable.
export const REPEL_RADIUS = 180;   // cursor influence radius (px)
export const REPEL_STRENGTH = 0.8; // peak force coefficient
export const ROAM_DAMPING = 0.92;  // velocity retained per tick (water-like)
export const ROAM_PADDING = 40;    // keep this far from the left/right/bottom work-area edges
// L2 (2026-07-02) — extra clearance from the TOP so the globe never hugs / gets clipped at the screen edge
// (menu bar / notch / title area) and its clicks never fall through to the window behind. Anchored fully
// on-screen with breathing room per Ahmad's QA note.
export const ROAM_TOP_PADDING = 88;

// Cursor-repulsion force magnitude: (1 - dist/radius)^2 * strength, and exactly 0 at/Beyond radius.
export function repelForce(dist, radius = REPEL_RADIUS) {
  const d = Number(dist);
  if (!Number.isFinite(d) || d >= radius) return 0;
  const t = 1 - Math.max(0, d) / radius;
  return t * t * REPEL_STRENGTH;
}

/**
 * One free-roam tick.
 * @param {object} state {x,y,vx,vy, waypoint:{x,y}}
 * @param {object} cursor {x,y} absolute on the focused display (or null)
 * @param {object} workArea {x,y,width,height}
 * @param {object} opts {size, dtMs}
 * @returns {object} next {x,y,vx,vy, waypoint}
 */
export function tickFreeRoam(state, cursor, workArea, opts = {}) {
  const size = Number(opts.size) || 104;
  const dtMs = Number.isFinite(opts.dtMs) ? opts.dtMs : 16;
  const wa = normalizeWorkArea(workArea, size);
  const minX = wa.x + ROAM_PADDING;
  const minY = wa.y + ROAM_TOP_PADDING; // L2 — extra top clearance so the globe never hugs the top edge
  const maxX = Math.max(minX, wa.x + wa.width - size - ROAM_PADDING);
  const maxY = Math.max(minY, wa.y + wa.height - size - ROAM_PADDING);

  let x = Number.isFinite(state?.x) ? state.x : (minX + maxX) / 2;
  let y = Number.isFinite(state?.y) ? state.y : (minY + maxY) / 2;
  let vx = Number.isFinite(state?.vx) ? state.vx : 0;
  let vy = Number.isFinite(state?.vy) ? state.vy : 0;
  const wp = state?.waypoint && Number.isFinite(state.waypoint.x)
    ? state.waypoint
    : { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };

  // 1) gentle drift toward the waypoint
  const driftK = 0.0016 * dtMs;
  vx += (wp.x - x) * driftK;
  vy += (wp.y - y) * driftK;

  // 2) cursor repulsion (away from the cursor, spring-like falloff)
  if (cursor && Number.isFinite(cursor.x) && Number.isFinite(cursor.y)) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const dx = cx - cursor.x;
    const dy = cy - cursor.y;
    const dist = Math.hypot(dx, dy);
    const f = repelForce(dist);
    if (f > 0 && dist > 0.0001) {
      const push = f * 42; // scale force → px/tick velocity kick
      vx += (dx / dist) * push;
      vy += (dy / dist) * push;
    }
  }

  // 3) damping → 4) integrate
  vx *= ROAM_DAMPING;
  vy *= ROAM_DAMPING;
  x += vx;
  y += vy;

  // 5) clamp to work area (minus padding); soft-bounce velocity at the walls
  if (x < minX) { x = minX; vx = Math.abs(vx) * 0.3; }
  else if (x > maxX) { x = maxX; vx = -Math.abs(vx) * 0.3; }
  if (y < minY) { y = minY; vy = Math.abs(vy) * 0.3; }
  else if (y > maxY) { y = maxY; vy = -Math.abs(vy) * 0.3; }

  return { x: Math.round(x), y: Math.round(y), vx, vy, waypoint: wp };
}

// Bounds (padded) a free-roam waypoint/position must stay within, for a given work area + size.
export function roamBounds(workArea, size = 104) {
  const wa = normalizeWorkArea(workArea, size);
  return {
    minX: wa.x + ROAM_PADDING,
    minY: wa.y + ROAM_TOP_PADDING, // L2 — extra top clearance (matches tickFreeRoam)
    maxX: Math.max(wa.x + ROAM_PADDING, wa.x + wa.width - size - ROAM_PADDING),
    maxY: Math.max(wa.y + ROAM_TOP_PADDING, wa.y + wa.height - size - ROAM_PADDING)
  };
}
