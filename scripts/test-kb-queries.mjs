import assert from "node:assert/strict";
import { classify, routeIds, retrieve, renderForAudience } from "../assets/aria-kb-retrieval.mjs";

const articles = [
  {
    id: "l1-printer-001",
    title: "Printer offline",
    level: "L1",
    audience: "end-user",
    severity: "medium",
    keywords: ["printer offline", "add printer", "print queue"],
    symptoms: "Printer says offline or jobs stay in the queue.",
    user_friendly: "Fix printer offline and queue issues.",
    path: "/knowledge-base/printers/l1-printer-001.md",
    _tokens: {
      title: ["printer", "offline"],
      keywords: ["printer", "offline", "add", "print", "queue"],
      symptoms: ["printer", "offline", "queue"]
    }
  },
  {
    id: "l1-outlook-001",
    title: "Outlook not receiving mail",
    level: "L1",
    audience: "end-user",
    severity: "medium",
    keywords: ["outlook offline", "missing email", "inbox not updating"],
    symptoms: "Outlook is offline or the inbox is not updating.",
    user_friendly: "Restore Outlook mail flow.",
    path: "/knowledge-base/L1/l1-outlook-001.md",
    _tokens: {
      title: ["outlook", "receiving", "mail"],
      keywords: ["outlook", "offline", "missing", "email", "inbox", "updating"],
      symptoms: ["outlook", "offline", "inbox", "updating"]
    }
  },
  {
    id: "l2-active-directory-001",
    title: "Account lockout investigation",
    level: "L2",
    audience: "admin",
    severity: "high",
    keywords: ["account lockout", "4740 event", "repeating lockout"],
    symptoms: "A user account repeatedly locks out.",
    user_friendly: "Investigate repeated account lockouts.",
    path: "/knowledge-base/L2/l2-active-directory-001.md",
    _tokens: {
      title: ["account", "lockout", "investigation"],
      keywords: ["account", "lockout", "4740", "repeating"],
      symptoms: ["account", "locks", "out"]
    }
  }
];

assert.equal(classify("My printer is offline").level_hint, "L1");
assert.equal(classify("All our users have conditional access blocked").level_hint, "L2");
assert.ok(routeIds("printer is offline").includes("l1-printer-001"));
assert.ok(routeIds("account keeps getting locked out").includes("l2-active-directory-001"));

const printerHits = retrieve("printer offline queue stuck", articles, { topK: 2 });
assert.equal(printerHits[0].id, "l1-printer-001");

const outlookHits = retrieve("outlook inbox not updating", articles, { topK: 2 });
assert.equal(outlookHits[0].id, "l1-outlook-001");

const safe = renderForAudience(outlookHits[0], "end-user");
assert.equal(safe.show_internal_notes, false);
assert.equal(safe.title, "Outlook not receiving mail");

console.log("KB query smoke test passed (classify, hard routes, retrieval ranking, public-safe render).");
