#!/usr/bin/env node
// consolidate.mjs — end-of-day pass.
// 1. Dedup bullets in today's Index (same text -> keep first).
// 2. Print stats.

import { readFile, writeFile } from "node:fs/promises";
import { todayPath } from "./route.mjs";
import { exists } from "./_vault.mjs";

const today = todayPath();

if (!(await exists(today))) {
  console.log(`consolidate.mjs · no daily note at ${today} — nothing to do`);
  process.exit(0);
}

let text = await readFile(today, "utf8");
let removed = 0;

const idx = text.match(/## Index\n((?:- .*\n)*)/);
if (idx) {
  const lines = idx[1].split("\n").filter(Boolean);
  const seen = new Set();
  const unique = lines.filter(l => {
    const k = l.trim().toLowerCase();
    if (seen.has(k)) { removed++; return false; }
    seen.add(k);
    return true;
  });
  text = text.replace(idx[0], `## Index\n${unique.join("\n")}\n`);
}

await writeFile(today, text);
console.log(`consolidate.mjs · today's Index deduped (${removed} duplicate bullet${removed === 1 ? "" : "s"} removed)`);
