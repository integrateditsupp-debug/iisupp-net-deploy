// RUN 22 §1 — 7 hero KPI tiles with sparklines + delta arrows, rendered from real data. (B1 adds deflection tile)
import assert from "node:assert/strict";
import { heroTiles, sparklineSvg, deltaArrow, kpiTile } from "../src/shared/dashboard-status.mjs";
import { tileHtml, tilesHtml } from "../src/renderer/tabs/dashboard.mjs";

// Six tiles, in the packet's order.
const tiles = heroTiles({ uptime7d: 99.9, mttr: 4, accuracy: 92, breaches: 1, hoursSaved: 33, deflectionPct: 75, version: "0.1.0", updatePending: true });
assert.equal(tiles.length, 7); // B1: deflection tile added
assert.deepEqual(tiles.map((t) => t.id), ["status", "mttr", "accuracy", "breaches", "hours", "deflection", "update"]); // B1: deflection tile

// Sparkline is inline SVG (no chart lib).
const svg = sparklineSvg([1, 3, 2, 5, 4]);
assert.match(svg, /<svg/);
assert.match(svg, /<polyline/);
assert.equal(sparklineSvg([1]).includes("polyline"), false, "needs >=2 points to draw");

// Delta arrows: up / down / flat.
assert.equal(deltaArrow(110, 100).dir, "up");
assert.equal(deltaArrow(90, 100).dir, "down");
assert.equal(deltaArrow(100, 100).dir, "flat");
assert.equal(deltaArrow(110, 100).symbol, "▲");

// kpiTile composes value + sparkline + delta.
const tile = kpiTile({ id: "x", label: "Accuracy", value: 92, unit: "%", values: [80, 85, 92], prev: 85 });
assert.equal(tile.delta.dir, "up");
assert.match(tile.sparkline, /svg/);

// HTML builder renders all six tiles with values + labels.
const html = tilesHtml(tiles);
assert.equal((html.match(/kpi-tile/g) || []).length, 7, "7 tile divs (B1 deflection tile)");
assert.match(tileHtml(tiles[0]), /kpi-value/);
assert.match(tileHtml(tiles[0]), /kpi-label/);

console.log("Dashboard-kpi-tiles test passed (7 tiles · deflection · inline-SVG sparklines · up/down/flat deltas).");
