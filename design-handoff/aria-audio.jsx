// ARIA — synthesized audio engine (no external assets)
// Uses Web Audio API for ambient pad + Speech Synthesis for ARIA voice
// Triggered by a one-time user-gesture overlay (browser autoplay policy)

window.AriaAudio = (function () {
  let ctx = null;
  let masterGain = null;
  let padNodes = [];
  let started = false;
  let muted = false;
  let lastT = -1;
  const sched = new Map(); // key -> last fired time, to dedupe
  let voice = null;

  // Pick the most pleasant female voice available
  function pickVoice() {
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    // Prefer female / premium English voices
    const prefs = [
      /samantha/i, /serena/i, /victoria/i, /allison/i, /ava/i, /susan/i,
      /female/i, /en-?gb/i, /en-?us/i,
    ];
    for (const re of prefs) {
      const v = voices.find(v => re.test(v.name) || re.test(v.lang));
      if (v) return v;
    }
    return voices.find(v => /^en/i.test(v.lang)) || voices[0];
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); };
    voice = pickVoice();
  }

  function start() {
    if (started) return;
    started = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : 0.35;
      masterGain.connect(ctx.destination);

      // Ambient gold pad: detuned sines + low-pass filter + slow LFO
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1100;
      filter.Q.value = 0.7;
      filter.connect(masterGain);

      // Slow LFO for filter sweep
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      // Chord: low A, E, A, C# (warm minor-major)
      const freqs = [55, 82.5, 110, 138.6, 165];
      freqs.forEach((f, i) => {
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        o1.type = "sine"; o2.type = "sine";
        o1.frequency.value = f;
        o2.frequency.value = f * 1.003; // detune for shimmer
        const g = ctx.createGain();
        g.gain.value = 0.0;
        o1.connect(g); o2.connect(g);
        g.connect(filter);
        o1.start(); o2.start();
        // fade in
        g.gain.linearRampToValueAtTime(0.05 + (i === 0 ? 0.05 : 0), ctx.currentTime + 4);
        padNodes.push({ o1, o2, g });
      });

      // Subtle high shimmer (optional, very low)
      const sh = ctx.createOscillator();
      sh.type = "triangle";
      sh.frequency.value = 880;
      const shg = ctx.createGain();
      shg.gain.value = 0;
      sh.connect(shg);
      shg.connect(filter);
      sh.start();
      shg.gain.linearRampToValueAtTime(0.008, ctx.currentTime + 8);
    } catch (e) {
      console.warn("AriaAudio init failed", e);
    }
  }

  function setMuted(m) {
    muted = m;
    if (masterGain) masterGain.gain.linearRampToValueAtTime(m ? 0 : 0.35, (ctx?.currentTime || 0) + 0.2);
  }
  function isMuted() { return muted; }
  function isStarted() { return started; }

  // Short UI tone — typing tick / soft chime
  function blip(freq = 1200, durMs = 50, vol = 0.04, type = "sine") {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(g); g.connect(masterGain);
    const t0 = ctx.currentTime;
    g.gain.linearRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
    o.start(t0);
    o.stop(t0 + durMs / 1000 + 0.05);
  }

  // Triadic chime (success)
  function chime() {
    if (!ctx || muted) return;
    [880, 1320, 1760].forEach((f, i) => {
      setTimeout(() => blip(f, 380, 0.07, "sine"), i * 120);
    });
  }

  // Soft whoosh (scene transition)
  function whoosh() {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = 80;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 700; f.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(f); f.connect(g); g.connect(masterGain);
    const t0 = ctx.currentTime;
    g.gain.linearRampToValueAtTime(0.06, t0 + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
    f.frequency.linearRampToValueAtTime(2200, t0 + 0.7);
    o.start(t0);
    o.stop(t0 + 0.8);
  }

  // ARIA speaks
  function speak(text, opts = {}) {
    if (!("speechSynthesis" in window) || muted || !started) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (!voice) voice = pickVoice();
      if (voice) u.voice = voice;
      u.rate = opts.rate ?? 0.95;
      u.pitch = opts.pitch ?? 1.05;
      u.volume = opts.volume ?? 0.9;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  function cancelSpeech() {
    if ("speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
  }

  // Cue table — fired once each as the timeline crosses a marker
  // Edit this list to align with scene script changes
  const cues = [
    { t: 0.5,  fn: () => whoosh() },
    // Search scene
    { t: 11.5, fn: () => whoosh() },
    { t: 17,   fn: () => chime() },
    { t: 22,   fn: () => AriaAudio.speak("I found four new luxury chronograph references from this season's collections.", { rate: 0.97 }) },
    // Choice scene
    { t: 30,   fn: () => whoosh() },
    { t: 31,   fn: () => AriaAudio.speak("I can guide you step by step, or resolve the issue for you remotely.", { rate: 0.97 }) },
    // Resolve scene
    { t: 47,   fn: () => whoosh() },
    { t: 48.5, fn: () => AriaAudio.speak("I'll handle this. Restoring your mail now.", { rate: 1.0 }) },
    { t: 65,   fn: () => chime() },
    { t: 65.4, fn: () => AriaAudio.speak("Mail has been restored successfully.", { rate: 0.98 }) },
    // Voice scene
    { t: 76,   fn: () => whoosh() },
    { t: 77,   fn: () => AriaAudio.speak("Of course Sarah. Let's solve this together.", { rate: 0.95 }) },
    { t: 86,   fn: () => AriaAudio.speak("I see it. Your print spooler has stalled. I'll restart it now.", { rate: 0.97 }) },
    // Ops scene
    { t: 100,  fn: () => whoosh() },
    // Outro
    { t: 130,  fn: () => whoosh() },
    { t: 132,  fn: () => AriaAudio.speak("ARIA. The future of enterprise intelligence.", { rate: 0.92, pitch: 1.0 }) },
  ];

  // Click ticks for typing — fired by the scenes via tick()
  function tick() {
    if (!ctx || muted) return;
    blip(2200 + Math.random() * 400, 18, 0.012, "square");
  }

  // Called every frame from the timeline
  function update(t) {
    if (!started) return;
    // Detect rewind / loop
    if (t < lastT - 1) sched.clear();
    lastT = t;
    cues.forEach((c, i) => {
      if (t >= c.t && !sched.has(i)) {
        sched.set(i, t);
        try { c.fn(); } catch (e) {}
      }
    });
  }

  return {
    start, setMuted, isMuted, isStarted, update,
    speak, cancelSpeech, blip, chime, whoosh, tick,
  };
})();

// Audio enable overlay component
window.AudioEnableOverlay = function AudioEnableOverlay() {
  const [armed, setArmed] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  React.useEffect(() => {
    if (!armed) return;
    AriaAudio.start();
    AriaAudio.setMuted(muted);
  }, [armed, muted]);

  if (!armed) {
    return (
      <div onClick={() => setArmed(true)} style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(5,4,2,0.85)",
        backdropFilter: "blur(6px)",
        display: "grid", placeItems: "center",
        cursor: "pointer",
      }}>
        <div style={{ textAlign: "center", color: "#EDE6D6" }}>
          <div className="aria-serif" style={{ fontSize: 56, letterSpacing: "0.08em" }}>ARIA</div>
          <div style={{ marginTop: 10, fontSize: 12, letterSpacing: "0.30em", fontFamily: "JetBrains Mono", color: "var(--aria-gold-bright)" }}>
            CINEMATIC DEMO · WITH SOUND
          </div>
          <div style={{
            marginTop: 30, padding: "14px 28px",
            border: "1px solid var(--aria-gold)",
            borderRadius: 999,
            background: "linear-gradient(180deg, rgba(201,165,103,0.18), rgba(201,165,103,0.04))",
            display: "inline-flex", alignItems: "center", gap: 10,
            fontFamily: "JetBrains Mono", fontSize: 12, letterSpacing: "0.20em",
            color: "var(--aria-gold-bright)",
            boxShadow: "0 0 30px rgba(232,201,136,0.30)",
          }}>
            ▶ TAP TO BEGIN
          </div>
          <div style={{ marginTop: 22, fontSize: 11, color: "rgba(237,230,214,0.45)", fontFamily: "JetBrains Mono", letterSpacing: "0.16em" }}>
            HEADPHONES RECOMMENDED · 02:45
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => { const m = !muted; setMuted(m); AriaAudio.setMuted(m); if (m) AriaAudio.cancelSpeech(); }}
      style={{
        position: "fixed", top: 14, right: 14, zIndex: 40,
        width: 38, height: 38, borderRadius: "50%",
        background: "rgba(11,9,7,0.65)",
        border: "1px solid var(--aria-line-strong)",
        color: "var(--aria-gold-bright)",
        display: "grid", placeItems: "center",
        cursor: "pointer",
        backdropFilter: "blur(8px)",
      }}
      title={muted ? "Unmute" : "Mute"}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6 L3 10 L6 10 L9 13 L9 3 L6 6 Z"/>
        {!muted && <path d="M11 5 C12.5 6.5 12.5 9.5 11 11"/>}
        {!muted && <path d="M13 3 C15.5 5.5 15.5 10.5 13 13"/>}
        {muted && <path d="M11 5 L15 11 M15 5 L11 11"/>}
      </svg>
    </button>
  );
};

// Time-driven cue runner — must be inside Stage so it sees useTime()
window.AudioConductor = function AudioConductor() {
  const t = useTime();
  React.useEffect(() => { AriaAudio.update(t); }, [t]);
  return null;
};
