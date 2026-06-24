// globe-greetings — RUN 15 §2 greeting scheduler. PURE: given timing state + mode, decides the next
// greeting (or null). Rate-limited to ≤1 message / 60s; quieter in Autonomous + low-power.
export const GREET_MIN_GAP_MS = 60 * 1000;          // never more than 1 message per 60s
export const PERIODIC_MIN_MS = 18 * 60 * 1000;      // ambient greeting every 18–22 min
export const PERIODIC_MAX_MS = 22 * 60 * 1000;
export const CHAT_BUBBLE_MS = 10 * 60 * 1000;       // chat-prompt bubble every 10 min
export const LAUNCH_GRACE_MS = 2000;

export const PERIODIC_MESSAGES = [
  "Anything you need? I'm here.",
  "Let me know if you need help.",
  "I'm watching things in the background — tap me if you need anything."
];

/**
 * Decide the next greeting action (pure).
 * @param {object} s { launchedMs, now, lastGreetMs, lastChatBubbleMs, saidHi, periodIndex, periodEveryMs }
 * @param {object} opts { mode, lowPower }
 * @returns {null | { type:'hi'|'periodic'|'chat-bubble', message?, durationMs? }}
 */
export function dueGreeting(s = {}, opts = {}) {
  const now = Number(s.now) || 0;
  const lastGreet = Number.isFinite(s.lastGreetMs) ? s.lastGreetMs : -Infinity;
  if (now - lastGreet < GREET_MIN_GAP_MS) return null; // global rate limit

  // Launch "Hi" (after the 2s grace), once.
  if (!s.saidHi && now - (Number(s.launchedMs) || 0) >= LAUNCH_GRACE_MS) {
    return { type: "hi", message: "Hi 👋", durationMs: 4000 };
  }

  // No ambient greeting until the launch "Hi" has happened (covers the 2s grace window too).
  if (!s.saidHi) return null;

  // Autonomous + low-power: only the launch hi; stay quiet otherwise.
  if (opts.lowPower || opts.mode === "autonomous") return null;

  // 10-minute chat-prompt bubble.
  const lastChat = Number.isFinite(s.lastChatBubbleMs) ? s.lastChatBubbleMs : -Infinity;
  if (now - lastChat >= CHAT_BUBBLE_MS) {
    return { type: "chat-bubble", message: "Want to talk or search anything?", durationMs: 12000 };
  }

  // Ambient periodic greeting (18–22 min; the runner picks the jittered period).
  const every = Number(s.periodEveryMs) || PERIODIC_MIN_MS;
  if (now - lastGreet >= every) {
    const idx = (Number(s.periodIndex) || 0) % PERIODIC_MESSAGES.length;
    return { type: "periodic", message: PERIODIC_MESSAGES[idx], durationMs: 6000 };
  }
  return null;
}

// Pick a jittered 18–22 min period from a 0..1 random sample (runner passes Math.random()).
export function jitteredPeriod(sample) {
  const r = Math.max(0, Math.min(1, Number(sample) || 0));
  return Math.round(PERIODIC_MIN_MS + r * (PERIODIC_MAX_MS - PERIODIC_MIN_MS));
}
