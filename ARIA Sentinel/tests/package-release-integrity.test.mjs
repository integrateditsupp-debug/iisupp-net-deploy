// PACKAGE RELEASE INTEGRITY (2026-10-14, review P2-11) — what the customer build carries and what building it touches.
//   1 the release notes ship: build.files carries THIS version's docs/RELEASE_NOTES_<v>.md (the only docs/ file); a list
//     naming another version's notes is drift (--check / package-win refuse it) and --write repairs it
//   2 the version bump moves that entry, so the OTA flow (bump → npm test → package:win) stays green
//   3 the "What's new" loader finds the notes inside the package (app.asar) or in process.resourcesPath — on the REAL
//     main.mjs — and never builds a path from anything but a plain x.y.z version
//   4 `package-win --print-config` prints and returns: no voice-model download, no electron-builder, nothing written
//   5 the voice model download is PINNED: no SHA-256 → refused before downloading; a different hash → deleted, nothing
//     extracted; the right hash → extracted; a network failure still degrades honestly
//   6 package-win stops (exit 3) when the model is unpinned or mismatched — never builds an unverified model in
// Every effect is injected (fake download / run / writes) — this suite never reaches the network.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT, FIXED_BUILD_FILES, PACKAGE_VERSION, fixedBuildFiles, computeReachable, diffBuildFiles, driftCount, rewritePackageBuildFiles } from "../scripts/customer-build-manifest.mjs";
import { planBump, nextPackageJson, releaseNotesPath } from "../scripts/version-bump.mjs";
import { main as packageWin } from "../scripts/package-win.mjs";
import { fetchModel, pinnedSha256, VOSK_EXIT, MODEL_ZIP_URL } from "../scripts/fetch-vosk-model.mjs";
import { releaseNotesCandidates } from "../src/shared/whats-new.mjs";
import { bootMain } from "./lib/main-sandbox.mjs";
import { createLabClock } from "./lib/fault-lab.mjs";

const pkgText = fs.readFileSync(path.join(ROOT, "package.json"), "utf8");
const pkg = JSON.parse(pkgText);
const NOTES = releaseNotesPath(pkg.version);
const graph = computeReachable(ROOT);
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
let groups = 0; const g = () => { groups++; };

// ── 1 — this version's release notes ship; another version's notes are drift ──────────────────────────────────────────
{
  assert.equal(PACKAGE_VERSION, pkg.version);
  assert.equal(NOTES, `docs/RELEASE_NOTES_${pkg.version}.md`);
  assert.ok(FIXED_BUILD_FILES.includes(NOTES), "the fixed list carries this version's notes");
  assert.ok(pkg.build.files.includes(NOTES), "package.json build.files carries them (regenerated with --write)");
  assert.deepEqual(pkg.build.files.filter((f) => f.startsWith("docs/")), [NOTES], "…and no other docs/ file");
  const text = fs.readFileSync(path.join(ROOT, NOTES), "utf8");
  assert.match(text, new RegExp(`^# ARIA Sentinel ${pkg.version.replace(/\./g, "\\.")} Release Notes`), "the real notes, not a stub");
  assert.doesNotMatch(text, /Audience: DRAFT/);
  const clean = diffBuildFiles(pkg, graph);
  assert.equal(driftCount(clean), 0, "the shipped list has no drift");
  const stale = { ...pkg, build: { ...pkg.build, files: pkg.build.files.map((f) => (f === NOTES ? "docs/RELEASE_NOTES_0.1.16.md" : f)) } };
  const d = diffBuildFiles(stale, graph);
  assert.deepEqual(d.fixedMissing, [NOTES], "another version's notes → this version's are missing");
  assert.deepEqual(d.docsExtra, ["docs/RELEASE_NOTES_0.1.16.md"], "…and the stale one is reported");
  assert.ok(driftCount(d) > 0, "drift (package-win refuses, --check fails)");
  const repaired = JSON.parse(rewritePackageBuildFiles(JSON.stringify(stale), graph));
  assert.equal(driftCount(diffBuildFiles(repaired, graph)), 0, "--write repairs it");
  const extraDoc = { ...pkg, build: { ...pkg.build, files: [...pkg.build.files, "docs/FAULT-LAB.md"] } };
  assert.deepEqual(diffBuildFiles(extraDoc, graph).docsExtra, ["docs/FAULT-LAB.md"], "any other doc is refused");
}
g();

// ── 2 — the version bump moves the entry (the OTA flow stays green) ───────────────────────────────────────────────────
{
  const plan = planBump({ pkgText, notesExists: true });
  const bumped = JSON.parse(plan.writes.find((w) => w.file === "package.json").text);
  assert.ok(bumped.build.files.includes(releaseNotesPath(plan.to)), "the bumped list names the new version's notes");
  assert.ok(!bumped.build.files.includes(NOTES), "…not the old one");
  const d = diffBuildFiles(bumped, graph);
  assert.deepEqual(d.fixedMissing, [], "no fixed extra is missing after the bump");
  assert.deepEqual(d.docsExtra, []);
  assert.deepEqual(fixedBuildFiles(plan.to).slice(-1), [releaseNotesPath(plan.to)]);
  // A list without a notes entry (e.g. an old fixture) is left alone.
  const bare = JSON.parse(nextPackageJson(JSON.stringify({ version: "0.2.1", build: { files: ["package.json"] } })).text);
  assert.deepEqual(bare.build.files, ["package.json"]);
}
g();

// ── 3 — the loader: inside the package (app.asar) or in process.resourcesPath, on the real main.mjs ─────────────────────
{
  const c = releaseNotesCandidates({ appRoot: "/app/resources/app.asar", resourcesPath: "/app/resources", fileName: "RELEASE_NOTES_1.2.3.md" });
  assert.deepEqual(c, [
    ["/app/resources/app.asar", "docs", "RELEASE_NOTES_1.2.3.md"],
    ["/app/resources", "app.asar", "docs", "RELEASE_NOTES_1.2.3.md"],
    ["/app/resources", "app.asar.unpacked", "docs", "RELEASE_NOTES_1.2.3.md"],
    ["/app/resources", "docs", "RELEASE_NOTES_1.2.3.md"]
  ], "package first, then the resourcesPath layouts");
  for (const bad of ["../../etc/passwd", "0.2.1/../../x", "", "1.2", "1.2.3-beta", null]) assert.deepEqual(releaseNotesCandidates({ appRoot: "/a", resourcesPath: "/r", fileName: `RELEASE_NOTES_${bad}.md` }), [], `no path from "${bad}"`);
  assert.deepEqual(releaseNotesCandidates({ appRoot: "/a", fileName: "../package.json" }), []);
  // The REAL main.mjs loader, with a packaged-style resources folder.
  const res = path.join(tmp("notes-res-"), "resources");
  fs.mkdirSync(path.join(res, "app.asar", "docs"), { recursive: true });
  fs.mkdirSync(path.join(res, "docs"), { recursive: true });
  fs.writeFileSync(path.join(res, "app.asar", "docs", "RELEASE_NOTES_9.9.9.md"), "# ARIA Sentinel 9.9.9 Release Notes\nfrom the asar\n");
  fs.writeFileSync(path.join(res, "docs", "RELEASE_NOTES_9.9.8.md"), "# ARIA Sentinel 9.9.8 Release Notes\nfrom extraResources\n");
  const b = await bootMain({ clock: createLabClock(Date.parse("2026-10-14T12:00:00Z")), root: tmp("notes-main-"), storeSeed: {}, resourcesPath: res });
  assert.match(b.main.readReleaseNotes("9.9.9"), /from the asar/, "found in resources/app.asar/docs");
  assert.match(b.main.readReleaseNotes("9.9.8"), /from extraResources/, "found in resources/docs");
  assert.equal(b.main.readReleaseNotes(pkg.version), fs.readFileSync(path.join(ROOT, NOTES), "utf8"), "this version's notes from the package itself");
  assert.equal(b.main.readReleaseNotes("9.9.7"), "", "none → empty (the modal says so)");
  assert.equal(b.main.readReleaseNotes("../../package"), "", "never a path from free text");
}
g();

// ── 4 — --print-config prints and returns: nothing downloaded, nothing run, nothing written ──────────────────────────────
{
  const out = [], err = [];
  const forbid = (what) => () => { throw new Error(`--print-config must not ${what}`); };
  const code = packageWin(["--print-config"], { run: forbid("run anything (voice-model download / electron-builder)"), writeFile: forbid("write a file"), mkdir: forbid("create dist/"), log: (s) => out.push(String(s)), error: (s) => err.push(String(s)), voskPresent: () => false, env: {} });
  assert.equal(code, 0, err.join("\n"));
  const config = JSON.parse(out.find((s) => s.trim().startsWith("{")));
  assert.ok(config.files.includes(NOTES), "the printed config carries the release notes");
  assert.ok(!config.extraResources.some((e) => e && /vosk-model/.test(String(e.from || ""))), "printed for the model state as it is (absent → no voice resource), without fetching it");
  assert.ok(out.some((s) => /^command: /.test(s)));
  assert.ok(out.some((s) => /nothing was downloaded or written/.test(s)));
}
g();

// ── 5 — the voice model download is pinned ──────────────────────────────────────────────────────────────────────────────
{
  const BYTES = Buffer.from("PK\u0003\u0004 not really a zip — the lab's stand-in for vosk-model-small-en-us-0.15.zip");
  const GOOD = crypto.createHash("sha256").update(BYTES).digest("hex");
  assert.deepEqual(pinnedSha256({ env: { VOSK_MODEL_SHA256: GOOD.toUpperCase() } }), { sha256: GOOD, source: "env" });
  assert.deepEqual(pinnedSha256({ env: {}, pinText: `${GOOD}  vosk-model-small-en-us-0.15.zip\n` }), { sha256: GOOD, source: "file" }, "sha256sum format");
  assert.equal(pinnedSha256({ env: { VOSK_MODEL_SHA256: "abc" }, pinText: GOOD }).invalid, true, "a malformed env value is refused, not ignored");
  assert.equal(pinnedSha256({ env: {}, pinText: "TODO" }).invalid, true);
  assert.deepEqual(pinnedSha256({ env: {} }), { sha256: null, source: null });
  const quiet = { log: () => {}, error: () => {} };
  function bench() {
    const dir = tmp("vosk-");
    const modelsDir = path.join(dir, "models"), modelDir = path.join(modelsDir, "vosk-model-small-en-us"), pinFile = path.join(dir, "vosk-model.sha256");
    const calls = { download: [], extract: [] };
    const download = async (url, dest) => { calls.download.push(url); fs.writeFileSync(dest, BYTES); };
    const extract = (zip, into) => { calls.extract.push(zip); fs.mkdirSync(path.join(into, "vosk-model-small-en-us-0.15"), { recursive: true }); fs.writeFileSync(path.join(into, "vosk-model-small-en-us-0.15", "README"), "model"); };
    return { dir, modelsDir, modelDir, pinFile, calls, download, extract };
  }
  // a. no pin → refused before downloading
  let t = bench(); let errs = [];
  assert.equal(await fetchModel({ env: {}, modelDir: t.modelDir, modelsDir: t.modelsDir, pinFile: t.pinFile, download: t.download, extract: t.extract, log: () => {}, error: (s) => errs.push(s) }), VOSK_EXIT.NO_PIN);
  assert.deepEqual(t.calls.download, [], "nothing was downloaded");
  assert.equal(fs.existsSync(t.modelsDir), false, "nothing was created");
  assert.match(errs.join("\n"), /REFUSED — no pinned SHA-256 for vosk-model-small-en-us-0\.15\.zip.*Nothing was downloaded/);
  assert.match(errs.join("\n"), /VOSK_MODEL_SHA256=<64 hex>/); assert.match(errs.join("\n"), /scripts\/vosk-model\.sha256/); assert.match(errs.join("\n"), /--no-voice/);
  // b. a malformed pin → refused too
  t = bench();
  assert.equal(await fetchModel({ env: { VOSK_MODEL_SHA256: "not-a-hash" }, modelDir: t.modelDir, modelsDir: t.modelsDir, pinFile: t.pinFile, download: t.download, extract: t.extract, ...quiet }), VOSK_EXIT.NO_PIN);
  assert.deepEqual(t.calls.download, []);
  // c. the pinned hash (file, sha256sum format) matches → extracted
  t = bench();
  fs.writeFileSync(t.pinFile, `${GOOD}  vosk-model-small-en-us-0.15.zip\n`);
  assert.equal(await fetchModel({ env: {}, modelDir: t.modelDir, modelsDir: t.modelsDir, pinFile: t.pinFile, download: t.download, extract: t.extract, ...quiet }), VOSK_EXIT.OK);
  assert.deepEqual(t.calls.download, [MODEL_ZIP_URL]); assert.equal(t.calls.extract.length, 1, "verified → extracted");
  assert.ok(fs.existsSync(path.join(t.modelDir, "README")), "normalised to vosk-model-small-en-us");
  assert.equal(fs.existsSync(path.join(t.modelsDir, "vosk-model-small-en-us.zip")), false, "the zip is removed");
  // d. a different hash (env wins over the file) → deleted, nothing extracted
  t = bench(); errs = [];
  fs.writeFileSync(t.pinFile, GOOD);
  assert.equal(await fetchModel({ env: { VOSK_MODEL_SHA256: "0".repeat(64) }, modelDir: t.modelDir, modelsDir: t.modelsDir, pinFile: t.pinFile, download: t.download, extract: t.extract, log: () => {}, error: (s) => errs.push(s) }), VOSK_EXIT.MISMATCH);
  assert.deepEqual(t.calls.extract, [], "nothing extracted");
  assert.equal(fs.existsSync(path.join(t.modelsDir, "vosk-model-small-en-us.zip")), false, "the download was deleted");
  assert.match(errs.join("\n"), new RegExp(`checksum mismatch .*pinned 0{64} \\(VOSK_MODEL_SHA256\\), downloaded ${GOOD}`));
  // e. the model is already present → nothing to do (the pin is not even read)
  t = bench();
  fs.mkdirSync(t.modelDir, { recursive: true }); fs.writeFileSync(path.join(t.modelDir, "am"), "x");
  assert.equal(await fetchModel({ env: {}, modelDir: t.modelDir, modelsDir: t.modelsDir, pinFile: t.pinFile, download: t.download, extract: t.extract, ...quiet }), VOSK_EXIT.OK);
  assert.deepEqual(t.calls.download, []);
  // f. a network failure still degrades honestly (exit 0; the app ships without the microphone)
  t = bench();
  assert.equal(await fetchModel({ env: { VOSK_MODEL_SHA256: GOOD }, modelDir: t.modelDir, modelsDir: t.modelsDir, pinFile: t.pinFile, download: async () => { throw new Error("ENOTFOUND"); }, extract: t.extract, ...quiet }), VOSK_EXIT.OK);
  assert.deepEqual(t.calls.extract, []); assert.equal(fs.existsSync(t.modelDir), false);
}
g();

// ── 6 — package-win stops when the model is unpinned or mismatched ───────────────────────────────────────────────────────
for (const status of [VOSK_EXIT.NO_PIN, VOSK_EXIT.MISMATCH]) {
  const ran = [], err = [];
  const code = packageWin([], {
    run: (cmd, args) => { ran.push(path.basename(String(args[0]))); if (/fetch-vosk-model\.mjs$/.test(String(args[0]))) return status; throw new Error("electron-builder must not run"); },
    writeFile: () => { throw new Error("nothing may be written"); }, mkdir: () => { throw new Error("dist/ must not be created"); },
    log: () => {}, error: (s) => err.push(String(s)), voskPresent: () => false, env: {}
  });
  assert.equal(code, 3, `fetch exit ${status} → the build is refused`);
  assert.deepEqual(ran, ["fetch-vosk-model.mjs"], "only the fetch ran");
  assert.match(err.join("\n"), /REFUSED: the voice model (has no pinned SHA-256|did not match its pinned SHA-256)/);
  assert.match(err.join("\n"), /--no-voice/);
}
{
  const ran = [];
  const code = packageWin(["--no-voice"], { run: (cmd, args) => { ran.push(path.basename(String(args[0]))); return 7; }, writeFile: () => {}, mkdir: () => {}, log: () => {}, error: () => {}, voskPresent: () => false, env: {} });
  assert.equal(code, 7, "--no-voice skips the model; electron-builder's own exit code comes back");
  assert.deepEqual(ran, ["cli.js"], "no fetch with --no-voice");
}
g();

assert.equal(groups, 6);
console.log(`package-release-integrity test passed (${groups} groups · ${NOTES} ships (the only docs/ file) and the bump moves it · the loader finds it in app.asar or resources · --print-config downloads/runs/writes nothing · the voice model is pinned: no hash → refused, wrong hash → deleted · package-win refuses an unverified model).`);
