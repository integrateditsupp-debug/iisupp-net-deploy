// time-to-first-dollar.mjs — RUN-AT / AT3.
//
// "It only takes a few days to get someone paying" is a feeling. This is the count.
//
// It takes AT1's walk and prices the distance between a yes and money in the only unit this
// environment can actually measure: **acts a human must perform, and blanks a human must fill.**
// Not hours — nobody in this repository has ever timed one of these, and an invented duration is a
// fabricated metric under Rule 14 no matter how reasonable it sounds.
//
// Two distinctions the count refuses to blur:
//   · A step manual BY DESIGN (the signature, the payment authorisation) is manual and is NOT a
//     defect. Counting it as one would push the program toward automating the two acts that must
//     stay human.
//   · A step manual because nothing exists to do it IS a defect, and it is counted separately.
// And a step whose effort cannot be read off an artefact is UNCOUNTED with its reason — never
// estimated to keep the total tidy.

import { resolveYesPath, CLASSES } from "./yes-path.mjs";

export const TTFD_SCHEMA = "time-to-first-dollar/1";

export const REASONS = {
  NO_ARTEFACT: "no artefact to read effort from — the step is improvised, so its cost is unknown",
  NOT_A_DOCUMENT: "the artefact is executing code, not something a person fills in",
};

const bestArtefact = (step) => {
  const rank = [CLASSES.PRESENT, CLASSES.UNTRACKED, CLASSES.UNUSABLE, CLASSES.MISSING];
  return [...step.artefacts].sort((a, b) => rank.indexOf(a.class) - rank.indexOf(b.class))[0] || null;
};

export function countTimeToFirstDollar({ root, path: walked = null } = {}) {
  const yes = walked || resolveYesPath({ root });
  const steps = [];

  for (const step of yes.steps) {
    const art = bestArtefact(step);
    const carried = step.class === CLASSES.PRESENT || step.class === CLASSES.UNTRACKED;

    // Why a human is in this step at all.
    const manualByDesign = step.manualByDesign;
    const manualByGap = step.class === CLASSES.MISSING || step.class === CLASSES.UNUSABLE;

    let inputs = null;
    let uncountedReason = null;
    if (!art || art.class === CLASSES.MISSING) {
      uncountedReason = REASONS.NO_ARTEFACT;
    } else if (art.handInputs === null) {
      uncountedReason = REASONS.NOT_A_DOCUMENT;
    } else {
      inputs = art.handInputs;
    }

    steps.push({
      id: step.id,
      name: step.name,
      class: step.class,
      manual: manualByDesign || manualByGap,
      manualByDesign,
      manualByGap,
      manualBecause: manualByDesign
        ? step.manualBecause
        : manualByGap
          ? `nothing carried does this step, so a person improvises it (${step.class})`
          : null,
      carried,
      handInputs: inputs,
      countedFrom: art && inputs !== null ? art.path : null,
      uncountedReason,
    });
  }

  const counted = steps.filter((s) => s.handInputs !== null);
  const uncounted = steps
    .filter((s) => s.handInputs === null)
    .map((s) => ({ id: s.id, reason: s.uncountedReason }));

  const withInputs = counted.filter((s) => s.handInputs > 0);
  const longest = withInputs.length
    ? withInputs.reduce((a, b) => (b.handInputs > a.handInputs ? b : a))
    : null;

  return {
    schema: TTFD_SCHEMA,
    steps,
    summary: {
      totalSteps: steps.length,
      manualSteps: steps.filter((s) => s.manual).length,
      manualByDesign: steps.filter((s) => s.manualByDesign).length,
      manualBecauseNothingCarriesIt: steps.filter((s) => s.manualByGap).length,
      handInputsCounted: counted.reduce((n, s) => n + s.handInputs, 0),
      stepsCounted: counted.length,
      stepsUncounted: uncounted.length,
      uncounted,
      longestStep: longest ? { id: longest.id, handInputs: longest.handInputs, countedFrom: longest.countedFrom } : null,
      longestStepReason: longest ? null : "no counted step has a blank a person must fill",
    },
  };
}

export function statementFor(result) {
  const s = result.summary;
  const longest = s.longestStep
    ? `the longest is "${s.longestStep.id}" at ${s.longestStep.handInputs} blanks (${s.longestStep.countedFrom})`
    : s.longestStepReason;
  return (
    `between a yes and money: ${s.manualSteps} of ${s.totalSteps} steps need a person — ` +
    `${s.manualByDesign} by design, ${s.manualBecauseNothingCarriesIt} because nothing carries the step; ` +
    `${s.handInputsCounted} blanks to fill across ${s.stepsCounted} counted steps, ` +
    `${s.stepsUncounted} uncounted; ${longest}`
  );
}
