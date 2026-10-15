// F4 2026-10-14 (audit B6 / B13) — THE OTA PUBLISH PATH IS CONSISTENT WITH THE SERVER AND HONEST ABOUT THE HOST.
//
// The deployed publish function keeps `url` + `mandatory` again (lane F1) and refuses a host outside its allow-list
// (iisupp.net, download.iisupp.net, + SENTINEL_UPDATE_HOSTS). The desktop can only fetch from its 6-host allow-list.
// GitHub is on neither — so the publisher must (1) send every field the server reads, (2) upload whichever real
// artifact exists (signed or unsigned, never renamed), (3) accept any https URL the owner hosts the file at, and
// (4) say out loud when a host needs the two allow-list changes instead of failing later with a bare 400.
import assert from "node:assert/strict";
import path from "node:path";
import { buildPublishBody, parseArgs, releaseNotesFor, describeHost, postManifest } from "../scripts/publish-manifest.mjs";
import { collectAssets, releaseAssetUrl, publishRelease } from "../scripts/publish-github-release.mjs";
import { buildLatestYml } from "../src/shared/update-manifest.mjs";

// 1 — the record carries version, url, sha512, size, mandatory, release_notes, release_date, path.
const body = buildPublishBody({ version: "0.2.1", sha512: "c2hh", size: 123, releaseNotes: "notes", mandatory: true, releaseDate: "2026-10-14T00:00:00.000Z", url: "https://download.iisupp.net/sentinel/ARIA-Sentinel-0.2.1-setup.exe", path: "ARIA-Sentinel-0.2.1-setup.exe" });
assert.deepEqual(body, {
  version: "0.2.1", sha512: "c2hh", size: 123, url: "https://download.iisupp.net/sentinel/ARIA-Sentinel-0.2.1-setup.exe",
  release_date: "2026-10-14T00:00:00.000Z", release_notes: "notes", mandatory: true, path: "ARIA-Sentinel-0.2.1-setup.exe"
});
const legacy = buildPublishBody({ version: "0.2.1", sha512: "x", size: 1 });
assert.match(legacy.url, /github\.com.*sentinel-v0\.2\.1\/ARIA-Sentinel-0\.2\.1-unsigned\.exe$/, "without overrides the RUN 23c GitHub url stands (Rule 15)");
assert.equal(legacy.mandatory, false);
assert.equal(legacy.path, undefined);

// 2 — CLI/env parsing: --url / SENTINEL_BINARY_URL, --mandatory / SENTINEL_MANDATORY, GITHUB_RELEASE_REPO, --dry-run.
assert.deepEqual(parseArgs([], {}), { version: null, url: null, mandatory: false, notesFile: null, dryRun: false, releaseRepo: "" });
assert.deepEqual(parseArgs(["0.2.1", "--url", "https://h/x.exe", "--mandatory", "--dry-run", "--notes-file", "docs/RELEASE_NOTES_0.2.1.md"], {}),
  { version: "0.2.1", url: "https://h/x.exe", mandatory: true, notesFile: "docs/RELEASE_NOTES_0.2.1.md", dryRun: true, releaseRepo: "" });
assert.equal(parseArgs(["--url=https://h/y.exe"], {}).url, "https://h/y.exe");
assert.deepEqual(parseArgs(["0.2.1"], { SENTINEL_BINARY_URL: "https://download.iisupp.net/a.exe", SENTINEL_MANDATORY: "1", GITHUB_RELEASE_REPO: "o/r" }),
  { version: "0.2.1", url: "https://download.iisupp.net/a.exe", mandatory: true, notesFile: null, dryRun: false, releaseRepo: "o/r" });

// 3 — release notes: the customer-facing file when present, a one-liner otherwise, never more than the server keeps.
const fakeFs = { readFileSync: (p) => { if (p.endsWith("RELEASE_NOTES_0.2.1.md")) return "# ARIA Sentinel 0.2.1 Release Notes\n" + "x".repeat(5000); throw new Error("ENOENT"); } };
assert.equal(releaseNotesFor("0.2.1", { root: "/r", fsImpl: fakeFs }).length, 4000, "capped at the 4000 chars the server stores");
assert.equal(releaseNotesFor("9.9.9", { root: "/r", fsImpl: fakeFs }), "ARIA Sentinel 9.9.9");
assert.equal(releaseNotesFor("0.2.1", { root: "/r", fsImpl: fakeFs, notesFile: "docs/other.md" }), "ARIA Sentinel 0.2.1", "an explicit missing notes file falls back honestly");

// 4 — the host is described before the POST: allow-listed hosts pass, others name the two changes.
assert.match(describeHost("download.iisupp.net"), /on the desktop allow-list/);
assert.match(describeHost("github.com"), /WARNING/);
assert.match(describeHost("github.com"), /SENTINEL_UPDATE_HOSTS="github\.com"/);
assert.match(describeHost("github.com"), /CAPTURE_HOST_ALLOWLIST/);

// 5 — postManifest: unchanged contract (endpoint, x-admin-token, JSON body); a server refusal surfaces as data.
let captured = null;
const fetchImpl = async (url, opts) => { captured = { url, opts }; return { json: async () => ({ error: "url-host-not-allowed", allowedHosts: ["iisupp.net", "download.iisupp.net"] }) }; };
const out = await postManifest({ base: "https://iisupp.net", token: "t", body, fetchImpl });
assert.equal(out.error, "url-host-not-allowed");
assert.equal(captured.url, "https://iisupp.net/.netlify/functions/aria-sentinel-update-publish");
assert.equal(captured.opts.headers["x-admin-token"], "t");
assert.equal(JSON.parse(captured.opts.body).url, body.url);
assert.equal(JSON.parse(captured.opts.body).mandatory, true);
await assert.rejects(() => postManifest({ token: "", body, fetchImpl }), /ADMIN_TOKEN required/);

// 6 — GitHub release: the uploaded installer is the real artifact (signed preferred), plus blockmap, msi and a
//     latest.yml whose url + path name that artifact; GITHUB_RELEASE_REPO moves the release to another repo.
const files = {
  "ARIA-Sentinel-0.2.1-setup.exe": Buffer.from("exe"), "ARIA-Sentinel-0.2.1-setup.exe.blockmap": Buffer.from("bm"),
  "ARIA-Sentinel-0.2.1-setup.msi": Buffer.from("msi"), "ARIA-Sentinel-0.2.1-unsigned.exe": Buffer.from("old")
};
const distFs = { existsSync: (p) => path.basename(p) in files, readFileSync: (p) => { const b = files[path.basename(p)]; if (!b) throw new Error("ENOENT"); return b; } };
const col = collectAssets({ version: "0.2.1", distDir: "/d", fsImpl: distFs, owner: "integrateditsupp-debug", repo: "aria-sentinel-releases" });
assert.equal(col.signed, true);
assert.equal(col.name, "ARIA-Sentinel-0.2.1-setup.exe");
assert.deepEqual(col.assets.map((a) => a.name), ["ARIA-Sentinel-0.2.1-setup.exe", "latest.yml", "ARIA-Sentinel-0.2.1-setup.exe.blockmap", "ARIA-Sentinel-0.2.1-setup.msi"]);
assert.equal(col.url, "https://github.com/integrateditsupp-debug/aria-sentinel-releases/releases/download/sentinel-v0.2.1/ARIA-Sentinel-0.2.1-setup.exe");
const yml = col.assets[1].content;
assert.match(yml, /- url: https:\/\/github\.com\/integrateditsupp-debug\/aria-sentinel-releases\/releases\/download\/sentinel-v0\.2\.1\/ARIA-Sentinel-0\.2\.1-setup\.exe/, "latest.yml points at the real uploaded file");
assert.match(yml, /^path: ARIA-Sentinel-0\.2\.1-setup\.exe$/m);
assert.equal(yml, buildLatestYml({ version: "0.2.1", sha512: col.sha512, size: 3, url: col.url, release_date: yml.match(/releaseDate: (.*)/)[1], release_notes: "ARIA Sentinel 0.2.1", path: col.name }), "rendered by the shared update-manifest module");
assert.throws(() => collectAssets({ version: "0.3.0", distDir: "/d", fsImpl: distFs }), /no installer for 0\.3\.0/);
assert.equal(releaseAssetUrl({ version: "0.2.1", name: "a.exe" }), "https://github.com/integrateditsupp-debug/iisupp-net-deploy/releases/download/sentinel-v0.2.1/a.exe");
// publishRelease returns the asset url of the installer actually uploaded, under the repo it was sent to.
const calls = [];
const gh = async (url, opts = {}) => {
  calls.push({ url, method: opts.method || "GET" });
  if (/\/releases\/tags\//.test(url)) return { ok: false, status: 404, json: async () => ({}) };
  if (/\/releases$/.test(url)) return { ok: true, status: 201, json: async () => ({ id: 1, html_url: "https://github.com/o/r/releases/tag/sentinel-v0.2.1", assets: [] }) };
  if (/uploads\.github\.com/.test(url)) return { ok: true, status: 201, json: async () => ({ name: decodeURIComponent(url.split("name=")[1]) }) };
  return { ok: false, status: 500, json: async () => ({}) };
};
const pub = await publishRelease({ owner: "o", repo: "r", version: "0.2.1", token: "t", fetchImpl: gh, assets: col.assets });
assert.equal(pub.assetUrl, "https://github.com/o/r/releases/download/sentinel-v0.2.1/ARIA-Sentinel-0.2.1-setup.exe");
assert.deepEqual(pub.uploaded, col.assets.map((a) => a.name));
assert.ok(calls.every((c) => /api\.github\.com\/repos\/o\/r|uploads\.github\.com\/repos\/o\/r/.test(c.url)), "every call targets the chosen repo");

console.log("publish-binary-host test passed (record: version/url/sha512/size/mandatory/notes/date/path · --url & SENTINEL_BINARY_URL · GITHUB_RELEASE_REPO · host advice names SENTINEL_UPDATE_HOSTS + CAPTURE_HOST_ALLOWLIST · real artifact uploaded, latest.yml matches · server refusal surfaced).");
