// G-METRICS measurement harness — runs REAL support questions through the SHIPPED local-KB engine and
// records what actually happened (KB hit/miss + measured latency) into the proof-metrics store. This is
// honest measurement, not seeding: the questions are real phrasings, and every recorded number is the
// engine's real behavior over the real aria-kb-pack. 🔒 HARD RULE 14 — nothing is fabricated. Re-runnable.
//
// Usage:  node tools/measure-kb-selftest.mjs
import fs from "node:fs";
import path from "node:path";
import { loadKbPack, matchKb } from "../src/shared/aria-local-kb.mjs";
import { recordEvent, loadStore, writeStore, aggregate, emitPublicJson, metricsPath, publicMetricsPath } from "../src/shared/proof-metrics.mjs";

const root = path.resolve(import.meta.dirname, "..");
const index = loadKbPack(path.join(root, "aria-kb-pack"), fs);

// A REPRESENTATIVE, LABELLED mix of real IT-support questions. `expect` is a regex of the doc id(s) that
// would be a CORRECT match; `null` = genuinely out-of-scope (any match is a false positive). We do NOT
// cherry-pick to inflate — auto-resolved is counted ONLY when the engine matches the RIGHT topic, so a
// misroute or an out-of-scope graze is honestly counted as an escalation.
const QUESTIONS = [
  // ── In-scope diagnostics (platform-agnostic; expect the CORRECT topic doc) ──
  { q: "my printer won't print anything", platform: "win32", expect: /printer/ },
  { q: "the printer is offline and won't connect", platform: "win32", expect: /printer/ },
  { q: "the computer is really slow today", platform: "win32", expect: /slow-performance/ },
  { q: "everything is lagging and takes forever to open", platform: "win32", expect: /slow-performance/ },
  { q: "no internet connection on my laptop", platform: "win32", expect: /no-internet/ },
  { q: "my wifi keeps dropping out every few minutes", platform: "win32", expect: /bluetooth-wifi|no-internet/ },
  { q: "bluetooth headphones keep disconnecting", platform: "win32", expect: /bluetooth-wifi/ },
  { q: "audio not working there is no sound", platform: "win32", expect: /audio-issues/ },
  { q: "external monitor is not being detected", platform: "win32", expect: /display-issues/ },
  { q: "my screen keeps flickering", platform: "win32", expect: /display-issues/ },
  { q: "the laptop battery drains way too fast", platform: "win32", expect: /battery-power/ },
  { q: "my computer won't boot up at all", platform: "win32", expect: /boot-issues/ },
  { q: "blue screen of death on startup", platform: "win32", expect: /system-crashes/ },
  { q: "the system keeps crashing randomly", platform: "win32", expect: /system-crashes/ },
  { q: "an app crashes immediately when I open it", platform: "win32", expect: /app-crashes/ },
  { q: "usb drive is not showing up", platform: "win32", expect: /usb-peripheral/ },
  { q: "my mouse and keyboard stopped working", platform: "win32", expect: /usb-peripheral/ },
  { q: "file explorer keeps freezing and crashing", platform: "win32", expect: /file-explorer/ },
  { q: "outlook keeps asking for my password", platform: "win32", expect: /email-issues|credential/ },
  { q: "i cannot send or receive any emails", platform: "win32", expect: /email-issues/ },
  { q: "i am locked out of my account", platform: "win32", expect: /credential/ },
  { q: "how do i activate my office license", platform: "win32", expect: /license-activation/ },
  { q: "antivirus is blocking my application", platform: "win32", expect: /antivirus-conflict/ },
  { q: "windows update is stuck at 0 percent", platform: "win32", expect: /update-stuck|windows-1/ },
  { q: "windows won't finish installing updates", platform: "win32", expect: /update-stuck|windows-1/ },
  // ── In-scope platform blueprints (device named → that platform) ──
  { q: "my macbook won't boot past the apple logo", platform: "darwin", expect: /macos|boot-issues/ },
  { q: "macbook won't wake from sleep", platform: "darwin", expect: /macos/ },
  { q: "imac is running very slow after the update", platform: "darwin", expect: /macos|slow-performance/ },
  { q: "iphone won't charge", platform: "ios", expect: /ios|battery/ },
  { q: "iphone wifi keeps dropping", platform: "ios", expect: /ios|bluetooth-wifi|no-internet/ },
  { q: "ipad apps keep closing on their own", platform: "ipados", expect: /ipados|app-crashes/ },
  { q: "android phone storage is full", platform: "android", expect: /android/ },
  { q: "my chromebook won't turn on", platform: "chromeos", expect: /chromeos|boot/ },
  { q: "ubuntu laptop won't boot", platform: "linux", expect: /linux|boot/ },
  // ── Deliberately OUT-OF-SCOPE — the local KB does NOT cover these; a correct system ESCALATES them ──
  { q: "configure a cisco asa firewall vpn tunnel", platform: "win32", expect: null },
  { q: "reset my sap gui transaction buffer", platform: "win32", expect: null },
  { q: "what is the weather tomorrow", platform: "win32", expect: null },
  { q: "set up a kubernetes ingress controller", platform: "linux", expect: null },
  { q: "my warehouse forklift won't start", platform: "win32", expect: null },
  { q: "how do i process payroll in adp", platform: "win32", expect: null },
  { q: "create a salesforce permission set", platform: "win32", expect: null },
  { q: "oracle database tablespace is full", platform: "win32", expect: null },
  { q: "write a python script to scrape a website", platform: "win32", expect: null },
  { q: "book me a flight to new york", platform: "win32", expect: null },
  { q: "my car engine won't start", platform: "win32", expect: null }
];

// Re-measurement: drop prior self-test rows so reruns don't double-count, but PRESERVE any real app
// usage (chat / local-kb / fix events). Then record this run's measured outcomes.
const base = loadStore();
base.events = base.events.filter((e) => e.source !== "self-test");
writeStore(base);

// auto-resolved = the engine confidently matched the CORRECT topic (score ≥ CONF AND doc id matches the
// label). Anything else (weak match, misroute, out-of-scope graze, no match) honestly escalates.
const CONF = 0.30;
const misroutes = [];
let hits = 0;
for (const { q, platform, expect } of QUESTIONS) {
  const t0 = Date.now();
  const hit = matchKb(index, q, { platform }); // REAL engine, REAL pack → { doc, score } or null
  const resolveMs = Date.now() - t0;
  const confident = Boolean(hit && hit.score >= CONF);
  const correct = confident && Boolean(expect) && expect.test(hit.doc.id);
  if (correct) hits++;
  else if (confident && !correct) misroutes.push(`${q} → ${hit.doc.id} (${hit.score.toFixed(2)})`);
  recordEvent({ source: "self-test", matchedKb: correct, resolved: correct, escalated: !correct, resolveMs });
}

const agg = aggregate(loadStore());
emitPublicJson();
console.log(`Measured ${QUESTIONS.length} real questions over ${index.length} KB docs → ${hits} correct local resolutions.`);
if (misroutes.length) {
  console.log(`Honest misroutes/escalations (matched the wrong topic or out-of-scope): ${misroutes.length}`);
  for (const m of misroutes) console.log("  • " + m);
}
console.log("Store:   " + metricsPath());
console.log("Public:  " + publicMetricsPath());
console.log(JSON.stringify(agg, null, 2));
