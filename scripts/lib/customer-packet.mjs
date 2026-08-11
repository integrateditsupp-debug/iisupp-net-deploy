// customer-packet.mjs — RUN-AY / AY1. THE PACKET A PAYING CUSTOMER RECEIVES.
//
// AW3 assembled the twenty-seven documents a PROSPECT is promised, and that arc — AU, AV, AW, AX —
// finished the reviewer. Every question in it belonged to ONE conversation: the one that starts when
// a stranger says yes and ends when their security reviewer stops asking.
//
// There is a second conversation and nothing in this repository has ever looked at it. It begins
// after money moves. The customer is now paying, and what they are promised is a DIFFERENT set of
// things: a way in (onboarding), a way to run it (admin and integration guides), a way to get help
// with a stated route, a way to get their own data out, and a way to leave.
//
// Which of those a clone of this repository can actually produce has never been asked.
//
// The discipline is AW3's, deliberately unchanged, because the failure it catches is the same one:
//
//   HEAD'S TREE IS THE SOURCE. Not the working copy, not the index. AU3 recorded why the index is
//   not the source — it froze behind a stale lock and ran 27 entries behind HEAD, so every earlier
//   UNTRACKED verdict under-reported what a clone receives. A document present on the operator's
//   machine and absent from the shared line is exactly the failure being looked for.
//
//   AN EMPTY SECTION FAILS. Promising a customer nothing is not the same as delivering everything.
//   A section that resolves zero documents is not "0 problems", and no summary in this module may
//   read as clean while one is empty.
//
//   A DOCUMENT THAT CANNOT TRAVEL IS UNTRACKED WITH ITS REASON — never rounded up into delivered,
//   never rounded down into missing. Those are three different facts and they need three different
//   repairs.
//
//   NOTHING IS SENT. The packet is assembled into a throwaway directory or not written at all.
//   No mail path, no attachment, no address. This module answers a question about delivery; it does
//   not deliver.
//
// Wired to AW1 by `customerPacketFilesFor`, so the leak gate and the customer packet cannot come to
// see different documents — a document can never enter what a customer receives without also
// entering the gate that checks what leaves the building.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

export const CUSTOMER_PACKET_SCHEMA = "customer-packet/1";

/**
 * What a PAYING customer is promised, as data.
 *
 * Each section states WHO asks for it and WHEN — because the point of separating this from the
 * prospect packet is that these are asked for at a different moment by a different person, and a
 * document that is fine to be missing during a sales conversation is not fine to be missing in
 * week one.
 *
 * `files` are named. `dirs` expand FROM HEAD, never from disk, so a document that exists only on
 * this machine cannot pad the packet.
 */
export const CUSTOMER_PACKET = [
  {
    section: "onboarding",
    who: "the customer's administrator, in the first hour after the invoice clears",
    when: "week one",
    why:
      "the first thing a paying customer does is try to get in; an onboarding surface that a clone " +
      "cannot produce is a promise kept by one machine",
    files: ["tenant-onboarding.html"],
  },
  {
    section: "admin-and-integration",
    who: "the customer's own IT administrator",
    when: "week one, immediately after onboarding",
    why:
      "the integration guide is the first document that has to WORK rather than persuade; AW3 found " +
      "this class missing from its own first draft purely because it sits one directory deeper",
    dirs: ["ARIA Sentinel/sales/client-guides"],
  },
  {
    section: "support-route",
    who: "the customer with a problem, at the worst possible moment",
    when: "any time after go-live",
    why:
      "a support commitment nobody can read is breached silently — by nobody doing anything — which " +
      "is why AY2 reconciles the commitments themselves and why the route has to exist here first",
    files: ["support-faq.html", "legal/MSA-template.md"],
    // A support section resolved by a document that never states a response route is a section
    // counted, not a promise kept.
    mentions: /response time|support|SLA/i,
  },
  {
    section: "data-export",
    who: "the customer asking for their own data back",
    when: "any time, and always without notice",
    why:
      "a customer's data is theirs; an export surface that cannot be produced from the shared line " +
      "means the answer to 'can we get our data out' depends on which machine is switched on",
    files: ["aria-data-export.html"],
    mentions: /export|download your data|data portability/i,
  },
  {
    section: "offboarding",
    who: "the customer who has decided to leave",
    when: "the moment trust is most easily lost or kept",
    why:
      "how a company behaves on the way out is the reference the next buyer hears; a documented exit " +
      "is worth more than a retention clause",
    files: ["legal/MSA-template.md"],
    // The exact failure this catches: an offboarding section marked delivered because a contract
    // file exists, when the contract never says what happens to the customer's data on the way out.
    mentions: /terminat|offboard|post-termination|return of (customer )?data/i,
  },
];

/** Read HEAD's tree. Never the index, never the working copy. Unreadable is reported, never guessed. */
export function headTree({ root = process.cwd() } = {}) {
  try {
    const out = execFileSync("git", ["ls-tree", "-r", "-z", "--name-only", "HEAD"], {
      cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return { readable: true, files: new Set(out.split("\0").filter(Boolean)) };
  } catch (err) {
    return { readable: false, files: new Set(), error: String(err && err.message).slice(0, 200) };
  }
}

/** The bytes HEAD carries for one path — the bytes a clone would receive, not the bytes on disk. */
function headBytes(root, rel) {
  try {
    return execFileSync("git", ["show", `HEAD:${rel}`], {
      cwd: root, maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
  } catch {
    return null;
  }
}

/** Every document the customer packet promises, resolved against HEAD. */
export function customerManifest({ root = process.cwd(), packet = CUSTOMER_PACKET, tree = null } = {}) {
  const head = tree || headTree({ root });
  const items = [];

  for (const part of packet) {
    const named = [...(part.files || [])];
    for (const dir of part.dirs || []) {
      for (const f of head.files) {
        if (!f.startsWith(`${dir}/`)) continue;
        // Non-recursive by section, exactly as AW3: letting a parent directory swallow a child
        // section reports its documents twice and hides an empty one.
        if (f.slice(dir.length + 1).includes("/")) continue;
        if (!/\.(md|html)$/i.test(f)) continue;
        named.push(f);
      }
    }
    for (const file of [...new Set(named)].sort()) {
      items.push({
        section: part.section, who: part.who, when: part.when, why: part.why, file,
        mentions: part.mentions || null,
      });
    }
  }
  return { head, items };
}

/**
 * Every distinct file the customer packet promises, for the AW1 leak gate.
 *
 * This exists so gate and packet cannot drift: a document that reaches a paying customer is a
 * document that leaves the building, and it must be checked by the same gate that checks the
 * prospect pack.
 */
export function customerPacketFilesFor({ root = process.cwd(), packet = CUSTOMER_PACKET } = {}) {
  const { items } = customerManifest({ root, packet });
  return [...new Set(items.map((i) => i.file))].sort();
}

/**
 * Assemble the customer packet from HEAD's bytes and report what arrived.
 *
 * `dryRun` writes nothing at all and still resolves every document, because the honest default for
 * a question about delivery is to answer it without producing anything that could be mistaken for
 * a delivery.
 */
export function assembleCustomerPacket({ root = process.cwd(), packet = CUSTOMER_PACKET, dryRun = false } = {}) {
  const { head, items } = customerManifest({ root, packet });

  let outDir = null;
  if (!dryRun && head.readable) {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), "customer-packet-"));
  }

  const resolved = items.map((item) => {
    if (!head.readable) {
      return { ...item, state: "unresolved", bytes: null, reason: `HEAD is unreadable: ${head.error}` };
    }
    if (!head.files.has(item.file)) {
      return {
        ...item,
        state: "untracked",
        bytes: null,
        reason:
          "promised to a PAYING customer and absent from HEAD's tree — a clone of this repository " +
          "cannot produce it, so it can only ever be delivered from one machine",
      };
    }
    const buf = headBytes(root, item.file);
    if (buf === null) {
      return { ...item, state: "unreadable", bytes: null, reason: "listed in HEAD's tree and its bytes could not be read" };
    }
    if (buf.length === 0) {
      return { ...item, state: "empty", bytes: 0, reason: "in the shared line and carries nothing; an empty file is not a document" };
    }
    // A file that exists is not the same as a promise kept. A document resolved into a section
    // must actually SPEAK to that section, or the packet is counting filenames.
    if (item.mentions && !item.mentions.test(buf.toString("utf8"))) {
      return {
        ...item,
        state: "silent",
        bytes: buf.length,
        reason:
          `in the shared line and never mentions what this section promises (${String(item.mentions)}) — ` +
          "a section marked delivered because a file exists is the failure this state exists to catch",
      };
    }
    if (outDir) {
      const dest = path.join(outDir, item.file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
    }
    return { ...item, state: "arrived", bytes: buf.length, reason: null };
  });

  const bySection = {};
  for (const part of packet) {
    const mine = resolved.filter((r) => r.section === part.section);
    bySection[part.section] = {
      who: part.who,
      when: part.when,
      why: part.why,
      promised: mine.length,
      arrived: mine.filter((r) => r.state === "arrived").length,
      // An EMPTY section is its own failure. Promising a customer nothing is not delivering everything.
      empty: mine.length === 0,
      ok: mine.length > 0 && mine.every((r) => r.state === "arrived"),
    };
  }

  const arrived = resolved.filter((r) => r.state === "arrived");
  const untracked = resolved.filter((r) => r.state === "untracked");
  const failed = resolved.filter((r) => r.state !== "arrived");

  return {
    schema: CUSTOMER_PACKET_SCHEMA,
    source: "HEAD's tree — never the working copy, never the index",
    conversation: "after money moves — the packet a PAYING customer receives, not the one a prospect is shown",
    headReadable: head.readable,
    dryRun,
    assembledIn: outDir,
    // Named and never omitted, so no reader has to infer it from the absence of a warning.
    sent: false,
    attached: false,
    mailPathTouched: false,
    items: resolved,
    sections: bySection,
    untracked,
    summary: {
      promised: resolved.length,
      arrived: arrived.length,
      untracked: untracked.length,
      failed: failed.length,
      bytes: arrived.reduce((n, r) => n + r.bytes, 0),
      sections: Object.keys(bySection).length,
      sectionsOk: Object.values(bySection).filter((s) => s.ok).length,
      sectionsEmpty: Object.values(bySection).filter((s) => s.empty).length,
      ok:
        head.readable &&
        resolved.length > 0 &&
        failed.length === 0 &&
        Object.values(bySection).every((s) => s.ok),
    },
  };
}

/** Remove a throwaway packet. A directory of customer documents does not outlive the question. */
export function discardCustomerPacket(result) {
  if (result && result.assembledIn && fs.existsSync(result.assembledIn)) {
    fs.rmSync(result.assembledIn, { recursive: true, force: true });
    return true;
  }
  return false;
}

export function statementFor(result) {
  const s = result.summary;
  if (!result.headReadable) return "HEAD's tree could not be read, so what a paying customer receives is unknown — never assumed";
  if (!s.promised) return "the customer packet promises nothing, which is not the same as delivering everything";
  if (s.ok) {
    return (
      `${s.arrived}/${s.promised} documents a paying customer is promised are in the shared line across ` +
      `${s.sectionsOk}/${s.sections} sections (${s.bytes} bytes); nothing was sent`
    );
  }
  const first = result.items.filter((r) => r.state !== "arrived").slice(0, 3).map((r) => `${r.file} (${r.state})`);
  const empties = Object.entries(result.sections).filter(([, v]) => v.empty).map(([k]) => k);
  return (
    `${s.arrived}/${s.promised} documents a paying customer is promised can be produced from a clone` +
    (first.length ? ` — ${first.join(", ")}${s.failed > 3 ? ` and ${s.failed - 3} more` : ""}` : "") +
    (empties.length ? `; empty section(s): ${empties.join(", ")}` : "")
  );
}

export default {
  assembleCustomerPacket, customerManifest, customerPacketFilesFor, headTree,
  discardCustomerPacket, statementFor, CUSTOMER_PACKET, CUSTOMER_PACKET_SCHEMA,
};
