// served-feed-dir-clean.test.mjs — the AXIS status feed directories are SERVED, so nothing may sit
// in them except the feed itself.
//
// Background (cycle 121, 2026-08-05). `netlify.toml` sets `publish = "."`, so both
// `.well-known/axis/` and `public/.well-known/axis/` are live URL space. Two artefacts were found
// sitting inside them on the operator's disk:
//
//   public/.well-known/axis/t_big.tmp        — a zero-byte emitter scratch file
//   .well-known/axis/.status.AH0Z.json       — a dotfile draft of the feed, 5617 bytes
//
// Both were UNTRACKED, which is exactly why they survived. `deploy-safety-denylist` and
// `root-serving-gate` both reason about TRACKED files and about the repository ROOT; neither one
// looks inside a served subdirectory for untracked residue. A CLI/directory publish would have
// served `/.well-known/axis/.status.AH0Z.json` — an internal draft of the status feed — publicly.
//
// This is the second time a temp file has been found in the publish tree (cycle 119 untracked two
// emitter temp files that had been COMMITTED). The recurring class is "the emitter leaves scratch
// next to its output". A gate is cheaper than remembering.
//
// The contract asserted is an ALLOWLIST, not a denylist of known-bad names: anything that is not a
// sanctioned feed artefact fails, including file types nobody has invented yet.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// The two served mirrors of the feed. Both are real URL space under `publish = "."`.
export const FEED_DIRS = [".well-known/axis", "public/.well-known/axis"];

// The only artefacts allowed to live in a served feed directory. Additions here are a deliberate
// decision that the file is safe to serve publicly, not a convenience.
export const SANCTIONED_FEED_FILES = new Set(["status.json", "brain-index.json"]);

/**
 * Pure classifier — exported so it can be exercised directly in both directions.
 * True only for a file that is sanctioned to be served from a feed directory.
 */
export function isSanctionedFeedFile(name) {
  if (typeof name !== "string" || name.length === 0) return false;
  if (name.startsWith(".")) return false; // dotfile drafts (.status.AH0Z.json) are never served
  if (/\.(tmp|temp|part|bak|orig|swp|swo|log|old|rej)$/i.test(name)) return false;
  if (name.endsWith("~")) return false;
  if (/\.(CANDIDATE|DRAFT|WIP)\./i.test(name)) return false;
  return SANCTIONED_FEED_FILES.has(name);
}

test("the classifier accepts exactly the sanctioned feed artefacts", () => {
  for (const ok of SANCTIONED_FEED_FILES) {
    assert.equal(isSanctionedFeedFile(ok), true, `${ok} is the feed and must be servable`);
  }
});

test("the classifier rejects the residue class that was actually found on disk", () => {
  // These two are not hypothetical. Both were sitting in served directories this cycle.
  assert.equal(isSanctionedFeedFile("t_big.tmp"), false, "emitter scratch must never be servable");
  assert.equal(isSanctionedFeedFile(".status.AH0Z.json"), false, "a dotfile draft of the feed must never be servable");

  // And the wider class, so the next variant is caught before it is invented.
  for (const bad of [
    "status.json.bak", "status.json~", "status.part", "status.json.orig",
    ".hidden", ".DS_Store", "emit.log", "status.CANDIDATE.json", "notes.md", "index.html",
    "", null, undefined, 42,
  ]) {
    assert.equal(isSanctionedFeedFile(bad), false, `${String(bad)} must not be servable from a feed directory`);
  }
});

test("every served feed directory contains ONLY sanctioned artefacts", () => {
  let checked = 0;
  const offenders = [];
  for (const rel of FEED_DIRS) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) continue; // a clone may not carry every mirror; absence is not a leak
    checked += 1;
    for (const name of readdirSync(abs)) {
      if (!isSanctionedFeedFile(name)) offenders.push(`${rel}/${name}`);
      // A directory inside the feed dir is residue too — the feed is flat by design.
      else if (statSync(join(abs, name)).isDirectory()) offenders.push(`${rel}/${name} (directory)`);
    }
  }
  assert.ok(checked > 0, "expected at least one served feed directory to exist");
  assert.deepEqual(
    offenders,
    [],
    `these files sit in SERVED URL space and are not sanctioned feed artefacts: ${offenders.join(", ")}`,
  );
});

test("the served mirrors of the feed are byte-identical", () => {
  const present = FEED_DIRS.map((d) => join(ROOT, d, "status.json")).filter((p) => existsSync(p));
  assert.ok(present.length > 0, "expected at least one status.json mirror to exist");
  if (present.length < 2) return; // single-mirror clone: nothing to disagree with
  const digests = present.map((p) => createHash("md5").update(readFileSync(p)).digest("hex"));
  assert.equal(
    new Set(digests).size,
    1,
    `feed mirrors disagree — a visitor would get different answers depending on the path: ${digests.join(" vs ")}`,
  );
});

test("the feed itself parses and carries a real generatedAt", () => {
  for (const rel of FEED_DIRS) {
    const abs = join(ROOT, rel, "status.json");
    if (!existsSync(abs)) continue;
    const feed = JSON.parse(readFileSync(abs, "utf8"));
    assert.equal(typeof feed.generatedAt, "string", `${rel}/status.json must carry generatedAt`);
    assert.ok(
      !Number.isNaN(Date.parse(feed.generatedAt)),
      `${rel}/status.json generatedAt must be a real timestamp, got ${feed.generatedAt}`,
    );
  }
});
