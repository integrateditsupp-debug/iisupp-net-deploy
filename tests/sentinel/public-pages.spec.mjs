#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

const admin = read("sentinel-admin/index.html");
const docs = read("aria-sentinel/docs/index.html");
const netlify = read("netlify.toml");

const forbidden = [/money-back/i, /risk-free/i, /Raymond James/i];

for (const [name, html] of [
  ["sentinel-admin", admin],
  ["aria-sentinel-docs", docs]
]) {
  assert.match(html, /<title>ARIA Sentinel/i, `${name} must have Sentinel title`);
  assert.match(html, /<h1>/i, `${name} must render a first-level heading`);
  assert.match(html, /#c5a059|var\(--gold/i, `${name} must use ARIA gold token`);
  assert.doesNotMatch(html, /ARIA Sentinel\/(src|dist|package|node_modules)/i, `${name} must not link private app source`);
  for (const phrase of forbidden) {
    assert.doesNotMatch(html, phrase, `${name} contains blocked claim or reference: ${phrase}`);
  }
}

for (const endpoint of [
  "aria-recipes",
  "aria-stop-codes",
  "aria-kb-bundle",
  "aria-recipe-feedback"
]) {
  assert.match(docs, new RegExp(endpoint, "i"), `docs missing endpoint ${endpoint}`);
}

for (const publicRoute of ["/sentinel-admin", "/aria-sentinel/docs"]) {
  assert.match(netlify, new RegExp(`from = "${publicRoute.replace(/\//g, "\\/")}"`), `netlify missing public route ${publicRoute}`);
}

for (const blockedRoute of ["/apps/*", "/tests/*", "/ARIA%20Sentinel/*", "/ARIA Sentinel/*", "/.github/*"]) {
  assert.match(netlify, new RegExp(`from = "${blockedRoute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`), `netlify missing source block ${blockedRoute}`);
}

console.log("Sentinel public-page gate passed.");
