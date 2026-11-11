import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { ACCM_CONFIRM_MAIL_LIVE } from "@/lib/members/access-request";

export const metadata: Metadata = { title: "Privacy Notice" };

/**
 * Privacy v1.4 is live. v1.5 (ACCM-email confirmation passages restored, GFX Design 11 Nov) is shown only when the
 * confirmation mailer flag is on, so the site never promises a link it doesn't send.
 */
const PRIVACY_FILE = ACCM_CONFIRM_MAIL_LIVE ? "privacy-notice-v1.5.md" : "privacy-notice.md";

export default function Page() {
  return <LegalPage file={PRIVACY_FILE} />;
}
