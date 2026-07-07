// kb-reindex test — the customer-extensible KB (Knowledge surface "Re-index" + "Open KB folder").
// Asserts: loadCustomRunbooks indexes a flat *.md folder (tagging source:"customer", skipping non-md,
// tolerating a missing folder); makeRunbookDoc derives the title from the first # heading (else filename)
// and detects platform from the filename; the in-process index = shipped pack + customer runbooks with an
// honest built-in-vs-custom count; and a customer runbook actually ANSWERS Ask ARIA via the same matcher.
import assert from "node:assert/strict";
import { loadCustomRunbooks, makeRunbookDoc } from "../src/shared/kb-runbooks.mjs";
import { loadKbPack, matchKb, localKbAnswer, platformOf } from "../src/shared/aria-local-kb.mjs";

// A fake fs so the loaders are exercised with zero real files (mirrors the node:fs shape main.mjs injects).
const DIRS = {
  "/kb/blueprints": ["windows-11.md"],
  "/kb/diagnostics": ["printer.md"],
  "/kb/runbooks": ["acme-vpn.md", "notes.txt", "windows-mfa-reset.md"]
};
const FILES = {
  "/kb/blueprints/windows-11.md": "# Windows 11\nGeneral Windows desktop help.",
  "/kb/diagnostics/printer.md": "# Printer Offline\nRestart the print spooler.",
  "/kb/runbooks/acme-vpn.md": "# ACME VPN reconnect\n## Reconnect steps\nHow to reconnect the ACME corporate VPN tunnel when it drops.",
  "/kb/runbooks/windows-mfa-reset.md": "# Windows MFA reset\nInternal runbook for resetting a stuck MFA prompt."
};
const fakeFs = {
  readdirSync: (dir) => { if (!DIRS[dir]) throw new Error(`ENOENT ${dir}`); return DIRS[dir].slice(); },
  readFileSync: (p) => { if (!(p in FILES)) throw new Error(`ENOENT ${p}`); return FILES[p]; }
};

// 1) makeRunbookDoc: title from the first "# heading"; source defaults to "customer"; stems populated.
const d1 = makeRunbookDoc({ id: "runbooks/acme-vpn.md", platform: "", raw: FILES["/kb/runbooks/acme-vpn.md"], filename: "acme-vpn.md" });
assert.equal(d1.title, "ACME VPN reconnect");
assert.equal(d1.source, "customer");
assert.equal(d1.id, "runbooks/acme-vpn.md");
assert.ok(d1._stemSet.size > 0 && d1._stemTitleSet.size > 0, "stem sets are built for scoring");

// 2) makeRunbookDoc: no "# heading" → title falls back to the filename (minus .md).
const d2 = makeRunbookDoc({ id: "runbooks/x.md", raw: "no heading here, just body text", filename: "x.md" });
assert.equal(d2.title, "x");

// 3) platformOf drives a runbook's platform bias from its filename.
assert.equal(platformOf("windows-mfa-reset.md"), "win32");
assert.equal(platformOf("acme-vpn.md"), "");

// 4) loadCustomRunbooks: indexes only *.md, tags them customer, ids as runbooks/<file>.
const custom = loadCustomRunbooks("/kb/runbooks", fakeFs);
assert.equal(custom.length, 2, "notes.txt is ignored; two .md runbooks indexed");
assert.ok(custom.every((d) => d.source === "customer"));
assert.deepEqual(custom.map((d) => d.id).sort(), ["runbooks/acme-vpn.md", "runbooks/windows-mfa-reset.md"]);
assert.equal(custom.find((d) => d.id === "runbooks/windows-mfa-reset.md").platform, "win32");

// 5) A missing/unreadable runbooks folder yields [] (fresh install with no runbooks → nothing added, no throw).
assert.deepEqual(loadCustomRunbooks("/kb/does-not-exist", fakeFs), []);

// 6) The in-process index = shipped pack + customer runbooks, with an HONEST built-in-vs-custom count.
const pack = loadKbPack("/kb", fakeFs);
assert.equal(pack.length, 2, "two shipped pack docs");
assert.ok(pack.every((d) => d.source === undefined), "pack docs carry no customer tag");
const index = [...pack, ...custom];
const counts = (idx) => {
  const c = idx.filter((d) => d && d.source === "customer").length;
  return { total: idx.length, pack: idx.length - c, custom: c };
};
assert.deepEqual(counts(index), { total: 4, pack: 2, custom: 2 });

// 7) The re-index is a pure rebuild: building twice yields the same honest counts (idempotent).
const rebuilt = [...loadKbPack("/kb", fakeFs), ...loadCustomRunbooks("/kb/runbooks", fakeFs)];
assert.deepEqual(counts(rebuilt), counts(index));

// 8) A customer runbook actually ANSWERS via the SAME matcher the desktop serves from.
const hit = matchKb(index, "reconnect the acme vpn tunnel");
assert.ok(hit && hit.doc.id === "runbooks/acme-vpn.md", "customer runbook is the top match for its topic");
const answer = localKbAnswer({ message: "reconnect the acme vpn tunnel", index });
assert.equal(answer.matched, true);
assert.equal(answer.id, "runbooks/acme-vpn.md");

// 9) An out-of-scope question still honestly rejects even with customer runbooks present (no forced match).
assert.equal(localKbAnswer({ message: "how do I bake sourdough bread", index }).matched, false);

console.log("kb-reindex test passed (custom runbook index · md-only + missing-dir safe · pack+custom counts · runbook answers · honest reject).");
