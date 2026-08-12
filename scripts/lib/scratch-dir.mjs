// scratch-dir.mjs — RUN-BE / BE2. THE REMEDY THAT STOPS HAVING A COUNTDOWN ON IT.
//
// RUN-BC traced two cycles of red suites to `ENOSPC ... mkdtemp` and pinned the scratch directory to
// one hard-coded location. Within a day that location came back owned by another user and refused
// every write. RUN-BD fixed that INSIDE ONE SCRIPT — the status emitter — with a candidate list.
//
// The fix stayed local to the script that was hurting, so every OTHER caller of `os.tmpdir()` still
// carried the original failure. Found by running it: a brand-new suite written this cycle failed 16
// of its 20 cases on `ENOSPC ... mkdtemp` before a single assertion was evaluated. The tests were
// not wrong. The floor was.
//
// So the lesson gets extracted rather than re-learned: any code that needs somewhere to write picks
// the FIRST CANDIDATE THAT ACTUALLY ACCEPTS A WRITE, and proves it with a probe rather than assuming
// the directory it just created is usable. `mkdtemp` can succeed on a full volume; the write after it
// is what fails. A remedy that depends on one path staying writable forever is a remedy with a
// countdown on it.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// RUN-BH / BH2. The last resort, and the reason it exists.
// Measured this cycle: `/`, `/tmp`, `/var/tmp` and `~/.cache` all reached ENOSPC at once — this
// sandbox's root volume is 9.6 GB and full, and nothing on it can be unlinked to make room. Every
// system candidate refused a write within the same second and `makeScratchDir` correctly threw.
// The repository's own mount, however, still had space, because it is a different volume.
// `<repo>/tmp/` is git-ignored and force-404'd in netlify.toml, so nothing written there can become
// tracked content or reach the open web. It is LAST on purpose: a scratch directory inside the tree
// under test is a compromise, and it is only better than having no floor at all.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const REPO_SCRATCH = path.join(REPO_ROOT, "tmp", "scratch");

/** Tried in order. The first that accepts BOTH a directory and a probe write wins. */
export const CANDIDATES = Object.freeze([
  () => process.env.AXIS_SCRATCH_DIR || null,
  () => os.tmpdir(),
  () => "/tmp",
  () => "/var/tmp",
  // RUN-BH / BH2: shared memory. Measured this cycle, when every disk-backed candidate answered
  // ENOSPC within the same second: `/dev/shm` was empty, writable, and — the property that decided
  // it — accepted UNLINK, which the repository mount does not. A fixture that runs `git commit`
  // needs to remove `COMMIT_EDITMSG`; on a volume that refuses unlink it cannot, and the suite goes
  // red on the floor rather than on its subject. Small (512 MB here) and volatile, which is exactly
  // what a test fixture wants.
  () => "/dev/shm",
  () => (os.homedir() ? path.join(os.homedir(), ".cache") : null),
  () => REPO_SCRATCH,
]);

/**
 * Create a private scratch directory this process owns.
 *
 * @param {string} prefix  a name that says which caller made it, so a leftover is traceable
 * @returns {string} absolute path to a directory that has been PROVEN writable
 * @throws when no candidate accepts a write — refusing is correct; writing into a volume that
 *         silently drops data would be worse than stopping.
 */
/**
 * RUN-BH / BH2. The repo-local floor is inside a work tree, and that is a fact fixtures can feel.
 *
 * Measured this cycle: with every system volume full at once, the fallback landed under
 * `<repo>/tmp/scratch/…` and eleven suites went red — not on their subject, but because a directory
 * a fixture had asked for as "somewhere that is NOT a repository" was, by being inside this one,
 * suddenly a repository. `git rev-parse` walks UP, so the scratch directory inherited the tree
 * around it and "an unreadable HEAD" silently became a readable one.
 *
 * `GIT_CEILING_DIRECTORIES` stops that walk at the scratch root. Discovery from inside answers
 * "not a git repository", which is what the fixture asked for, while `git init` still works for the
 * fixtures that build a real repository — verified both ways before this was relied on.
 */
function isInsideRepo(dir) {
  const abs = path.resolve(dir);
  return abs === REPO_ROOT || abs.startsWith(REPO_ROOT + path.sep);
}

function sealRepoBoundary(base) {
  // The ceiling is the SCRATCH ROOT, not the repository root: a fixture that builds its own
  // repository below it must still be discoverable from inside itself. Sealing at the repo root
  // would hide the fixture from its own test.
  const ceiling = path.resolve(base);
  const prev = process.env.GIT_CEILING_DIRECTORIES || "";
  if (prev.split(":").filter(Boolean).includes(ceiling)) return;
  process.env.GIT_CEILING_DIRECTORIES = prev ? `${prev}:${ceiling}` : ceiling;
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN-BL / BL3. THE FAILURE THAT NAMES THE FIX.
//
// RUN-BK watched the gate above catch a suite that had not existed when the cycle began: another
// seat wrote `tests/axis-vault-brain.test.mjs`, took `mkdtempSync(os.tmpdir())` in it, and three
// minutes later the site suite read 95/96. The gate was right and it was fast. What it could not do
// was tell that writer ANYTHING except that they were wrong — the message named the module but not
// the line, so meeting it costs a reader a detour into someone else's file to work out what the
// substitution actually is.
//
// A guard that reports a verdict makes the same writer pay the same tax every time. A guard that
// reports the one-line substitution is read once and obeyed. So the offending line is quoted back
// with its number, and the exact replacement is printed under it. Nothing here edits a file: a file
// another seat is actively writing is the wrong thing to reach into (R16), and a gate that silently
// rewrote a stranger's test would be a far worse failure than the one it is preventing.
// ─────────────────────────────────────────────────────────────────────────────

export const IMPORT_LINE = 'import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";';

/**
 * Every shape of "scratch space that was never probed" this repository has actually met, each with
 * the substitution that replaces it. Declared, not inferred — a pattern list that grows by evidence.
 */
export const RAW_SCRATCH_PATTERNS = Object.freeze([
  // The `fs.` (or any object) prefix is part of what gets replaced. Written the other way round
  // first, and the gate printed `const tmp = fs.makeScratchDir(...)` — a substitution that does not
  // run. A guard that prints a fix which does not compile has replaced one detour with a worse one,
  // so the replacement text is proven by test against every shape below, not eyeballed.
  Object.freeze({
    id: "mkdtemp-path-join-tmpdir",
    re: /(?:[A-Za-z_$][\w$]*\.)?mkdtempSync\(\s*path\.join\(\s*os\.tmpdir\(\)\s*,\s*([^)]*?)\s*\)\s*\)/,
    replace: (m) => `makeScratchDir(${String(m[1]).trim() || '"scratch-"'})`,
    why: "mkdtemp can succeed on a full volume; the write after it is what fails",
  }),
  Object.freeze({
    id: "mkdtemp-tmpdir-direct",
    re: /(?:[A-Za-z_$][\w$]*\.)?mkdtempSync\(\s*os\.tmpdir\(\)\s*(?:\+\s*([^)]*?))?\s*\)/,
    replace: (m) => `makeScratchDir(${m[1] ? String(m[1]).trim() : '"scratch-"'})`,
    why: "the same call without the join — equally unprobed",
  }),
  Object.freeze({
    // Only the `os.tmpdir()` TOKEN is replaced, and the surrounding `path.join(...)` is left exactly
    // as its author wrote it. Replacing the whole call would change what the expression evaluates to
    // — a directory instead of a file path — and the printed fix would silently break the suite it
    // was offered to.
    // Anchored on `path.join(` on purpose: a bare `os.tmpdir()` also appears in suites that
    // deliberately exercise a hostile TMPDIR, and flagging those would make the gate a nuisance
    // rather than a floor. Precision here is what keeps it obeyed.
    id: "tmpdir-joined-by-hand",
    re: /path\.join\(\s*os\.tmpdir\(\)/,
    replace: () => 'path.join(makeScratchDir("scratch-")',
    why: "a path built under os.tmpdir() by hand is the same unprobed volume with extra steps",
  }),
]);

/**
 * Read a source file and return every unprobed-scratch line in it, each with the line number, the
 * text as written, and the line that replaces it.
 *
 * PURE — takes text, returns findings. No filesystem, so the gate can prove it against fixtures.
 * @returns {Array<{pattern:string, line:number, found:string, replacement:string, why:string}>}
 */
/**
 * Is the match at `index` inside a quoted string on this line?
 *
 * RUN-BL / BL3, found by running it: the suite that PROVES the substitutions necessarily contains
 * every offending shape as DATA — `line: "const d = fs.mkdtempSync(...)"` — and a gate that reads
 * raw text flagged its own fixtures. So did a prose comment describing the old call. A guard that
 * cannot tell code from the text describing code is a guard that gets suppressed within a week.
 * Code is what is flagged; a string literal and a comment are not code.
 */
export function insideQuotesOrComment(text, index) {
  const before = text.slice(0, index);
  const trimmed = text.trimStart();
  if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return true;
  if (before.includes("//")) return true; // a trailing comment on a code line
  for (const q of ['"', "'", "`"]) {
    // An escaped quote does not open or close a string.
    const opens = (before.match(new RegExp(`(?<!\\\\)${q === "\\" ? "\\\\" : q}`, "g")) || []).length;
    if (opens % 2 === 1) return true;
  }
  return false;
}

export function scratchSubstitutions(source) {
  const out = [];
  const lines = String(source ?? "").split("\n");
  lines.forEach((text, i) => {
    for (const p of RAW_SCRATCH_PATTERNS) {
      const m = text.match(p.re);
      if (!m) continue;
      if (insideQuotesOrComment(text, m.index)) continue;
      out.push({
        pattern: p.id,
        line: i + 1,
        found: text.trim(),
        replacement: text.replace(p.re, p.replace(m)).trim(),
        why: p.why,
      });
      break; // one finding per line: the first pattern that matches is the one to substitute
    }
  });
  return out;
}

/** The message a writer meets. Names the file, the line, the substitution, and the import. */
export function substitutionReport(file, findings) {
  if (!findings.length) return "";
  const body = findings.map((f) =>
    `  ${file}:${f.line}\n` +
    `    found:   ${f.found}\n` +
    `    replace: ${f.replacement}\n` +
    `    why:     ${f.why}`).join("\n");
  return `${body}\n    import:  ${IMPORT_LINE}`;
}

/** Printed when every candidate refuses, so the failure is actionable rather than final. */
export const SUBSTITUTION_HINT =
  "  every candidate refused a write. Set AXIS_SCRATCH_DIR to a path on a volume with space and it " +
  "is tried FIRST, before anything is guessed:\n" +
  "    AXIS_SCRATCH_DIR=/some/writable/dir node scripts/run-tests.mjs --all\n" +
  `  and in a suite, obtain scratch space with:  ${IMPORT_LINE}`;

export function makeScratchDir(prefix = "scratch-") {
  const failures = [];
  for (const pick of CANDIDATES) {
    let base;
    try { base = pick(); } catch { continue; }
    if (!base) continue;
    let dir;
    try {
      fs.mkdirSync(base, { recursive: true });
      dir = fs.mkdtempSync(path.join(base, prefix));
    } catch (err) { failures.push(`${base}: ${err.code || err.message}`); continue; }
    // mkdtemp succeeding is not the same fact as the volume accepting content.
    //
    // RUN-BH / BH2: the probe used to require the write AND the removal, and rejected any directory
    // that refused `unlink`. That is the wrong bar. This repository's own mount accepts writes and
    // refuses unlink permanently — the boundary AR3 recorded — so a perfectly usable floor was being
    // turned down for failing a courtesy. Writing is the requirement; removing is tidiness. The
    // failure to remove is recorded on the returned path's directory, never used to reject it.
    try {
      const probe = path.join(dir, `.probe-${process.pid}`);
      fs.writeFileSync(probe, "x");
      try { fs.rmSync(probe, { force: true }); } catch { /* a mount that refuses unlink is still a floor */ }
      if (isInsideRepo(base)) sealRepoBoundary(base);
      return dir;
    } catch (err) {
      failures.push(`${base}: created but refused a write (${err.code || err.message})`);
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* a full volume can refuse unlink too */ }
    }
  }
  throw new Error(
    `no writable scratch location — ${failures.join("; ") || "no candidate produced a path"}\n${SUBSTITUTION_HINT}`,
  );
}

/** Run `fn` against a fresh scratch directory and remove it afterwards, even on throw. */
export function withScratchDir(prefix, fn) {
  const dir = makeScratchDir(prefix);
  try { return fn(dir); } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } }
}

export default {
  makeScratchDir, withScratchDir, CANDIDATES,
  scratchSubstitutions, substitutionReport, RAW_SCRATCH_PATTERNS, IMPORT_LINE, SUBSTITUTION_HINT,
};
