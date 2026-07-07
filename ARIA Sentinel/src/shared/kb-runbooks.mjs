// kb-runbooks — customer-extensible KB: index a FLAT writable folder of drop-in *.md runbooks so an admin
// can add their own guides. The desktop's "Re-index knowledge base" action rebuilds the served index from
// the shipped aria-kb-pack PLUS these files, and "Open KB folder" opens the folder to drop new .md in.
//
// Kept as its own module (not folded into aria-local-kb.mjs) so the tuned KB matcher stays untouched. Docs
// are built with the SAME title/heading/stem shape loadKbPack produces (reusing tokenize/stem/platformOf),
// so matchKb ranks a customer runbook exactly like a built-in one. source:"customer" lets the re-index
// report an honest built-in-vs-custom split. 🔒 R11: content-blind — nothing here is uploaded anywhere.
import { tokenize, stem, platformOf } from "./aria-local-kb.mjs";

/** Build ONE indexed KB doc from a markdown file's raw text (mirrors loadKbPack's per-file shape). */
export function makeRunbookDoc({ id, platform = "", raw = "", filename = "", source = "customer" }) {
  const body = String(raw == null ? "" : raw);
  const title = (body.match(/^#\s+(.+)$/m) || [])[1] || String(filename).replace(/\.md$/, "");
  const text = body.toLowerCase();
  // The doc's own headings (# / ## / ###) ARE its topic words; fold them (+ a filename hint) into _headings
  // so a query hitting them gets the title boost — same precision signal the shipped pack uses.
  const headings = [...body.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => m[1]).join(" ");
  const fileHint = String(filename).replace(/\.md$/, "").replace(/[-_]/g, " ");
  const headingText = `${title} ${headings} ${fileHint}`;
  const doc = {
    id, platform, title, text, _headings: headingText,
    _stemSet: new Set(tokenize(`${title} ${text}`).map(stem)),
    _stemTitleSet: new Set(tokenize(headingText).map(stem))
  };
  if (source) doc.source = source;
  return doc;
}

/**
 * Index a flat folder of customer *.md runbooks. `fsImpl` is injected (node:fs in the app, a fake in tests).
 * A missing/unreadable folder yields [] (no throw) so a fresh install with no runbooks simply adds nothing.
 */
export function loadCustomRunbooks(dir, fsImpl) {
  const index = [];
  let files = [];
  try { files = fsImpl.readdirSync(dir).filter((f) => String(f).toLowerCase().endsWith(".md")); } catch { return index; }
  for (const f of files) {
    let raw = "";
    try { raw = fsImpl.readFileSync(`${dir}/${f}`, "utf8"); } catch { continue; }
    index.push(makeRunbookDoc({ id: `runbooks/${f}`, platform: platformOf(f), raw, filename: f, source: "customer" }));
  }
  return index;
}
