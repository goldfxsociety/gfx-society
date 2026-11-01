import { MembersFooter } from "@/components/training/members-footer";

/** Content disclaimer (if set) + members footer. With a disclaimer, the footer drops its risk sentence. */
export function ContentDisclaimerFooter({ disclaimer }: { disclaimer?: string | null }) {
  const text = disclaimer?.trim();
  return (
    <>
      {text ? <p className="text-xs text-muted-foreground" data-testid="content-disclaimer">{text}</p> : null}
      <MembersFooter hideRiskLine={Boolean(text)} />
    </>
  );
}
