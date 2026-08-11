// axis-globe.js — the AXIS globe. A real rotating 3-D wireframe sphere on canvas.
//
// Ahmad, 2026-08-11: "the look of Axis is still simple and basic not a globe or jarvis look."
// The previous mark was a flat SVG with two spinning ellipses — it read as an icon, not an
// instrument. This projects actual meridians and parallels through a tilted rotation, so the
// sphere has real depth: front-facing arcs are bright, back-facing ones fall away. Around it sits
// the HUD — tick ring, sweeping arc, and a satellite riding an inclined orbit.
//
// PURELY VISUAL. It exports one mount function, owns one canvas, and touches nothing else. Every
// other [data-orb] slot keeps the original SVG mark, so nothing outside this element changes.
//
// State comes from :root[data-axis-state] (idle | listening | thinking | speaking) — the same
// machine that already drives the SVG orb, read rather than written.

const TAU = Math.PI * 2;
const TILT = 0.42;            // axial tilt, radians — enough to read as a globe, not a dartboard
const MERIDIANS = 12;
const PARALLELS = 7;
const SAMPLES = 48;           // points per arc; higher is smoother and costs more

// Per-state motion. Idle drifts; thinking accelerates; listening/speaking pulse the rim.
const STATE = {
  idle:      { spin: 0.0022, glow: 0.42, rim: 0.5, sweep: 0.006 },
  listening: { spin: 0.0034, glow: 0.85, rim: 1.0, sweep: 0.016 },
  thinking:  { spin: 0.0115, glow: 0.72, rim: 0.7, sweep: 0.030 },
  speaking:  { spin: 0.0048, glow: 1.00, rim: 0.9, sweep: 0.020 },
};

const readVar = (name, fallback) => {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch { return fallback; }
};

// Rotate a unit-sphere point by yaw, apply the fixed tilt, and project orthographically.
// Returns screen offsets plus z so the caller can depth-sort and fade the far side.
function project(lat, lon, yaw) {
  const cl = Math.cos(lat), x0 = cl * Math.cos(lon + yaw), y0 = Math.sin(lat), z0 = cl * Math.sin(lon + yaw);
  const ct = Math.cos(TILT), st = Math.sin(TILT);
  return { x: x0, y: y0 * ct - z0 * st, z: y0 * st + z0 * ct };
}

export function mountGlobe(host, { size = 96 } = {}) {
  if (!host || host.dataset.globeLive === '1') return null;
  host.dataset.globeLive = '1';
  host.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'width:100%;height:100%;display:block';
  host.append(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  let dpr = 1, W = size, H = size;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = host.getBoundingClientRect();
    W = Math.max(24, Math.round(r.width || size));
    H = Math.max(24, Math.round(r.height || size));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  let ro = null;
  try { ro = new ResizeObserver(resize); ro.observe(host); } catch {}

  const reduced = (() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  })();

  let yaw = 0.6, sweep = 0, raf = 0, running = true;

  function frame() {
    if (!running) return;
    const gold = readVar('--gold', '#d2a94e');
    const gold2 = readVar('--gold-2', '#e8c87a');
    const st = STATE[document.documentElement.dataset.axisState] || STATE.idle;
    if (!reduced) { yaw += st.spin; sweep += st.sweep; }

    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.36;
    ctx.clearRect(0, 0, W, H);

    // ── HUD: tick ring ──
    ctx.save();
    ctx.strokeStyle = gold; ctx.globalAlpha = 0.30; ctx.lineWidth = 1;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU, long = i % 4 === 0;
      const r1 = R * 1.30, r2 = R * (long ? 1.42 : 1.36);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }
    // Sweeping arc — the "scanning" cue.
    ctx.globalAlpha = 0.55 * st.rim; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.24, sweep, sweep + 1.1); ctx.stroke();
    ctx.globalAlpha = 0.22; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.24, 0, TAU); ctx.stroke();
    ctx.restore();

    // ── Core glow ──
    const g = ctx.createRadialGradient(cx - R * 0.18, cy - R * 0.24, R * 0.05, cx, cy, R);
    g.addColorStop(0, gold2); g.addColorStop(0.5, gold); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.globalAlpha = 0.30 * st.glow;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fillStyle = g; ctx.fill();
    ctx.restore();

    // ── Wireframe. Segments are drawn individually so the far side can fade with depth. ──
    const arc = (pts) => {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const depth = (a.z + b.z) / 2;                 // −1 (back) … +1 (front)
        ctx.globalAlpha = depth > 0 ? 0.30 + depth * 0.55 : 0.10 + (1 + depth) * 0.10;
        ctx.lineWidth = depth > 0 ? 0.9 : 0.6;
        ctx.beginPath();
        ctx.moveTo(cx + a.x * R, cy + a.y * R);
        ctx.lineTo(cx + b.x * R, cy + b.y * R);
        ctx.stroke();
      }
    };
    ctx.save(); ctx.strokeStyle = gold;
    for (let m = 0; m < MERIDIANS; m++) {
      const lon = (m / MERIDIANS) * Math.PI;
      const pts = [];
      for (let i = 0; i <= SAMPLES; i++) pts.push(project(-Math.PI / 2 + (i / SAMPLES) * Math.PI, lon, yaw));
      arc(pts);
    }
    for (let p = 1; p < PARALLELS; p++) {
      const lat = -Math.PI / 2 + (p / PARALLELS) * Math.PI;
      const pts = [];
      for (let i = 0; i <= SAMPLES; i++) pts.push(project(lat, (i / SAMPLES) * TAU, yaw));
      arc(pts);
    }
    ctx.restore();

    // ── Rim + satellite on an inclined orbit ──
    ctx.save();
    ctx.strokeStyle = gold; ctx.globalAlpha = 0.5 + 0.4 * st.rim; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    const sa = -sweep * 1.7, sx = Math.cos(sa) * R * 1.24, sy = Math.sin(sa) * R * 0.42;
    ctx.globalAlpha = 0.95; ctx.fillStyle = gold2;
    ctx.beginPath(); ctx.arc(cx + sx, cy + sy, 1.9, 0, TAU); ctx.fill();
    ctx.restore();

    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // Don't burn a rAF loop on a hidden tab.
  const vis = () => {
    if (document.hidden) { running = false; cancelAnimationFrame(raf); }
    else if (!running) { running = true; raf = requestAnimationFrame(frame); }
  };
  document.addEventListener('visibilitychange', vis);

  return {
    destroy() {
      running = false; cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', vis);
      try { ro && ro.disconnect(); } catch {}
      delete host.dataset.globeLive;
    },
  };
}

// Mount every [data-globe] host. Safe to call repeatedly — live hosts are skipped.
export function mountGlobes(scope = document) {
  const out = [];
  scope.querySelectorAll('[data-globe]').forEach((el) => { const g = mountGlobe(el); if (g) out.push(g); });
  return out;
}
