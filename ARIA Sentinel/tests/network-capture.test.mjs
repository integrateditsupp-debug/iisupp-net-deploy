// RUN 3 — privacy verifier network-capture analysis.
// Mocks a webRequest.onBeforeRequest listener, feeds it the declared pulls + an exfil attempt, and
// asserts the analysis: every legitimate request is on the 6-host allowlist, every payload is
// content-blind, and a disallowed host / leaking payload is caught. 0 disallowed hosts on the clean run.
import assert from "node:assert/strict";
import {
  CAPTURE_HOST_ALLOWLIST,
  EXPECTED_OUTBOUND_PATHS,
  hostAllowed,
  classifyRequest,
  summarizeCapture
} from "../src/shared/network-capture.mjs";

// 1) The allowlist is exactly six hosts; the verifier shows the three declared GET pulls.
assert.equal(CAPTURE_HOST_ALLOWLIST.length, 6, "6-host allowlist");
assert.equal(EXPECTED_OUTBOUND_PATHS.length, 3, "three declared outbound GET paths (the cyan-tick rows)");
for (const p of EXPECTED_OUTBOUND_PATHS) assert.equal(p.method, "GET");

// 2) Host matching: iisupp.net (+ subdomains), loopback and *.service-now.com pass; anything else fails.
assert.equal(hostAllowed("iisupp.net"), true);
assert.equal(hostAllowed("download.iisupp.net"), true);
assert.equal(hostAllowed("127.0.0.1"), true);
assert.equal(hostAllowed("localhost"), true);
assert.equal(hostAllowed("acme.service-now.com"), true);
assert.equal(hostAllowed("evil.com"), false);
assert.equal(hostAllowed("iisupp.net.evil.com"), false, "suffix spoof is not allowed");

// 3) A mock webRequest listener that mirrors session.webRequest.onBeforeRequest((details, cb) => …).
//    The handler records each request and calls back to allow it — exactly as main.mjs does.
function mockWebRequest() {
  let handler = null;
  const captured = [];
  return {
    onBeforeRequest: (fn) => { handler = fn; },
    fire: (details) => handler && handler(details, () => {}),
    captured
  };
}
const wr = mockWebRequest();
wr.onBeforeRequest((details, cb) => { wr.captured.push({ url: details.url, method: details.method, body: details.body }); cb({}); });
for (const p of EXPECTED_OUTBOUND_PATHS) wr.fire({ url: `https://${p.host}${p.path}`, method: p.method });

const cleanSummary = summarizeCapture(wr.captured);
assert.equal(cleanSummary.rows.length, 3, "three captured rows");
assert.equal(cleanSummary.disallowedHostCount, 0, "0 disallowed hosts on the clean run");
assert.equal(cleanSummary.leakingPayloadCount, 0, "0 leaking payloads");
assert.equal(cleanSummary.userContentRequests, 0, "0 user-content requests");
assert.equal(cleanSummary.pass, true, "clean capture passes");
for (const row of cleanSummary.rows) {
  assert.equal(row.allowlistMatch, true);
  assert.equal(row.payloadBytes, 0, "GET pulls carry no payload");
  assert.equal(row.sanitizationStatus, "none");
}

// 4) An allow-listed POST that carries only symbolic, content-blind fields passes the payload check.
const feedback = classifyRequest({
  url: "https://iisupp.net/.netlify/functions/aria-recipe-feedback",
  method: "POST",
  body: JSON.stringify({ recipe_id: "dns-fail-v1", outcome: "applied", ts: "2026-06-19T10:00:00Z" })
});
assert.equal(feedback.allowlistMatch, true);
assert.equal(feedback.sanitizationStatus, "clean", "symbolic-only payload is content-blind");

// 5) An exfil attempt — disallowed host AND a payload carrying user content — is caught.
const exfil = summarizeCapture([
  { url: "https://evil.com/collect", method: "POST", body: JSON.stringify({ note: "email user@example.com about C:\\Users\\jdoe\\secret.docx" }) }
]);
assert.equal(exfil.disallowedHostCount, 1, "off-allowlist host flagged");
assert.equal(exfil.leakingPayloadCount, 1, "leaking payload flagged");
assert.equal(exfil.userContentRequests, 1, "user content detected");
assert.equal(exfil.pass, false, "exfil capture fails the verdict");

// 6) Mixed capture: 3 clean pulls + 1 exfil → still exactly 1 disallowed.
const mixed = summarizeCapture([
  ...wr.captured,
  { url: "https://evil.com/x", method: "POST", body: "user@example.com" }
]);
assert.equal(mixed.disallowedHostCount, 1);
assert.equal(mixed.allHostsAllowed, false);

// RUN 14 — the update path-allowlist grew by EXACTLY two; nothing else from iisupp.net passes it.
import { isUpdatePathAllowed, UPDATE_OUTBOUND_PATHS } from "../src/shared/network-capture.mjs";
assert.equal(UPDATE_OUTBOUND_PATHS.length, 2, "exactly +2 update paths");
assert.equal(isUpdatePathAllowed("/.netlify/functions/aria-sentinel-update-manifest"), true);
assert.equal(isUpdatePathAllowed("/sentinel-binaries/ARIA-Sentinel-0.1.1-unsigned.exe"), true);
assert.equal(isUpdatePathAllowed("/.netlify/functions/aria-recipes"), false, "other iisupp.net path not an update path");
assert.equal(isUpdatePathAllowed("/sentinel-admin/"), false);
// The 6-host telemetry verifier itself is unchanged, and still only the 3 declared GET pulls show.
assert.equal(CAPTURE_HOST_ALLOWLIST.length, 6, "6-host verifier untouched");
assert.equal(EXPECTED_OUTBOUND_PATHS.length, 3, "still 3 declared cyan-tick pulls (update channel is separate)");

// RUN 24 — the license revocation path-allowlist grew by EXACTLY one; nothing else from iisupp.net passes
// it, and the 6-host telemetry verifier is STILL unchanged (additive path class, like update + brain).
import { isLicensePathAllowed, LICENSE_OUTBOUND_PATHS } from "../src/shared/network-capture.mjs";
assert.equal(LICENSE_OUTBOUND_PATHS.length, 1, "exactly +1 license path");
assert.equal(isLicensePathAllowed("/.netlify/functions/sentinel-licenses"), true);
assert.equal(isLicensePathAllowed("/.netlify/functions/aria-chat"), false, "other iisupp.net path is not a license path");
assert.equal(isLicensePathAllowed("/sentinel-admin/"), false);
assert.equal(CAPTURE_HOST_ALLOWLIST.length, 6, "6-host verifier still untouched after the license class");

console.log(`Network-capture test passed (6-host allowlist, ${EXPECTED_OUTBOUND_PATHS.length} declared pulls, +2 update / +1 license paths only, exfil + leak caught).`);
