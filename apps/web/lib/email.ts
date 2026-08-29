import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM_EMAIL ?? "Pore <onboarding@resend.dev>";
const resend = apiKey ? new Resend(apiKey) : null;

export interface ConsentEmailInput {
  to: string;
  childAge: number;
  approveUrl: string;
}

/** Sends the parent an email with a single link to the approve/deny page --
 *  deliberately not two links baked in, since a mail-client link-scanner that
 *  GETs a "deny" URL to prescan it would silently decide it. When
 *  RESEND_API_KEY is unset, logs instead of sending, so the flow is testable
 *  end-to-end without an account (same fallback pattern as ANTHROPIC_API_KEY). */
export async function sendConsentEmail(input: ConsentEmailInput): Promise<void> {
  const { to, childAge, approveUrl } = input;
  const subject = "Approval needed: your teen wants to try Pore";
  const html = `
    <p>Your teen (age ${childAge}) started signing up for Pore, a skincare app
    that looks at a face photo and a short questionnaire to suggest a
    routine.</p>
    <p>Because they're under 18, Pore won't take or analyze any photo until
    you approve. Review and decide here:</p>
    <p><a href="${approveUrl}">${approveUrl}</a></p>
    <p>If you don't recognize this request, you can ignore this email or use
    the link to deny it.</p>
  `;

  if (!resend) {
    console.log(`[consent email -> ${to}] ${approveUrl}`);
    return;
  }

  await resend.emails.send({ from, to, subject, html });
}
