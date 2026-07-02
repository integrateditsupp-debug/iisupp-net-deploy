// PART A — the web ARIA page (aria.html) must expose a clear, prominent "Walk me through it in ARIA Sentinel"
// option that opens the desktop app in GUIDE mode (mode=walkthrough) with an HONEST, always-visible download
// fallback — never a dead click. D-20260624: the web hands off, it NEVER runs a local fix. Light DOM/asset check.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(import.meta.dirname, "..", "..");
const aria = fs.readFileSync(path.join(repo, "aria.html"), "utf8");
const handoff = fs.readFileSync(path.join(repo, "assets", "aria-sentinel-handoff.js"), "utf8");
let n = 0; const t = () => { n++; };

// 1 — a prominent, labelled CTA exists (button + accessible aria-label + the data hook the wiring binds).
assert.match(aria, /Walk me through it in ARIA Sentinel/, "CTA label present");
assert.match(aria, /data-walk-sentinel/, "CTA data hook present");
assert.match(aria, /aria-label="Walk me through it in ARIA Sentinel"/, "CTA is accessible (aria-label)");
t();

// 2 — clicking the CTA fires the deep-link in walkthrough mode (opens the app's Walk-through tab in GUIDE mode).
assert.match(aria, /openWithSentinel\(intent, sentinelRecipeForIntent\(intent\), function onNotInstalled[\s\S]*?, 'walkthrough'\)/, "CTA fires the deep-link with mode=walkthrough");
assert.match(aria, /function openWithSentinel\(intent, recipeId, onNotInstalled, mode\)/, "openWithSentinel takes a mode param");
assert.match(aria, /\(m === 'walkthrough' \|\| m === 'apply'\) \? '&mode=' \+ m : ''/, "openWithSentinel appends &mode= for walkthrough/apply");
t();

// 3 — an HONEST, always-visible download fallback to /downloads/ — never a dead click.
assert.match(aria, /class="sentinel-walk-fallback"[\s\S]*?href="\/downloads\/"/, "visible download fallback to /downloads/");
assert.match(aria, /isn’t installed on this device[\s\S]*?\/downloads\//, "not-installed path also surfaces the download");
t();

// 4 — the in-browser step demo is kept as SECONDARY (relabelled a preview), so the app CTA is the clear action.
assert.match(aria, /Preview the steps here/, "in-browser guided demo relabelled as a secondary preview");
t();

// 5 — HONESTY (Rule 14 / D-20260624): the web never claims IT fixed anything; the CTA hands off to the device.
const ctaStart = aria.indexOf('class="sentinel-walk-cta"');
assert.ok(ctaStart >= 0, "CTA block found");
const ctaBlock = aria.slice(ctaStart, ctaStart + 1200);
assert.doesNotMatch(ctaBlock, /issue resolved|we fixed|fixed it for you|has been fixed/i, "CTA never fabricates a resolution");
t();

// 6 — the canonical web emitter mirrors the desktop builder's mode append (byte-parity contract holds).
assert.match(handoff, /function buildSentinelResolveLink\(recipeId, intent, mode\)/, "web builder takes mode");
assert.match(handoff, /if \(cleanMode === "walkthrough" \|\| cleanMode === "apply"\) link \+= "&mode=" \+ cleanMode;/, "web builder appends &mode= identically");
t();

assert.equal(n, 6, "6 web-walkthrough-cta groups");
console.log(`web-walkthrough-cta test passed (${n} groups · prominent accessible CTA · fires mode=walkthrough · always-visible /downloads fallback · in-browser demo secondary · no fabricated resolution · emitter mode byte-parity).`);
