// EVENT-LOG CURSOR RESET (2026-10-14, review P2-10) — the event-log watcher's cursor (highest System-log RecordId seen)
// never went backwards. After the System log was cleared (RecordIds restart at 1) every new error had a RecordId below the
// old cursor, so the watcher was blind until the new log out-grew the old one — potentially forever on a quiet machine.
// The rule now (src/sub-agents/detection/event-log-watcher.mjs advanceEventLogCursor): when the newest RecordId is BELOW
// the cursor, the cursor RESETS to it (a re-baseline, like a first launch — audit M6: never raise rows it may already have
// seen as new alarms), and every event after that is surfaced. Shape: the reviewer's p2-eventlog-cursor.mjs.
import assert from "node:assert/strict";
import { advanceEventLogCursor, createEventLogWatcher, __resetCursor, EVENT_LOG_CURSOR_KEY } from "../src/sub-agents/detection/event-log-watcher.mjs";

const row = (id, provider = "Microsoft-Windows-DNS-Client", eventId = 1014) => ({ RecordId: id, ProviderName: provider, Id: eventId, LevelDisplayName: "Error" });
let groups = 0; const g = () => { groups++; };

// 1 — the reviewer's shape: a normal new event; then the log is cleared.
{
  const before = advanceEventLogCursor([row(250001)], 250000);
  assert.equal(before.signals.length, 1, "normal new event → one signal");
  const afterClear = advanceEventLogCursor([row(3)], 250001);
  assert.equal(afterClear.cursor, 3, "after a log clear the cursor resets to the newest RecordId (it used to stay at 250001)");
  assert.equal(afterClear.reset, true);
  assert.equal(afterClear.baseline, true, "the reset tick is a baseline (audit M6: never re-raise rows it cannot tell apart)");
  assert.deepEqual(afterClear.signals, []);
  // …and the watcher is no longer blind: the next new error is surfaced.
  const next = advanceEventLogCursor([row(3), row(4)], afterClear.cursor);
  assert.deepEqual(next.signals, [{ signal: "NET.DNS.FAIL", hint: "dns-timeout" }], "the next event after the clear → a signal (it was 0 before the fix)");
  assert.equal(next.cursor, 4);
  // the old (blind) cursor would have swallowed it:
  assert.equal(advanceEventLogCursor([row(3), row(4)], 250001).signals.length, 0, "(with the stale cursor every new row looks old — which is why it must reset)");
}
g();

// 2 — what does NOT reset: an empty answer (cannot tell), equal / growing ids, a first launch.
{
  assert.equal(advanceEventLogCursor([], 250001).cursor, 250001, "no rows → the cursor stays (nothing to compare)");
  assert.equal(advanceEventLogCursor(null, 250001).cursor, 250001);
  assert.equal(advanceEventLogCursor([row(250001)], 250001).reset, undefined, "the same newest row → no reset");
  assert.equal(advanceEventLogCursor([row(250001)], 250001).signals.length, 0);
  const first = advanceEventLogCursor([row(10), row(11)], 0);
  assert.equal(first.baseline, true); assert.equal(first.cursor, 11); assert.equal(first.reset, undefined, "a first launch is a baseline, not a reset");
}
g();

// 3 — a cursor that came from ANOTHER machine (a roaming profile): 40 old errors on this PC are not raised as new alarms.
{
  const oldErrors = Array.from({ length: 40 }, (_, i) => row(180000 - i, i % 2 ? "Microsoft-Windows-Kernel-Power" : "Service Control Manager", i % 2 ? 41 : 7034));
  const st = advanceEventLogCursor(oldErrors, 250001);
  assert.equal(st.reset, true); assert.equal(st.cursor, 180000); assert.deepEqual(st.signals, [], "no false alarms from this PC's history");
  assert.equal(advanceEventLogCursor([...oldErrors, row(180001)], st.cursor).signals.length, 1, "the first genuinely new error is surfaced");
}
g();

// 4 — the watcher persists the reset cursor, so a relaunch continues from it (not from the stale one).
{
  __resetCursor();
  const m = { [EVENT_LOG_CURSOR_KEY]: 250001 };
  const cursors = { get: (k) => m[k], set: (k, v) => { m[k] = v; } };
  const w = createEventLogWatcher({ emit: () => {}, isBlocked: () => false, cursors });
  assert.equal(w.cursor(), 250001, "the persisted (pre-clear) cursor is loaded");
  // Drive the pure step the way tick() does (tick spawns PowerShell on win32 only).
  const st = advanceEventLogCursor([row(3)], w.cursor());
  if (st.cursor !== w.cursor()) cursors.set(EVENT_LOG_CURSOR_KEY, st.cursor);
  assert.equal(m[EVENT_LOG_CURSOR_KEY], 3, "the reset cursor is what is persisted");
  __resetCursor();
  const w2 = createEventLogWatcher({ emit: () => {}, isBlocked: () => false, cursors });
  assert.equal(w2.cursor(), 3, "a relaunch continues from the reset cursor");
  __resetCursor();
}
g();

assert.equal(groups, 4);
console.log(`event-log-cursor-reset test passed (${groups} groups · a cleared log resets the cursor to the newest RecordId (re-baseline) · the next new event is surfaced · empty / equal / first-launch never reset · a roaming cursor raises no old alarms · the reset cursor is persisted).`);
