// PROD 2026-10-14 (audit M17 / M21 / M22) — nothing leaves the device before Setup consent; the audit seal cannot
// desync from its log; the license is re-verified while running.
//
// Before: at first launch, before the wizard, the app POSTed a heartbeat, GETed the update manifest with the RAW
// license key in the query string, flushed last launch's crash queue over a raw fetch (outside the one outbound
// wrapper the release notes promise) and re-verified the license. Every logEvent did three separate writes (store
// log, legacy seal, keyed seal file), so a crash between them produced a false "tamper detected" banner. And the
// license was verified at launch only, so a desktop left running >72 h degraded to the free tier with the network
// fine. This suite pins the fixes: the crash reporter's consent gate / wrapper / retry ceiling (behaviour, with an
// injected process + fs + fetch), and the main.mjs wiring (source-level).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import { installCrashReporter, flushCrashQueue, CRASH_SEND_MAX_ATTEMPTS } from "../src/main/crash-reporter.mjs";
import { buildFeedRequest, licenseKeyHashOf } from "../src/shared/auto-update.mjs";

const root = path.resolve(import.meta.dirname, "..");
const main = fs.readFileSync(path.join(root, "src/main/main.mjs"), "utf8");
let groups = 0; const g = () => { groups++; };

/** An in-memory fs facade for the crash queue file. */
function memFs(initial) {
  let content = initial == null ? null : JSON.stringify(initial);
  return { readFileSync: () => { if (content == null) throw new Error("ENOENT"); return content; }, writeFileSync: (_f, data) => { content = String(data); }, mkdirSync: () => {}, dump: () => (content == null ? null : JSON.parse(content)) };
}
const tick = () => new Promise((r) => setImmediate(r));

// 1 — crash reporter: with consent withheld, the queued records are NOT sent (no fetch at all); flush() later sends them.
{
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200 }; };
  const proc = Object.assign(new EventEmitter(), { platform: "win32" });
  const f = memFs([{ ts: 1, name: "Error", message: "boom", stack: "", version: "0.2.0", platform: "win32" }]);
  let consent = false;
  const rep = installCrashReporter({ version: "0.2.0", crashFile: "C:\\x\\crash.log", endpoint: "https://iisupp.net/.netlify/functions/sentinel-crash", fs: f, process: proc, fetchImpl, canSend: () => consent, headers: () => ({ "x-sentinel-device": "dev-hash" }) });
  await tick(); await tick();
  assert.equal(calls.length, 0, "before consent: the launch flush sends nothing");
  assert.equal(f.dump().length, 1, "…and keeps the record locally");
  consent = true;
  const r = await rep.flush();
  assert.equal(r.sent, 1); assert.equal(r.remaining, 0);
  assert.equal(calls.length, 1, "after consent: one send through the injected wrapper");
  assert.equal(calls[0].url, "https://iisupp.net/.netlify/functions/sentinel-crash");
  assert.equal(calls[0].init.headers["x-sentinel-device"], "dev-hash", "the device credential rides in the headers");
  assert.ok(!("attempts" in JSON.parse(calls[0].init.body)), "the local attempt counter never leaves the device");
  // A captured error is queued locally even without consent.
  proc.emit("uncaughtException", new Error("later crash C:\\Users\\jdoe\\x.docx"));
  assert.equal(f.dump().length, 1);
  assert.ok(!JSON.stringify(f.dump()).includes("jdoe"), "paths are scrubbed before they are queued");
}
g();

// 2 — retry ceiling: a record that fails CRASH_SEND_MAX_ATTEMPTS times is dropped (never retried for ever).
{
  let q = [{ ts: 1 }];
  const dropped = [];
  for (let i = 0; i < CRASH_SEND_MAX_ATTEMPTS; i++) q = await flushCrashQueue(q, async () => false, { onDrop: (rec, n) => dropped.push(n) });
  assert.deepEqual(q, [], `dropped after ${CRASH_SEND_MAX_ATTEMPTS} failed attempts`);
  assert.deepEqual(dropped, [CRASH_SEND_MAX_ATTEMPTS]);
  let q2 = await flushCrashQueue([{ ts: 2 }], async () => false);
  assert.equal(q2[0].attempts, 1, "each failure counts an attempt");
  assert.equal(CRASH_SEND_MAX_ATTEMPTS, 5);
}
g();

// 3 — feed credential: sha256(key) in x-sentinel-key, the raw key never in the URL; ?license= only as the no-hash fallback.
{
  const key = "a".repeat(64);
  const req = buildFeedRequest(key, "https://iisupp.net", "version=0.2.0");
  assert.equal(req.url, "https://iisupp.net/.netlify/functions/aria-sentinel-update-manifest?version=0.2.0");
  assert.equal(req.requestHeaders["x-sentinel-key"], licenseKeyHashOf(key));
  assert.match(req.requestHeaders["x-sentinel-key"], /^[a-f0-9]{64}$/);
  assert.notEqual(req.requestHeaders["x-sentinel-key"], key, "the header is the HASH");
  assert.ok(!req.url.includes(key), "the raw key is not in the URL");
  assert.equal(req.credential, "header");
  assert.equal(licenseKeyHashOf("A".repeat(64)), licenseKeyHashOf(key), "case-insensitive: a pasted upper-case key hashes the same");
  const fb = buildFeedRequest("LIC-KEY-123");
  assert.match(fb.url, /\?license=LIC-KEY-123$/, "a non-hex legacy key keeps the query fallback");
  assert.deepEqual(fb.requestHeaders, {}); assert.equal(fb.credential, "query-fallback");
  assert.equal(buildFeedRequest("").credential, "none");
}
g();

// 4 — main.mjs: telemetry waits for Setup consent; manual clicks never wait; consent triggers the deferred sends once.
assert.match(main, /function telemetryAllowed\(\) \{ try \{ return !shouldShowSetup\(store\.get\("setupConfig"\)\); \}/, "consent = Setup completed");
assert.match(main, /async function sendHeartbeat\(\) \{\n  if \(!telemetryAllowed\(\)\)/, "heartbeat waits for consent");
assert.match(main, /if \(reason !== "manual" && !telemetryAllowed\(\)\)[^\n]*deferred until Setup/, "automatic update checks wait; a manual check does not");
assert.match(main, /if \(opts\.manual !== true && !telemetryAllowed\(\)\)[^\n]*Knowledge pull deferred/, "automatic knowledge pulls wait; a click does not");
assert.match(main, /ipcMain\.handle\("sentinel:update-knowledge", \(\) => updateKnowledge\(\{ manual: true \}\)\)/, "the Update knowledge button is manual");
assert.match(main, /canSend: telemetryAllowed/, "the crash flush waits for consent");
assert.match(main, /fetchImpl: outbound\.fetch, canSend: telemetryAllowed, headers:/, "the crash reporter sends through the one outbound wrapper with the device headers");
assert.match(main, /logEvent\("SETUP", "Setup wizard completed\."\);[\s\S]{0,400}sendHeartbeat\(\)\.catch[\s\S]{0,200}crashReporter\.flush\(\)/, "consent runs the deferred telemetry once");
assert.match(main, /const feed = buildFeedRequest\(lic\.key \|\| "", "https:\/\/iisupp\.net", `version=/, "the manifest GET uses the hashed credential");
assert.doesNotMatch(main, /\?license=\$\{encodeURIComponent\(lic\.key/, "the raw key no longer travels in the manifest query");
assert.match(main, /if \(keyHash\) headers\["x-sentinel-key"\] = keyHash;[\s\S]{0,120}outbound\.fetch\(HEARTBEAT_ENDPOINT/, "the heartbeat carries x-sentinel-key");
assert.match(main, /const key = String\(payload\.key \|\| ""\)\.trim\(\)\.toLowerCase\(\);\n  if \(!\/\^\[a-f0-9\]\{64\}\$\/\.test\(key\)\)/, "a pasted key is lower-cased before the shape gate");
g();

// 5 — main.mjs: ONE atomic store write carries log + both seals; the mirror file is written temp+rename; the verifier
//     reads the seal from the same record first; the license is re-verified daily and on wake.
assert.match(main, /store\.set\(keyed \? \{ transparencyLog: trimmed, auditSeal: sealAudit\(trimmed\), auditSealKeyed: keyed \}/, "log + legacy seal + keyed seal in one write");
assert.match(main, /const tmp = `\$\{file\}\.\$\{process\.pid\}\.tmp`;\n  fs\.writeFileSync\(tmp, JSON\.stringify\(sealed\)\);\n  fs\.renameSync\(tmp, file\);/, "mirror written atomically");
assert.match(main, /const inStore = store\.get\("auditSealKeyed"\); if \(inStore && Array\.isArray\(inStore\.chain\)\) return inStore;/, "the verifier trusts the in-record seal first");
const launch = main.slice(main.indexOf("app.whenReady().then(() => {"), main.indexOf("app.on(\"activate\""));
assert.match(launch, /setInterval\(\(\) => \{ runUpdateCheck\("daily"\)[^\n]*refreshLicense\(\)\.catch\(\(\) => undefined\);[^\n]*\}, 24 \* 60 \* 60 \* 1000\)/, "license re-verified on the daily tick (audit M22)");
assert.match(launch, /powerMonitor\.on\("resume", \(\) => \{ runUpdateCheck\("wake"\)\.catch\(\(\) => undefined\); refreshLicense\(\)\.catch\(\(\) => undefined\); \}\)/, "…and on wake");
g();

assert.equal(groups, 5);
console.log(`first-launch-silence test passed (${groups} groups · crash queue silent before consent, sent through the wrapper after · retry ceiling ${CRASH_SEND_MAX_ATTEMPTS} · hashed feed credential · heartbeat/update/knowledge gated · atomic seal · daily license re-verify).`);
