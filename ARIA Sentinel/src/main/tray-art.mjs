// tray-art — pure SVG generator for the four tray-icon states. No Electron import, so it is unit
// testable in plain Node; main.mjs wraps the output in nativeImage.createFromDataURL().
//
//   idle       gold globe (watching, nothing wrong)            — the RUN 1 resting icon
//   detection  cyan accent + alert dot (an issue was found)
//   fixing     amber globe + sweep arc (a recipe is running)
//   escalation red ring + bang (needs a human / a fix failed / red recipe)
//
// Each state is a DISTINCT SVG string (different palette + glyph), so the four nativeImages differ.

export const TRAY_STATES = ["idle", "detection", "fixing", "escalation"];

// Per-state palette + the extra glyph drawn over the shared globe base.
const STATE_ART = {
  idle: {
    inner: "#f1dca7",
    ring: "#c5a059",
    glyph: ""
  },
  detection: {
    inner: "#bff0ff",
    ring: "#39c4ff",
    // alert dot, top-right
    glyph: '<circle cx="50" cy="14" r="7" fill="#39c4ff"/><circle cx="50" cy="14" r="7" fill="none" stroke="#0a0f14" stroke-opacity=".35" stroke-width="1.2"/>'
  },
  fixing: {
    inner: "#ffe6b0",
    ring: "#f2a73b",
    // sweeping arc to read as "working"
    glyph: '<path d="M32 6 A26 26 0 0 1 58 32" fill="none" stroke="#f2a73b" stroke-width="4" stroke-linecap="round"/>'
  },
  escalation: {
    inner: "#ffd2cf",
    ring: "#ff5247",
    // outer alert ring + exclamation
    glyph: '<circle cx="32" cy="32" r="29" fill="none" stroke="#ff5247" stroke-width="3"/><rect x="29.5" y="40" width="5" height="5" rx="1.2" fill="#ff5247"/><rect x="29.5" y="20" width="5" height="16" rx="2.2" fill="#ff5247"/>'
  }
};

export function normalizeTrayState(state) {
  return TRAY_STATES.includes(state) ? state : "idle";
}

// The raw SVG markup for a state. Distinct per state by construction.
export function traySvg(state) {
  const key = normalizeTrayState(state);
  const art = STATE_ART[key];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" data-state="${key}">
  <defs>
    <radialGradient id="g1-${key}" cx="36%" cy="34%" r="62%">
      <stop offset="0%" stop-color="${art.inner}" stop-opacity=".96"/>
      <stop offset="55%" stop-color="${art.ring}" stop-opacity=".75"/>
      <stop offset="100%" stop-color="#5a3f10" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2-${key}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${art.ring}" stop-opacity=".42"/>
      <stop offset="100%" stop-color="${art.ring}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="url(#g2-${key})"/>
  <circle cx="32" cy="32" r="20" fill="url(#g1-${key})"/>
  <circle cx="32" cy="32" r="20" fill="none" stroke="${art.ring}" stroke-opacity=".75" stroke-width="1.2"/>
  <circle cx="32" cy="32" r="13" fill="none" stroke="${art.ring}" stroke-opacity=".55" stroke-width=".9"/>
  <circle cx="32" cy="32" r="6" fill="none" stroke="${art.ring}" stroke-opacity=".65" stroke-width=".8"/>
  <line x1="12" y1="32" x2="52" y2="32" stroke="${art.ring}" stroke-opacity=".6" stroke-width="1"/>
  <line x1="32" y1="12" x2="32" y2="52" stroke="${art.ring}" stroke-opacity=".6" stroke-width="1"/>
  ${art.glyph}
</svg>`;
}

// Data URL form main.mjs hands to nativeImage.createFromDataURL.
export function traySvgDataUrl(state) {
  return `data:image/svg+xml,${encodeURIComponent(traySvg(state))}`;
}
