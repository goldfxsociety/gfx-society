import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { ACCM_CONFIRM_MAIL_LIVE } from "@/lib/members/access-request";

export const metadata: Metadata = { title: "Privacy Notice" };

/**
 * Privacy v1.6 (15 Nov 2026, Sprint 3: access requests checked at each import, not only monthly) is live while the
 * confirmation mailer flag is on. History is kept: v1.5 (privacy-notice-v1.5.md, 11 Nov) and v1.4 (privacy-notice.md).
 * If the mailer flag is turned off (rollback), /privacy falls back to v1.4, so the site never promises a link it
 * doesn't send.
 */
const PRIVACY_FILE = ACCM_CONFIRM_MAIL_LIVE ? "privacy-notice-v1.6.md" : "privacy-notice.md";

export default function Page() {
  return <LegalPage file={PRIVACY_FILE} />;
}
