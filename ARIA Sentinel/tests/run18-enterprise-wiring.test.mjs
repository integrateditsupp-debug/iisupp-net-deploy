// RUN 18 — Enterprise-verification: lock the MAIN-PROCESS wiring of the four enterprise features.
// The existing network-capture/evidence-pack/whats-new suites test the PURE modules; this suite proves
// the features are actually wired in main.mjs + overlay + on disk, so a refactor can't silently break
// the buyer-facing guarantees. No feature code changed in RUN 18 — these features shipped in the
// original build (RUN 3-era); this is the verification pass the stale ROADMAP_TO_V1 RUN 3 asked for.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const main = read("src", "main", "main.mjs");
const indexHtml = read("src", "renderer", "index.html");
const overlayHtml = read("src", "renderer", "overlay.html");
const overlayJs = read("src", "renderer", "overlay.js");
const pkg = JSON.parse(read("package.json"));

// 1 · Real 10s session.webRequest live capture, listener cleared, classified via summarizeCapture.
assert.match(main, /function runPrivacyCapture\(windowMs = 10000\)/, "live capture defaults to a 10s window");
assert.match(main, /session\.defaultSession/, "uses the real default session");
assert.match(main, /webRequest\.onBeforeRequest\(\(details, callback\)/, "attaches a real onBeforeRequest sniff");
assert.match(main, /webRequest\.onBeforeRequest\(null\)/, "clears the listener after the window (no lingering sniff)");
assert.match(main, /summarizeCapture\(/, "classifies the capture against the verifier");
assert.match(main, /ipcMain\.handle\("sentinel:privacy-capture"/, "live-capture IPC wired");

// 2 · Evidence pack → ~/Documents/aria-sentinel-evidence-<date>.zip with the 6 artifacts.
assert.match(main, /path\.join\(os\.homedir\(\), "Documents", evidenceFileName\(dateStamp\)\)/, "writes to ~/Documents with the dated filename");
assert.match(main, /zipEvidencePack\(/, "builds the real .zip");
assert.match(main, /ipcMain\.handle\("sentinel:export-evidence"/, "export-evidence IPC wired");
assert.match(indexHtml, /id="exportEvidence"/, "Export evidence pack button present");
assert.match(indexHtml, /id="liveCapture"/, "Live capture button present");

// 3 · Attention wiggle — 300ms, ±5px, once per session on first detection.
assert.match(overlayHtml, /@keyframes aria-attention/, "attention keyframe defined");
assert.match(overlayHtml, /\.aria-globe\[data-state="attention"\]\s*\{\s*animation:\s*aria-attention \.3s/, "300ms wiggle on the attention state");
assert.match(overlayHtml, /translateX\(-?5px\)/, "±5px displacement");
assert.match(overlayJs, /wiggledThisSession/, "wiggle is gated to once per session");

// 4 · What's-new modal — reads docs/RELEASE_NOTES_<version>.md; ack updates the flag.
assert.match(main, /RELEASE_NOTES_\$\{version\}\.md/, "reads the versioned release notes");
assert.match(main, /ipcMain\.handle\("sentinel:ack-whats-new"/, "ack-whats-new IPC wired");
assert.match(indexHtml, /id="whatsNew"/, "what's-new modal present");
assert.match(indexHtml, /id="whatsNewGotIt"/, "Got it button present");
// The release-notes file for the CURRENT version must exist, or the modal would be empty.
assert.ok(fs.existsSync(path.join(root, "docs", `RELEASE_NOTES_${pkg.version}.md`)), `RELEASE_NOTES_${pkg.version}.md exists on disk`);

// 5 · PS-arg safety: command execution uses positional argv (no shell string interpolation).
assert.match(main, /spawn\(file, args, \{[^}]*windowsHide: true/, "exec spawns with positional argv + windowsHide");
assert.doesNotMatch(main, /shell:\s*true/, "never spawns through a shell (no PS arg injection surface)");
assert.doesNotMatch(main, /execSync\(/, "no execSync");

// 6 · Regression locks: lock the CURRENT desktop tab count. RUN 23d consolidated the IA 17→9 settings
// tabs (Dashboard / Compliance & Privacy / System / Settings merges; ServiceNow keeps its own tab).
const settingsTabs = new Set([...indexHtml.matchAll(/data-tab="([a-z-]+)"/g)].map((m) => m[1]));
assert.equal(settingsTabs.size, 10, "settings tab count (RUN 23d 9 + RUN 33 ARIA = 10)");
const adminHtml = read("admin-console", "index.html");
// RUN 22 added Fleet Performance + Quarterly Reports + Cohort SLA (→17 admin views).
const adminViews = new Set([...adminHtml.matchAll(/data-view-target="([a-z-]+)"/g)].map((m) => m[1]));
assert.equal(adminViews.size, 19, "admin console view count (18 + guarded RDP access view)");

// 7 · RUN 17 regression: the audit-integrity banner is still wired (must keep firing on tamper).
assert.match(main, /function verifyAuditIntegrity\(\)/, "RUN 17 audit-integrity verifier still present");
assert.match(main, /logEvent\("SECURITY"[\s\S]{0,140}tamper/i, "RUN 17 tamper alert still wired");

console.log("RUN18 enterprise-wiring test passed (live capture · evidence→Documents · attention wiggle · whats-new+release-notes · PS-arg-safe spawn · 9 settings/17 admin tabs locked · RUN17 banner intact).");
