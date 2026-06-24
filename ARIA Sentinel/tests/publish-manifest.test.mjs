// RUN 23c §7b — manifest publisher: builds the version record (with GitHub url) and POSTs it to the admin
// publish endpoint with the X-Admin-Token. Injected fetch records the request.
import assert from "node:assert/strict";
import { buildPublishBody, postManifest } from "../scripts/publish-manifest.mjs";

// Body carries the GitHub url + sha512 + size.
const body = buildPublishBody({ version: "0.1.4", sha512: "deadbeef", size: 102536604, releaseNotes: "RUN 23c", mandatory: false });
assert.equal(body.version, "0.1.4");
assert.equal(body.sha512, "deadbeef");
assert.equal(body.size, 102536604);
assert.match(body.url, /github\.com.*sentinel-v0\.1\.4\/ARIA-Sentinel-0\.1\.4-unsigned\.exe/);
assert.ok(body.release_date, "release_date defaulted");

// POST shape: endpoint + x-admin-token + JSON body.
let captured = null;
const fetchImpl = async (url, opts) => { captured = { url, opts }; return { json: async () => ({ ok: true, published: "0.1.4" }) }; };
const out = await postManifest({ base: "https://iisupp.net", token: "secret", body, fetchImpl });
assert.equal(out.ok, true);
assert.equal(captured.url, "https://iisupp.net/.netlify/functions/aria-sentinel-update-publish");
assert.equal(captured.opts.method, "POST");
assert.equal(captured.opts.headers["x-admin-token"], "secret");
assert.equal(JSON.parse(captured.opts.body).version, "0.1.4");

// No token → refuse (never publishes anonymously).
await assert.rejects(() => postManifest({ token: "", body, fetchImpl }), /ADMIN_TOKEN required/);

console.log("Publish-manifest test passed (record with GitHub url · POST to update-publish · admin-token required).");
