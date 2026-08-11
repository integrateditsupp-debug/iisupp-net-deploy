#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const KB_DIR = join(REPO_ROOT, "knowledge-base");
const OUT = join(REPO_ROOT, "assets/aria-kb-local-bundle.json");

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

function summary(body) {
  for (const ln of body.split("\n")) {
    if (ln.startsWith("#") || !ln.trim()) continue;
    return ln.trim().slice(0, 200);
  }
  return "";
}

// DEFECT-221 fix (Cowork 2026-08-06): 99 of 281 articles carry a NEWER frontmatter
// schema that has no explicit `id:` (tier3-hybrid + the 5 vertical packs), and 4 ids are
// duplicated across knowledge-base/L1/ and knowledge-base/top50-gaps/. Both left ARIA
// unable to cite ~35% of the KB. Fixed at BUILD time only — no source article is edited,
// renamed, or removed (RULE 15). Derivation is deterministic and filename-driven:
//   l3-aadconnect-001-group-memberships-lost-overnight.md -> l3-aadconnect-001
//   l1-edu-001.md                                          -> l1-edu-001
// On collision the FIRST article keeps the short id and later ones fall back to the full
// (already unique) basename, so every article ends up with a stable, citable id.
function baseName(fp) {
  return fp.split(/[\\/]/).pop().replace(/\.md$/, "");
}
function shortIdFromFilename(fp) {
  const base = baseName(fp);
  const m = base.match(/^(l[0-9]+-[a-z0-9]+(?:-[a-z0-9]+)*?-[0-9]{3})(?:-|$)/i);
  return m ? m[1] : base;
}

const files = walk(KB_DIR);
const articles = [];
for (const fp of files) {
  const raw = readFileSync(fp, "utf8");
  const parsed = parseFrontmatter(raw);
  if (!parsed) continue;
  const { fm, body } = parsed;
  articles.push({
    id: fm.id, title: fm.title, category: fm.category,
    support_level: fm.support_level, severity: fm.severity,
    keywords: Array.isArray(fm.keywords) ? fm.keywords : (typeof fm.keywords === "string" ? fm.keywords.split(",").map(s => s.trim()) : []),
    related_articles: Array.isArray(fm.related_articles) ? fm.related_articles : [],
    tech_generation: fm.tech_generation || "current",
    year_range: fm.year_range || "",
    eol_status: fm.eol_status || "",
    last_updated: fm.last_updated || "",
    version: fm.version || "1.0",
    summary: summary(body),
    body_md: body,
    path: fp.replace(REPO_ROOT, "").replace(/^\//, "")
  });
}

// --- DEFECT-221: guarantee every article has a unique, citable id -------------------
const usedIds = new Set();
const idRepairs = { derived: 0, deduped: 0 };
for (const a of articles) {
  let id = (a.id || "").trim();
  if (!id) { id = shortIdFromFilename(a.path); idRepairs.derived++; }
  if (usedIds.has(id)) {
    const full = baseName(a.path);
    id = usedIds.has(full) ? `${full}-${usedIds.size}` : full;
    idRepairs.deduped++;
  }
  usedIds.add(id);
  a.id = id;
}

mkdirSync(dirname(OUT), { recursive: true });
const bundle = {
  version: "1.4", generated: new Date().toISOString(), article_count: articles.length,
  schema: "aria-kb-local-bundle/v1", source_repo: "integrateditsupp-debug/iisupp-net-deploy",
  articles
};
writeFileSync(OUT, JSON.stringify(bundle));
const sizeKb = (statSync(OUT).size / 1024).toFixed(1);
console.log("Built", articles.length, "articles ->", OUT, "(" + sizeKb + " KB)");
console.log("  id repair: derived-from-filename =", idRepairs.derived, "| de-duplicated =", idRepairs.deduped, "| unique ids =", usedIds.size);
