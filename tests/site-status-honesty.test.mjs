// site-status-honesty.test.mjs — the public status page must never ship hard-coded health.
//
// RUN-CU 2026-10-08 (site audit, Top-10 #2): status.html said "All systems operational" with six
// OPERATIONAL pills written into the HTML, 99.99 % / 11.4 s / <2 s / 24×7 as literals, and a 90-day
// grid that injected two amber days "for realism". Only /favicon.svg was ever fetched. Rule 14 is
// real-or-empty: every pill, metric and banner is now set from /.netlify/functions/health and
// /.netlify/functions/aria-system-status, or left as "—" / "not measured".
//
// This test pins that. It reads the STATIC markup, so a runtime string like 'OPERATIONAL · 412 ms'
// inside the script (set only after a probe answers) is fine; a pill that is OPERATIONAL before any
// request is made is not.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const status = readFileSync(join(ROOT, "status.html"), "utf8");
const history = readFileSync(join(ROOT, "status-history.html"), "utf8");

// The markup without its <script> blocks — what a visitor sees before any probe answers.
const markup = status.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

test("no component pill is OPERATIONAL in the static markup", () => {
  const staticPills = [...markup.matchAll(/<span[^>]*class="pill[^"]*"[^>]*>([^<]*)<\/span>/g)].map((m) => m[1].trim());
  assert.ok(staticPills.length >= 6, `expected the component pills to still exist, found ${staticPills.length}`);
  const green = staticPills.filter((t) => /operational/i.test(t));
  assert.deepEqual(green, [], `hard-coded OPERATIONAL pill(s): ${green.join(", ")}`);
  assert.ok(!/<span[^>]*class="pill ok"/.test(markup), "a pill must not start in the green state");
});

test("the 'for realism' amber-day injection is gone", () => {
  assert.ok(!/for realism/i.test(status), "status.html still injects synthetic uptime days");
  assert.ok(!/i === 12 \|\| i === 58/.test(status), "the two hard-coded amber indexes are still there");
});

test("no fabricated SLA literals in the static markup", () => {
  for (const literal of ["99.99%", "11.4s", "&lt;2s", "24×7", "24x7"]) {
    assert.ok(!markup.includes(literal), `fabricated metric literal still present: ${literal}`);
  }
  assert.ok(!/All systems operational/.test(markup), "the headline must not assert health before a probe answers");
});

test("the page reads the two real endpoints", () => {
  assert.ok(status.includes("/.netlify/functions/health"), "must read /.netlify/functions/health");
  assert.ok(status.includes("/.netlify/functions/aria-system-status"), "must read /.netlify/functions/aria-system-status");
  assert.ok(!/fetch\('\/favicon\.svg/.test(status), "the self-referential favicon 'probe' must not be the health check");
});

test("unmeasured components say so instead of guessing", () => {
  assert.ok(/NOT MEASURED/.test(markup), "email / Microsoft Graph must render as NOT MEASURED until a probe exists");
  assert.ok(/no history recorded yet/i.test(markup), "the uptime grid needs an honest empty state");
});

test("status-history.html labels its sample numbers as samples", () => {
  assert.ok(/Sample layout/.test(history), "status-history.html needs the visible 'Sample layout' banner");
  assert.ok(/real history appears once the uptime probe is wired/i.test(history), "banner must say when real history appears");
  // every metric card carries the sample tag
  const metricCards = [...history.matchAll(/<article class="f100-card">([\s\S]*?)<\/article>/g)];
  assert.ok(metricCards.length >= 4, "the four metric cards must still exist (Rule 15)");
  for (const [, card] of metricCards) {
    assert.ok(/sample/i.test(card), `metric card is not labelled sample: ${card.slice(0, 80)}`);
  }
});
