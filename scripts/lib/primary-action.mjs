// primary-action.mjs — RUN-AS / AS3. WHAT THE PAGE ASKS FOR, EXTRACTED RATHER THAN ASSUMED.
//
// WHY THIS EXISTS (2026-08-06).
// AN1 proved the routes resolve. AO2 proved a conversation is reachable within two clicks. AP1
// proved each first screen leads with the reader's gain. AS1 proved the sixteen agree with each
// other. Every one of those gates asked whether the page WORKS. None asked what it WANTS.
//
// That gap is where a finished site quietly fails to convert. A page can resolve, agree with its
// siblings, load fast and read well, and still invite a first-time visitor to do exactly one thing:
// pay. Or invite them to submit a form whose action goes nowhere — a beautifully written ask with
// no delivery target behind it, which is worse than no ask at all, because the visitor believes
// they reached us.
//
// WHAT IS MEASURED, per published file:
//   · the PRIMARY invitation — the first ask in document order, extracted from the file
//   · its TARGET — the href or form action, resolved against the tree being published
//   · whether that target CAN RECEIVE ANYTHING — a page in the tree, a function that exists, a
//     mailto, a tel. A form pointing at a handler that is not in the tree is a dead ask and says so.
//   · whether the ask is PROPORTIONATE TO A FIRST VISIT — graded, not guessed
//
// THE GRADE. Three weights, and the rule is about what is AVAILABLE, not about what is present:
//   LOW    — read, see, learn, compare. Costs the visitor nothing.
//   MEDIUM — try, book, talk, download, request, get started. Costs attention or an email.
//   HIGH   — buy, subscribe, pay, checkout, enter a card.
// A page fails as DISPROPORTIONATE only when its HIGHEST-cost ask is HIGH and it offers NO lower
// rung — a first-time reader who is not ready to pay is given nothing else to do. A page that sells
// hard AND offers a conversation is not failed here; the rung exists.
//
// REAL-OR-EMPTY, stated because it is the rule most easily broken by convenience: a page with NO
// invitation at all is reported as having none. It is never scored as passing because it could not
// be graded, and it is never silently dropped from the count. Non-prose members of the published
// set (a sitemap, a stylesheet, a JSON state file) are reported as NOT-APPLICABLE with the reason,
// which is a third answer and not a quiet pass.
//
// WHAT IT REFUSES TO DO. It reads files. It sends nothing, writes nothing, and reaches no network.
import fs from "node:fs";
import path from "node:path";

export const PRIMARY_ACTION_SCHEMA = "primary-action.v1";
export const SENDS = false;
export const WRITES = false;

export const VERDICT = Object.freeze({ OK: "ok", BROKEN: "broken", UNCHECKED: "unchecked" });

export const ACTION_CLASSES = Object.freeze({
  OK: "the-page-asks-for-something-a-first-visitor-can-give-and-the-ask-has-somewhere-to-land",
  NONE: "the-page-invites-the-visitor-to-do-nothing-at-all",
  DEAD_TARGET: "the-primary-ask-points-at-something-that-is-not-in-the-tree-being-published",
  NO_DELIVERY: "the-form-has-no-delivery-target-so-anything-submitted-reaches-nobody",
  DISPROPORTIONATE: "the-only-thing-the-page-asks-of-a-first-time-visitor-is-to-pay",
  NOT_APPLICABLE: "not-a-reader-facing-document-so-it-cannot-carry-an-invitation",
  UNREADABLE: "file-is-not-on-disk-or-could-not-be-read",
});

export const COST = Object.freeze({ LOW: "low", MEDIUM: "medium", HIGH: "high" });
export const COST_RANK = Object.freeze({ low: 1, medium: 2, high: 3 });

/** Reader-facing documents. Everything else in the published set is declared, never dropped. */
export const READER_FACING = Object.freeze([
  "index.html", "aria.html", "trust.html", "about.html",
  "ai-edge.html", "growth-library.html", "health-check.html", "scorecard.html",
]);

export const NOT_READER_FACING = Object.freeze([
  "sitemap.xml", "robots.txt",
  "assets/axis-app.js", "assets/axis-tokens.css", "assets/axis-state.json",
  "assets/aperture-learning.js",
]);

// Ordered high → low so the first match wins and a "buy now" is never graded as a "learn more".
export const ASK_GRADES = Object.freeze([
  { cost: COST.HIGH, re: /\b(buy\s+now|buy|purchase|subscribe|check\s*out|checkout|pay\s+now|add\s+to\s+cart|enter\s+(?:your\s+)?card|start\s+(?:your\s+)?(?:paid|subscription))\b/i },
  { cost: COST.MEDIUM, re: /\b(book|schedule|request|get\s+started|start\s+(?:free|now|here)|try|sign\s*up|contact\s+us|talk\s+to|speak\s+to|get\s+in\s+touch|reach\s+out|email\s+us|call\s+us|download|apply|claim|get\s+(?:a\s+)?quote|join|stage\s+a\b|consultation|see\s+a\s+demo|book\s+a\s+demo)\b/i },
  { cost: COST.LOW, re: /\b(learn\s+more|read|see\s+(?:plans|how|more)|compare|explore|view|browse|how\s+it\s+works|watch)\b/i },
]);

const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const SCRIPT_STYLE = /<(script|style)\b[\s\S]*?<\/\1>/gi;
// Site furniture. A header nav and a footer appear on EVERY page and are navigation, not what this
// page asks for. Counting them as the page's invitation made a "Purchase Tech" nav item look like
// a paid-only landing page on the first real run — a false red, found by running it, removed here.
const FURNITURE = /<(nav|footer|header)\b[\s\S]*?<\/\1>/gi;
// The mobile menu is the same navigation in a `<div>`. Judging it as body content made an About
// page look like it asks the reader to buy hardware, because the nav's "Purchase Tech" item was
// the only graded link on the page. Matched by role rather than by tag.
const FURNITURE_BY_ROLE = /<div\b[^>]*(?:id|class)\s*=\s*["'][^"']*(?:mobile-?menu|mobile-?nav|nav-overlay|site-?nav|menu-overlay|skip-?link)[^"']*["'][\s\S]*?<\/div>/gi;
const ANCHOR_RE = /<a\b([^>]*)>([\s\S]{0,240}?)<\/a>/gi;
const BUTTON_RE = /<button\b([^>]*)>([\s\S]{0,240}?)<\/button>/gi;
const FORM_RE = /<form\b([^>]*)>/gi;

export function lineOf(source = "", index = 0) {
  if (index < 0) return 1;
  return source.slice(0, index).split("\n").length;
}

export function attr(tag = "", name = "") {
  const m = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag);
  return m ? m[1].trim() : null;
}

export function textOf(html = "") {
  return String(html).replace(HTML_COMMENT, " ").replace(TAGS, " ").replace(/\s+/g, " ").trim();
}
const TAGS = /<[^>]+>/g;

/** Grade one ask by its visible words. Returns null when the words are not an ask at all. */
export function gradeAsk(label = "") {
  const text = String(label);
  for (const g of ASK_GRADES) if (g.re.test(text)) return g.cost;
  return null;
}

/**
 * Can this target receive anything in the tree being published?
 * A repo-relative path must exist. A `mailto:`/`tel:` always can. An off-site absolute URL is
 * declared EXTERNAL and not failed — this gate judges our tree, not somebody else's host.
 */
export function resolveTarget(target = "", { root = process.cwd() } = {}) {
  const raw = String(target || "").trim();
  if (!raw) return { kind: "none", exists: false, resolved: null };
  if (/^(mailto:|tel:)/i.test(raw)) return { kind: "direct", exists: true, resolved: raw };
  if (/^https?:\/\//i.test(raw)) return { kind: "external", exists: true, resolved: raw };
  if (raw.startsWith("#")) return { kind: "anchor", exists: true, resolved: raw };

  const clean = raw.split(/[?#]/)[0];
  const rel = clean.replace(/^\/+/, "");
  const candidates = [
    rel,
    `${rel}.html`,
    path.posix.join(rel, "index.html"),
    // Netlify functions are reached at /api/* or /.netlify/functions/*; both live in one directory.
    `netlify/functions/${path.posix.basename(rel)}.mjs`,
    `netlify/functions/${path.posix.basename(rel)}.js`,
  ];
  if (rel === "" ) candidates.push("index.html");

  for (const c of candidates) {
    if (!c) continue;
    const abs = path.join(root, c);
    if (fs.existsSync(abs)) return { kind: "in-tree", exists: true, resolved: c };
  }
  return { kind: "in-tree", exists: false, resolved: rel };
}

/**
 * Blank a region while PRESERVING newlines and byte offsets, so a reported line number still points
 * at the line the reader would see. The first version replaced every character with a space,
 * including the newlines, and every line number after a `<style>` block was wrong by hundreds —
 * caught on the first real run against `aria.html`, recorded here rather than quietly fixed.
 */
export function blankRegion(source, re) {
  return String(source).replace(re, (m) => m.replace(/[^\n]/g, " "));
}

/**
 * A form with no `action` is not automatically a dead ask. The two lead forms on this site
 * (`#aoForm`, `#leadForm`) deliberately carry no action: their submit is intercepted in the page
 * and the payload is sent by `fetch`. Failing them was the first version's worst false red — it
 * would have sent someone to "fix" two forms that already work.
 *
 * Handled-in-page is MEASURED, not assumed: the form must carry an inline `onsubmit`, or it must
 * have an id that the page's own scripts both REFERENCE and bind a submit handler for. An id that
 * merely appears in a comment does not qualify.
 */
export function isHandledInPage(id, tag = "", scripts = "") {
  if (/\bonsubmit\s*=/i.test(tag)) return true;
  if (!id) return false;
  const js = String(scripts);
  const mentionsId = new RegExp(`["'#]${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(js);
  const bindsSubmit = /addEventListener\s*\(\s*["']submit["']|\.onsubmit\s*=|on\s*\(\s*["']submit["']/i.test(js);
  return mentionsId && bindsSubmit;
}

/** Every ask on a page, in document order, graded, with the line it sits on. */
export function extractAsks(html = "", { file = "(inline)", includeFurniture = false } = {}) {
  const scripts = String(html).match(SCRIPT_STYLE)?.join("\n") || "";
  let source = blankRegion(String(html), SCRIPT_STYLE);
  if (!includeFurniture) source = blankRegion(blankRegion(source, FURNITURE), FURNITURE_BY_ROLE);
  const asks = [];

  ANCHOR_RE.lastIndex = 0;
  for (let m; (m = ANCHOR_RE.exec(source)); ) {
    const label = textOf(m[2]);
    const cost = gradeAsk(label);
    if (!cost) continue;
    asks.push({ file, kind: "link", label, target: attr(m[1], "href"), cost, index: m.index, line: lineOf(source, m.index) });
  }

  BUTTON_RE.lastIndex = 0;
  for (let m; (m = BUTTON_RE.exec(source)); ) {
    const label = textOf(m[2]);
    const cost = gradeAsk(label);
    if (!cost) continue;
    const target = attr(m[1], "formaction") || attr(m[1], "data-href") || null;
    asks.push({ file, kind: "button", label, target, cost, index: m.index, line: lineOf(source, m.index) });
  }

  FORM_RE.lastIndex = 0;
  for (let m; (m = FORM_RE.exec(source)); ) {
    const action = attr(m[1], "action");
    const netlifyAttr = /\bnetlify\b|\bdata-netlify\s*=\s*["']true["']/i.test(m[1]);
    const id = attr(m[1], "id");
    asks.push({
      file, kind: "form", label: "(form)", target: action,
      netlifyForm: netlifyAttr, id, handledInPage: isHandledInPage(id, m[1], scripts),
      cost: COST.MEDIUM, index: m.index, line: lineOf(source, m.index),
    });
  }

  return asks.sort((a, b) => a.index - b.index);
}

/** Audit one file. Returns a row — never throws for an expected condition. */
export function auditFile(file, { root = process.cwd() } = {}) {
  if (NOT_READER_FACING.includes(file)) {
    return {
      file, verdict: VERDICT.UNCHECKED, class: ACTION_CLASSES.NOT_APPLICABLE,
      detail: "not a reader-facing document", primary: null, asks: [], costs: [],
    };
  }

  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) {
    return { file, verdict: VERDICT.BROKEN, class: ACTION_CLASSES.UNREADABLE, detail: file, primary: null, asks: [], costs: [] };
  }

  const html = fs.readFileSync(abs, "utf8");
  const asks = extractAsks(html, { file });

  if (asks.length === 0) {
    return {
      file, verdict: VERDICT.BROKEN, class: ACTION_CLASSES.NONE,
      detail: "no invitation of any kind was found in the file", primary: null, asks: [], costs: [],
    };
  }

  const primary = asks[0];
  // A form's delivery target is its handler, which may be the page's own script or the host — not
  // an href. Resolving it as a path made the ARIA intake form, which works, read as a dead link.
  const resolved =
    primary.kind === "form" && !String(primary.target || "").trim() && (primary.handledInPage || primary.netlifyForm)
      ? { kind: primary.handledInPage ? "in-page-handler" : "host-managed-form", exists: true, resolved: primary.id ? `#${primary.id}` : "(host)" }
      : resolveTarget(primary.target, { root });
  primary.targetKind = resolved.kind;
  primary.targetExists = resolved.exists;
  primary.targetResolved = resolved.resolved;

  const costs = [...new Set(asks.map((a) => a.cost))];
  const lowest = asks.reduce((acc, a) => Math.min(acc, COST_RANK[a.cost]), 99);

  // A form with no action and no netlify marker has nowhere to deliver.
  const deadForm = asks.find(
    (a) => a.kind === "form" && !a.netlifyForm && !a.handledInPage && !String(a.target || "").trim(),
  );
  if (deadForm) {
    return {
      file, verdict: VERDICT.BROKEN, class: ACTION_CLASSES.NO_DELIVERY,
      detail: `form at line ${deadForm.line} has no action and no delivery marker`,
      primary, asks, costs,
    };
  }

  const brokenForm = asks.find((a) => {
    if (a.kind !== "form" || !String(a.target || "").trim()) return false;
    return !resolveTarget(a.target, { root }).exists;
  });
  if (brokenForm) {
    return {
      file, verdict: VERDICT.BROKEN, class: ACTION_CLASSES.NO_DELIVERY,
      detail: `form at line ${brokenForm.line} posts to ${brokenForm.target}, which is not in the tree`,
      primary, asks, costs,
    };
  }

  if (!resolved.exists) {
    return {
      file, verdict: VERDICT.BROKEN, class: ACTION_CLASSES.DEAD_TARGET,
      detail: `primary ask "${primary.label}" (line ${primary.line}) points at ${primary.target}, which is not in the tree`,
      primary, asks, costs,
    };
  }

  if (lowest >= COST_RANK.high) {
    return {
      file, verdict: VERDICT.BROKEN, class: ACTION_CLASSES.DISPROPORTIONATE,
      detail: `every ask on the page is a paid one; a first-time visitor is offered no lower rung`,
      primary, asks, costs,
    };
  }

  return {
    file, verdict: VERDICT.OK, class: ACTION_CLASSES.OK,
    detail: `primary ask "${primary.label}" (line ${primary.line}) → ${primary.targetResolved} [${primary.cost}]`,
    primary, asks, costs,
  };
}

export function auditPrimaryActions({ root = process.cwd(), surfaces = [...READER_FACING, ...NOT_READER_FACING] } = {}) {
  const rows = surfaces.map((f) => auditFile(f, { root }));
  const failures = rows.filter((r) => r.verdict === VERDICT.BROKEN);
  const checked = rows.filter((r) => r.verdict !== VERDICT.UNCHECKED);
  return {
    schema: PRIMARY_ACTION_SCHEMA,
    verdict: failures.length === 0 ? VERDICT.OK : VERDICT.BROKEN,
    surfaces: surfaces.length,
    checked: checked.length,
    notApplicable: rows.length - checked.length,
    rows,
    failures,
    sends: SENDS,
  };
}

export function statementFor(report) {
  if (!report) return "primary action: not read";
  if (report.verdict === VERDICT.OK) {
    return `primary action: ${report.checked} reader-facing pages each open with an ask a first visitor can act on, and every ask has somewhere to land (${report.notApplicable} declared not reader-facing)`;
  }
  const f = report.failures[0];
  return `primary action: BROKEN — ${report.failures.length} page(s), first: ${f.file} ${f.class}`;
}

export default { auditPrimaryActions, auditFile, extractAsks, gradeAsk, resolveTarget, statementFor, ACTION_CLASSES, VERDICT, COST, READER_FACING, NOT_READER_FACING };
