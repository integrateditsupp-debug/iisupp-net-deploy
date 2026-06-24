// axis/voice-in/tests/hotkey.test.mjs — STUB unit test (RUN A · Phase 1 scaffold)
// Asserts the hotkey-listener contract is in place. Not wired into the main Sentinel `npm test` yet —
// it runs standalone (`node axis/voice-in/tests/hotkey.test.mjs`) until Phase 1 ships real logic.
import assert from "node:assert/strict";
import { DEFAULT_HOTKEY, FALLBACK_HOTKEY, registerHotkey, unregisterHotkey } from "../hotkey-listener.mjs";

// Contract exists.
assert.equal(DEFAULT_HOTKEY, "Super+Space", "AXIS push-to-talk defaults to Win+Space");
assert.match(FALLBACK_HOTKEY, /Space/, "fallback combo defined");
assert.equal(typeof registerHotkey, "function", "registerHotkey exported");
assert.equal(typeof unregisterHotkey, "function", "unregisterHotkey exported");

// Phase 1 stub: registration throws until implemented (documents the not-yet-built boundary).
assert.throws(() => registerHotkey({}), /stub/, "registerHotkey is a Phase 1 stub");

// TODO(phase-1): replace with a real test — inject a fake register/isRegistered, assert primary combo
// is tried first, fallback on block, and status is reported (mirrors src/shared/hotkeys.mjs).
console.log("AXIS hotkey stub test passed (contract present; implementation pending Phase 1).");
