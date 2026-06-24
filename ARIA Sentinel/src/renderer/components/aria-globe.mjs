// RUN 19 §2 — the live ARIA globe as a self-contained custom element.
// Renders the iisupp.net/aria globe (starfield + rotating gold sphere + orbiting sun + centre "A")
// on a single <canvas>. No external deps, no leaks: the rAF loop is started in connectedCallback and
// cancelled in disconnectedCallback so the canvas cleans up when the window/component closes.
//
// Usage:  <aria-globe size="56"></aria-globe>   (size in CSS px; defaults to 64)
//         set state="dim" to render the killed/dimmed grey state (used by the kill-switch).
//
// The animation is driven from a single rAF loop that keeps a monotonic phase, so the globe keeps
// rotating + the sun keeps orbiting even when the window is unfocused (the main window is created with
// backgroundThrottling:false so rAF is not paused while unfocused).

const GOLD = "#c5a059";
const GOLD_LIGHT = "#f1dca7";
const GOLD_DARK = "#5a3f10";

class AriaGlobe extends HTMLElement {
  static get observedAttributes() {
    return ["size", "state"];
  }

  constructor() {
    super();
    this._raf = 0;
    this._phase = 0;
    this._last = 0;
    this._stars = [];
    this._canvas = null;
    this._ctx = null;
    this._ro = null;
  }

  connectedCallback() {
    const size = this._size();
    this.style.display = "inline-block";
    this.style.width = `${size}px`;
    this.style.height = `${size}px`;
    this.style.lineHeight = "0";

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    this.appendChild(canvas);
    this._canvas = canvas;
    this._ctx = canvas.getContext("2d");
    this._resize();
    this._seedStars();
    this._start();
  }

  disconnectedCallback() {
    this._stop();
    if (this._canvas && this._canvas.parentNode === this) this.removeChild(this._canvas);
    this._canvas = null;
    this._ctx = null;
  }

  attributeChangedCallback(name) {
    if (!this._canvas) return;
    if (name === "size") {
      const size = this._size();
      this.style.width = `${size}px`;
      this.style.height = `${size}px`;
      this._resize();
      this._seedStars();
    }
    // state changes are picked up by the next frame (no work needed here).
  }

  _size() {
    const n = Number(this.getAttribute("size"));
    return Number.isFinite(n) && n > 0 ? n : 64;
  }

  _dpr() {
    return Math.min(3, Math.max(1, (typeof window !== "undefined" && window.devicePixelRatio) || 1));
  }

  _resize() {
    const size = this._size();
    const dpr = this._dpr();
    this._canvas.width = Math.round(size * dpr);
    this._canvas.height = Math.round(size * dpr);
  }

  // Deterministic starfield (no Math.random spread across frames) so stars don't twinkle-jump.
  _seedStars() {
    const size = this._size();
    const dpr = this._dpr();
    const count = Math.max(10, Math.round(size / 4));
    const stars = [];
    let seed = 1337 + Math.round(size);
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < count; i++) {
      stars.push({ x: rnd() * size * dpr, y: rnd() * size * dpr, r: (0.4 + rnd() * 0.9) * dpr, tw: rnd() * Math.PI * 2 });
    }
    this._stars = stars;
  }

  _start() {
    if (this._raf) return;
    const loop = (t) => {
      if (!this._ctx) return;
      const dt = this._last ? Math.min(0.1, (t - this._last) / 1000) : 0.016;
      this._last = t;
      this._phase += dt;
      this._draw();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  _stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    this._last = 0;
  }

  _draw() {
    const ctx = this._ctx;
    const W = this._canvas.width;
    const H = this._canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) * 0.34;
    const dim = this.getAttribute("state") === "dim";
    const phase = this._phase;

    ctx.clearRect(0, 0, W, H);

    // Starfield.
    for (const s of this._stars) {
      const a = dim ? 0.12 : 0.35 + 0.35 * Math.sin(phase * 1.5 + s.tw);
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = dim ? "#888" : GOLD_LIGHT;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Globe body — radial gradient sphere.
    const grad = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    if (dim) {
      grad.addColorStop(0, "#9a9a9a");
      grad.addColorStop(0.55, "#5a5a5a");
      grad.addColorStop(1, "#262626");
    } else {
      grad.addColorStop(0, GOLD_LIGHT);
      grad.addColorStop(0.5, GOLD);
      grad.addColorStop(1, GOLD_DARK);
    }
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Outer glow ring.
    ctx.strokeStyle = dim ? "rgba(160,160,160,.35)" : "rgba(241,220,167,.6)";
    ctx.lineWidth = Math.max(1, R * 0.04);
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.04, 0, Math.PI * 2);
    ctx.stroke();

    // Rotating meridians (longitude lines) — squashed ellipses that sweep to fake a spin.
    ctx.strokeStyle = dim ? "rgba(120,120,120,.4)" : "rgba(90,63,16,.7)";
    ctx.lineWidth = Math.max(0.6, R * 0.02);
    const spin = phase * 0.6;
    for (let i = 0; i < 4; i++) {
      const w = Math.abs(Math.cos(spin + (i * Math.PI) / 4)) * R;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w, R, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Latitude lines.
    for (let j = -2; j <= 2; j++) {
      const ry = (j / 3) * R;
      const rx = Math.sqrt(Math.max(0, R * R - ry * ry));
      ctx.beginPath();
      ctx.ellipse(cx, cy + ry, rx, R * 0.16, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Orbiting sun.
    const orbit = R * 1.5;
    const sunAng = phase * 0.9;
    const sx = cx + Math.cos(sunAng) * orbit;
    const sy = cy + Math.sin(sunAng) * orbit * 0.5;
    const sr = R * 0.22;
    const sunGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.4);
    if (dim) {
      sunGrad.addColorStop(0, "rgba(180,180,180,.5)");
      sunGrad.addColorStop(1, "rgba(120,120,120,0)");
    } else {
      sunGrad.addColorStop(0, "#fff6d8");
      sunGrad.addColorStop(0.4, GOLD_LIGHT);
      sunGrad.addColorStop(1, "rgba(197,160,89,0)");
    }
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sx, sy, sr * 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Centre "A".
    ctx.fillStyle = dim ? "rgba(20,20,20,.8)" : "#1a1410";
    ctx.font = `700 ${Math.round(R * 1.05)}px Cinzel, Georgia, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("A", cx, cy + R * 0.06);
  }
}

if (typeof customElements !== "undefined" && !customElements.get("aria-globe")) {
  customElements.define("aria-globe", AriaGlobe);
}

export { AriaGlobe };
