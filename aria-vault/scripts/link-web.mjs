#!/usr/bin/env node
// link-web.mjs — MAX MESH MODE. Every note connects to:
//   1. All master hubs
//   2. All folder siblings
//   3. All notes that link to it (bi-directional)
//   4. All notes it already mentions
// Goal: <=2-hop reachability between any two concepts. Loop engineering optimized.

import { readFile, writeFile, readdir, stat, mkdir } from "node:fs/promises";
import { join, dirname, basename } from "node:path";

const VAULT = join(import.meta.dirname, "..");
const PROTECTED = new Set(["CLAUDE.md", "RULES.md", "VOICE.md"]);
const EXCLUDE_DIRS = new Set([".obsidian", "attachments", ".trash", "node_modules", ".git", "scripts", ".claude"]);
const MARKER_START = "<!-- LINK-WEB:auto -->";
const MARKER_END = "<!-- /LINK-WEB:auto -->";

const MASTER_HUBS = [
  "_HOME", "Brain-Map",
  "_IIS", "_ARIA", "_Sentinel", "AXIS",
  "Ahmad",
  "Cowork", "Codex", "Claude-Code", "KB-agent", "OPS-agent", "Leads-agent",
  "Cleaning-agent", "Backup-agent",
  "RULES", "VOICE", "STACK", "DIRECTOR_AUTONOMY",
  "Leads", "_Campaigns", "_capture", "_Inbox", "_Decisions",
  "_Amygdala", "_Brainstem", "_CorpusCallosum", "_Glia",
];

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { await walk(full, out); continue; }
    if (entry.isFile() && entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

function noteKey(file) { return basename(file, ".md"); }
function stripPipe(link) { return link.split("|")[0].split("#")[0]; }
function baseName(targetPath) { return basename(stripPipe(targetPath)); }
async function fileExists(path) { try { await stat(path); return true; } catch { return false; } }

async function ensureStub(targetName, sourceFile, fileIndex) {
  const base = baseName(targetName);
  if (fileIndex.has(base) || fileIndex.has(base + ".md")) return false;
  if (/^(note-name|target-note-name|wikilink|wikilinks|\$\{target\})$/i.test(base)) return false;
  // Skip env-var-like ALL_CAPS_SNAKE_CASE (e.g. ARIA_ADMIN_TOKEN) and .bat/.exe filenames
  if (/^[A-Z][A-Z0-9_]+$/.test(base) && base.includes("_")) return false;
  if (/\.(bat|exe|js|mjs|html|css)$/i.test(base)) return false;
  let folder = dirname(sourceFile);
  const segments = targetName.split("/");
  if (segments.length > 1) {
    folder = join(dirname(sourceFile), segments.slice(0, -1).join("/"));
  } else {
    if (base.startsWith("D-")) folder = join(VAULT, "09_Decisions");
    else if (/^\d{4}-\d{2}-\d{2}$/.test(base)) folder = join(VAULT, "04_Daily");
    else if (["Customers","Sales","Marketing","Partners","Operations","Leads"].includes(base)) folder = join(VAULT, "01_Business/IIS");
    else if (base === "Recipes") folder = join(VAULT, "01_Business/ARIA/Recipes");
    else if (base === "Stripe-Products") folder = join(VAULT, "01_Business/ARIA/Pricing");
  }
  await mkdir(folder, { recursive: true });
  const fileName = base.endsWith(".md") ? base : base + ".md";
  const fullPath = join(folder, fileName);
  if (await fileExists(fullPath)) { fileIndex.set(base, fullPath); return false; }
  const stub = `---\ntype: stub\ncreated: ${new Date().toISOString().slice(0,10)}\n---\n\n# ${base.replace(/-/g, " ")}\n\n> Stub created by link-web.mjs.\n\n${MARKER_START}\n${MARKER_END}\n`;
  await writeFile(fullPath, stub);
  fileIndex.set(base, fullPath);
  return true;
}

function strippedBody(text) {
  return text.replace(new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}`, "g"), "");
}

function existingLinks(text) {
  const set = new Set();
  // [^\]|#\r\n] — a wikilink target never spans a line, so a stray unclosed `[[` can't capture a
  // newline run and corrupt the graph with an empty-named note (the `\n\n.md` bug).
  for (const m of strippedBody(text).matchAll(/\[\[([^\]|#\r\n]+)/g)) set.add(baseName(m[1]));
  return set;
}

// Parse the brain_region frontmatter field. Used for region-aware graph weighting so notes in the
// same anatomical region cluster tightly in the Obsidian graph (RUN A · Part B).
function readRegion(text) {
  const m = (text || "").match(/^brain_region:\s*([\w-]+)/m);
  return m ? m[1] : "";
}

function upsertRelatedBlock(text, blockBody) {
  if (!blockBody) return text;
  const autoBlock = `\n\n## Related\n\n${MARKER_START}\n${blockBody}\n${MARKER_END}\n`;
  const reAuto = new RegExp(`\\n*## Related\\s*\\n+${MARKER_START}[\\s\\S]*?${MARKER_END}\\n*`, "g");
  const cleaned = text.replace(reAuto, "");
  if (/\n## Related\b/.test(cleaned)) {
    return cleaned.replace(/(\n## Related[\s\S]*?)(\n## |\n# |$)/, (m, before, after) => {
      return `${before}\n\n${MARKER_START}\n${blockBody}\n${MARKER_END}\n${after}`;
    });
  }
  return cleaned.replace(/\s*$/, "") + autoBlock;
}

const allFiles = await walk(VAULT);
const fileIndex = new Map();
for (const f of allFiles) fileIndex.set(noteKey(f), f);

let stubs = 0;
for (const f of allFiles) {
  let text;
  try { text = await readFile(f, "utf8"); } catch { continue; }
  for (const m of strippedBody(text).matchAll(/\[\[([^\]|#\r\n]+)/g)) {
    const targetRaw = m[1];
    const base = baseName(targetRaw);
    if (!fileIndex.has(base) && !fileIndex.has(base + ".md")) {
      if (await ensureStub(targetRaw, f, fileIndex)) stubs++;
    }
  }
}

const allFiles2 = await walk(VAULT);
const fileIndex2 = new Map();
for (const f of allFiles2) fileIndex2.set(noteKey(f), f);

// One linear pass: build reverse-links AND cache every note's region (avoids quadratic IO — the region
// lookup in the per-file loop below reads only from this Map, never the disk).
const reverseLinks = new Map();
const regionByKey = new Map();
for (const f of allFiles2) {
  let text;
  try { text = await readFile(f, "utf8"); } catch { continue; }
  const src = noteKey(f);
  regionByKey.set(src, readRegion(text));
  for (const linkBase of existingLinks(text)) {
    if (!reverseLinks.has(linkBase)) reverseLinks.set(linkBase, new Set());
    reverseLinks.get(linkBase).add(src);
  }
}

let touched = 0;
for (const f of allFiles2) {
  if (PROTECTED.has(basename(f))) continue;
  let text;
  try { text = await readFile(f, "utf8"); } catch { continue; }
  const me = noteKey(f);
  const myFolder = dirname(f);
  const candidates = new Set();
  for (const hub of MASTER_HUBS) candidates.add(hub);
  // 2. all folder siblings
  for (const other of allFiles2) {
    if (dirname(other) === myFolder && other !== f) candidates.add(noteKey(other));
  }
  // 3. all notes that link to me (bi-directional / reverse links)
  for (const back of (reverseLinks.get(me) || [])) candidates.add(back);
  // 4. all notes I already mention (forward links)
  for (const fwd of existingLinks(text)) candidates.add(fwd);

  // Never link a note to itself; only keep candidates that resolve to a real note.
  candidates.delete(me);
  const myRegion = regionByKey.get(me) || "";
  const valid = [...candidates].filter((k) => k !== me && fileIndex2.has(k));
  if (!valid.length) continue;

  // Region-aware ordering (RUN A · Part B): same anatomical region first so they cluster tightly in the
  // Obsidian graph, then everything else; A→Z within each band. Keeps the auto-block deterministic.
  valid.sort((a, b) => {
    const ra = (regionByKey.get(a) || "") === myRegion ? 0 : 1;
    const rb = (regionByKey.get(b) || "") === myRegion ? 0 : 1;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });

  const blockBody = valid.map((k) => `- [[${k}]]`).join("\n");
  const next = upsertRelatedBlock(text, blockBody);
  if (next !== text) {
    await writeFile(f, next);
    touched++;
  }
}

console.log(`link-web: ${allFiles2.length} notes scanned · ${stubs} stub(s) created · ${touched} Related block(s) updated.`);