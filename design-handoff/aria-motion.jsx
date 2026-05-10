// ARIA — animated motion components for the cinematic demo
// Builds on aria-shared.jsx primitives with live animation behaviour

const { useMemo: useMemoAD, useState: useStateAD } = React;

// ---------- Animated globe (rotating, pulsing, with gold particles) ----------
window.AnimatedGlobe = function AnimatedGlobe({ size = 230, letter = "A", energy = 1, t = 0 }) {
  // Generate two concentric rings of dots that drift independently
  const dotsOuter = useMemoAD(() => Array.from({ length: 64 }).map((_, i) => {
    const a = (i / 64) * Math.PI * 2;
    const wob = (i % 5) * 0.15;
    return { a, wob, r: 38 + (i % 5), op: 0.25 + (i % 3) * 0.1 };
  }), []);
  const dotsInner = useMemoAD(() => Array.from({ length: 28 }).map((_, i) => {
    const a = (i / 28) * Math.PI * 2 + 0.4;
    return { a, r: 26 + (i % 3) * 2, op: 0.25 + (i % 4) * 0.07 };
  }), []);
  const activityPoints = useMemoAD(() => [
    { x: 0.30, y: 0.42, ph: 0.0 }, { x: 0.70, y: 0.55, ph: 0.4 },
    { x: 0.55, y: 0.30, ph: 0.8 }, { x: 0.42, y: 0.66, ph: 1.2 },
    { x: 0.78, y: 0.38, ph: 1.6 }, { x: 0.22, y: 0.58, ph: 2.0 },
  ], []);

  const rotation = (t * 12) % 360;
  const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);

  return (
    <div className="aria-globe-wrap" style={{ width: size, height: size }}>
      {/* outer dashed ring — rotates slowly */}
      <div className="aria-globe-ring dashed" style={{
        inset: -28,
        transform: `rotate(${rotation * 0.4}deg)`,
        opacity: 0.4 + 0.2 * pulse * energy,
      }}/>
      <div className="aria-globe-ring" style={{
        inset: -10,
        boxShadow: `0 0 ${20 + 30 * energy}px rgba(232,201,136,${0.15 + 0.25 * pulse * energy})`,
      }}/>

      {/* gold orbiting particle */}
      {[0, 1, 2].map(i => {
        const a = (t * 0.8 + i * 2.1) % (Math.PI * 2);
        const r = size * 0.55;
        return (
          <div key={i} style={{
            position: "absolute",
            width: 5, height: 5, borderRadius: "50%",
            left: "50%", top: "50%",
            transform: `translate(${Math.cos(a) * r - 2.5}px, ${Math.sin(a) * r * 0.55 - 2.5}px)`,
            background: "var(--aria-gold-bright)",
            boxShadow: "0 0 12px var(--aria-gold-bright)",
            opacity: 0.6 + 0.4 * Math.sin(a * 2),
          }}/>
        );
      })}

      <div className="aria-globe" style={{
        width: size, height: size,
        boxShadow: `inset 0 0 60px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(201,165,103,0.30), 0 0 ${40 + 50 * energy}px rgba(201,165,103,${0.18 + 0.25 * energy * pulse})`,
      }}>
        <svg viewBox="0 0 100 100" style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          transform: `rotate(${rotation * 0.1}deg)`,
        }} preserveAspectRatio="none">
          {/* longitudes that breathe */}
          {[15, 30, 45, 50].map((rx, i) => (
            <ellipse key={"lng"+i} cx="50" cy="50" rx={rx} ry="48"
              stroke={`rgba(201,165,103,${0.12 + 0.06 * pulse})`} strokeWidth="0.3" fill="none" />
          ))}
          {[8, 18, 30, 40].map((ry, i) => (
            <ellipse key={"lat"+i} cx="50" cy="50" rx="48" ry={ry}
              stroke="rgba(201,165,103,0.16)" strokeWidth="0.3" fill="none" />
          ))}
          <ellipse cx="50" cy="50" rx="48" ry="14" stroke={`rgba(232,201,136,${0.30 + 0.2 * pulse * energy})`} strokeWidth="0.4" fill="none"/>

          {/* outer rotating dot ring */}
          <g transform={`rotate(${rotation} 50 50)`}>
            {dotsOuter.map((d, i) => (
              <circle key={"o"+i} cx={50 + Math.cos(d.a) * d.r} cy={50 + Math.sin(d.a) * d.r * 0.7} r="0.5"
                fill={`rgba(201,165,103,${d.op})`}/>
            ))}
          </g>
          {/* inner counter-rotating dot ring */}
          <g transform={`rotate(${-rotation * 1.4} 50 50)`}>
            {dotsInner.map((d, i) => (
              <circle key={"i"+i} cx={50 + Math.cos(d.a) * d.r} cy={50 + Math.sin(d.a) * d.r * 0.7} r="0.4"
                fill={`rgba(232,201,136,${d.op})`}/>
            ))}
          </g>

          {/* activity spikes */}
          {activityPoints.map((p, i) => {
            const phase = (t * 1.2 + p.ph) % 2;
            const grow = phase < 1 ? phase : 0;
            return (
              <g key={"ap"+i}>
                <circle cx={p.x*100} cy={p.y*100} r="1" fill="#E8C988"/>
                <circle cx={p.x*100} cy={p.y*100} r={1 + grow * 4} fill="none" stroke="#E8C988" strokeWidth="0.25" opacity={1 - grow}/>
              </g>
            );
          })}

          {/* energy arc traveling across the globe */}
          <g opacity={0.6 * energy}>
            <path
              d={`M ${10 + (t * 18) % 80} 50 Q 50 ${30 + 10 * Math.sin(t * 2)} ${90 - (t * 18) % 80} 50`}
              stroke="url(#energyGrad)" strokeWidth="0.8" fill="none"
            />
            <defs>
              <linearGradient id="energyGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(232,201,136,0)"/>
                <stop offset="50%" stopColor="rgba(232,201,136,0.9)"/>
                <stop offset="100%" stopColor="rgba(232,201,136,0)"/>
              </linearGradient>
            </defs>
          </g>
        </svg>

        {letter && (
          <div className="aria-globe-letter" style={{
            fontSize: size * 0.45,
            opacity: 0.4 + 0.25 * pulse,
            textShadow: `0 0 ${20 + 20 * pulse * energy}px rgba(232,201,136,${0.4 + 0.3 * energy})`,
          }}>
            {letter}
          </div>
        )}
      </div>

      {/* sun marker */}
      <div className="aria-sun" style={{
        top: -4 + 2 * Math.sin(t * 0.5),
        right: 18,
        boxShadow: `0 0 ${18 + 12 * pulse}px rgba(232,201,136,${0.6 + 0.3 * pulse})`,
      }}/>
    </div>
  );
};

// ---------- Live ticking number ----------
window.LiveNum = function LiveNum({ base, jitter = 1, t = 0, suffix = "", phase = 0 }) {
  // base is something like 202.2, displays as "202.2M"
  const v = base + Math.sin(t * 0.7 + phase) * jitter * 0.4 + (Math.floor(t * 2 + phase) % 5) * jitter * 0.1;
  return <span>{v.toFixed(1)}{suffix}</span>;
};

window.LiveCounter = function LiveCounter({ start, perSec, t = 0, suffix = "", commas = true }) {
  const v = Math.floor(start + perSec * t);
  const s = commas ? v.toLocaleString("en-US") : String(v);
  return <span>{s}{suffix}</span>;
};

// ---------- Animated waveform (live, energy-reactive) ----------
window.LiveWave = function LiveWave({ t = 0, bars = 28, energy = 1, height = 60 }) {
  const arr = useMemoAD(() => Array.from({ length: bars }).map((_, i) => i), [bars]);
  return (
    <div className="wave" style={{ height }}>
      {arr.map(i => {
        const phase = i * 0.3;
        const h = 0.3 + 0.7 * Math.abs(Math.sin(t * 4 + phase) * Math.cos(t * 1.5 + phase * 0.4));
        return <span key={i} style={{ height: 8 + h * (height - 8) * energy }}/>;
      })}
    </div>
  );
};

// ---------- Animated panel (uses live ticking nums) ----------
window.AriaPanelLive = function AriaPanelLive({ t = 0, globeLetter = "A", energy = 1, micState = "idle", micPulse = false, typedQuery = null, typeCursor = false }) {
  const top = [
    { icon: "globe", base: 202.2, jitter: 0.4, suffix: "M", label: "ONLINE GLOBALLY" },
    { icon: "sparkle", base: 28.3, jitter: 0.2, suffix: "M", label: "USING AI TOOLS" },
    { icon: "search", base: 70.0, jitter: 1.5, suffix: "K/s", label: "ENTERPRISE QUERIES" },
    { icon: "cam", base: 364.5, jitter: 0.6, suffix: "M", label: "STREAMING VIDEO" },
  ];
  const left = [
    { icon: "chat", base: 11.8, jitter: 0.1, suffix: "M", label: "ON CHAT AI" },
    { icon: "cube", base: 505.3, jitter: 2, suffix: "K", label: "ON DEV PLATFORMS" },
    { icon: "cart", base: 80.6, jitter: 0.2, suffix: "M", label: "SHOPPING ONLINE" },
    { icon: "chart", base: 17.6, jitter: 0.1, suffix: "M", label: "TRADING MARKETS" },
  ];
  const right = [
    { icon: "play", base: 134.9, jitter: 0.3, suffix: "M", label: "GAMING NOW" },
    { icon: "music", base: 137.2, jitter: 0.3, suffix: "M", label: "ON SHORT VIDEO" },
    { icon: "cam", base: 150.2, jitter: 0.4, suffix: "M", label: "ON SOCIAL FEEDS" },
    { icon: "bolt", base: 40.1, jitter: 0.15, suffix: "M", label: "TRADING CRYPTO" },
  ];
  const ts = new Date(0); ts.setSeconds(Math.floor(t * 10) % 60); ts.setMinutes(42); ts.setHours(14);
  const time = `14:42:${String(Math.floor(t * 10) % 60).padStart(2, "0")}`;

  return (
    <div style={{
      width: "100%", height: "100%", position: "relative",
      borderLeft: "1px solid var(--aria-line-soft)",
      background: "linear-gradient(180deg, rgba(20,16,11,0.6), rgba(11,9,7,0.8))",
      display: "flex", flexDirection: "column",
    }}>
      <AriaPanelHeader time={time}/>
      <div style={{ padding: "0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="pulse-dot" style={{ opacity: 0.6 + 0.4 * Math.sin(t * 4) }}/>
            <span className="section-label">LIVE ACTIVITY</span>
          </div>
          <div className="aria-mono" style={{ fontSize: 9, color: "var(--aria-cream-faint)", letterSpacing: "0.12em" }}>
            Worldwide · Updated every sec
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {top.map((s, i) => (
            <div key={i} className="stat-card">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="icon"><AriaIcon name={s.icon} size={10}/></span>
                <span className="num"><LiveNum base={s.base} jitter={s.jitter} suffix={s.suffix} t={t} phase={i}/></span>
              </div>
              <div className="lbl">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, padding: "20px 14px 0", display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {left.map((s, i) => (
            <div key={i} className="stat-card">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="icon"><AriaIcon name={s.icon} size={10}/></span>
                <span className="num"><LiveNum base={s.base} jitter={s.jitter} suffix={s.suffix} t={t} phase={i + 4}/></span>
              </div>
              <div className="lbl">{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ position: "relative", padding: "20px 0" }}>
          <AnimatedGlobe size={210} letter={globeLetter} energy={energy} t={t}/>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {right.map((s, i) => (
            <div key={i} className="stat-card">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="icon"><AriaIcon name={s.icon} size={10}/></span>
                <span className="num"><LiveNum base={s.base} jitter={s.jitter} suffix={s.suffix} t={t} phase={i + 8}/></span>
              </div>
              <div className="lbl">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: "10px 20px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div className="aria-serif" style={{ fontSize: 22, letterSpacing: "0.02em" }}>
          {micState === "listening" ? "Listening…" : micState === "speaking" ? "ARIA is speaking" : "Tap to speak"}
        </div>
        <div className="aria-mic" style={{
          transform: micPulse ? `scale(${1 + 0.05 * Math.sin(t * 6)})` : "scale(1)",
          boxShadow: `0 0 0 ${6 + 4 * Math.sin(t * 3)}px rgba(201,165,103,0.10), 0 0 0 ${14 + 6 * Math.sin(t * 3)}px rgba(201,165,103,0.05), 0 0 ${38 + 18 * energy}px rgba(232,201,136,0.45), inset 0 1px 0 rgba(255,255,255,0.5)`,
        }}>
          <AriaIcon name="mic" size={22}/>
        </div>
        <div className="aria-chat-input" style={{
          width: "100%", marginTop: 6,
          borderColor: typedQuery ? "var(--aria-gold)" : "var(--aria-line)",
          boxShadow: typedQuery ? "0 0 18px rgba(232,201,136,0.20)" : "none",
        }}>
          <span style={{ flex: 1, color: typedQuery ? "var(--aria-cream)" : "var(--aria-cream-dim)" }}>
            {typedQuery !== null ? typedQuery : "Ask ARIA anything…"}
            {typeCursor ? <span style={{ color: "var(--aria-gold-bright)", marginLeft: 1 }}>▍</span> : null}
          </span>
          <div className="aria-chat-send"><AriaIcon name="arrow" size={12}/></div>
        </div>
      </div>
    </div>
  );
};

// ---------- Typewriter ----------
window.Typewriter = function Typewriter({ text, t, start = 0, charsPerSec = 24, cursor = true, style }) {
  const elapsed = Math.max(0, t - start);
  const n = Math.min(text.length, Math.floor(elapsed * charsPerSec));
  const showCursor = cursor && n < text.length || (cursor && Math.floor(t * 2) % 2 === 0);
  return <span style={style}>{text.slice(0, n)}{showCursor ? <span style={{ opacity: 0.7 }}>▍</span> : null}</span>;
};
