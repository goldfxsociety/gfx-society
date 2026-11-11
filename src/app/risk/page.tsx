import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Risk Disclaimer" };

export default function Page() {
  return <LegalPage file="risk-disclaimer.md" />;
}
