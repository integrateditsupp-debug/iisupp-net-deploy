#!/usr/bin/env node
// KB-ANSWER-SHAPE PARITY — assets/kb-answer-shape.mjs is the public-web mirror of the canonical
// ARIA Sentinel/src/shared/kb-answer-shape.mjs (the web bundle can't cross-import the spaced Sentinel
// tree). This suite fails the moment the two drift, so the FAQ + concierge can never quietly ship a
// weaker shaper than the desktop uses.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as web from "../assets/kb-answer-shape.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Import the canonical via a URL so the space in "ARIA Sentinel" resolves cleanly.
const canon = await import(new URL("../ARIA Sentinel/src/shared/kb-answer-shape.mjs", import.meta.url));

const kb = JSON.parse(readFileSync(path.join(root, "assets/aria-kb-chunks.json"), "utf8"));
const printer = (kb.chunks || []).find((c) => c.slug === "l1-printer-001-not-printing");
assert.ok(printer, "have the real printer article to test against");

const cases = [
  printer.content,
  "# Learned tip\n\nJust restart the app and try again.", // no numbered sections
  "## Internal Technician Notes\nHKLM\\SYSTEM secret\n## User-Friendly Explanation\nit's fine", // internal-first
  "",
  null
];
for (const c of cases) {
  assert.equal(web.shapeKbAnswerForEndUser(c), canon.shapeKbAnswerForEndUser(c), "shapeKbAnswerForEndUser parity");
  assert.deepEqual(web.splitShapedAnswer(web.shapeKbAnswerForEndUser(c)), canon.splitShapedAnswer(canon.shapeKbAnswerForEndUser(c)), "splitShapedAnswer parity");
}
// isEndUserSafe agrees on internal vs safe content.
for (const t of ["clean text", "Internal Technician Notes: x", "HKLM\\SYSTEM\\x", "Keywords / Search Tags: a, b"]) {
  assert.equal(web.isEndUserSafe(t), canon.isEndUserSafe(t), `isEndUserSafe parity for: ${t.slice(0, 20)}`);
}
// The mirror actually strips internal content on the real article.
const shaped = web.shapeKbAnswerForEndUser(printer.content);
assert.ok(web.isEndUserSafe(shaped), "real article shapes to end-user-safe");
assert.ok(/What to do/.test(shaped), "leads into the fix steps");

console.log("kb-answer-shape parity test passed (web mirror === canonical Sentinel shaper).");
