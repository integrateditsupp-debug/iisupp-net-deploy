// mode-behavior — pure mapping from the user's mode to the floating-globe window behaviour (RUN 13
// §4). main.mjs applies the result to the overlay window; keeping it pure makes the spec testable.
//   manual    → free-roam, not pinned, INTERACTIVE (PROD 2026-10-14, F3 round 2: the globe can be clicked to open
//               the companion; the overlay's hover-forward pattern keeps the transparent parts click-through)
//   confirmed → pinned always-on-top (screen-saver level), interactive (fix-card bubble)
//   autonomous→ pinned always-on-top, interactive, auto-fixes green recipes (cyan pulse on fix)
export function modeOverlayBehavior(mode) {
  if (mode === "confirmed" || mode === "autonomous") {
    return { alwaysOnTop: true, level: "screen-saver", ignoreMouse: false, autoFix: mode === "autonomous" };
  }
  // manual (and any unknown value) → the free-roaming default; no longer click-through (it was unclickable without Ctrl+Alt+G)
  return { alwaysOnTop: false, level: "floating", ignoreMouse: false, autoFix: false };
}
