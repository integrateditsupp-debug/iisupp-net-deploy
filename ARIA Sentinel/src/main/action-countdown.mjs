// RUN 23 §4 — 10s pre-execution gate. Before ANY risky action (risk medium/high, or any system-fix) runs,
// a 10-second countdown shows in BOTH the Mode chat and the floating action-indicator banner below the globe.
// The counter ticks once/second. ANY of these abort it: the ABORT button on the banner, "Stop" in Mode chat,
// or the existing Ctrl+Alt+K kill-switch (RUN 19) — all funnel through `abort()`/the manager's `abortAll()`.
// Low-risk actions (info / investigate / end-task on a frozen UI) BYPASS the countdown and execute at once.
// Pure + node-safe: timers are injectable so every tick + abort path is unit-tested. AbortController-based.
import { redactPrivate } from "../shared/path-guard.mjs";

export const COUNTDOWN_SECONDS = 10;

/** Low-risk, no-confirm recommendations bypass the countdown (execute immediately). */
export function shouldCountdown(recommendation) {
  if (!recommendation) return true;
  return !(recommendation.confirmRequired === false && recommendation.risk === "low");
}

/** Mode-chat line: "About to run `restart-print-spooler` in 8s — click Stop to abort". */
export function countdownChatLine(recipeId, remaining) {
  return `About to run \`${redactPrivate(String(recipeId || ""))}\` in ${remaining}s — click Stop to abort`;
}

/** Globe-banner text (the ABORT control is a separate button): "RUNNING: restart-print-spooler (8s)". */
export function countdownBannerText(recipeId, remaining) {
  return `RUNNING: ${redactPrivate(String(recipeId || ""))} (${remaining}s)`;
}

/**
 * Create an abortable 10s countdown. Timers are injectable (`setIntervalFn`/`clearIntervalFn`) so tests can
 * drive ticks deterministically. Calls onTick(remaining) each second, then onComplete() — unless abort()
 * fires first, which aborts the signal and calls onAbort().
 */
export function createCountdown(opts = {}) {
  const seconds = Number.isFinite(opts.seconds) ? opts.seconds : COUNTDOWN_SECONDS;
  const setIntervalFn = opts.setIntervalFn || setInterval;
  const clearIntervalFn = opts.clearIntervalFn || clearInterval;
  const controller = new AbortController();
  let remaining = seconds;
  let timer = null;
  let done = false;

  function finish(reason) {
    if (done) return;
    done = true;
    if (timer != null) { clearIntervalFn(timer); timer = null; }
    if (reason === "abort") {
      try { controller.abort(); } catch { /* signal already aborted */ }
      if (typeof opts.onAbort === "function") opts.onAbort();
    } else if (typeof opts.onComplete === "function") {
      opts.onComplete();
    }
  }

  return {
    signal: controller.signal,
    recipeId: opts.recipeId || null,
    get remaining() { return remaining; },
    isPending() { return !done; },
    start() {
      if (done || timer != null) return this;
      if (typeof opts.onTick === "function") opts.onTick(remaining);
      timer = setIntervalFn(() => {
        remaining -= 1;
        if (remaining <= 0) finish("complete");
        else if (typeof opts.onTick === "function") opts.onTick(remaining);
      }, 1000);
      return this;
    },
    abort() { finish("abort"); }
  };
}

/** Tracks all in-flight countdowns so the kill-switch can `abortAll()` them in one panic action. */
export function createCountdownManager() {
  const pending = new Set();
  return {
    register(c) { if (c) pending.add(c); return c; },
    remove(c) { pending.delete(c); },
    abortAll() {
      let n = 0;
      for (const c of [...pending]) {
        if (c && c.isPending()) { c.abort(); n += 1; }
        pending.delete(c);
      }
      return n;
    },
    size() { return pending.size; }
  };
}
