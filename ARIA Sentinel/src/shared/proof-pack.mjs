// RUN-H H1 — VERIFIABLE PROOF PACK (pure, local-only, Rule 14 real-or-empty).
// The proof a prospect can check against THEIR OWN ticket system. Every claim in the pack carries the
// record id and the timestamp it came from, so the customer can look it up and confirm it themselves.
// If a claim is not evidenced by a real record, it is OMITTED - never softened, never rounded up.
//
// Honesty invariants (Rule 14):
//   - EVIDENCE OR OMIT. A claim exists only if a real record with a real id and a real parseable
//     timestamp supports it. No "typical customer" numbers, no industry averages, no logos, no
//     testimonials, no rounded-up savings. Unevidenced => the line is absent, not hedged.
//   - A pilot that has not earned a proof pack yet says so plainly (earned:false) and renders NO
//     claim table at all. Thin evidence never becomes a weak claim.
//   - Minutes and TTFV are OBSERVED only, reusing the same discipline as delivery-leverage: a record
//     with no real recorded time contributes nothing and is logged in `excluded`.
//   - Nothing executes: no network, no spawn, no filesystem reach (static-scan locked in the test).
//     Sending the pack to a customer stays Ahmad's one-click.
//   - Rule 15 additive: pilot-console / conversion-digest / acquisition-funnel / revenue-board /
//     demand-intake / followup-cadence / delivery-leverage untouched.

export const PROOF_PACK_SCHEMA = "proof-pack.v1";

/** A pack is only "earned" once the customer could actually verify a meaningful set of records. */
export const MIN_EVIDENCED_CLAIMS = 3;

export const PACK_NOT_EARNED =
  "This pilot has not earned a proof pack yet - honestly empty. A pack is produced only when at least " +
  MIN_EVIDENCED_CLAIMS +
  " claims are each backed by a real record id and a real timestamp the customer can look up in their own system. Nothing is estimated, softened, or filled in from another customer.";

export const VERIFY_NOTE =
  "Every line below cites the record id and timestamp it came from. Check them against your own tickets - if a line cannot be verified, tell us and we remove it.";

// -- 1. A record is evidence only if it is fully real -------------------------------------------------
export function evidenceOf(record = {}) {
  if (!record || typeof record !== "object") return null;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  if (!id) return null;
  const stamp = record.resolvedAt || record.endedAt || record.at || null;
  const t = stamp ? Date.parse(stamp) : NaN;
  if (!stamp || Number.isNaN(t)) return null;
  return { recordId: id, at: new Date(t).toISOString() };
}

/** Observed minutes only - identical discipline to delivery-leverage (no modelled fix time, ever). */
export function recordMinutes(record = {}) {
  const start = record.startedAt ? Date.parse(record.startedAt) : NaN;
  const end = record.endedAt ? Date.parse(record.endedAt) : NaN;
  if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) return Math.round((end - start) / 60000);
  const d = Number(record.durationMinutes);
  if (Number.isFinite(d) && d > 0) return Math.round(d);
  return null;
}

// -- 2. Split real evidence from everything else ------------------------------------------------------
export function collectEvidence(records) {
  const list = Array.isArray(records) ? records : [];
  const usable = [];
  const excluded = [];
  for (const r of list) {
    const ev = evidenceOf(r);
    if (!ev) {
      excluded.push({
        id: (r && typeof r === "object" && r.id) || "(missing id)",
        reason: "no verifiable record id + timestamp - a customer could not look this up, so it is omitted (never softened)",
      });
      continue;
    }
    usable.push({
      recordId: ev.recordId,
      at: ev.at,
      kind: String(r.kind || r.type || "fix").trim().toLowerCase() || "fix",
      minutes: recordMinutes(r),
      escalated: r.escalated === true,
      summary: typeof r.summary === "string" && r.summary.trim() ? r.summary.trim() : null,
    });
  }
  usable.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return { usable, excluded };
}

// -- 3. Claims - each one carries its own citation ----------------------------------------------------
function claim(label, value, citations, note) {
  return { label, value, citations, ...(note ? { note } : {}) };
}

export function buildClaims(usable, { startedAt = null } = {}) {
  const claims = [];
  if (!Array.isArray(usable) || !usable.length) return claims;

  const fixes = usable.filter((u) => u.kind !== "escalation");
  if (fixes.length) {
    claims.push(claim("Issues resolved", String(fixes.length), fixes.map((f) => ({ recordId: f.recordId, at: f.at }))));
  }

  // Time to first value: only if the pilot's real start date exists AND a real first record exists.
  const startT = startedAt ? Date.parse(startedAt) : NaN;
  if (!Number.isNaN(startT) && fixes.length) {
    const first = fixes[0];
    const hours = Math.round(((Date.parse(first.at) - startT) / 3600000) * 10) / 10;
    if (hours >= 0) {
      claims.push(claim(
        "Time to first resolved issue",
        hours + " h",
        [{ recordId: first.recordId, at: first.at }],
        "Measured from the recorded pilot start " + new Date(startT).toISOString() + " to that record - not from a marketing baseline.",
      ));
    }
  }

  // Observed handling minutes - only records that actually carry real time.
  const timed = usable.filter((u) => u.minutes !== null);
  if (timed.length) {
    const total = timed.reduce((s, u) => s + u.minutes, 0);
    claims.push(claim(
      "Observed handling time",
      total + " min across " + timed.length + " record" + (timed.length === 1 ? "" : "s"),
      timed.map((t) => ({ recordId: t.recordId, at: t.at })),
      "Observed from recorded start/end times only. Records without real recorded time are excluded, not estimated.",
    ));
  }

  const escalations = usable.filter((u) => u.escalated);
  if (escalations.length) {
    claims.push(claim(
      "Escalated to a human beyond first line",
      String(escalations.length),
      escalations.map((e) => ({ recordId: e.recordId, at: e.at })),
      "Reported whether it flatters us or not.",
    ));
  }
  return claims;
}

// -- 4. The pack --------------------------------------------------------------------------------------
export function buildProofPack(input = {}, { now = Date.now() } = {}) {
  const src = input && typeof input === "object" ? input : {};
  const pilotId = typeof src.pilotId === "string" && src.pilotId.trim() ? src.pilotId.trim() : null;
  const startedAt = typeof src.startedAt === "string" && !Number.isNaN(Date.parse(src.startedAt))
    ? new Date(Date.parse(src.startedAt)).toISOString()
    : null;
  const { usable, excluded } = collectEvidence(src.records);
  const claims = buildClaims(usable, { startedAt });
  const earned = Boolean(pilotId) && claims.length >= MIN_EVIDENCED_CLAIMS;

  return {
    schema: PROOF_PACK_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    pilotId,
    startedAt,
    earned,
    claims: earned ? claims : [],
    evidencedRecords: earned ? usable.length : 0,
    excluded,
    verifyNote: earned ? VERIFY_NOTE : null,
    notEarnedReason: earned
      ? null
      : (!pilotId ? "No real pilot id - a pack is never built for an unnamed customer." : PACK_NOT_EARNED),
  };
}

// -- 5. Markdown - renders only what is evidenced ------------------------------------------------------
export function proofPackMarkdown(pack) {
  if (!pack || pack.schema !== PROOF_PACK_SCHEMA) return PACK_NOT_EARNED;
  const out = [];
  out.push("# Proof pack" + (pack.pilotId ? " - " + pack.pilotId : ""));
  out.push("");
  if (!pack.earned) {
    out.push(pack.notEarnedReason || PACK_NOT_EARNED);
    out.push("");
    if (pack.excluded.length) out.push("Records that could not be used as evidence: " + pack.excluded.length + ".");
    return out.join("\n");
  }
  out.push(pack.verifyNote);
  out.push("");
  out.push("| Claim | Value | Verify against record(s) |");
  out.push("| --- | --- | --- |");
  for (const c of pack.claims) {
    const cites = c.citations.map((x) => x.recordId + " (" + x.at + ")").join("; ");
    out.push("| " + c.label + " | " + c.value + " | " + cites + " |");
  }
  out.push("");
  for (const c of pack.claims) if (c.note) out.push("- **" + c.label + ":** " + c.note);
  if (pack.excluded.length) {
    out.push("");
    out.push("Excluded (not verifiable, therefore omitted rather than softened): " + pack.excluded.length + " record(s).");
  }
  return out.join("\n");
}
