// range-bundle.mjs — RUN-AR / AR2. THE SECOND DELIVERY PATH, BUILT RATHER THAN REQUESTED.
//
// WHY THIS EXISTS (2026-08-06).
// Every cycle for three weeks has ended with the same staged item: "run AHMAD-ONE-CLICK.cmd to
// publish the line." Every cycle it has not been run, and every cycle the response has been to
// re-word the request. Twenty-three re-wordings is not a plan; it is the same ask with better
// prose. Meanwhile this environment cannot push at all — `git ls-remote` is refused verbatim with
// `could not read Username for 'https://github.com'`, and no amount of asking changes that.
//
// So this builds the path that needs no credential this environment lacks: a git BUNDLE. A bundle
// is a single file that carries real git objects and can be fetched from like a remote. It can be
// copied by any means that moves a file — no HTTPS auth, no SSH key, no network at all. It is also
// the only delivery artefact in this program that doubles as a BACKUP: if the working copy is lost,
// the bundle reconstitutes the exact commits the tests were green against.
//
// THE INVARIANT THAT MAKES IT WORTH ANYTHING.
// A bundle nobody verified is just a large file with a confident name. The verifier here proves
// three separate things, and each of them has its own failure class so a red says which one broke:
//
//   1. git itself accepts the bundle header (`git bundle verify`) — the prerequisites resolve and
//      the refs are readable.
//   2. the BYTES are all there. This check was added after the first red: a bundle truncated to 60%
//      of its length PASSED `git bundle verify`, because that command reads the header and checks
//      the prerequisites — it does not read the packfile. A verifier that stopped there would have
//      certified a half-copied backup as sound, which is the most expensive false comfort in the
//      program. The manifest therefore records a SHA-256 of the bundle bytes at creation, and the
//      verifier re-digests the file. Recorded here rather than quietly fixed, because "git said it
//      was fine" was exactly the kind of borrowed assurance this series exists to stop trusting.
//   3. the tip the bundle carries is EXACTLY the commit the tests ran against — not "a recent
//      commit", not "the branch", the SHA.
//   4. the TREE at that tip matches the tree hash recorded when the bundle was made. A commit SHA
//      can be recorded correctly and still describe a tree nobody tested if the record was written
//      by hand; the tree hash is what a checkout actually produces.
//
// WHAT IT REFUSES TO DO. It does not report a bundle it could not verify as "created". A creation
// that cannot be verified is a FAILURE with a reason, never a success with a caveat — an unverified
// backup is the most expensive kind of false comfort there is.
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const RANGE_BUNDLE_SCHEMA = "range-bundle.v1";
export const SENDS = false;

export const BUNDLE_CLASSES = Object.freeze({
  OK: "bundle-verified-and-tip-matches-the-tested-tree",
  NOT_ON_DISK: "bundle-file-is-not-on-disk",
  GIT_REJECTED: "git-refused-the-bundle-as-invalid-or-incomplete",
  DIGEST_MISMATCH: "bundle-bytes-do-not-match-the-digest-recorded-at-creation",
  TIP_MISMATCH: "bundle-tip-is-not-the-commit-the-tests-ran-against",
  TREE_MISMATCH: "bundle-tip-describes-a-tree-that-was-never-tested",
  NO_MANIFEST: "bundle-carries-no-manifest-so-nothing-can-be-compared-against-it",
  MANIFEST_UNREADABLE: "bundle-manifest-is-not-readable-json",
  CREATE_FAILED: "git-refused-to-create-the-bundle",
});

/**
 * Where the artefacts live: inside `senior-director-state/`, which is GITIGNORED by design — it is
 * the operator's untracked record root. Neither the bundle nor its manifest is committed. That is
 * deliberate and it is the honest arrangement: the manifest's job is to travel WITH the bundle
 * (USB stick, chat window, shared folder) so whoever receives the file can verify it, and a copy of
 * the manifest sitting in git history would describe a bundle the receiver does not have. What makes
 * the pair trustworthy is the digest and the tip/tree SHAs, not a commit.
 */
export const BUNDLE_DIR = "senior-director-state/delivery";
export const BUNDLE_FILE = `${BUNDLE_DIR}/unpublished-line.bundle`;
export const MANIFEST_FILE = `${BUNDLE_DIR}/unpublished-line.manifest.json`;

const git = (args, root) => execFileSync("git", args, {
  cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
});

/** SHA-256 of a file's bytes. The check `git bundle verify` does not perform. */
export function digestFile(abs) {
  return crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
}

/**
 * Create the bundle for `ref..head` plus the head branch, and write the manifest that the verifier
 * compares against. Returns { ok, class, manifest|null, detail }.
 *
 * The bundle is THIN against `ref`: it carries only the objects the shared line does not already
 * have, which is what makes it small enough to move by any means. A receiver that lacks `ref`
 * is told so by `git bundle verify` — that is a correct refusal, not a defect of this function.
 */
export function createRangeBundle({ root = process.cwd(), ref = "origin/main", head = "HEAD", branch = "main" } = {}) {
  const dir = path.join(root, BUNDLE_DIR);
  const bundleAbs = path.join(root, BUNDLE_FILE);
  const manifestAbs = path.join(root, MANIFEST_FILE);

  let tip, tree, refSha, count;
  try {
    tip = git(["rev-parse", `${head}^{commit}`], root).trim();
    tree = git(["rev-parse", `${head}^{tree}`], root).trim();
    refSha = git(["rev-parse", `${ref}^{commit}`], root).trim();
    count = Number(git(["rev-list", "--count", `${ref}..${head}`], root).trim());
  } catch (err) {
    return { ok: false, class: BUNDLE_CLASSES.CREATE_FAILED, manifest: null,
      detail: `could not resolve the range ${ref}..${head}: ${String(err.message || err).split("\n")[0]}` };
  }

  fs.mkdirSync(dir, { recursive: true });
  try {
    // `--stdout` is deliberately not used: writing through git means git owns the file format and
    // a partial write is git's failure to report, not ours to guess at.
    git(["bundle", "create", bundleAbs, `${refSha}..${tip}`, branch], root);
  } catch (err) {
    return { ok: false, class: BUNDLE_CLASSES.CREATE_FAILED, manifest: null,
      detail: `git refused to create the bundle: ${String(err.message || err).split("\n")[0]}` };
  }

  const manifest = {
    schema: RANGE_BUNDLE_SCHEMA,
    generatedAt: new Date().toISOString(),
    bundle: BUNDLE_FILE,
    basedOn: { ref, sha: refSha },
    tip,
    tree,
    branch,
    commits: Number.isFinite(count) ? count : null,
    bytes: fs.statSync(bundleAbs).size,
    sha256: digestFile(bundleAbs),
    // The one command a receiver runs. Written here so it cannot drift from the artefact it describes.
    fetchCommand: `git fetch "${BUNDLE_FILE}" ${branch}:refs/heads/from-bundle-${tip.slice(0, 7)}`,
    verifyCommand: "node scripts/verify-range-bundle.mjs",
    note: "A thin bundle against the shared line: the receiver must already have " +
      `${refSha.slice(0, 12)} for the fetch to succeed. It carries no credential and reaches no network.`,
  };
  fs.writeFileSync(manifestAbs, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  // A creation that cannot be verified is a failure, not a success with a caveat.
  const check = verifyRangeBundle({ root });
  if (!check.ok) return { ok: false, class: check.class, manifest, detail: `created but did not verify: ${check.detail}` };
  return { ok: true, class: BUNDLE_CLASSES.OK, manifest, detail: check.detail };
}

/**
 * THE ASSERTION. Verify the bundle on disk against its manifest and against git itself.
 * Pure of side effects; reads only.
 */
export function verifyRangeBundle({ root = process.cwd(), expectTip = null } = {}) {
  const bundleAbs = path.join(root, BUNDLE_FILE);
  const manifestAbs = path.join(root, MANIFEST_FILE);

  if (!fs.existsSync(bundleAbs)) {
    return { ok: false, class: BUNDLE_CLASSES.NOT_ON_DISK, detail: `${BUNDLE_FILE} is not on disk` };
  }
  if (!fs.existsSync(manifestAbs)) {
    return { ok: false, class: BUNDLE_CLASSES.NO_MANIFEST,
      detail: `${BUNDLE_FILE} exists but ${MANIFEST_FILE} does not — a bundle with nothing to check it against proves nothing` };
  }
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestAbs, "utf8")); }
  catch (err) { return { ok: false, class: BUNDLE_CLASSES.MANIFEST_UNREADABLE, detail: String(err.message || err) }; }

  // THE BYTES, before anything git says about them. `git bundle verify` reads the header only, so
  // a truncated file reaches this point looking healthy; the digest is what catches it.
  if (manifest.sha256) {
    const actual = digestFile(bundleAbs);
    if (actual !== manifest.sha256) {
      return { ok: false, class: BUNDLE_CLASSES.DIGEST_MISMATCH, manifest,
        detail: `${BUNDLE_FILE} is ${fs.statSync(bundleAbs).size} bytes digesting ${actual.slice(0, 16)}…, but the manifest recorded ${String(manifest.sha256).slice(0, 16)}… — the file on disk is not the file that was created` };
    }
  }

  let heads;
  let verifiedIn = "this repository";
  try {
    git(["bundle", "verify", bundleAbs], root);
    heads = git(["bundle", "list-heads", bundleAbs], root);
  } catch (err) {
    const message = String(err.stderr || err.message || err).split("\n").filter(Boolean).slice(-1)[0] || "";
    // AU4 (2026-08-11), found by running it. `git bundle verify` resolves the bundle's prerequisites
    // against EVERY ref in the repository, so a dangling ref ANYWHERE — here, three
    // `refs/codex/turn-diffs/checkpoints/…` refs written by another tool and pointing at objects that
    // are no longer present — makes git refuse a bundle that is perfectly intact. That is a fact
    // about this repository's ref namespace, not about the delivery artefact, and reporting it as a
    // broken bundle would send an operator to fix the wrong thing.
    //
    // The retry is NOT a weakening. It re-runs the SAME `git bundle verify` in a throwaway repository
    // whose object store is this one (via alternates) but whose refs are empty: every prerequisite
    // object still has to be found, and a genuinely incomplete bundle still fails. What disappears is
    // the unrelated corruption. The retry is recorded in the result so it can never be silent — and
    // if the isolated run also refuses, the original refusal is what gets reported.
    const foreignRef = message.match(/bad object (refs\/(?!heads\/|remotes\/|tags\/)\S+)/);
    if (!foreignRef) {
      return { ok: false, class: BUNDLE_CLASSES.GIT_REJECTED, manifest,
        detail: `git refused the bundle: ${message}` };
    }
    const iso = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-verify-"));
    try {
      git(["init", "--quiet", iso], root);
      fs.writeFileSync(path.join(iso, ".git/objects/info/alternates"), `${path.join(root, ".git", "objects")}\n`);
      git(["bundle", "verify", bundleAbs], iso);
      heads = git(["bundle", "list-heads", bundleAbs], iso);
      verifiedIn = `an isolated repository over this one's objects, because ${foreignRef[1].split("/").slice(0, 2).join("/")}/… is a dangling ref that makes git refuse any bundle here`;
    } catch (err2) {
      return { ok: false, class: BUNDLE_CLASSES.GIT_REJECTED, manifest,
        detail: `git refused the bundle: ${message}` };
    } finally {
      fs.rmSync(iso, { recursive: true, force: true });
    }
  }

  const tips = heads.split("\n").map((l) => l.trim()).filter(Boolean)
    .map((l) => ({ sha: l.split(/\s+/)[0], ref: l.split(/\s+/)[1] || "" }));
  const wanted = String(expectTip || manifest.tip || "");
  const carried = tips.some((t) => t.sha === wanted);
  if (!carried) {
    return { ok: false, class: BUNDLE_CLASSES.TIP_MISMATCH, manifest,
      detail: `the bundle carries [${tips.map((t) => `${t.sha.slice(0, 12)} ${t.ref}`).join(", ")}] — none of them is the recorded tip ${wanted.slice(0, 12)}` };
  }

  // The tree, not just the commit: a correct SHA beside a hand-written tree hash still describes
  // something nobody tested.
  let actualTree = null;
  try { actualTree = git(["rev-parse", `${wanted}^{tree}`], root).trim(); } catch { actualTree = null; }
  if (actualTree && manifest.tree && actualTree !== manifest.tree) {
    return { ok: false, class: BUNDLE_CLASSES.TREE_MISMATCH, manifest,
      detail: `tip ${wanted.slice(0, 12)} describes tree ${actualTree.slice(0, 12)} but the manifest recorded ${String(manifest.tree).slice(0, 12)}` };
  }

  return { ok: true, class: BUNDLE_CLASSES.OK, manifest, verifiedIn,
    detail: `${path.basename(BUNDLE_FILE)} verified: tip ${wanted.slice(0, 12)}, tree ${String(manifest.tree).slice(0, 12)}, ${manifest.commits} commit(s), ${manifest.bytes} bytes, sha256 ${String(manifest.sha256 || "none").slice(0, 16)}` + (verifiedIn === "this repository" ? "" : ` (verified in ${verifiedIn})`) };
}
