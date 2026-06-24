// power-mode — pure mapping from the low-power toggle to the polling/animation profile. Low-power
// drops watcher polling to 60s, the globe to 15fps, and disables non-essential animation, so an
// idle laptop barely notices ARIA is running.
export const NORMAL_PROFILE = Object.freeze({ watcherIntervalMs: 5000, globeFps: 30, animations: true });
export const LOW_POWER_PROFILE = Object.freeze({ watcherIntervalMs: 60000, globeFps: 15, animations: false });

export function pollingProfile(lowPower) {
  return lowPower ? { ...LOW_POWER_PROFILE } : { ...NORMAL_PROFILE };
}

// Frame interval (ms) for the overlay globe at the profile's fps.
export function globeFrameMs(lowPower) {
  return Math.round(1000 / pollingProfile(lowPower).globeFps);
}
