// axis/voice-in/hotkey-listener.mjs — STUB (RUN A · Phase 1 scaffold)
// Purpose: register a global hotkey that toggles AXIS voice capture on/off. When pressed, it tells the
// caller to start recording (→ whisper-wrapper) and, on the next press / release, to stop + transcribe.
// Reuses Electron's globalShortcut (already a Sentinel dependency) — NO new dependency.
//
// Default combo: Win+Space ("Super+Space"). Falls back like the Sentinel hotkeys do if blocked.

export const DEFAULT_HOTKEY = "Super+Space";
export const FALLBACK_HOTKEY = "CommandOrControl+Shift+Space";

/**
 * Register the AXIS push-to-talk hotkey.
 * @param {object} _opts { combo?, register?, isRegistered?, onTrigger }
 *   register/isRegistered are injected (Electron globalShortcut) so this stays unit-testable.
 * @returns {{ combo: string, status: "active"|"failed", usedFallback: boolean }}
 */
export function registerHotkey(_opts = {}) {
  // TODO(phase-1): try DEFAULT_HOTKEY, then FALLBACK_HOTKEY; confirm with isRegistered; return status.
  throw new Error("AXIS hotkey-listener: not implemented (Phase 1 stub)");
}

/** Unregister the AXIS hotkey on shutdown. */
export function unregisterHotkey(_opts = {}) {
  // TODO(phase-1): globalShortcut.unregister(combo)
  throw new Error("AXIS hotkey-listener: not implemented (Phase 1 stub)");
}
