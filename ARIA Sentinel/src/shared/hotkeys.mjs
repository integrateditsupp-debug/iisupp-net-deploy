// hotkeys — RUN 15 §7. Pure registration helper with fallback combos + live status, so a globe/chat
// hotkey that's blocked by another app falls back instead of silently failing (the RUN 12 bug).
// register/isRegistered are injected (Electron globalShortcut) so this is unit-testable.
export const DEFAULT_HOTKEYS = [
  { id: "chat", combo: "CommandOrControl+Alt+A", fallback: "CommandOrControl+Shift+A", action: "focus-chat", label: "Open ARIA chat" },
  { id: "globe", combo: "CommandOrControl+Alt+G", fallback: "CommandOrControl+Shift+G", action: "toggle-globe", label: "Show or hide the globe" },
  { id: "pause", combo: "CommandOrControl+Alt+P", fallback: "CommandOrControl+Shift+P", action: "pause-24h", label: "Pause watching for 24 hours" }
];

// PROD 2026-10-14 (audit M20) — on Windows, Ctrl+Alt IS AltGr. A global Ctrl+Alt+A/G/P steals ą/ă/ğ/ő and friends
// from EVERY application while Sentinel runs on Polish, Romanian, Hungarian, Croatian, Czech, Slovak, Turkish,
// Lithuanian, Latvian, Estonian and Canadian-multilingual layouts. The everyday chords are therefore CONFIGURABLE:
//   · ALTGR_SAFE_HOTKEYS — the same three actions on Ctrl+Shift+Alt+<key>, which no AltGr layout uses for a
//     lowercase letter; chosen automatically when the system language is one of the AltGr-heavy locales below, or
//     when the person opts in (Settings → Hotkeys → "AltGr-safe chords");
//   · `hotkeysEnabled:false` (Settings → Hotkeys) registers none of the three — the kill switch keeps its own switch;
//   · every chord stays rebindable per id (withRebinds), as before.
// The kill switch (Ctrl+Alt+K, kill-switch.mjs) is documented as the one AltGr chord Sentinel keeps: it is the
// panic key the product advertises, rebindable in the same tab.
export const ALTGR_SAFE_HOTKEYS = DEFAULT_HOTKEYS.map((d) => ({ ...d, combo: d.combo.replace("CommandOrControl+Alt+", "CommandOrControl+Shift+Alt+") }));
export const ALTGR_LOCALES = Object.freeze(["pl", "ro", "hu", "hr", "cs", "sk", "tr", "lt", "lv", "et", "sl", "sr", "bs", "sq", "mt"]);

/** Does any of the system languages belong to an AltGr-heavy layout family? ("pl-PL", "ro", "hu-HU" …) */
export function localeUsesAltGr(locales = []) {
  const list = Array.isArray(locales) ? locales : [locales];
  return list.some((l) => ALTGR_LOCALES.includes(String(l || "").toLowerCase().split(/[-_]/)[0]));
}

/**
 * The hotkey set to register for this device: AltGr-safe when the person opted in OR the system language says the
 * layout needs it; the classic Ctrl+Alt set otherwise. `enabled:false` → an empty set (nothing global is taken).
 */
export function selectDefaultHotkeys({ locales = [], altGrSafe, enabled = true } = {}) {
  if (enabled === false) return [];
  const safe = altGrSafe === true || (altGrSafe !== false && localeUsesAltGr(locales));
  return (safe ? ALTGR_SAFE_HOTKEYS : DEFAULT_HOTKEYS).map((d) => ({ ...d }));
}

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
