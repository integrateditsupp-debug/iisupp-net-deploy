// RUN 18 — Enterprise-verification: prove the RFP evidence pack is content-blind AT THE ARTIFACT LEVEL
// (not just that the 6 files are present) and that the privacy verifier flags a real exfil verdict.
// Net-new vs evidence-pack.test.mjs (which checks entry presence + ZIP structure): this asserts the
// pack carries NO recipe internals / no user content, and that the capture verdict fails on a bad host.
import assert from "node:assert/strict";
import { buildEvidencePack, zipEvidencePack, evidenceFileName, EVIDENCE_ARTIFACTS } from "../src/shared/evidence-pack.mjs";
import { listZipEntries } from "../src/shared/zip.mjs";
import { summarizeCapture, CAPTURE_HOST_ALLOWLIST, UPDATE_OUTBOUND_PATHS, BRAIN_OUTBOUND_PATHS, hostAllowed } from "../src/shared/network-capture.mjs";
import { RECIPES, recipeById } from "../src/shared/recipes.mjs";

const NOW = Date.parse("2026-06-20T12:00:00.000Z");

// A real recipe carries a shell command; the evidence pack's recipe-registry must NOT.
const knownCommand = recipeById("dns-fail-v1").actions[0].command; // "ipconfig /flushdns"
assert.ok(knownCommand && knownCommand.length, "sanity: recipe has a command");

const { files, manifest } = buildEvidencePack({
  auditLog: [{ ts: "2026-06-19T10:00:00.000Z", tag: "FIX", recipeId: "dns-fail-v1", text: "DNS.FAIL dry-run completed" }],
  allowedOutboundPaths: [],
  networkCapture: { pass: true, rows: [], total: 0 },
  recipes: RECIPES,
  recipeRegistryVersion: "0.1.0",
  productVersion: "0.1.0"
}, { nowMs: NOW, dateStamp: "2026-06-20" });

// Content-blind: the whole pack JSON must not leak any recipe shell command (registry is id/signal/risk/mode only).
const packJson = JSON.stringify(files);
assert.ok(!packJson.includes(knownCommand), "evidence pack does not leak recipe shell commands");
assert.doesNotMatch(packJson, /flushdns|Restart-Service|Remove-Item|powershell/i, "no command/script internals in the pack");

// The recipe-registry artifact carries only the four symbolic fields.
const registry = files.find((f) => f.name === "recipe-registry.json").data;
for (const r of registry.recipes) {
  assert.deepEqual(Object.keys(r).sort(), ["id", "mode", "risk", "signal"], `registry entry ${r.id} is symbolic-only`);
}
// Privacy snapshot asserts the content-blind posture an RFP reviewer checks.
const snap = files.find((f) => f.name === "privacy-snapshot.json").data;
assert.equal(snap.externalAiCalls, false);
assert.equal(snap.contentBlind, true);
assert.equal(snap.dataUploadPathsToIisupp, 0);
assert.match(manifest.note, /content-blind/i);

// The .zip is real + complete + Windows-openable (PK magic + central directory lists all artifacts).
const zip = zipEvidencePack({ recipes: RECIPES, productVersion: "0.1.0" }, { nowMs: NOW, dateStamp: "2026-06-20" });
assert.equal(zip[0], 0x50); assert.equal(zip[1], 0x4b, "PKZIP signature");
const entries = listZipEntries(zip);
for (const required of [...EVIDENCE_ARTIFACTS, "manifest.json"]) assert.ok(entries.includes(required), `zip contains ${required}`);
assert.equal(evidenceFileName("2026-06-20"), "aria-sentinel-evidence-2026-06-20.zip");

// Privacy verifier: a clean run passes; a run with a NON-allowlisted host + a leaking body FAILS.
const cleanPaths = [
  { url: "https://iisupp.net/.netlify/functions/aria-recipes", method: "GET" },
  { url: "https://download.iisupp.net/sentinel-binaries/x", method: "GET" }
];
assert.equal(summarizeCapture(cleanPaths).pass, true, "clean capture passes");

const exfil = [...cleanPaths, { url: "https://evil.example.com/steal", method: "POST", body: "jane@corp.com SSN 123-45-6789 secret memo" }];
const verdict = summarizeCapture(exfil);
assert.equal(verdict.pass, false, "a disallowed host + leaking body fails the verdict");
assert.equal(verdict.disallowedHostCount, 1, "the bad host is flagged");
assert.equal(verdict.leakingPayloadCount, 1, "the leaking payload is flagged");
const badRow = verdict.rows.find((r) => r.host === "evil.example.com");
assert.equal(badRow.allowlistMatch, false);
assert.equal(badRow.sanitizationStatus, "leak");

// Additive update/brain path classes must NOT widen the 6-host telemetry verifier.
assert.equal(CAPTURE_HOST_ALLOWLIST.length, 6, "still exactly 6 telemetry hosts");
assert.ok(UPDATE_OUTBOUND_PATHS.every((p) => p.startsWith("/")), "update entries are paths, not hosts");
assert.ok(BRAIN_OUTBOUND_PATHS.every((p) => p.startsWith("/")), "brain entries are paths, not hosts");
assert.equal(hostAllowed("api.github.com"), false, "update/brain channels never opened a new host");

console.log("RUN18 evidence-content-blind test passed (no recipe internals in the pack · symbolic registry · valid complete .zip · exfil verdict fails on bad host/leak · 6-host verifier not widened).");
