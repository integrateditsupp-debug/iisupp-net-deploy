// RUN 15 §7 — hotkeys actually bind, with fallback combos when the primary is blocked.
import assert from "node:assert/strict";
import { registerWithFallback, bindAll, withRebinds, DEFAULT_HOTKEYS } from "../src/shared/hotkeys.mjs";
import fs from "node:fs";
import path from "node:path";

const def = DEFAULT_HOTKEYS[0]; // chat: Alt+A, fallback Shift+A

// Primary binds → active, no fallback.
const ok = registerWithFallback(def, () => true, () => true, () => {});
assert.equal(ok.status, "active");
assert.equal(ok.usedFallback, false);
assert.equal(ok.combo, def.combo);

// Primary blocked (register throws), fallback works → active via fallback.
let attempts = [];
const reg = (combo) => { attempts.push(combo); if (combo === def.combo) throw new Error("blocked"); return true; };
const fb = registerWithFallback(def, reg, () => true, () => {});
assert.equal(fb.status, "active");
assert.equal(fb.usedFallback, true);
assert.equal(fb.combo, def.fallback);
assert.deepEqual(attempts, [def.combo, def.fallback], "tries primary then fallback");

// register returns true but isRegistered says false → treated as failure → fallback.
const liar = registerWithFallback(def, () => true, (c) => c === def.fallback, () => {});
assert.equal(liar.combo, def.fallback, "confirms with isRegistered, not just the return value");

// Both blocked → failed (surfaced, not silent).
const dead = registerWithFallback(def, () => false, () => false, () => {});
assert.equal(dead.status, "failed");
assert.equal(dead.reason, "all-combos-blocked");

// bindAll over all three defaults.
const all = bindAll(DEFAULT_HOTKEYS, () => true, () => true);
assert.equal(all.length, 3);
assert.ok(all.every((h) => h.status === "active"));

// Rebinds override the default combo.
const rebound = withRebinds(DEFAULT_HOTKEYS, { chat: "CommandOrControl+Alt+J" });
assert.equal(rebound.find((d) => d.id === "chat").combo, "CommandOrControl+Alt+J");

// main hardens registration (try/catch + fallback), not the RUN 12 bare register.
const root = path.resolve(import.meta.dirname, "..");
const mainJs = fs.readFileSync(path.join(root, "src", "main", "main.mjs"), "utf8");
assert.match(mainJs, /registerWithFallback|bindAll/, "main uses the hardened hotkey binder");

console.log("Hotkeys-bind test passed (primary · fallback on block · isRegistered confirm · failed surfaced · rebinds).");
