// RUN 16 §H — Audit battery. Every action carries an ISO timestamp; CSV + PDF exports are complete
// (all rows, no dupes, no missing fields); the hash-chain detects on-disk tampering and flags the
// admin; and time-window queries return exact matches.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { toCsv, toPdf, auditFileName } from "../src/shared/audit-export.mjs";
import { sealAudit, verifyAudit, assertIsoTimestamps, entriesInWindow, entryHash } from "../src/shared/audit-integrity.mjs";

const NOW = Date.parse("2026-06-19T18:00:00.000Z");
const iso = (d) => new Date(NOW - d * 24 * 60 * 60 * 1000).toISOString();
const entries = [
  { ts: iso(5), tag: "WATCH", recipeId: "", text: "Started monitoring (manual mode)." },
  { ts: iso(4), tag: "DETECT", recipeId: "dns-fail-v1", text: "DNS.FAIL detected" },
  { ts: iso(3), tag: "FIX", recipeId: "dns-fail-v1", text: "Dry-run completed" },
  { ts: iso(2), tag: "HOTKEY", recipeId: "", text: "chat: CommandOrControl+Alt+A → active" },
  { ts: iso(1), tag: "EXPORT", recipeId: "", text: "Evidence pack exported" },
  { ts: iso(0), tag: "SELF-HEAL", recipeId: "", text: "8 features verified · 0 need attention" }
];

// 1 · Every entry carries a valid ISO-8601 timestamp.
assert.equal(assertIsoTimestamps(entries), true, "all entries have ISO timestamps");
assert.equal(assertIsoTimestamps([{ ts: 1718820000000, tag: "X" }]), false, "epoch-ms timestamp rejected");
assert.equal(assertIsoTimestamps([{ ts: "not-a-date", tag: "X" }]), false, "garbage timestamp rejected");

// 2 · CSV export: header + every row, no duplicates, four columns each.
const csv = toCsv(entries, { now: NOW });
const lines = csv.trim().split("\n");
assert.equal(lines[0], "timestamp,tag,recipe,detail", "CSV header present");
assert.equal(lines.length, entries.length + 1, "every entry exported, no rows dropped");
assert.equal(new Set(lines.slice(1)).size, entries.length, "no duplicate rows");
for (const e of entries) assert.ok(csv.includes(e.ts), `CSV contains entry ${e.ts}`);
for (const row of lines.slice(1)) assert.equal((row.match(/","/g) || []).length, 3, "row has all 4 fields");

// 3 · PDF export: valid PDF, contains the entries.
const pdf = toPdf("ARIA Sentinel — audit", entries, { now: NOW });
assert.ok(typeof pdf === "string" && pdf.startsWith("%PDF-1."), "PDF export is a valid PDF");
assert.ok(pdf.includes("dns-fail-v1"), "PDF includes audit detail");
assert.equal(auditFileName("csv", "2026-06-19"), "aria-sentinel-audit-2026-06-19.csv");
assert.equal(auditFileName("pdf", "2026-06-19"), "aria-sentinel-audit-2026-06-19.pdf");

// 4 · Tamper detection: seal the log, then mutate / truncate / leave-intact and re-verify.
const sealed = sealAudit(entries);
assert.equal(sealed.count, 6);
assert.equal(verifyAudit(entries, sealed).ok, true, "intact log verifies");

const modified = entries.map((e, i) => (i === 2 ? { ...e, text: "Fix silently changed on disk" } : e));
const vMod = verifyAudit(modified, sealed);
assert.equal(vMod.ok, false, "modified log fails verification");
assert.equal(vMod.brokenAt, 2, "tamper located at the modified entry");
assert.equal(vMod.alertAdmin, true, "admin is alerted on tamper");
assert.equal(vMod.reason, "entry-modified");

const truncated = entries.slice(0, 5);
const vTrunc = verifyAudit(truncated, sealed);
assert.equal(vTrunc.ok, false, "truncated log fails verification");
assert.equal(vTrunc.reason, "row-count-changed");
assert.equal(vTrunc.alertAdmin, true);

// chain is order-sensitive: swapping two rows breaks it.
const swapped = entries.slice(); [swapped[1], swapped[3]] = [swapped[3], swapped[1]];
assert.equal(verifyAudit(swapped, sealed).ok, false, "reordering rows is detected");

// 5 · Time-window query: "everything between X and Y" returns the exact set.
const win = entriesInWindow(entries, iso(3), iso(1));
assert.equal(win.length, 3, "window [day-3 … day-1] returns exactly 3 entries");
assert.ok(win.every((e) => Date.parse(e.ts) >= Date.parse(iso(3)) && Date.parse(e.ts) <= Date.parse(iso(1))));

// entryHash is deterministic + sensitive to content.
assert.equal(entryHash("p", entries[0]), entryHash("p", entries[0]), "hash deterministic");
assert.notEqual(entryHash("p", entries[0]), entryHash("p", { ...entries[0], text: "x" }), "hash content-sensitive");

// 6 · Runtime wiring (RUN 16): main seals the log on every write, verifies integrity at session start
// before anything logs, alerts on tamper, and exposes the status in getState.
const mainJs = fs.readFileSync(path.resolve(import.meta.dirname, "..", "src", "main", "main.mjs"), "utf8");
assert.match(mainJs, /import \{ sealAudit, verifyAudit, classifyIntegrity \} from "\.\.\/shared\/audit-integrity\.mjs"/, "main imports the integrity module (incl. classifyIntegrity)");
assert.match(mainJs, /store\.set\("auditSeal", sealAudit\(/, "main re-seals the log on write");
assert.match(mainJs, /sealAudit\([^)]*\{ appVersion: appVersion\(\)/, "the seal is version-stamped so upgrades aren't read as tampering");
assert.match(mainJs, /function verifyAuditIntegrity\(\)/, "main defines the startup verifier");
assert.match(mainJs, /classifyIntegrity\(log, sealed, appVersion\(\)\)/, "startup verifier classifies via the version-aware check");
assert.match(mainJs, /verifyAuditIntegrity\(\);\s*\n\s*initWhatsNew\(\)/, "verifier runs first in whenReady, before any logEvent");
assert.match(mainJs, /verdict\.status === "version-changed"/, "version upgrade is handled as a benign re-seal, not tampering");
assert.match(mainJs, /logEvent\("SECURITY"[\s\S]{0,160}tamper/i, "tamper raises a SECURITY audit event (admin alert)");
assert.match(mainJs, /auditIntegrity: store\.get\("auditIntegrity"\)/, "integrity status exposed in getState");

console.log("Audit battery passed (ISO timestamps · CSV+PDF complete · hash-chain detects modify/truncate/reorder + alerts admin · exact time-window queries · wired into session-start).");
