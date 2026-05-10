// Shared helpers + atoms for all ARIA scenes
// Palette: black / cream / gold

const ARIA_GOLD = '#D4A65A';
const ARIA_GOLD_BRIGHT = '#EBC882';
const ARIA_GOLD_DEEP = '#A87E36';
const ARIA_BLACK = '#0a0908';
const ARIA_CREAM = '#f4ede0';
const ARIA_DIM = '#7a6f5c';

const SERIF = '"Cormorant Garamond", "EB Garamond", Garamond, serif';
const SANS = '"Inter", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

// Smooth fade-in/hold/fade-out wrapper using sprite progress
function FadeBlock({ children, fadeIn = 0.4, fadeOut = 0.4, style = {} }) {
  const { localTime, duration } = useSprite();
  const exitStart = Math.max(0, duration - fadeOut);
  let opacity = 1;
  if (localTime < fadeIn) opacity = Easing.easeOutCubic(clamp(localTime / fadeIn, 0, 1));
  else if (localTime > exitStart) opacity = 1 - Easing.easeInCubic(clamp((localTime - exitStart) / fadeOut, 0, 1));
  return <div style={{ opacity, ...style }}>{children}</div>;
}

// A glowing gold dot
function GoldOrb({ x, y, size = 200, intensity = 1, blur = 80 }) {
  return (
    <div style={{
      position: 'absolute',
      left: x, top: y,
      width: size, height: size,
      transform: 'translate(-50%, -50%)',
      background: `radial-gradient(circle, rgba(235, 200, 130, ${0.95 * intensity}) 0%, rgba(212, 166, 90, ${0.6 * intensity}) 30%, rgba(168, 126, 54, ${0.2 * intensity}) 60%, transparent 75%)`,
      filter: `blur(${blur * 0.05}px)`,
      pointerEvents: 'none',
      mixBlendMode: 'screen',
    }} />
  );
}

// Subtle film grain background
function GrainOverlay({ opacity = 0.04 }) {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity, pointerEvents: 'none', mixBlendMode: 'overlay' }}>
      <filter id="g">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
      </filter>
      <rect width="100%" height="100%" filter="url(#g)" />
    </svg>
  );
}

// Vignette overlay
function Vignette() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)',
      pointerEvents: 'none',
    }} />
  );
}

// Marble texture using radial gradients (for sign-off frame)
function MarbleBackground() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `
        radial-gradient(ellipse at 20% 30%, rgba(244, 237, 224, 1) 0%, rgba(232, 220, 196, 0) 50%),
        radial-gradient(ellipse at 80% 70%, rgba(220, 200, 160, 0.4) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(212, 166, 90, 0.05) 0%, transparent 70%),
        linear-gradient(135deg, #f4ede0 0%, #e8dcc4 100%)
      `,
    }} />
  );
}

// Capsule label (eyebrow text)
function Eyebrow({ text, x, y, color = ARIA_GOLD, size = 18, align = 'center' }) {
  return (
    <div style={{
      position: 'absolute',
      left: x, top: y,
      transform: align === 'center' ? 'translateX(-50%)' : 'none',
      fontFamily: MONO,
      fontSize: size,
      fontWeight: 500,
      color,
      letterSpacing: '0.32em',
      textTransform: 'uppercase',
    }}>
      {text}
    </div>
  );
}

// A horizontal hairline — gold
function HairLine({ x, y, w = 200, color = ARIA_GOLD, thickness = 1 }) {
  return (
    <div style={{
      position: 'absolute',
      left: x, top: y,
      width: w, height: thickness,
      background: color,
      transform: 'translateX(-50%)',
      opacity: 0.7,
    }} />
  );
}

Object.assign(window, {
  ARIA_GOLD, ARIA_GOLD_BRIGHT, ARIA_GOLD_DEEP, ARIA_BLACK, ARIA_CREAM, ARIA_DIM,
  SERIF, SANS, MONO,
  FadeBlock, GoldOrb, GrainOverlay, Vignette, MarbleBackground,
  Eyebrow, HairLine,
});
