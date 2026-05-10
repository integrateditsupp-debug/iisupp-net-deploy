// Scene 3 (22–32s): ARIA reveal
// Black void → gold orb materializes → expands → "Meet ARIA" title card

function Scene3Reveal({ start = 22, end = 32 }) {
  return (
    <Sprite start={start} end={end}>
      <Scene3Inner sceneStart={start} />
    </Sprite>
  );
}

function Scene3Inner({ sceneStart }) {
  const time = useTime();
  const t = time - sceneStart; // 0..10

  // Orb grows: 0..2.5s tiny dot grows to large
  const orbSize = animate({ from: 0, to: 1400, start: 0, end: 5, ease: Easing.easeInOutQuart })(t);
  // Then expands as background reveal at 5..7s, intensity drops
  const orbOpacity = interpolate([0, 0.4, 4.5, 6, 7.5, 10], [0, 1, 1, 0.8, 0.5, 0.4])(t);
  const orbY = animate({ from: 540, to: 540, start: 0, end: 5, ease: Easing.linear })(t);

  // Background brightens as orb grows
  const bgOpacity = interpolate([0, 4, 5.5], [0, 0.15, 0.3])(t);

  return (
    <div style={{ position: 'absolute', inset: 0, background: ARIA_BLACK, overflow: 'hidden' }}>
      {/* Bg gradient grows in */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(circle at 50% 50%, rgba(212, 166, 90, ${bgOpacity}) 0%, transparent 60%)`,
      }} />

      <GrainOverlay opacity={0.04} />

      {/* THE ORB */}
      <GoldOrb x={960} y={orbY} size={orbSize} intensity={orbOpacity} blur={120} />

      {/* Inner core (sharp) */}
      <Sprite start={sceneStart + 1.5} end={sceneStart + 9.8}>
        <CoreOrb t={t} />
      </Sprite>

      {/* Eyebrow */}
      <Sprite start={sceneStart + 5.5} end={sceneStart + 9.8}>
        <FadeBlock fadeIn={0.5} fadeOut={0.4}>
          <Eyebrow text="Introducing" x="50%" y={350} color={ARIA_CREAM} size={20} />
        </FadeBlock>
      </Sprite>

      {/* Wordmark "ARIA" — huge serif */}
      <Sprite start={sceneStart + 5.8} end={sceneStart + 9.8}>
        <AriaWordmark />
      </Sprite>

      {/* Tagline */}
      <Sprite start={sceneStart + 7.0} end={sceneStart + 9.8}>
        <FadeBlock fadeIn={0.6} fadeOut={0.5}>
          <div style={{
            position: 'absolute',
            left: '50%', top: 760,
            transform: 'translateX(-50%)',
            fontFamily: SERIF,
            fontStyle: 'italic',
            fontSize: 38,
            color: ARIA_CREAM,
            letterSpacing: '0.02em',
            opacity: 0.85,
          }}>
            an always-on assistant that doesn't take breaks.
          </div>
        </FadeBlock>
      </Sprite>

      <Vignette />
    </div>
  );
}

function CoreOrb({ t }) {
  // pulsing sharp gold disc behind the wordmark
  const pulse = 1 + 0.04 * Math.sin(t * 2.5);
  return (
    <div style={{
      position: 'absolute',
      left: 960, top: 540,
      transform: `translate(-50%, -50%) scale(${pulse})`,
      width: 240, height: 240,
      borderRadius: '50%',
      background: 'radial-gradient(circle, #F5DCA0 0%, #D4A65A 40%, #A87E36 80%, transparent 100%)',
      boxShadow: '0 0 200px rgba(235, 200, 130, 0.6), 0 0 400px rgba(212, 166, 90, 0.3)',
    }} />
  );
}

function AriaWordmark() {
  const { localTime } = useSprite();
  // Letter-by-letter
  const letters = ['A', 'R', 'I', 'A'];
  return (
    <div style={{
      position: 'absolute',
      left: '50%', top: 540,
      transform: 'translate(-50%, -50%)',
      display: 'flex',
      gap: 8,
      fontFamily: SERIF,
      fontSize: 280,
      fontWeight: 400,
      color: ARIA_CREAM,
      letterSpacing: '0.04em',
      mixBlendMode: 'normal',
    }}>
      {letters.map((l, i) => {
        const appear = i * 0.18;
        const lt = clamp((localTime - appear) / 0.6, 0, 1);
        const eased = Easing.easeOutBack(lt);
        return (
          <span key={i} style={{
            opacity: lt,
            transform: `translateY(${(1 - eased) * 60}px) scale(${0.7 + 0.3 * eased})`,
            display: 'inline-block',
            color: ARIA_CREAM,
            textShadow: '0 0 40px rgba(212, 166, 90, 0.6)',
          }}>{l}</span>
        );
      })}
    </div>
  );
}

Object.assign(window, { Scene3Reveal });
