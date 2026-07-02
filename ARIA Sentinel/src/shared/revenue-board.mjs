// RUN-E E3 — REVENUE-NOW BOARD + ACQUISITION-SCOUT LANE (pure, local-only, Rule 14 real-or-empty).
// ONE board ranks the REAL tracked revenue moves (warm prospects, live tenders, registrations) by
// readiness and attaches the exact next ONE-CLICK action — staged for Ahmad, NEVER executed here.
// 🔒 Honesty invariants:
//   - real-or-empty: no leads => an honestly EMPTY board. A lead without evidence (source + last touch)
//     is EXCLUDED and listed as excluded with the reason — never silently ranked, never invented.
//   - nothing sends: this module has no network/child-process capability at all (test-locked by a
//     static scan). Every action row is {staged:true, executed:false, kind:"ahmad-one-click"}.
//   - outreach text is the Ahmad-LOCKED template VERBATIM (aria-vault/01_Frontal/
//     Outreach-Template-Approved.md, locked 2026-06-25): personalize ONLY [Name]. Cold drafts only —
//     warm/replied leads point at their real prepared reply-branch files instead (no template spam).
//   - acquisition lane (REVENUE MANDATE): a candidate is "vetted" ONLY if all 5 gates of
//     senior-director-state/opportunity-engine/acquisition-vetting-template-2026-07-01.md hold with
//     evidence; anything else is listed as not-vetted with the failing gate. Loan/purchase = 100%
//     Ahmad one-click; this module only ranks and presents.
//   - the board is written ONLY under senior-director-state/ (untracked + Netlify force-404) — real
//     prospect names must never reach a tracked or serveable path (lesson: axis-state.json incident).

export const REVENUE_BOARD_SCHEMA = "revenue-board.v1";

export const TEMPLATE_SOURCE =
  "aria-vault/01_Frontal/Outreach-Template-Approved.md — Ahmad-locked 2026-06-25; personalize ONLY [Name]";

// Verbatim Ahmad-locked outreach template. Contact details below are IIS's public site contact info.
export const OUTREACH_TEMPLATE = `Hello [Name],

Hope you are doing well, I won't take much of your time.

We provide Managed IT Services that meet all your needs for IT support, AI automation, agentic workflow setup, and much more. Please book a quick 15-minute demo [Appointment](https://calendar.app.google/LUyV5pHxkqJRg5vp8) on how we can bring your business up to speed with tech and help prevent unnecessary costs and frustrating technical issues.

We'd appreciate your consideration for any current projects or if you could whitelist us for your future goals. You may reach us via ahmad.wasee@iisupp.net, 647-581-3182 or [iisupp.net](https://iisupp.net/) for more detailed info and ideas.


Regards,

Ahmad Wasee
Founder | Director
Integrated IT Support Inc.
E: Ahmad.wasee@iisupp.net
T: 647-581-3182
W: [Website](https://iisupp.net/)`;

// Personalize the locked template — [Name] is the ONLY thing that may change (test-locked byte-verbatim).
export function personalizeOutreach(name) {
  const who = String(name || "").trim();
  if (!who) return null; // real-or-empty: no name, no draft — never "Hello [Name]" to a real inbox
  return OUTREACH_TEMPLATE.split("[Name]").join(who);
}

// Deterministic readiness weights — explicit and boring on purpose (explainable to a buyer or a court).
export const STATUS_WEIGHTS = {
  "demo-confirmed": 90,   // a real meeting on the calendar
  "replied-warm": 85,     // they wrote back with interest
  "follow-up-due": 70,    // warm thread, our move
  "tender-active": 60,    // live RFP/tender with a real closing date (urgency bonus applies)
  "registration-prep": 40,// unblocks a procurement channel (free)
  "cold": 10,
};

const DAY = 24 * 60 * 60 * 1000;

export function deadlineUrgency(deadlineIso, now) {
  if (!deadlineIso) return { bonus: 0, daysTo: null, overdue: false };
  const t = Date.parse(deadlineIso);
  if (Number.isNaN(t)) return { bonus: 0, daysTo: null, overdue: false };
  const daysTo = Math.ceil((t - now) / DAY);
  if (daysTo < 0) return { bonus: 0, daysTo, overdue: true }; // past date is NOT urgent — it needs verification
  if (daysTo <= 3) return { bonus: 30, daysTo, overdue: false };
  if (daysTo <= 7) return { bonus: 25, daysTo, overdue: false };
  if (daysTo <= 14) return { bonus: 18, daysTo, overdue: false };
  if (daysTo <= 31) return { bonus: 10, daysTo, overdue: false };
  return { bonus: 0, daysTo, overdue: false };
}

// Evidence gate — a lead is rankable ONLY with a real source note and a real last-touch date.
export function evidenceOk(lead = {}) {
  const ev = lead.evidence || {};
  return Boolean(ev.source && typeof ev.source === "string" && ev.lastTouch && !Number.isNaN(Date.parse(ev.lastTouch)));
}

export function readinessScore(lead = {}, { now = Date.now() } = {}) {
  const base = STATUS_WEIGHTS[lead.status] ?? 0;
  const { bonus, overdue } = deadlineUrgency(lead.deadline, now);
  if (overdue) return Math.min(50, base); // stale until a human confirms it is still open
  return Math.min(100, base + bonus);
}

// The exact next one-click — ALWAYS staged, NEVER executed by an agent.
export function nextOneClick(lead = {}) {
  const action = {
    kind: "ahmad-one-click",
    staged: true,
    executed: false,
    label: typeof lead.nextAction === "string" && lead.nextAction.trim() ? lead.nextAction.trim() : null,
    draft: null,
  };
  if (!action.label) {
    action.label = lead.kind === "tender"
      ? "Review tender and decide go/no-go"
      : "Review thread and send the prepared follow-up";
  }
  // Cold outreach is the ONLY case that stages the locked template; warm threads use their real prep files.
  if (lead.kind === "prospect" && lead.status === "cold") action.draft = personalizeOutreach(lead.name);
  return action;
}

export function buildRevenueBoard(input = {}, { now = Date.now() } = {}) {
  const leads = Array.isArray(input.leads) ? input.leads : [];
  const candidates = Array.isArray(input.acquisitions) ? input.acquisitions : [];

  const rows = [];
  const excluded = [];
  for (const lead of leads) {
    if (!lead || typeof lead !== "object" || !lead.id) { excluded.push({ id: lead && lead.id || "(missing id)", reason: "malformed lead" }); continue; }
    if (!STATUS_WEIGHTS[lead.status] && STATUS_WEIGHTS[lead.status] !== 0) { excluded.push({ id: lead.id, reason: `unknown status "${lead.status}"` }); continue; }
    if (!evidenceOk(lead)) { excluded.push({ id: lead.id, reason: "no evidence (source + lastTouch required) — real-or-empty, not ranked" }); continue; }
    const { daysTo, overdue } = deadlineUrgency(lead.deadline, now);
    rows.push({
      id: lead.id,
      who: lead.name || lead.org || lead.id,
      org: lead.org || null,
      kind: lead.kind || "prospect",
      status: lead.status,
      deadline: lead.deadline || null,
      daysToDeadline: daysTo,
      overdue,
      readiness: readinessScore(lead, { now }),
      evidence: { source: lead.evidence.source, lastTouch: lead.evidence.lastTouch },
      action: nextOneClick(lead),
    });
  }
  rows.sort((a, b) => (b.readiness - a.readiness) || String(a.deadline || "9999").localeCompare(String(b.deadline || "9999")) || String(a.id).localeCompare(String(b.id)));

  // Acquisition-scout lane — all 5 template gates must PASS with evidence to be presented as vetted.
  const GATES = ["recurringRevenue", "paybackMath", "transferable", "cleanTail", "fit"];
  const vetted = [];
  const notVetted = [];
  for (const c of candidates) {
    if (!c || typeof c !== "object" || !c.id) { notVetted.push({ id: (c && c.id) || "(missing id)", failing: ["malformed"] }); continue; }
    const gates = c.gates || {};
    const failing = GATES.filter((g) => !(gates[g] && gates[g].pass === true && typeof gates[g].evidence === "string" && gates[g].evidence.trim()));
    if (failing.length === 0) vetted.push({ id: c.id, source: c.source || null, ask: c.ask ?? null, dscr: (c.gates.paybackMath.dscr ?? null), verdict: "PRESENT to Ahmad (his one-click only)" });
    else notVetted.push({ id: c.id, failing });
  }

  return {
    schema: REVENUE_BOARD_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    nothingSent: true,
    ready: rows.length > 0 || vetted.length > 0,
    rows,
    excluded,
    acquisitions: {
      gate: "senior-director-state/opportunity-engine/acquisition-vetting-template-2026-07-01.md (5/5 must pass with evidence)",
      vetted,
      notVetted,
    },
  };
}

export function boardMarkdown(board) {
  const b = board || buildRevenueBoard({});
  const L = [];
  L.push("# 💰 REVENUE-NOW BOARD — Integrated IT Support Inc.");
  L.push("");
  L.push(`Generated: ${b.generatedAt} · schema ${b.schema} · LOCAL ONLY — lives under senior-director-state/ (untracked + force-404; never committed, never served).`);
  L.push("Every action below is STAGED for Ahmad's one-click. Nothing was sent, signed, paid, registered, or purchased by an agent.");
  L.push("");
  if (!b.ready) {
    L.push("**Board is honestly EMPTY** — no evidenced leads and no vetted acquisition candidates right now (real-or-empty; nothing is invented to fill space).");
  } else {
    L.push("## Ranked revenue moves (readiness 0–100, deterministic)");
    L.push("");
    L.push("| # | Who | Kind | Status | Deadline | Readiness | NEXT ONE-CLICK (Ahmad) |");
    L.push("|---|-----|------|--------|----------|-----------|------------------------|");
    b.rows.forEach((r, i) => {
      const dl = r.deadline ? `${r.deadline.slice(0, 10)}${r.overdue ? " ⚠️ PAST — verify still open" : r.daysToDeadline != null ? ` (${r.daysToDeadline}d)` : ""}` : "—";
      L.push(`| ${i + 1} | ${r.who}${r.org && r.org !== r.who ? ` (${r.org})` : ""} | ${r.kind} | ${r.status} | ${dl} | ${r.readiness} | ${r.action.label} |`);
    });
    L.push("");
    const drafts = b.rows.filter((r) => r.action.draft);
    if (drafts.length) {
      L.push("## Staged cold drafts (locked template verbatim — personalize ONLY [Name]; send = your click)");
      for (const r of drafts) { L.push(""); L.push(`### → ${r.who}`); L.push("```"); L.push(r.action.draft); L.push("```"); }
      L.push("");
    }
  }
  if (b.excluded.length) {
    L.push("## Excluded (honesty log — fix the data, don't fake the rank)");
    L.push("");
    for (const x of b.excluded) L.push(`- ${x.id}: ${x.reason}`);
    L.push("");
  }
  L.push("## 🏦 Acquisition-scout lane (REVENUE MANDATE — buyouts of real recurring revenue)");
  L.push("");
  if (b.acquisitions.vetted.length) {
    L.push("| Candidate | Source | Ask | DSCR | Verdict |");
    L.push("|-----------|--------|-----|------|---------|");
    for (const v of b.acquisitions.vetted) L.push(`| ${v.id} | ${v.source || "—"} | ${v.ask ?? "—"} | ${v.dscr ?? "—"} | ${v.verdict} |`);
  } else {
    L.push("**0 vetted candidates yet — honestly empty.** Lane is OPEN: scout BizBuySell/BizQuest/Sunbelt/broker lists for retiring-owner MSPs; every candidate must pass all 5 gates of the vetting template before it reaches this table. Loan/purchase = 100% Ahmad's one-click.");
  }
  if (b.acquisitions.notVetted.length) {
    L.push("");
    for (const n of b.acquisitions.notVetted) L.push(`- not vetted: ${n.id} — failing gate(s): ${n.failing.join(", ")}`);
  }
  L.push("");
  L.push(`Gate: ${b.acquisitions.gate}`);
  L.push("");
  L.push("---");
  L.push(`Outreach text source: ${TEMPLATE_SOURCE}. Rule 14: every number and status above traces to a real note/date in the evidence column; empty stays empty.`);
  return L.join("\n") + "\n";
}
