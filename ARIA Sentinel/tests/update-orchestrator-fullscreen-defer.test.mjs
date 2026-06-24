// RUN 21 §2 — anti-rage clause: NEVER force-install while the user is in a fullscreen app (game,
// presentation, video call). Applies to mandatory updates too.
import assert from "node:assert/strict";
import { nextOpportunity, canInstallNow } from "../src/main/update-orchestrator.mjs";

const now = Date.parse("2026-07-05T00:00:00.000Z");
const auto = { phase: "AUTO", firstSeenAt: new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString() };

// Even in the preferred evening window, fullscreen defers the install.
const r = nextOpportunity(auto, { on: true, running: true, localHour: 18, fullscreen: true, now });
assert.equal(r.action, "defer");
assert.equal(r.reason, "fullscreen-busy");

// Same window, NOT fullscreen → installs.
assert.equal(nextOpportunity(auto, { on: true, running: true, localHour: 18, fullscreen: false, now }).action, "install");

// canInstallNow (the hard gate used before ANY install, including mandatory) blocks on fullscreen.
assert.equal(canInstallNow({ on: true, running: true, fullscreen: true }), false, "mandatory still blocked by fullscreen");
assert.equal(canInstallNow({ on: true, running: true, fullscreen: false }), true);
assert.equal(canInstallNow({ on: false, running: true, fullscreen: false }), false);

// main.mjs runs every install through canInstallNow (defers when fullscreen).
import fs from "node:fs";
import path from "node:path";
const main = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "src", "main", "main.mjs"), "utf8");
assert.match(main, /canInstallNow\(/, "main gates installs on canInstallNow");
assert.match(main, /isFullscreenBusy\(/, "main supplies a fullscreen flag");

console.log("Update-orchestrator-fullscreen-defer test passed (fullscreen defers install; mandatory respects the same gate).");
