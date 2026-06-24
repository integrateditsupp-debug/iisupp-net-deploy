// RUN 16 §B — QA battery. Drives the 47-item tests/qa-inventory.json and asserts every entry is
// wired end-to-end across the real source: tabs render, buttons bind (button→renderer), IPC channels
// have a main handler + a preload bridge, hotkeys are defined, recipes resolve.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { recipeById } from "../src/shared/recipes.mjs";
import { DEFAULT_HOTKEYS } from "../src/shared/hotkeys.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const indexHtml = read("src", "renderer", "index.html");
const rendererJs = read("src", "renderer", "renderer.js");
const preload = read("src", "main", "preload.cjs");
const mainJs = read("src", "main", "main.mjs");

const inventory = JSON.parse(read("tests", "qa-inventory.json")).items;
assert.equal(inventory.length, 46, "QA inventory holds exactly 46 items (RUN 23d: 9-tab IA)");

let checks = 0;
const counts = { tab: 0, button: 0, ipc: 0, hotkey: 0, recipe: 0 };
for (const item of inventory) {
  if (item.type === "tab") {
    assert.match(indexHtml, new RegExp(`data-tab="${item.id}"`), `tab nav button: ${item.id}`);
    assert.match(indexHtml, new RegExp(`id="${item.id}"\\s+class="tab-panel`), `tab panel renders: ${item.id}`);
  } else if (item.type === "button") {
    assert.match(indexHtml, new RegExp(`id="${item.id}"`), `button present: ${item.id}`);
    assert.match(rendererJs, new RegExp(`\\b${item.id}\\b`), `renderer binds button: ${item.id}`);
  } else if (item.type === "ipc") {
    const ch = item.channel;
    assert.match(mainJs, new RegExp(`ipcMain\\.handle\\(["']${ch}["']`), `main handles IPC: ${ch}`);
    // preload exposes a bridge that invokes the channel.
    assert.match(preload, new RegExp(`invoke\\(["']${ch}["']`), `preload bridges IPC: ${ch}`);
  } else if (item.type === "hotkey") {
    assert.ok(DEFAULT_HOTKEYS.some((h) => h.id === item.id), `hotkey defined: ${item.id}`);
  } else if (item.type === "recipe") {
    const r = recipeById(item.id);
    assert.ok(r && r.id === item.id, `recipe resolves: ${item.id}`);
    assert.ok(Array.isArray(r.actions) && r.actions.length, `recipe has actions: ${item.id}`);
    assert.ok(["green", "yellow", "orange", "red"].includes(r.risk), `recipe has risk tier: ${item.id}`);
  } else {
    throw new Error(`unknown inventory type: ${item.type}`);
  }
  counts[item.type]++;
  checks++;
}

// Coverage shape: every tab + the hotkey trio + a recipe sample + core IPC are represented.
assert.equal(counts.tab, 9, "all 9 tabs covered (RUN 23d)");
assert.equal(counts.hotkey, 3, "all 3 hotkeys covered");
assert.ok(counts.button >= 25, "≥25 buttons covered");
assert.ok(counts.ipc >= 6, "≥6 IPC channels covered");

console.log(`QA battery passed (${checks}/46 inventory items wired: ${counts.tab} tabs · ${counts.button} buttons · ${counts.ipc} IPC · ${counts.hotkey} hotkeys · ${counts.recipe} recipes).`);
