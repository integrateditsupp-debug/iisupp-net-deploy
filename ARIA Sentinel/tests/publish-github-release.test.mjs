// RUN 23c §1 — GitHub Releases publisher. sha512 calc, create-or-reuse release, idempotent asset replace,
// and the two-asset upload (exe + latest.yml). Network is a fake fetch that records calls.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { computeSha512, getOrCreateRelease, uploadAsset, publishRelease } from "../scripts/publish-github-release.mjs";

// Deterministic base64 sha512.
assert.equal(computeSha512(Buffer.from("hello")), computeSha512(Buffer.from("hello")));
assert.match(computeSha512(Buffer.from("x")), /^[A-Za-z0-9+/]+=*$/);

// A scriptable fake GitHub API.
function fakeGitHub({ tagExists = false, release = { id: 7, html_url: "https://github.com/o/r/releases/tag/sentinel-v0.1.1", assets: [] } } = {}) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || "GET" });
    if (/\/releases\/tags\//.test(url)) return { ok: tagExists, status: tagExists ? 200 : 404, json: async () => (tagExists ? release : {}) };
    if (/\/releases$/.test(url) && opts.method === "POST") return { ok: true, status: 201, json: async () => release };
    if (/\/releases\/assets\/\d+/.test(url) && opts.method === "DELETE") return { ok: true, status: 204, json: async () => ({}) };
    if (/uploads\.github\.com/.test(url)) { const name = decodeURIComponent(url.split("name=")[1]); return { ok: true, status: 201, json: async () => ({ name }) }; }
    return { ok: false, status: 500, json: async () => ({}) };
  };
  return { fetchImpl, calls };
}

// Create a new release when the tag doesn't exist.
let gh = fakeGitHub({ tagExists: false });
let rel = await getOrCreateRelease({ owner: "o", repo: "r", version: "0.1.1", token: "t", fetchImpl: gh.fetchImpl });
assert.equal(rel.id, 7);
assert.ok(gh.calls.some((c) => /\/releases$/.test(c.url) && c.method === "POST"), "POST creates the release");

// Reuse an existing release (no create POST).
gh = fakeGitHub({ tagExists: true });
rel = await getOrCreateRelease({ owner: "o", repo: "r", version: "0.1.1", token: "t", fetchImpl: gh.fetchImpl });
assert.ok(!gh.calls.some((c) => /\/releases$/.test(c.url) && c.method === "POST"), "existing tag is reused");

// Idempotent upload: a same-name asset is DELETEd before re-upload.
gh = fakeGitHub({ tagExists: true, release: { id: 9, html_url: "u", assets: [{ id: 55, name: "latest.yml" }] } });
await uploadAsset({ owner: "o", repo: "r", release: { id: 9, assets: [{ id: 55, name: "latest.yml" }] }, name: "latest.yml", content: "x", token: "t", fetchImpl: gh.fetchImpl });
assert.ok(gh.calls.some((c) => /\/releases\/assets\/55/.test(c.url) && c.method === "DELETE"), "stale asset deleted first");

// Full publish: uploads both assets, returns url + tag + asset url.
gh = fakeGitHub({ tagExists: false });
const out = await publishRelease({
  owner: "integrateditsupp-debug", repo: "iisupp-net-deploy", version: "0.1.1", token: "t", fetchImpl: gh.fetchImpl,
  assets: [{ name: "ARIA-Sentinel-0.1.1-unsigned.exe", content: "exe" }, { name: "latest.yml", content: "yml" }]
});
assert.equal(out.tag, "sentinel-v0.1.1");
assert.deepEqual(out.uploaded, ["ARIA-Sentinel-0.1.1-unsigned.exe", "latest.yml"]);
assert.match(out.assetUrl, /github\.com\/integrateditsupp-debug\/iisupp-net-deploy\/releases\/download\/sentinel-v0\.1\.1/);

// Guards.
await assert.rejects(() => publishRelease({ version: "0.1.1", fetchImpl: gh.fetchImpl, assets: [] }), /token required/);
await assert.rejects(() => publishRelease({ version: "0.1.1", token: "t", assets: [] }), /fetchImpl required/);

console.log("Publish-github-release test passed (sha512 · create/reuse release · idempotent asset replace · 2-asset upload · guards).");
