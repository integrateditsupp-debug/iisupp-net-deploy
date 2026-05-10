// Fires on every verified Netlify Forms submission (contact + purchase-tech).
// Guarantees an email is delivered to integrateditsupp@gmail.com for ALL
// forms, regardless of whether the Netlify UI "Form submission notifications"
// have been configured per-form.
//
// Delivery preference (first provider that succeeds wins):
//   1. Mailgun          (if EMAIL_API_KEY + EMAIL_DOMAIN are set)
//   2. Resend           (if RESEND_API_KEY is set)
//   3. FormSubmit.co    (zero-config public fallback — no API key needed)
//
// FormSubmit forwards to any recipient, but the FIRST submission triggers a
// one-time activation email asking the owner to confirm the address. After
// confirming, every subsequent submission is delivered silently.

const NOTIFICATION_EMAIL = "integrateditsupp@gmail.com";

type Payload = {
  form_name: string;
  created_at: string;
  data: Record<string, string>;
};

export default async (req: Request) => {
  const { payload } = (await req.json()) as { payload: Payload };

  const isPurchase = payload.form_name === "purchase-tech";
  const { subject, emailBody, replyTo } = buildEmail(payload, isPurchase);

  console.log(`=== NEW ${isPurchase ? "PURCHASE" : "CONTACT"} FORM SUBMISSION ===`);
  console.log(`Form: ${payload.form_name}`);
  console.log(`Subject: ${subject}`);
  console.log(emailBody);
  console.log("===================================");

  let delivered = false;

  const mgKey = Netlify.env.get("EMAIL_API_KEY");
  const mgDomain = Netlify.env.get("EMAIL_DOMAIN");
  if (!delivered && mgKey && mgDomain) {
    delivered = await sendViaMailgun({
      apiKey: mgKey,
      domain: mgDomain,
      to: NOTIFICATION_EMAIL,
      subject,
      text: emailBody,
      replyTo,
    });
  }

  const resendKey = Netlify.env.get("RESEND_API_KEY");
  const resendFrom = Netlify.env.get("RESEND_FROM") || "onboarding@resend.dev";
  if (!delivered && resendKey) {
    delivered = await sendViaResend({
      apiKey: resendKey,
      from: resendFrom,
      to: NOTIFICATION_EMAIL,
      subject,
      text: emailBody,
      replyTo,
    });
  }

  if (!delivered) {
    delivered = await sendViaFormSubmit({
      to: NOTIFICATION_EMAIL,
      subject,
      text: emailBody,
      replyTo,
      formName: payload.form_name,
    });
  }

  if (!delivered) {
    console.error(
      "All email delivery paths failed. Submission is still stored in Netlify Forms."
    );
  }

  return new Response("OK");
};

function buildEmail(payload: Payload, isPurchase: boolean) {
  const d = payload.data || {};

  if (isPurchase) {
    const subject = `New Purchase Request from ${d.name || "Unknown"}`;
    const replyTo = d.contact && d.contact.includes("@") ? d.contact : undefined;
    const emailBody = [
      `New purchase request received from the Purchase Tech page:`,
      ``,
      `Name: ${d.name || "Not provided"}`,
      `Contact: ${d.contact || "Not provided"}`,
      `Make / Brand: ${d.make || "Not provided"}`,
      `Model: ${d.model || "Not provided"}`,
      `Storage Size: ${d.storage || "Not provided"}`,
      `Price Range: ${d.price_range || "Not provided"}`,
      `Intended Usage: ${d.usage || "Not provided"}`,
      `Setup the device for me: ${
        d.setup_service === "Yes"
          ? "Yes — quote setup per home-page pricing + delivery"
          : "No"
      }`,
      `Additional Notes: ${d.notes || "None"}`,
      ``,
      `Submitted at: ${payload.created_at}`,
      ``,
      `(If a reference image was attached, it is available in the Netlify Forms submission in the Netlify dashboard.)`,
    ].join("\n");
    return { subject, emailBody, replyTo };
  }

  const subject = `New Contact Form Submission from ${d.name || "Unknown"}`;
  const replyTo = d.email || undefined;
  const emailBody = [
    `New contact form submission received:`,
    ``,
    `Name: ${d.name || "Not provided"}`,
    `Email: ${d.email || "Not provided"}`,
    `Phone: ${d.phone || "Not provided"}`,
    `Description: ${d.description || "Not provided"}`,
    ``,
    `Submitted at: ${payload.created_at}`,
  ].join("\n");
  return { subject, emailBody, replyTo };
}

async function sendViaMailgun(opts: {
  apiKey: string;
  domain: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<boolean> {
  try {
    const form = new URLSearchParams();
    form.append("from", `Integrated IT Support <noreply@${opts.domain}>`);
    form.append("to", opts.to);
    form.append("subject", opts.subject);
    form.append("text", opts.text);
    if (opts.replyTo) form.append("h:Reply-To", opts.replyTo);

    const res = await fetch(`https://api.mailgun.net/v3/${opts.domain}/messages`, {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`api:${opts.apiKey}`)}` },
      body: form,
    });
    if (!res.ok) {
      console.error(`Mailgun failed: ${res.status} ${await safeText(res)}`);
      return false;
    }
    console.log("Email delivered via Mailgun.");
    return true;
  } catch (err) {
    console.error("Mailgun error:", err);
    return false;
  }
}

async function sendViaResend(opts: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<boolean> {
  try {
    const body: Record<string, unknown> = {
      from: `Integrated IT Support <${opts.from}>`,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
    };
    if (opts.replyTo) body.reply_to = opts.replyTo;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`Resend failed: ${res.status} ${await safeText(res)}`);
      return false;
    }
    console.log("Email delivered via Resend.");
    return true;
  } catch (err) {
    console.error("Resend error:", err);
    return false;
  }
}

async function sendViaFormSubmit(opts: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  formName: string;
}): Promise<boolean> {
  try {
    const body: Record<string, string> = {
      _subject: opts.subject,
      _template: "table",
      _captcha: "false",
      form: opts.formName,
      message: opts.text,
    };
    if (opts.replyTo) body._replyto = opts.replyTo;

    const res = await fetch(
      `https://formsubmit.co/ajax/${encodeURIComponent(opts.to)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      console.error(`FormSubmit failed: ${res.status} ${await safeText(res)}`);
      return false;
    }
    console.log(
      `Email forwarded via FormSubmit to ${opts.to}. ` +
        "If this is the first submission to this recipient, FormSubmit sends " +
        "a one-time activation email — click the confirmation link to enable " +
        "silent forwarding for every future submission."
    );
    return true;
  } catch (err) {
    console.error("FormSubmit error:", err);
    return false;
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
