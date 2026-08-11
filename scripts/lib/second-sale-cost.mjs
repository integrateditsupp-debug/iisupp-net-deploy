// second-sale-cost.mjs — RUN-AZ / AZ3. THE SECOND SALE, PRICED IN ACTS.
//
// Every cycle since RUN-M has been about the first dollar. A multi-million-dollar services company is
// not built on first dollars; it is built on the same customer paying more next year than this year.
// What this company would sell a happy customer at month six exists nowhere — not as a document, not
// as a price a clone can produce, not as a trigger anybody could act on.
//
// THE UNIT, and why it is emphatically not revenue:
//
//   AT3 counted the distance from a yes to money. AX3 counted a reviewer's follow-up. AY3 counted the
//   first week. All three used the same unit for the same reason: acts a person must perform and
//   artefacts that must exist, NEVER hours, because nobody here has timed one.
//
//   Here the temptation is worse than an invented hour. The obvious output of a module about the
//   second sale is an expansion number — attach rate, upgrade revenue, expected value at month six.
//   Every one of those would be a FORECAST WEARING A MEASUREMENT'S CLOTHES: a figure with no source,
//   presented in the format this program reserves for things that were read off a file. It would be
//   the single worst fabrication this codebase could produce, because it would be believed.
//
//   So this module refuses to emit money. It asserts that refusal about its own output and the suite
//   holds it to it: no currency symbol, no projection, no rate, no multiple.
//
// MANUAL-BY-DESIGN STAYS APART FROM MANUAL-FOR-WANT, exactly as AT3, AX3 and AY3 kept them. Deciding
// to ask a paying customer for more money is Ahmad's, always, and it should be — a system that
// decided when to upsell would automate the one judgement a founder-led company sells. Only the
// second kind is a gap worth closing.
//
// WIRED TO AZ1 AND AZ2, not by assertion but by resolution: a step whose trigger depends on a signal
// AZ1 proved this company cannot observe is FOR-WANT with that signal named, and a step blocked by an
// exit stage AZ2 found silent is FOR-WANT with that stage named. Three modules, one truth.
//
// Nothing here is sent, quoted, priced or offered to anybody.

import { headTree } from "./customer-packet.mjs";
import { auditChurnSignals, SIGNAL } from "./churn-signals.mjs";
import { auditTermAndExit, STAGE } from "./term-and-exit.mjs";

export const SECOND_SALE_SCHEMA = "second-sale-cost/1";

export const ACT = Object.freeze({
  ARTEFACT: "artefact-backed",
  BY_DESIGN: "person-by-design",
  FOR_WANT: "person-for-want",
  UNCOUNTED: "uncounted",
});

/**
 * What would have to be true for a happy customer at month six to be sold anything at all.
 *
 * `needs` names artefacts in the shared line. `signal` names an AZ1 churn signal the step's TRIGGER
 * depends on. `stage` names an AZ2 exit stage the step depends on. `byDesign` states why a person
 * must do it and why that is right.
 */
export const SECOND_SALE = [
  {
    id: "S-01",
    step: "There is a published tier above the one the customer is on.",
    needs: ["plans/index.html"],
  },
  {
    id: "S-02",
    step: "The price of that tier can be produced from the shared line, not from memory.",
    needs: ["plans/index.html", "scripts/lib/retainer-proposal.mjs"],
  },
  {
    id: "S-03",
    step: "A proposal for the larger scope can be generated rather than written from scratch.",
    needs: ["scripts/lib/retainer-proposal.mjs", "legal/MSA-template.md"],
  },
  {
    id: "S-04",
    step: "The larger scope can be added to an existing agreement without re-papering the whole thing.",
    needs: ["legal/MSA-template.md"],
  },
  {
    id: "S-05",
    step: "Somebody knows the customer is USING enough of the current tier to need the next one.",
    signal: "login-stopped-happening",
    signalWhy:
      "an expansion trigger and a churn trigger read the same meter from opposite ends — if sign-ins " +
      "are not retained, neither a customer growing out of a tier nor one drifting out of the product " +
      "can be seen, and the upgrade conversation happens only by luck",
  },
  {
    id: "S-06",
    step: "Somebody knows the customer's term is close enough to its end for the conversation to be timely.",
    signal: "term-ending-unnoticed",
    signalWhy:
      "the renewal date is the only naturally occurring moment to discuss a bigger plan, and nothing " +
      "in the shared line knows when it is",
  },
  {
    id: "S-07",
    step: "The customer is told, before the renewal, what can change and what it would cost.",
    stage: "X-06",
    stageWhy:
      "AZ2 found the documents that would carry this are present and silent about it — a renewal that " +
      "arrives with no prior conversation is a renewal nobody could sell into",
  },
  {
    id: "S-08",
    step: "The invoice for the larger amount can be produced by the same path that produced the first.",
    needs: ["scripts/lib/invoice-rehearsal.mjs", "netlify/functions/stripe-checkout.js"],
  },
  {
    id: "S-09",
    step: "The customer is asked.",
    byDesign:
      "deciding to ask a paying customer for more money is a judgement about the relationship and " +
      "about whether the extra scope is genuinely worth their spend; a system that made that call " +
      "would automate the exact thing a founder-led company is bought for",
  },
  {
    id: "S-10",
    step: "What the customer says no to is written down, and shapes what is built next.",
    byDesign:
      "a refused upsell is the most useful product research this company can get, and reading it is " +
      "a founder's job — a form that logged the objection would collect words and lose the meaning",
  },
];

/** No money, no forecast, no rate. Held by the suite against this module's own output. */
const MONEY_OR_FORECAST =
  /[$€£]\s?\d|\b\d+(?:\.\d+)?\s*%|\bUSD\b|\bCAD\b|\bMRR\b|\bARR\b|\battach rate\b|\bexpected value\b|\bproject(?:ed|ion)\b|\bforecast\b|\buplift\b|\bexpansion revenue\b/i;

/**
 * The only paths exempt from the money-and-forecast scan, and why.
 *
 * These three fields exist to STATE the refusal — "never money, because a number about a sale that
 * has not happened is a forecast wearing a measurement's clothes". The word `forecast` appears in
 * them because they are the sentence that forbids it. Caught by the scanner on its first run against
 * its own module, which is the check behaving correctly about a word and wrongly about a field.
 *
 * The narrowing is DECLARED here and reported in the output rather than quietly deleted from the
 * pattern, because a scanner whose exemptions are invisible is a scanner nobody can audit. It is
 * scoped to three named paths: no findings field, no step, and no summary number can ever be exempt.
 */
export const SCAN_EXEMPT = Object.freeze([
  { at: "unit", why: "the sentence that states this module emits no money is not an emission of money" },
  { at: "moment", why: "the moment this module is about, in prose a person wrote" },
  { at: "ifGapsClosed.note", why: "the note explaining why person-by-design does not move" },
]);

export function scanForFabricatedNumbers(result, { exempt = SCAN_EXEMPT } = {}) {
  const hits = [];
  const exemptPaths = new Set(exempt.map((e) => e.at));
  const walk = (node, at) => {
    if (typeof node === "string") {
      if (!exemptPaths.has(at) && MONEY_OR_FORECAST.test(node)) hits.push({ at, text: node.slice(0, 160) });
      return;
    }
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${at}[${i}]`));
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) walk(v, at ? `${at}.${k}` : k);
    }
  };
  walk(result, "");
  return hits;
}

/**
 * Price the second sale. Emits no money and no projection, and says so in its own output.
 */
export function priceSecondSale({
  root = process.cwd(),
  steps = SECOND_SALE,
  churn = null,
  exit = null,
} = {}) {
  const head = headTree({ root });
  const signals = churn || auditChurnSignals({ root });
  const term = exit || auditTermAndExit({ root });

  const signalState = new Map(signals.signals.map((s) => [s.id, s]));
  const stageState = new Map(term.stages.map((s) => [s.id, s]));

  const priced = steps.map((s) => {
    if (s.byDesign) {
      return { ...s, cost: ACT.BY_DESIGN, missing: [], blockedBy: null, why: s.byDesign };
    }

    if (s.signal) {
      const sig = signalState.get(s.signal);
      if (!sig) {
        return {
          ...s,
          cost: ACT.UNCOUNTED,
          missing: [],
          blockedBy: s.signal,
          why: `the signal this step's trigger depends on (${s.signal}) is not in AZ1's list, so whether it can be read is unknown`,
        };
      }
      if (sig.state === SIGNAL.OBSERVABLE) {
        return { ...s, cost: ACT.ARTEFACT, missing: [], blockedBy: null, why: null };
      }
      return {
        ...s,
        cost: ACT.FOR_WANT,
        missing: [],
        blockedBy: s.signal,
        why: `${s.signalWhy} — AZ1 reads this signal as ${sig.state}`,
      };
    }

    if (s.stage) {
      const st = stageState.get(s.stage);
      if (!st) {
        return {
          ...s,
          cost: ACT.UNCOUNTED,
          missing: [],
          blockedBy: s.stage,
          why: `the exit stage this step depends on (${s.stage}) is not in AZ2's walk, so whether it is carried is unknown`,
        };
      }
      if (st.rawState === STAGE.DELIVERED) {
        return { ...s, cost: ACT.ARTEFACT, missing: [], blockedBy: null, why: null };
      }
      return {
        ...s,
        cost: ACT.FOR_WANT,
        missing: [],
        blockedBy: s.stage,
        why: `${s.stageWhy} — AZ2 reads this stage as ${st.rawState}`,
      };
    }

    if (!head.readable) {
      return {
        ...s,
        cost: ACT.UNCOUNTED,
        missing: [],
        blockedBy: null,
        why: `HEAD's tree could not be read, so whether an artefact backs this step is unknown: ${head.error}`,
      };
    }
    const missing = (s.needs || []).filter((f) => !head.files.has(f));
    if (missing.length === 0) {
      return { ...s, cost: ACT.ARTEFACT, missing: [], blockedBy: null, why: null };
    }
    return {
      ...s,
      cost: ACT.FOR_WANT,
      missing,
      blockedBy: null,
      why:
        `a person must carry this by hand only because ${missing.join(", ")} is not in the shared ` +
        "line — the step itself is one an artefact should carry",
    };
  });

  const n = (c) => priced.filter((p) => p.cost === c).length;
  const forWant = priced.filter((p) => p.cost === ACT.FOR_WANT);

  const result = {
    schema: SECOND_SALE_SCHEMA,
    unit:
      "acts a person must perform and artefacts that must exist — never hours, and never money, " +
      "because a number about a sale that has not happened is a forecast wearing a measurement's clothes",
    moment: "month six, with a customer who is happy and has not been asked for anything since the first invoice",
    revenueProjected: false,
    moneyEmitted: false,
    sent: false,
    offered: false,
    headReadable: head.readable,
    steps: priced,
    summary: {
      total: priced.length,
      artefactBacked: n(ACT.ARTEFACT),
      personByDesign: n(ACT.BY_DESIGN),
      personForWant: forWant.length,
      uncounted: n(ACT.UNCOUNTED),
      // Every for-want must name what would close it: a missing artefact, an unobservable signal, or
      // a silent exit stage. A person-act with nothing named is a cost nobody can close.
      forWantUnnamed: forWant.filter((p) => p.missing.length === 0 && !p.blockedBy).length,
      blockedBySignals: [...new Set(forWant.filter((p) => p.signal).map((p) => p.signal))],
      blockedByStages: [...new Set(forWant.filter((p) => p.stage).map((p) => p.stage))],
      ok:
        head.readable &&
        n(ACT.UNCOUNTED) === 0 &&
        forWant.every((p) => p.missing.length > 0 || p.blockedBy),
    },
    ifGapsClosed: {
      artefactBacked: n(ACT.ARTEFACT) + forWant.length,
      personActs: n(ACT.BY_DESIGN),
      note:
        "person-by-design does not move and should not: asking for the money and hearing the no are " +
        "the two acts that make this a founder-led company rather than a billing system",
    },
  };

  // The module holds itself to its own rule before anybody else gets to see the output.
  const fabricated = scanForFabricatedNumbers(result);
  result.fabricatedNumbers = fabricated;
  // Reported, never implied: an exemption nobody can see is an exemption nobody can challenge.
  result.scanExemptions = SCAN_EXEMPT.map((e) => ({ ...e }));
  result.summary.ok = result.summary.ok && fabricated.length === 0;
  return result;
}

export function statementFor(result) {
  const s = result.summary;
  if (!result.headReadable) return "HEAD's tree could not be read, so the second sale is uncounted rather than assumed";
  return (
    `${s.artefactBacked} of ${s.total} second-sale steps are carried by something that already ` +
    `exists; ${s.personByDesign} need a person by design; ${s.personForWant} need a person only ` +
    `because an artefact, a signal or an exit stage is missing; ${s.uncounted} uncounted. ` +
    "No revenue figure is produced, deliberately"
  );
}

export default {
  priceSecondSale,
  scanForFabricatedNumbers,
  SCAN_EXEMPT,
  statementFor,
  SECOND_SALE,
  ACT,
  SECOND_SALE_SCHEMA,
};
