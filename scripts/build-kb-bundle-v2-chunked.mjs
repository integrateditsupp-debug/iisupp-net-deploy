#!/usr/bin/env node
// Chunked bundle builder — v2 schema
// Splits article body_md into H2/H3 boundary chunks, dedupes shared boilerplate
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const KB_DIR = join(REPO_ROOT, "knowledge-base");
const OUT = join(REPO_ROOT, "assets/aria-kb-local-bundle-v2.json");

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

// Split markdown body on H2 (##) and H3 (###) headings, return chunks
function chunkBody(body) {
  const lines = body.split("\n");
  const chunks = [];
  let current = { heading: "intro", text: "" };
  for (const line of lines) {
    const m2 = line.match(/^##\s+(.+)$/);
    const m3 = line.match(/^###\s+(.+)$/);
    if (m2 || m3) {
      if (current.text.trim()) chunks.push({ heading: current.heading, text: current.text.trim() });
      current = { heading: (m2 || m3)[1].trim(), text: "" };
    } else {
      current.text += line + "\n";
    }
  }
  if (current.text.trim()) chunks.push({ heading: current.heading, text: current.text.trim() });
  return chunks;
}

const STOPWORDS = new Set(["the","a","an","of","to","in","on","is","are","was","were","be","and","or","for","by","at","with","that","this","it","its","as","you","your"]);
function chunkKeywords(text) {
  const tokens = text.toLowerCase().replace(/[^a-z0-9\s\-]/g, " ").split(/\s+/).filter(t => t.length > 3 && !STOPWORDS.has(t));
  const freq = {};
  tokens.forEach(t => freq[t] = (freq[t]||0)+1);
  return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,8).map(x=>x[0]);
}

// Dedup boilerplate — shared phrasing across articles
const sharedFragments = new Map(); // hash → text
function maybeDedupChunk(text) {
  // Only dedup chunks above 200 chars (worth it) that contain common phrases
  if (text.length < 200) return { text };
  const isBoilerplate = /When to escalate|What ARIA can help with|Prevention/i.test(text.slice(0, 100));
  if (!isBoilerplate) return { text };
  const hash = crypto.createHash("sha256").update(text).digest("hex").slice(0, 12);
  sharedFragments.set(hash, text);
  return { fragment_ref: hash };
}

const files = walk(KB_DIR);
const articles = [];
let totalChunks = 0;
for (const fp of files) {
  const raw = readFileSync(fp, "utf8");
  const parsed = parseFrontmatter(raw);
  if (!parsed) continue;
  const { fm, body } = parsed;
  const rawChunks = chunkBody(body);
  const chunks = rawChunks.map((c, i) => {
    const dedup = maybeDedupChunk(c.text);
    return {
      id: `${fm.id}#${i}`,
      heading: c.heading,
      keywords: chunkKeywords(c.heading + " " + c.text),
      tokens_est: Math.round(c.text.length / 4),
      ...(dedup.fragment_ref ? { fragment_ref: dedup.fragment_ref } : { text: c.text })
    };
  });
  totalChunks += chunks.length;
  articles.push({
    id: fm.id, title: fm.title, category: fm.category,
    support_level: fm.support_level, severity: fm.severity,
    keywords: Array.isArray(fm.keywords) ? fm.keywords : [],
    related_articles: Array.isArray(fm.related_articles) ? fm.related_articles : [],
    tech_generation: fm.tech_generation || "current",
    chunk_count: chunks.length,
    chunks
  });
}

// Convert sharedFragments to object for serialization
const fragments = Object.fromEntries(sharedFragments);

mkdirSync(dirname(OUT), { recursive: true });
const bundle = {
  schema: "aria-kb-local-bundle/v2-chunked",
  version: "2.0",
  generated: new Date().toISOString(),
  article_count: articles.length,
  total_chunks: totalChunks,
  fragment_count: sharedFragments.size,
  fragments,
  articles
};
writeFileSync(OUT, JSON.stringify(bundle));
const sizeKb = (statSync(OUT).size / 1024).toFixed(1);
console.log(`v2 Chunked: ${articles.length} articles, ${totalChunks} chunks, ${sharedFragments.size} deduped fragments -> ${sizeKb} KB`);
