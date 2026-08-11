// churn-signals.mjs — RUN-AZ / AZ1. WHAT THIS COMPANY COULD NOTICE, AND WHAT IT CANNOT.
//
// AY2 proved the response times this company PROMISES disagree across surfaces. It never asked the
// prior question: if a promise were missed, or if a customer who wrote every week wrote nothing for
// three, is there anything on this machine that could TELL us?
//
// A missed response time is the worst class of breach a services company can have, because it is
// breached SILENTLY — by nobody doing anything. There is no error, no exception, no failed request.
// The only party who reliably notices is the customer, and the way they tell you is by not renewing.
//
// THE FOUR STATES, and why there are four rather than two:
//
//   A binary present/absent would report this environment as far healthier than it is, because the
//   interesting failures live in the middle.
//
//   OBSERVABLE       an event of this kind is RETAINED by something in the shared line, and something
//                    in the shared line READS it back. Both halves, or the question cannot be asked.
//   RETAINED-UNREAD  the event is stored and nothing ever asks. This is not a win rounded down — it is
//                    the cheapest gap in the list to close, and calling it "observable" would hide the
//                    only class where the data already exists.
//   TRANSIENT        a code path RECEIVES the event and retains nothing: it emails, logs to a console
//                    nobody keeps, and returns 200. An event that was handled is not an event that was
//                    recorded, and three weeks later it cannot be counted.
//   UNSOURCED        nothing in the shared line receives it at all.
//
// WHAT THIS MODULE REFUSES TO DO:
//
//   It does not compute a health score, a churn risk, or an engagement percentage. Every one of those
//   would be a number derived from signals this file is about to prove we do not have — a fabricated
//   metric with a chart on it, which is the exact failure Rule 14 forbids. The output of this module
//   is a list of questions and whether each is answerable. Nothing more, deliberately.
//
//   It does not close a gap by inventing a dashboard. UNSOURCED is a legitimate terminal state.
//
// WIRED TO AY2: every support commitment in `support-commitments.mjs` must be claimed by exactly one
// signal here. A promise this company makes that no signal covers is reported BY NAME, so what we
// promise and what we could observe cannot drift apart cycle over cycle.
//
// This module reads. It sends nothing, stores nothing, and contacts no customer.

import { execFileSync } from "node:child_process";
import { COMMITMENTS } from "./support-commitments.mjs";
import { readDeclarations } from "./pack-answer-consistency.mjs";

export const CHURN_SIGNAL_SCHEMA = "churn-signals/1";

/**
 * Where a promise nothing can observe is acknowledged.
 *
 * AV2's third state, applied to observability. The two moves a naive gate offers — build a signal, or
 * stop making the promise — are both wrong for a commitment like a post-incident review, which is
 * kept by a person writing a document and should be. A commitment may therefore be DECLARED here
 * with a reason a person wrote and a named decider. Undeclared is the only state that goes red.
 *
 * Kept separate from SUPPORT-COMMITMENT-CONFLICTS.md: that register is about promises that disagree
 * with each other, this one about promises nothing can measure. They are closed by different work.
 */
export const OBSERVABILITY_REGISTER = "docs/OBSERVABILITY-GAPS.md";

export const SIGNAL = Object.freeze({
  OBSERVABLE: "observable",
  RETAINED_UNREAD: "retained-unread",
  TRANSIENT: "transient",
  UNSOURCED: "unsourced",
  UNREADABLE: "unreadable",
});

/**
 * The questions somebody would have to answer to know a paying customer is in trouble.
 *
 * `receivers` names the files in the shared line that would have to carry the event. They are NOT
 * assumed to store anything — whether each retains or merely receives is read out of its bytes at
 * HEAD, so a function that stops persisting tomorrow moves this report by itself.
 *
 * `commitments` claims the AY2 commitment ids whose breach this signal would surface.
 */
export const CHURN_SIGNALS = [
  {
    id: "support-route-went-quiet",
    question: "Has a customer who used to raise problems stopped raising them?",
    who: "the customer who gave up asking, and has not told anybody they gave up",
    costs:
      "silence reads as satisfaction and is the single most common thing it is not; by the time a " +
      "quiet customer speaks again it is usually to decline the renewal",
    receivers: [
      "netlify/functions/aria-session.mjs",
      "netlify/functions/aperture-tickets.mjs",
      "netlify/functions/support.mts",
    ],
    commitments: [],
  },
  {
    id: "response-window-missed",
    question: "Did we answer a P1 or a P2 inside the window the contract promises?",
    who: "the customer with production down, holding a contract that names a number",
    costs:
      "this is the only commitment in the pack that is breached by nobody doing anything — there is " +
      "no error to catch, so a missed window is invisible unless the arrival and the reply are both " +
      "stamped and kept",
    receivers: [
      "netlify/functions/aria-session.mjs",
      "netlify/functions/aria-session-end.mjs",
      "netlify/functions/aperture-tickets.mjs",
    ],
    commitments: ["p1-response-enterprise", "p2-response-enterprise"],
  },
  {
    id: "breach-notification-clock",
    question: "If a breach were confirmed today, could we prove when each customer was told?",
    who: "every customer, and every regulator standing behind them",
    costs:
      "a notification window is only a commitment if the moment of notice is recorded; an email " +
      "somebody remembers sending is not evidence",
    receivers: [],
    commitments: ["breach-notification-window"],
  },
  {
    id: "invoice-unanswered",
    question: "Has an invoice gone out and not been paid?",
    who: "a one-person company whose runway is the sum of its receivables",
    costs:
      "an unpaid invoice is the earliest hard signal of a customer leaving, and it is the one signal " +
      "that arrives as a real event rather than as an absence",
    receivers: [
      "netlify/functions/stripe-webhook.js",
      "netlify/functions/sentinel-stripe-webhook.mjs",
      "netlify/functions/aria-stripe-pilot-events.js",
    ],
    commitments: [],
  },
  {
    id: "login-stopped-happening",
    question: "Has a customer's team stopped signing in to the thing they are paying for?",
    who: "the buyer who will be asked to justify the line item at renewal",
    costs:
      "usage falling to zero months before a renewal is the clearest early warning a SaaS product " +
      "can have, and it only exists if sign-ins are stamped and kept",
    receivers: [
      "netlify/functions/aperture-auth.mjs",
      "netlify/functions/aperture-session.mjs",
      "netlify/functions/aria-admin-auth.js",
    ],
    commitments: [],
  },
  {
    id: "term-ending-unnoticed",
    question: "Is a customer's term about to end, and does anybody know before it does?",
    who: "the customer who auto-renews without being asked, and the founder who never had the conversation",
    costs:
      "the MSA auto-renews unless somebody gives 30 days' notice; a renewal that happens by silence " +
      "is a renewal nobody was able to sell into",
    receivers: [],
    commitments: [],
  },
  {
    id: "onboarding-stalled",
    question: "Did a customer who paid ever finish setting up?",
    who: "the customer who bought, hit a wall in week one, and quietly never came back",
    costs:
      "a customer who never reached first value churns at the first renewal with nothing to point " +
      "at, and week one is the only time the fix is cheap",
    receivers: ["netlify/functions/aria-contact-back.mjs", "netlify/functions/aria-session.mjs"],
    commitments: [],
  },
];

/** The bytes HEAD carries for one path — the bytes a clone would receive, not the bytes on disk. */
function headBytes(root, rel) {
  try {
    return execFileSync("git", ["show", `HEAD:${rel}`], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
  } catch {
    return null;
  }
}

const STORE_NAME = /getStore\(\s*\{[^}]*name:\s*['"`]([a-z0-9._-]+)['"`]/gi;
// A write. `.set(` and `.setJSON(` on a store handle are the only two ways this codebase persists.
const RETAINS = /\.(setJSON|set)\s*\(/;
// A read of something previously written. `.list(` is included because listing is how a question
// about ABSENCE gets asked — "what is there" is the only shape of query that can find silence.
const READS = /\.(getJSON|getWithMetadata|list|get)\s*\(/;

/**
 * Read one receiver out of HEAD and state what it does with the event, without believing its name.
 */
export function inspectReceiver(rel, { root = process.cwd(), bytes = null } = {}) {
  const src = bytes === null ? headBytes(root, rel) : bytes;
  if (src === null) {
    return { file: rel, present: false, retains: false, reads: false, stores: [] };
  }
  const stores = [];
  STORE_NAME.lastIndex = 0;
  let m;
  while ((m = STORE_NAME.exec(src)) !== null) stores.push(m[1]);
  return {
    file: rel,
    present: true,
    // A store handle is required. A `.set(` on a Map or a Set is not persistence, and matching it
    // would report this environment as observing things it forgets the moment the function returns.
    retains: stores.length > 0 && RETAINS.test(src),
    reads: stores.length > 0 && READS.test(src),
    stores: [...new Set(stores)],
  };
}

/** One signal, resolved against what the shared line actually does with the event. */
export function auditSignal(signal, { root = process.cwd(), cache = new Map() } = {}) {
  const receivers = (signal.receivers || []).map((rel) => {
    if (!cache.has(rel)) cache.set(rel, inspectReceiver(rel, { root }));
    return cache.get(rel);
  });

  const present = receivers.filter((r) => r.present);
  const retaining = present.filter((r) => r.retains);
  // The read need not live in the same file that wrote it — a listing endpoint reading a store some
  // other function fills is exactly the shape that answers a question about silence.
  const retainedStores = new Set(retaining.flatMap((r) => r.stores));
  const readingSomethingRetained = present.filter(
    (r) => r.reads && r.stores.some((s) => retainedStores.has(s)),
  );

  let state;
  let why;
  if (present.length === 0) {
    state = SIGNAL.UNSOURCED;
    why =
      (signal.receivers || []).length === 0
        ? "nothing in the shared line receives this event: no file has ever been named for it"
        : `every named receiver is absent from HEAD's tree: ${(signal.receivers || []).join(", ")}`;
  } else if (retaining.length === 0) {
    state = SIGNAL.TRANSIENT;
    why =
      `${present.map((r) => r.file).join(", ")} receives this event and retains nothing — it is ` +
      "handled and forgotten, so it cannot be counted three weeks later";
  } else if (readingSomethingRetained.length === 0) {
    state = SIGNAL.RETAINED_UNREAD;
    why =
      `${retaining.map((r) => r.file).join(", ")} stores this event in ` +
      `${[...retainedStores].join(", ")} and nothing in the shared line reads it back for this ` +
      "question — the data exists and nobody asks";
  } else {
    state = SIGNAL.OBSERVABLE;
    why = null;
  }

  return {
    id: signal.id,
    question: signal.question,
    who: signal.who,
    costs: signal.costs,
    state,
    why,
    commitments: [...(signal.commitments || [])],
    receivers,
    retainedBy: retaining.map((r) => r.file),
    readBy: readingSomethingRetained.map((r) => r.file),
    stores: [...retainedStores],
  };
}

/**
 * Every churn signal, plus the AY2 invariant: what we promise and what we can observe cannot drift.
 *
 * Deliberately returns no score. There is no health number here and there will not be one until the
 * signals underneath it are real.
 */
export function auditChurnSignals({
  root = process.cwd(),
  signals = CHURN_SIGNALS,
  commitments = COMMITMENTS,
  registerFile = OBSERVABILITY_REGISTER,
} = {}) {
  const cache = new Map();
  const audited = signals.map((s) => auditSignal(s, { root, cache }));

  const claimed = new Map();
  for (const a of audited) {
    for (const c of a.commitments) {
      claimed.set(c, [...(claimed.get(c) || []), a.id]);
    }
  }

  const known = new Set(commitments.map((c) => c.id));
  const reg = readDeclarations({ root, file: registerFile });

  // A commitment nobody claims is a promise with no way of knowing it was kept. It may be DECLARED
  // with a reason; what it may not be is silent.
  const unclaimed = commitments.filter((c) => !claimed.has(c.id)).map((c) => c.id);
  const unclaimedCommitments = unclaimed.filter((id) => !reg.declarations.has(id));
  const declaredUnobservable = unclaimed.filter((id) => reg.declarations.has(id));
  // A declaration for a commitment a signal now covers has rotted. A register that rots reads as
  // diligence and is worse than none.
  const staleDeclarations = [...reg.declarations.values()]
    .filter((d) => !unclaimed.includes(d.topic))
    .map((d) => d.topic);
  // A signal claiming a commitment that no longer exists is a mapping that has rotted. Silence here
  // would let a commitment be renamed and the coverage number stay green over nothing.
  const danglingClaims = [...claimed.keys()].filter((id) => !known.has(id));
  // Two signals claiming one commitment is not coverage, it is an unowned promise wearing two hats.
  const doubleClaimed = [...claimed.entries()].filter(([, ids]) => ids.length > 1).map(([id]) => id);

  const n = (st) => audited.filter((a) => a.state === st).length;

  return {
    schema: CHURN_SIGNAL_SCHEMA,
    // Stated in the output rather than only in a comment, because the absence of a score is the
    // deliberate part and a later reader should not have to take it on trust.
    scoreComputed: false,
    engagementMetricInvented: false,
    sent: false,
    stored: false,
    signals: audited,
    coverage: {
      commitmentsTotal: commitments.length,
      commitmentsClaimed: commitments.length - unclaimed.length,
      unclaimedCommitments,
      declaredUnobservable,
      staleDeclarations,
      refusedDeclarations: reg.refused,
      registerPresent: reg.present,
      danglingClaims,
      doubleClaimed,
    },
    summary: {
      total: audited.length,
      observable: n(SIGNAL.OBSERVABLE),
      retainedUnread: n(SIGNAL.RETAINED_UNREAD),
      transient: n(SIGNAL.TRANSIENT),
      unsourced: n(SIGNAL.UNSOURCED),
      // `ok` is about the INTEGRITY of this report, not about the health of the company. A tree where
      // every signal is UNSOURCED is a true report and passes; a tree where a promise is unmapped or
      // a mapping has rotted is a report that cannot be trusted and fails.
      ok:
        unclaimedCommitments.length === 0 &&
        staleDeclarations.length === 0 &&
        reg.refused.length === 0 &&
        danglingClaims.length === 0 &&
        doubleClaimed.length === 0 &&
        audited.every((a) => a.state !== SIGNAL.OBSERVABLE || a.why === null),
    },
  };
}

export function statementFor(result) {
  const s = result.summary;
  return (
    `${s.observable} of ${s.total} churn signals are observable end to end; ` +
    `${s.retainedUnread} are stored and never read; ${s.transient} are received and retained by ` +
    `nothing; ${s.unsourced} have no source at all. No health score is computed, deliberately`
  );
}

export default {
  auditChurnSignals,
  auditSignal,
  inspectReceiver,
  statementFor,
  CHURN_SIGNALS,
  SIGNAL,
  CHURN_SIGNAL_SCHEMA,
};
