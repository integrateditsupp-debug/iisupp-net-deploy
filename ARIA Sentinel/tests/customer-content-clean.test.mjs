// PROD 2026-10-14 (audit R7 / R21) — founder / internal content never reaches a customer surface. The FEATURES
// stay (Rule 15: the excluded-folder guard, the AI-tool walk-throughs, the compliance rows); only the internal
// wording goes: the founder's folder name, the internal rule id as a customer label, the founder's name, the
// build tooling, vault paths, and the personal mailbox as the product's support contact.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const rd = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
let n = 0; const t = () => { n++; };

const RENDERER_FILES = [
  "src/renderer/index.html", "src/renderer/renderer.js", "src/renderer/sentinel.css", "src/renderer/overlay.html", "src/renderer/overlay.js",
  "src/renderer/voice-conversation.mjs", "src/renderer/local-stt.mjs", "src/renderer/tabs/compliance.mjs", "src/renderer/tabs/dashboard.mjs",
  "src/renderer/tabs/home.mjs", "src/renderer/tabs/performance.mjs", "src/renderer/tabs/reports.mjs", "src/renderer/tabs/sla.mjs", "src/renderer/components/aria-globe.mjs",
  "src/overlay/action-indicator.html", "src/overlay/action-indicator.mjs", "src/overlay/globe-status-panel.html", "src/overlay/globe-status-panel.mjs", "src/overlay/plan-picker.html", "src/overlay/plan-picker.mjs"
];
const SHARED_FILES = [
  "compliance-score", "pricing-tiers", "license-plan", "tab-gating", "whats-new", "walkthrough-steps", "onboarding-activation", "account-intake", "status-badge",
  "dashboard-status", "health-score", "globe-anchor", "globe-confirmation", "globe-greetings", "honest-opening", "trust-posture", "upsell", "security-banner",
  "command-palette", "aria-markdown", "kb-answer-shape", "voice-turns", "trial-copy", "fix-outcome", "setup-flow"
].map((f) => `src/shared/${f}.mjs`).concat(fs.readdirSync(path.join(root, "src", "shared")).filter((f) => /^ask-.*\.mjs$/.test(f)).map((f) => `src/shared/${f}`));

// Tokens that must not appear ANYWHERE in these files (comments included — a shipped file is a shipped file).
const FORBIDDEN = [
  [/Private pics and Vids/i, "the founder's folder name"],
  [/\bAhmad\b/i, "the founder's name"],
  [/\bCowork\b/, "the build tooling"],
  [/aria-vault/i, "a dev-vault path"],
  [/same way this app was built|this very app was built|the way this app was built/i, "a build-origin claim"],
  [/ahmad\.wasee@/i, "the personal mailbox"]
];
// Tokens that must not appear as CUSTOMER-VISIBLE text (markup text, string literals) — comments are stripped first.
// (Claude Code / Codex stay as PRODUCTS the walk-through sets up for the customer; only build-origin claims are forbidden above.)
const FORBIDDEN_VISIBLE = [
  [/\bR11\b/, "the internal rule id as a customer label"]
];
function stripComments(src, file) {
  if (file.endsWith(".html")) return src.replace(/<!--[\s\S]*?-->/g, "");
  return src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "")).join("\n").replace(/(^|[^:"'`\\])\/\/[^\n]*$/gm, "$1");
}

// 1 — renderer + overlay surfaces are clean.
for (const f of RENDERER_FILES) {
  const src = rd(f);
  for (const [re, why] of FORBIDDEN) assert.doesNotMatch(src, re, `${f}: ${why} must not ship in a renderer file`);
  const vis = stripComments(src, f);
  for (const [re, why] of FORBIDDEN_VISIBLE) assert.doesNotMatch(vis, re, `${f}: ${why} must not be customer-visible`);
}
t();

// 2 — the UI-shaping shared modules are clean too.
for (const f of SHARED_FILES) {
  if (!fs.existsSync(path.join(root, f))) continue;
  const src = rd(f);
  for (const [re, why] of FORBIDDEN) assert.doesNotMatch(src, re, `${f}: ${why}`);
  const vis = stripComments(src, f);
  for (const [re, why] of FORBIDDEN_VISIBLE) assert.doesNotMatch(vis, re, `${f}: ${why}`);
}
t();

// 3 — the FEATURES stay (Rule 15): the excluded-folder rows, the AI-tool walk-throughs (Claude Code / Codex as products), the support rows.
const html = rd("src/renderer/index.html");
assert.match(html, /id="compR11"/, "the excluded-folder compliance rows are still rendered");
assert.match(html, /Excluded folders/, "…under a customer label");
assert.match(html, /id="excludedFoldersLine"/, "the excluded-folder count shows in Settings");
assert.match(html, /support@iisupp\.net/, "the company support alias is the contact");
assert.match(html, /data-support="mailto:support@iisupp\.net"/);
assert.match(html, /\+1-647-581-3182/, "the company phone stays");
const walk = rd("src/shared/walkthrough-steps.mjs");
assert.match(walk, /"codex-setup"/, "the Claude Code / Codex setup walk-through stays (a customer feature)");
assert.match(walk, /Set up Claude Code \/ Codex CLI/, "…with its product title");
const comp = rd("src/renderer/tabs/compliance.mjs");
assert.match(comp, /export function r11RowsHtml\(r = \{\}, excluded = null\)/, "the rows take the customer's own excluded-folder count");
assert.match(comp, /excluded folders: \$\{count\}/, "…and print a count, never a name");
const reports = rd("src/renderer/tabs/reports.mjs");
assert.match(reports, /excluded folders never touched/); assert.doesNotMatch(reports, /R11 private folder/);
t();

assert.equal(n, 3, "3 customer-content-clean groups");
console.log(`customer-content-clean test passed (${n} groups · ${RENDERER_FILES.length} renderer/overlay files + ${SHARED_FILES.length} UI-shaping modules free of founder/internal tokens · features kept under product wording).`);
