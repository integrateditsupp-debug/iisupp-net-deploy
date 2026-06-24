// start-stop — RUN 15 §6. Pure run-state machine behind the "Start ARIA" / "Stop ARIA" buttons.
// Stop → watchers off + globe hidden; Start → watchers on + globe shown + active monitoring.
export const MONITOR_ORDER = ["screen-errors", "event-log", "kb", "research", "escalate"];

export function nextMonitorStep(current) {
  const i = MONITOR_ORDER.indexOf(current);
  return i === -1 ? MONITOR_ORDER[0] : (MONITOR_ORDER[i + 1] || null);
}

/**
 * Apply an action to the run state. Pure → returns the next desired state; main applies it to
 * watchers/overlay/store.
 * @param {object} state { running, globeVisible, watchers, pausedUntil }
 * @param {string} action 'start' | 'stop' | 'pause-1h'
 * @param {number} now
 */
export function applyRunState(state = {}, action, now = Date.now()) {
  if (action === "stop") {
    return { running: false, globeVisible: false, watchers: false, pausedUntil: 0, monitoring: false };
  }
  if (action === "start") {
    return { running: true, globeVisible: true, watchers: true, pausedUntil: 0, monitoring: true };
  }
  if (action === "pause-1h") {
    return { ...state, running: true, watchers: false, pausedUntil: now + 60 * 60 * 1000, monitoring: false };
  }
  return { ...state };
}

// A pause is over once the clock passes pausedUntil.
export function isActivelyMonitoring(state, now = Date.now()) {
  return Boolean(state.running) && Boolean(state.watchers) && !(Number(state.pausedUntil) > now);
}
