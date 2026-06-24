// mode-behavior — pure mapping from the user's mode to the floating-globe window behaviour (RUN 13
// §4). main.mjs applies the result to the overlay window; keeping it pure makes the spec testable.
//   manual    → free-roam, click-through, not pinned (RUN 12 v2 default)
//   confirmed → pinned always-on-top (screen-saver level), interactive (fix-card bubble)
//   autonomous→ pinned always-on-top, interactive, auto-fixes green recipes (cyan pulse on fix)
export function modeOverlayBehavior(mode) {
  if (mode === "confirmed" || mode === "autonomous") {
    return { alwaysOnTop: true, level: "screen-saver", ignoreMouse: false, autoFix: mode === "autonomous" };
  }
  // manual (and any unknown value) → the free-roaming, click-through default
  return { alwaysOnTop: false, level: "floating", ignoreMouse: true, autoFix: false };
}
