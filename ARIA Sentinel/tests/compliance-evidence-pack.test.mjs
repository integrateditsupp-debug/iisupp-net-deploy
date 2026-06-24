// RUN 22 §4 — the RUN 18 evidence pack still works, and the Compliance tab can attach the framework
// composite scores for an auditor export.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { compositeScores } from "../src/shared/compliance-score.mjs";

const root = path.resolve(import.meta.dirname, "..");
const main = fs.readFileSync(path.join(root, "src", "main", "main.mjs"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "src", "renderer", "index.html"), "utf8");

// RUN 18 evidence pack — still wired (export → ~/Documents zip).
assert.match(main, /ipcMain\.handle\("sentinel:export-evidence"/, "evidence-pack IPC intact");
assert.match(main, /zipEvidencePack\(/, "evidence pack still builds the real .zip");

// The Compliance tab exposes an evidence export button (RFP gold) + the framework scores feed it.
assert.match(indexHtml, /id="compExportEvidence"/, "compliance evidence export button present");
const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
assert.match(renderer, /compExportEvidence[\s\S]*?exportEvidence/, "compliance export calls the evidence pack");

// Compliance scores are computed + available to include in the auditor export.
const cs = compositeScores();
assert.ok(cs.soc2.score >= 0 && cs.hipaa.score >= 0 && cs.pipeda.score >= 0 && cs.gdpr.score >= 0);
assert.match(main, /complianceData\(/, "main builds compliance data");
assert.match(main, /compositeScores\(/, "main wires the framework composites");
// The report bundles the compliance posture (so the exported PDF carries the scores).
assert.match(main, /compliance:\s*\{[\s\S]*?soc2/, "report data carries compliance scores");

console.log("Compliance-evidence-pack test passed (RUN 18 evidence pack intact · framework scores available for export).");
