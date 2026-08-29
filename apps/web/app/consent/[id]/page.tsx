import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { getConsentForApproval } from "@/lib/consent";
import { ConsentActions } from "./consent-actions";

export const metadata: Metadata = {
  title: "Parental approval",
  description: "Approve or deny a teen's request to use Pore.",
};

function Message({ title, body }: { title: string; body: string }) {
  return (
    <Container>
      <div className="mx-auto max-w-lg py-20 sm:py-28">
        <h1 className="font-display text-3xl text-ink">{title}</h1>
        <p className="mt-4 text-[17px] leading-[1.7] text-ink-muted">{body}</p>
      </div>
    </Container>
  );
}

export default async function ConsentApprovalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;

  if (!token) {
    return <Message title="Invalid link" body="This approval link is missing its security token." />;
  }

  const record = await getConsentForApproval(id, token);
  if (!record) {
    return (
      <Message
        title="Invalid or expired link"
        body="We couldn't verify this approval link. If you still want to respond, ask your teen to resend the request from the app."
      />
    );
  }

  if (record.status !== "pending") {
    return (
      <Message
        title={record.status === "approved" ? "Already approved" : "Already declined"}
        body={`This request was already ${record.status}. No further action is needed.`}
      />
    );
  }

  return (
    <Container>
      <div className="mx-auto max-w-lg py-20 sm:py-28">
        <h1 className="font-display text-3xl text-ink">Approve Pore for your teen?</h1>
        <p className="mt-5 text-[17px] leading-[1.7] text-ink-muted">
          Your teen (age {record.childAge}) started signing up for Pore, a skincare app that looks
          at a face photo and a short questionnaire to suggest a routine. It&apos;s a cosmetic look
          at what&apos;s visible, never a diagnosis.
        </p>
        <p className="mt-4 text-[17px] leading-[1.7] text-ink-muted">
          Photos are sent to Pore&apos;s server and to Anthropic for analysis and are not stored.
          Pore won&apos;t take or analyze any photo until you approve here.
        </p>
        <ConsentActions id={id} token={token} />
      </div>
    </Container>
  );
}
