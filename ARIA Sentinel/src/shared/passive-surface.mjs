// passive-surface.mjs — RUN-AB AB2: THE ONE CHANNEL THAT DOES NOT NEED AN HOUR, HONESTLY MEASURED OR
// HONESTLY REFUSED.
//
// WHY (RUN-AB, 2026-07-29): the live site is the only surface in this program that can, in principle,
// produce something while nobody is working. If any number in this whole program can move without a human
// hour, it is here. That makes this exactly the module most likely to invent one.
//
// So the design rule is inverted from every other module: this one is built to REFUSE first. It enumerates
// every passive signal by name, states for each whether it is observable from a record this program can
// reach without payment, and if the honest answer across the board is "none", that refusal IS the output —
// rendered as the primary line, dated, with precisely what would make a signal measurable.
//
// Honesty invariants (Rule 14):
//   - A SIGNAL THAT CANNOT BE OBSERVED IS NAMED AND MARKED `not measurable here`. It is never omitted.
//     Omission is how a dashboard ends up showing only its good numbers.
//   - NO PROXY, EVER. Deploy counts, build counts, page counts, sitemap size, uptime, and "the site is up"
//     are explicitly listed as FORBIDDEN PROXIES and a test asserts none of them can be promoted into a
//     passive signal. A site being up is not a visit.
//   - IF NOTHING IS MEASURABLE, THAT IS THE PRIMARY OUTPUT. Not a footnote, not a caveat under a chart.
//     The first rendered line says it, with the date.
//   - THE UNBLOCK IS STATED CONCRETELY. "Here is precisely what would make one measurable" is a named,
//     free, specific action — not "add analytics".
//   - NO IDENTITY (vault Rule 11). No visitor, address or referrer identity of any kind.
//   - PURE + ADDITIVE (Rule 15). No fs, no net, no transport, no persistence. This module cannot fetch
//     the site and does not pretend to.

export const PASSIVE_SURFACE_SCHEMA = "passive-surface.v1";

export const SENDS = false;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;
export const READS_IDENTITY = false;
export const FETCHES = false;

export const NOT_MEASURABLE = "not measurable here";
export const MEASURABLE = "measurable";
export const UNVERIFIED = "unverified";

export const REFUSAL_HEADLINE =
  "No passive signal is measurable today. Nothing on the live site is currently producing a number this " +
  "program can read.";

export const REFUSAL_NOTE =
  "This is a refusal, not a zero. A zero would claim the site was measured and produced nothing. The site " +
  "has not been measured, because no record this program can reach without payment carries site traffic.";

export const NO_PROXY_NOTE =
  "A passive signal must be an observation of someone outside this company doing something. Deploys, " +
  "builds, pages shipped, sitemap entries, uptime and the site being reachable are none of those. They " +
  "measure our own activity and are refused as proxies at the door.";

/** Anything on this list can never be promoted into a passive signal. Asserted by test. */
export const FORBIDDEN_PROXIES = Object.freeze([
  "deploys", "builds", "commits", "merges", "pagesShipped", "sitemapEntries", "uptime",
  "siteReachable", "lighthouseScore", "testsGreen", "sequencesCompleted", "modulesBuilt",
  "wordCount", "linesOfCode", "featuresShipped",
]);

/**
 * Every passive signal, named. `observable` is the honest answer for THIS program, today, free-only.
 * A signal is only `measurable` when a named record this program can already reach carries it.
 */
export const SIGNAL_CATALOGUE = Object.freeze([
  Object.freeze({
    id: "site-visits",
    label: "Visits to iisupp.net",
    observable: false,
    why: "No traffic record exists that this program can read. The host's own analytics are not in the repo and are not reachable from the build sandbox.",
    whatWouldMakeItMeasurable: "A free, self-hosted hit log written by the site itself into a file this repo can read. No account, no purchase, no third party.",
  }),
  Object.freeze({
    id: "unique-visitors",
    label: "Distinct people reaching the site",
    observable: false,
    why: "Requires a traffic record that does not exist here, and distinctness requires per-visitor state this program deliberately does not keep (Rule 11).",
    whatWouldMakeItMeasurable: "Nothing free and Rule-11-clean currently provides this. Stated as unavailable rather than approximated.",
  }),
  Object.freeze({
    id: "referrers",
    label: "Where a visit came from",
    observable: false,
    why: "Same missing traffic record. A referrer cannot be inferred from anything in the repo.",
    whatWouldMakeItMeasurable: "The same self-hosted hit log, if it recorded a referrer field.",
  }),
  Object.freeze({
    id: "search-impressions",
    label: "Times the site appeared in a search result",
    observable: false,
    why: "Held by the search engine, behind an account this program does not have and may not create.",
    whatWouldMakeItMeasurable: "An operator-created search-console property. Account creation is Ahmad's click, not this program's.",
  }),
  Object.freeze({
    id: "form-submissions",
    label: "Someone filling in a form on the site",
    observable: false,
    why: "A submission would arrive as mail. No submission has been observed in the mail record read this cycle, and absence of observation is not a measured zero.",
    whatWouldMakeItMeasurable: "Already almost measurable: the mail record is read every cycle. It needs one named, distinguishable subject line so a submission can be told apart from ordinary mail.",
  }),
  Object.freeze({
    id: "inbound-mail",
    label: "Mail arriving that we did not solicit",
    observable: false,
    why: "The mail record read this cycle carries outbound and its responses. It does not distinguish unsolicited inbound from a reply to something we sent.",
    whatWouldMakeItMeasurable: "One extra event kind in the outbound record: an arrival with no prior send against the same handle. Free, and inside a record this program already reads.",
  }),
  Object.freeze({
    id: "trial-starts",
    label: "Somebody starting an ARIA trial",
    observable: false,
    why: "No trial record is present in this repo. The absence of a record is not an observation of zero trials.",
    whatWouldMakeItMeasurable: "A trial start writing one dated, identity-free line into a file this repo reads.",
  }),
]);

/**
 * Assess the passive surface. Signals are only ever `measurable` when a named reachable record is
 * supplied for them; the default state of this module is refusal.
 */
export function assessPassiveSurface({ now, reachableRecords } = {}) {
  const at = typeof now === "string" && now.trim() ? now : null;
  const reachable = new Set(Array.isArray(reachableRecords) ? reachableRecords.filter((r) => typeof r === "string") : []);

  const signals = SIGNAL_CATALOGUE.map((s) => {
    const backed = reachable.has(s.id);
    return Object.freeze({
      id: s.id,
      label: s.label,
      state: backed ? MEASURABLE : NOT_MEASURABLE,
      why: s.why,
      whatWouldMakeItMeasurable: s.whatWouldMakeItMeasurable,
    });
  });

  const measurable = signals.filter((s) => s.state === MEASURABLE);

  return Object.freeze({
    schema: PASSIVE_SURFACE_SCHEMA,
    assessedAt: at ?? UNVERIFIED,
    anyMeasurable: measurable.length > 0,
    measurableCount: measurable.length,
    signalCount: signals.length,
    signals: Object.freeze(signals),
    headline: measurable.length > 0
      ? `${measurable.length} of ${signals.length} passive signals are measurable from a record this program can already read.`
      : REFUSAL_HEADLINE,
    isRefusal: measurable.length === 0,
    notes: Object.freeze([REFUSAL_NOTE, NO_PROXY_NOTE]),
    forbiddenProxies: FORBIDDEN_PROXIES,
  });
}

/** Render. When nothing is measurable, the refusal is the FIRST line, with its date. */
export function renderPassiveSurface(a) {
  const lines = [];
  lines.push("THE PASSIVE SURFACE");
  lines.push("");
  lines.push(`${a.headline}${a.isRefusal && a.assessedAt !== UNVERIFIED ? ` (as at ${String(a.assessedAt).slice(0, 10)})` : ""}`);
  lines.push("");
  if (a.isRefusal) {
    lines.push(REFUSAL_NOTE);
    lines.push("");
  }
  lines.push("EVERY SIGNAL, NAMED — INCLUDING THE ONES THAT CANNOT BE OBSERVED");
  for (const s of a.signals) {
    lines.push(`  ${s.label}: ${s.state}`);
    lines.push(`    why: ${s.why}`);
    lines.push(`    what would make it measurable: ${s.whatWouldMakeItMeasurable}`);
  }
  lines.push("");
  lines.push(NO_PROXY_NOTE);
  return lines.join("\n");
}
