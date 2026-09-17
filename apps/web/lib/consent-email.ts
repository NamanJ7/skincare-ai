/**
 * Sends the parental-consent email.
 *
 * ponytail: Resend's send endpoint is one POST, so this is `fetch` rather than a
 * dependency. Swap the URL and header shape to move providers.
 *
 * FAILS CLOSED in production: with no RESEND_API_KEY the send throws, the route
 * returns an error, and the teen's camera stays locked. Outside production the
 * link is logged instead so the flow can be exercised end to end without an
 * account — that path is explicitly barred from production, because "no mailer
 * configured" must never read as "consent granted".
 */
const ENDPOINT = "https://api.resend.com/emails";

export interface ConsentEmail {
  to: string;
  approveUrl: string;
  age: number;
}

function body({ approveUrl, age }: ConsentEmail): { subject: string; text: string } {
  return {
    subject: "Approve your teen's use of Pore",
    text: [
      `Someone aged ${age} asked to use Pore, a skincare app, and gave this address as their parent or guardian.`,
      "",
      "Pore takes three photos of their face to suggest a skincare routine. The photos stay on their phone; each one is sent to our server and on to Anthropic for the assessment, and is not stored there.",
      "",
      "If you approve, open this link and follow the instructions. It expires in 24 hours:",
      approveUrl,
      "",
      "If you were not expecting this, ignore this email. Nothing happens without the code on that page, and no photos are taken until it is entered.",
    ].join("\n"),
  };
}

export async function sendConsentEmail(email: ConsentEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONSENT_EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY / CONSENT_EMAIL_FROM unset; refusing to grant consent");
    }
    console.warn(`[consent] no mailer configured; approve URL: ${email.approveUrl}`);
    return;
  }

  const { subject, text } = body(email);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [email.to], subject, text }),
  });

  if (!res.ok) {
    // Log the provider's reason, tell the caller nothing beyond "it failed".
    console.error("[consent] Resend rejected the send:", res.status, await res.text());
    throw new Error("Could not send the consent email");
  }
}
