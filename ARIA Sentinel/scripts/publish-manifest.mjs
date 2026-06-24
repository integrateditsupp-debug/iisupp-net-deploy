// RUN 23c §7b — publish the update MANIFEST after the GitHub Release is up. Computes sha512 + size of the
// dist .exe, builds the version record (with the GitHub Releases URL), and POSTs it to the existing
// /aria-sentinel-update-publish admin endpoint (X-Admin-Token). The Blobs "versions" index is the source of
// truth the per-license manifest function reads. Injectable fetch for tests; CLI runs for real on-device.
// 🔒 R11 — only the dist .exe + version strings are read; nothing user-pathed leaves the machine.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assetName, buildVersionRecord } from "../src/shared/ota-release.mjs";
import { computeSha512 } from "./publish-github-release.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.IISUPP_BASE || "https://iisupp.net";

export function buildPublishBody({ version, sha512, size, releaseNotes = "", mandatory = false, releaseDate } = {}) {
  return buildVersionRecord({ version, sha512, size, releaseNotes, mandatory, releaseDate: releaseDate || new Date().toISOString() });
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

export async function main(version) {
  const v = String(version || JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version);
  const token = process.env.SENTINEL_ADMIN_TOKEN || "";
  const exeBuf = fs.readFileSync(path.join(ROOT, "dist", assetName(v)));
  const body = buildPublishBody({ version: v, sha512: computeSha512(exeBuf), size: exeBuf.length, releaseNotes: `ARIA Sentinel ${v}` });
  const out = await postManifest({ token, body, fetchImpl: fetch });
  console.error(`[publish-manifest] published v${v}: ${JSON.stringify(out)}`);
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2]).catch((err) => { console.error(`[publish-manifest] FAILED: ${err.message}`); process.exit(1); });
}
