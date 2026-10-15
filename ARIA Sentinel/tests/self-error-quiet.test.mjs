// PROD 2026-10-14 (audit M30 / M28 / M33 / M24 / M32 / M10 / M19) — the agent stays quiet about itself and honest
// about everything else. Source-level over main.mjs (it needs Electron) plus the pure pieces it leans on.
//
//   M30 a renderer hiccup / GPU restart / bridge-port conflict is a SELF-ERROR audit row + a crash-queue record,
//       not a customer detection with a fix card, globe pop and e-mail; a card at most once an hour, only when
//       the fault repeats; a dead main window is destroyed before it is recreated.
//   M28 the 5-minute self-diagnosis logs only when its verdict changes; the audit export's title says what it holds.
//   M33 state broadcasts are coalesced (16 ms trailing) — one snapshot per burst, not ten per fix.
//   M24 the update state says INSTALLED only after the installer really took the update; rollback allows downgrade.
//   M32 the "Simulate detection" tray item, the globe-confirm test IPC and the vault heartbeat path are dev-only.
//   M10 Settings → Support links (mailto:/tel:/WhatsApp to the company) pass the open-external gate; strangers do not.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const main = fs.readFileSync(path.join(root, "src/main/main.mjs"), "utf8");
const html = fs.readFileSync(path.join(root, "src/renderer/index.html"), "utf8");
let groups = 0; const g = () => { groups++; };
const fnOf = (name) => { const m = main.match(new RegExp(`function ${name}\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`)); assert.ok(m, `function ${name} found`); return m[0]; };

// 1 — M30: self-errors are quiet.
const hse = fnOf("handleSelfError");
assert.match(hse, /logEvent\("SELF-ERROR"/, "an audit row is always written");
assert.match(hse, /crashReporter\.capture\(/, "…and the crash queue gets the scrubbed record");
assert.match(hse, /if \(selfErrorsSinceCard < 3 \|\| now - lastSelfErrorCardAt < SELF_ERROR_CARD_MIN_MS\) return;/, "no card unless the fault repeats, and never more than once an hour");
assert.match(main, /const SELF_ERROR_CARD_MIN_MS = 60 \* 60 \* 1000;/);
assert.match(main, /try \{ if \(mainWindow && !mainWindow\.isDestroyed\(\)\) mainWindow\.destroy\(\); \} catch \{[^}]*\}\n\s*mainWindow = null;\n\s*createMainWindow\(\);/, "render-process-gone destroys the dead window before recreating");
g();

// 2 — M28: interval self-diagnosis logs on change only; export title is honest.
const sd = fnOf("selfDiagnose");
assert.match(sd, /if \(reason !== "interval" \|\| signature !== last\) logEvent\(/, "interval runs log only on a verdict change");
assert.match(main, /`ARIA Sentinel — audit \(\$\{log\.length\} rows, \$\{oldest\} to \$\{newest\}\)`/, "the export title states rows + real date range");
assert.doesNotMatch(main, /"ARIA Sentinel — audit \(30 days\)"/, "the '30 days' label is gone");
g();

// 3 — M33: coalesced broadcasts.
assert.match(main, /let broadcastTimer = null;\nfunction broadcastState\(opts = \{\}\) \{/, "debounced broadcast");
assert.match(main, /broadcastTimer = setTimeout\(\(\) => \{ broadcastTimer = null; broadcastStateNow\(\); \}, 16\);/, "16 ms trailing");
assert.match(main, /if \(opts && opts\.immediate === true\)/, "an immediate path exists for callers that need it");
g();

// 4 — M24: INSTALLED only after a real install; rollback is an allowed downgrade.
const pui = fnOf("performUpdateInstall");
assert.match(pui, /if \(r && r\.ok\) writeUpdateState\(\{ \.\.\.state, phase: "INSTALLED"/, "INSTALLED only on success");
assert.doesNotMatch(pui, /writeUpdateState\(\{ \.\.\.state, phase: "INSTALLED", installedAt: new Date\(\)\.toISOString\(\) \}\);\n  logEvent/, "…never before the install is attempted");
assert.match(main, /autoUpdaterRef\.allowDowngrade = true;/, "rollback sets allowDowngrade");
g();

// 5 — M32: dev-only affordances.
assert.match(main, /function devModeNow\(\)/);
assert.match(main, /\.\.\.\(devModeNow\(\) \? \[\{ label: "Simulate ARIA detection \(test\)"/, "tray simulate item is dev-only");
assert.match(main, /if \(!devModeNow\(\)\) return \{ show: false, reason: "not-available-in-this-build" \};/, "globe-confirm test IPC refuses in a packaged build");
assert.match(main, /if \(!devModeNow\(\)\) return \{ ok: true, data: parseHeartbeats\(\[\]\) \};/, "the vault heartbeat path is never read in a packaged build");
g();

// 6 — M10: the exact data-support values in index.html pass; strangers fail. Pure regex, exported from main's source.
const contactRe = new RegExp(main.match(/export const OPEN_EXTERNAL_CONTACT_ALLOW = \/(.*)\/;/)[1]);
const httpsRe = new RegExp(main.match(/const OPEN_EXTERNAL_ALLOW = \/(.*)\/;/)[1]);
const allowed = (u) => httpsRe.test(u) || contactRe.test(u);
const supports = [...html.matchAll(/data-support="([^"]+)"/g)].map((m) => m[1]);
assert.ok(supports.length >= 6, "the Settings support links were found");
for (const u of supports) assert.ok(allowed(u), `support link passes the open-external gate: ${u}`);
assert.equal(allowed("mailto:evil@x.com"), false);
assert.equal(allowed("tel:+15551234567"), false);
assert.equal(allowed("https://wa.me/15551234567"), false);
assert.equal(allowed("mailto:ahmad.wasee@iisupp.net?subject=ARIA%20Sentinel"), true);
assert.equal(allowed("javascript:alert(1)"), false);
assert.match(main, /if \(typeof url === "string" && \(OPEN_EXTERNAL_ALLOW\.test\(url\) \|\| OPEN_EXTERNAL_CONTACT_ALLOW\.test\(url\)\)\) \{\s*\n\s*shell\.openExternal\(url\);/, "the IPC uses both gates");
// Fallback pages are live ones (/plans, /aria), not the 404s.
assert.match(main, /`https:\/\/iisupp\.net\/plans\/\?from=app&tier=\$\{safeTier\}\$\{yearly \? "&billing=yearly" : ""\}`/, "plan-picker fallback → /plans (+billing)");
assert.match(main, /process\.env\.CALENDLY_URL \|\| "https:\/\/iisupp\.net\/aria"/, "book-a-call fallback → /aria");
assert.doesNotMatch(main, /"https:\/\/iisupp\.net\/contact"|"https:\/\/iisupp\.net\/aria-sentinel\/"/, "no 404 fallbacks remain");
g();

assert.equal(groups, 6);
console.log(`self-error-quiet test passed (${groups} groups · self-errors quiet + crash-queued · self-diagnose logs on change · honest export title · coalesced broadcasts · INSTALLED after install · dev-only affordances · support links + live fallbacks).`);
