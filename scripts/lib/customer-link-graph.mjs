// customer-link-graph.mjs — RUN-AN / AN1. Prove the CUSTOMER-facing path, from the repository.
//
// WHY THIS EXISTS (2026-08-05).
// Nineteen cycles have gone into making this program unable to lie about its own numbers. Every one
// of them was about the operator's view. Nothing in the series has ever proven the thing a PROSPECT
// would meet: that the routes referenced from the homepage, the ARIA page, the pricing surfaces and
// the outbound messages actually resolve to a real, non-empty, non-gated destination.
//
// The push and the twelve sends will happen on the operator's machine at a moment we do not control.
// When they do, whatever they land has to work. A link in a message we are about to send that lands
// on a dead route is a worse outcome than not sending — it converts silence into a visible failure
// in front of the only twelve people who have ever answered us.
//
// So this module walks the real link graph FROM DISK. No network call, no deploy, no browser.
//
// HONESTY CONTRACT (Rule 14 — the whole point).
// A route this module cannot decide from disk is reported UNCHECKED, with the reason, and is never
// counted as passing. There are exactly three verdicts and the third one is not a synonym for green:
//
//   OK        — resolved to a file that exists, is a file, and holds substantive content.
//   BROKEN    — resolved to nothing, to a redirect that force-404s it, to an empty file, or to a
//               destination whose entire body is an authentication gate.
//   UNCHECKED — genuinely undecidable here (an external host, a mail/tel scheme, a route served by
//               a function rather than a file). Said out loud, never rolled into the pass count.
//
// Pure: reads files. Sends nothing, writes nothing, never touches the network.
import fs from "node:fs";
import path from "node:path";

export const CUSTOMER_LINK_GRAPH_SCHEMA = "customer-link-graph.v1";
export const SENDS = false;
export const WRITES = false;

export const VERDICT = Object.freeze({ OK: "ok", BROKEN: "broken", UNCHECKED: "unchecked" });

// Named failure classes, so a red test says WHICH breakage it caught rather than just "invalid".
export const CLASSES = Object.freeze({
  RESOLVED: "resolved-to-real-content",
  NO_TARGET: "route-resolves-to-no-file",
  EMPTY: "route-resolves-to-an-empty-file",
  NOT_A_FILE: "route-resolves-to-a-directory-with-no-index",
  FORCE_404: "route-is-force-404d-by-a-redirect-rule",
  LOGIN_SHELL: "route-resolves-only-to-an-authentication-gate",
  IN_MESSAGE_NOT_IN_SITE: "link-appears-in-outbound-copy-but-resolves-to-nothing",
  EXTERNAL: "external-host-not-resolvable-from-disk",
  NON_HTTP: "mail-or-telephone-scheme-has-no-route",
  FRAGMENT: "same-page-fragment-only",
  FUNCTION_ROUTE: "served-by-a-function-not-a-file",
  DYNAMIC: "href-is-computed-at-runtime-not-a-literal-route",
});

// An href built by script (template literal or string concatenation) has no literal route to resolve.
// Reporting it BROKEN would be a fabricated finding; reporting it OK would be fabricated coverage. It
// is UNCHECKED, counted separately, and named — which is the honest third state this module exists for.
const DYNAMIC_HREF = /\$\{|<%|\{\{|'\s*\+|\+\s*'|"\s*\+|\+\s*"/;

// Entry points a prospect can actually arrive at. Deliberately a declared list rather than "every
// html file in the repo": admin consoles and internal dashboards are not customer-facing and holding
// them to a customer standard would produce noise that teaches everyone to ignore this test.
export const CUSTOMER_ENTRY_POINTS = Object.freeze([
  "index.html",
  "aria.html",
  "services.html",
  "plans/index.html", // the pricing surface. There is no pricing.html; /plans/ is the real route.
  "product.html",
  "shop.html",
  "book.html",
  "about.html",
  "growth-library.html",
  "health-check.html",
  "start-here.html",
  "support-faq.html",
  "trust.html",
  "security.html",
  "terms.html",
]);

// Routes whose response is produced by a serverless function rather than a file on disk. Declared,
// so they read as UNCHECKED-with-a-reason instead of quietly failing as missing files.
export const FUNCTION_ROUTES = Object.freeze(["/api/", "/.netlify/", "/checkout", "/webhook"]);

const rd = (abs) => { try { return fs.readFileSync(abs, "utf8"); } catch { return null; } };

/** Every href/src-as-navigation in one HTML file, with the 1-based line it sits on. */
export function extractLinks(html = "", { file = "(inline)" } = {}) {
  const out = [];
  const lines = html.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].matchAll(/href\s*=\s*"([^"]*)"/gi)) {
      out.push({ href: decodeEntities(m[1].trim()), file, line: i + 1 });
    }
  }
  return out;
}

const decodeEntities = (s) => s.replace(/&amp;/g, "&").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d));

/** Parse the `status = 404` / `status = 200` redirect rules out of netlify.toml. */
export function parseRedirects(toml = "") {
  const rules = [];
  const blocks = toml.split(/\[\[redirects\]\]/g).slice(1);
  for (const b of blocks) {
    const body = b.split(/\n\s*\[/)[0];
    const from = /^\s*from\s*=\s*"([^"]+)"/m.exec(body);
    const to = /^\s*to\s*=\s*"([^"]+)"/m.exec(body);
    const status = /^\s*status\s*=\s*(\d+)/m.exec(body);
    // Commented-out rules must not count as live routing.
    if (!from || /^\s*#/m.test(from.input.slice(0, from.index + 1).split("\n").pop() ?? "")) continue;
    rules.push({ from: from[1], to: to ? to[1] : null, status: status ? Number(status[1]) : 301 });
  }
  return rules;
}

const matchesRule = (route, from) => {
  if (from.endsWith("/*")) return route.startsWith(from.slice(0, -1));
  return route === from;
};

// A page whose entire meaningful body is a sign-in gate. Not "a page with a login button" — that is
// most pages. The test is: auth markers present AND almost no prose once script/style are stripped.
const AUTH_MARKERS = [
  /type\s*=\s*"password"/i,
  /\bsign[- ]?in\b/i,
  /\blog[- ]?in\b/i,
  /\bauthenticate\b/i,
  /\bunauthorized\b/i,
];
export const MIN_SUBSTANTIVE_CHARS = 400;

export function visibleTextLength(html = "") {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

export function isLoginShell(html = "") {
  const chars = visibleTextLength(html);
  if (chars >= MIN_SUBSTANTIVE_CHARS) return false;
  return AUTH_MARKERS.some((re) => re.test(html));
}

/**
 * Resolve one href to a verdict.
 * @param href  the raw href
 * @param opts  { root, redirects, fromFile }
 */
export function resolveLink(href = "", { root = process.cwd(), redirects = [] } = {}) {
  const raw = String(href).trim();
  const verdict = (v, cls, detail, extra = {}) => ({ href: raw, verdict: v, class: cls, detail, ...extra });

  if (raw === "" || raw === "#") return verdict(VERDICT.UNCHECKED, CLASSES.FRAGMENT, "empty or placeholder href");
  if (raw.startsWith("#")) return verdict(VERDICT.UNCHECKED, CLASSES.FRAGMENT, "same-page fragment");
  if (DYNAMIC_HREF.test(raw)) {
    return verdict(VERDICT.UNCHECKED, CLASSES.DYNAMIC,
      "href is assembled at runtime; no literal route exists on disk to resolve");
  }
  if (/^(mailto:|tel:|sms:)/i.test(raw)) return verdict(VERDICT.UNCHECKED, CLASSES.NON_HTTP, "not a site route");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || raw.startsWith("//")) {
    return verdict(VERDICT.UNCHECKED, CLASSES.EXTERNAL, "external host; resolving it would need a network call");
  }

  // Strip query and fragment — routing does not see them.
  let route = raw.split("#")[0].split("?")[0];
  if (route === "") return verdict(VERDICT.UNCHECKED, CLASSES.FRAGMENT, "query/fragment only, same page");
  if (!route.startsWith("/")) route = "/" + route.replace(/^\.\//, "");

  if (FUNCTION_ROUTES.some((p) => route.startsWith(p))) {
    return verdict(VERDICT.UNCHECKED, CLASSES.FUNCTION_ROUTE, `served by a function, not a file on disk (${route})`);
  }

  // Redirect rules first — a force-404 is a real, findable breakage for a customer-facing link.
  for (const r of redirects) {
    if (!matchesRule(route, r.from)) continue;
    if (r.status === 404) {
      return verdict(VERDICT.BROKEN, CLASSES.FORCE_404, `${route} is force-404'd by the rule from="${r.from}"`);
    }
    if (r.status === 200 && r.to) {
      route = r.from.endsWith("/*") ? r.to.replace(":splat", route.slice(r.from.length - 1)) : r.to;
      break;
    }
  }

  const candidates = route.endsWith("/")
    ? [route + "index.html"]
    : [route, route + ".html", route + "/index.html"];

  for (const c of candidates) {
    const abs = path.resolve(root, "." + c);
    let st = null;
    try { st = fs.statSync(abs); } catch { continue; }
    if (!st.isFile()) continue;
    if (st.size === 0) return verdict(VERDICT.BROKEN, CLASSES.EMPTY, `${c} exists but is empty`, { target: c });
    if (/\.html?$/i.test(c)) {
      const html = rd(abs) ?? "";
      if (isLoginShell(html)) {
        return verdict(VERDICT.BROKEN, CLASSES.LOGIN_SHELL,
          `${c} resolves, but its whole body is an authentication gate (${visibleTextLength(html)} visible chars)`,
          { target: c });
      }
    }
    return verdict(VERDICT.OK, CLASSES.RESOLVED, `${c} (${st.size} bytes)`, { target: c });
  }

  return verdict(VERDICT.BROKEN, CLASSES.NO_TARGET,
    `${route} resolves to no file — tried ${candidates.join(", ")}`);
}

/**
 * Walk the customer-facing link graph.
 * @returns { schema, ok, findings, broken, unchecked, summary }
 */
export function walkCustomerGraph({
  root = process.cwd(),
  entryPoints = CUSTOMER_ENTRY_POINTS,
  redirects = null,
} = {}) {
  const rules = redirects ?? parseRedirects(rd(path.resolve(root, "netlify.toml")) ?? "");
  const findings = [];
  const missingEntries = [];

  for (const entry of entryPoints) {
    const abs = path.resolve(root, entry);
    const html = rd(abs);
    if (html === null) { missingEntries.push(entry); continue; }
    for (const link of extractLinks(html, { file: entry })) {
      const res = resolveLink(link.href, { root, redirects: rules });
      findings.push({ ...res, from: link.file, line: link.line });
    }
  }

  const broken = findings.filter((f) => f.verdict === VERDICT.BROKEN);
  const unchecked = findings.filter((f) => f.verdict === VERDICT.UNCHECKED);
  return {
    schema: CUSTOMER_LINK_GRAPH_SCHEMA,
    ok: broken.length === 0 && missingEntries.length === 0,
    findings, broken, unchecked, missingEntries,
    summary: {
      entryPointsWalked: entryPoints.length - missingEntries.length,
      entryPointsMissing: missingEntries.length,
      links: findings.length,
      ok: findings.filter((f) => f.verdict === VERDICT.OK).length,
      broken: broken.length,
      unchecked: unchecked.length,
    },
  };
}

/**
 * Every site route referenced by outbound copy must resolve. The send sheet is Rule-11 clean and
 * currently carries no links at all — which is itself worth asserting, because the day someone adds
 * one this check is already standing rather than being written in a hurry afterwards.
 */
export function auditOutboundLinks(text = "", { root = process.cwd(), redirects = null, file = "(outbound)" } = {}) {
  const rules = redirects ?? parseRedirects(rd(path.resolve(root, "netlify.toml")) ?? "");
  const seen = new Set();
  const findings = [];
  const host = /https?:\/\/(?:www\.)?iisupp\.net(\/[^\s)"'>\]]*)?/gi;
  for (const m of String(text).matchAll(host)) {
    const route = m[1] && m[1] !== "" ? m[1] : "/";
    if (seen.has(route)) continue;
    seen.add(route);
    const res = resolveLink(route, { root, redirects: rules });
    findings.push({
      ...res, from: file,
      class: res.verdict === VERDICT.BROKEN ? CLASSES.IN_MESSAGE_NOT_IN_SITE : res.class,
    });
  }
  const broken = findings.filter((f) => f.verdict === VERDICT.BROKEN);
  return { schema: CUSTOMER_LINK_GRAPH_SCHEMA, ok: broken.length === 0, findings, broken, links: findings.length };
}

export default {
  walkCustomerGraph, auditOutboundLinks, resolveLink, extractLinks, parseRedirects,
  isLoginShell, visibleTextLength, CUSTOMER_ENTRY_POINTS, VERDICT, CLASSES, CUSTOMER_LINK_GRAPH_SCHEMA,
};
