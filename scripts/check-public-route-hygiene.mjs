import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const skipDirs = new Set(['.git', 'node_modules', 'backups', 'archive', 'artifacts', 'outputs']);
// DEFECT-222 scope fix (Cowork 2026-08-06): this gate checks PUBLIC ROUTE hygiene, but it
// was also walking vendored third-party HTML and packaged build output — Python venv
// site-packages, and the Electron win-unpacked LICENSES.chromium.html shipped inside
// ARIA Sentinel/dist*. Their internal anchors are not site routes, and the ~150 phantom
// missingRefs they produced buried the handful of REAL ones. Nothing is deleted and no
// check is weakened (RULE 15): these directories are out of scope, and the count of what
// was skipped is printed in the report so the exclusion stays honest and visible.
// tmp/ is gitignored, ephemeral test scratch (run-tests-*/as3-action-*/index.html fixtures);
// it never publishes, so its throwaway /a.html-style anchors are not site routes either.
const skipDirPatterns = [
  /^venv$/i,
  /^\.venv$/i,
  /^site-packages$/i,
  /^win-unpacked$/i,
  /^dist(\.|$)/i,
  /^tmp$/i,
];
let scopeSkippedDirs = 0;
const isOutOfScopeDir = (name) => {
  if (skipDirPatterns.some((re) => re.test(name))) { scopeSkippedDirs++; return true; }
  return false;
};
const missingRefs = [];
const invalidJsonLd = [];
const sitemapIssues = [];
const securityTxtIssues = [];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (skipDirs.has(ent.name)) continue;
      if (isOutOfScopeDir(ent.name)) continue;
      walk(path.join(dir, ent.name), files);
    } else if (ent.isFile() && ent.name.endsWith('.html')) {
      files.push(path.join(dir, ent.name));
    }
  }
  return files;
}

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function normalizeRoute(route) {
  if (!route) return '/';
  const clean = route.replace(/\/$/, '');
  return clean || '/';
}

function parseRedirects() {
  const toml = read(path.join(root, 'netlify.toml'));
  const ok = new Set();
  const blocked = new Set();
  for (const block of toml.split(/\[\[redirects\]\]/g).slice(1)) {
    const from = block.match(/from\s*=\s*"([^"]+)"/)?.[1];
    const status = Number(block.match(/status\s*=\s*(\d+)/)?.[1] || 0);
    if (!from) continue;
    if (status === 200) ok.add(normalizeRoute(from));
    if (status === 404) blocked.add(normalizeRoute(from));
  }
  return { ok, blocked };
}

function parseFunctionRoutes() {
  const routes = new Set();
  const dir = path.join(root, 'netlify', 'functions');
  if (!fs.existsSync(dir)) return routes;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isFile()) continue;
    const text = read(path.join(dir, ent.name));
    const configured = text.match(/config\s*=\s*\{\s*path:\s*['"]([^'"]+)['"]/);
    if (configured) routes.add(normalizeRoute(configured[1]));
    const base = ent.name.replace(/\.(mjs|js)$/i, '');
    if (base) routes.add(normalizeRoute(`/.netlify/functions/${base}`));
  }
  return routes;
}

function parseRobots() {
  const text = read(path.join(root, 'robots.txt'));
  const groups = [];
  let current = { agents: [], allows: [], disallows: [] };
  let hasRule = false;
  for (const line of text.split(/\r?\n/)) {
    const clean = line.replace(/#.*/, '').trim();
    if (!clean) continue;
    const agent = clean.match(/^User-agent:\s*(\S+)/i)?.[1];
    if (agent) {
      if (current.agents.length && hasRule) {
        groups.push(current);
        current = { agents: [], allows: [], disallows: [] };
        hasRule = false;
      }
      current.agents.push(agent.toLowerCase());
      continue;
    }
    const allow = clean.match(/^Allow:\s*(\S*)/i)?.[1];
    const disallow = clean.match(/^Disallow:\s*(\S*)/i)?.[1];
    if (allow !== undefined) {
      hasRule = true;
      if (allow) current.allows.push(allow);
    }
    if (disallow !== undefined) {
      hasRule = true;
      if (disallow) current.disallows.push(disallow);
    }
  }
  if (current.agents.length || hasRule) groups.push(current);
  return groups.find((group) => group.agents.includes('*')) || { allows: [], disallows: [] };
}

function robotAllows(route, robots) {
  let best = { len: -1, allow: true };
  for (const rule of robots.disallows) {
    if (route.startsWith(rule) && rule.length > best.len) best = { len: rule.length, allow: false };
  }
  for (const rule of robots.allows) {
    if (route.startsWith(rule) && rule.length > best.len) best = { len: rule.length, allow: true };
  }
  return best.allow;
}

function localFileExists(route) {
  const target = path.join(root, route.replace(/^\//, ''));
  return fs.existsSync(target) ||
    fs.existsSync(`${target}.html`) ||
    fs.existsSync(path.join(target, 'index.html'));
}

function routeExists(route, redirects, functionRoutes) {
  const clean = normalizeRoute(route);
  return redirects.ok.has(clean) || functionRoutes.has(clean) || localFileExists(route);
}

function refIsExternal(ref) {
  return /^(https?:|mailto:|tel:|javascript:|data:|blob:|about:)/i.test(ref);
}

function checkHtmlRefs(htmlFiles, redirects, functionRoutes) {
  const attrRe = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  for (const file of htmlFiles) {
    const html = read(file);
    let m;
    while ((m = attrRe.exec(html))) {
      const ref = m[1].trim();
      if (!ref || ref.startsWith('#') || ref.includes('${') || refIsExternal(ref)) continue;
      if (ref.startsWith('/.netlify/')) continue;
      const route = ref.split('#')[0].split('?')[0];
      if (!route || route === '/') continue;
      const clean = normalizeRoute(route);
      if (redirects.ok.has(clean) || functionRoutes.has(clean)) continue;
      const target = route.startsWith('/')
        ? path.join(root, route.slice(1))
        : path.resolve(path.dirname(file), route);
      const ok = fs.existsSync(target) || fs.existsSync(`${target}.html`) || fs.existsSync(path.join(target, 'index.html'));
      if (!ok) missingRefs.push({ file: path.relative(root, file), ref });
    }
  }
}

function checkJsonLd(htmlFiles) {
  const re = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const file of htmlFiles) {
    const html = read(file);
    let m;
    let index = 0;
    while ((m = re.exec(html))) {
      index += 1;
      try {
        JSON.parse(m[1]);
      } catch (error) {
        invalidJsonLd.push({ file: path.relative(root, file), block: index, error: error.message });
      }
    }
  }
}

function checkSitemap(redirects, functionRoutes, robots) {
  const sitemap = read(path.join(root, 'sitemap.xml'));
  for (const loc of sitemap.matchAll(/<loc>https:\/\/iisupp\.net([^<]*)<\/loc>/g)) {
    const route = normalizeRoute(loc[1].split('?')[0]);
    if (!robotAllows(route, robots)) {
      sitemapIssues.push({ route, issue: 'blocked by robots.txt' });
      continue;
    }
    if (redirects.ok.has(route) || functionRoutes.has(route) || localFileExists(route)) continue;
    sitemapIssues.push({ route, issue: 'no static file, redirect, or function route found' });
  }
}

function checkSecurityTxt(redirects, functionRoutes) {
  const file = path.join(root, '.well-known', 'security.txt');
  const text = read(file);
  if (!text) return;
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(Contact|Canonical|Policy|Acknowledgments|Hiring|Encryption):\s*(\S+)/);
    if (!match) continue;
    const field = match[1];
    const value = match[2];
    if (value.startsWith('mailto:')) continue;
    let url;
    try {
      url = new URL(value);
    } catch {
      securityTxtIssues.push({ field, value, issue: 'invalid URL' });
      continue;
    }
    if (url.hostname !== 'iisupp.net') continue;
    const route = normalizeRoute(url.pathname);
    if (!routeExists(route, redirects, functionRoutes)) {
      securityTxtIssues.push({ field, route, issue: 'no static file, redirect, or function route found' });
      continue;
    }
    if (field === 'Encryption') {
      const keyText = read(path.join(root, route.replace(/^\//, '')));
      if (!keyText.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----')) {
        securityTxtIssues.push({ field, route, issue: 'encryption URL is not an armored PGP public key' });
      }
    }
  }
}

const htmlFiles = walk(root);
const redirects = parseRedirects();
const functionRoutes = parseFunctionRoutes();
const robots = parseRobots();

checkHtmlRefs(htmlFiles, redirects, functionRoutes);
checkJsonLd(htmlFiles);
checkSitemap(redirects, functionRoutes, robots);
checkSecurityTxt(redirects, functionRoutes);

const report = {
  scannedHtmlFiles: htmlFiles.length,
  outOfScopeDirsSkipped: scopeSkippedDirs,
  redirects: redirects.ok.size,
  functionRoutes: functionRoutes.size,
  missingRefs,
  invalidJsonLd,
  sitemapIssues,
  securityTxtIssues
};

console.log(JSON.stringify(report, null, 2));

if (missingRefs.length || invalidJsonLd.length || sitemapIssues.length || securityTxtIssues.length) {
  process.exitCode = 1;
}
