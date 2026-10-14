#!/usr/bin/env node
// ARIA Sentinel — the REAL-Windows fault-lab RUN (operator tool for a TEST machine; never shipped in the customer build).
//
//   snapshot → inject → wait for Sentinel (Autonomous mode, "Tell me first" = 1 minute) → verify → restore → verify
//   → a dated verdict: dist\FAULT-LAB-<YYYY-MM-DD>.json
//
// It drives scripts\fault-lab.ps1 (the only thing that touches the machine — reversible L1/L2 faults, UAC when a service
// is stopped or started) and WATCHES Sentinel through the local bridge's public, content-blind GET /state
// (127.0.0.1 only: notice numbers, statuses, outcome words and the ADVISORY / AUTO-FIX / ESCALATE audit-row counts —
// never a title, a log line or a path). Nothing leaves this computer. See docs\FAULT-LAB.md for the operator steps.
//
//   node scripts/fault-lab-run.mjs [--faults all|id,id] [--minutes 10] [--poll 5] [--port 37841] [--dry-run]
//
// Exit: 0 every fault behaved as expected and nothing outside the intended keys changed · 1 a verdict failed ·
//       2 not runnable here (not Windows, Sentinel not reachable / not in Autonomous with live fixes, bad arguments).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PS1 = path.join(APP_ROOT, "scripts", "fault-lab.ps1");
export const DEFAULT_PORT = 37841;
export const ADVISORY_NOTICES = 3;

// The faults this lab injects for REAL — the same ids, recipes and levels as fault-lab.ps1, and as the simulated catalogue
// where the fault is the same (wu-stopped is real-only: the simulated wu-stuck is a hung update, not reversibly producible).
// All four services' fixes need administrator rights, so under the rule they are advised 3 times and then handed to the
// IT contact — never run unattended. temp-bloat writes ~200 MB, far from the 5%-free threshold on a normal disk.
export const REAL_FAULTS = Object.freeze({
  "spooler-stuck": { level: "L1", recipe: "svc-spooler-stopped-v1", service: "Spooler", needsAdmin: true },
  "audio-stopped": { level: "L1", recipe: "svc-audiosrv-stopped-v1", service: "Audiosrv", needsAdmin: true },
  "wu-stopped": { level: "L2", recipe: "svc-wuauserv-stopped-v1", service: "wuauserv", needsAdmin: true },
  "bits-stopped": { level: "L2", recipe: "svc-bits-stopped-v1", service: "BITS", needsAdmin: true },
  "temp-bloat": { level: "L1", recipe: "disk-low-space-v1", service: "", needsAdmin: true }
});
// Refused here (the ps1 refuses them too): they would change the network, DNS, the clock, an app, a startup type — or
// they are L3. tests/lib/fault-lab.mjs covers every one of them on a simulated machine.
export const SIMULATED_ONLY = Object.freeze(["stale-dns", "time-drift", "teams-stuck", "wu-stuck", "wlan-stopped", "dnscache-stopped", "dhcp-lease-stale", "spooler-disabled", "system-files-corrupt", "bitlocker-recovery", "winsock-corrupt", "print-driver-crash"]);
const TERMINAL = new Set(["fixed", "fix-failed", "held", "escalated", "acknowledged", "never", "blocked", "cancelled", "closed"]);

export function parseArgs(argv = []) {
  const out = { faults: "all", minutes: 10, poll: 5, port: DEFAULT_PORT, dryRun: false, errors: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => argv[++i];
    if (a === "--faults") out.faults = String(val() || "");
    else if (a === "--minutes") out.minutes = Number(val());
    else if (a === "--poll") out.poll = Number(val());
    else if (a === "--port") out.port = Number(val());
    else if (a === "--dry-run") out.dryRun = true;
    else out.errors.push(`unknown argument ${a}`);
  }
  if (!Number.isFinite(out.minutes) || out.minutes < 4 || out.minutes > 120) out.errors.push("--minutes must be 4–120 (three notices one minute apart, then the last step, need about 5)");
  if (!Number.isFinite(out.poll) || out.poll < 2 || out.poll > 60) out.errors.push("--poll must be 2–60 seconds");
  if (!Number.isInteger(out.port) || out.port < 1024 || out.port > 65535) out.errors.push("--port must be a port number");
  const ids = out.faults === "all" ? Object.keys(REAL_FAULTS) : out.faults.split(",").map((s) => s.trim()).filter(Boolean);
  for (const id of ids) {
    if (SIMULATED_ONLY.includes(id)) out.errors.push(`'${id}' is simulated only — tests/lib/fault-lab.mjs covers it; this lab injects only ${Object.keys(REAL_FAULTS).join(", ")}`);
    else if (!REAL_FAULTS[id]) out.errors.push(`unknown fault '${id}'`);
  }
  out.ids = ids;
  return out;
}

/**
 * What SHOULD happen for one injected fault, from the fault and the service's state before injection (fault-lab.ps1's
 * record). Mirrors the app's real rules: the service watcher only reports an Automatic service that went Running → Stopped
 * (a Manual / trigger-start one is "idle-normal"), and a needs-admin fix is never run unattended — 3 notices, then the
 * IT contact. No real fault here may ever produce an AUTO-FIX row.
 */
export function expectationFor(id, entry = {}) {
  const f = REAL_FAULTS[id];
  if (!f) return { id, detect: false, why: "unknown fault" };
  if (!entry.injected) return { id, recipe: f.recipe, detect: false, track: null, why: entry.note || "not injected" };
  if (f.service) {
    const startType = String((entry.before && entry.before.StartType) || "");
    if (startType !== "Automatic") return { id, recipe: f.recipe, detect: false, track: null, why: `${f.service} starts ${startType || "on demand"} — stopped is its normal idle state, so the watcher stays quiet` };
    return { id, recipe: f.recipe, detect: true, track: "tech-contact", terminal: "escalated", notices: ADVISORY_NOTICES, autoFix: false, why: "needs administrator rights: 3 notices, then the IT contact is told (never run unattended)" };
  }
  return { id, recipe: f.recipe, detect: "only-if-disk-under-5-percent", track: "tech-contact", terminal: "escalated", notices: ADVISORY_NOTICES, autoFix: false, why: "200 MB is far from the 5%-free threshold on a normal disk; if the disk IS that full, the clean-up needs administrator rights → IT contact" };
}

/** Fold one GET /state (the content-blind public slice) into the per-recipe observation. */
export function observe(obs, pub, recipes, elapsedS) {
  const next = { ...obs, polls: (obs.polls || 0) + 1, byRecipe: { ...(obs.byRecipe || {}) } };
  const adv = (pub && pub.advisory) || { active: [], outcomes: [], auditTags: {} };
  next.auditTags = adv.auditTags || {};
  for (const rid of recipes) {
    const cur = { ...(next.byRecipe[rid] || { maxNotice: 0, statuses: [], firstSeenS: null, terminal: null, outcome: null, track: null }) };
    const live = (adv.active || []).find((a) => a && a.recipeId === rid);
    const done = (adv.outcomes || []).find((o) => o && o.recipeId === rid && !(obs.outcomeIdsBefore || []).includes(o.id));
    if (live) {
      if (cur.firstSeenS == null) cur.firstSeenS = elapsedS;
      cur.maxNotice = Math.max(cur.maxNotice, Number(live.advisory) || 0);
      cur.track = live.track || cur.track;
      if (cur.statuses[cur.statuses.length - 1] !== live.status) cur.statuses = [...cur.statuses, live.status];
    }
    if (done && !cur.terminal) {
      if (cur.firstSeenS == null) cur.firstSeenS = elapsedS;
      cur.terminal = done.status; cur.outcome = done.outcome; cur.track = done.track || cur.track;
      cur.maxNotice = Math.max(cur.maxNotice, Number(done.advisories) || 0);
      cur.terminalS = elapsedS;
    }
    next.byRecipe[rid] = cur;
  }
  return next;
}

/** Is every expectation settled (so the wait can stop early)? */
export function settled(expectations, obs) {
  return expectations.every((e) => (e.detect === true ? Boolean(obs.byRecipe && obs.byRecipe[e.recipe] && obs.byRecipe[e.recipe].terminal) : true));
}

/** The verdict: per fault, expected vs observed; plus the AUTO-FIX safety check and the two verifies. */
export function verdictOf({ expectations, obs, tagsBefore = {}, verifyLive = null, verifyAfterRestore = null }) {
  const tags = obs.auditTags || {};
  const autoFixDelta = Math.max(0, (Number(tags.autoFix) || 0) - (Number(tagsBefore.autoFix) || 0));
  const faults = expectations.map((e) => {
    const o = (obs.byRecipe && obs.byRecipe[e.recipe]) || { maxNotice: 0, statuses: [], terminal: null };
    let ok, reason;
    if (e.detect === true) {
      ok = o.terminal === e.terminal && o.maxNotice === e.notices && o.track === e.track;
      reason = ok ? `${e.notices} notices, then ${e.terminal} (as expected)` : `expected ${e.notices} notices then ${e.terminal} on the ${e.track} track; saw ${o.maxNotice} notice(s), track ${o.track || "none"}, end ${o.terminal || "none yet"}`;
    } else if (e.detect === false) {
      ok = o.maxNotice === 0 && !o.terminal;
      reason = ok ? `no notice (as expected: ${e.why})` : `expected no notice (${e.why}) but saw ${o.maxNotice} notice(s)`;
    } else {
      ok = o.maxNotice === 0 || (o.terminal === "escalated" && o.maxNotice === ADVISORY_NOTICES);
      reason = o.maxNotice === 0 ? "no notice (the disk is not under 5% free)" : ok ? "the disk WAS under 5% free: 3 notices, then the IT contact (as expected)" : `unexpected: ${o.maxNotice} notice(s), end ${o.terminal || "none"}`;
    }
    return { id: e.id, recipe: e.recipe, expected: e.why, observed: { notices: o.maxNotice, track: o.track || null, statuses: o.statuses, end: o.terminal || null, outcome: o.outcome || null, firstSeenS: o.firstSeenS ?? null, endS: o.terminalS ?? null }, ok, reason };
  });
  const checks = [
    { id: "no-auto-fix-for-admin-fixes", ok: autoFixDelta === 0, detail: `AUTO-FIX audit rows during the run: ${autoFixDelta} (every real fault here needs administrator rights, so none may run unattended)` },
    { id: "verify-while-live", ok: Boolean(verifyLive && verifyLive.ok), detail: verifyLive ? `${(verifyLive.changedUnintended || []).length} unintended change(s) while the faults were live` : "verify did not run" },
    { id: "verify-after-restore", ok: Boolean(verifyAfterRestore && verifyAfterRestore.ok), detail: verifyAfterRestore ? `${(verifyAfterRestore.changedUnintended || []).length} key(s) still differ from the baseline after restore` : "verify did not run" }
  ];
  return { pass: faults.every((f) => f.ok) && checks.every((c) => c.ok), faults, checks, auditTagDeltas: { advisory: (Number(tags.advisory) || 0) - (Number(tagsBefore.advisory) || 0), autoFix: autoFixDelta, escalate: (Number(tags.escalate) || 0) - (Number(tagsBefore.escalate) || 0) } };
}

/** Changed keys for the verdict file: values only where they are not network / default-app details (content-blind). */
export function publicChanges(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((r) => (/^(services|temp|printers|disk)\./.test(String(r.key)) ? { key: r.key, before: r.before, after: r.after } : { key: r.key, changed: true }));
}

export function verdictFileName(dir, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  let file = path.join(dir, `FAULT-LAB-${day}.json`);
  for (let i = 2; fs.existsSync(file); i++) file = path.join(dir, `FAULT-LAB-${day}-${i}.json`);
  return file;
}

export const OPERATOR_STEPS = Object.freeze([
  "Use a TEST Windows 10/11 machine (never a customer's), signed in as the person who uses it; keep an administrator account at hand for the UAC prompts.",
  "Start the ARIA Sentinel build under test and leave it running (the globe visible).",
  "Settings → Mode: choose Autonomous.",
  "Settings → Autonomy & contacts → Live fixes: ON. Autonomy level: Full-auto (tick “I understand”).",
  "Tech contacts: add one line (name, email, phone, admin) → Save.",
  "“Tell me first”: Minutes between notices = 1 → Save. (The sentence above the field must read “3 times, 1 minute apart”.)",
  "Open PowerShell (not as administrator) in the ARIA Sentinel folder and run: node scripts/fault-lab-run.mjs --faults all --minutes 10",
  "Approve the UAC prompt when the faults are injected, and again when they are restored.",
  "Do NOT answer the notices — the run measures the no-answer path (3 notices, then the IT contact for these admin fixes).",
  "Read the verdict file dist\\FAULT-LAB-<date>.json (and %TEMP%\\aria-fault-lab-state\\fault-lab.log)."
]);

async function getState(port) {
  const res = await fetch(`http://127.0.0.1:${port}/state`, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`bridge answered ${res.status}`);
  return res.json();
}
function runPs(args, stateDir) {
  const r = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", PS1, ...args, "-StateDir", stateDir], { encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  return { code: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, "")); } catch { return null; } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.errors.length) { for (const e of args.errors) console.error(`fault-lab-run: ${e}`); return 2; }
  const plan = { faults: args.ids.map((id) => ({ id, ...REAL_FAULTS[id] })), minutes: args.minutes, poll: args.poll, port: args.port };
  if (args.dryRun) {
    console.log("fault-lab-run — DRY RUN (nothing is touched). The plan:");
    console.log(JSON.stringify(plan, null, 2));
    console.log("\nOperator steps:\n" + OPERATOR_STEPS.map((s, i) => `  ${i + 1}. ${s}`).join("\n"));
    return 0;
  }
  if (process.platform !== "win32") { console.error("fault-lab-run: this runs on a Windows test machine only (use --dry-run to see the plan; the simulated lab is tests/lib/fault-lab.mjs)."); return 2; }
  const stateDir = path.join(process.env.TEMP || process.env.TMP || APP_ROOT, "aria-fault-lab-state");
  const log = (s) => console.log(`[fault-lab-run ${new Date().toISOString()}] ${s}`);

  // 1 — Sentinel must be running, in Autonomous mode, with live fixes on, and have the advise-first rule (the bridge slice).
  let pub;
  try { pub = await getState(args.port); } catch (e) { console.error(`fault-lab-run: Sentinel's local bridge is not reachable on 127.0.0.1:${args.port} (${e.message}). Start the app first.`); return 2; }
  const problems = [];
  if (pub.mode !== "autonomous") problems.push(`mode is ${pub.mode} (needs Autonomous)`);
  if (!pub.systemFixesEnabled) problems.push("live fixes are off");
  if (pub.killed) problems.push("ARIA is stopped by the kill switch");
  if (pub.paused) problems.push("ARIA is paused");
  if (!pub.advisory) problems.push("this build has no advise-first rule (no advisory slice in /state)");
  if (problems.length) { console.error(`fault-lab-run: not ready — ${problems.join("; ")}.\n\nOperator steps:\n${OPERATOR_STEPS.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}`); return 2; }
  const tagsBefore = { ...(pub.advisory.auditTags || {}) };
  const outcomeIdsBefore = (pub.advisory.outcomes || []).map((o) => o.id);

  // 2 — baseline, 3 — inject (UAC).
  log("snapshot (baseline)");
  const snap = runPs(["-Snapshot", "-Json"], stateDir);
  if (snap.code !== 0) { console.error(snap.stderr || snap.stdout); return 2; }
  log(`inject ${args.ids.join(", ")} — approve the UAC prompt`);
  const inj = runPs(["-Inject", args.ids.join(",")], stateDir);
  const record = readJson(path.join(stateDir, "injected.json"));
  if (inj.code !== 0 || !record) { console.error(`fault-lab-run: injection did not complete (exit ${inj.code}). ${inj.stderr}`); runPs(["-Restore"], stateDir); return 2; }
  const entries = new Map((record.faults || []).map((f) => [f.id, f]));
  const expectations = args.ids.map((id) => expectationFor(id, entries.get(id) || {}));
  for (const e of expectations) log(`expect ${e.id}: ${e.why}`);

  // 4 — wait for Sentinel.
  const recipes = [...new Set(expectations.map((e) => e.recipe))];
  let obs = { outcomeIdsBefore, byRecipe: {}, auditTags: tagsBefore };
  const t0 = Date.now();
  while (Date.now() - t0 < args.minutes * 60000) {
    await sleep(args.poll * 1000);
    try { obs = observe(obs, await getState(args.port), recipes, Math.round((Date.now() - t0) / 1000)); } catch (e) { log(`poll failed: ${e.message}`); continue; }
    for (const rid of recipes) { const o = obs.byRecipe[rid]; if (o && o.maxNotice) log(`${rid}: notice ${o.maxNotice}/${ADVISORY_NOTICES}${o.terminal ? ` → ${o.terminal} (${o.outcome || ""})` : ""}`); }
    if (settled(expectations, obs) && Date.now() - t0 > 4 * 60000) break; // quiet faults: give the watchers 4 minutes
  }

  // 5 — verify while live, 6 — restore (UAC), 7 — verify after restore.
  log("verify (faults live)");
  runPs(["-Verify", "-Json"], stateDir);
  const verifyLive = readJson(path.join(stateDir, "verify-last.json"));
  log("restore — approve the UAC prompt");
  const rest = runPs(["-Restore"], stateDir);
  log(`restore exit ${rest.code}`);
  await sleep(5000);
  runPs(["-Verify", "-Json"], stateDir);
  const verifyAfter = readJson(path.join(stateDir, "verify-last.json"));

  const v = verdictOf({ expectations, obs, tagsBefore, verifyLive, verifyAfterRestore: verifyAfter });
  const out = {
    kind: "aria-sentinel-fault-lab-verdict", date: new Date().toISOString(), contentBlind: true,
    build: { version: pub.version || null, mode: pub.mode }, plan, expectations,
    verdict: v.pass ? "PASS" : "FAIL", faults: v.faults, checks: v.checks, auditTagDeltas: v.auditTagDeltas,
    verify: { whileLive: verifyLive ? { ok: verifyLive.ok, intended: publicChanges(verifyLive.changedIntended), unintended: publicChanges(verifyLive.changedUnintended) } : null,
      afterRestore: verifyAfter ? { ok: verifyAfter.ok, unintended: publicChanges(verifyAfter.changedUnintended) } : null },
    restoreExit: rest.code, log: path.join(stateDir, "fault-lab.log")
  };
  const dist = path.join(APP_ROOT, "dist");
  fs.mkdirSync(dist, { recursive: true });
  const file = verdictFileName(dist);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  log(`${out.verdict} — ${file}`);
  for (const f of v.faults) log(`  ${f.ok ? "ok  " : "FAIL"} ${f.id}: ${f.reason}`);
  for (const c of v.checks) log(`  ${c.ok ? "ok  " : "FAIL"} ${c.id}: ${c.detail}`);
  return v.pass ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then((code) => { process.exitCode = code; }, (e) => { console.error(e); process.exitCode = 1; });
}
