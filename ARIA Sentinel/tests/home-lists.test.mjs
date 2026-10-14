// PROD 2026-10-14 (audit §4) — the plain-language HOME: "What I found / What I did / What I need from you", the
// watcher status line and the "what this version can fix" line, built ONLY from real state. Empty = an honest
// sentence; data = plain rows with the real actions; a private path can never surface (esc = redactPrivate).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { homeListsHtml, foundRowsHtml, didRowsHtml, didItemOf, needRowsHtml, watcherLine, canFixLine, fixCapability, agoLabel, WATCHER_NAMES } from "../src/renderer/tabs/home.mjs";

const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
let n = 0; const t = () => { n++; };
const NOW = Date.parse("2026-10-14T12:00:00Z");
const PRIV = "C:\\Users\\x\\Private pics and Vids\\v.mp4";

// 1 — empty state: three honest sentences, no zeros, no percentages.
const empty = homeListsHtml({}, { now: NOW });
assert.match(empty, /Nothing found so far/); assert.match(empty, /Nothing applied yet/); assert.match(empty, /Nothing needs you right now/);
assert.doesNotMatch(empty, /\b0\b|%/);
assert.match(empty, /id="homeFound"[^]*id="homeDid"[^]*id="homeNeed"/, "three blocks in order");
t();

// 2 — What I found: newest detections with Fix it / Show me / Not now; guide-only (no recipe) rows get only Not now.
const found = foundRowsHtml([
  { id: "d1", ts: new Date(NOW - 5 * 60000).toISOString(), recipeId: "printer-spooler-v1", title: "Printer stuck / queue frozen", summary: "Stuck job.", risk: "green" },
  { id: "d2", ts: new Date(NOW - 3 * 86400000).toISOString(), title: `Odd file ${PRIV}`, summary: "no recipe", risk: "red" }
], { now: NOW });
assert.match(found, /data-home-fix="printer-spooler-v1" data-risk="green">Fix it</); assert.match(found, /data-home-walk="printer-spooler-v1">Show me</); assert.match(found, /data-home-dismiss="d1">Not now</);
assert.match(found, /Stuck job\. · low risk/); assert.match(found, /needs a person/);
assert.doesNotMatch(found, /Private pics and Vids/i, "a private path is redacted");
assert.equal((found.match(/data-home-fix=/g) || []).length, 1, "no Fix it without a recipe");
t();

// 3 — What I did: only real outcomes, labelled truthfully (applied / previewed / verified / unverified / failed / cancelled).
assert.deepEqual(didItemOf({ tag: "RUN", text: "Executing recipe PRINT.SPOOLER.STUCK" }).kind, "applied");
assert.equal(didItemOf({ tag: "RUN", text: "Dry-run recipe NET.DNS.FAIL" }).kind, "previewed");
assert.equal(didItemOf({ tag: "DONE", text: "Verification for PRINT.SPOOLER.STUCK: passed." }).kind, "verified");
assert.equal(didItemOf({ tag: "REVIEW", text: "Verification for NET.DNS.FAIL: inconclusive." }).kind, "unverified");
assert.equal(didItemOf({ tag: "ERROR", text: "Restart-Service: exit 5" }).kind, "failed");
assert.equal(didItemOf({ tag: "CANCEL", text: "Action countdown aborted: wifi-no-internet-v1." }).kind, "cancelled");
assert.equal(didItemOf({ tag: "KILL-SWITCH", text: "Ctrl+Alt+K: 0 child process(es) terminated; nothing to undo." }).kind, "stopped");
assert.equal(didItemOf({ tag: "RUN", text: "Deep-link resolve requested for x — queued for your approval." }), null, "a request is not a thing ARIA did");
assert.equal(didItemOf({ tag: "DETECT", text: "x" }), null); assert.equal(didItemOf({ tag: "HEARTBEAT", text: "x" }), null);
const did = didRowsHtml([
  { ts: new Date(NOW - 60000).toISOString(), tag: "DONE", text: "Verification for PRINT.SPOOLER.STUCK: passed." },
  { ts: new Date(NOW - 120000).toISOString(), tag: "RUN", text: "Executing recipe PRINT.SPOOLER.STUCK" },
  { ts: new Date(NOW - 180000).toISOString(), tag: "RUN", text: "Dry-run recipe NET.DNS.FAIL" },
  { ts: new Date(NOW - 240000).toISOString(), tag: "RUN", text: `Dry-run recipe ${PRIV}` }
], { now: NOW });
assert.match(did, /Verified: PRINT\.SPOOLER\.STUCK — fix confirmed working/); assert.match(did, /Applied: PRINT\.SPOOLER\.STUCK/); assert.match(did, /Previewed \(nothing changed\): NET\.DNS\.FAIL/);
assert.doesNotMatch(did, /Private pics and Vids/i, "a private path is redacted (the guard replaces the whole value)");
assert.match(did, /home-status">verified</); assert.match(did, /home-status">preview</);
t();

// 4 — What I need from you: approvals (Approve / Deny), queued fixes, pending cards; empty otherwise.
const need = needRowsHtml({
  approvals: { pending: [{ id: "a1", recipeId: "wifi-no-internet-v1", title: "Renew network address", color: "yellow", requestedBy: "detection", createdAt: new Date(NOW - 600000).toISOString(), expiresAt: new Date(NOW + 1200000).toISOString() }] },
  deferred: [{ recipeId: "u1", title: "Restart Windows Update services", queuedAt: new Date(NOW - 1800000).toISOString(), nextWindowStart: new Date(NOW + 3600000).toISOString() }],
  pending: [{ text: "Trial · 9d left", cta: "Upgrade", tab: "about" }]
}, { now: NOW });
assert.match(need, /Say yes to: Renew network address/); assert.match(need, /data-approve="a1">Approve</); assert.match(need, /data-deny="a1">Deny</); assert.match(need, /waits 20 min/);
assert.match(need, /Queued: Restart Windows Update services/); assert.match(need, /runs in your maintenance window/); assert.match(need, /data-deeplink="autonomy"/);
assert.match(need, /Trial · 9d left/); assert.match(need, /data-deeplink="about"/);
assert.match(needRowsHtml({}), /Nothing needs you right now/);
t();

// 5 — the watcher line: the real detector list + a real age, or the honest alternative.
assert.deepEqual([...WATCHER_NAMES], ["disk", "services", "network", "crashes", "performance", "event log"]);
assert.equal(watcherLine({ watchers: { running: true, count: 7, lastTickAgeMs: 12000 } }), "Watching: disk · services · network · crashes · performance · event log — last check 12 s ago");
assert.equal(watcherLine({ processHealthAgeMs: 90000 }), "Watching: disk · services · network · crashes · performance · event log — last check 2 min ago");
assert.equal(watcherLine({}), "Watching: disk · services · network · crashes · performance · event log — last check: not measured yet");
assert.match(watcherLine({ runState: { running: false, label: "stopped", hint: "Press Start ARIA to resume watching." } }), /^Not watching — ARIA is stopped\. Press Start ARIA/);
assert.match(watcherLine({ runState: { id: "paused", running: true, label: "paused", hint: "Watching resumes when the pause ends, or press Start ARIA." } }), /^Watching paused — Watching resumes/);
assert.match(watcherLine({ platformCapabilities: { detect: false, label: "iPhone" } }), /not available on iPhone/);
assert.match(watcherLine({ watchers: { running: false } }), /Watchers are not running/);
assert.equal(agoLabel(500), "just now"); assert.equal(agoLabel(45000), "45 s ago"); assert.equal(agoLabel(3 * 3600000), "3 h ago"); assert.equal(agoLabel(-1), "");
t();

// 6 — what this version can fix: counted from the registry (actions + needsAdmin), the live-fix state named.
const recipes = [
  { id: "a", needsAdmin: true, actions: [{ id: "x", needsAdmin: true }] },
  { id: "b", actions: [{ id: "y" }] },
  { id: "c", actions: [] },
  { id: "d" }
];
assert.deepEqual(fixCapability(recipes, { label: "Windows" }), { total: 4, applicable: 2, needsAdmin: 1, guided: 2, platform: "Windows" });
const line = canFixLine({ recipes, platformCapabilities: { fix: true, label: "Windows" }, liveFixes: { enabled: false } });
assert.equal(line, "On this version ARIA can apply 2 vetted fixes on Windows (1 need administrator approval — Windows asks you first); the other 2 are guided step by step. Live fixes: off — every fix previews only until you turn them on in Settings → Autonomy.");
assert.match(canFixLine({ recipes, platformCapabilities: { fix: true, label: "Windows" }, liveFixes: { enabled: true } }), /Live fixes: on\.$/);
assert.match(canFixLine({ recipes, platformCapabilities: { fix: false, label: "macOS" } }), /^On macOS ARIA detects and guides — it does not apply fixes here\. 4 guides are in this version\./);
assert.match(canFixLine({ recipes: [] }), /can apply 0 vetted fixes on this device; the other 0 are guided/);
t();

// 7 — wiring: the dashboard hosts the lists, the renderer feeds them from state, buttons route to the gated pipeline.
const html = rd("src", "renderer", "index.html");
assert.match(html, /id="homeWatch"/); assert.match(html, /id="homeLists"/); assert.match(html, /id="homeCanFix"/);
assert.ok(html.indexOf('id="homeLists"') < html.indexOf('id="kpiTiles"'), "the lists sit above the KPI tiles");
const renderer = rd("src", "renderer", "renderer.js");
assert.match(renderer, /HomeTab\.homeListsHtml\(\{ detections: next\.detections \|\| \[\], log: next\.transparencyLog \|\| \[\], approvals: next\.approvals \|\| \{\}, deferred: next\.deferredFixes \|\| \[\], pending: lastPendingCards \}\)/, "fed from real state");
assert.match(renderer, /resolveViaSupervisor\(b\.dataset\.homeFix, b\.dataset\.risk \|\| "medium", st\)/, "Fix it → the gated pipeline");
assert.match(renderer, /renderWalkthrough\(\{ recipeId: b\.dataset\.homeWalk, mode: "guide" \}\)/, "Show me → the walk-through");
assert.match(renderer, /HomeTab\.watcherLine\(\{ runState: rs, watchers: next && next\.watchers/, "the watcher line reads state.watchers when main sends it");
assert.match(renderer, /HomeTab\.canFixLine\(\{ recipes: next\.recipes \|\| \[\], platformCapabilities: next\.platformCapabilities, liveFixes: next\.liveFixes \}\)/);
t();

assert.equal(n, 7, "7 home-lists groups");
console.log(`home-lists test passed (${n} groups · empty = honest sentences · found/did/need rows from real state, private paths redacted · watcher line real-or-"not measured yet" · can-fix line from the registry · wired into the Dashboard).`);
