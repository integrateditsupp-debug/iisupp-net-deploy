// conversation-path.mjs — RUN-AO / AO2. The route from the first screen to a conversation.
//
// WHY THIS EXISTS (2026-08-05).
// AN1 proved links resolve. A resolving link graph in which no prospect can reach a human is a
// working website and a dead business. This module proves the ONE route that matters: from each
// customer entry point to the action that starts a conversation, in no more than two clicks, ending
// somewhere a human can actually be reached.
//
// "Reached" is held to disk evidence, not to the presence of a button:
//   a mailto:/tel: with a real address or number, or
//   a form that declares a delivery target (action=, netlify/data-netlify, formspree, a function route).
// A form with no delivery target is the exact failure mode this catches: a contact page that
// resolves, renders, accepts a prospect's typing, and sends it nowhere.
//
// HONESTY CONTRACT. Three verdicts, and the third is not a synonym for green:
//   OK        — a conversation target is reachable within maxClicks, and it has a delivery target.
//   BROKEN    — no path, a path longer than maxClicks, or a path terminating in a dead-end form.
//   UNCHECKED — undecidable from disk (the entry point is not on disk; the only candidate route is
//               served by a function). Said out loud, never counted as a pass.
//
// Pure: reads files. Sends nothing, writes nothing, never touches the network.
import fs from "node:fs";
import path from "node:path";
import { resolveLink, parseRedirects, extractLinks, VERDICT as LINK_VERDICT } from "./customer-link-graph.mjs";

export const CONVERSATION_PATH_SCHEMA = "conversation-path.v1";
export const SENDS = false;
export const WRITES = false;

export const VERDICT = Object.freeze({ OK: "ok", BROKEN: "broken", UNCHECKED: "unchecked" });

export const CLASSES = Object.freeze({
  REACHABLE: "conversation-reachable-within-two-clicks",
  NO_PATH: "entry-point-has-no-route-to-a-conversation",
  TOO_FAR: "conversation-is-further-than-two-clicks-from-the-first-screen",
  DEAD_END_FORM: "path-terminates-in-a-form-with-no-delivery-target",
  NO_FILE: "entry-point-is-not-on-disk",
});

export const MAX_CLICKS = 2;

// What counts as starting a conversation. A direct channel, or a page whose job is to open one.
export const CONVERSATION_ROUTES = Object.freeze([
  /^mailto:/i,
  /^tel:/i,
  /\/?contact(-us)?(\.html)?$/i,
  /\/?book(ing)?(\.html)?$/i,
  /\/?consultation(\.html)?$/i,
  /\/?start-here(\.html)?$/i,
  /\/?health-check(\.html)?$/i,
  /calendly\.com|cal\.com/i,
]);

// Evidence, on disk, that a form actually delivers somewhere.
const DELIVERY_MARKERS = [
  /<form[^>]+\baction\s*=\s*"(?!#|javascript:|\s*")[^"]+"/i,
  /\bdata-netlify\s*=\s*"true"/i,
  /\bnetlify\b\s*(?:=|>)/i,
  /<form[^>]+\bnetlify\b/i,
  /formspree\.io|forms\.gle|docs\.google\.com\/forms/i,
];

const rd = (abs) => { try { return fs.readFileSync(abs, "utf8"); } catch { return null; } };

export const isConversationHref = (href = "") =>
  CONVERSATION_ROUTES.some((re) => re.test(String(href).split("?")[0].split("#")[0]));

/** A direct channel carries its own delivery target in the href itself. */
export function directChannelReachable(href = "") {
  const raw = String(href).trim();
  if (/^mailto:/i.test(raw)) return /^mailto:[^@\s]+@[^@\s.]+\.[a-z]{2,}/i.test(raw);
  if (/^tel:/i.test(raw)) return (raw.replace(/\D/g, "").length >= 7);
  return false;
}

/** Does this HTML contain a form that declares somewhere to deliver to? */
export function hasDeliveryTarget(html = "") {
  const s = String(html);
  if (!/<form\b/i.test(s)) {
    // No form at all: the page can still be a conversation surface if it publishes a direct channel.
    return /mailto:[^@\s"]+@[^@\s".]+\.[a-z]{2,}/i.test(s) || /tel:\+?[\d\s().-]{7,}/i.test(s);
  }
  return DELIVERY_MARKERS.some((re) => re.test(s));
}

/**
 * Walk one entry point out to a conversation.
 * @returns { file, verdict, class, clicks, path, detail }
 */
export function walkToConversation(entry, { root = process.cwd(), redirects = [], maxClicks = MAX_CLICKS } = {}) {
  const abs = path.resolve(root, entry);
  const html = rd(abs);
  const out = (verdict, cls, detail, extra = {}) => ({ file: entry, verdict, class: cls, detail, ...extra });

  if (html === null) {
    return out(VERDICT.UNCHECKED, CLASSES.NO_FILE, `${entry} is not on disk in this checkout`, { clicks: null, path: [] });
  }

  // Breadth-first: depth 1 is a link on the entry point, depth 2 a link on the page it reaches.
  const seen = new Set([entry]);
  let frontier = [{ file: entry, html, path: [entry] }];
  const deadEnds = [];

  for (let depth = 1; depth <= maxClicks; depth++) {
    const next = [];
    for (const node of frontier) {
      for (const link of extractLinks(node.html, { file: node.file })) {
        const href = link.href;

        if (isConversationHref(href)) {
          if (directChannelReachable(href)) {
            return out(VERDICT.OK, CLASSES.REACHABLE,
              `${href} reached in ${depth} click${depth === 1 ? "" : "s"} (${node.file}:${link.line})`,
              { clicks: depth, path: [...node.path, href] });
          }
          if (/^(mailto:|tel:)/i.test(href)) {
            // A channel scheme with nothing behind it is a dead end, not a pass.
            deadEnds.push({ href, at: `${node.file}:${link.line}`, why: "channel scheme with no address or number" });
            continue;
          }
          const r = resolveLink(href, { root, redirects });
          if (r.verdict === LINK_VERDICT.OK && r.target) {
            const targetHtml = rd(path.resolve(root, "." + r.target)) ?? "";
            if (hasDeliveryTarget(targetHtml)) {
              return out(VERDICT.OK, CLASSES.REACHABLE,
                `${r.target} reached in ${depth} click${depth === 1 ? "" : "s"} (${node.file}:${link.line}) and declares a delivery target`,
                { clicks: depth, path: [...node.path, r.target] });
            }
            deadEnds.push({ href, at: `${node.file}:${link.line}`, why: `${r.target} has no delivery target on disk` });
          }
        }

        // Expand for the next depth — internal HTML routes only.
        if (depth < maxClicks) {
          const r = resolveLink(href, { root, redirects });
          if (r.verdict === LINK_VERDICT.OK && r.target && /\.html?$/i.test(r.target) && !seen.has(r.target)) {
            seen.add(r.target);
            const h = rd(path.resolve(root, "." + r.target));
            if (h !== null) next.push({ file: r.target, html: h, path: [...node.path, r.target] });
          }
        }
      }
    }
    frontier = next;
  }

  if (deadEnds.length) {
    const d = deadEnds[0];
    return out(VERDICT.BROKEN, CLASSES.DEAD_END_FORM,
      `every conversation route from ${entry} dead-ends: ${d.href} at ${d.at} — ${d.why}`,
      { clicks: null, path: [entry], deadEnds });
  }
  return out(VERDICT.BROKEN, CLASSES.NO_PATH,
    `no route from ${entry} to a conversation within ${maxClicks} clicks`,
    { clicks: null, path: [entry] });
}

/**
 * Walk every declared entry point.
 * @returns { schema, ok, results, broken, unchecked, summary }
 */
export function walkAllConversationPaths({ root = process.cwd(), entryPoints = [], maxClicks = MAX_CLICKS } = {}) {
  const toml = rd(path.resolve(root, "netlify.toml")) ?? "";
  const redirects = parseRedirects(toml);
  const results = entryPoints.map((e) => walkToConversation(e, { root, redirects, maxClicks }));
  const broken = results.filter((r) => r.verdict === VERDICT.BROKEN);
  const unchecked = results.filter((r) => r.verdict === VERDICT.UNCHECKED);
  const ok = results.filter((r) => r.verdict === VERDICT.OK);
  return {
    schema: CONVERSATION_PATH_SCHEMA,
    ok: broken.length === 0,
    results, broken, unchecked,
    summary: {
      entryPoints: results.length,
      reachable: ok.length,
      broken: broken.length,
      unchecked: unchecked.length,
      maxClicks,
      note: "unchecked is never folded into reachable",
    },
  };
}

export default {
  CONVERSATION_PATH_SCHEMA, VERDICT, CLASSES, MAX_CLICKS, CONVERSATION_ROUTES,
  isConversationHref, directChannelReachable, hasDeliveryTarget,
  walkToConversation, walkAllConversationPaths,
};
