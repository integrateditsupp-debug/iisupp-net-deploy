// the-hour.mjs — RUN-X X2: THE HOUR, MADE EXECUTABLE WITHOUT READING ANYTHING FIRST.
//
// WHY (RUN-X, 2026-07-29): the one remaining human action in this program is not complicated, it is
// BURIED. To send the second message today an operator would have to open a ranked queue module, a
// drafting module, a record, and a ledger entry, and reconstruct which route ranks where and why. An
// ask that takes twenty minutes to understand does not get taken. That is a design failure on our side,
// not a discipline failure on his.
//
// X2 collapses the entire remaining action into ONE self-contained artefact: for each reachable warm
// route, in rank order — the route class, the exact drafted body, and the one-line reason it ranks
// there. No prior context required. Closed windows are listed separately as recorded losses with dates.
//
// Honesty invariants (Rule 14) + vault Rule 11:
//   - NO IDENTITY, EVER. Opaque handles only. A test greps the rendered artefact for an address or a
//     domain and fails on a hit. The operator resolves a handle in his own mail/CRM, never here.
//   - NO INTERNAL PATHS, NO BRANCH NAMES, NO SCRIPT NAMES. The artefact is for a human with a mailbox,
//     not for an engineer with a repo. A test asserts none leak in.
//   - CLOSED WINDOWS ARE NEVER RE-RANKED AS LIVE and never quietly removed. They render in their own
//     section with the date they closed.
//   - ONE SITTING. The live action list is capped at ONE_SITTING_MAX. If more routes are reachable than
//     that, the artefact says so plainly and carries the top N — it never silently truncates.
//   - NOTHING HERE SENDS. Pure. No fs, no net, no transport. The artefact is text a human acts on.
//   - ADDITIVE (Rule 15). New surface; replaces nothing.

import { draftSecondMessage } from "./second-message.mjs";

export const THE_HOUR_SCHEMA = "the-hour.v1";

// Belt-and-braces, asserted by the test.
export const SENDS = false;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;
export const READS_IDENTITY = false;

/** What one operator can realistically do in a single sitting without it becoming a project. */
export const ONE_SITTING_MAX = 8;

export const COLD_START_NOTE =
  "This artefact is executable cold. It requires no prior reading: every action below carries its own " +
  "reason and its own message body.";

const CARRIES_IDENTITY = (s) => /@|\.(com|ca|net|org|gov|io|co)\b/i.test(String(s || ""));

/** Things that must never appear in an operator-facing artefact. */
export const LEAK_PATTERNS = Object.freeze([
  /senior-director-state/i,
  /ARIA Sentinel/i,
  /\.mjs\b/i,
  /\.cmd\b/i,
  /\bcc\/[a-z0-9-]/i,
  /origin\/main/i,
  /[A-Z]:\\/,
  /_staged-cc-runs/i,
]);

/** Plain-English reason a route sits where it sits. Built from the route's own recorded facts. */
function rankReason(route, index) {
  if (route.datePassed) {
    return `#${index + 1} — the date this prospect gave for their own return has already passed. ` +
           `They are reachable now and were reachable before now.`;
  }
  if (route.reachableNow) {
    return `#${index + 1} — this prospect's own auto-reply handed back a route and gave no date to wait for. ` +
           `Reachable now.`;
  }
  return `#${index + 1} — this prospect stated they are back on a future date. Not yet reachable; listed so ` +
         `it is not forgotten when it opens.`;
}

const MODE_ACTION = Object.freeze({
  email: "Send this as an email reply on the existing thread.",
  phone: "This route is a phone line, not an email. Call it — do not send this as mail.",
  unknown: "Route mode was never stated by the prospect. Confirm the route in your own mail before acting.",
});

/**
 * Build the hour.
 * @param input.warm  a queue built by buildWarmRedirectQueue (V1)
 * @param opts.now    clock
 */
export function buildTheHour(input = {}, { now = Date.now() } = {}) {
  const nowMs = typeof now === "number" ? now : Date.parse(now);
  const warm = input?.warm;
  const sourced = !!(warm && Array.isArray(warm.queue) && Array.isArray(warm.expired));

  const actions = [];
  const refused = [];
  const notYetOpen = [];

  const live = sourced ? warm.queue : [];
  const reachable = live.filter((r) => r.reachableNow);
  const future = live.filter((r) => !r.reachableNow);

  reachable.forEach((route, i) => {
    const d = draftSecondMessage(route);
    if (!d.ok) {
      refused.push(Object.freeze({ handle: route.handle, refused: d.refused, reasons: d.reasons }));
      return;
    }
    actions.push(Object.freeze({
      rank: actions.length + 1,
      handle: route.handle,
      routeClass: route.routeClass,
      mode: route.mode,
      modeAction: MODE_ACTION[route.mode] || MODE_ACTION.unknown,
      why: rankReason(route, i),
      body: d.draft.body,
    }));
  });

  future.forEach((route, i) => {
    notYetOpen.push(Object.freeze({
      handle: route.handle,
      routeClass: route.routeClass,
      mode: route.mode,
      opensOn: route.replyPossibleFrom,
      why: rankReason(route, i),
    }));
  });

  const overflow = Math.max(0, actions.length - ONE_SITTING_MAX);
  const thisSitting = Object.freeze(actions.slice(0, ONE_SITTING_MAX));

  const closed = Object.freeze(
    (sourced ? warm.expired : []).map((e) =>
      Object.freeze({
        handle: e.handle,
        routeClass: e.routeClass,
        closedOn: e.expiredOn,
        recordedAs: "a loss. This window was opened by a prospect and closed before it was used.",
      })
    )
  );

  return Object.freeze({
    schema: THE_HOUR_SCHEMA,
    builtAt: new Date(nowMs).toISOString(),
    sourced,
    actions: thisSitting,
    actionsTotalReachable: actions.length,
    overflow,
    notYetOpen: Object.freeze(notYetOpen),
    closed,
    refused: Object.freeze(refused),
    oneSittingMax: ONE_SITTING_MAX,
    coldStartNote: COLD_START_NOTE,
    sendIs: "a human click. Nothing in this program can send, and a static scan of the drafting module proves it.",
  });
}

/** Render the artefact as the operator will actually read it. This is the thing that gets acted on. */
export function renderHour(h) {
  const L = [];
  L.push("# THE HOUR — do these in order. Nothing to read first.");
  L.push("");
  L.push(h.coldStartNote);
  L.push("");
  if (!h.sourced) {
    L.push("No warm-route record was supplied, so there is no action list. This is stated rather than rendered as an empty hour.");
    return L.join("\n");
  }
  if (h.actions.length === 0) {
    L.push("No route is reachable right now. Nothing to do this sitting — stated plainly, not padded.");
  } else {
    L.push(`${h.actions.length} action${h.actions.length === 1 ? "" : "s"} this sitting.` +
      (h.overflow > 0
        ? ` ${h.actionsTotalReachable} routes are reachable in total; the ${h.overflow} beyond this sitting are held for the next one, not dropped.`
        : ""));
    L.push("");
    for (const a of h.actions) {
      L.push(`## ${a.rank}. ${a.handle}  (${a.routeClass})`);
      L.push(a.why);
      L.push(a.modeAction);
      L.push("");
      L.push("Message:");
      L.push("```");
      L.push(a.body);
      L.push("```");
      L.push("");
    }
  }
  if (h.notYetOpen.length) {
    L.push("## Not open yet — do not act on these");
    for (const r of h.notYetOpen) {
      L.push(`- ${r.handle} (${r.routeClass}) — the prospect stated they are back on ${r.opensOn}.`);
    }
    L.push("");
  }
  if (h.closed.length) {
    L.push("## Closed windows — recorded losses, listed so they are not forgotten");
    for (const c of h.closed) {
      L.push(`- ${c.handle} (${c.routeClass}) — closed ${c.closedOn}. ${c.recordedAs}`);
    }
    L.push("");
  }
  if (h.refused.length) {
    L.push("## Refused drafts — shown, never silently dropped");
    for (const r of h.refused) {
      L.push(`- ${r.handle}: ${r.refused} — ${(r.reasons || []).join("; ")}`);
    }
    L.push("");
  }
  L.push(`Sending is ${h.sendIs}`);
  return L.join("\n");
}

/** Findings, not a boolean: everything in the rendered artefact that should not be there. */
export function hourLeaks(h) {
  const text = renderHour(h);
  const found = [];
  if (CARRIES_IDENTITY(text)) found.push("rendered artefact carries an address or a domain (vault Rule 11)");
  for (const p of LEAK_PATTERNS) {
    if (p.test(text)) found.push(`rendered artefact carries an internal reference matching ${p}`);
  }
  return Object.freeze(found);
}

/** True only when the sitting is genuinely completable in one go. */
export function fitsOneSitting(h) {
  return h.actions.length <= ONE_SITTING_MAX;
}
