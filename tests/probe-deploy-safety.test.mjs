#!/usr/bin/env node
// SERVING-LAYER LOCKDOWN 2026-07-02 — probe logic: PASS only on a genuine serving-layer refusal;
// any 2xx / internal content-type / internal marker / unexpected status FAILS; probes cache-bust;
// alerts are content-blind (no response bodies). Injected fetch — nothing hits the network.
import assert from "node:assert/strict";
import { classifyProbe, runProbes, alertArtifacts, DENYLIST_PROBES, DEFAULT_BASE_URL } from "../scripts/probe-deploy-safety.mjs";

const html404 = "<!DOCTYPE html><html><head><title>Integrated IT Support</title></head><body>site</body></html>";

// 1 — classifier: the force-404 → index.html shape passes; every leak shape fails.
assert.deepEqual(classifyProbe({ status: 404, contentType: "text/html; charset=UTF-8", body: html404 }), { ok: true, reason: "refused-404" });
assert.equal(classifyProbe({ status: 200, contentType: "text/html", body: html404 }).ok, false, "2xx is never a pass");
assert.equal(classifyProbe({ status: 404, contentType: "text/markdown", body: "" }).ok, false, "markdown content-type fails even on 404");
assert.equal(classifyProbe({ status: 404, contentType: "application/json", body: "" }).ok, false);
assert.equal(classifyProbe({ status: 404, contentType: "text/html", body: "---\nbrain_region: frontal\n---" }).ok, false, "internal marker beats headers");
assert.equal(classifyProbe({ status: 404, contentType: "text/html", body: "# HARD RULES — READ FIRST" }).ok, false);
assert.equal(classifyProbe({ status: 301, contentType: "", body: "" }).ok, false, "unexpected status surfaces honestly");
assert.equal(classifyProbe({ status: 403, contentType: "text/html", body: html404 }).ok, true);

// 2 — the incident path is probe #1 and the list covers every denylist class (incl. the probe
// script itself: /scripts/* is force-404'd and self-probed).
assert.equal(DENYLIST_PROBES[0], "/CLAUDE.md");
for (const prefix of ["/aria-vault/", "/senior-director-state/", "/documents/", "/AGENT_EXECUTION_NOTES.md", "/ARIA-Vault-Backups/", "/backups/", "/scripts/"]) {
  assert.ok(DENYLIST_PROBES.some((p) => p.startsWith(prefix)), `probe list must cover ${prefix}`);
}
assert.ok(DENYLIST_PROBES.includes("/scripts/probe-deploy-safety.mjs"), "the probe must probe itself");
assert.ok(DENYLIST_PROBES.length >= 8);

// 2b — the sensitive markers are built from char codes at RUNTIME (never literal in tracked
// code) yet still catch their phrases. These fixtures are runtime-built for the same reason.
{
  const cc = (...codes) => String.fromCharCode(...codes);
  const r11Phrase = [cc(80, 114, 105, 118, 97, 116, 101), cc(112, 105, 99, 115), cc(97, 110, 100), cc(86, 105, 100, 115)].join(" ");
  const rjPhrase = [cc(82, 97, 121, 109, 111, 110, 100), cc(74, 97, 109, 101, 115)].join(" ");
  let v = classifyProbe({ status: 404, contentType: "text/html", body: `notes under C:\\${r11Phrase}\\x` });
  assert.deepEqual(v, { ok: false, reason: "internal-marker:r11-folder-name" });
  v = classifyProbe({ status: 404, contentType: "text/html", body: `never mention ${rjPhrase} anywhere` });
  assert.deepEqual(v, { ok: false, reason: "internal-marker:forbidden-name" });
  // and the tracked probe sources must not carry either phrase literally.
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));
  for (const rel of ["../scripts/probe-deploy-safety.mjs", "./probe-deploy-safety.test.mjs"]) {
    const src = readFileSync(join(here, rel), "utf8");
    assert.equal(new RegExp(r11Phrase.split(" ").join("\\s+"), "i").test(src), false, `${rel} must not contain the r11 phrase literally`);
    assert.equal(new RegExp(rjPhrase.split(" ").join("\\s+"), "i").test(src), false, `${rel} must not contain the forbidden name literally`);
  }
}

// 3 — runProbes: cache-busts every URL, sends no-cache headers, aggregates honestly.
{
  const seen = [];
  const NOW = 1_760_000_000_000;
  const fetchFn = async (url, opts) => {
    seen.push({ url, opts });
    return { status: 404, headers: { get: (h) => (h.toLowerCase() === "content-type" ? "text/html; charset=UTF-8" : null) }, text: async () => html404 };
  };
  const report = await runProbes({ baseUrl: "https://example.test", fetchFn, now: () => NOW });
  assert.equal(report.ok, true);
  assert.equal(report.leak, false);
  assert.equal(report.pass, DENYLIST_PROBES.length);
  for (const s of seen) {
    assert.ok(s.url.includes(`?cb=${NOW}`), "every probe must cache-bust");
    assert.equal(s.opts.headers["Cache-Control"], "no-cache");
    assert.equal(s.opts.redirect, "manual");
  }
  assert.equal(report.baseUrl, "https://example.test");
}

// 4 — a served internal file → ok:false + leak:true (page Ahmad), and the report names the path.
{
  const fetchFn = async (url) => new URL(String(url)).pathname === "/CLAUDE.md"
    ? { status: 200, headers: { get: () => "text/markdown; charset=UTF-8" }, text: async () => "# 🔒 HARD RULES — READ FIRST" }
    : { status: 404, headers: { get: () => "text/html" }, text: async () => html404 };
  const report = await runProbes({ baseUrl: "https://example.test", fetchFn, now: () => 1 });
  assert.equal(report.ok, false);
  assert.equal(report.leak, true);
  assert.equal(report.fail, 1);
  assert.equal(report.results[0].path, "/CLAUDE.md");
  assert.equal(report.results[0].ok, false);

  // 5 — alerts are content-blind: reason/status/content-type only, NEVER the body.
  const { alertJson, ceoLine } = alertArtifacts(report);
  const raw = JSON.stringify(alertJson) + ceoLine;
  assert.equal(/HARD RULES/.test(raw), false, "alert must never carry response body content");
  assert.equal(alertJson.leak, true);
  assert.equal(alertJson.failed.length, 1);
  assert.equal(alertJson.failed[0].path, "/CLAUDE.md");
  assert.ok(ceoLine.includes("SERVING-LAYER LEAK"));
  assert.ok(ceoLine.includes("one-click"), "remediation stays Ahmad's click — never automatic");
}

// 6 — network failure is honest: unreachable ≠ leak (ok:false but leak:false — no false paging).
{
  const fetchFn = async () => { throw new Error("ECONNRESET"); };
  const report = await runProbes({ baseUrl: "https://example.test", fetchFn, now: () => 1 });
  assert.equal(report.ok, false);
  assert.equal(report.leak, false, "unreachable must not claim a leak");
  assert.ok(report.results.every((r) => r.reason.startsWith("unreachable:")));
}

// 7 — default target is production.
assert.equal(DEFAULT_BASE_URL, "https://iisupp.net");

console.log("probe-deploy-safety test passed (refusal-only PASS · leak vs unreachable honesty · cache-bust enforced · content-blind alerts).");
