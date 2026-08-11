// prospect-packet.mjs — RUN-AW / AW3.
//
// AU1 asked one question about one document: can a clone of this repository produce the agreement a
// client signs? The answer was no, and finding that out was worth the whole cycle.
//
// This asks the same question about the WHOLE PACKET. After a yes, a prospect receives more than a
// contract: the security questionnaires their reviewer works through, the policies that reviewer
// asks for by name, the readiness maps, the sales sheet the conversation started from. Every one of
// those is promised. This module finds out which of them can actually be handed over.
//
// The discipline that makes the answer worth anything:
//
//   HEAD'S TREE IS THE SOURCE. Not the working copy, not `git ls-files`, not the operator's disk.
//   A file present on this machine and absent from the shared line is exactly the failure being
//   looked for, and reading the working copy would hide it. AU3 already recorded why the index is
//   not the source either: it froze behind a stale lock and ran 27 entries behind HEAD, so every
//   earlier UNTRACKED verdict under-reported what a clone receives.
//
//   The packet is assembled into a THROWAWAY DIRECTORY. Nothing is written in-repo, nothing is
//   attached, nothing is sent, no mail path is touched and no address is read. This module answers
//   a question about delivery; it does not deliver.
//
//   A document that cannot travel is reported UNTRACKED WITH ITS REASON — never rounded up into
//   "delivered", never rounded down into "missing". Those are three different facts.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

export const PACKET_SCHEMA = "prospect-packet/1";

/**
 * What a prospect is actually promised, as data. Each section says WHO asks for it and WHY it is in
 * the packet, so a document cannot be added to what a client receives without somebody stating the
 * reason a client receives it.
 */
export const PACKET = [
  {
    section: "agreement",
    who: "the person who signs",
    why: "nothing else in the packet matters if the document that starts the engagement cannot be produced",
    dirs: ["legal"],
  },
  {
    section: "security-questionnaires",
    who: "the buyer's own security reviewer",
    why: "SIG-Lite and CAIQ-Lite are worked through line by line and are the most common single blocker on an enterprise deal",
    files: [
      "compliance/SIG-Lite-prefilled.md",
      "compliance/CAIQ-Lite-prefilled.md",
      "compliance/SOC2-controls-self-assessment.md",
      "compliance/ISO-27001-SoA.md",
    ],
  },
  {
    section: "readiness-maps",
    who: "a reviewer in a regulated sector",
    why: "healthcare, EU and AI-governance buyers ask for the specific map before they ask anything else",
    files: [
      "compliance/HIPAA-readiness-map.md",
      "compliance/EU-AI-Act-readiness-map.md",
      "compliance/NIST-AI-RMF-readiness-map.md",
      "compliance/C2PA-content-provenance-policy.md",
    ],
  },
  {
    section: "written-policies",
    who: "the reviewer, by name, one at a time",
    why: "a questionnaire answer that cites a policy is worth nothing if the policy cannot be handed over",
    dirs: ["compliance/policies"],
  },
  {
    section: "client-guides",
    who: "the client's own IT administrator, during onboarding",
    why:
      "an integration guide is handed over after the signature and is the first thing that has to " +
      "work; it was missing from the first draft of this packet purely because it sits one directory " +
      "deeper than the sales sheets, which is exactly the kind of omission this module exists to find",
    dirs: ["ARIA Sentinel/sales/client-guides"],
  },
  {
    section: "sales",
    who: "the prospect, before any of the above",
    why: "the document the conversation is had over — and the one AV2 found carrying a second price for all five published plans",
    dirs: ["ARIA Sentinel/sales"],
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
    const buf = execFileSync("git", ["show", `HEAD:${rel}`], {
      cwd: root, maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return buf;
  } catch {
    return null;
  }
}

/** Every document the packet promises, resolved against HEAD. Directories expand from HEAD, not disk. */
export function packetManifest({ root = process.cwd(), packet = PACKET, tree = null } = {}) {
  const head = tree || headTree({ root });
  const items = [];

  for (const part of packet) {
    const named = [...(part.files || [])];
    for (const dir of part.dirs || []) {
      // Expanded from HEAD so a document that exists only on this machine cannot pad the packet.
      // Non-recursive by section on purpose: `compliance/policies` is its own section, and letting
      // `compliance` swallow it would report the policies twice and hide an empty section.
      for (const f of head.files) {
        if (!f.startsWith(`${dir}/`)) continue;
        if (f.slice(dir.length + 1).includes("/")) continue;
        if (!f.endsWith(".md")) continue;
        named.push(f);
      }
    }
    for (const file of [...new Set(named)].sort()) {
      items.push({ section: part.section, who: part.who, why: part.why, file });
    }
  }
  return { head, items };
}

/**
 * Assemble the packet into a throwaway directory from HEAD's bytes, and report what arrived.
 *
 * `dryRun` writes nothing at all and still resolves every document — because the honest default for
 * a question about delivery is to answer it without producing anything that could be mistaken for a
 * delivery.
 */
export function assemblePacket({ root = process.cwd(), packet = PACKET, dryRun = false } = {}) {
  const { head, items } = packetManifest({ root, packet });

  let outDir = null;
  if (!dryRun && head.readable) {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), "prospect-packet-"));
  }

  const resolved = items.map((item) => {
    if (!head.readable) {
      return { ...item, state: "unresolved", reason: `HEAD is unreadable: ${head.error}`, bytes: null };
    }
    if (!head.files.has(item.file)) {
      return {
        ...item,
        state: "untracked",
        bytes: null,
        reason:
          "promised to a prospect and absent from HEAD's tree — a clone of this repository cannot " +
          "produce it, so it can only ever be sent from one machine",
      };
    }
    const buf = headBytes(root, item.file);
    if (buf === null) {
      return { ...item, state: "unreadable", bytes: null, reason: "listed in HEAD's tree and its bytes could not be read" };
    }
    if (buf.length === 0) {
      return { ...item, state: "empty", bytes: 0, reason: "in the shared line and carries nothing; an empty file is not a document" };
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
      why: part.why,
      promised: mine.length,
      arrived: mine.filter((r) => r.state === "arrived").length,
      // An EMPTY section is its own failure and must never read as a clean one: a packet that
      // promises the buyer's reviewer a set of policies and resolves zero of them is not "0 problems".
      ok: mine.length > 0 && mine.every((r) => r.state === "arrived"),
    };
  }

  const arrived = resolved.filter((r) => r.state === "arrived");
  const untracked = resolved.filter((r) => r.state === "untracked");
  const failed = resolved.filter((r) => r.state !== "arrived");

  return {
    schema: PACKET_SCHEMA,
    source: "HEAD's tree — never the working copy, never the index",
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
      ok: head.readable && resolved.length > 0 && failed.length === 0 &&
        Object.values(bySection).every((s) => s.ok),
    },
  };
}

/** Remove a throwaway packet. A directory of client documents does not outlive the question. */
export function discardPacket(result) {
  if (result && result.assembledIn && fs.existsSync(result.assembledIn)) {
    fs.rmSync(result.assembledIn, { recursive: true, force: true });
    return true;
  }
  return false;
}

export function statementFor(result) {
  const s = result.summary;
  if (!result.headReadable) return "HEAD's tree could not be read, so what a clone receives is unknown — never assumed";
  if (!s.promised) return "the packet promises nothing, which is not the same as delivering everything";
  if (s.ok) {
    return `${s.arrived}/${s.promised} promised documents are in the shared line across ${s.sectionsOk}/${s.sections} sections (${s.bytes} bytes); nothing was sent`;
  }
  const first = result.items.filter((r) => r.state !== "arrived").slice(0, 3).map((r) => `${r.file} (${r.state})`);
  return `${s.arrived}/${s.promised} promised documents can be produced from a clone — ${first.join(", ")}${s.failed > 3 ? ` and ${s.failed - 3} more` : ""}`;
}

export default { assemblePacket, packetManifest, headTree, discardPacket, statementFor, PACKET, PACKET_SCHEMA };
