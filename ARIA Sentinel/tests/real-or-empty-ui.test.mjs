// PROD 2026-10-14 (audit R6 / R9) — REAL-OR-EMPTY on every surface a buyer judges by: the hero sub-line, the KPI
// tiles, the SLA block, the compliance rows, the endpoint rows, the report preview, the hotkey table and the
// static markup. Nothing measured → an honest sentence or "--"; never "100%", never "0 threats blocked", never a
// literal "Active" badge, never "203 chunks". And the run state (stopped / paused / killed) is part of the truth.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { heroSubline, heroTiles, computeHeroStatus, computeRunState, railStatusLabel, STATUS } from "../src/shared/dashboard-status.mjs";
import { tilesHtml } from "../src/renderer/tabs/dashboard.mjs";
import { compositeHeadline, complianceLine, breachRowsHtml, slaUnmeasured, SLA_NOT_MEASURED } from "../src/renderer/tabs/sla.mjs";
import { privacyRowsHtml, auditRowsHtml, r11RowsHtml, endpointRowsHtml } from "../src/renderer/tabs/compliance.mjs";
import { previewText } from "../src/renderer/tabs/reports.mjs";

const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
let n = 0; const t = () => { n++; };

// 1 — hero sub-line: no zero-threat brag, "never" reads as "no update check yet", real counts still show.
const empty = heroSubline({ eventsToday: 0, threats: 0, lastSyncAgo: "never" });
assert.equal(empty, "ARIA is watching · no events logged yet · no update check yet");
assert.doesNotMatch(empty, /threats/);
const full = heroSubline({ eventsToday: 42, threats: 3, lastSyncAgo: "5m ago" });
assert.match(full, /42 events scanned/); assert.match(full, /3 threats blocked/); assert.match(full, /last sync 5m ago/);
const stopped = heroSubline({ eventsToday: 2, lastSyncAgo: "1h ago", runState: computeRunState({ ariaStopped: true }) });
assert.match(stopped, /^ARIA is stopped · 2 events scanned/); assert.match(stopped, /Press Start ARIA to resume watching/);
t();

// 2 — tiles: breaches null → "--" (never 0), the rest already real-or-empty.
const tiles = tilesHtml(heroTiles({ breaches: null, uptime7d: null, hoursSaved: null }));
assert.match(tiles, /data-kpi="breaches"[^]*?<div class="kpi-value">--<\/div>/, "breaches tile is -- until measured");
assert.doesNotMatch(tiles, /100%/);
assert.match(tilesHtml(heroTiles({ breaches: 0 })), /data-kpi="breaches"[^]*?<div class="kpi-value">0<\/div>/, "a measured 0 still renders 0");
t();

// 3 — run state: stopped / killed / paused / self-repair / watching → the rail chip + the hero word.
assert.equal(railStatusLabel("manual", computeRunState({})), "Manual mode - watching");
assert.equal(railStatusLabel("confirmed", computeRunState({ ariaStopped: true })), "Confirmed mode - stopped");
assert.equal(railStatusLabel("manual", computeRunState({ killedLocal: true })), "Manual mode - stopped by kill switch");
assert.equal(railStatusLabel("manual", computeRunState({ paused: true })), "Manual mode - paused");
assert.equal(railStatusLabel("manual", computeRunState({ bridgeConflict: true })), "Manual mode - self repair");
assert.equal(computeRunState({ killed: true }).label, "fixes stopped", "a control-plane kill halts fixes, watching continues");
assert.equal(computeHeroStatus({ running: false }).label, "STOPPED"); assert.equal(computeHeroStatus({ paused: true }).label, "PAUSED");
assert.equal(computeHeroStatus({ auditOk: false, running: false }).label, "ACTION REQUIRED", "a security failure outranks stopped");
assert.equal(computeHeroStatus({}).label, "PROTECTED"); assert.equal(STATUS.stopped.level, "stopped");
t();

// 4 — SLA: measured:false → "SLA not measured yet" + an honest note; credits never "$0 (0%)" before a measurement.
assert.equal(slaUnmeasured({ composite: null }, { measured: false }), true); assert.equal(slaUnmeasured({ composite: 97 }, { measured: true }), false);
assert.equal(compositeHeadline({ composite: null }, { measured: false }), SLA_NOT_MEASURED);
assert.match(complianceLine({}, { measured: false }), /nothing to score/);
assert.equal(compositeHeadline({ composite: 97 }, { measured: true }), "97% SLA-met this month");
assert.match(complianceLine({ composite: 97, floor: 95, met: true }, { measured: true }), /97% SLA-met for current month \(floor 95%, MET\)/);
const noCredits = breachRowsHtml([], {});
assert.match(noCredits, /no breaches recorded yet/); assert.match(noCredits, /not measured yet/); assert.doesNotMatch(noCredits, /\$0 \(0%\)/);
assert.match(breachRowsHtml([], { owed: 0, pctOwed: 0 }), /0 breaches/);
t();

// 5 — compliance + endpoints + reports: nulls say "not run / not measured / not available", never a verdict.
const priv = privacyRowsHtml({ pass: null, allowlistOk: true, sanitization: null });
assert.match(priv, /not run yet/); assert.doesNotMatch(priv, /REVIEW|PASS/); assert.doesNotMatch(priv, /100%/); assert.match(priv, /not measured yet/);
assert.match(privacyRowsHtml({ pass: true, sanitization: 100, ts: "t" }), /PASS[^]*?100%/);
assert.match(auditRowsHtml({}), /not verified yet/); assert.match(auditRowsHtml({ ok: true }), /verified/);
const r11 = r11RowsHtml({ attempts: 0, ok: true }, { count: 2, configured: ["x"] });
assert.match(r11, /excluded folders: 2/); assert.doesNotMatch(r11, /Private pics/i); assert.match(r11, /always 0/);
assert.match(r11RowsHtml({ attempts: 0 }, null), /your excluded folders/);
const eps = endpointRowsHtml([{ id: "recipes", ok: true, status: 200 }, { id: "kb-bundle", ok: null, note: "not available in this version" }, { id: "x", ok: false, error: "no response" }]);
assert.match(eps, /endpoint-ok[^]*?reachable/); assert.match(eps, /endpoint-na[^]*?not available in this version/); assert.match(eps, /endpoint-fail[^]*?unreachable/);
assert.match(endpointRowsHtml([]), /not checked yet/);
const prev = previewText({ kpis: {}, sla: { measured: false } });
assert.match(prev, /Issues detected: --/); assert.match(prev, /Diagnoses run: --/); assert.match(prev, /Fixes verified: --/); assert.match(prev, /SLA: not measured yet/);
assert.match(prev, /Audit integrity: not verified yet · privacy verifier not run yet · excluded folders: not verified yet\./);
assert.doesNotMatch(prev, /Incidents resolved/);
const prev2 = previewText({ kpis: { incidents: 4, diagnoses: 6, verifiedFixes: 2, autoPct: 50 }, sla: { measured: true, composite: 97, floor: 95 }, evidence: { audit: { ok: true }, privacy: { pass: true }, excludedFolders: { attempts: 0, ok: true } } });
assert.match(prev2, /Issues detected: 4 · Diagnoses run: 6 · Fixes verified: 2 \(50% automatic\)/); assert.match(prev2, /SLA compliance: 97% \(floor 95%\)/); assert.match(prev2, /Audit integrity verified · privacy verifier PASS · excluded folders never touched\./);
t();

// 6 — static markup: no literal "100% sanitization", "203 chunks", "0 threats", static Active badges; SLA block feature-gated.
const html = rd("src", "renderer", "index.html");
assert.doesNotMatch(html, /100% sanitization|203 chunks|threats blocked|Auto-updates included|1% idle|24\/7/);
assert.doesNotMatch(html, /<em class="active-badge">Active<\/em><\/div>/, "no static hotkey rows with a literal Active badge");
assert.match(html, /id="hotkeyStatus"/, "hotkeys render from state");
assert.match(html, /id="dataUploadCount">—</, "the upload-paths stat is computed, not a literal 0");
assert.match(html, /id="trustStrip" class="trust-strip">🔒 Local processing · checking/, "the trust strip claims nothing before the dashboard call");
assert.match(html, /<div class="merge-head" id="sla" data-feature="slaTracking">/, "SLA language only when the plan tracks an SLA");
assert.match(html, /id="slaComposite">SLA not measured yet</);
const renderer = rd("src", "renderer", "renderer.js");
assert.match(renderer, /SlaTab\.compositeHeadline\(s\.compliance \|\| \{\}, s\)/, "the renderer passes measured:false through");
assert.match(renderer, /badge\(h\)/, "hotkey rows carry their live status badge");
assert.match(html, /id="ariaChatChunks"[^>]*>KB size: —</, "the chunk count is empty until a real KB answer");
assert.match(renderer, /KB size: \$\{Number\(meta\.total_chunks\)\} passages/, "…and a real count only after a real answer");
t();

assert.equal(n, 6, "6 real-or-empty-ui groups");
console.log(`real-or-empty-ui test passed (${n} groups · hero sub-line · tiles · run state → rail + hero · SLA measured:false · compliance/endpoint/report nulls · static markup free of literals).`);
