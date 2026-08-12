// scratch-floor.test.mjs — RUN-BH / BH2. THE FLOOR A SUITE GETS WHEN NOBODY RUNS IT THROUGH THE RUNNER.
//
// Third cycle to meet the same class. BC pinned a scratch path, BE extracted `scratch-dir.mjs`, BF0b
// made the RUNNER own the floor — and each remedy required the CALLER to opt in, so a suite launched
// directly (`node --test tests/send-sheet-gate.test.mjs`) still died on `ENOSPC ... mkdtemp` before a
// single assertion ran. Measured at the START of this cycle: 34 of 88 suites obtained scratch space
// by calling `os.tmpdir()` themselves, and on this machine `os.tmpdir()` is a volume with zero bytes
// free. `range-bundle` read 1/12 for that reason and nothing about range bundles was wrong.
//
// So the floor stops being something a suite opts into. This suite goes red when any suite reaches
// past `makeScratchDir` for a temporary directory, whichever way it is launched.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeScratchDir, CANDIDATES, scratchSubstitutions, substitutionReport, insideQuotesOrComment } from "../scripts/lib/scratch-dir.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TESTS = HERE;

/** `mkdtemp` straight off `os.tmpdir()` — the exact call this cycle swept out of 33 suites. */
const RAW_SCRATCH = /mkdtempSync\(\s*path\.join\(\s*os\.tmpdir\(\)/;

test("BH2 — no suite obtains a scratch directory without the probe", () => {
  // RUN-BL / BL3: the gate still fails the same suites; what changed is what a writer READS when it
  // does. BK watched this catch a file another seat had written three minutes earlier, and all it
  // could say was "you are wrong, go read a module". Now it quotes the offending line back with its
  // number and prints the line that replaces it, so meeting this costs one edit rather than a detour.
  const offenders = [];
  const reports = [];
  for (const f of fs.readdirSync(TESTS).filter((n) => n.endsWith(".test.mjs"))) {
    const src = fs.readFileSync(path.join(TESTS, f), "utf8");
    const findings = scratchSubstitutions(src);
    if (!findings.length) {
      // Belt and braces: the original single pattern must never outlive the list that replaced it.
      // Applied line by line and only to CODE, because the suite that proves the substitutions holds
      // every offending shape as fixture data and a string is not a call (BL3).
      const missed = src.split("\n").filter((l) => {
        const m = l.match(RAW_SCRATCH);
        return m && !insideQuotesOrComment(l, m.index);
      });
      assert.deepEqual(missed, [], `${f} matches the original raw-scratch pattern in code and produced no substitution — the pattern list has a hole in it`);
      continue;
    }
    offenders.push(f);
    reports.push(substitutionReport(path.join("tests", f), findings));
  }
  assert.deepEqual(offenders, [],
    "these suites take a scratch directory that has never been probed for writes — mkdtemp can " +
    "succeed on a full volume; the write after it is what fails. The substitution, line by line:\n" +
    `${reports.join("\n")}`);
});

test("BH2 — the directory it returns actually accepts content, not just a name", () => {
  const dir = makeScratchDir("bh2-floor-");
  const f = path.join(dir, "content.txt");
  fs.writeFileSync(f, "x".repeat(4096));
  assert.equal(fs.readFileSync(f, "utf8").length, 4096);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* a mount may refuse unlink */ }
});

test("BH2 — a volume that accepts a write and refuses unlink is still a usable floor", () => {
  // The distinction that mattered on this machine: `send-sheet-gate` read 5/26 standalone with every
  // failure EPERM on unlink, not one about the code under test. Removal is a courtesy; writing is the
  // requirement, and a probe that demands both rejects a directory that would have worked.
  const dir = makeScratchDir("bh2-noremove-");
  assert.ok(fs.existsSync(dir));
  fs.writeFileSync(path.join(dir, "a"), "a");
  assert.equal(fs.readFileSync(path.join(dir, "a"), "utf8"), "a");
});

test("BH2 — survives a hostile TMPDIR, proven by launching a process under one", () => {
  // The standalone launch path, reproduced: no runner, and the first candidate is unusable.
  const lib = path.join(HERE, "..", "scripts", "lib", "scratch-dir.mjs");
  const src = [
    // A file URL, not a raw path: on Windows an absolute path handed to the ESM loader is read as
    // a URL whose scheme is the drive letter ("protocol 'c:'") and the child dies before line one.
    `import { makeScratchDir } from ${JSON.stringify(pathToFileURL(lib).href)};`,
    `import fs from "node:fs";`,
    `const d = makeScratchDir("bh2-hostile-");`,
    `fs.writeFileSync(d + "/p", "ok");`,
    `console.log("SCRATCH_OK " + d);`,
  ].join("\n");
  // Hostile on every platform: a path whose parent is a FILE, so mkdir of it can never succeed —
  // unlike "/nonexistent-volume-bh2", which on Windows is a perfectly creatable C:\ directory.
  const hostile = path.join(fileURLToPath(import.meta.url), "not-a-dir");
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", src], {
    encoding: "utf8",
    timeout: 20000,
    // A MINIMAL env on purpose: inheriting this process's environment under `node --test` carries
    // the runner's own options into the grandchild, which then waits for a test file that never
    // arrives. The child needs a PATH, a HOME and a hostile temp dir — nothing else. Windows reads
    // TEMP/TMP where POSIX reads TMPDIR, and node.exe needs SystemRoot to initialize.
    env: {
      PATH: process.env.PATH || "/usr/bin:/bin",
      HOME: process.env.HOME || process.env.USERPROFILE || "/tmp",
      USERPROFILE: process.env.USERPROFILE || process.env.HOME || "/tmp",
      ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
      TMPDIR: hostile, TEMP: hostile, TMP: hostile,
    },
    cwd: path.join(HERE, ".."),
  });
  // An absolute path on either platform: "/tmp/...", "C:\...", or the drive-relative "\tmp\..."
  // that the POSIX "/tmp" candidate becomes under Windows path.join.
  assert.match(out, /SCRATCH_OK (?:[\\/]|[A-Za-z]:[\\/])/, "a suite launched with an unusable TMPDIR must still get a floor");
});

test("BH2 — the candidate list is ordered and the override comes first", () => {
  assert.ok(CANDIDATES.length >= 3, "one candidate is a remedy with a countdown on it");
  const first = CANDIDATES[0];
  process.env.AXIS_SCRATCH_DIR = "/tmp";
  assert.equal(first(), "/tmp", "AXIS_SCRATCH_DIR must be honoured before anything is guessed");
  delete process.env.AXIS_SCRATCH_DIR;
});

test("BH2 — RED: refusing is correct when nothing accepts a write", () => {
  const saved = process.env.AXIS_SCRATCH_DIR;
  process.env.AXIS_SCRATCH_DIR = "/dev/null/cannot-create-here";
  try {
    // Every real candidate still exists, so this must SUCCEED past the bad override rather than
    // throw — the point being that one dead candidate is not the end of the list.
    const dir = makeScratchDir("bh2-fallthrough-");
    assert.ok(fs.existsSync(dir));
    assert.notEqual(path.dirname(dir), "/dev/null/cannot-create-here");
  } finally {
    if (saved === undefined) delete process.env.AXIS_SCRATCH_DIR; else process.env.AXIS_SCRATCH_DIR = saved;
  }
});

test("BH2b — a parked lock is never left where git walks for refs", async () => {
  // Found by running it this cycle: a `.git/refs/heads/main.lock` parked BESIDE its ref became a ref
  // named after itself, and `git bundle verify` died with `bad object refs/heads/main.lock.parked-...`
  // — reading, from the outside, as a corrupt delivery bundle that was in fact intact.
  const { findPollutedRefs, PARK_DIR } = await import("../scripts/lib/sandbox-git-boundary.mjs");
  const polluted = findPollutedRefs({ root: path.join(HERE, "..") });
  assert.deepEqual(polluted, [],
    `lock files are sitting under .git/refs and git will try to resolve each one as a ref: ${polluted.join(", ")}. ` +
    `Park them under .git/${PARK_DIR}/ instead — git does not walk it.`);
});

test("BH2b — the park helper puts a lock somewhere git does not read", async () => {
  const { parkLockFile, PARK_DIR, findPollutedRefs } = await import("../scripts/lib/sandbox-git-boundary.mjs");
  const root = makeScratchDir("bh2b-repo-");
  fs.mkdirSync(path.join(root, ".git", "refs", "heads"), { recursive: true });
  const lock = path.join(root, ".git", "refs", "heads", "main.lock");
  fs.writeFileSync(lock, "");
  assert.deepEqual(findPollutedRefs({ root }), [path.join(".git", "refs", "heads", "main.lock")],
    "a lock under refs/ is exactly what git will try to resolve as a ref");
  const res = parkLockFile(lock, { root, stamp: 1 });
  assert.equal(res.parked, true, res.reason);
  assert.ok(res.to.includes(PARK_DIR), `parked to ${res.to}`);
  assert.deepEqual(findPollutedRefs({ root }), [], "after parking, nothing under refs/ is a lock");
});

test("BH2b — parking something that is not there is reported, never thrown", async () => {
  const { parkLockFile } = await import("../scripts/lib/sandbox-git-boundary.mjs");
  const root = makeScratchDir("bh2b-empty-");
  const res = parkLockFile(path.join(root, ".git", "refs", "heads", "nothing.lock"), { root });
  assert.equal(res.parked, false);
  assert.match(res.reason, /no such lock/);
});
