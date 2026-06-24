// RUN 3 — RFP evidence pack + the zero-dependency ZIP writer + the "What's new" version logic.
// Asserts the pack contains all six required artifacts, that they survive into a real .zip (round
// -tripped via the central directory), the 30-day audit window, and the what's-new trigger rules.
import assert from "node:assert/strict";
import zlib from "node:zlib";
import {
  buildEvidencePack,
  zipEvidencePack,
  evidenceFileName,
  EVIDENCE_ARTIFACTS
} from "../src/shared/evidence-pack.mjs";
import { buildZip, listZipEntries } from "../src/shared/zip.mjs";
import { compareVersions, shouldShowWhatsNew } from "../src/shared/whats-new.mjs";

const NOW = Date.parse("2026-06-19T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

// ---- ZIP writer round-trip -------------------------------------------------------------------
const zip = buildZip([
  { name: "a.json", data: { hello: "world" } },
  { name: "b.txt", data: "plain text body" }
]);
assert.ok(Buffer.isBuffer(zip), "buildZip returns a Buffer");
assert.equal(zip[0], 0x50, "starts with 'P'");
assert.equal(zip[1], 0x4b, "…'K' (PKZIP signature)");
assert.deepEqual(listZipEntries(zip), ["a.json", "b.txt"], "central directory lists both entries");

// Entry bytes actually decompress back to the original (DEFLATE round-trip via the local header).
const localNameLen = zip.readUInt16LE(26);
const compSize = zip.readUInt32LE(18);
const dataStart = 30 + localNameLen;
const inflated = zlib.inflateRawSync(zip.subarray(dataStart, dataStart + compSize)).toString("utf8");
assert.equal(JSON.parse(inflated).hello, "world", "first entry inflates to its original content");

// ---- Evidence pack contents ------------------------------------------------------------------
const inputs = {
  auditLog: [
    { ts: "2026-06-18T10:00:00Z", tag: "RUN", text: "Executing recipe NET.DNS.FAIL" },
    { ts: "2026-06-01T10:00:00Z", tag: "DONE", text: "old but in window" },
    { ts: "2026-04-01T10:00:00Z", tag: "DONE", text: "older than 30 days — dropped" }
  ],
  allowedOutboundPaths: [{ id: "recipes", host: "iisupp.net", path: "/x" }],
  networkCapture: { pass: true, rows: [], disallowedHostCount: 0 },
  recipes: [{ id: "dns-fail-v1", signal: "NET.DNS.FAIL", risk: "green", mode: "confirmed" }],
  recipeRegistryVersion: "0.1.0",
  sbom: { format: "sbom-lite", packages: [{ name: "aria-sentinel" }] },
  signedBundleHash: { binary: { sha256: "ABC123" } },
  productVersion: "0.1.0"
};

const { files, manifest } = buildEvidencePack(inputs, { nowMs: NOW, dateStamp: "2026-06-19" });
const names = files.map((f) => f.name);

// All six required artifacts present (plus a manifest).
assert.equal(EVIDENCE_ARTIFACTS.length, 6, "six required artifacts");
for (const required of EVIDENCE_ARTIFACTS) {
  assert.ok(names.includes(required), `pack includes ${required}`);
}
assert.ok(names.includes("manifest.json"), "pack includes a manifest");
assert.deepEqual(manifest.artifacts, EVIDENCE_ARTIFACTS);

// 30-day window: the April entry is dropped, the June ones kept.
const audit = files.find((f) => f.name === "audit-log-30d.json").data;
assert.equal(audit.entryCount, 2, "audit window keeps only the last 30 days");

// The real .zip contains every required artifact (verified through its central directory).
const buffer = zipEvidencePack(inputs, { nowMs: NOW, dateStamp: "2026-06-19" });
const entries = listZipEntries(buffer);
for (const required of EVIDENCE_ARTIFACTS) {
  assert.ok(entries.includes(required), `zip contains ${required}`);
}
assert.ok(entries.includes("manifest.json"));
assert.equal(evidenceFileName("2026-06-19"), "aria-sentinel-evidence-2026-06-19.zip");

// ---- "What's new" trigger --------------------------------------------------------------------
assert.equal(compareVersions("0.1.0", "0.2.0"), -1);
assert.equal(compareVersions("1.0.0", "0.9.9"), 1);
assert.equal(compareVersions("0.1.0", "0.1.0"), 0);
assert.equal(shouldShowWhatsNew({ lastSeenVersion: "0.1.0", currentVersion: "0.2.0", firstRun: false }), true, "older last-seen → show");
assert.equal(shouldShowWhatsNew({ lastSeenVersion: "0.2.0", currentVersion: "0.2.0", firstRun: false }), false, "same version → no show");
assert.equal(shouldShowWhatsNew({ lastSeenVersion: "0.1.0", currentVersion: "0.2.0", firstRun: true }), false, "first install → skip");
assert.equal(shouldShowWhatsNew({ lastSeenVersion: null, currentVersion: "0.2.0", firstRun: false }), false, "unknown last-seen → no nag");

console.log(`Evidence-pack test passed (${EVIDENCE_ARTIFACTS.length} artifacts in a real zip, 30d window, zip round-trip, what's-new logic).`);
