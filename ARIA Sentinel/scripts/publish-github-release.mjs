// RUN 23c §1 — publish the customer .exe to GitHub Releases (the industry-standard host for electron
// builds; replaces Netlify static serving, which drops the 98MB file). Creates/updates the release tagged
// `sentinel-v{VERSION}` and uploads `ARIA-Sentinel-{VERSION}-unsigned.exe` + `latest.yml`. Idempotent: an
// existing same-name asset is deleted before re-upload. The GitHub API calls take an injectable fetch so the
// flow is unit-tested without network; the CLI path reads dist + the PAT and runs for real on-device.
// 🔒 R11 — only ever reads the signed dist .exe + version strings; no user path is touched or uploaded.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GITHUB_OWNER, GITHUB_REPO, releaseTag, assetName, githubAssetUrl, buildVersionRecord } from "../src/shared/ota-release.mjs";
import { buildLatestYml } from "../src/shared/update-manifest.mjs";

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

export async function publishRelease({ owner = GITHUB_OWNER, repo = GITHUB_REPO, version, assets = [], token, fetchImpl, releaseNotes = "" }) {
  if (!token) throw new Error("GitHub token required");
  if (typeof fetchImpl !== "function") throw new Error("fetchImpl required");
  const release = await getOrCreateRelease({ owner, repo, version, token, fetchImpl, releaseNotes });
  const uploaded = [];
  for (const a of assets) uploaded.push(await uploadAsset({ owner, repo, release, name: a.name, content: a.content, contentType: a.contentType, token, fetchImpl }));
  return { url: release.html_url || release.url || "", id: release.id, tag: releaseTag(version), assetUrl: githubAssetUrl(version, owner, repo), uploaded: uploaded.map((x) => x && x.name).filter(Boolean) };
}

function readToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  try { return fs.readFileSync(PAT_FILE, "utf8").trim(); } catch { return ""; }
}

export async function main(version) {
  const v = String(version || JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version);
  const token = readToken();
  if (!token) throw new Error("no GitHub token (set GITHUB_TOKEN or provide the Cowork PAT file)");
  const exePath = path.join(ROOT, "dist", assetName(v));
  const exeBuf = fs.readFileSync(exePath);
  const sha512 = computeSha512(exeBuf);
  const size = exeBuf.length;
  const record = buildVersionRecord({ version: v, sha512, size, releaseDate: new Date().toISOString(), releaseNotes: `ARIA Sentinel ${v}` });
  const yml = buildLatestYml({ ...record, path: assetName(v) });
  const result = await publishRelease({
    version: v, token, fetchImpl: fetch, releaseNotes: record.release_notes,
    assets: [
      { name: assetName(v), content: exeBuf, contentType: "application/octet-stream" },
      { name: "latest.yml", content: yml, contentType: "text/yaml" }
    ]
  });
  console.error(`[publish-github-release] ${result.tag} → ${result.url}\n  sha512=${sha512}\n  size=${size}`);
  process.stdout.write(`RELEASE_URL=${result.url}\nSHA512=${sha512}\nSIZE=${size}\n`);
  return { ...result, sha512, size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2]).catch((err) => { console.error(`[publish-github-release] FAILED: ${err.message}`); process.exit(1); });
}
