// RUN 13 — per-mode globe behaviour (§4).
import assert from "node:assert/strict";
import { modeOverlayBehavior } from "../src/shared/mode-behavior.mjs";

const autonomous = modeOverlayBehavior("autonomous");
assert.equal(autonomous.alwaysOnTop, true, "autonomous pins the globe");
assert.equal(autonomous.level, "screen-saver");
assert.equal(autonomous.ignoreMouse, false, "interactive in autonomous");
assert.equal(autonomous.autoFix, true);

const confirmed = modeOverlayBehavior("confirmed");
assert.equal(confirmed.alwaysOnTop, true, "confirmed pins the globe");
assert.equal(confirmed.autoFix, false, "confirmed still asks");

const manual = modeOverlayBehavior("manual");
assert.equal(manual.alwaysOnTop, false, "manual free-roams (not pinned)");
assert.equal(manual.ignoreMouse, true, "manual is click-through");
assert.equal(manual.autoFix, false);

// Unknown mode falls back to the safe manual behaviour.
assert.deepEqual(modeOverlayBehavior("???"), manual);

// main.mjs wires it: applyModeBehavior must call setAlwaysOnTop with the derived value.
import fs from "node:fs";
import path from "node:path";
const mainJs = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "src", "main", "main.mjs"), "utf8");
assert.match(mainJs, /modeOverlayBehavior/, "main uses modeOverlayBehavior");
assert.match(mainJs, /setAlwaysOnTop/, "main applies alwaysOnTop");

console.log("Mode-behavior test passed (autonomous/confirmed pin · manual free-roams · main wired).");
