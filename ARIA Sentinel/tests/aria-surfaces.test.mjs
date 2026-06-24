// RUN 33 Phase 2 — ARIA tab data parsers: system-status (3-tier chain + locked banner), kb-stats (learning),
// sessions (Memory, R11-scrubbed — HARD STOP if a path/off-limits ref leaks), and agent heartbeats (stalled>1h).
import assert from "node:assert/strict";
import { parseSystemStatus, parseKbStats, kbStatsUnread, parseSessions, parseHeartbeats, ANTHROPIC_BANNER } from "../src/shared/aria-surfaces.mjs";

let n = 0; const t = () => { n++; };

// 1 — system status: overall normalized; ALWAYS the 3 fall-through tiers; API status filled in.
let s = parseSystemStatus({ overall: "GREEN", last_probe: "2026-06-23T12:00:00Z", tiers: [{ name: "kb", status: "green" }, { name: "anthropic", status: "yellow" }] });
assert.equal(s.overall, "green");
assert.equal(s.tiers.length, 3, "KB-first · Anthropic · Local KB");
assert.deepEqual(s.tiers.map((x) => x.name), ["KB-first", "Anthropic", "Local KB"]);
assert.equal(s.tiers[1].status, "yellow", "Anthropic tier status from API");
assert.equal(s.tiers[0].cost, "$0");
assert.equal(parseSystemStatus(null).overall, "unknown", "missing → unknown, never throws");
assert.equal(parseSystemStatus(null).tiers.length, 3, "tiers always present");
t();

// 2 — the locked Anthropic-preserved banner constant exists and names the chain.
assert.match(ANTHROPIC_BANNER, /last-resort safety net/i);
assert.match(ANTHROPIC_BANNER, /knowledge base first/i);
assert.match(ANTHROPIC_BANNER, /locked/i);
t();

// 3 — kb-stats: counts, recent learnings, tier + category breakdown; defensive on missing.
const kb = parseKbStats({ total_chunks: 203, kb_generated_at: "2026-06-23T09:00:00Z",
  recent_learnings: [{ slug: "fix-dns", title: "Fix DNS", tier: "L1", added_at: "2026-06-23T08:00:00Z" }],
  by_tier: { l1: 120, l2: 60, l3: 23 }, top_categories: [{ name: "networking", count: 40 }, { name: "email", count: 30 }] });
assert.equal(kb.totalChunks, 203);
assert.equal(kb.recent[0].title, "Fix DNS");
assert.equal(kb.recent[0].tier, "l1");
assert.deepEqual(kb.byTier, { l1: 120, l2: 60, l3: 23 });
assert.equal(kb.topCategories[0].name, "networking");
assert.equal(parseKbStats(null).totalChunks, null);
t();

// 4 — unread dot: KB generated AFTER last-seen → unread; never-seen → unread; older → read.
assert.equal(kbStatsUnread("2026-06-23T10:00:00Z", "2026-06-23T09:00:00Z"), true);
assert.equal(kbStatsUnread("2026-06-23T10:00:00Z", null), true, "never seen → unread");
assert.equal(kbStatsUnread("2026-06-23T08:00:00Z", "2026-06-23T09:00:00Z"), false);
assert.equal(kbStatsUnread(null, "x"), false, "no timestamp → not unread");
t();

// 5 — 🔒 R11: Memory parser scrubs paths + DROPS any turn referencing the off-limits folder.
const sessions = [{
  id: "sess-1", started_at: "2026-06-23T10:00:00Z",
  turns: [
    { role: "user", content: "ok", text: "my file at C:\\Users\\bob\\notes.txt won't open" },
    { role: "assistant", text: "see C:\\Users\\bob\\Private pics and Vids\\x for the photo" },  // off-limits → dropped
    { role: "user", text: "thanks" }
  ]
}];
const mem = parseSessions(sessions, { now: Date.parse("2026-06-23T12:00:00Z") });
assert.equal(mem.list.length, 1);
const blob = JSON.stringify(mem);
assert.doesNotMatch(blob, /private\s+pics\s+and\s+vids/i, "off-limits folder never rendered");
assert.doesNotMatch(blob, /C:\\Users\\bob/, "raw user paths scrubbed");
assert.match(blob, /\[path\]/, "paths replaced with placeholder");
assert.equal(mem.list[0].turns.length, 2, "the off-limits turn was dropped (3 → 2)");
assert.equal(mem.stats.total, 1);
assert.ok(mem.stats.totalAsks >= 1);
t();

// 6 — heartbeats: stalled when no beat in >1h; running otherwise; sorted stalled-first.
const NOW = Date.parse("2026-06-23T12:00:00Z");
const beats = [
  { name: "Hermes", ts: NOW - 5 * 60000, status: "running", last_task: "drained queue" },
  { name: "Cleaning", ts: NOW - 2 * 60 * 60000, last_task: "swept C:\\Users\\bob\\tmp" }, // 2h → stalled
  { name: "Backup", status: "idle", ts: NOW - 10 * 60000 }
];
const fleet = parseHeartbeats(beats, { now: NOW });
const byName = Object.fromEntries(fleet.map((b) => [b.name, b]));
assert.equal(byName.Hermes.status, "running");
assert.equal(byName.Cleaning.status, "stalled", ">1h → stalled");
assert.equal(byName.Backup.status, "idle");
assert.doesNotMatch(JSON.stringify(fleet), /C:\\Users\\bob/, "agent task paths scrubbed");
assert.equal(fleet[0].status, "stalled", "stalled agents sort first");
t();

// 7 — wiring: main.mjs IPC fetches/reads + parses; preload exposes the bridge; renderer loads on the ARIA tab;
//     the Health HTML banner copy matches the LOCKED constant.
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const main = rd("src", "main", "main.mjs");
for (const ch of ["aria:status", "aria:learning", "aria:memory", "aria:agents"]) {
  assert.match(main, new RegExp(`ipcMain\\.handle\\("${ch}"`), `IPC handler ${ch}`);
}
assert.match(main, /aria-system-status/, "fetches system-status");
assert.match(main, /aria-kb-stats/, "fetches kb-stats");
assert.match(main, /parseSessions\(sessions\)/, "memory goes through the R11-scrubbing parser");
const preload = rd("src", "main", "preload.cjs");
for (const m of ["ariaStatus", "ariaLearning", "ariaMemory", "ariaAgents"]) assert.match(preload, new RegExp(m + ":"), `preload bridge ${m}`);
const rjs = rd("src", "renderer", "renderer.js");
assert.match(rjs, /if \(target === "aria"\) loadAriaData\(\)/, "ARIA tab triggers loadAriaData");
assert.match(rjs, /function loadAriaData\(\)/, "loadAriaData defined");
// the Health banner in index.html must equal the locked constant (hard stop if drifted/removed).
assert.ok(rd("src", "renderer", "index.html").includes(ANTHROPIC_BANNER), "Health banner copy matches the LOCKED constant");
t();

assert.equal(n, 7, "7 aria-surfaces test groups");
console.log(`aria-surfaces test passed (${n} groups · 3-tier status + locked banner · kb-stats · unread dot · Memory R11 scrub+drop · heartbeat stalled>1h).`);
