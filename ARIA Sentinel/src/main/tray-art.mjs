// tray-art — pure generator for the four tray-icon states. No Electron import, so it is unit testable in
// plain Node. PROD 2026-10-14 (audit M2): Electron's nativeImage.createFromDataURL decodes ONLY image/png and
// image/jpeg — the SVG data URL this module used to hand main.mjs produced an EMPTY image (blank tray slot on
// Windows, invisible status item on macOS). The art is therefore described ONCE here as a list of primitives;
// traySvg() renders that list to SVG (for tests / design review) and scripts/render-tray-png.mjs rasterizes the
// SAME list to the PNG data URLs in tray-art-png.mjs that main.mjs actually hands to nativeImage. One source.
//
//   idle       gold globe (watching, nothing wrong)            — the RUN 1 resting icon
//   detection  cyan accent + alert dot (an issue was found)
//   fixing     amber globe + sweep arc (a recipe is running)
//   escalation red ring + bang (needs a human / a fix failed / red recipe)
//
// Each state is a DISTINCT image (different palette + glyph), so the four nativeImages differ.

export const TRAY_STATES = ["idle", "detection", "fixing", "escalation"];
export const TRAY_ART_SIZE = 64; // the design grid (viewBox) every primitive is drawn on

// Per-state palette + the extra glyph drawn over the shared globe base.
const STATE_ART = {
  idle: { inner: "#f1dca7", ring: "#c5a059", glyph: [] },
  detection: {
    inner: "#bff0ff",
    ring: "#39c4ff",
    // alert dot, top-right
    glyph: [
      { type: "circle", cx: 50, cy: 14, r: 7, fill: "#39c4ff" },
      { type: "circle", cx: 50, cy: 14, r: 7, stroke: "#0a0f14", strokeOpacity: 0.35, strokeWidth: 1.2 }
    ]
  },
  fixing: {
    inner: "#ffe6b0",
    ring: "#f2a73b",
    // sweeping arc to read as "working" — M32 6 A26 26 0 0 1 58 32 (top → right, clockwise)
    glyph: [{ type: "arc", cx: 32, cy: 32, r: 26, startDeg: -90, endDeg: 0, stroke: "#f2a73b", strokeWidth: 4, cap: "round" }]
  },
  escalation: {
    inner: "#ffd2cf",
    ring: "#ff5247",
    // outer alert ring + exclamation
    glyph: [
      { type: "circle", cx: 32, cy: 32, r: 29, stroke: "#ff5247", strokeWidth: 3 },
      { type: "rect", x: 29.5, y: 40, width: 5, height: 5, rx: 1.2, fill: "#ff5247" },
      { type: "rect", x: 29.5, y: 20, width: 5, height: 16, rx: 2.2, fill: "#ff5247" }
    ]
  }
};

export function normalizeTrayState(state) {
  return TRAY_STATES.includes(state) ? state : "idle";
}

/** The palette of a state ({ inner, ring }). */
export function trayPalette(state) {
  const art = STATE_ART[normalizeTrayState(state)];
  return { inner: art.inner, ring: art.ring };
}

/**
 * The two radial gradients of a state, in SVG objectBoundingBox terms (fractions of the painted circle's box).
 * g1 = the globe body, g2 = the soft halo behind it. Stops carry colour + opacity.
 */
export function trayGradients(state) {
  const { inner, ring } = trayPalette(state);
  return {
    g1: { cx: 0.36, cy: 0.34, r: 0.62, stops: [{ offset: 0, color: inner, opacity: 0.96 }, { offset: 0.55, color: ring, opacity: 0.75 }, { offset: 1, color: "#5a3f10", opacity: 0 }] },
    g2: { cx: 0.5, cy: 0.5, r: 0.5, stops: [{ offset: 0, color: ring, opacity: 0.42 }, { offset: 1, color: ring, opacity: 0 }] }
  };
}

/**
 * The ordered primitive list of a state (painter's order, 64×64 grid). `fill` is a colour string or
 * { gradient: "g1"|"g2" }; strokes carry stroke/strokeOpacity/strokeWidth. Pure and deterministic.
 */
export function trayPrimitives(state) {
  const key = normalizeTrayState(state);
  const art = STATE_ART[key];
  return [
    { type: "circle", cx: 32, cy: 32, r: 30, fill: { gradient: "g2" } },
    { type: "circle", cx: 32, cy: 32, r: 20, fill: { gradient: "g1" } },
    { type: "circle", cx: 32, cy: 32, r: 20, stroke: art.ring, strokeOpacity: 0.75, strokeWidth: 1.2 },
    { type: "circle", cx: 32, cy: 32, r: 13, stroke: art.ring, strokeOpacity: 0.55, strokeWidth: 0.9 },
    { type: "circle", cx: 32, cy: 32, r: 6, stroke: art.ring, strokeOpacity: 0.65, strokeWidth: 0.8 },
    { type: "line", x1: 12, y1: 32, x2: 52, y2: 32, stroke: art.ring, strokeOpacity: 0.6, strokeWidth: 1 },
    { type: "line", x1: 32, y1: 12, x2: 32, y2: 52, stroke: art.ring, strokeOpacity: 0.6, strokeWidth: 1 },
    ...art.glyph.map((p) => ({ ...p }))
  ];
}

const num = (v) => String(Math.round(v * 1000) / 1000);
const fillAttr = (fill, key) => (fill && typeof fill === "object" ? `url(#${fill.gradient}-${key})` : fill || "none");
function strokeAttrs(p) {
  if (!p.stroke) return "";
  return ` stroke="${p.stroke}"${p.strokeOpacity != null ? ` stroke-opacity="${num(p.strokeOpacity)}"` : ""} stroke-width="${num(p.strokeWidth || 1)}"${p.cap ? ` stroke-linecap="${p.cap}"` : ""}`;
}
function primitiveSvg(p, key) {
  switch (p.type) {
    case "circle": return `<circle cx="${num(p.cx)}" cy="${num(p.cy)}" r="${num(p.r)}" fill="${fillAttr(p.fill, key)}"${strokeAttrs(p)}/>`;
    case "line": return `<line x1="${num(p.x1)}" y1="${num(p.y1)}" x2="${num(p.x2)}" y2="${num(p.y2)}"${strokeAttrs(p)}/>`;
    case "rect": return `<rect x="${num(p.x)}" y="${num(p.y)}" width="${num(p.width)}" height="${num(p.height)}" rx="${num(p.rx || 0)}" fill="${fillAttr(p.fill, key)}"${strokeAttrs(p)}/>`;
    case "arc": {
      const rad = (d) => (d * Math.PI) / 180;
      const sx = p.cx + p.r * Math.cos(rad(p.startDeg)), sy = p.cy + p.r * Math.sin(rad(p.startDeg));
      const ex = p.cx + p.r * Math.cos(rad(p.endDeg)), ey = p.cy + p.r * Math.sin(rad(p.endDeg));
      const large = Math.abs(p.endDeg - p.startDeg) > 180 ? 1 : 0;
      const sweep = p.endDeg > p.startDeg ? 1 : 0;
      return `<path d="M${num(sx)} ${num(sy)} A${num(p.r)} ${num(p.r)} 0 ${large} ${sweep} ${num(ex)} ${num(ey)}" fill="none"${strokeAttrs(p)}/>`;
    }
    default: return "";
  }
}

// The raw SVG markup for a state, rendered from the primitive list. Distinct per state by construction.
export function traySvg(state) {
  const key = normalizeTrayState(state);
  const g = trayGradients(key);
  const stops = (grad) => grad.stops.map((s) => `<stop offset="${Math.round(s.offset * 100)}%" stop-color="${s.color}" stop-opacity="${num(s.opacity)}"/>`).join("");
  const pct = (v) => `${Math.round(v * 100)}%`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TRAY_ART_SIZE}" height="${TRAY_ART_SIZE}" viewBox="0 0 ${TRAY_ART_SIZE} ${TRAY_ART_SIZE}" data-state="${key}">
  <defs>
    <radialGradient id="g1-${key}" cx="${pct(g.g1.cx)}" cy="${pct(g.g1.cy)}" r="${pct(g.g1.r)}">${stops(g.g1)}</radialGradient>
    <radialGradient id="g2-${key}" cx="${pct(g.g2.cx)}" cy="${pct(g.g2.cy)}" r="${pct(g.g2.r)}">${stops(g.g2)}</radialGradient>
  </defs>
  ${trayPrimitives(key).map((p) => primitiveSvg(p, key)).join("\n  ")}
</svg>`;
}

// Data URL form of the SVG. KEPT for compatibility (Rule 15) and as the design-review artefact — main.mjs no
// longer hands this to nativeImage (it cannot decode SVG); it uses tray-art-png.mjs, rendered from the same art.
export function traySvgDataUrl(state) {
  return `data:image/svg+xml,${encodeURIComponent(traySvg(state))}`;
}
