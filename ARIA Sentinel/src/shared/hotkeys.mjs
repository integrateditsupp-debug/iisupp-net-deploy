// hotkeys — RUN 15 §7. Pure registration helper with fallback combos + live status, so a globe/chat
// hotkey that's blocked by another app falls back instead of silently failing (the RUN 12 bug).
// register/isRegistered are injected (Electron globalShortcut) so this is unit-testable.
export const DEFAULT_HOTKEYS = [
  { id: "chat", combo: "CommandOrControl+Alt+A", fallback: "CommandOrControl+Shift+A", action: "focus-chat", label: "Open ARIA chat" },
  { id: "globe", combo: "CommandOrControl+Alt+G", fallback: "CommandOrControl+Shift+G", action: "toggle-globe", label: "Show or hide the globe" },
  { id: "pause", combo: "CommandOrControl+Alt+P", fallback: "CommandOrControl+Shift+P", action: "pause-24h", label: "Pause watching for 24 hours" }
];

/**
 * Register one hotkey, trying the primary then the fallback combo.
 * @param {object} def { id, combo, fallback, action, label }
 * @param {(combo, handler)=>boolean} registerFn returns true if bound (or throws/false on failure)
 * @param {(combo)=>boolean} isRegisteredFn
 * @param {function} handler
 * @returns {{ id, action, label, combo, status:'active'|'failed', usedFallback:boolean, reason }}
 */
export function registerWithFallback(def, registerFn, isRegisteredFn, handler) {
  const tryCombo = (combo) => {
    try {
      const ok = registerFn(combo, handler);
      const confirmed = ok && (isRegisteredFn ? isRegisteredFn(combo) : true);
      return Boolean(confirmed);
    } catch {
      return false;
    }
  };
  if (tryCombo(def.combo)) {
    return { id: def.id, action: def.action, label: def.label, combo: def.combo, status: "active", usedFallback: false, reason: "ok" };
  }
  if (def.fallback && tryCombo(def.fallback)) {
    return { id: def.id, action: def.action, label: def.label, combo: def.fallback, status: "active", usedFallback: true, reason: "primary-blocked" };
  }
  return { id: def.id, action: def.action, label: def.label, combo: def.combo, status: "failed", usedFallback: false, reason: "all-combos-blocked" };
}

export function bindAll(defs, registerFn, isRegisteredFn, handlerFor) {
  return (Array.isArray(defs) ? defs : []).map((d) => registerWithFallback(d, registerFn, isRegisteredFn, handlerFor ? handlerFor(d) : undefined));
}

// Merge user rebinds (from electron-store) over the defaults.
export function withRebinds(defs, rebinds = {}) {
  return defs.map((d) => (rebinds[d.id] ? { ...d, combo: rebinds[d.id] } : d));
}
