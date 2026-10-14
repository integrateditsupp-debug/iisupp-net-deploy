// RUN 23c §1 — publish the customer installer to GitHub Releases (free, no size limit that matters, the host electron
// builds conventionally use; Netlify static serving drops a 100 MB file and tracking it in git ships it with every
// deploy). Creates/updates the release tagged `sentinel-v{VERSION}` and uploads the installer + `latest.yml`.
// Idempotent: an existing same-name asset is deleted before re-upload. The GitHub API calls take an injectable fetch
// so the flow is unit-tested without network; the CLI path reads dist + the token and runs for real on-device.
//
// F4 2026-10-14 (audit B6 / B13) —
//   - uploads whichever installer exists: ARIA-Sentinel-<v>-setup.exe (signed) or ARIA-Sentinel-<v>-unsigned.exe, its
//     .blockmap (differential updates) and the .msi when one was built; the latest.yml it writes points at the
//     uploaded file's real name and URL;
//   - GITHUB_RELEASE_REPO="owner/repo" publishes to a different (PUBLIC, releases-only) repo so customer downloads keep
//     working after the source repo goes private — the recommended setup; default stays the source repo;
//   - release body = docs/RELEASE_NOTES_<v>.md when it exists;
//   - token: GITHUB_TOKEN, else GITHUB_TOKEN_FILE, else the historical Cowork PAT path (kept, Rule 15).
// The installer is NEVER copied into the repo or public/ by this script.
// 🔒 R11 — only ever reads the dist installer + version strings; no user path is touched or uploaded.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GITHUB_OWNER, GITHUB_REPO, releaseTag, assetName, githubAssetUrl, buildVersionRecord, isSemver } from "../src/shared/ota-release.mjs";
import { buildLatestYml } from "../src/shared/update-manifest.mjs";
import { findDistArtifacts, parseRepo } from "./release-artifacts.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Cowork PAT location (read ONLY in the CLI path, on-device). Env var wins.
const PAT_FILE = "/sessions/wizardly-charming-knuth/.cowork-github-pat";

export function computeSha512(buffer) {
  return crypto.createHash("sha512").update(buffer).digest("base64"); // electron-updater latest.yml format
}

async function gh(fetchImpl, url, { method = "GET", token, body, contentType } = {}) {
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (contentType) headers["content-type"] = contentType;
  const res = await fetchImpl(url, { method, headers, body });
  const json = res && typeof res.json === "function" ? await res.json().catch(() => ({})) : {};
  return { ok: !!(res && res.ok), status: res && res.status, json };
}

export async function getOrCreateRelease({ owner, repo, version, token, fetchImpl, releaseNotes = "" }) {
  const tag = releaseTag(version);
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const found = await gh(fetchImpl, `${base}/releases/tags/${tag}`, { token });
  if (found.ok && found.json && found.json.id) return found.json;
  const created = await gh(fetchImpl, `${base}/releases`, {
    method: "POST", token, contentType: "application/json",
    body: JSON.stringify({ tag_name: tag, name: `ARIA Sentinel ${version}`, body: releaseNotes, draft: false, prerelease: false })
  });
  if (!created.ok || !created.json || !created.json.id) throw new Error(`create release failed (${created.status})`);
  return created.json;
}

export async function uploadAsset({ owner, repo, release, name, content, contentType, token, fetchImpl }) {
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const existing = (release.assets || []).find((a) => a && a.name === name);
  if (existing) await gh(fetchImpl, `${base}/releases/assets/${existing.id}`, { method: "DELETE", token }); // idempotent
  const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`;
  const up = await gh(fetchImpl, uploadUrl, { method: "POST", token, contentType: contentType || "application/octet-stream", body: content });
  if (!up.ok) throw new Error(`upload ${name} failed (${up.status})`);
  return up.json;
}

/** Download URL of a named asset in `owner/repo`'s release for `version` (the real artifact name, signed or not). */
export function releaseAssetUrl({ version, name, owner = GITHUB_OWNER, repo = GITHUB_REPO }) {
  return `https://github.com/${owner}/${repo}/releases/download/${releaseTag(version)}/${name}`;
}

export async function publishRelease({ owner = GITHUB_OWNER, repo = GITHUB_REPO, version, assets = [], token, fetchImpl, releaseNotes = "" }) {
  if (!token) throw new Error("GitHub token required");
  if (typeof fetchImpl !== "function") throw new Error("fetchImpl required");
  const release = await getOrCreateRelease({ owner, repo, version, token, fetchImpl, releaseNotes });
  const uploaded = [];
  for (const a of assets) uploaded.push(await uploadAsset({ owner, repo, release, name: a.name, content: a.content, contentType: a.contentType, token, fetchImpl }));
  const installer = assets.find((a) => /\.exe$/i.test(a.name));
  return {
    url: release.html_url || release.url || "",
    id: release.id,
    tag: releaseTag(version),
    assetUrl: installer ? releaseAssetUrl({ version, name: installer.name, owner, repo }) : githubAssetUrl(version, owner, repo),
    uploaded: uploaded.map((x) => x && x.name).filter(Boolean)
  };
}

function readToken(env = process.env) {
  if (env.GITHUB_TOKEN) return env.GITHUB_TOKEN.trim();
  for (const f of [env.GITHUB_TOKEN_FILE, PAT_FILE]) {
    if (!f) continue;
    try { return fs.readFileSync(f, "utf8").trim(); } catch { /* next */ }
  }
  return "";
}

/** The assets one release carries, from what dist/ actually holds. PURE given a fs facade. */
export function collectAssets({ version, distDir, fsImpl = fs, owner = GITHUB_OWNER, repo = GITHUB_REPO }) {
  const found = findDistArtifacts(distDir, version, fsImpl);
  if (!found.exe) throw new Error(`no installer for ${version} in ${distDir} (expected ARIA-Sentinel-${version}-setup.exe or ${assetName(version)}) — build first (npm run package:win)`);
  const exeBuf = fsImpl.readFileSync(found.exe);
  const sha512 = computeSha512(exeBuf);
  const size = exeBuf.length;
  const url = releaseAssetUrl({ version, name: found.name, owner, repo });
  const record = buildVersionRecord({ version, sha512, size, owner, repo, releaseDate: new Date().toISOString(), releaseNotes: `ARIA Sentinel ${version}` });
  record.url = url;
  const yml = buildLatestYml({ ...record, path: found.name });
  const assets = [
    { name: found.name, content: exeBuf, contentType: "application/octet-stream" },
    { name: "latest.yml", content: yml, contentType: "text/yaml" }
  ];
  if (found.blockmap) assets.push({ name: path.basename(found.blockmap), content: fsImpl.readFileSync(found.blockmap), contentType: "application/octet-stream" });
  if (found.msi) assets.push({ name: path.basename(found.msi), content: fsImpl.readFileSync(found.msi), contentType: "application/octet-stream" });
  return { assets, sha512, size, signed: found.signed, name: found.name, url };
}

export async function main(version, env = process.env) {
  const v = String(version || JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version);
  if (!isSemver(v)) throw new Error(`bad version "${v}"`);
  const token = readToken(env);
  if (!token) throw new Error("no GitHub token (set GITHUB_TOKEN, GITHUB_TOKEN_FILE, or provide the Cowork PAT file)");
  const [owner, repo] = parseRepo(env.GITHUB_RELEASE_REPO);
  const { assets, sha512, size, signed, name, url } = collectAssets({ version: v, distDir: path.join(ROOT, "dist"), owner, repo });
  let notes = `ARIA Sentinel ${v}`;
  try { notes = fs.readFileSync(path.join(ROOT, "docs", `RELEASE_NOTES_${v}.md`), "utf8"); } catch { /* one-liner */ }
  const result = await publishRelease({ owner, repo, version: v, token, fetchImpl: fetch, releaseNotes: notes, assets });
  console.error(`[publish-github-release] ${result.tag} → ${result.url}\n  ${signed ? "SIGNED" : "UNSIGNED"} ${name}\n  asset=${url}\n  sha512=${sha512}\n  size=${size}\n  uploaded=${result.uploaded.join(", ")}`);
  process.stdout.write(`RELEASE_URL=${result.url}\nASSET_URL=${url}\nSHA512=${sha512}\nSIZE=${size}\nSIGNED=${signed ? 1 : 0}\n`);
  return { ...result, sha512, size, signed, name };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2]).catch((err) => { console.error(`[publish-github-release] FAILED: ${err.message}`); process.exit(1); });
}
