// RUN-C C1 — FUNNEL LINK GUARD. The "zero dead ends" guarantee for the conversion path and the whole
// public site. Fails CI if any customer-facing page gains a dead internal link, or if the core funnel
// chain (Home -> Try ARIA -> pilot/next-step -> plans/checkout) loses a step. Honest, static, no network.
// (Rule 14: this only asserts what is really in the shipped HTML + netlify.toml — no fabricated state.)
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

// --- parse netlify.toml redirect table (ordered from/to/status triples) ---
const toml = read("netlify.toml");
const redirects = [];
{
  const re = /from\s*=\s*"([^"]+)"\s*\n\s*to\s*=\s*"([^"]+)"\s*\n\s*status\s*=\s*(\d+)/g;
  let m; while ((m = re.exec(toml))) redirects.push({ from: m[1], to: m[2], status: Number(m[3]) });
}
const fileExists = (rel) => { try { return fs.statSync(path.join(ROOT, rel)).isFile(); } catch { return false; } };
const decode = (p) => { try { return decodeURIComponent(p); } catch { return p; } };
const isDynamic = (h) => /\$\{|\{\{|`|'\s*\+|\+\s*'|"\s*\+|\+\s*"|\s\+\s/.test(h);
function matchRedirect(rp) {
  for (const r of redirects) {
    if (r.from.endsWith("/*")) { const pre = r.from.slice(0, -2); if (rp === pre || rp.startsWith(pre + "/")) return r; }
    else if (r.from === rp) return r;
  }
  return null;
}
// resolve an internal link target -> { ok, reason }
function resolveTarget(raw, dir) {
  let href = raw.trim();
  if (!href) return { ok: true };
  if (/^(https?:|mailto:|tel:|data:|javascript:|sms:)/i.test(href)) return { ok: true };
  if (href.startsWith("//")) return { ok: true };
  if (href.startsWith("/.netlify/functions/")) return { ok: true }; // live serverless invocation path
  if (isDynamic(href)) return { ok: true };                          // JS template / concatenated href
  const hi = href.indexOf("#"); if (hi >= 0) href = href.slice(0, hi);
  const qi = href.indexOf("?"); if (qi >= 0) href = href.slice(0, qi);
  if (href === "") return { ok: true };
  let rp = href.startsWith("/") ? href : "/" + path.normalize(path.join(dir, href)).replace(/^\/+/, "");
  rp = decode(rp);
  const rel = rp.replace(/^\/+/, "");
  if (rel === "" || rp === "/") return fileExists("index.html") ? { ok: true } : { ok: false, reason: "no index.html" };
  if (fileExists(rel)) return { ok: true };
  if (fileExists(rel + ".html")) return { ok: true };
  if (fileExists(rel.replace(/\/$/, "") + "/index.html")) return { ok: true };
  const r = matchRedirect(rp);
  if (r) { if (r.status === 404) return { ok: false, reason: `routes to a 404-blocked path (${r.from})` }; return { ok: true }; }
  return { ok: false, reason: `unresolved route ${rp}` };
}
// strict: real navigational href / form action only — NOT data-action / data-href
const extract = (html) => { const out = []; const re = /(?<![\w-])(?:href|action)\s*=\s*"([^"]*)"/gi; let m; while ((m = re.exec(html))) out.push(m[1]); return out; };
const SKIP = /^(node_modules|archive|backups|aria-vault|\.git|outputs|senior-director-state|tests|scripts|apps|ARIA Sentinel|aria_brain_pack|aria-architecture|design-handoff)(\/|$)/;
// Depth-independent skips. The top-level SKIP list is anchored at `^`, so it never matched dependency
// trees or build output nested deeper down — e.g. `.netlify/functions-serve/*/node_modules`. Walking
// those took the guard past 6,600 directories without finishing, which is what stopped `npm test` from
// ever completing. None of these directories are the shipped public site, so excluding them at any
// depth narrows the walk to exactly what this guard is meant to assert on and does not weaken it.
const SKIP_DIR_ANY_DEPTH = new Set([
  "node_modules",     // dependency trees (top level and vendored copies under build output)
  ".git",             // repository internals
  ".netlify",         // Netlify build/bundle output — generated, never authored, never served as pages
  ".codex-temp-cdp",  // agent scratch directory
  ".cache",
]);
function walk(d, acc) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const fp = path.join(d, e.name);
    const rel = path.relative(ROOT, fp);
    if (SKIP.test(rel)) continue;
    if (e.isDirectory() && SKIP_DIR_ANY_DEPTH.has(e.name)) continue;
    if (e.isDirectory()) walk(fp, acc);
    else if (e.name.endsWith(".html")) acc.push(rel);
  }
  return acc;
}

// 1 — ZERO DEAD ENDS across every customer-facing page.
// A page that is itself force-404'd by netlify.toml is, by definition, not customer-facing — nobody can
// reach it, so a broken link inside it is not a dead end for any visitor. Scanning those pages produced
// false failures from directories the site deliberately does not serve (`/_branch-src/*`, `/odysseus/*`)
// and from vendored third-party documentation that ships inside a Python virtualenv. Filtering them here
// keeps the assertion aimed at the real public site instead of weakening the zero-dead-ends rule.
const isVendored = (rel) => rel.split("/").some((seg) => seg === "venv" || seg === "site-packages");
const isBlockedFromServing = (rel) => {
  const r = matchRedirect("/" + rel);
  return Boolean(r && r.status === 404);
};
const allPages = walk(ROOT, []);
const skippedPages = allPages.filter((f) => isVendored(f) || isBlockedFromServing(f));
const pages = allPages.filter((f) => !isVendored(f) && !isBlockedFromServing(f));
assert.ok(pages.length > 50, `expected to scan the public site (>50 pages), saw ${pages.length}`);
const dead = [];
for (const f of pages) {
  const html = read(f);
  const dir = path.dirname("/" + f).replace(/^\//, "");
  for (const h of extract(html)) {
    const res = resolveTarget(h, dir);
    if (!res.ok) dead.push(`${f}: "${h}" — ${res.reason}`);
  }
}
assert.equal(dead.length, 0, `Dead internal links found (funnel/site must have zero dead ends):\n  ${dead.join("\n  ")}`);

// 2 — the conversion CHAIN is intact, step by step (each step's next hop really exists in the HTML).
const home = read("index.html");
assert.ok(/href="\/aria"/.test(home), "Home must link to /aria (Try ARIA web step)");
assert.ok(fileExists("aria.html"), "the /aria page must exist");

const aria = read("aria.html");
assert.ok(/contact=1/.test(aria) || /href="\/start-here\.html"/.test(aria),
  "the /aria page must offer a next step toward a pilot (staged contact intake or start-here)");
assert.ok(/pilot/i.test(aria), "the /aria page must present the pilot motion");

const plans = read("plans/index.html");
assert.ok(/mailto:ahmad\.wasee@iisupp\.net/.test(plans), "/plans must carry the live sales contact path");
assert.ok(/checkout/i.test(plans) || /subscribe/i.test(plans), "/plans must expose a checkout/subscribe affordance");

// 3 — REGRESSION LOCKS for the C1 fixes (these exact dead ends must never come back).
for (const f of pages) {
  assert.ok(!read(f).includes("/contact.html"), `${f} links to /contact.html which does not exist — use the mailto sales path`);
}
assert.ok(read("compliance/index.html").includes("/governance/ai-use"), "compliance hub must link AI Governance to the real /governance/ai-use page");
assert.ok(read("compliance/automated-decisions.html").includes("/governance/ai-use"), "automated-decisions must link AI Governance to /governance/ai-use");
for (const f of ["checkout-success.html", "downloads/index.html"]) {
  const h = read(f);
  assert.ok(!/href="\/favicon\.(ico|png)"/.test(h), `${f} references a missing favicon asset — use /favicon.svg`);
}
assert.ok(fileExists("favicon.svg"), "favicon.svg (the real icon asset) must exist");
assert.ok(/from = "\/ai-governance"/.test(toml), "netlify.toml must keep the /ai-governance -> /governance/ai-use redirect");

console.log(`funnel-link-guard test passed (${pages.length} public pages · 0 dead internal links · Home->/aria->pilot->/plans chain intact · C1 fixes locked: no /contact.html, AI-Governance->/governance/ai-use, favicon.svg).`);
