// RUN 17 — audit-tamper security banner renders when state.auditIntegrity.ok === false. Tests the pure
// model + visibility logic, and asserts the banner is wired into the renderer (markup above the shell,
// render hook in renderState, "View audit log" jumps to the Privacy tab that hosts the log).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { bannerVisible, bannerModel, SECURITY_BANNER_DISMISS_KEY } from "../src/shared/security-banner.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");

// --- Visibility logic ---
const tampered = { ok: false, brokenAt: 2, detectedAt: "2026-06-20T10:00:00.000Z" };
assert.equal(bannerVisible(tampered, false), true, "shows when ok:false and not dismissed");
assert.equal(bannerVisible({ ok: true }, false), false, "hidden when integrity ok");
assert.equal(bannerVisible(tampered, true), false, "hidden when dismissed this session");
assert.equal(bannerVisible(undefined, false), false, "hidden when integrity unknown");
assert.equal(bannerVisible(null, false), false, "hidden when integrity null");

// --- Model text ---
const m = bannerModel(tampered);
assert.equal(m.title, "Security alert: Audit log tampered.");
assert.match(m.subtitle, /^Entries modified or removed at /);
assert.ok(m.subtitle.includes("2"), "subtitle names the broken entry (brokenAt)");
assert.ok(m.subtitle.includes("2026-06-20T10:00:00.000Z"), "subtitle names detectedAt");
assert.match(bannerModel({ ok: false }).subtitle, /unknown entry/, "graceful when brokenAt missing");
assert.ok(SECURITY_BANNER_DISMISS_KEY.startsWith("aria-sentinel:"), "namespaced dismiss key");

// --- Markup: banner sits ABOVE the shell so it persists across all tabs ---
const html = read("src", "renderer", "index.html");
assert.match(html, /id="securityBanner"[^>]*role="alert"/, "banner element with alert role");
assert.ok(html.indexOf('id="securityBanner"') < html.indexOf('class="settings-shell"'), "banner is above the settings shell (persists across tabs)");
assert.match(html, /id="securityBannerView"/, "View audit log button present");
assert.match(html, /id="securityBannerDismiss"/, "Dismiss button present");
assert.match(html, /Security alert: Audit log tampered\./, "static title in markup");

// --- Renderer wiring ---
const r = read("src", "renderer", "renderer.js");
assert.match(r, /from "\.\.\/shared\/security-banner\.mjs"/, "renderer imports the pure model");
assert.match(r, /function renderSecurityBanner/, "renderSecurityBanner defined");
assert.match(r, /renderSecurityBanner\(state\)/, "render hook called from renderState");
assert.match(r, /banner\.hidden = !visible/, "banner shown/hidden by visibility");
assert.match(r, /classList\.toggle\("has-security-banner", visible\)/, "shell is offset only when banner visible");
assert.match(r, /activateTab\("privacy"\)/, "View audit log jumps to the Privacy tab (hosts #logList)");

// --- Styling: cyber-noir red field + gold border-bottom ---
const css = read("src", "renderer", "sentinel.css");
assert.match(css, /\.security-banner\s*\{/, "banner styled");
assert.match(css, /border-bottom:\s*2px solid var\(--aria-gold\)/, "gold border-bottom");
assert.match(css, /\.security-banner\[hidden\]\s*\{\s*display:\s*none/, "hidden attribute hides it");

console.log("Security-banner test passed (visibility + model + markup-above-shell + renderer wiring + cyber-noir styling).");
