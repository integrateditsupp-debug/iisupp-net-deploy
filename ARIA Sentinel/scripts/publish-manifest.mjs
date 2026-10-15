// RUN 23c §7b — publish the update MANIFEST after the installer is hosted. Computes sha512 + size of the dist
// installer, builds the version record and POSTs it to the /aria-sentinel-update-publish admin endpoint
// (X-Admin-Token). The Blobs "versions" index is the source of truth the per-license manifest function reads.
//
// F4 2026-10-14 (audit B13 / B20) — honest binary host:
//   - the record always carries version, url, sha512, size, mandatory, release_notes, release_date and path (the
//     deployed publish function keeps `url` + `mandatory` again and the desktop reads the device credential from the
//     x-sentinel-key header — lane F1);
//   - the installer is whichever artifact exists in dist/ — ARIA-Sentinel-<v>-setup.exe (signed) or
//     ARIA-Sentinel-<v>-unsigned.exe — never a renamed one;
//   - the binary URL is, in order: --url / SENTINEL_BINARY_URL (any https URL the owner hosts the file at, e.g. a future
//     https://download.iisupp.net/…), else the GitHub Release of GITHUB_RELEASE_REPO (owner/repo; a PUBLIC releases-only
//     repo keeps downloads alive after the source repo goes private), else the source repo's release;
//   - a host outside the desktop's allow-list / the server's default is published only with a printed warning that
//     names the two changes it needs (SENTINEL_UPDATE_HOSTS on Netlify; CAPTURE_HOST_ALLOWLIST + test on the desktop).
//     Installers are NOT committed to git and never copied under public/ by this script.
//   - release notes default to docs/RELEASE_NOTES_<v>.md (customer-facing) when it exists.
// Injectable fetch for tests; CLI runs for real on-device. 🔒 R11 — only the dist installer + version strings are read.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assetName, buildVersionRecord, isSemver } from "../src/shared/ota-release.mjs";
import { computeSha512 } from "./publish-github-release.mjs";
import { findDistArtifacts, resolveBinaryUrl, hostAdvice } from "./release-artifacts.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.IISUPP_BASE || "https://iisupp.net";

/**
 * The record POSTed to the publish endpoint. `url` (explicit https) and `path` (the artifact file name) are optional
 * overrides; without them the record points at the GitHub Release asset exactly as RUN 23c did.
 */
export function buildPublishBody({ version, sha512, size, releaseNotes = "", mandatory = false, releaseDate, url, path: artifactPath } = {}) {
  const rec = buildVersionRecord({ version, sha512, size, releaseNotes, mandatory, releaseDate: releaseDate || new Date().toISOString() });
  if (url) rec.url = String(url);
  if (artifactPath) rec.path = String(artifactPath);
  return rec;
}

export async function postManifest({ base = BASE, token, body, fetchImpl }) {
  if (!token) throw new Error("SENTINEL_ADMIN_TOKEN required to publish the manifest");
  const res = await fetchImpl(`${base}/.netlify/functions/aria-sentinel-update-publish`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": token },
    body: JSON.stringify(body)
  });
  return res && typeof res.json === "function" ? res.json() : res;
}

/** Parse the CLI: `publish-manifest.mjs [version] [--url https://…] [--mandatory] [--notes-file <path>] [--dry-run]`. PURE. */
export function parseArgs(argv = [], env = {}) {
  const out = { version: null, url: env.SENTINEL_BINARY_URL || null, mandatory: env.SENTINEL_MANDATORY === "1", notesFile: null, dryRun: false, releaseRepo: env.GITHUB_RELEASE_REPO || "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") out.url = argv[++i] || null;
    else if (a.startsWith("--url=")) out.url = a.slice(6);
    else if (a === "--mandatory") out.mandatory = true;
    else if (a === "--notes-file") out.notesFile = argv[++i] || null;
    else if (a.startsWith("--notes-file=")) out.notesFile = a.slice(13);
    else if (a === "--dry-run") out.dryRun = true;
    else if (!a.startsWith("--") && !out.version) out.version = a;
  }
  return out;
}

/** Customer-facing notes for the record: docs/RELEASE_NOTES_<v>.md when present, else a one-liner. */
export function releaseNotesFor(version, { root = ROOT, notesFile = null, fsImpl = fs } = {}) {
  const candidate = notesFile ? path.resolve(root, notesFile) : path.join(root, "docs", `RELEASE_NOTES_${version}.md`);
  try { return fsImpl.readFileSync(candidate, "utf8").slice(0, 4000); } catch { return `ARIA Sentinel ${version}`; }
}

/** What the server will say about this host — printed before the POST so a refusal is never a surprise. */
export function describeHost(host) {
  const a = hostAdvice(host);
  return a.ok ? `[publish-manifest] host ${host}: ${a.note}` : `[publish-manifest] WARNING — ${a.note}`;
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const opts = parseArgs(argv, env);
  const v = String(opts.version || JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version);
  if (!isSemver(v)) throw new Error(`bad version "${v}"`);
  const token = env.SENTINEL_ADMIN_TOKEN || "";
  const found = findDistArtifacts(path.join(ROOT, "dist"), v, fs);
  if (!found.exe) throw new Error(`no installer for ${v} in dist/ (expected ARIA-Sentinel-${v}-setup.exe or ${assetName(v)}) — build first (npm run package:win)`);
  const exeBuf = fs.readFileSync(found.exe);
  const target = resolveBinaryUrl({ version: v, artifact: found.name, explicitUrl: opts.url, releaseRepo: opts.releaseRepo });
  const body = buildPublishBody({
    version: v, sha512: computeSha512(exeBuf), size: exeBuf.length, mandatory: opts.mandatory,
    releaseNotes: releaseNotesFor(v, { notesFile: opts.notesFile }), url: target.url, path: found.name
  });
  console.error(`[publish-manifest] v${v} · ${found.signed ? "SIGNED" : "UNSIGNED"} artifact ${found.name} · ${exeBuf.length} bytes · url ${target.url} (${target.source})`);
  console.error(describeHost(target.host));
  if (opts.dryRun) { process.stdout.write(JSON.stringify(body, null, 2) + "\n"); return body; }
  const out = await postManifest({ base: env.IISUPP_BASE || BASE, token, body, fetchImpl: fetch });
  if (out && out.error === "url-host-not-allowed") {
    throw new Error(`the server refused the binary host ${target.host} (allowed: ${(out.allowedHosts || []).join(", ")}). Set SENTINEL_UPDATE_HOSTS="${target.host}" in the Netlify environment (Site settings → Environment variables), redeploy, and run this again.`);
  }
  if (out && out.error) throw new Error(`publish refused: ${out.error}`);
  console.error(`[publish-manifest] published v${v}: ${JSON.stringify(out)}`);
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(`[publish-manifest] FAILED: ${err.message}`); process.exit(1); });
}
