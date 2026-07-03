// P0 DEAD-SHELL REGRESSION GUARD (2026-07-02). The renderer runs in the browser under a strict CSP
// (`script-src 'self'`). If ANY module in renderer.js's STATIC import graph imports a Node builtin
// (`node:crypto`, `crypto`, `fs`, …) or a bare npm specifier, the browser BLOCKS that load, the module chain
// fails, renderer.js never executes, and EVERY click in the main window dies — a silent dead shell (Node unit
// tests can't see it because `node:crypto` is fine in Node). This is exactly how the trial-gating merge bricked
// the app: renderer.js → tab-gating.mjs → license-features.mjs (`import crypto from "node:crypto"`).
//
// This test walks the real static import graph from renderer.js and FAILS if any module imports anything that
// isn't a relative file. It would have failed before the fix (crypto in the graph) and passes after (the pure
// plan logic was split into license-plan.mjs). Pure Node — runs in the normal suite, no Electron needed.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rendererRoot = path.resolve(import.meta.dirname, "..", "src", "renderer");
// Both browser entry points run under the same CSP: the main window (renderer.js) AND the globe overlay
// (overlay.js). A node:/bare import in EITHER graph is a silent dead surface.
const ENTRIES = [path.join(rendererRoot, "renderer.js"), path.join(rendererRoot, "overlay.js")];
const ENTRY = ENTRIES[0];

// Match static imports:  import ... from "X"   and   import "X"   (ignores dynamic import() — those are lazy
// and never fire in the renderer for the server-only paths).
const IMPORT_RE = /(?:^|\n)\s*import\s+(?:[^"'`]*?\sfrom\s*)?["']([^"']+)["']/g;

function staticImportsOf(file) {
  const src = fs.readFileSync(file, "utf8");
  const out = [];
  let m;
  while ((m = IMPORT_RE.exec(src))) out.push(m[1]);
  return out;
}

const visited = new Set();
const offenders = [];
function walk(file, fromChain) {
  if (visited.has(file)) return;
  visited.add(file);
  for (const spec of staticImportsOf(file)) {
    if (spec.startsWith(".") || spec.startsWith("/")) {
      const resolved = path.resolve(path.dirname(file), spec);
      if (!fs.existsSync(resolved)) { offenders.push(`missing file "${spec}" imported by ${path.relative(rendererRoot, file)}`); continue; }
      walk(resolved, fromChain.concat(path.relative(rendererRoot, resolved)));
    } else {
      // A non-relative specifier in the renderer graph — node builtin or bare npm — BREAKS the browser load.
      offenders.push(`FORBIDDEN "${spec}" via ${fromChain.concat(path.relative(rendererRoot, file)).join(" → ")}`);
    }
  }
}

for (const entry of ENTRIES) walk(entry, [path.relative(rendererRoot, entry)]);

// 1 — the whole renderer + overlay graph is browser-safe: only relative file imports, no node:/bare specifiers.
assert.deepEqual(offenders, [], `renderer/overlay import graph must be browser-safe (no node:/bare imports):\n${offenders.join("\n")}`);

// 2 — specifically prove the exact regression is gone: node:crypto must not be reachable from the renderer.
const graphFiles = [...visited];
for (const f of graphFiles) {
  const src = fs.readFileSync(f, "utf8");
  assert.doesNotMatch(src, /from\s*["']node:crypto["']|import\s+["']node:crypto["']/, `${path.relative(rendererRoot, f)} statically imports node:crypto (would CSP-block the renderer)`);
}

// 3 — the graph actually includes tab-gating.mjs (so this test is really exercising the path that broke).
assert.ok(graphFiles.some((f) => f.endsWith(path.join("shared", "tab-gating.mjs"))), "tab-gating.mjs is in the renderer graph (the path that regressed)");
assert.ok(graphFiles.some((f) => f.endsWith(path.join("shared", "license-plan.mjs"))), "the crypto-free license-plan.mjs is used by the renderer graph");

console.log(`renderer-import-graph test passed (${graphFiles.length} modules walked · 0 node:/bare imports · node:crypto not reachable from the renderer · tab-gating→license-plan crypto-free).`);
