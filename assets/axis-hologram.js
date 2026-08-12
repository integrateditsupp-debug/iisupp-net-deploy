// axis-hologram.js — AXIS as a full-screen holographic presence.
//
// Ahmad, 2026-08-11: "the look of Axis is still simple and basic not a globe or jarvis look… ensure
// the hologram feature is available."
//
// The small orbit globe is the resting state. This is the other half: press the expand control (or
// Ctrl+Alt+A) and AXIS fills the screen — a volumetric sphere inside a live HUD that reacts to
// whether it is idle, hearing you, thinking, or speaking.
//
// The organising principle is borrowed from jaredrhod.com/prompts (the Voice Visualizer): ONE
// continuously-eased energy value drives the entire scene. Every state change rides that curve, so
// nothing snaps — glow, spin, ring spread, particle speed and waveform amplitude all move together.
// That single easing is what separates "a canvas with effects on it" from something that feels alive.
//
// PURELY VISUAL AND ADDITIVE. It reads :root[data-axis-state] — the same machine the orb and the
// globe already use — and writes nothing. Closing it leaves the console exactly as it was.

const TAU = Math.PI * 2;
const MERIDIANS = 18, PARALLELS = 11, SAMPLES = 64;
const PARTICLES = 130, BARS = 96;
const TILT = 0.38;

// Target energy per state. The scene eases toward these; it never jumps.
const ENERGY = { idle: 0.26, listening: 0.86, thinking: 0.62, speaking: 1.0 };

const readVar = (n, f) => {
  try { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f; } catch { return f; }
};

// Deterministic pseudo-noise. Math.random() per frame makes the waveform hiss; this makes it breathe.
const noise = (x) => {
  const s = Math.sin(x * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

function project(lat, lon, yaw) {
  const cl = Math.cos(lat);
  const x0 = cl * Math.cos(lon + yaw), y0 = Math.sin(lat), z0 = cl * Math.sin(lon + yaw);
  const ct = Math.cos(TILT), st = Math.sin(TILT);
  return { x: x0, y: y0 * ct - z0 * st, z: y0 * st + z0 * ct };
}

let live = null;

export function openHologram() {
  if (live) return live;

  const root = document.createElement('div');
  root.className = 'axis-holo';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'AXIS presence');
  root.innerHTML = `
    <canvas class="axis-holo-c" aria-hidden="true"></canvas>
    <div class="axis-holo-scan" aria-hidden="true"></div>
    <div class="axis-holo-ui">
      <div class="axis-holo-name">A X I S</div>
      <div class="axis-holo-state" id="axisHoloState" aria-live="polite">idle</div>
      <div class="axis-holo-hear" id="axisHoloHear"></div>
    </div>
    <button class="axis-holo-close" id="axisHoloClose" aria-label="Close AXIS presence">esc</button>`;
  document.body.append(root);

  const canvas = root.querySelector('.axis-holo-c');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  const reduced = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();

  // Particles ride fixed inclined orbits; only their phase advances, so the halo reads as structure
  // rather than static.
  const dust = Array.from({ length: PARTICLES }, (_, i) => ({
    lat: Math.asin(2 * noise(i * 1.7) - 1),
    lon: noise(i * 3.1) * TAU,
    r: 1.06 + noise(i * 5.3) * 0.5,
    sp: 0.10 + noise(i * 7.9) * 0.5,
    sz: 0.6 + noise(i * 11.3) * 1.5,
  }));

  let energy = ENERGY.idle, yaw = 0.4, spin = 0, t = 0, raf = 0, running = true;

  function frame() {
    if (!running) return;
    const state = document.documentElement.dataset.axisState || 'idle';
    const target = ENERGY[state] ?? ENERGY.idle;
    energy += (target - energy) * 0.055;          // THE single eased value
    if (!reduced) { t += 0.016; yaw += 0.0016 + energy * 0.010; spin += 0.004 + energy * 0.020; }

    const gold = readVar('--gold', '#d2a94e');
    const gold2 = readVar('--gold-2', '#e8c87a');
    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * (0.20 + energy * 0.022);

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';      // additive — overlaps bloom instead of muddying

    // ── core bloom ──
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5);
    g.addColorStop(0, gold2); g.addColorStop(0.28, gold); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.10 + energy * 0.22;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.5, 0, TAU); ctx.fillStyle = g; ctx.fill();

    // ── volumetric sphere: three shells at slightly different radii and phases ──
    ctx.strokeStyle = gold;
    for (let shell = 0; shell < 3; shell++) {
      const sr = R * (1 - shell * 0.055), sy = yaw + shell * 0.20, dim = 1 - shell * 0.3;
      const arc = (pts) => {
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i], d = (a.z + b.z) / 2;
          ctx.globalAlpha = (d > 0 ? 0.10 + d * 0.42 : 0.04 + (1 + d) * 0.06) * dim * (0.55 + energy * 0.65);
          ctx.lineWidth = d > 0 ? 0.85 : 0.5;
          ctx.beginPath();
          ctx.moveTo(cx + a.x * sr, cy + a.y * sr);
          ctx.lineTo(cx + b.x * sr, cy + b.y * sr);
          ctx.stroke();
        }
      };
      for (let m = 0; m < MERIDIANS; m++) {
        const lon = (m / MERIDIANS) * Math.PI, pts = [];
        for (let i = 0; i <= SAMPLES; i++) pts.push(project(-Math.PI / 2 + (i / SAMPLES) * Math.PI, lon, sy));
        arc(pts);
      }
      for (let p = 1; p < PARALLELS; p++) {
        const lat = -Math.PI / 2 + (p / PARALLELS) * Math.PI, pts = [];
        for (let i = 0; i <= SAMPLES; i++) pts.push(project(lat, (i / SAMPLES) * TAU, sy));
        arc(pts);
      }
    }

    // ── dust halo ──
    ctx.fillStyle = gold2;
    for (const d of dust) {
      const p = project(d.lat, d.lon + t * d.sp * (0.4 + energy), yaw);
      const depth = (p.z + 1) / 2;
      ctx.globalAlpha = (0.10 + depth * 0.55) * (0.35 + energy * 0.75);
      ctx.beginPath();
      ctx.arc(cx + p.x * R * d.r, cy + p.y * R * d.r, d.sz * (0.6 + depth * 0.8), 0, TAU);
      ctx.fill();
    }

    // ── circular waveform: the voice made visible ──
    const amp = state === 'speaking' ? 1 : state === 'listening' ? 0.75 : 0.22;
    ctx.strokeStyle = gold2; ctx.lineWidth = 1.8;
    for (let i = 0; i < BARS; i++) {
      const a = (i / BARS) * TAU - Math.PI / 2;
      const n = noise(i * 0.37 + Math.floor(t * 14) * 0.11);
      const len = (6 + n * 46 * amp * energy) * (0.5 + energy * 0.6);
      const r0 = R * 1.30;
      ctx.globalAlpha = 0.14 + n * 0.5 * amp;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
      ctx.stroke();
    }

    // ── HUD: counter-rotating arcs + tick ring ──
    ctx.strokeStyle = gold;
    const arcs = [[1.56, 0.9, spin, 2.1], [1.68, 0.55, -spin * 0.65, 1.3], [1.80, 0.35, spin * 0.4, 3.0]];
    for (const [rr, al, ang, span] of arcs) {
      ctx.globalAlpha = al * (0.30 + energy * 0.55); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(cx, cy, R * rr, ang, ang + span); ctx.stroke();
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU, long = i % 6 === 0;
      const r1 = R * 1.90, r2 = R * (long ? 2.02 : 1.95);
      ctx.globalAlpha = (long ? 0.42 : 0.18) * (0.4 + energy * 0.6);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // Mirror the state word and the live transcript line, so the full-screen view is not a dead end.
  const sync = setInterval(() => {
    const s = document.documentElement.dataset.axisState || 'idle';
    const w = root.querySelector('#axisHoloState'); if (w) w.textContent = s;
    const src = document.getElementById('axisHear');
    const dst = root.querySelector('#axisHoloHear');
    if (src && dst) dst.textContent = src.classList.contains('live') ? src.textContent : '';
  }, 220);

  function close() {
    if (!live) return;
    running = false; cancelAnimationFrame(raf); clearInterval(sync);
    window.removeEventListener('resize', resize);
    document.removeEventListener('keydown', onKey, true);
    root.remove(); live = null;
    delete document.documentElement.dataset.axisHolo;
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  }
  document.addEventListener('keydown', onKey, true);
  root.querySelector('#axisHoloClose').addEventListener('click', close);
  document.documentElement.dataset.axisHolo = '1';

  live = { close };
  return live;
}

export function toggleHologram() { return live ? (live.close(), null) : openHologram(); }
export function hologramOpen() { return !!live; }
