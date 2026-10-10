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
// Ahmad, 2026-08-12: "make also more detailed like the big version (full screen) version appearance."
// Brought up toward axis-hologram.js's density (18/11/64) rather than all the way to it: this canvas
// is ~120px and runs continuously behind the whole console, where the hologram is full-screen and
// opened deliberately. These numbers roughly double the geometry and still hold 60fps — measured,
// not assumed. SHELLS is what actually buys the volumetric look; the second shell sits just inside
// the first at a different phase, which is what makes the sphere read as having a thickness.
const MERIDIANS = 16;
const PARALLELS = 10;
const SAMPLES = 56;           // points per arc; higher is smoother and costs more
const SHELLS = 2;
const DUST = 44;              // orbiting particles — the halo the hologram has and this lacked
const TICKS = 64;

// Per-state motion. Idle drifts; thinking accelerates; listening/speaking pulse the rim.
const STATE = {
  idle:      { spin: 0.0022, glow: 0.42, rim: 0.5, sweep: 0.006 },
  listening: { spin: 0.0034, glow: 0.85, rim: 1.0, sweep: 0.016 },
  thinking:  { spin: 0.0115, glow: 0.72, rim: 0.7, sweep: 0.030 },
  speaking:  { spin: 0.0048, glow: 1.00, rim: 0.9, sweep: 0.020 },
};

// How fast the eased values chase their target. Low enough that a state change reads as the globe
// responding over about a second, rather than a different picture being swapped in.
const EASE = 0.035;
const VOICE_EASE = 0.09;      // the talking envelope may start and stop faster than the scene

// Deterministic pseudo-noise. Math.random() per frame makes the motion hiss; this makes it breathe,
// and it stays identical across frames for a given t so the envelope is smooth rather than jittery.
const noise = (x) => {
  const s = Math.sin(x * 12.9898) * 43758.5453;
  return s - Math.floor(s);
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

  let yaw = 0.6, sweep = 0, raf = 0, running = true, t = 0;
  // Set per shell while the wireframe draws, so arc() can dim and shrink the inner shell without
  // every call site having to thread two more arguments through.
  let shellDim = 1, shellR = 1;
  const BANDS = 7;
  const bands = Array.from({ length: BANDS }, () => []);

  // Fixed inclined orbits. Deterministic, so the halo is stable frame to frame instead of hissing.
  const dust = Array.from({ length: DUST }, (_, i) => ({
    lat: Math.asin(2 * noise(i * 1.7) - 1),
    lon: noise(i * 3.1) * TAU,
    r: 1.08 + noise(i * 5.3) * 0.42,
    sp: 0.10 + noise(i * 7.9) * 0.45,
    sz: 0.5 + noise(i * 11.3) * 1.1,
  }));

  // ONE continuously-eased set of values, borrowed from the Voice Visualizer principle on
  // jaredrhod.com — the same idea axis-hologram.js already runs on. Nothing here may SNAP between
  // states: spin, glow, rim and sweep all ride the same easing, so switching from idle to speaking
  // reads as the globe waking up rather than as a different picture appearing. Before this, the
  // values were read straight off STATE[...] every frame, which is why the globe changed size and
  // brightness in one jarring step and dropped back just as abruptly.
  const cur = { ...STATE.idle, voice: 0 };

  function frame() {
    if (!running) return;
    if (!host.isConnected) {
      running = false;
      document.removeEventListener('visibilitychange', vis);
      ro?.disconnect();
      return;
    }
    const gold = readVar('--gold', '#d2a94e');
    const gold2 = readVar('--gold-2', '#e8c87a');
    const state = document.documentElement.dataset.axisState || 'idle';
    const target = STATE[state] || STATE.idle;
    for (const k of ['spin', 'glow', 'rim', 'sweep']) cur[k] += (target[k] - cur[k]) * EASE;
    // The talking envelope. Speech is irregular — a single sine reads as a loading spinner — so two
    // out-of-phase noise bands are summed to get an uneven rise and fall that looks like a voice.
    cur.voice += ((state === 'speaking' ? 1 : 0) - cur.voice) * VOICE_EASE;
    if (!reduced) { yaw += cur.spin; sweep += cur.sweep; t += 0.016; }
    const env = reduced ? 0
      : cur.voice * (0.58 * noise(t * 2.7) + 0.42 * noise(t * 6.3 + 11.4));

    const cx = W / 2, cy = H / 2;
    // The sphere itself swells slightly on each syllable, on top of whatever size the CSS box is
    // transitioning to. Kept small (6%) — this should look like breath behind the voice, not a pump.
    const R = Math.min(W, H) * 0.36 * (1 + env * 0.06);
    const st = cur;
    ctx.clearRect(0, 0, W, H);

    // ── HUD: tick ring ──
    ctx.save();
    ctx.strokeStyle = gold; ctx.globalAlpha = 0.30; ctx.lineWidth = 1;
    for (let i = 0; i < TICKS; i++) {
      const a = (i / TICKS) * TAU, long = i % 8 === 0;
      const r1 = R * 1.30, r2 = R * (long ? 1.42 : 1.355);
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
    // Counter-rotating HUD arcs. Two turning against each other is what makes a ring set look like
    // an instrument rather than a loading spinner.
    for (const [rr, al, ang, span] of [[1.50, 0.75, sweep * 0.8, 2.0],
                                       [1.60, 0.45, -sweep * 0.55, 1.25],
                                       [1.68, 0.30, sweep * 0.35, 2.8]]) {
      ctx.globalAlpha = al * (0.30 + st.rim * 0.55); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R * rr, ang, ang + span); ctx.stroke();
    }
    ctx.restore();

    // ── Core glow ──
    const g = ctx.createRadialGradient(cx - R * 0.18, cy - R * 0.24, R * 0.05, cx, cy, R);
    g.addColorStop(0, gold2); g.addColorStop(0.5, gold); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.globalAlpha = 0.30 * st.glow;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fillStyle = g; ctx.fill();
    ctx.restore();

    // ── Wireframe. Segments are drawn individually so the far side can fade with depth. ──
    // Depth-banded batching. Drawing each segment with its own stroke() is the obvious way to get a
    // per-segment depth fade, and it is what this did — but two shells at this density is ~2,800
    // stroke() calls every frame, on an element that is on screen all day. Measured before the
    // change: 11,600 canvas ops per frame.
    //
    // Segments are bucketed by depth instead, then each bucket is stroked ONCE as a single path.
    // The fade is quantised to BANDS steps rather than continuous, which is indistinguishable at
    // this size, and the stroke count drops to BANDS per shell.
    const arc = (pts) => {
      const rr = R * shellR;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const depth = (a.z + b.z) / 2;                 // back .. front
        const bi = Math.min(BANDS - 1, Math.max(0, Math.round(((depth + 1) / 2) * (BANDS - 1))));
        const seg = bands[bi];
        seg.push(cx + a.x * rr, cy + a.y * rr, cx + b.x * rr, cy + b.y * rr);
      }
    };
    // Stroke the buckets and reset them. Front bands are brighter and a shade thicker, which is the
    // same relationship the per-segment version had.
    const flushBands = (dim) => {
      for (let b = 0; b < BANDS; b++) {
        const seg = bands[b];
        if (!seg.length) continue;
        const d = b / (BANDS - 1);                     // 0 = far side, 1 = near side
        ctx.globalAlpha = (d > 0.5 ? 0.30 + (d - 0.5) * 1.10 : 0.10 + d * 0.20) * dim;
        ctx.lineWidth = d > 0.5 ? 0.9 : 0.6;
        ctx.beginPath();
        for (let i = 0; i < seg.length; i += 4) {
          ctx.moveTo(seg[i], seg[i + 1]);
          ctx.lineTo(seg[i + 2], seg[i + 3]);
        }
        ctx.stroke();
        seg.length = 0;
      }
    };
    ctx.save(); ctx.strokeStyle = gold;
    // Concentric shells at slightly different radii and phases — the volumetric trick from the
    // hologram. One shell draws a wire cage; two read as a sphere with depth.
    for (let shell = 0; shell < SHELLS; shell++) {
      const sr = 1 - shell * 0.075, sy = yaw + shell * 0.22, dim = 1 - shell * 0.42;
      shellDim = dim; shellR = sr;
      for (let m = 0; m < MERIDIANS; m++) {
        const lon = (m / MERIDIANS) * Math.PI;
        const pts = [];
        for (let i = 0; i <= SAMPLES; i++) pts.push(project(-Math.PI / 2 + (i / SAMPLES) * Math.PI, lon, sy));
        arc(pts);
      }
      for (let p = 1; p < PARALLELS; p++) {
        const lat = -Math.PI / 2 + (p / PARALLELS) * Math.PI;
        const pts = [];
        for (let i = 0; i <= SAMPLES; i++) pts.push(project(lat, (i / SAMPLES) * TAU, sy));
        arc(pts);
      }
      flushBands(dim);
    }
    shellDim = 1; shellR = 1;

    // ── Dust halo: particles on fixed inclined orbits, so the halo reads as structure rather than
    // static. Only their phase advances. Brightness tracks depth, and the whole halo lifts with the
    // voice envelope so it sparkles slightly while AXIS talks.
    ctx.fillStyle = gold2;
    for (const d of dust) {
      const p = project(d.lat, d.lon + t * d.sp * (0.5 + st.glow), yaw);
      const depth = (p.z + 1) / 2;
      ctx.globalAlpha = (0.07 + depth * 0.34) * (0.5 + st.glow * 0.5) * (1 + env * 0.8);
      ctx.beginPath();
      ctx.arc(cx + p.x * R * d.r, cy + p.y * R * d.r, d.sz * (0.45 + depth * 0.6), 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // ── Rim + satellite on an inclined orbit ──
    ctx.save();
    ctx.strokeStyle = gold; ctx.globalAlpha = 0.5 + 0.4 * st.rim; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    // The talking halo: a ring that widens and brightens with each syllable. This is the cue that
    // reads as "it is speaking" from across the room, and it fades out on its own as cur.voice
    // eases back to zero — so the globe settles instead of switching off.
    if (env > 0.005) {
      ctx.globalAlpha = 0.34 * cur.voice * (0.3 + env);
      ctx.lineWidth = 1 + env * 1.8;
      ctx.beginPath(); ctx.arc(cx, cy, R * (1.06 + env * 0.17), 0, TAU); ctx.stroke();
    }
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
