#!/usr/bin/env node
// v3 SLIM — chunked + paragraph dedup + minimal per-chunk metadata
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const KB_DIR = join(REPO_ROOT, "knowledge-base");
const OUT = join(REPO_ROOT, "assets/aria-kb-local-bundle-v3.json");

function walk(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { out.push(...walk(p)); continue; }
    if (f.endsWith(".md") && !f.startsWith("_")) out.push(p);
  }
  return out;
}

function parseFrontmatter(text) {
  const t = text.replace(/\r\n/g, "\n");
  const m = t.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const fm = {};
  let curList = null;
  for (const line of m[1].split("\n")) {
    if (line.startsWith("  - ") && curList) { curList.push(line.slice(4).trim().replace(/^"(.*)"$/, "$1")); continue; }
    const k = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!k) continue;
    const key = k[1]; const val = k[2].trim();
    if (val === "") { curList = []; fm[key] = curList; }
    else { fm[key] = val.replace(/^"(.*)"$/, "$1").replace(/^\[(.*)\]$/, "$1"); curList = null; }
  }
  return { fm, body: m[2] };
}

function chunkBody(body) {
  const lines = body.split("\n");
  const chunks = [];
  let current = { h: "intro", t: "" };
  for (const line of lines) {
    const m2 = line.match(/^##\s+(.+)$/);
    const m3 = line.match(/^###\s+(.+)$/);
    if (m2 || m3) {
      if (current.t.trim()) chunks.push({ h: current.h, t: current.t.trim() });
      current = { h: (m2 || m3)[1].trim(), t: "" };
    } else {
      current.t += line + "\n";
    }
  }
  if (current.t.trim()) chunks.push({ h: current.h, t: current.t.trim() });
  return chunks;
}

function hash(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex").slice(0, 10);
}

// First pass: count paragraph frequencies (for dedup)
const files = walk(KB_DIR);
const paraCounts = new Map();
const parsedArticles = [];
for (const fp of files) {
  const raw = readFileSync(fp, "utf8");
  const parsed = parseFrontmatter(raw);
  if (!parsed) continue;
  const chunks = chunkBody(parsed.body);
  parsedArticles.push({ fp, fm: parsed.fm, chunks });
  for (const c of chunks) {
    // Split chunk into paragraphs
    const paras = c.t.split(/\n\n+/);
    for (const p of paras) {
      if (p.length < 60) continue; // not worth dedup-ing small fragments
      const h = hash(p);
      paraCounts.set(h, (paraCounts.get(h) || 0) + 1);
    }
  }
}

// Second pass: replace repeated paragraphs (count >= 2) with references
const fragments = {};
const articles = [];
let totalChunks = 0;
for (const { fm, chunks } of parsedArticles) {
  const slimChunks = chunks.map(c => {
    const paras = c.t.split(/\n\n+/);
    const refs = paras.map(p => {
      if (p.length < 60) return { t: p };
      const h = hash(p);
      if ((paraCounts.get(h) || 0) >= 2) {
        if (!(h in fragments)) fragments[h] = p;
        return { r: h };
      }
      return { t: p };
    });
    // If single para and not deduped, just inline as text
    if (refs.length === 1 && refs[0].t !== undefined) {
      return { h: c.h, t: refs[0].t };
    }
    return { h: c.h, p: refs };
  });
  totalChunks += slimChunks.length;
  articles.push({
    id: fm.id,
    t: fm.title,
    cat: fm.category,
    lvl: fm.support_level,
    kw: Array.isArray(fm.keywords) ? fm.keywords.slice(0, 12) : [],
    tg: fm.tech_generation || "current",
    cs: slimChunks
  });
}

mkdirSync(dirname(OUT), { recursive: true });
const bundle = {
  s: "aria-kb-v3-slim",
  v: "3.0",
  built: new Date().toISOString(),
  n: articles.length,
  c: totalChunks,
  f: Object.keys(fragments).length,
  frag: fragments,
  arts: articles
};
writeFileSync(OUT, JSON.stringify(bundle));
const sizeKb = (statSync(OUT).size / 1024).toFixed(1);
console.log(`v3 SLIM: ${articles.length} articles, ${totalChunks} chunks, ${Object.keys(fragments).length} dedup fragments -> ${sizeKb} KB`);
