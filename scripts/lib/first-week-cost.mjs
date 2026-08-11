// first-week-cost.mjs — RUN-AY / AY3. WHAT THE FIRST WEEK OF A PAYING CUSTOMER COSTS.
//
// AT3 counted the distance from a yes to money: acts a person must perform, blanks a person must
// fill, from reply to payment. AX3 counted the cost of answering a security reviewer's follow-up.
//
// Neither has ever looked at the week AFTER the first invoice clears — which is the week that decides
// whether there is a second invoice. It is unpriced, and an unpriced week is a week nobody plans.
//
// THE UNIT, and why it is not hours:
//
//   Nobody in this environment has ever timed one of these acts. An hour figure would be invented,
//   and an invented duration is a fabricated metric under Rule 14 no matter how reasonable it sounds.
//   What CAN be counted honestly is what each step requires: an ARTEFACT that already exists in the
//   shared line and can be handed over or followed, or a PERSON doing something that did not exist an
//   hour ago. So that is the unit — ARTEFACT-BACKED steps and PERSON-ACTS.
//
//   MANUAL-BY-DESIGN IS KEPT APART FROM MANUAL-FOR-WANT-OF-AN-ARTEFACT, exactly as AT3 kept them and
//   AX3 after it. The welcome call in week one is a founder talking to a customer who just paid him,
//   and it SHOULD be. Counting it as a defect would push this program toward automating the welcome
//   that is the entire advantage of buying from a founder rather than from a helpdesk. Only the second
//   kind is a gap worth closing.
//
//   A STEP WHOSE COST CANNOT BE READ IS UNCOUNTED WITH ITS REASON. Never rounded into either bucket,
//   because a cost silently assigned is a cost nobody will check.
//
// Wired to AY1: the artefacts a step would lean on are resolved against HEAD'S TREE by the same
// module that assembles the customer packet, so a step blocked by a document that only exists on the
// operator's disk is reported as blocked rather than as done. Packet and cost cannot drift apart.
//
// Nothing here is sent, scheduled, attached or mailed. This module answers a question about cost.

import { headTree } from "./customer-packet.mjs";

export const FIRST_WEEK_SCHEMA = "first-week-cost/1";

export const ACT = Object.freeze({
  ARTEFACT: "artefact-backed",        // an artefact in the shared line carries this step
  BY_DESIGN: "person-by-design",      // a person must do this, and should
  FOR_WANT: "person-for-want",        // a person must do this ONLY because an artefact is missing
  UNCOUNTED: "uncounted",             // the cost could not be read — reported, never assigned
});

/**
 * The first week, as it actually happens.
 *
 * Kept as data so a step cannot be added without somebody stating what backs it, and so the suite can
 * remove an artefact from the tree and assert the cost moves BY NAME.
 *
 * `needs` names the artefacts in the shared line that carry the step. `byDesign` states why a person
 * must do it and why that is right.
 */
export const FIRST_WEEK = [
  {
    id: "W-01",
    day: 1,
    step: "The customer is welcomed and told what happens next, by name.",
    byDesign:
      "the first thing a customer who just paid a one-person company wants to know is that a person " +
      "received their money and is expecting them; a generated welcome answers the question in the " +
      "worst possible voice",
  },
  {
    id: "W-02",
    day: 1,
    step: "The customer's tenant is set up and their administrator can get in.",
    needs: ["tenant-onboarding.html"],
  },
  {
    id: "W-03",
    day: 1,
    step: "The administrator is handed the integration guide for their identity provider.",
    needs: ["ARIA Sentinel/sales/client-guides/ClientGuide-ARIA-Sentinel-Entra-AD-Integration.md"],
  },
  {
    id: "W-04",
    day: 2,
    step: "The customer is told how to raise a problem and how fast we answer.",
    needs: ["support-faq.html", "legal/MSA-template.md"],
  },
  {
    id: "W-05",
    day: 2,
    step: "The customer is told what happens during an incident and when they will hear from us.",
    needs: ["compliance/policies/incident-response.md"],
  },
  {
    id: "W-06",
    day: 3,
    step: "The customer's own data-protection obligations are covered by a signed DPA.",
    needs: ["legal/DPA-template.md"],
  },
  {
    id: "W-07",
    day: 3,
    step: "A customer handling PHI is covered by a BAA.",
    needs: ["legal/BAA-template.md"],
  },
  {
    id: "W-08",
    day: 4,
    step: "The customer is shown how to get their own data out, before they ever need to.",
    needs: ["aria-data-export.html"],
  },
  {
    id: "W-09",
    day: 4,
    step: "The customer's security contact is given the incident and access policies they will ask for.",
    needs: ["compliance/policies/incident-response.md", "compliance/policies/access-control.md"],
  },
  {
    id: "W-10",
    day: 5,
    step: "The customer knows what happens to their data if they leave.",
    needs: ["legal/MSA-template.md"],
  },
  {
    id: "W-11",
    day: 5,
    step: "The first week is reviewed with the customer and anything broken is named out loud.",
    byDesign:
      "asking a paying customer what is not working in week one is how the second invoice happens; " +
      "it is a conversation, and a form pretending to be one is worse than not asking",
  },
  {
    id: "W-12",
    day: 5,
    step: "Whatever the customer asked for that we do not yet have is written down and owned.",
    byDesign:
      "deciding what this company builds next because a paying customer asked for it is Ahmad's " +
      "judgement about the product, and it is the most valuable half-hour of the week",
  },
];

/**
 * Price the first week. Nothing is sent, scheduled or attached — this answers a question about cost,
 * it does not run a customer's week.
 */
export function priceFirstWeek({ root = process.cwd(), steps = FIRST_WEEK } = {}) {
  const head = headTree({ root });

  const priced = steps.map((s) => {
    if (s.byDesign) {
      return { ...s, cost: ACT.BY_DESIGN, missing: [], why: s.byDesign };
    }
    if (!head.readable) {
      return {
        ...s, cost: ACT.UNCOUNTED, missing: [],
        why: `HEAD's tree could not be read, so whether an artefact backs this step is unknown: ${head.error}`,
      };
    }
    const missing = (s.needs || []).filter((f) => !head.files.has(f));
    if (missing.length === 0) {
      return { ...s, cost: ACT.ARTEFACT, missing: [], why: null };
    }
    return {
      ...s,
      cost: ACT.FOR_WANT,
      missing,
      why:
        `a person must do this by hand only because ${missing.join(", ")} is not in the shared line — ` +
        "the step itself is one an artefact should carry",
    };
  });

  const n = (c) => priced.filter((p) => p.cost === c).length;
  const forWant = priced.filter((p) => p.cost === ACT.FOR_WANT);

  const byDay = {};
  for (const p of priced) {
    byDay[p.day] = byDay[p.day] || { steps: 0, artefact: 0, personActs: 0 };
    byDay[p.day].steps += 1;
    if (p.cost === ACT.ARTEFACT) byDay[p.day].artefact += 1;
    else if (p.cost !== ACT.UNCOUNTED) byDay[p.day].personActs += 1;
  }

  return {
    schema: FIRST_WEEK_SCHEMA,
    unit:
      "steps carried by an artefact a clone receives, versus steps requiring a person — never hours, " +
      "because nobody here has timed one and an invented duration is a fabricated metric",
    window: "the five working days after the first invoice clears — the week that decides whether there is a second one",
    headReadable: head.readable,
    sent: false,
    scheduled: false,
    mailPathTouched: false,
    steps: priced,
    byDay,
    summary: {
      total: priced.length,
      artefactBacked: n(ACT.ARTEFACT),
      personByDesign: n(ACT.BY_DESIGN),
      personForWant: forWant.length,
      uncounted: n(ACT.UNCOUNTED),
      // Every step forced onto a person must be forced by a NAMED missing artefact. A person-act
      // with nothing named is a cost nobody can close, which is the state this refuses.
      forWantUnnamed: forWant.filter((p) => p.missing.length === 0).length,
      ok: head.readable && n(ACT.UNCOUNTED) === 0 && forWant.every((p) => p.missing.length > 0),
    },
    // What writing the missing artefacts would buy, in this module's own unit rather than asserted.
    ifGapsClosed: {
      artefactBacked: n(ACT.ARTEFACT) + forWant.length,
      personActs: n(ACT.BY_DESIGN),
      note:
        "person-by-design does not move, and should not: the welcome, the week-one review and the " +
        "decision about what to build next are the reasons a customer bought from a founder",
    },
  };
}

export function statementFor(result) {
  const s = result.summary;
  if (!result.headReadable) return "HEAD's tree could not be read, so the first week is uncounted rather than assumed";
  return (
    `${s.artefactBacked} of ${s.total} first-week steps are carried by an artefact a clone receives; ` +
    `${s.personByDesign} need a person by design; ${s.personForWant} need a person only because an ` +
    `artefact is missing; ${s.uncounted} uncounted`
  );
}

export default { priceFirstWeek, statementFor, FIRST_WEEK, ACT, FIRST_WEEK_SCHEMA };
