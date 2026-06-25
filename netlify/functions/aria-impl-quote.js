/**
 * aria-impl-quote — R-ONE N2. Receives an "implementation add-on" QUOTE REQUEST from the plan/checkout
 * pages: the customer multi-selects which connectors they want set up, plus org size + contact. There is
 * NO fixed price and NO Stripe charge — IIS quotes $10K–$60K per connector based on scope. Mirrors
 * aria-inquiry.js (Resend notify; lead-capture only, never charges).
 */
const CONNECTORS = Object.freeze([
  "AD/Entra", "On-prem AD", "RSA SecurID", "PingOne Verify", "Dynamics 365",
  "Outlook/Exchange", "Excel", "Word", "PowerPoint", "OneNote",
]);
const SUPPORT_PHONE = "(647) 581-3182";

// Pure validator (exported for tests): keeps only allow-listed connectors; requires ≥1 + contact email.
function validateQuote(body = {}) {
  const picked = (Array.isArray(body.connectors) ? body.connectors : [])
    .map((c) => String(c)).filter((c) => CONNECTORS.includes(c));
  const email = String(body.email || "").trim().slice(0, 320);
  const errors = [];
  if (picked.length === 0) errors.push("select at least one connector");
  if (!email) errors.push("email is required");
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push("valid email is required");
  return {
    ok: errors.length === 0,
    errors,
    quote: {
      connectors: picked,
      orgSize: String(body.orgSize || "").trim().slice(0, 80),
      name: String(body.name || "").trim().slice(0, 200),
      email,
      company: String(body.company || "").trim().slice(0, 200),
      phone: String(body.phone || "").trim().slice(0, 60),
      notes: String(body.notes || "").trim().slice(0, 4000),
      kind: body.kind === "human_support" ? "human_support" : "implementation",
    },
  };
}

exports.CONNECTORS = CONNECTORS;
exports.validateQuote = validateQuote;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return j(405, { error: "POST required" });
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return j(400, { error: "Invalid JSON" }); }

  const v = validateQuote(body);
  if (!v.ok) return j(400, { error: v.errors.join("; "), errors: v.errors });

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM || "ARIA Sales <noreply@iisupp.net>";
  const salesTo = process.env.SALES_NOTIFY_EMAIL || "ahmad.wasee@iisupp.net";
  if (!apiKey) {
    console.error("[aria-impl-quote] RESEND_API_KEY missing");
    return j(500, { error: `Could not submit. Please call ${SUPPORT_PHONE}.` });
  }

  const q = v.quote;
  const ts = new Date().toISOString();
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const title = q.kind === "human_support" ? "Human Support quote request" : "Implementation add-on quote request";
  const subject = `ARIA ${title} — ${q.company || q.email}`;
  const html =
    `<h2>${esc(title)}</h2>` +
    `<p><b>Connectors:</b> ${q.connectors.map(esc).join(", ") || "(human support)"}</p>` +
    `<p><b>Org size:</b> ${esc(q.orgSize) || "—"}</p>` +
    `<p><b>Name:</b> ${esc(q.name) || "—"} &middot; <b>Company:</b> ${esc(q.company) || "—"}</p>` +
    `<p><b>Email:</b> ${esc(q.email)} &middot; <b>Phone:</b> ${esc(q.phone) || "—"}</p>` +
    `<p><b>Notes:</b> ${esc(q.notes) || "—"}</p>` +
    `<p style="color:#888">Quote range: $10K–$60K per connector, scoped on review. No charge taken. ${esc(ts)}</p>`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: fromEmail, to: [salesTo], reply_to: q.email, subject, html }),
    });
    if (!r.ok) {
      console.error("[aria-impl-quote] resend failed", r.status);
      return j(502, { error: `Could not submit. Please call ${SUPPORT_PHONE}.` });
    }
    return j(200, { ok: true, received: q.connectors.length, kind: q.kind });
  } catch (e) {
    console.error("[aria-impl-quote] error", e && e.message);
    return j(502, { error: `Could not submit. Please call ${SUPPORT_PHONE}.` });
  }
};

function j(statusCode, obj) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(obj) };
}
