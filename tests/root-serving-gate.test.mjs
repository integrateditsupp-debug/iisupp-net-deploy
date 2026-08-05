// root-serving-gate.test.mjs — a new operator script at the repository root must never quietly
// become a public URL.
//
// Background (run 145, 2026-07-29): netlify.toml sets `publish = "."`, so the repository root IS the
// web root. Root files were being force-404'd one at a time, by memory. That missed 120+ files —
// every AHMAD-*.cmd, every LOOP-*.bat, every _*-log.txt build log, the whole _incoming-patches/
// directory. This gate makes forgetting impossible: it fails the moment an internal-looking root
// file or internal root directory has no force-404 rule.
//
// It asserts the RULE EXISTS, not that someone remembered to write it — the rules are generated.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { collectRootTargets, isInternalRootFile, renderBlock, spliceBlock, BEGIN, END } from "../scripts/gen-root-serving-denies.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const toml = readFileSync(join(ROOT, "netlify.toml"), "utf8");

function hasForce404(from) {
  // Find the [[redirects]] stanza whose `from` matches, then confirm 404 + force within it.
  const idx = toml.indexOf(`from = "${from}"`);
  if (idx === -1) return false;
  const stanza = toml.slice(idx, idx + 220);
  return /status\s*=\s*404/.test(stanza) && /force\s*=\s*true/.test(stanza);
}

test("publish is the repository root, which is why this gate exists", () => {
  assert.match(toml, /publish\s*=\s*"\."/, "if publish stops being '.', revisit this gate rather than deleting it");
});

test("the generated block is present", () => {
  assert.ok(toml.includes(BEGIN) && toml.includes(END), "generated root-serving block missing from netlify.toml");
  // Deliberately NOT byte-equality against renderBlock(ROOT). Many operator scripts (*.cmd) are
  // gitignored, so a clone has fewer root files than the operator's disk and would render a smaller
  // block. A rule for a file that is absent here is a harmless extra 404. The contract that actually
  // matters is the SUPERSET one, asserted below: everything present must be covered.
  assert.ok(renderBlock(ROOT).includes(BEGIN), "generator must still produce a well-formed block");
  assert.ok(typeof spliceBlock(toml, renderBlock(ROOT)) === "string");
});

test("every internal-looking root FILE is force-404'd", () => {
  const { files } = collectRootTargets(ROOT);
  assert.ok(files.length > 0, "expected to find operator files at the root");
  const missing = files.filter((f) => !hasForce404(`/${f}`));
  assert.deepEqual(missing, [], `these root files would serve publicly: ${missing.join(", ")}`);
});

test("every internal root DIRECTORY is force-404'd", () => {
  const { dirs } = collectRootTargets(ROOT);
  const missing = dirs.filter((d) => !hasForce404(`/${d}/*`) && !hasForce404(`/${encodeURIComponent(d)}/*`));
  assert.deepEqual(missing, [], `these root directories would serve publicly: ${missing.join(", ")}`);
});

test("the operator entry point itself is not public", () => {
  assert.ok(isInternalRootFile("AHMAD-ONE-CLICK.cmd"), "the one-click script must be classified internal");
  assert.ok(hasForce404("/AHMAD-ONE-CLICK.cmd"), "the one-click script must be force-404'd");
});

test("genuinely public root files are NOT blocked", () => {
  for (const keep of ["robots.txt", "sitemap.xml", "site.webmanifest"]) {
    assert.equal(isInternalRootFile(keep), false, `${keep} must stay public`);
  }
  assert.equal(isInternalRootFile("index.html"), false, "the homepage must stay public");
  assert.equal(isInternalRootFile("aperture-learning.html"), false, "the AXIS command centre page must stay reachable");
});

test("a hypothetical new operator script would be caught", () => {
  for (const name of ["AHMAD-PUSH-RUN999.cmd", "LOOP-RUN-CC.bat", "_next-cycle-log.txt", "notes.md", "deploy.ps1"]) {
    assert.equal(isInternalRootFile(name), true, `${name} must be classified internal`);
  }
});
