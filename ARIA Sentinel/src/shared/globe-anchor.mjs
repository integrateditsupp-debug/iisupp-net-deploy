// globe-anchor — RUN 15 §2 globe v3 motion: anchored to the focused window's top-center, repelled by
// the cursor within 180px, and smoothly teleporting back to centre after 2s of no nearby cursor.
// PURE + deterministic (caller supplies cursor/target/now); overlay.js applies the result.
import { repelForce, REPEL_RADIUS } from "../main/overlay-physics.mjs";

export const IDLE_TELEPORT_MS = 2000; // return to centre after this long with no nearby cursor
export const LERP = 0.18;             // smoothing toward the anchor each tick
export const ANCHOR_TOP_MARGIN = 12;

// Top-centre anchor point for a window's bounds.
export function anchorTarget(bounds, size = 104, topMargin = ANCHOR_TOP_MARGIN) {
  const b = bounds || { x: 0, y: 0, width: size, height: size };
  return { x: Math.round(b.x + (b.width - size) / 2), y: Math.round(b.y + topMargin) };
}

/**
 * One v3 tick.
 * @param {object} state { x, y, vx, vy, lastNearMs }
 * @param {object} args { cursor:{x,y}, target:{x,y}, now, size }
 * @returns {object} next state
 */
export function tickAnchored(state, args = {}) {
  const size = Number(args.size) || 104;
  const target = args.target || { x: 0, y: 0 };
  const now = Number.isFinite(args.now) ? args.now : 0;
  let x = Number.isFinite(state?.x) ? state.x : target.x;
  let y = Number.isFinite(state?.y) ? state.y : target.y;
  let vx = Number.isFinite(state?.vx) ? state.vx : 0;
  let vy = Number.isFinite(state?.vy) ? state.vy : 0;
  let lastNearMs = Number.isFinite(state?.lastNearMs) ? state.lastNearMs : -Infinity;

  const cursor = args.cursor;
  let near = false;
  if (cursor && Number.isFinite(cursor.x)) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const dist = Math.hypot(cx - cursor.x, cy - cursor.y);
    if (dist < REPEL_RADIUS) {
      near = true;
      lastNearMs = now;
      const f = repelForce(dist);
      if (f > 0 && dist > 0.0001) {
        vx += ((cx - cursor.x) / dist) * f * 42;
        vy += ((cy - cursor.y) / dist) * f * 42;
      }
    }
  }

  const idleLongEnough = now - lastNearMs >= IDLE_TELEPORT_MS;
  if (!near && idleLongEnough) {
    // Smoothly return to the top-centre anchor (teleport-back via lerp), snapping when within ~1px so
    // integer rounding can't leave it permanently a couple pixels off (and so it doesn't jitter at rest).
    vx = 0; vy = 0;
    x = Math.abs(target.x - x) <= 2.5 ? target.x : x + (target.x - x) * LERP;
    y = Math.abs(target.y - y) <= 2.5 ? target.y : y + (target.y - y) * LERP;
  } else {
    vx *= 0.9; vy *= 0.9;
    x += vx; y += vy;
  }

  return { x: Math.round(x), y: Math.round(y), vx, vy, lastNearMs };
}

// True once the globe is effectively back at the anchor (within 1px).
export function atAnchor(state, target) {
  return Math.abs(state.x - target.x) <= 1 && Math.abs(state.y - target.y) <= 1;
}
