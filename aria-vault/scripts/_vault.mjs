#!/usr/bin/env node
// _vault.mjs — shared helpers: locate vault, list notes, parse frontmatter, write safely.
// Zero dependencies. Node 20+. Windows + POSIX safe.

import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { join, dirname, basename, relative, sep } from "node:path";

// Resolve the vault root whether we're run from aria-vault/ or its parent.
export const VAULT = process.cwd().includes("aria-vault")
  ? process.cwd().slice(0, process.cwd().indexOf("aria-vault") + "aria-vault".length)
  : join(process.cwd(), "aria-vault");

export const FOLDERS = {
  daily:    "04_Daily",
  decision: "09_Decisions",
  campaign: "03_Campaigns",
  customer: "01_Business",
  person:   "07_People",
  recipe:   "01_Business/Sentinel/Recipes",
  memory:   "02_Memory",
  inbox:    "05_Inbox",
};

const SKIP_DIRS = new Set(["node_modules", "attachments", ".obsidian", ".git", ".claude"]);

// Walk the vault and return every markdown note with its name + vault-relative path.
export async function listExistingNotes() {
  const out = [];
  async function walk(dir) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
      const p = join(dir, entry.name);
      if (entry.isDirectory()) await walk(p);
      else if (entry.name.endsWith(".md")) {
        out.push({
          path: p,
          name: basename(entry.name, ".md"),
          rel: relative(VAULT, p).split(sep).join("/"),
        });
      }
    }
  }
  await walk(VAULT);
  return out;
}

// Minimal YAML-ish frontmatter parser (flat key: value pairs only).
export function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].trim();
  }
  return { data, body: text.slice(m[0].length) };
}

// Write a file, creating parent dirs first.
export async function writeSafe(path, text) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}

export async function exists(path) {
  try { await stat(path); return true; }
  catch { return false; }
}
