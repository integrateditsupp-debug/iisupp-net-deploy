// STAGE 3 S3 — maintenance windows: gates WHEN an unattended plan may run ("plans queue to the window").
// Pure, injectable clock (fixed local Dates), nothing spawned. Proves: normalization is honest, within/next
// math is correct (incl. midnight-crossing + weekday-only + multi-window), attended runs are never gated,
// unconfigured is a no-op, the ladder+window combiner ANDs both, R11 is check #1, nextWindowStart is
// real-or-empty. Mirrors plan-autonomy-ladder.test.mjs house style.
import assert from "node:assert/strict";
import {
  DAY_SETS, emptyWindowConfig, parseHHMM, normalizeWindow, normalizeWindowConfig,
  isWithinWindow, nextWindowStart, checkMaintenanceWindow, gateUnattendedRun,
} from "../src/main/plan-maintenance-window.mjs";

let groups = 0;
const g = (name, fn) => { fn(); groups++; };

// A daily 02:00 window, 1h long — the spec's canonical example.
const nightly = { enabled: true, windows: [{ days: "daily", start: "02:00", durationMin: 60 }] };
// 2026-07-16 is a Thursday (getDay()===4).
const thu = (h, m = 0) => new Date(2026, 6, 16, h, m, 0, 0);

// 1 — parseHHMM + day-sets + normalization are honest (junk dropped, real-or-empty).
g("normalization", () => {
  assert.equal(parseHHMM("02:00"), 120);
  assert.equal(parseHHMM("23:59"), 1439);
  assert.equal(parseHHMM("24:00"), null);
  assert.equal(parseHHMM("2:5"), null);
  assert.equal(parseHHMM(""), null);
  assert.deepEqual(DAY_SETS.weekdays, [1, 2, 3, 4, 5]);
  assert.deepEqual(DAY_SETS.weekends, [0, 6]);
  assert.equal(normalizeWindow({ days: "daily", start: "02:00", durationMin: 60 }).startMin, 120);
  assert.equal(normalizeWindow({ days: "daily", start: "02:00", durationMin: 0 }), null); // no zero-length
  assert.equal(normalizeWindow({ days: "daily", start: "bad", durationMin: 60 }), null);
  assert.equal(normalizeWindow({ days: [], start: "02:00", durationMin: 60 }), null); // empty day-set dropped
  assert.equal(normalizeWindow({ days: [1, 1, 9, 2], start: "02:00", durationMin: 60 }).days.join(","), "1,2"); // dedup + range-filter
  assert.equal(normalizeWindow({ days: "daily", start: "02:00", durationMin: 5000 }).durationMin, 1440); // capped to a day
  // invalid windows are dropped, and a config with none left is disabled (not fabricated).
  const cfg = normalizeWindowConfig({ enabled: true, windows: [{ days: "daily", start: "bad", durationMin: 60 }] });
  assert.equal(cfg.enabled, false);
  assert.deepEqual(emptyWindowConfig(), { enabled: false, windows: [] });
});

// 2 — within the window (inclusive start) vs outside; boundaries.
g("within-vs-outside", () => {
  assert.equal(isWithinWindow(nightly, thu(2, 0)).within, true);   // exactly at start (inclusive)
  assert.equal(isWithinWindow(nightly, thu(2, 30)).within, true);  // mid-window
  assert.equal(isWithinWindow(nightly, thu(2, 59)).within, true);
  assert.equal(isWithinWindow(nightly, thu(3, 0)).within, false);  // exactly at end (exclusive)
  assert.equal(isWithinWindow(nightly, thu(14, 0)).within, false); // broad daylight
  assert.equal(isWithinWindow(nightly, thu(1, 59)).within, false); // one minute early
});

// 3 — nextWindowStart is real-or-empty and correct (today's upcoming vs tomorrow's).
g("next-window", () => {
  // At 14:00 Thu, next daily 02:00 window is 02:00 FRIDAY (today's already passed).
  const nxtAfternoon = nextWindowStart(nightly, thu(14, 0));
  assert.equal(nxtAfternoon.getDate(), 17); assert.equal(nxtAfternoon.getHours(), 2);
  // At 00:30 Thu (before today's window), next start is 02:00 TODAY.
  const nxtEarly = nextWindowStart(nightly, thu(0, 30));
  assert.equal(nxtEarly.getDate(), 16); assert.equal(nxtEarly.getHours(), 2);
  // Disabled / empty config → null, never a fabricated time.
  assert.equal(nextWindowStart(emptyWindowConfig(), thu(14)), null);
  assert.equal(nextWindowStart({ enabled: false, windows: [{ days: "daily", start: "02:00", durationMin: 60 }] }, thu(14)), null);
});

// 4 — midnight-crossing window (23:00 for 3h → active until 02:00 next day).
g("midnight-crossing", () => {
  const cross = { enabled: true, windows: [{ days: "daily", start: "23:00", durationMin: 180 }] };
  assert.equal(isWithinWindow(cross, thu(23, 30)).within, true);   // same evening
  assert.equal(isWithinWindow(cross, new Date(2026, 6, 17, 1, 0)).within, true); // 01:00 next morning, from yesterday's window
  assert.equal(isWithinWindow(cross, new Date(2026, 6, 17, 2, 0)).within, false); // 02:00 = end (exclusive)
});

// 5 — weekday-only window skips the weekend to the next Monday.
g("weekday-only", () => {
  const biz = { enabled: true, windows: [{ days: "weekdays", start: "02:00", durationMin: 60 }] };
  const sat = new Date(2026, 6, 18, 3, 0); // Sat 2026-07-18
  assert.equal(isWithinWindow(biz, sat).within, false);
  const nxt = nextWindowStart(biz, sat);
  assert.equal(nxt.getDay(), 1); // Monday
  assert.equal(nxt.getDate(), 20);
});

// 6 — multiple windows → soonest upcoming wins.
g("multi-window", () => {
  const multi = { enabled: true, windows: [
    { days: "daily", start: "02:00", durationMin: 60 },
    { days: "daily", start: "13:00", durationMin: 30 },
  ] };
  const nxt = nextWindowStart(multi, thu(10, 0)); // next is 13:00 today, not 02:00 tomorrow
  assert.equal(nxt.getDate(), 16); assert.equal(nxt.getHours(), 13);
  assert.equal(isWithinWindow(multi, thu(13, 10)).within, true);
});

const plan = () => ({ id: "network-recovery", steps: [{ recipeId: "flush-dns" }, { recipeId: "reset-network-stack" }] });

// 7 — checkMaintenanceWindow: unattended inside window allowed; outside → queued with a real next time.
g("check-unattended", () => {
  const inside = checkMaintenanceWindow({ plan: plan(), windowConfig: nightly, now: thu(2, 15), unattended: true });
  assert.equal(inside.allowed, true); assert.equal(inside.within, true); assert.deepEqual(inside.reasons, []);

  const outside = checkMaintenanceWindow({ plan: plan(), windowConfig: nightly, now: thu(14, 0), unattended: true });
  assert.equal(outside.allowed, false);
  assert.equal(outside.within, false);
  assert.equal(outside.nextWindowStart.getHours(), 2);
  assert.match(outside.reasons[0], /outside maintenance window/);
});

// 8 — attended (Confirmed/Manual) runs are NEVER window-gated, even outside the window.
g("attended-never-gated", () => {
  const r = checkMaintenanceWindow({ plan: plan(), windowConfig: nightly, now: thu(14, 0), unattended: false });
  assert.equal(r.allowed, true);
  assert.deepEqual(r.reasons, []);
});

// 9 — no window configured → gate is a no-op for unattended (ladder is the real gate), honestly flagged.
g("unconfigured-noop", () => {
  const r = checkMaintenanceWindow({ plan: plan(), windowConfig: emptyWindowConfig(), now: thu(14), unattended: true });
  assert.equal(r.allowed, true);
  assert.equal(r.windowConfigured, false);
  assert.equal(r.nextWindowStart, null);
  assert.match(r.reasons[0], /no maintenance window configured/);
});

// 10 — 🔒 R11 is check #1: a plan referencing the off-limits folder is refused and leaks nothing.
g("r11-check-first", () => {
  const evil = { id: "x", steps: [{ recipeId: "read", path: "C:/Users/Me/Private pics and Vids/secret.png" }] };
  const r = checkMaintenanceWindow({ plan: evil, windowConfig: nightly, now: thu(2, 15), unattended: true });
  assert.equal(r.allowed, false);
  assert.match(r.reasons[0], /R11/);
  assert.equal(r.nextWindowStart, null);
});

// 11 — combiner ANDs ladder + window; both blockers surface; neither can force a run.
g("combiner", () => {
  const vettedCountOf = () => 50; // recipes vetted Tier ≤ 1
  let history = { plans: { "network-recovery": { supervisedSuccesses: 12, runs: [], lastTs: 0 } } };
  // Ladder is satisfied but S1_UNATTENDED_ENABLED is false by default → still blocked. Force-enable to isolate
  // the window behavior, exactly as the ladder's own test does.
  const inWin = gateUnattendedRun({ plan: plan(), planHistory: history, vettedCountOf, mode: "autonomous", windowConfig: nightly, now: thu(2, 15), unattendedEnabled: true });
  assert.equal(inWin.allowed, true);
  assert.deepEqual(inWin.reasons, []);

  const outWin = gateUnattendedRun({ plan: plan(), planHistory: history, vettedCountOf, mode: "autonomous", windowConfig: nightly, now: thu(14, 0), unattendedEnabled: true });
  assert.equal(outWin.allowed, false); // window blocks even a fully-earned plan
  assert.ok(outWin.reasons.some((r) => /outside maintenance window/.test(r)));

  // Ladder unearned (few successes) AND outside window → BOTH reasons present, allowed false.
  const both = gateUnattendedRun({ plan: plan(), planHistory: { plans: {} }, vettedCountOf, mode: "autonomous", windowConfig: nightly, now: thu(14, 0), unattendedEnabled: true });
  assert.equal(both.allowed, false);
  assert.ok(both.reasons.some((r) => /supervised successes/.test(r)));
  assert.ok(both.reasons.some((r) => /outside maintenance window/.test(r)));

  // The default S1 gate (unattendedEnabled omitted) keeps it blocked regardless of window — safety intact.
  const s1 = gateUnattendedRun({ plan: plan(), planHistory: history, vettedCountOf, mode: "autonomous", windowConfig: nightly, now: thu(2, 15) });
  assert.equal(s1.allowed, false);
  assert.ok(s1.reasons.some((r) => /not enabled|Confirmed mode/.test(r)));
});

console.log(`plan-maintenance-window test passed (${groups} groups · normalize honest · within/next math incl. midnight-cross + weekday-only + multi-window · attended never gated · unconfigured no-op · R11 check #1 · ladder+window combiner ANDs both · S1 gate still wins · real-or-empty next time).`);
