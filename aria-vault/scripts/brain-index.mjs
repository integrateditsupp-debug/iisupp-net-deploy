#!/usr/bin/env node
// brain-index.mjs — walks the brain-shaped vault and emits a content-blind index the AXIS command
// center reads to light up each brain region. Titles + counts + mtime only — NO note bodies, no PII.
// Output: aria-vault/_meta/brain-index.json
import { readFile, writeFile, readdir, stat, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";

const VAULT = join(import.meta.dirname, "..");
const SKIP = new Set([".git", "attachments", ".obsidian", ".trash", "scripts", ".claude", "_stubs-trash", "_meta"]);

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else if (e.isFile() && e.name.endsWith(".md")) out.push(full);
  }
  return out;
}

const region = (t) => (t.match(/^brain_region:\s*([\w-]+)/m) || [])[1] || "unfiled";
const title = (t, f) => {
  const h1 = t.match(/^#\s+(.+)$/m);
  return (h1 ? h1[1] : basename(f, ".md")).replace(/[\[\]]/g, "").trim().slice(0, 80);
};

const files = await walk(VAULT);
const regions = {};
for (const f of files) {
  const t = await readFile(f, "utf8").catch(() => "");
  if (!t) continue;
  const r = region(t);
  const m = (await stat(f)).mtime.toISOString().slice(0, 10);
  (regions[r] ||= { count: 0, lastUpdated: "", notes: [] });
  regions[r].count++;
  if (m > regions[r].lastUpdated) regions[r].lastUpdated = m;
  regions[r].notes.push({ title: title(t, f), updated: m });
}
// newest-first, cap titles per region so the JSON stays small + content-blind
for (const k of Object.keys(regions)) {
  regions[k].notes.sort((a, b) => (a.updated < b.updated ? 1 : -1));
  regions[k].notes = regions[k].notes.slice(0, 24);
}

const out = {
  v: "brain-index-v1",
  generated: new Date().toISOString(),
  totalNotes: files.length,
  regions
};
await mkdir(join(VAULT, "_meta"), { recursive: true });
await writeFile(join(VAULT, "_meta", "brain-index.json"), JSON.stringify(out, null, 2));
// Also publish to public/.well-known/axis/ so the AXIS HUD fetches it directly via Netlify
const publicDir = join(VAULT, "..", "public", ".well-known", "axis");
await mkdir(publicDir, { recursive: true });
await writeFile(join(publicDir, "brain-index.json"), JSON.stringify(out, null, 2));
console.log(`brain-index · ${files.length} notes · ${Object.keys(regions).length} regions → _meta/brain-index.json`);
