// Scene 2 (10–22s): The cost of waiting — kinetic typography
// Three impact cards: lost lead, missed deadline, burnout

function Scene2Cost({ start = 10, end = 22 }) {
  return (
    <Sprite start={start} end={end}>
      <Scene2Inner sceneStart={start} />
    </Sprite>
  );
}

function Scene2Inner({ sceneStart }) {
  const time = useTime();
  const t = time - sceneStart;

  // Ken-Burns slow zoom on whole composition
  const camScale = 1 + 0.04 * (t / 12);

  return (
    <div style={{ position: 'absolute', inset: 0, background: ARIA_BLACK, overflow: 'hidden' }}>
      <GrainOverlay opacity={0.05} />

      {/* Eyebrow */}
      <Sprite start={sceneStart + 0.3} end={sceneStart + 11.5}>
        <FadeBlock fadeIn={0.5} fadeOut={0.4}>
          <Eyebrow text="Every minute waiting costs you" x="50%" y={120} />
        </FadeBlock>
      </Sprite>

      {/* Three sequential cost callouts */}
      <div style={{
        position: 'absolute',
        inset: 0,
        transform: `scale(${camScale})`,
        transformOrigin: 'center',
      }}>
        <Sprite start={sceneStart + 1.0} end={sceneStart + 4.6}>
          <CostBeat
            stat="$24,000"
            label="LEAD LOST"
            line="A demo never started."
            sub="Sales rep couldn't access the client portal in time."
          />
        </Sprite>

        <Sprite start={sceneStart + 4.6} end={sceneStart + 8.2}>
          <CostBeat
            stat="3.5 hrs"
            label="DEADLINE MISSED"
            line="The quarterly report didn't ship."
            sub="Stuck in queue behind 41 other tickets."
          />
        </Sprite>

        <Sprite start={sceneStart + 8.2} end={sceneStart + 11.8}>
          <CostBeat
            stat="42%"
            label="AGENT TURNOVER"
            line="Your best people are burning out."
            sub="L1 tickets are repetitive. Repetition is exhausting."
          />
        </Sprite>
      </div>
    </div>
  );
}

function CostBeat({ stat, label, line, sub }) {
  const { localTime, duration } = useSprite();

  // Stagger three lines: stat → line → sub
  const statT = Easing.easeOutCubic(clamp(localTime / 0.5, 0, 1));
  const labelT = Easing.easeOutCubic(clamp((localTime - 0.25) / 0.5, 0, 1));
  const lineT = Easing.easeOutCubic(clamp((localTime - 0.55) / 0.5, 0, 1));
  const subT = Easing.easeOutCubic(clamp((localTime - 0.85) / 0.5, 0, 1));

  // Exit
  const exitStart = duration - 0.5;
  let exitOp = 1;
  if (localTime > exitStart) exitOp = 1 - clamp((localTime - exitStart) / 0.5, 0, 1);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      opacity: exitOp,
      paddingTop: 40,
    }}>
      {/* Eyebrow label */}
      <div style={{
        opacity: labelT,
        transform: `translateY(${(1 - labelT) * 10}px)`,
        fontFamily: MONO,
        fontSize: 14,
        color: ARIA_GOLD,
        letterSpacing: '0.4em',
        marginBottom: 30,
      }}>
        {label}
      </div>

      {/* The stat — huge serif */}
      <div style={{
        opacity: statT,
        transform: `translateY(${(1 - statT) * 30}px) scale(${0.95 + 0.05 * statT})`,
        fontFamily: SERIF,
        fontSize: 240,
        fontWeight: 400,
        color: ARIA_GOLD_BRIGHT,
        letterSpacing: '-0.04em',
        lineHeight: 0.9,
        textShadow: '0 0 80px rgba(212, 166, 90, 0.3)',
        whiteSpace: 'nowrap',
      }}>
        {stat}
      </div>

      {/* Headline */}
      <div style={{
        marginTop: 30,
        opacity: lineT,
        transform: `translateY(${(1 - lineT) * 14}px)`,
        fontFamily: SERIF,
        fontStyle: 'italic',
        fontSize: 56,
        fontWeight: 400,
        color: ARIA_CREAM,
        letterSpacing: '-0.01em',
      }}>
        {line}
      </div>

      {/* Sub */}
      <div style={{
        marginTop: 22,
        opacity: subT * 0.8,
        transform: `translateY(${(1 - subT) * 8}px)`,
        fontFamily: SANS,
        fontSize: 22,
        fontWeight: 300,
        color: ARIA_CREAM,
        letterSpacing: '0.01em',
      }}>
        {sub}
      </div>
    </div>
  );
}

Object.assign(window, { Scene2Cost });
