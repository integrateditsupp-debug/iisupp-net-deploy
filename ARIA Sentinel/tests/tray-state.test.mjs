// RUN 2 — tray dynamic state. makeTrayImage(state) wraps tray-art's traySvg() in a nativeImage;
// nativeImage needs the Electron runtime, so we test the pure SVG generator instead: the four
// states must each yield a DISTINCT image source, an unknown state must fall back to idle, and
// every output must be well-formed SVG carrying its state marker.
import assert from "node:assert/strict";
import { TRAY_STATES, traySvg, traySvgDataUrl, normalizeTrayState } from "../src/main/tray-art.mjs";

// 1) Exactly the four documented states.
assert.deepEqual(TRAY_STATES, ["idle", "detection", "fixing", "escalation"]);

// 2) All four SVGs are pairwise distinct (so the four nativeImages differ).
const svgs = TRAY_STATES.map((s) => traySvg(s));
const unique = new Set(svgs);
assert.equal(unique.size, TRAY_STATES.length, "each tray state renders a distinct SVG");

// 3) Distinct again at the data-URL layer main.mjs actually hands to nativeImage.
const urls = TRAY_STATES.map((s) => traySvgDataUrl(s));
assert.equal(new Set(urls).size, TRAY_STATES.length, "each tray state yields a distinct data URL");
for (const url of urls) assert.ok(url.startsWith("data:image/svg+xml,"), "data URL is an inline SVG");

// 4) Each SVG is well-formed-ish and tagged with its state.
for (const state of TRAY_STATES) {
  const svg = traySvg(state);
  assert.match(svg, /^<svg[\s\S]*<\/svg>$/, `${state} is a complete <svg>`);
  assert.match(svg, new RegExp(`data-state="${state}"`), `${state} carries its state marker`);
}

// 5) The non-idle states each add a glyph the idle state does not have (visible difference).
const idle = traySvg("idle");
for (const state of ["detection", "fixing", "escalation"]) {
  assert.notEqual(traySvg(state).length, idle.length, `${state} differs from idle in markup`);
}

// 6) Unknown / missing state falls back to idle (never throws, never blank).
assert.equal(traySvg("nonsense"), idle, "unknown state falls back to idle");
assert.equal(traySvg(undefined), idle, "missing state falls back to idle");
assert.equal(normalizeTrayState("escalation"), "escalation");
assert.equal(normalizeTrayState("???"), "idle");

console.log(`Tray-state test passed (${TRAY_STATES.length} distinct state icons, idle fallback).`);
