#!/usr/bin/env node
// route.mjs — classify a chunk + return target file path + helpers to write into the vault.
// Pure logic; no LLM call (the /capture slash command does the classification reasoning).
// Used by the watcher OR called directly by Claude Code as a sanity helper.

import { readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { VAULT, FOLDERS, writeSafe, exists, listExistingNotes } from "./_vault.mjs";

export { listExistingNotes };

const IMPORTANT_PATTERNS = [
  /\b(decision|locked|hard rule|deadline|revenue|MRR|ARR|customer|sign|contract|pilot)\b/i,
  /\$[\d,]+/,
  /\d+%\s*(month|year|growth|conversion)/i,
];

export function isImportant(text) {
  return IMPORTANT_PATTERNS.some(p => p.test(text));
}

function ymd() {
  return new Date().toISOString().slice(0, 10);
}

export function todayPath() {
  return join(VAULT, FOLDERS.daily, `${ymd()}.md`);
}

export function decisionPath(slug) {
  const compact = ymd().replace(/-/g, "");
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/^-|-$/g, "");
  return join(VAULT, FOLDERS.decision, `D-${compact}-${safeSlug}.md`);
}

async function ensureDailyNote(path) {
  const d = new Date();
  const human = d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  await writeSafe(path, `---\ndate: ${ymd()}\ntype: daily\n---\n\n# ${human}\n\n## Index\n\n## Detail\n\n`);
}

// Append a bullet under the "## Index" heading of today's daily note.
export async function appendToDailyIndex(line) {
  const path = todayPath();
  if (!(await exists(path))) await ensureDailyNote(path);
  let text = await readFile(path, "utf8");
  if (/## Index\n/.test(text)) {
    // Insert right after the Index heading (and any existing bullets).
    text = text.replace(/(## Index\n(?:- .*\n)*)/, `$1- ${line}\n`);
  } else {
    text += `\n## Index\n- ${line}\n`;
  }
  await writeFile(path, text);
  return path;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // CLI: node scripts/route.mjs "free text here"
  const text = process.argv.slice(2).join(" ");
  console.log({ vault: VAULT, important: isImportant(text), today: todayPath() });
}
