// netlify-health-redirect.test.mjs — /health must reach the health function, and must do so BEFORE
// any rule that could swallow it.
//
// RUN-CU 2026-10-09 (small-tasks close-out, task 1): the ARIA morning agent and the uptime checks
// probe https://iisupp.net/health. netlify.toml had rules for /health-check (the lead-magnet page)
// and the function itself lived only at /.netlify/functions/health, so the short path answered 404
// and the agent has reported the site DEGRADED off the wrong path (reported since 2026-07-28).
// The fix is one rewrite (status 200, not a 301 — the probe wants the function's JSON body, not a
// hop). This guard reads netlify.toml as text (the same way root-serving-gate does) and asserts:
//   1. the rule exists, is a rewrite to the function, and is not force-404'd;
//   2. it sits ABOVE every force-404 / 404 rule — Netlify takes the first matching rule, so a rule
//      that only wins by luck of ordering is a rule that stops winning in the next merge;
//   3. the function it points at exists and still answers with a JSON body.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const toml = readFileSync(join(ROOT, "netlify.toml"), "utf8");

/** Split netlify.toml into its [[redirects]] stanzas, in file order, with the offset of each. */
function redirectStanzas(src) {
  const out = [];
  const re = /\[\[redirects\]\]/g;
  let m;
  const starts = [];
  while ((m = re.exec(src))) starts.push(m.index);
  for (let i = 0; i < starts.length; i++) {
    // A commented-out `# [[redirects]]` block (the HELD installer rule) is prose, not a rule.
    const lineStart = src.lastIndexOf("\n", starts[i]) + 1;
    if (src.slice(lineStart, starts[i]).trim().startsWith("#")) continue;
    const body = src.slice(starts[i], i + 1 < starts.length ? starts[i + 1] : src.length)
      .split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
    const field = (k) => (body.match(new RegExp(`^\\s*${k}\\s*=\\s*"?([^"\\n]*)"?`, "m")) || [])[1]?.trim();
    out.push({ offset: starts[i], from: field("from"), to: field("to"), status: field("status"), force: field("force") === "true" });
  }
  return out;
}

const stanzas = redirectStanzas(toml);
const health = stanzas.filter((s) => s.from === "/health");

test("exactly one /health rule exists and it is a 200 rewrite to the health function", () => {
  assert.equal(health.length, 1, `expected one /health rule, found ${health.length}`);
  const [rule] = health;
  assert.equal(rule.to, "/.netlify/functions/health");
  assert.equal(rule.status, "200", "a rewrite, not a redirect — the probe wants the JSON body on the short path");
  assert.equal(rule.force, false, "no force needed: nothing physically lives at /health");
});

test("the /health rule is above every 404 rule, so ordering can never swallow it", () => {
  const [rule] = health;
  const firstNotFound = stanzas.find((s) => s.status === "404");
  assert.ok(firstNotFound, "netlify.toml is expected to carry the force-404 lockdown block");
  assert.ok(rule.offset < firstNotFound.offset, `/health (offset ${rule.offset}) must precede the first 404 rule (${firstNotFound.from} at ${firstNotFound.offset})`);
});

test("/health-check (the lead-magnet page) is a different, exact-match rule and is untouched", () => {
  const page = stanzas.filter((s) => s.from === "/health-check");
  assert.equal(page.length, 1);
  assert.equal(page[0].to, "/health-check.html");
});

test("the health function the rule points at exists and returns a JSON body", async () => {
  const file = join(ROOT, "netlify/functions/health.js");
  assert.ok(existsSync(file), "netlify/functions/health.js is missing");
  const { createRequire } = await import("node:module");
  const fn = createRequire(import.meta.url)(file);
  const res = await fn.handler({ httpMethod: "GET" });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-type"], /application\/json/);
  const body = JSON.parse(res.body);
  assert.equal(body.status, "ok");
  assert.equal(body.service, "ARIA");
});
