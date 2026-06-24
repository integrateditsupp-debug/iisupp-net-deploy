// RUN 20 §3 — all 10 cross-platform blueprints exist and carry every required section.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "aria-kb-pack", "blueprints");

const EXPECTED = [
  "windows-11", "windows-10", "macos-15-sequoia", "macos-14-sonoma", "ios-18",
  "ipados-18", "android-15", "linux-ubuntu-debian", "linux-fedora-rhel", "chromeos"
];
// The packet lists 8 H2 sections (it says "7" — corrected to the 8 actually specified).
const SECTIONS = [
  "## Architecture", "## Settings access", "## Common pain points", "## Voice-guidable steps",
  "## Hardware diagnostic commands", "## Network reset procedure", "## Safe-mode equivalent", "## Backup/restore mechanism"
];

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
assert.equal(files.length, 10, "10 blueprint files");
for (const id of EXPECTED) {
  const p = path.join(dir, `${id}.md`);
  assert.ok(fs.existsSync(p), `blueprint ${id}.md exists`);
  const md = fs.readFileSync(p, "utf8");
  assert.match(md, /^#\s+.+/m, `${id} has a title`);
  for (const sec of SECTIONS) assert.ok(md.includes(sec), `${id} has section "${sec}"`);
  assert.ok(md.length > 400, `${id} has real content`);
}

console.log(`Blueprint-coverage test passed (10 platforms × ${SECTIONS.length} required sections).`);
