// PROD 2026-10-14 — round 2 of lane F2: the renderer (F3), build (F4) and server (F1) lanes' requests into main.
//   F3-1 choosePlan(tier, {billing}) honours yearly (env URL + &billing=yearly on the /plans fallback)
//   F3-2 state.watchers = { running, count, lastTickAgeMs, names } (real orchestrator status)
//   F3-3 the kill switch sets ariaStopped:true in state
//   F3-4 the globe is interactive in Manual mode; the overlay hover-forward IPC exists
//   F3-5 the Settings window fits the work area (1366×768 laptops) and remembers its size
//   F3-6 sentinel:open-reports-folder → shell.openPath(reports dir) → { ok, path:null }
//   F4-7 readDistInfo / artifact names prefer ARIA-Sentinel-<v>-setup.exe, fall back to -unsigned.exe; the update
//        listener accepts either name in the manifest
//   F4-8 R6a: hours/$ saved count LIVE fixes only (never a "Dry-run …" preview row)
//   F4-9 node_modules/vosk-browser/dist/vosk.js ships inside app.asar under the explicit build.files allow-list
//   F1   x-sentinel-key (when a license exists) and x-sentinel-device (always) on heartbeat / manifest / crash / session-report
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createDetectionOrchestrator } from "../src/sub-agents/detection/index.mjs";
import { modeOverlayBehavior } from "../src/shared/mode-behavior.mjs";
import { assetName, signedAssetName, assetCandidates, isSentinelArtifactName, isSignedArtifactName, githubAssetUrlFor, githubAssetUrl } from "../src/shared/ota-release.mjs";
import { checkForUpdate } from "../src/main/update-listener.mjs";
import { countLiveFixes, isLiveFixRow } from "../src/shared/resolution-outcome.mjs";

const root = path.resolve(import.meta.dirname, "..");
const main = fs.readFileSync(path.join(root, "src/main/main.mjs"), "utf8");
const preload = fs.readFileSync(path.join(root, "src/main/preload.cjs"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
let groups = 0; const g = () => { groups++; };

// F3-1 — billing-aware checkout.
assert.match(main, /function openPlanCheckout\(tier, opts = \{\}\)/);
assert.match(main, /const yearly = opts && opts\.billing === "yearly";/);
assert.match(main, /pro: yearly \? pick\("STRIPE_PRO_YEARLY_URL", "STRIPE_PRO_MONTHLY_URL"\) : pick\("STRIPE_PRO_MONTHLY_URL", "STRIPE_PRO_YEARLY_URL"\)/, "yearly picks the yearly env URL first");
assert.match(main, /`https:\/\/iisupp\.net\/plans\/\?from=app&tier=\$\{safeTier\}\$\{yearly \? "&billing=yearly" : ""\}`/, "the /plans fallback carries billing=yearly");
assert.match(main, /ipcMain\.handle\("sentinel:choose-plan", \(_event, tier, opts\) => openPlanCheckout\(tier,/, "IPC passes the options through");
assert.match(preload, /choosePlan: \(tier, opts\) => ipcRenderer\.invoke\("sentinel:choose-plan", tier, opts \|\| \{\}\)/);
g();

// F3-2 — real watcher status with names.
const orch = createDetectionOrchestrator({ detectIssue: () => {}, isBlocked: () => false, factories: [(d) => ({ name: "disk", cadenceMs: 60_000, async tick() {} }), (d) => ({ name: "event-log", cadenceMs: 60_000, async tick() {} })] });
let st = orch.status();
assert.deepEqual({ running: st.running, count: st.count, lastTickAgeMs: st.lastTickAgeMs, names: st.names }, { running: false, count: 2, lastTickAgeMs: null, names: ["disk", "event-log"] });
orch.startAll(); st = orch.status(); assert.equal(st.running, true); orch.stopAll();
assert.match(main, /watchers: watchersStatus\(\),/, "state carries watchers");
assert.match(main, /function watchersStatus\(\) \{[\s\S]*?return \{ running: false, count: 0, lastTickAgeMs: null, names: \[\], spawnsPerMinute: 0 \};/, "no orchestrator → honest empty status");
assert.match(main, /running: Boolean\(st\.running\) && !store\.get\("ariaStopped"\)/, "a stopped ARIA never reports running watchers");
g();

// F3-3 — kill switch → ariaStopped:true.
const ks = main.match(/function activateKillSwitch\(\)\s*\{[\s\S]*?\n\}/)[0];
assert.match(ks, /store\.set\("ariaStopped", true\);/, "the kill switch records ariaStopped so Start re-arms from the truth");
g();

// F3-4 — manual mode is interactive; hover-forward IPC + preload exist; the physics loop restores the MODE's state, not a hard-coded click-through.
assert.equal(modeOverlayBehavior("manual").ignoreMouse, false);
assert.equal(modeOverlayBehavior("confirmed").ignoreMouse, false);
assert.match(main, /ipcMain\.handle\("sentinel:overlay-hover"/);
assert.match(main, /function setOverlayHover\(over\)[\s\S]*?if \(over\) overlayWindow\.setIgnoreMouseEvents\(false\);\s*\n\s*else overlayWindow\.setIgnoreMouseEvents\(true, \{ forward: true \}\);/, "over → interactive, out → click-through with forwarded mousemove");
assert.match(preload, /setOverlayHover: \(over\) => ipcRenderer\.invoke\("sentinel:overlay-hover", \{ over: Boolean\(over\) \}\)/);
assert.doesNotMatch(main, /store\.get\("mode"\) === "manual"\) overlayWindow\.setIgnoreMouseEvents\(true/, "no hard-coded manual click-through remains");
assert.match(main, /overlayWindow\.setIgnoreMouseEvents\(modeOverlayBehavior\(store\.get\("mode"\)\)\.ignoreMouse, \{ forward: true \}\)/, "the resting state comes from the mode behaviour");
assert.match(main, /function enableGlobeInteraction\(ms = 3000\)/, "the 3-second interaction window still exists");
g();

// F3-5 — window sizing fits the work area and is remembered.
assert.match(main, /const width = Math\.max\(640, Math\.min\(1280, wa\.width - 40\)\);\s*\n\s*const height = Math\.max\(480, Math\.min\(820, wa\.height - 40\)\);/, "min(1280/820, workArea − 40)");
assert.match(main, /if \(width < sizing\.minWidth\) sizing\.minWidth = width;[^\n]*\n\s*if \(height < sizing\.minHeight\) sizing\.minHeight = height;/, "minimums never exceed the fitted size (1366×768)");
assert.match(main, /store\.get\("mainWindowBounds"\)/, "a remembered size is reused…");
assert.match(main, /saved\.x \+ w <= wa\.x \+ wa\.width && saved\.y \+ h <= wa\.y \+ wa\.height/, "…only when it still fits the current display");
assert.match(main, /mainWindow\.on\("resize", rememberMainWindowBounds\);\s*\n\s*mainWindow\.on\("move", rememberMainWindowBounds\);/, "resize/move are remembered (debounced)");
assert.match(main, /\.\.\.mainWindowSizing\(\),/, "createMainWindow uses the sizing");
g();

// F3-6 — open reports folder, never the raw path.
assert.match(main, /ipcMain\.handle\("sentinel:open-reports-folder", async \(\) => \{[\s\S]*?shell\.openPath\(dir\)[\s\S]*?return \{ ok: true, path: null \};/, "openPath on the reports dir; path:null to the renderer");
assert.match(preload, /openReportsFolder: \(\) => ipcRenderer\.invoke\("sentinel:open-reports-folder"\)/);
g();

// F4-7 — signed / unsigned artifact names.
assert.equal(assetName("0.2.0"), "ARIA-Sentinel-0.2.0-unsigned.exe", "historical name unchanged (Rule 15)");
assert.equal(signedAssetName("0.2.0"), "ARIA-Sentinel-0.2.0-setup.exe");
assert.deepEqual(assetCandidates("0.2.0"), ["ARIA-Sentinel-0.2.0-setup.exe", "ARIA-Sentinel-0.2.0-unsigned.exe"], "signed preferred, unsigned fallback");
assert.equal(isSentinelArtifactName("ARIA-Sentinel-0.2.0-setup.exe", "0.2.0"), true);
assert.equal(isSentinelArtifactName("ARIA-Sentinel-0.2.0-unsigned.exe", "0.2.0"), true);
assert.equal(isSentinelArtifactName("ARIA-Sentinel-0.1.9-setup.exe", "0.2.0"), false, "a different version's artifact is not this version's");
assert.equal(isSentinelArtifactName("ARIA-Sentinel-0.2.0-setup.exe.bak"), false);
assert.equal(isSignedArtifactName("ARIA-Sentinel-0.2.0-setup.exe"), true); assert.equal(isSignedArtifactName("ARIA-Sentinel-0.2.0-unsigned.exe"), false);
assert.equal(githubAssetUrlFor("0.2.0", "ARIA-Sentinel-0.2.0-setup.exe"), githubAssetUrl("0.2.0").replace("-unsigned.exe", "-setup.exe"));
assert.equal(githubAssetUrlFor("0.2.0", "evil.exe"), githubAssetUrl("0.2.0"), "an unknown name falls back to the canonical unsigned URL");
assert.match(main, /const candidates = \[path\.join\(root, "dist", otaSignedAssetName\(version\)\), path\.join\(root, "dist", otaAssetName\(version\)\)\];/, "readDistInfo prefers the signed installer");
assert.match(main, /signed: isSignedArtifactName\(name\)/, "…and says which one it found");
for (const name of ["ARIA-Sentinel-0.3.0-setup.exe", "ARIA-Sentinel-0.3.0-unsigned.exe"]) {
  const yml = `version: 0.3.0\npath: ${name}\nsha512: abc\nreleaseDate: '2026-10-14'\n`;
  const r = await checkForUpdate({ fetchManifest: async () => yml, installedVersion: "0.2.0" });
  assert.equal(r.updateAvailable, true, `${name}: accepted as an update`);
  assert.equal(r.event.artifact, name); assert.equal(r.event.artifactKnown, true); assert.equal(r.event.signed, name.endsWith("-setup.exe"));
}
g();

// F4-8 — R6a: live fixes only.
const log = [
  { tag: "RUN", text: "Dry-run recipe NET.DNS.FAIL", recipeId: "dns-fail-v1" },
  { tag: "RUN", text: "Dry-run Tier-0 restart-print-spooler", recipeId: "restart-print-spooler" },
  { tag: "RUN", text: "Executing recipe NET.DNS.FAIL", recipeId: "dns-fail-v1" }
];
assert.equal(countLiveFixes(log), 1, "pre-FIX-row logs: the live attempt counts, the two previews do not");
assert.equal(countLiveFixes(log.slice(0, 2)), 0, "previews alone → 0 (no hours 'saved' by a dry-run)");
const withFix = [...log, { tag: "FIX", text: "DNS lookup failed: applied", recipeId: "dns-fail-v1", outcome: "done" }, { tag: "FIX", text: "Print queue stuck: failed", recipeId: "printer-spooler-v1", outcome: "failed" }, { tag: "FIX", text: "x", outcome: "done", dryRun: true }];
assert.equal(countLiveFixes(withFix), 1, "with FIX rows: only outcome 'done' counts (failed / dry-run never)");
assert.equal(isLiveFixRow({ tag: "FIX", outcome: "done" }), true); assert.equal(isLiveFixRow({ tag: "RUN", text: "Executing recipe X" }), false, "once FIX rows exist, RUN rows are attempts, not fixes");
assert.doesNotMatch(main, /e\.tag === "RUN"\)\.length/, "no surface counts raw RUN rows any more");
assert.match(main, /const fixes = countLiveFixes\(log\); \/\/ R6a — live fixes only, never a preview\n  return valueProof\(/, "valueProofNow counts live fixes");
assert.match(main, /if \(!actualDryRun\) logEvent\("FIX", `\$\{recipeTitle\(recipeId\)\}: \$\{result\.message\}`, \{ recipeId: result\.recipeId \|\| recipeId, outcome: result\.outcome === "success" \? "done"/, "Tier-0 live runs write a FIX row");
assert.match(main, /if \(!effectiveDryRun\) logEvent\("FIX", `\$\{recipe\.title\}:/, "registry live runs write a FIX row");
assert.match(main, /outcome: ok && verifiedFlag !== false \? "done" : "failed"/, "a run whose verification FAILED is not 'done'");
g();

// F4-9 — vosk ships in the asar: it is a production dependency, the allow-list never negates node_modules, the file exists.
assert.ok(pkg.dependencies && pkg.dependencies["vosk-browser"], "vosk-browser is a production dependency (electron-builder always adds **/node_modules/**/* of production dependencies to a custom `files` list)");
assert.ok(!pkg.build.files.some((f) => /^!.*node_modules/.test(String(f))), "build.files never negates node_modules");
assert.ok(fs.existsSync(path.join(root, "node_modules", "vosk-browser", "dist", "vosk.js")), "node_modules/vosk-browser/dist/vosk.js exists on disk");
assert.equal(JSON.parse(fs.readFileSync(path.join(root, "node_modules", "vosk-browser", "package.json"), "utf8")).main, "./dist/vosk.js");
assert.ok(pkg.build.files.includes("src/renderer/local-stt.mjs"), "the loader itself is allow-listed");
g();

// F1 — device credential headers.
assert.match(main, /const keyHash = licenseKeyHash\(\);\s*\n\s*const headers = \{ "content-type": "application\/json", "user-agent": "aria-sentinel", "x-sentinel-device": deviceIdHash\(\) \};\s*\n\s*if \(keyHash\) headers\["x-sentinel-key"\] = keyHash;/, "heartbeat: device always, key when licensed");
assert.match(main, /headers: \{ "user-agent": "aria-sentinel", "x-sentinel-device": deviceIdHash\(\), \.\.\.feed\.requestHeaders \}/, "manifest GET: device always, key via feed headers when licensed");
assert.match(main, /headers: \(\) => \{ const h = \{ "x-sentinel-device": deviceIdHash\(\) \}; const k = licenseKeyHash\(\); if \(k\) h\["x-sentinel-key"\] = k; return h; \}/, "crash flush: device always, key when licensed");
assert.match(main, /const headers = \{ "content-type": "application\/json", "user-agent": "aria-sentinel", "x-sentinel-device": deviceIdHash\(\) \};\s*\n\s*const keyHash = licenseKeyHash\(\);\s*\n\s*if \(keyHash\) headers\["x-sentinel-key"\] = keyHash;\s*\n\s*const res = await outbound\.fetch\(RESOLUTION_EMAIL_ENDPOINT/, "session-report: device always, key when licensed");
assert.match(main, /return \/\^\[a-f0-9\]\{64\}\$\/i\.test\(key\) \? createHash\("sha256"\)\.update\(key\)\.digest\("hex"\) : "";/, "no license (trial) → empty hash → the key header is simply absent, never a bogus value");
g();

assert.equal(groups, 10);
console.log(`round2-main-wiring test passed (${groups} groups · billing checkout · watchers status · kill→ariaStopped · manual globe interactive + hover IPC · window fits + remembered · reports folder · signed/unsigned artifacts · live-only fix count · vosk in asar · credential headers).`);
