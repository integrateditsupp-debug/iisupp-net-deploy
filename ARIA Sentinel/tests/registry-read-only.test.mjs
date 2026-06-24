// RUN 20 §1 — all registry access is HKLM/HKCU enumeration only. Zero writes anywhere in the inventory
// path: no `reg add`, `reg delete`, `Set-ItemProperty`, `New-ItemProperty`, `Remove-ItemProperty`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { REGISTRY_UNINSTALL_KEYS, REGISTRY_RUN_KEYS } from "../src/main/system-context.mjs";

const root = path.resolve(import.meta.dirname, "..");
// Scan CODE only — strip line comments so the module's own "no reg add / reg delete" documentation
// (which names the forbidden ops as prose) doesn't count as a write.
const stripComments = (s) => s.replace(/^\s*\/\/.*$/gm, "");
const sysCtx = stripComments(fs.readFileSync(path.join(root, "src", "main", "system-context.mjs"), "utf8"));
const main = fs.readFileSync(path.join(root, "src", "main", "main.mjs"), "utf8");

// The documented registry keys are HKLM/HKCU enumeration targets only.
for (const k of [...REGISTRY_UNINSTALL_KEYS, ...REGISTRY_RUN_KEYS]) {
  assert.ok(/^HK(LM|CU)\\/.test(k), `registry key is HKLM/HKCU: ${k}`);
}

const WRITES = [/\breg\s+add\b/i, /\breg\s+delete\b/i, /Set-ItemProperty/i, /New-ItemProperty/i, /Remove-ItemProperty/i];

// The inventory module performs no registry writes.
for (const w of WRITES) assert.doesNotMatch(sysCtx, w, `system-context.mjs has no registry write (${w})`);

// The actual PowerShell collectors in main read via Get-ItemProperty and never write.
const block = main.match(/const PS_COMMANDS = \{[\s\S]*?\n\};/);
assert.ok(block, "PS_COMMANDS collector block found");
assert.match(block[0], /Get-ItemProperty/, "registry apps read via Get-ItemProperty (enumeration)");
for (const w of WRITES) assert.doesNotMatch(block[0], w, `PS_COMMANDS performs no registry write (${w})`);
// Reads target the documented HKLM/HKCU uninstall hives.
assert.match(block[0], /HKLM:\\\\SOFTWARE\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall/, "reads HKLM uninstall hive");
assert.match(block[0], /HKCU:\\\\SOFTWARE/, "reads HKCU hive");

console.log("Registry-read-only test passed (HKLM/HKCU enumeration only · zero writes in the inventory path).");
