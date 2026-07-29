// RUN-J J3 — SIXTY-SECOND WEEKLY TRUTH DIGEST (pure, local-only, Rule 14 real-or-empty).
// One page a week that composes the REAL I3 revenue board, the J1 deal-blocker autopsy and the J2
// capacity truth into: what moved, what did not, the single highest-value action, and the honest
// dollar figure. A week with nothing real in it says "nothing moved" and renders nothing else.
//
// Honesty invariants (Rule 14):
//   - NOTHING-MOVED IS REACHABLE AND IS THE DEFAULT. An empty week is not dressed up.
//   - NO VANITY. No streaks, no counters-for-their-own-sake, no "momentum" language. A guard test
//     fails the build if any banned word appears in the rendered digest.
//   - STAGED IS NEVER REPORTED AS DONE. Staged work appears under "waiting on one click", never under
//     what moved, and it adds $0 to the money line.
//   - EVERY FIGURE IS TRACEABLE to the board / autopsy / capacity report it came from.
//   - Rule 15 additive: the composed reports are read-only inputs; none are replaced or renamed.

export const DIGEST_SCHEMA = "weekly-truth-digest.v1";

export const WEEK_MS = 7 * 86400000;

export const NOTHING_MOVED = "Nothing moved this week.";

export const NOTHING_MOVED_NOTE =
  "No real payment, no new evidenced blocker, no change in observed delivery. That is the honest state of the week.";

// Words this digest is never allowed to use about itself.
export const BANNED_LANGUAGE = ["momentum", "streak", "on fire", "crushing", "record week", "trending up"];

export const MONEY_ZERO_NOTE = "Real money in this week: CAD $0. Staged work is not money.";

export const ACTION_NONE = "No action can be derived from real data yet - record one real delivery or one real blocker.";

function str(v) { return typeof v === "string" && v.trim() ? v.trim() : null; }

// -- 1. Only a payment actually received inside the window is this week's money -----------------------
export function weekPayments(board, { now = Date.now(), weekMs = WEEK_MS } = {}) {
  if (!board || board.schema !== "revenue-truth-board.v1") return [];
  const from = now - weekMs;
  return (Array.isArray(board.payments) ? board.payments : []).filter((p) => {
    const t = Date.parse(p.receivedAt);
    return !Number.isNaN(t) && t >= from && t <= now;
  });
}

// -- 2. The single highest-value action, derived only from real signals --------------------------------
export function highestValueAction({ board, autopsy, capacity }) {
  // 1. Over capacity beats everything: closing more work would break delivery.
  if (capacity && capacity.verdict === "over") {
    return { action: "Do not close more delivery work until capacity is added - committed " +
      capacity.committedMinutes + " min/week against " + capacity.capacityMinutes + " observed.",
      source: capacity.schema };
  }
  // 2. A real, evidenced pattern of blockers is the next most valuable thing to fix.
  const pattern = autopsy && Array.isArray(autopsy.patterns) ? autopsy.patterns.find((p) => p.isPattern) : null;
  if (pattern) {
    return { action: "Fix the '" + pattern.kind + "' blocker - it stopped " + pattern.cases +
      " real opportunities [" + pattern.opportunityIds.join(", ") + "].", source: autopsy.schema };
  }
  // 3. Money is staged and only a human click stands between us and an invoice.
  if (board && Array.isArray(board.blockedOnAhmad) && board.blockedOnAhmad.length > 0) {
    return { action: "One click from Ahmad: " + board.blockedOnAhmad[0].item, source: board.schema };
  }
  // 4. Unknown blockers mean we cannot learn anything - closing that gap is the value.
  if (autopsy && autopsy.unknownCount > 0) {
    return { action: "Record the real blocker for " + autopsy.unknownCount +
      " unknown opportunit" + (autopsy.unknownCount === 1 ? "y" : "ies") + " - without it nothing can be learned.",
      source: autopsy.schema };
  }
  return { action: ACTION_NONE, source: null };
}

// -- 3. The digest ---------------------------------------------------------------------------------------
export function buildWeeklyDigest(input = {}, { now = Date.now(), weekMs = WEEK_MS } = {}) {
  const src = input && typeof input === "object" ? input : {};
  const board = src.board && src.board.schema === "revenue-truth-board.v1" ? src.board : null;
  const autopsy = src.autopsy && src.autopsy.schema === "deal-blocker-autopsy.v1" ? src.autopsy : null;
  const capacity = src.capacity && src.capacity.schema === "delivery-capacity-truth.v1" ? src.capacity : null;

  const payments = weekPayments(board, { now, weekMs });
  const moneyInCad = Math.round(payments.reduce((s, p) => s + p.amountCad, 0) * 100) / 100;

  const moved = [];
  for (const p of payments) {
    moved.push({ what: "Payment received: " + p.customer + " CAD $" + p.amountCad, source: p.id });
  }
  if (autopsy && autopsy.knownCount > 0) {
    moved.push({ what: autopsy.knownCount + " non-converted opportunit" + (autopsy.knownCount === 1 ? "y has" : "ies have") +
      " a real recorded blocker", source: autopsy.schema });
  }
  if (capacity && !capacity.empty) {
    moved.push({ what: "Observed delivery load measured: " + capacity.committedMinutes + " min/week across " +
      capacity.accounts.length + " account(s)", source: capacity.schema });
  }

  const didNotMove = [];
  // With no revenue board at all there is nothing to say about money - saying "$0 this week" off no
  // input would be a claim we cannot back.
  if (board && moneyInCad === 0) didNotMove.push({ what: MONEY_ZERO_NOTE, source: board.schema });
  if (board && Array.isArray(board.pipeline) && board.pipeline.length > 0) {
    didNotMove.push({ what: board.pipeline.length + " staged packet(s) worth CAD $" + board.pipelineCad +
      " - staged, not earned, not booked", source: board.schema });
  }
  if (autopsy && autopsy.unknownCount > 0) {
    didNotMove.push({ what: autopsy.unknownCount + " opportunit" + (autopsy.unknownCount === 1 ? "y" : "ies") +
      " lost with no recorded reason", source: autopsy.schema });
  }
  if (capacity && capacity.verdict === "not-enough-data") {
    didNotMove.push({ what: "Delivery capacity is still unmeasurable - " + capacity.headline, source: capacity.schema });
  }

  const waitingOnOneClick = board && Array.isArray(board.blockedOnAhmad) ? board.blockedOnAhmad.slice() : [];

  const nothingMoved = moved.length === 0;
  // A week is EMPTY only when there is nothing real to report at all. A week where nothing moved but
  // staged work is still sitting there is not empty - it moved nothing, and it says both.
  const empty = nothingMoved && didNotMove.length === 0 && waitingOnOneClick.length === 0;
  const action = empty ? { action: ACTION_NONE, source: null } : highestValueAction({ board, autopsy, capacity });

  return {
    schema: DIGEST_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    weekStart: new Date(now - weekMs).toISOString(),
    moneyInCad,
    payments,
    moved,
    didNotMove,
    waitingOnOneClick,
    action,
    nothingMoved,
    empty,
    inputs: {
      board: !!board, autopsy: !!autopsy, capacity: !!capacity,
    },
  };
}

// -- 4. Sixty seconds ------------------------------------------------------------------------------------
export function weeklyDigestMarkdown(digest) {
  if (!digest || digest.schema !== DIGEST_SCHEMA) return "No weekly digest.";
  const out = [];
  out.push("# Weekly truth digest");
  out.push("");
  out.push("Week of " + digest.weekStart.slice(0, 10) + " to " + digest.generatedAt.slice(0, 10) + ".");
  out.push("");
  out.push("**Real money in this week: CAD $" + digest.moneyInCad + "**");

  if (digest.empty) {
    out.push("");
    out.push(NOTHING_MOVED);
    out.push("");
    out.push(NOTHING_MOVED_NOTE);
    return out.join("\n");
  }

  if (digest.nothingMoved) {
    out.push("");
    out.push(NOTHING_MOVED);
  } else {
    out.push("");
    out.push("## What moved");
    for (const m of digest.moved) out.push("- " + m.what + (m.source ? " (" + m.source + ")" : ""));
  }

  out.push("");
  out.push("## What did not");
  if (digest.didNotMove.length === 0) out.push("Nothing outstanding was recorded.");
  else for (const d of digest.didNotMove) out.push("- " + d.what + (d.source ? " (" + d.source + ")" : ""));

  if (digest.waitingOnOneClick.length > 0) {
    out.push("");
    out.push("## Waiting on one click");
    for (const b of digest.waitingOnOneClick) out.push("- " + b.item + " - " + b.why);
  }

  out.push("");
  out.push("## The one thing worth doing");
  out.push(digest.action.action + (digest.action.source ? " (" + digest.action.source + ")" : ""));
  return out.join("\n");
}
