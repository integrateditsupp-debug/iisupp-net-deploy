// needs-ahmad-staged.mjs — the staged one-click actions, in ONE place, each declaring its artefact.
//
// RUN-AJ / AJ1. This list used to live inline inside the status emitter, where an item could assert
// "drafted and awaiting one click" with nothing on disk behind it — and for fourteen days one did.
// It is now a tracked module with a schema every entry must satisfy:
//
//   artefact:   repo-relative path to the readable thing the click operates on. Must exist, be a
//               file, and be non-empty. Verified by staged-action-guard.mjs.
//   noArtefact: used INSTEAD of artefact, and only when the action genuinely has no object — an
//               action taken in someone else's interface. The reason is stated, not implied.
//
// Declaring neither is a failure. Declaring both is a failure. Writing prose that claims a drafted
// or rendered thing while declaring noArtefact is a failure, by name.
//
// RUN-AN / AN2 adds two more required fields, because for three cycles this list was presented as
// four equals and it never was four equals:
//
//   rank:            where the item sits. A positive integer, unique across the list. The renderer
//                    and the emitter both read RANK order, never the order these happen to be typed.
//   unblocks:        what the click actually buys, in plain words.
//   blockedWithout:  the honest other half — what stays stuck if it is skipped. A priority stated
//                    without its cost of omission is a preference, not a priority.
//
// No invented probabilities, no invented dollar figures. Rank is an argued ordering, and the
// argument is written down beside it so it can be disagreed with.
export const NEEDS_AHMAD_SCHEMA = "needs-ahmad-staged.v2";

export const needsAhmadStaged = [
  {
    item: "Send the twelve second messages",
    what:
      "Ten emails and two call scripts, keyed by opaque handle to routes the prospects supplied " +
      "themselves. Roughly twenty minutes of copy and paste.",
    why:
      "The only item on this list that can move a business number. Until these go out the offer stays " +
      "untested: 124 cycles of build have never produced a second touch, and a cold sequence produces " +
      "most of its replies on touches two through four.",
    artefact: "senior-director-state/outbound/SEND-SHEET-2026-08-05.md",
    rank: 1,
    unblocks:
      "The only thing on this list that can produce a reply, a meeting, or a first dollar. Every other " +
      "item moves code or infrastructure; this one moves the business.",
    blockedWithout:
      "The offer stays untested indefinitely. Revenue, meetings and replies all stay at zero no matter " +
      "how many cycles run, because nothing else here can move them.",
  },
  {
    item: "Decide which price list the Sentinel sales one-pager carries",
    what:
      "Five rows. The one-pager quotes Personal $599/mo, Pro $1,500/mo, Small Business $156K/yr, " +
      "Mid-Size $312K/yr and Enterprise $625K/yr. The published plan page quotes $899, $2,250, " +
      "$19,500/mo, $39,000/mo and $78,125/mo for plans with the SAME NAMES. Either the desktop " +
      "product has its own price list and the plan names must stop colliding, or the sheet is stale.",
    why:
      "This is the document a prospect is handed during the exact conversation the twelve messages " +
      "above are trying to start. A prospect who reads $599 and is later quoted $899 has caught this " +
      "company changing its price mid-conversation, and no amount of honest engineering elsewhere " +
      "recovers that. Software may not pick: a second price for a same-named plan is a decision.",
    artefact: "ARIA Sentinel/sales/ARIA-Sentinel-Sales-One-Pager.md",
    rank: 2,
    unblocks:
      "Makes the sales conversation the twelve messages are meant to create survive contact with the " +
      "plan page. Once decided, `tests/quoted-figures.test.mjs` holds both surfaces to it.",
    blockedWithout:
      "Every reply the twelve messages produce walks into a document that contradicts the website on " +
      "all five plans.",
  },
  {
    item: "Name the currency this company charges in",
    what:
      "One word: CAD or USD. Seven surfaces on the money path declare a currency and two of them say " +
      "CAD while five say USD — including the renewal email a paying customer receives (USD) and the " +
      "inline charge path that would bill their card (CAD).",
    why:
      "Telling a customer an amount in one currency and charging their card in another is a chargeback " +
      "and a credibility problem in the same message. Nobody has been charged yet, which is exactly " +
      "why this is cheap to fix today and expensive to fix after the first invoice.",
    noArtefact:
      "A currency is a decision, not a document. There is nothing to prepare on disk: naming one " +
      "writes `senior-director-state/decisions/currency.json`, and from that moment " +
      "`tests/currency-consistency.test.mjs` enforces it on every surface and goes red on any drift. " +
      "Writing that file with a guessed currency would be software making a decision about money.",
    rank: 3,
    unblocks:
      "Turns the currency audit from a report into an enforced invariant, and lets the two off-direction " +
      "surfaces be corrected in one pass.",
    blockedWithout:
      "The split stays reported and unresolved, and the first real charge decides it by accident.",
  },
  {
    item: "Push the shared line to the code host",
    what: "One push of the shared branch, every commit on it verified against a green full registry.",
    why:
      "The build sandbox holds no code-host credential and that refusal was reproduced against the real " +
      "remote again this cycle. This is the only thing between verified work and the shared host.",
    artefact: "AHMAD-ONE-CLICK.cmd",
    rank: 5,
    unblocks:
      "Moves every verified commit onto the shared host, where it can be deployed and where a second " +
      "machine can see it. Prerequisite for publishing.",
    blockedWithout:
      "The verified line keeps growing on one machine only — a single-disk failure loses it, and the " +
      "publish below cannot happen at all.",
  },
  {
    item: "A code-hosting credential for the build sandbox",
    what: "A credential or a code-host connector attached to this environment.",
    why:
      "It would retire the push above permanently instead of re-staging it every cycle. Highest leverage " +
      "item here that is not a conversation.",
    noArtefact:
      "Nothing can be prepared on disk for this. It is a credential granted in someone else's account " +
      "settings, and an agent must never hold or create one.",
    rank: 4,
    unblocks:
      "Retires the push above permanently instead of re-staging it every cycle. It is the only item " +
      "here that removes another item from this list rather than adding a click to it.",
    blockedWithout:
      "The push stays a manual step, re-staged and re-explained every single cycle, forever. Nineteen " +
      "cycles of that have already happened.",
  },
  {
    item: "Publish the site",
    what: "One deliberate operator action in the hosting dashboard.",
    why:
      "Landing a branch never deploys. This stays a separate human decision, and it is the action that " +
      "starts the visit log recording — until it happens the passive signal reads not-yet-collecting " +
      "rather than zero.",
    noArtefact:
      "A publish is a button in the hosting provider's own interface. There is no local object for it, " +
      "and staging one would be theatre.",
    rank: 6,
    unblocks:
      "Starts the visit log recording, which is the only path to a passive signal that does not depend " +
      "on anyone answering a message.",
    blockedWithout:
      "The passive signal reads not-yet-collecting rather than zero — honest, and worth nothing. No " +
      "prospect can reach the site at all.",
  },
];

export default needsAhmadStaged;
