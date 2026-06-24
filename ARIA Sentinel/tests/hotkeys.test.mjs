// RUN 13 §11 — the three global hotkeys are actually registered, and the UI marks them Active.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const mainJs = fs.readFileSync(path.join(root, "src", "main", "main.mjs"), "utf8");
const hotkeysMod = fs.readFileSync(path.join(root, "src", "shared", "hotkeys.mjs"), "utf8");

// RUN 15 §7 — the three combos are still Ctrl+Alt+A/G/P, but now defined in DEFAULT_HOTKEYS and
// bound through registerHotkeys()/bindAll() with fallback, instead of inline register() calls.
assert.match(hotkeysMod, /combo:\s*["']CommandOrControl\+Alt\+A["'][^}]*action:\s*["']focus-chat["']/, "Ctrl+Alt+A → focus-chat");
assert.match(hotkeysMod, /combo:\s*["']CommandOrControl\+Alt\+G["'][^}]*action:\s*["']toggle-globe["']/, "Ctrl+Alt+G → toggle-globe");
assert.match(hotkeysMod, /combo:\s*["']CommandOrControl\+Alt\+P["'][^}]*action:\s*["']pause-24h["']/, "Ctrl+Alt+P → pause-24h");
assert.match(mainJs, /globalShortcut\.register\(combo,\s*handler\)/, "registration runs through bindAll");
assert.match(mainJs, /function registerHotkeys\(\)/, "registerHotkeys() wires the hotkeys");
// G toggles visibility; A focuses chat; P pauses 24h.
assert.match(mainJs, /isVisible\(\)\)\s*hideOverlay\(\)/, "toggle-globe hides when visible");
// RUN 33 PIVOT — the chat hotkey (Ctrl+Alt+A / focus-chat) opens the in-app ARIA tab (Chat sub-section).
assert.match(mainJs, /action === "focus-chat"[\s\S]{0,120}showMainWindow\("aria"\)/, "chat hotkey opens the in-app ARIA tab");
assert.match(mainJs, /globalShortcut\.unregisterAll\(\)/, "shortcuts cleaned up on quit");

// UI shows them as Active (no longer "Planned").
const indexHtml = fs.readFileSync(path.join(root, "src", "renderer", "index.html"), "utf8");
const hotkeysPanel = indexHtml.slice(indexHtml.indexOf('id="hotkeys"'));
assert.ok(!/Planned/.test(hotkeysPanel.slice(0, 600)), "hotkeys no longer marked Planned");
assert.match(hotkeysPanel.slice(0, 600), /Active/, "hotkeys marked Active");

console.log("Hotkeys test passed (Ctrl+Alt+A/G/P via bindAll + cleaned up + UI Active).");
