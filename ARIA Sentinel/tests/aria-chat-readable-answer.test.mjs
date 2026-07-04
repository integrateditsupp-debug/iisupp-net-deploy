// 2026-07-04 - Desktop ARIA chat must be readable like the web ARIA answer cards.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const renderer = read("src", "renderer", "renderer.js");
const css = read("src", "renderer", "sentinel.css");

assert.match(renderer, /function shapeReadableAriaAnswer\(rawText, res, question\)/, "KB answers are shaped before display");
assert.match(renderer, /function renderReadableAriaAnswer\(model\)/, "guided answer renderer exists");
assert.match(renderer, /Knowledge-base match/, "answer card has clear source label");
assert.match(renderer, /Start with the safest checks below/, "answer card gives simple instruction");
assert.match(renderer, /Show KB detail/, "raw KB detail is collapsed behind a drawer");
assert.match(renderer, /Sentinel never applies a fix from chat without the normal approval gates/, "local action safety copy present");
assert.match(renderer, /shapeReadableAriaAnswer\(cleanText, res, question\)/, "fill() uses readable answer shape");

assert.match(css, /\.aria-answer-card/, "answer card styling exists");
assert.match(css, /\.aria-answer-steps/, "steps are styled");
assert.match(css, /\.aria-answer-details summary/, "KB detail drawer is styled");
assert.match(css, /\.aria-chat-row\.aria[^}]*max-width:min\(700px,96%\)/, "ARIA answers get enough width for readable steps");
assert.match(css, /\.aria-chat-row\.aria \.aria-chat-bubble[^}]*white-space:normal/, "ARIA answer cards are not forced into pre-wrap blobs");

console.log("aria-chat-readable-answer passed.");
