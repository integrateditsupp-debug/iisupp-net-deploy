// RUN 22 §1 — the single hero status is driven by the 4 trust sources, with correct color/level logic.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { computeHeroStatus, heroSubline, STATUS } from "../src/shared/dashboard-status.mjs";

// All clear → PROTECTED (green).
assert.equal(computeHeroStatus({ auditOk: true, privacyOk: true, tier0Ok: true, heartbeatOk: true }).level, "protected");
assert.equal(computeHeroStatus({}).level, "protected", "defaults to protected");
// A security guarantee failing (audit tamper OR privacy/sanitization) → CRITICAL (red).
assert.equal(computeHeroStatus({ auditOk: false }).level, "critical");
assert.equal(computeHeroStatus({ privacyOk: false }).level, "critical");
// Operational degradation (Tier-0 gate OR heartbeat) → ATTENTION (yellow).
assert.equal(computeHeroStatus({ tier0Ok: false }).level, "attention");
assert.equal(computeHeroStatus({ heartbeatOk: false }).level, "attention");
// Security beats operational: audit down + heartbeat down → still CRITICAL.
assert.equal(computeHeroStatus({ auditOk: false, heartbeatOk: false }).level, "critical");

// Colors + emojis distinct per level.
assert.equal(STATUS.protected.color, "#7afbff");
assert.equal(STATUS.critical.emoji, "🔴");
assert.equal(STATUS.attention.label, "ATTENTION");

// Sub-line includes the live counters.
const sub = heroSubline({ eventsToday: 42, threats: 3, lastSyncAgo: "5m ago" });
assert.match(sub, /42 events scanned/);
assert.match(sub, /3 threats blocked/);
assert.match(sub, /last sync 5m ago/);

// The Overview panel hosts the hero status element + sub-line.
const indexHtml = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "src", "renderer", "index.html"), "utf8");
assert.match(indexHtml, /id="heroStatus"/, "hero status element present");
assert.match(indexHtml, /id="heroSubline"/, "hero sub-line present");
assert.match(indexHtml, /id="trustStrip"/, "trust strip present");

// UX 2026-07-03: the status IS the colored word — no separate dot/globe to the left of PROTECTED.
assert.doesNotMatch(indexHtml, /hero-emoji/, "no separate emoji/dot next to the hero label");
const rendererJs = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "src", "renderer", "renderer.js"), "utf8");
assert.doesNotMatch(rendererJs, /hero-emoji/, "renderer must not inject a separate status dot");
const css = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "src", "renderer", "sentinel.css"), "utf8");
assert.match(css, /data-level="protected"\] \.hero-label \{ color: var\(--aria-status-green\)/, "PROTECTED word carries the status-green color itself");

console.log("Dashboard-hero-status test passed (4 sources → protected/attention/critical; security beats operational; word-only status, no dot).");
