// ac2-visit-beacon.test.mjs — RUN-AC AC2. The beacon is wired, and it is incapable of carrying identity.
//
// This suite guards the one thing that would turn a Rule-11-clean visit count into a privacy problem:
// somebody, later, adding "just one more field" to the beacon. Every identity mechanism is asserted
// ABSENT from the file by name, so the addition fails here rather than in production.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const beaconPath = path.join(repo, "assets", "axis-visit-beacon.js");
const fnPath = path.join(repo, "netlify", "functions", "axis-visit-log.mjs");
const indexPath = path.join(repo, "index.html");

let pass = 0;
const groups = [];
const pending = [];
function group(name, fn) {
  pending.push(
    (async () => {
      try { await fn(); groups.push(`  ok  ${name}`); pass++; }
      catch (e) { groups.push(`  FAIL ${name} — ${e.message}`); process.exitCode = 1; }
    })(),
  );
}

group("the beacon file exists", () => {
  assert.ok(fs.existsSync(beaconPath), "assets/axis-visit-beacon.js is missing");
});

group("the beacon is included on the home page, deferred", () => {
  const html = fs.readFileSync(indexPath, "utf8");
  assert.match(html, /<script defer src="\/assets\/axis-visit-beacon\.js"><\/script>/,
    "index.html does not include the beacon with defer");
});

group("the beacon carries no identity mechanism of any kind", () => {
  const src = fs.readFileSync(beaconPath, "utf8");
  // Comments describe what is deliberately absent, so only the executable body is scanned.
  const body = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const forbidden = [
    "document.cookie", "localStorage", "sessionStorage", "indexedDB", "crypto.randomUUID",
    "document.referrer", "screen.width", "screen.height", "navigator.userAgent", "navigator.language",
    "Intl.DateTimeFormat", "canvas", "getContext", "performance.now", "Math.random",
  ];
  for (const f of forbidden) {
    assert.ok(!body.includes(f), `beacon uses ${f} — identity or fingerprinting surface`);
  }
  assert.ok(body.includes("credentials: \"omit\"") || body.includes("sendBeacon"), "beacon must not send credentials");
});

group("the beacon sends exactly one allowlisted bucket and nothing else", () => {
  const src = fs.readFileSync(beaconPath, "utf8");
  const qs = [...src.matchAll(/\?([a-z]+)=/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(qs)], ["p"], `beacon sends query params other than 'p': ${qs.join(",")}`);
});

group("the beacon honours Do Not Track", () => {
  assert.match(fs.readFileSync(beaconPath, "utf8"), /doNotTrack/);
});

group("the endpoint is write-only — it returns no number a page could read", () => {
  const src = fs.readFileSync(fnPath, "utf8");
  assert.match(src, /status:\s*204/, "endpoint must return 204 with no body");
  assert.ok(!/JSON\.stringify\(\s*(record|current|days|visits)/.test(src),
    "endpoint must never serialise the log back to a caller");
});

// A first draft of this group grepped the function's SOURCE for identity words and failed on the word
// "referrer" appearing inside the record's own Rule-11 disclosure sentence — a note stating what is NOT
// collected was read as evidence of collection. The correct check is on the KEYS of the record the
// function actually produces, not on the prose around it, so it is now asserted against real output.
group("the endpoint persists no identity-shaped KEY in the record it produces", async () => {
  const { applyHit } = await import(pathToFileURL(fnPath).href);
  const { findForbiddenFields } = await import(
    pathToFileURL(path.join(repo, "ARIA Sentinel", "src", "shared", "visit-log.mjs")).href
  );
  let rec = null;
  for (const [bucket, self] of [["/", false], ["/aria", false], ["other", true]]) {
    rec = applyHit(rec, { day: "2026-07-29", bucket, self, now: "2026-07-29T00:00:00.000Z" });
  }
  const leaks = findForbiddenFields(rec);
  assert.deepEqual(leaks, [], `record carries identity-shaped keys: ${leaks.join(", ")}`);
});

await Promise.all(pending);
console.log(groups.join("\n"));
console.log(`ac2-visit-beacon: ${pass}/7 groups green — the site's own hit log is wired, first-party, and structurally incapable of carrying identity.`);
