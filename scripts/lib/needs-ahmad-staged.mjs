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
export const NEEDS_AHMAD_SCHEMA = "needs-ahmad-staged.v1";

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
  },
  {
    item: "Push the shared line to the code host",
    what: "One push of the shared branch, every commit on it verified against a green full registry.",
    why:
      "The build sandbox holds no code-host credential and that refusal was reproduced against the real " +
      "remote again this cycle. This is the only thing between verified work and the shared host.",
    artefact: "AHMAD-ONE-CLICK.cmd",
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
  },
];

export default needsAhmadStaged;
