// tools/sync-aria-brain.mjs — ONE brain, FOUR surfaces (2026-07-07, Cowork)
//
// Master: /aria-brain.js  (the iisupp.net/aria conversational engine, v2 — UMD + Node-safe)
// Copies:
//   1. extension/aria-brain.js                     (standalone ARIA browser extension popup)
//   2. ARIA Sentinel/src/shared/aria-brain.cjs     (desktop app offline chat tier — .cjs because the
//                                                   Sentinel package is "type":"module")
//   3. ARIA Sentinel/chrome-extension/aria-brain.js (Sentinel Chrome companion popup)
//   4. ARIA Sentinel/edge-extension/aria-brain.js   (Sentinel Edge companion popup)
//
// Run AFTER any edit to /aria-brain.js:   node tools/sync-aria-brain.mjs
// (also wired into AHMAD-PUSH-ARIA-BRAIN-V2.cmd so a push can't ship drifted copies)
//
// Exits non-zero if the master fails a syntax load or any copy hash mismatches after write.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MASTER = path.join(root, "aria-brain.js");
const TARGETS = [
  path.join(root, "extension", "aria-brain.js"),
  path.join(root, "ARIA Sentinel", "src", "shared", "aria-brain.cjs"),
  path.join(root, "ARIA Sentinel", "chrome-extension", "aria-brain.js"),
  path.join(root, "ARIA Sentinel", "edge-extension", "aria-brain.js"),
];

const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);

// 1) master must exist and actually load in Node (engine is UMD + Node-safe as of v2)
const src = fs.readFileSync(MASTER);
const require = createRequire(import.meta.url);
const brain = require(MASTER);
if (!brain || typeof brain.handleTurn !== "function" || !Array.isArray(brain._TOPICS)) {
  console.error("[sync-aria-brain] FAIL: master did not export a working engine");
  process.exit(1);
}
const topicCount = brain._TOPICS.filter(Boolean).length;
console.log(`[sync-aria-brain] master OK  v${brain.version || "?"}  topics=${topicCount}  sha=${sha(src)}`);

// 2) copy + verify
let fail = false;
for (const t of TARGETS) {
  try {
    fs.mkdirSync(path.dirname(t), { recursive: true });
    fs.writeFileSync(t, src);
    const back = fs.readFileSync(t);
    const ok = sha(back) === sha(src);
    if (!ok) fail = true;
    console.log(`[sync-aria-brain] ${ok ? "synced" : "MISMATCH"}  ${path.relative(root, t)}  sha=${sha(back)}`);
  } catch (err) {
    fail = true;
    console.error(`[sync-aria-brain] FAIL ${path.relative(root, t)}: ${err.message}`);
  }
}

process.exit(fail ? 1 : 0);
