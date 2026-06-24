// RUN 17 — Dismiss is per-session only: the flag lives in sessionStorage, so it clears when the
// renderer window is recreated on the next app launch and the banner re-appears while the integrity
// finding (auditIntegrity.ok === false) still stands. Dismiss must NEVER mutate the integrity state.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { bannerVisible, SECURITY_BANNER_DISMISS_KEY } from "../src/shared/security-banner.mjs";

const root = path.resolve(import.meta.dirname, "..");
const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");

const tampered = { ok: false, brokenAt: 1, detectedAt: "2026-06-20T10:00:00.000Z" };

// Within one session: after dismiss, the banner is hidden.
const dismissedThisSession = true;
assert.equal(bannerVisible(tampered, dismissedThisSession), false, "hidden after dismiss this session");

// Next launch = a brand-new renderer window with an empty sessionStorage → the flag is gone, so the
// banner re-appears while the tamper finding still stands.
const dismissedNextLaunch = false; // fresh sessionStorage on relaunch
assert.equal(bannerVisible(tampered, dismissedNextLaunch), true, "banner re-shows on next launch while ok:false");
// And once the log is verified clean again, it stays hidden regardless of any stale flag.
assert.equal(bannerVisible({ ok: true }, false), false, "stays hidden once integrity is restored");

// Mechanism: dismiss writes/reads sessionStorage (per-session), NOT localStorage / electron-store
// (which would persist across launches), and never overwrites auditIntegrity.
assert.match(renderer, /sessionStorage\.setItem\(SECURITY_BANNER_DISMISS_KEY,\s*"1"\)/, "dismiss sets the sessionStorage flag");
assert.match(renderer, /sessionStorage\.getItem\(SECURITY_BANNER_DISMISS_KEY\)/, "visibility reads the sessionStorage flag");
assert.doesNotMatch(renderer, /localStorage/, "never uses localStorage (would survive relaunch)");
assert.doesNotMatch(renderer, /auditIntegrity\s*=[^=]/, "renderer never overwrites the auditIntegrity state");
assert.doesNotMatch(renderer, /setState|store\.set.*auditIntegrity/, "dismiss does not clear the integrity finding");

console.log("Security-banner-dismiss test passed (per-session sessionStorage flag · re-shows next launch · integrity state untouched).");
