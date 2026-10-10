import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Privacy Notice | GFX Society" };

export default function Page() {
  return <LegalPage file="privacy-notice.md" />;
}
