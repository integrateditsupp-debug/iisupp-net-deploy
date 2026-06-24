// 🔒 R11 (RUN 23b) — the live Tier-0 executor must never touch / surface the off-limits "Private pics and
// Vids" folder: no catalog command references it, a private-laden id never executes, and any private string
// that comes back from a probe is redacted out of the audit events before they are logged.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { executeTier0, TIER0_COMMANDS, TIER0_EXECUTOR_IDS } from "../src/main/tier-0-executor.mjs";
import { isBlockedPath } from "../src/shared/path-guard.mjs";

const re = /private pics and vids/i;

// 1 — no command / probe / service in the catalog references the off-limits folder.
for (const id of TIER0_EXECUTOR_IDS) {
  const c = TIER0_COMMANDS[id];
  assert.equal(isBlockedPath(c.command), false, `${id} command clean`);
  assert.equal(isBlockedPath(c.probe || ""), false, `${id} probe clean`);
  assert.equal(isBlockedPath(c.service || ""), false, `${id} service clean`);
  assert.doesNotMatch(JSON.stringify(c), re);
}

// 2 — a private-laden recipe id never resolves to a binding → it never executes (outcome "unbound").
const blocked = await executeTier0("C:/Users/bob/Private pics and Vids/evil", { run: async () => { throw new Error("must not run"); } });
assert.equal(blocked.outcome, "unbound");
assert.doesNotMatch(JSON.stringify(blocked), re);

// 3 — if a probe returns a private path as "state", it is redacted out of every audit event.
const leakyRun = async () => ({ stdout: "C:\\Users\\bob\\Private pics and Vids\\x", stderr: "", exitCode: 0 });
const r = await executeTier0("restart-print-spooler", { run: leakyRun });
assert.doesNotMatch(JSON.stringify(r.events), re, "audit events redact the private path");
assert.doesNotMatch(JSON.stringify(r), re);

// 4 — the executor module wires the R11 guard.
const src = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "src", "main", "tier-0-executor.mjs"), "utf8");
assert.match(src, /path-guard\.mjs/);
assert.match(src, /isBlockedPath/);

console.log("Tier-0-r11-never-touched test passed (catalog clean · private id never runs · probe output redacted · guard wired).");
