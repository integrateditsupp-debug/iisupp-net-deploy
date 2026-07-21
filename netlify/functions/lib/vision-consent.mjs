// vision-consent.mjs — STAGE 2 privacy + consent gate (pure, testable)
// ---------------------------------------------------------------------
// Two hard gates the spec (STAGE-2-VISION-DIAGNOSIS) requires:
//   1. Sentinel must have EXPLICIT consent before it captures the screen.
//   2. Before ANY cloud-vision (Fable 5) call, the user must see exactly what leaves the device
//      and consent to cloud processing. Text/logs stay local ($0) and need no cloud consent.
//
// "Your data stays yours" is a selling point — this module makes it true and auditable.

export const VISION_MODEL_LABEL = 'Claude Fable 5 (vision)';

// evaluateConsent → decide whether we may proceed, and what disclosure to show.
//   surface: 'web' | 'sentinel' | 'forums'
//   kind:    'text' | 'log' | 'pdf' | 'image' | 'screen-capture'
//   willCallCloud: boolean — true only when an image needs the cloud vision model
//   consent: { screenCapture?:bool, cloudProcessing?:bool, ts?:number }
// Returns { allowed, blocked, requiresConsent:[], disclosure, dataFlow, kind }.
export function evaluateConsent({ surface = 'web', kind = 'text', willCallCloud = false, consent = {}, pixelRedactedRegions = 0 } = {}) {
  const requiresConsent = [];

  // Gate 1 — Sentinel screen capture always needs explicit, fresh consent.
  const isCapture = kind === 'screen-capture' || (surface === 'sentinel' && kind === 'image' && consent.autoCapture);
  if (isCapture && consent.screenCapture !== true) {
    requiresConsent.push('screenCapture');
  }

  // Gate 2 — any cloud-vision call needs cloud-processing consent.
  if (willCallCloud && consent.cloudProcessing !== true) {
    requiresConsent.push('cloudProcessing');
  }

  const blocked = requiresConsent.length > 0;
  return {
    allowed: !blocked,
    blocked,
    requiresConsent,
    kind,
    dataFlow: dataFlow({ willCallCloud, kind, pixelRedactedRegions }),
    disclosure: buildDisclosure({ surface, kind, willCallCloud, isCapture, pixelRedactedRegions }),
  };
}

// Machine-readable description of exactly what leaves the device and where it goes.
// Rule 14 honesty: `thirdPartyModel` is the meaningful privacy fact (does a paid outside AI see
// this?). `leavesDevice` is literally true for BOTH paths — even text POSTs to our own function —
// so we never imply text "stays on your device". Images are sent UNREDACTED: pixels can't be
// regex-masked the way text is, and only the returned text description is filtered.
export function dataFlow({ willCallCloud, kind, pixelRedactedRegions = 0 }) {
  if (willCallCloud) {
    const painted = Number(pixelRedactedRegions) > 0;
    return {
      leavesDevice: true,
      thirdPartyModel: true,
      sentTo: VISION_MODEL_LABEL,
      sends: painted
        ? 'the image with the ' + pixelRedactedRegions + ' region(s) you painted out removed from the file; every other pixel is sent UNREDACTED — nothing is detected or masked automatically'
        : 'the image itself, UNREDACTED — pixels cannot be masked like text; only the text ARIA reads back is filtered for secrets',
      pixelRedaction: painted
        ? pixelRedactedRegions + ' region(s) you marked were painted to solid black in the file before it was sent — those pixels are gone, not covered'
        : 'none — you did not mark any area to paint out, and nothing is found automatically',
      preCleaned: 'embedded metadata (EXIF/GPS, device serial, owner name, IPTC, PNG text chunks) is stripped from the file before it is sent — the visible picture is unchanged',
      retention: 'not stored by us beyond this request; no raw screenshot retained on our side',
      cost: 'paid model — used only for images you explicitly submit for cloud analysis',
    };
  }
  return {
    leavesDevice: true,
    thirdPartyModel: false,
    sentTo: 'our own iisupp.net function',
    sends: 'redacted text, matched against the offline knowledge base',
    retention: 'processed in memory for this request; not stored',
    cost: '$0 — no AI model is called',
  };
}

// Human-readable disclosure string for the UI ("what's sent where"). Plain truth, no soft-pedaling.
export function buildDisclosure({ surface, kind, willCallCloud, isCapture, pixelRedactedRegions = 0 }) {
  const lines = [];
  if (isCapture) {
    lines.push('ARIA Sentinel will capture your current screen only after you approve it below.');
  }
  if (willCallCloud) {
    if (Number(pixelRedactedRegions) > 0) {
      lines.push(`The ${pixelRedactedRegions} region(s) you painted out are destroyed in the file before it is sent — those pixels are gone, not covered over. Every pixel you did NOT paint is sent UNREDACTED to ${VISION_MODEL_LABEL} to read the error, because nothing is found automatically. Only the text ARIA reads back is filtered for secrets.`);
    } else {
      lines.push(`The image itself is sent UNREDACTED to ${VISION_MODEL_LABEL} to read the error — pixels can't be masked the way text is unless you paint over them yourself first. Only the text ARIA reads back is filtered for secrets.`);
    }
    lines.push("Don't upload anything you wouldn't show a technician — or type the error text instead to keep the image off the cloud.");
    lines.push('Before it is sent we strip the file\u2019s hidden metadata (EXIF/GPS, device serial, owner name) \u2014 that is a real removal, but it does not change the visible picture.');
    lines.push('We keep no raw screenshot after you get your answer.');
  } else {
    lines.push('Your text is sent to our own iisupp.net function, matched against the offline knowledge base, and not stored — it is never sent to any third-party AI model.');
  }
  lines.push('You can decline and type the error instead — the offline knowledge base still works.');
  return lines.join(' ');
}

// Should we even attempt a cloud-vision call? Only for images, and only when the caller allows it.
export function shouldCallCloudVision({ kind, allowCloudVision, hasVisionModel }) {
  return (kind === 'image' || kind === 'screen-capture') && allowCloudVision === true && hasVisionModel === true;
}
