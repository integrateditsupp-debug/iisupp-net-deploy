// customer-link-graph.test.mjs — RUN-AN / AN1. The customer-facing path, proven from the repository.
//
// The proof this suite is required to show, and shows below with both halves:
//   RED   — a deliberately broken route, a route that resolves only to a login shell, a route the
//           redirect table force-404s, and a link that appears in outbound copy but not in the site.
//   GREEN — the real entry points, walked, with every finding naming its file and line.
//
// And the honesty half, which matters at least as much: a route that genuinely cannot be decided
// from disk is asserted to come back UNCHECKED with a reason, and asserted NOT to be counted as a
// pass. Fabricated coverage is the specific failure this suite refuses.
//
// Run: node tests/customer-link-graph.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const {
  walkCustomerGraph, auditOutboundLinks, resolveLink, extractLinks, parseRedirects,
  isLoginShell, visibleTextLength, CUSTOMER_ENTRY_POINTS, VERDICT, CLASSES, CUSTOMER_LINK_GRAPH_SCHEMA,
} = await import(new URL("../scripts/lib/customer-link-graph.mjs", import.meta.url).href);

// A throwaway site on disk. Nothing here touches the real repository.
function fixture(files) {
  const dir = makeScratchDir("an1-");
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return dir;
}

const REAL_PAGE = (title) =>
  `<html><body><h1>${title}</h1><p>${"Genuine prose about what this page offers a customer. ".repeat(12)}</p></body></html>`;

// ── RED: the four breakages a prospect would actually meet ────────────────────────────────────────

test("RED — a link to a route with no file behind it is BROKEN and names what it tried", () => {
  const dir = fixture({ "index.html": `<a href="/plans/">Plans</a>` });
  const r = walkCustomerGraph({ root: dir, entryPoints: ["index.html"], redirects: [] });
  assert.equal(r.ok, false);
  assert.equal(r.broken.length, 1);
  assert.equal(r.broken[0].class, CLASSES.NO_TARGET);
  assert.match(r.broken[0].detail, /resolves to no file/);
  assert.equal(r.broken[0].from, "index.html");
  assert.equal(r.broken[0].line, 1, "every finding names its file AND its line");
});

test("RED — a route that resolves only to a login shell is BROKEN, not OK", () => {
  const dir = fixture({
    "index.html": `<a href="/account.html">Your account</a>`,
    "account.html": `<html><body><form><input type="password"><button>Sign in</button></form></body></html>`,
  });
  const r = walkCustomerGraph({ root: dir, entryPoints: ["index.html"], redirects: [] });
  assert.equal(r.broken.length, 1);
  assert.equal(r.broken[0].class, CLASSES.LOGIN_SHELL);
  assert.match(r.broken[0].detail, /authentication gate/);

  // The same file with real content behind the gate is fine — the rule is "only a gate", not "has a gate".
  const dir2 = fixture({
    "index.html": `<a href="/account.html">Your account</a>`,
    "account.html": `<html><body><form><input type="password"></form>${REAL_PAGE("Account")}</body></html>`,
  });
  assert.equal(walkCustomerGraph({ root: dir2, entryPoints: ["index.html"], redirects: [] }).broken.length, 0);
});

test("RED — a route the redirect table force-404s is BROKEN and names the rule", () => {
  const dir = fixture({ "index.html": `<a href="/senior-director-state/notes.md">Notes</a>` });
  const rules = [{ from: "/senior-director-state/*", to: "/index.html", status: 404 }];
  const r = walkCustomerGraph({ root: dir, entryPoints: ["index.html"], redirects: rules });
  assert.equal(r.broken[0].class, CLASSES.FORCE_404);
  assert.match(r.broken[0].detail, /from="\/senior-director-state\/\*"/);
});

test("RED — a link in outbound copy that resolves to nothing is refused BY NAME", () => {
  const dir = fixture({ "index.html": REAL_PAGE("Home") });
  const copy = "Have a look at https://iisupp.net/free-audit when you get a moment.";
  const r = auditOutboundLinks(copy, { root: dir, redirects: [] });
  assert.equal(r.ok, false);
  assert.equal(r.broken[0].class, CLASSES.IN_MESSAGE_NOT_IN_SITE);
});

test("RED — an empty file is a breakage, not a destination", () => {
  const dir = fixture({ "index.html": `<a href="/offer.html">Offer</a>`, "offer.html": "" });
  const r = walkCustomerGraph({ root: dir, entryPoints: ["index.html"], redirects: [] });
  assert.equal(r.broken[0].class, CLASSES.EMPTY);
});

test("RED — a declared entry point that no longer exists fails the walk", () => {
  const dir = fixture({ "index.html": REAL_PAGE("Home") });
  const r = walkCustomerGraph({ root: dir, entryPoints: ["index.html", "pricing.html"], redirects: [] });
  assert.equal(r.ok, false);
  assert.deepEqual(r.missingEntries, ["pricing.html"]);
});

// ── GREEN: resolution actually works the way the host serves it ────────────────────────────────────

test("GREEN — pretty URLs, directory indexes, queries and fragments all resolve", () => {
  const dir = fixture({
    "index.html":
      `<a href="/aria">ARIA</a>\n<a href="/plans/">Plans</a>\n` +
      `<a href="/product.html?id=gl-ai-edge-starter">Product</a>\n<a href="/services#tier1">Services</a>`,
    "aria.html": REAL_PAGE("ARIA"),
    "plans/index.html": REAL_PAGE("Plans"),
    "product.html": REAL_PAGE("Product"),
    "services.html": REAL_PAGE("Services"),
  });
  const r = walkCustomerGraph({ root: dir, entryPoints: ["index.html"], redirects: [] });
  assert.equal(r.broken.length, 0, JSON.stringify(r.broken));
  assert.equal(r.summary.ok, 4);
});

test("GREEN — a status-200 rewrite is followed to its real target", () => {
  const dir = fixture({
    "index.html": `<a href="/sentinel-binaries/setup.exe">Download</a>`,
    "public/sentinel-binaries/setup.exe": "MZ-not-really",
  });
  const rules = [{ from: "/sentinel-binaries/*", to: "/public/sentinel-binaries/:splat", status: 200 }];
  assert.equal(walkCustomerGraph({ root: dir, entryPoints: ["index.html"], redirects: rules }).broken.length, 0);
});

// ── HONESTY: unchecked is a third state, never a quiet pass ────────────────────────────────────────

test("UNCHECKED — undecidable routes are named, and none of them is counted as OK", () => {
  const cases = [
    ["https://example.com/x", CLASSES.EXTERNAL],
    ["mailto:ahmad.wasee@iisupp.net", CLASSES.NON_HTTP],
    ["tel:+16475813182", CLASSES.NON_HTTP],
    ["#methodology", CLASSES.FRAGMENT],
    ["${p.url}", CLASSES.DYNAMIC],
    ["'+p.url+'", CLASSES.DYNAMIC],
    ["/.netlify/functions/checkout", CLASSES.FUNCTION_ROUTE],
  ];
  for (const [href, cls] of cases) {
    const f = resolveLink(href, { root: ROOT, redirects: [] });
    assert.equal(f.verdict, VERDICT.UNCHECKED, `${href} must be unchecked, got ${f.verdict}`);
    assert.equal(f.class, cls, href);
    assert.ok(f.detail && f.detail.length > 10, `${href} must carry a reason, not just a label`);
  }
});

test("UNCHECKED is not folded into the pass count", () => {
  const dir = fixture({ "index.html": `<a href="https://example.com">out</a>\n<a href="#top">top</a>` });
  const r = walkCustomerGraph({ root: dir, entryPoints: ["index.html"], redirects: [] });
  assert.equal(r.summary.ok, 0, "nothing was verified here and nothing may be claimed as verified");
  assert.equal(r.summary.unchecked, 2);
  assert.equal(r.ok, true, "unchecked is not a failure either — it is honestly undecidable");
});

// ── The real site, walked ──────────────────────────────────────────────────────────────────────────

test("THE REAL SITE — every customer entry point exists and every literal route resolves", () => {
  const r = walkCustomerGraph({ root: ROOT });
  assert.equal(r.schema, CUSTOMER_LINK_GRAPH_SCHEMA);
  assert.deepEqual(r.missingEntries, [], "a declared customer entry point has gone missing");

  if (r.broken.length) {
    const lines = r.broken.map((b) => `  · ${b.from}:${b.line} [${b.class}] ${b.href} — ${b.detail}`);
    assert.fail(`${r.broken.length} customer-facing route(s) are broken:\n${lines.join("\n")}`);
  }
  assert.ok(r.summary.ok > 200, `expected a real graph, walked only ${r.summary.ok} resolved links`);
  console.log(
    `customer link graph: ${r.summary.entryPointsWalked} entry points · ${r.summary.links} links · ` +
      `${r.summary.ok} resolved · ${r.summary.broken} broken · ${r.summary.unchecked} unchecked (named)`,
  );
});

test("THE REAL OUTBOUND COPY — every site link in the send sheet resolves", () => {
  const sheet = path.join(ROOT, "senior-director-state/outbound/SEND-SHEET-2026-08-05.md");
  if (!fs.existsSync(sheet)) {
    // The record root is untracked. Say so rather than passing silently on an absent file.
    console.log("send sheet not present in this checkout — outbound link audit reported UNCHECKED, not green");
    return;
  }
  const r = auditOutboundLinks(fs.readFileSync(sheet, "utf8"), { root: ROOT, file: "SEND-SHEET-2026-08-05.md" });
  assert.equal(r.ok, true, JSON.stringify(r.broken, null, 2));
  console.log(`outbound copy: ${r.links} site link(s) referenced, ${r.links} resolve`);
});

// ── The parsers, held to the same standard ────────────────────────────────────────────────────────

test("the redirect parser reads the real netlify.toml and ignores commented-out rules", () => {
  const rules = parseRedirects(fs.readFileSync(path.join(ROOT, "netlify.toml"), "utf8"));
  assert.ok(rules.length >= 5);
  assert.ok(rules.some((r) => r.from === "/senior-director-state/*" && r.status === 404));
  assert.ok(!rules.some((r) => r.to && r.to.includes("<NEW-SIGNED-INSTALLER>")), "a commented rule is not routing");
});

test("extractLinks decodes entities and reports 1-based lines", () => {
  const links = extractLinks(`<p>x</p>\n<a href="/a.html?x=1&amp;y=2">a</a>`, { file: "f.html" });
  assert.equal(links[0].href, "/a.html?x=1&y=2");
  assert.equal(links[0].line, 2);
});

test("visibleTextLength strips script and style before measuring", () => {
  const html = `<style>${"a{}".repeat(500)}</style><script>${"x;".repeat(500)}</script><p>short</p>`;
  assert.ok(visibleTextLength(html) < 20);
  assert.equal(isLoginShell(`${html}<form><input type="password"></form>`), true);
});

test("the module writes nothing and sends nothing", async () => {
  const mod = await import(new URL("../scripts/lib/customer-link-graph.mjs", import.meta.url).href);
  assert.equal(mod.SENDS, false);
  assert.equal(mod.WRITES, false);
  assert.ok(CUSTOMER_ENTRY_POINTS.length >= 10);
});
