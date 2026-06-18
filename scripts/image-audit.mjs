#!/usr/bin/env node
/**
 * image-audit.mjs — Audit all image files in /assets for size + recommend optimizations
 *  Reports: total bytes, files >500KB, files lacking webp counterpart
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, '..', 'assets');

if (!fs.existsSync(ASSETS)) {
  console.log('No assets dir');
  process.exit(0);
}

const exts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);
const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (exts.has(path.extname(e.name).toLowerCase())) {
      const stats = fs.statSync(p);
      files.push({ path: path.relative(ASSETS, p), size: stats.size, ext: path.extname(e.name).toLowerCase() });
    }
  }
}
walk(ASSETS);

files.sort((a, b) => b.size - a.size);
const totalKB = files.reduce((a, f) => a + f.size, 0) / 1024;
const large = files.filter(f => f.size > 500 * 1024);

console.log('Image audit:');
console.log('  Total images:', files.length);
console.log('  Total size:', totalKB.toFixed(1), 'KB (' + (totalKB / 1024).toFixed(2) + ' MB)');
console.log('  Large files (>500KB):', large.length);
if (large.length > 0) {
  console.log('  Top 5 largest:');
  large.slice(0, 5).forEach(f => console.log('    -', f.path, '(' + (f.size / 1024).toFixed(0) + ' KB)'));
}

// Check for missing .webp counterparts
const png_jpg = files.filter(f => f.ext === '.png' || f.ext === '.jpg' || f.ext === '.jpeg');
const webp_set = new Set(files.filter(f => f.ext === '.webp').map(f => f.path.replace(/\.webp$/, '')));
const missing_webp = png_jpg.filter(f => !webp_set.has(f.path.replace(/\.(png|jpg|jpeg)$/, '')));
console.log('  PNG/JPG without WebP counterpart:', missing_webp.length);
if (missing_webp.length > 0 && missing_webp.length < 20) {
  missing_webp.forEach(f => console.log('    -', f.path));
}

// Suggest action
if (totalKB > 5000) console.log('\nRecommendation: total assets > 5MB. Run image optimization (sharp / squoosh).');
if (large.length > 0) console.log('Recommendation: large files dominate. Compress to <500KB each or move to CDN.');
