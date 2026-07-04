// RUN-D D2 wiring - main IPC + preload expose conversion and staged case-study surfaces.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const main = readFileSync(join(root, "src", "main", "main.mjs"), "utf8");
const preload = readFileSync(join(root, "src", "main", "preload.cjs"), "utf8");

assert.match(main, /conversionMomentNow\(\)/, "main computes conversion moment from local pilot proof");
assert.match(main, /caseStudyDraftNow/, "main stages a case-study draft");
assert.match(main, /sentinel:conversion-moment/, "main exposes conversion IPC");
assert.match(main, /sentinel:case-study-draft/, "main exposes case-study IPC");
assert.match(preload, /conversionMoment:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("sentinel:conversion-moment"\)/, "preload exposes conversionMoment");
assert.match(preload, /caseStudyDraft:\s*\(opts\)\s*=>\s*ipcRenderer\.invoke\("sentinel:case-study-draft", opts\)/, "preload exposes caseStudyDraft");

console.log("D2 wire-conversion test passed (main IPC + preload bridge for proof and staged draft).");
